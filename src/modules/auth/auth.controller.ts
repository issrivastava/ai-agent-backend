import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../../utils/password';
import { clearAuthCookie, setAuthCookie, signToken } from '../../utils/token';
import { toPublicUser, User } from '../users/user.model';
import { changePasswordSchema, loginSchema, registerSchema } from './auth.schemas';

export const register: RequestHandler = async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);

  if (await User.exists({ email })) {
    throw HttpError.conflict('An account with this email already exists');
  }

  // The role is never taken from the request. Public sign-ups are always viewers.
  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: 'viewer',
  });

  res.status(201).json({ user: toPublicUser(user) });
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email }).select('+passwordHash');
  // Always run one bcrypt comparison, even for unknown emails, so timing reveals nothing.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw HttpError.unauthorized('Invalid email or password');

  setAuthCookie(res, signToken(String(user._id)));
  res.json({ user: toPublicUser(user) });
};

export const logout: RequestHandler = (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
};

export const changePassword: RequestHandler = async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await User.findById(req.user?.id).select('+passwordHash');
  if (!user) throw HttpError.unauthorized();

  // Always run a comparison so a wrong password is not answered any faster.
  const valid = await verifyPassword(currentPassword, user.passwordHash ?? DUMMY_HASH);
  // 400, not 401: a 401 makes the frontend treat the session as expired and sign the user out.
  if (!valid) throw HttpError.badRequest('Current password is incorrect');

  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw HttpError.badRequest('New password must be different from the current one');
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  res.status(204).end();
};

export const me: RequestHandler = (req, res) => {
  res.json({ user: req.user });
};