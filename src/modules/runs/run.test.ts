import { describe, expect, it } from 'vitest';
import { api, createTicker, createTicket, createUser, createWorkflow } from '../../test/helpers';
import { formatWorkflowId } from '../workflows/workflow.model';

async function startRun(cookie: string, workflowNumber: number, body: object = {}) {
  return api()
    .post(`/api/workflows/${formatWorkflowId(workflowNumber)}/run`)
    .set('Cookie', cookie)
    .send(body);
}

describe('starting a run', () => {
  it('runs against the ticket that was chosen, not just the newest', async () => {
    const { cookie } = await createUser('agent');
    const wf = await createWorkflow();
    await createTicket({ subject: 'Older' }); // TCK-1001
    await createTicket({ subject: 'Newer' }); // TCK-1002

    const started = await startRun(cookie, wf.number, { ticketId: 'TCK-1001' });
    expect(started.status).toBe(201);

    const run = await api().get(`/api/runs/${started.body.runId}`).set('Cookie', cookie);
    expect(run.body.ticketId).toBe('TCK-1001');
  });

  it('falls back to the newest open ticket', async () => {
    const { cookie } = await createUser('agent');
    const wf = await createWorkflow();
    await createTicket();
    await createTicket();

    const started = await startRun(cookie, wf.number);
    const run = await api().get(`/api/runs/${started.body.runId}`).set('Cookie', cookie);
    expect(run.body.ticketId).toBe('TCK-1002');
  });

  it('refuses a draft workflow, an unknown ticket, and a missing open ticket', async () => {
    const { cookie } = await createUser('agent');
    const draft = await createWorkflow({ status: 'draft' });
    const active = await createWorkflow();
    await createTicket();

    expect((await startRun(cookie, draft.number)).status).toBe(400);
    expect((await startRun(cookie, active.number, { ticketId: 'TCK-9999' })).status).toBe(404);
  });

  it('returns 404 when there is no open ticket to work on', async () => {
    const { cookie } = await createUser('agent');
    const wf = await createWorkflow();

    const res = await startRun(cookie, wf.number);
    expect(res.status).toBe(404);
  });

  it('does not let a viewer start a run', async () => {
    const { cookie } = await createUser('viewer');
    const wf = await createWorkflow();
    await createTicket();

    expect((await startRun(cookie, wf.number)).status).toBe(403);
  });
});

describe('approval flow', () => {
  async function runUntilPaused() {
    const agent = await createUser('agent');
    const wf = await createWorkflow();
    await createTicket();
    const tick = createTicker();

    const { runId } = (await startRun(agent.cookie, wf.number)).body;
    await tick(runId); // triage finishes
    await tick(runId); // billing wants refund_api and pauses
    return { agent, runId, tick };
  }

  it('pauses at a risky step and waits for a person', async () => {
    const { agent, runId } = await runUntilPaused();

    const run = (await api().get(`/api/runs/${runId}`).set('Cookie', agent.cookie)).body;
    expect(run.status).toBe('waiting_approval');
    expect(run.steps[0].status).toBe('completed');
    expect(run.steps[1].status).toBe('waiting_approval');
    expect(run.steps[2].status).toBe('pending');
  });

  it('finishes the run after the step is approved', async () => {
    const { agent, runId, tick } = await runUntilPaused();

    const decided = await api()
      .post(`/api/runs/${runId}/decision`)
      .set('Cookie', agent.cookie)
      .send({ decision: 'approved' });
    expect(decided.status).toBe(200);
    expect(decided.body.status).toBe('running');

    await tick(runId); // billing completes
    await tick(runId); // dispatch completes

    const run = (await api().get(`/api/runs/${runId}`).set('Cookie', agent.cookie)).body;
    expect(run.status).toBe('completed');
    expect(run.steps.every((s: { status: string }) => s.status === 'completed')).toBe(true);
  });

  it('stops the run when the step is rejected', async () => {
    const { agent, runId, tick } = await runUntilPaused();

    const decided = await api()
      .post(`/api/runs/${runId}/decision`)
      .set('Cookie', agent.cookie)
      .send({ decision: 'rejected' });
    expect(decided.status).toBe(200);

    await tick(runId); // nothing should move

    const run = (await api().get(`/api/runs/${runId}`).set('Cookie', agent.cookie)).body;
    expect(run.status).toBe('failed');
    expect(run.steps[1].status).toBe('failed');
    expect(run.steps[2].status).toBe('pending');
  });

  it('refuses a decision when nothing is waiting', async () => {
    const agent = await createUser('agent');
    const wf = await createWorkflow();
    await createTicket();
    const { runId } = (await startRun(agent.cookie, wf.number)).body;

    const res = await api()
      .post(`/api/runs/${runId}/decision`)
      .set('Cookie', agent.cookie)
      .send({ decision: 'approved' });
    expect(res.status).toBe(409);
  });

  it('does not let a viewer approve', async () => {
    const { runId } = await runUntilPaused();
    const viewer = await createUser('viewer');

    const res = await api()
      .post(`/api/runs/${runId}/decision`)
      .set('Cookie', viewer.cookie)
      .send({ decision: 'approved' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid decision value', async () => {
    const { agent, runId } = await runUntilPaused();

    const res = await api()
      .post(`/api/runs/${runId}/decision`)
      .set('Cookie', agent.cookie)
      .send({ decision: 'maybe' });
    expect(res.status).toBe(400);
  });
});