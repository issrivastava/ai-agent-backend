import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Role } from '../../config/permissions';

export const roles = ['admin', 'agent', 'viewer'] as const satisfies readonly Role[];

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false keeps the hash out of every query unless you ask for it explicitly.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: roles, default: 'viewer', required: true },
  },
  { timestamps: true },
);

export const User = model<IUser>('User', userSchema);

// This is the shape the frontend's `User` type expects. Never send the hash.
export type PublicUser = { id: string; name: string; email: string; role: Role };

export const toPublicUser = (u: HydratedDocument<IUser>): PublicUser => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
});