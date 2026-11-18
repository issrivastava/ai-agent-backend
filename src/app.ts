// builds the Express app
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { env, isProd } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { ticketsRouter } from './modules/tickets/ticket.routes';
import { workflowsRouter } from './modules/workflows/workflow.routes';
import { runsRouter } from './modules/runs/run.routes';


export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Needed when deployed behind a proxy (Render, Railway, etc.) so secure cookies and IPs work.
  if (isProd) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN, // must be an exact origin, never '*', when credentials are on
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!isProd) app.use(morgan('dev'));

  const api = express.Router();

  api.get('/health', (_req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
      status: 'ok',
      database: states[mongoose.connection.readyState] ?? 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  // Feature routers get mounted here as we build them:
    api.use('/auth', authRouter);
    api.use('/users', usersRouter);
    api.use('/tickets', ticketsRouter);
    api.use('/workflows', workflowsRouter);
    api.use('/runs', runsRouter);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}