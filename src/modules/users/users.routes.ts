import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth';
import { HttpError } from '../../utils/http-error';
import { roles, toPublicUser, User } from './user.model';

export const usersRouter = Router();

// Everything below requires an admin.
usersRouter.use(authenticate, requirePermission('users:manage'));

usersRouter.get('/', async (_req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  res.json(users.map(toPublicUser));
});

const updateRoleSchema = z.object({ role: z.enum(roles) });

usersRouter.patch('/:id', async (req, res) => {
  const { role } = updateRoleSchema.parse(req.body);

  // Stops an admin from demoting themselves and leaving no admin at all.
  if (req.params.id === req.user?.id) {
    throw HttpError.badRequest('You cannot change your own role');
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });
  if (!user) throw HttpError.notFound('User not found');

  res.json(toPublicUser(user));
});