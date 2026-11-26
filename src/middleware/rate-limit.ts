import { rateLimit } from 'express-rate-limit';

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
} as const;

// 10 failed sign-ins per 15 minutes per IP. Successful ones aren't counted.
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { message: 'Too many sign-in attempts. Try again in a few minutes.' },
});

export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many sign-ups from this address. Try again later.' },
});

// Guards password changes against guessing the current password.
export const changePasswordLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { message: 'Too many password change attempts. Try again in a few minutes.' },
});