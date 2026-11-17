import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env';

export const AUTH_COOKIE = 'token'; // the frontend's proxy.ts checks this exact name
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: MAX_AGE_SECONDS,
  });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid token');
  return payload.sub;
}

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript in the browser can't read it, which limits XSS damage
  secure: isProd, // HTTPS only in production
  sameSite: 'lax',
  path: '/',
};

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, { ...cookieOptions, maxAge: MAX_AGE_SECONDS * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
}