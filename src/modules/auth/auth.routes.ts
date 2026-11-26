import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { changePasswordLimiter, loginLimiter, registerLimiter } from '../../middleware/rate-limit';
import { changePassword, login, logout, me, register } from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', registerLimiter, register);
authRouter.post('/login', loginLimiter, login);
authRouter.post('/logout', logout); // not protected, so a stale cookie can always be cleared
authRouter.post('/change-password', authenticate, changePasswordLimiter, changePassword);
authRouter.get('/me', authenticate, me);