import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { loginLimiter, registerLimiter } from '../../middleware/rate-limit';
import { login, logout, me, register } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', registerLimiter, register);
authRouter.post('/login', loginLimiter, login);
authRouter.post('/logout', logout); // not protected, so a stale cookie can always be cleared
authRouter.get('/me', authenticate, me);