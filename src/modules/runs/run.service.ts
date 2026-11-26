import type { HydratedDocument } from 'mongoose';
import { HttpError } from '../../utils/http-error';
import { Ticket, formatTicketId } from '../tickets/ticket.model';
import type { IWorkflow } from '../workflows/workflow.model';
import { agentsEnabled, formatAgentOutput, runAgent } from './agent/agent.runner';
import { executeApprovedTool } from './agent/agent.tools';
import { Run, nextRunNumber, type IRun, type IRunStep } from './run.model';

type RunDoc = HydratedDocument<IRun>;

export const STEP_MS = 2500; // simulated work time (used when agents are off)
// Steps using these tools pause for a human decision before the tool runs.
export const RISKY_TOOLS: readonly string[] = ['refund_api', 'email_sender'];

// With real agents the next step is due almost immediately. Otherwise it waits STEP_MS.
const dueDelay = (ticketNumber?: number) => (agentsEnabled && ticketNumber ? 500 : STEP_MS);

export async function createRun(
  workflow: HydratedDocument<IWorkflow>,
  userId: string,
  ticketNumber?: number,
) {
  const now = new Date();

  const steps: IRunStep[] = workflow.agents.map((agent, i) => ({
    agent: agent.role,
    action: agent.prompt,
    tool: agent.tools.find((t) => RISKY_TOOLS.includes(t)) ?? agent.tools[0],
    status: i === 0 ? 'running' : 'pending',
    requiresApproval: agent.tools.some((t) => RISKY_TOOLS.includes(t)),
    startedAt: i === 0 ? now : undefined,
  }));

  return Run.create({
    number: await nextRunNumber(),
    workflowNumber: workflow.number,
    workflowName: workflow.name,
    ticketNumber,
    status: 'running',
    cursor: 0,
    stepDueAt: new Date(now.getTime() + dueDelay(ticketNumber)),
    startedBy: userId,
    startedAt: now,
    steps,
  });
}

function pauseForApproval(run: RunDoc, step: IRunStep) {
  step.status = 'waiting_approval';
  run.status = 'waiting_approval';
  run.stepDueAt = null;
  return run.save();
}

function completeStep(run: RunDoc, step: IRunStep, now: Date) {
  step.status = 'completed';
  step.durationMs = now.getTime() - (step.startedAt ?? now).getTime();

  const next = run.steps[run.cursor + 1];
  if (next) {
    run.cursor += 1;
    next.status = 'running';
    next.startedAt = now;
    run.stepDueAt = new Date(now.getTime() + dueDelay(run.ticketNumber));
  } else {
    run.status = 'completed';
    run.finishedAt = now;
    run.stepDueAt = null;
  }
  return run.save();
}

function failRun(run: RunDoc, step: IRunStep, now: Date, err: unknown) {
  console.error('Agent step failed:', err); // details stay in the server log
  step.status = 'failed';
  step.durationMs = now.getTime() - (step.startedAt ?? now).getTime();
  step.output = 'The agent could not complete this step. Please start a new run.';
  run.status = 'failed';
  run.finishedAt = new Date();
  run.stepDueAt = null;
  return run.save();
}

/** The original behavior: the "work" is a timed wait. Used when agents are off or there is no ticket. */
async function advanceSimulated(run: RunDoc, step: IRunStep, now: Date) {
  if (step.requiresApproval && !step.approval) {
    await pauseForApproval(run, step);
    return;
  }
  step.output = `${step.agent} agent finished${step.tool ? ` using ${step.tool}` : ''}.`;
  await completeStep(run, step, now);
}

async function advanceWithAgent(run: RunDoc, step: IRunStep, now: Date) {
  // Phase 2: a person approved the proposal, so the tool runs now.
  if (step.requiresApproval && step.approval === 'approved') {
    step.output = [step.output, executeApprovedTool(step.tool)].filter(Boolean).join('\n\n');
    await completeStep(run, step, now);
    return;
  }

  // Phase 1: ask the model (once). The output is saved, so a restart doesn't repeat finished work.
  if (!step.output) {
    try {
      const ticket = await Ticket.findOne({ number: run.ticketNumber });
      if (!ticket) throw new Error(`Ticket ${run.ticketNumber} no longer exists`);

      const result = await runAgent({
        role: step.agent,
        instructions: step.action,
        tools: step.tool ? [step.tool] : [],
        requiresApproval: step.requiresApproval,
        ticket: {
          id: formatTicketId(ticket.number),
          subject: ticket.subject,
          description: ticket.description,
          customer: ticket.customer,
          priority: ticket.priority,
        },
        previous: run.steps
          .slice(0, run.cursor)
          .filter((s) => s.output)
          .map((s) => ({ agent: s.agent, output: s.output as string })),
      });
      step.output = formatAgentOutput(result);
    } catch (err) {
      await failRun(run, step, now, err);
      return;
    }
  }

  if (step.requiresApproval && !step.approval) {
    await pauseForApproval(run, step);
    return;
  }
  await completeStep(run, step, now);
}

/** Moves a run forward if its current step is due. Called by the executor. */
export async function advanceRun(run: RunDoc, now = new Date()) {
  if (run.status !== 'running' || !run.stepDueAt || run.stepDueAt.getTime() > now.getTime()) return;

  const step = run.steps[run.cursor];
  if (!step) return;

  if (agentsEnabled && run.ticketNumber) await advanceWithAgent(run, step, now);
  else await advanceSimulated(run, step, now);
}

/** Applies a reviewer's decision to the step that is waiting for approval. */
export async function decideRun(run: RunDoc, decision: 'approved' | 'rejected', now = new Date()) {
  if (run.status !== 'waiting_approval') {
    throw HttpError.conflict('This run is not waiting for approval');
  }

  const step = run.steps[run.cursor];
  if (!step) throw HttpError.conflict('This run has no step to decide on');
  step.approval = decision;

  if (decision === 'approved') {
    step.status = 'running';
    step.startedAt = now; // duration counts the work, not the time spent waiting
    run.status = 'running';
    run.stepDueAt = new Date(now.getTime() + dueDelay(run.ticketNumber));
  } else {
    step.status = 'failed';
    step.output = [step.output, 'Rejected by reviewer.'].filter(Boolean).join('\n\n');
    run.status = 'failed';
    run.finishedAt = now;
    run.stepDueAt = null; // remaining steps stay pending
  }
  await run.save();
}