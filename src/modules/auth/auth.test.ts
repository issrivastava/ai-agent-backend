import { describe, expect, it } from 'vitest';
import { api, createUser } from '../../test/helpers';

describe('auth', () => {
  it('registers a new user as a viewer', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'New Person', email: 'new@test.dev', password: 'Password1' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@test.dev', role: 'viewer' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('ignores a role sent in the request body', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@test.dev', password: 'Password1', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('viewer');
  });

  it('rejects a weak password', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Weak', email: 'weak@test.dev', password: 'password' });

    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email', async () => {
    await createUser('viewer', 'taken@test.dev');
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Copy', email: 'taken@test.dev', password: 'Password1' });

    expect(res.status).toBe(409);
  });

  it('logs in with the right password and sets a session cookie', async () => {
    await createUser('agent', 'agent@test.dev');
    const res = await api().post('/api/auth/login').send({ email: 'agent@test.dev', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('agent');
    expect(String(res.headers['set-cookie'])).toContain('token=');
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await createUser('agent', 'agent@test.dev');
    const wrongPassword = await api().post('/api/auth/login').send({ email: 'agent@test.dev', password: 'Wrong1234' });
    const unknownEmail = await api().post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'Password1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('protects /me', async () => {
    const { cookie } = await createUser('viewer');

    expect((await api().get('/api/auth/me')).status).toBe(401);
    const res = await api().get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('viewer');
  });

  it('rejects a tampered session cookie', async () => {
    const res = await api().get('/api/auth/me').set('Cookie', 'token=not-a-real-token');
    expect(res.status).toBe(401);
  });
});