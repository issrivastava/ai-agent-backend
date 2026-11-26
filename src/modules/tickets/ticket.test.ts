import { describe, expect, it } from 'vitest';
import { api, createTicket, createUser } from '../../test/helpers';

describe('tickets', () => {
  it('requires a session', async () => {
    expect((await api().get('/api/tickets')).status).toBe(401);
  });

  it('lists tickets newest first with TCK ids', async () => {
    const { cookie } = await createUser('viewer');
    await createTicket({ subject: 'First' });
    await createTicket({ subject: 'Second' });

    const res = await api().get('/api/tickets').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.map((t: { id: string }) => t.id)).toEqual(['TCK-1002', 'TCK-1001']);
    expect(res.body[0].subject).toBe('Second');
  });

  it('filters by status', async () => {
    const { cookie } = await createUser('viewer');
    await createTicket({ status: 'open' });
    await createTicket({ status: 'resolved' });

    const res = await api().get('/api/tickets?status=resolved').set('Cookie', cookie);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('resolved');
  });

  it('returns one ticket, and 404 for unknown or malformed ids', async () => {
    const { cookie } = await createUser('viewer');
    await createTicket();

    expect((await api().get('/api/tickets/TCK-1001').set('Cookie', cookie)).status).toBe(200);
    expect((await api().get('/api/tickets/TCK-9999').set('Cookie', cookie)).status).toBe(404);
    expect((await api().get('/api/tickets/abc').set('Cookie', cookie)).status).toBe(404);
  });

  it('lets an agent reassign a ticket', async () => {
    const { cookie } = await createUser('agent');
    await createTicket();

    const res = await api()
      .patch('/api/tickets/TCK-1001')
      .set('Cookie', cookie)
      .send({ assignedAgent: 'Triage Agent' });

    expect(res.status).toBe(200);
    expect(res.body.assignedAgent).toBe('Triage Agent');
  });

  it('rejects invalid updates', async () => {
    const { cookie } = await createUser('agent');
    await createTicket();

    const badStatus = await api().patch('/api/tickets/TCK-1001').set('Cookie', cookie).send({ status: 'banana' });
    const empty = await api().patch('/api/tickets/TCK-1001').set('Cookie', cookie).send({});

    expect(badStatus.status).toBe(400);
    expect(empty.status).toBe(400);
  });
});