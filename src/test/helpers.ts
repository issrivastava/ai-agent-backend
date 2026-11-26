import request from 'supertest';
import { createApp } from '../app';
import { Ticket, nextTicketNumber } from '../modules/tickets/ticket.model';
import { Run } from '../modules/runs/run.model';
import { advanceRun } from '../modules/runs/run.service';
import { User } from '../modules/users/user.model';
import { Workflow, nextWorkflowNumber } from '../modules/workflows/workflow.model';
import { hashPassword } from '../utils/password';
import { AUTH_COOKIE, signToken } from '../utils/token';

const app = createApp();
export const api = () => request(app);

export type TestRole = 'admin' | 'agent' | 'viewer';

/** Creates a user directly and returns a ready-made session cookie, so tests skip the login limiter. */
export async function createUser(role: TestRole, email = `${role}@test.dev`) {
  const user = await User.create({
    name: `${role} user`,
    email,
    passwordHash: await hashPassword('Password1'),
    role,
  });
  return { user, cookie: `${AUTH_COOKIE}=${signToken(String(user._id))}` };
}

export async function createTicket(overrides: Record<string, unknown> = {}) {
  return Ticket.create({
    number: await nextTicketNumber(),
    subject: 'Refund not received',
    description: 'The refund for a cancelled booking has not arrived after 7 days.',
    customer: 'Test Customer',
    status: 'open',
    priority: 'high',
    assignedAgent: 'Billing Agent',
    ...overrides,
  });
}

/** Three agents. The middle one uses refund_api, a risky tool, so it pauses for approval. */
export async function createWorkflow(overrides: Record<string, unknown> = {}) {
  return Workflow.create({
    number: await nextWorkflowNumber(),
    name: 'Support ticket triage',
    description: 'Test workflow',
    type: 'dispatch',
    status: 'active',
    agents: [
      { role: 'triage', prompt: 'Classify the ticket by topic.', tools: ['ticket_lookup'] },
      { role: 'billing', prompt: 'Handle billing and refund questions.', tools: ['refund_api'] },
      { role: 'dispatch', prompt: 'Assign the ticket to a team.', tools: ['assign_ticket'] },
    ],
    ...overrides,
  });
}

/**
 * Stands in for the background executor. Each call moves the run one step forward,
 * pretending 10 seconds have passed so the step is always due.
 */
export function createTicker() {
  let now = Date.now();
  return async (runId: string) => {
    now += 10_000;
    const run = await Run.findOne({ number: Number(runId.replace('RUN-', '')) });
    if (!run) throw new Error(`${runId} not found`);
    await advanceRun(run, new Date(now));
  };
}