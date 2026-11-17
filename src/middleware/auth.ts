//(next) verify token, check role
import type { RequestHandler } from 'express';
import { hasPermission, type Permission } from '../config/permissions';
import { toPublicUser, User } from '../modules/users/user.model';
import { HttpError } from '../utils/http-error';
import { AUTH_COOKIE, verifyToken } from '../utils/token';

/** Requires a valid session cookie, and attaches the current user as req.user. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) throw HttpError.unauthorized();

  let userId: string;
  try {
    userId = verifyToken(token);
  } catch {
    throw HttpError.unauthorized('Session expired. Please sign in again.');
  }

  const user = await User.findById(userId);
  if (!user) throw HttpError.unauthorized();

  req.user = toPublicUser(user);
  next();
};

/** Use after `authenticate`. Responds 403 if the user's role lacks the permission. */
export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw HttpError.unauthorized();
    if (!hasPermission(req.user.role, permission)) throw HttpError.forbidden();
    next();
  };