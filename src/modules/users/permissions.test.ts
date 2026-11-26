import { describe, expect, it } from 'vitest';
import { api, createTicket, createUser } from '../../test/helpers';

describe('role permissions', () => {
  it('only admins can list users', async () => {
    const admin = await createUser('admin');
    const agent = await createUser('agent');
    const viewer = await createUser('viewer');

    expect((await api().get('/api/users')).status).toBe(401);
    expect((await api().get('/api/users').set('Cookie', viewer.cookie)).status).toBe(403);
    expect((await api().get('/api/users').set('Cookie', agent.cookie)).status).toBe(403);
    expect((await api().get('/api/users').set('Cookie', admin.cookie)).status).toBe(200);
  });

  it('lets an admin promote a user', async () => {
    const admin = await createUser('admin');
    const viewer = await createUser('viewer');

    const res = await api()
      .patch(`/api/users/${String(viewer.user._id)}`)
      .set('Cookie', admin.cookie)
      .send({ role: 'agent' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('agent');
  });

  it('stops an admin from changing their own role', async () => {
    const admin = await createUser('admin');

    const res = await api()
      .patch(`/api/users/${String(admin.user._id)}`)
      .set('Cookie', admin.cookie)
      .send({ role: 'viewer' });

    expect(res.status).toBe(400);
  });

  it('lets only admins manage workflows', async () => {
    const agent = await createUser('agent');
    const viewer = await createUser('viewer');

    expect((await api().post('/api/workflows').set('Cookie', agent.cookie).send({})).status).toBe(403);
    expect((await api().post('/api/workflows').set('Cookie', viewer.cookie).send({})).status).toBe(403);
  });

  it('lets viewers read but not change tickets', async () => {
    const viewer = await createUser('viewer');
    await createTicket();

    expect((await api().get('/api/tickets').set('Cookie', viewer.cookie)).status).toBe(200);
    const res = await api()
      .patch('/api/tickets/TCK-1001')
      .set('Cookie', viewer.cookie)
      .send({ status: 'resolved' });
    expect(res.status).toBe(403);
  });
});