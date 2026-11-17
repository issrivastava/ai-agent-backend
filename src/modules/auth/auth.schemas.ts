import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  email,
  password: z
    .string()
    .min(8, 'At least 8 characters')
    // bcrypt ignores everything after 72 bytes, so cap it instead of truncating silently.
    .max(72, 'Password is too long (72 characters maximum)')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a number'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});