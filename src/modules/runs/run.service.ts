import type { HydratedDocument } from 'mongoose';
import { HttpError } from '../../utils/http-error';
import type { IWorkflow } from '../workflows/workflow.model';
import { Run, nextRunNumber, type IRun, type IRunStep } from './run.model';

type RunDoc = HydratedDocument<IRun>;

export const STEP_MS = 2500; // how long each simulated step "works"
// Steps using these tools pause for a human decision before completing.
export const RISKY_TOOLS: readonly string[] = ['refund_api', 'email_sender'];

export async function createRun(workflow: HydratedDocument<IWorkflow>, userId: string) {
  const now = new Date();

  const steps: IRunStep[] = workflow.agents.map((agent, i) => ({
    agent: agent.role,
    action: agent.prompt,
    tool: agent.tools[0],
    status: i === 0 ? 'running' : 'pending',
    requiresApproval: agent.tools.some((t) => RISKY_TOOLS.includes(t)),
    startedAt: i === 0 ? now : undefined,
  }));

  return Run.create({
    number: await nextRunNumber(),
    workflowNumber: workflow.number,
    workflowName: workflow.name,
    status: 'running',
    cursor: 0,
    stepDueAt: new Date(now.getTime() + STEP_MS),
    startedBy: userId,
    startedAt: now,
    steps,
  });
}

/**
 * Moves a run forward if its current step is due. Called by the executor.
 * This is where real agent calls would go: the simulated "work" is the wait.
 */
export async function advanceRun(run: RunDoc, now = new Date()) {
  if (run.status !== 'running' || !run.stepDueAt || run.stepDueAt.getTime() > now.getTime()) return;

  const step = run.steps[run.cursor];
  if (!step) return;

  // Risky step with no decision yet: stop and wait for a human.
  if (step.requiresApproval && !step.approval) {
    step.status = 'waiting_approval';
    run.status = 'waiting_approval';
    run.stepDueAt = null;
    await run.save();
    return;
  }

  step.status = 'completed';
  step.durationMs = now.getTime() - (step.startedAt ?? now).getTime();
  step.output = `${step.agent} agent finished${step.tool ? ` using ${step.tool}` : ''}.`;

  const next = run.steps[run.cursor + 1];
  if (next) {
    run.cursor += 1;
    next.status = 'running';
    next.startedAt = now;
    run.stepDueAt = new Date(now.getTime() + STEP_MS);
  } else {
    run.status = 'completed';
    run.finishedAt = now;
    run.stepDueAt = null;
  }
  await run.save();
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
    run.stepDueAt = new Date(now.getTime() + STEP_MS);
  } else {
    step.status = 'failed';
    step.output = 'Rejected by reviewer.';
    run.status = 'failed';
    run.finishedAt = now;
    run.stepDueAt = null; // remaining steps stay pending
  }
  await run.save();
}