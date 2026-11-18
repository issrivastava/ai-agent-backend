import type { Request } from 'express';
import { HttpError } from './http-error';

/** Reads a route parameter as a plain string (Express types it as string | string[]). */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) throw HttpError.badRequest(`Missing ${name}`);
  return first;
}