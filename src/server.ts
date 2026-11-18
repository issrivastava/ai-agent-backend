import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { startRunExecutor } from './modules/runs/run.executor';

const app = createApp();

// --- VERCEL SERVERLESS SETUP ---
// Cache the DB connection across serverless invocations
let dbPromise: Promise<void> | null = null;

const ensureDbConnected = async () => {
  if (!dbPromise) {
    dbPromise = connectDb().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
};

// Middleware for Vercel so MongoDB connects before any route runs
if (process.env.VERCEL) {
  app.use(async (_req, _res, next) => {
    try {
      await ensureDbConnected();
      next();
    } catch (err) {
      next(err);
    }
  });
}

// --- LOCAL DEVELOPMENT SETUP ---
async function main() {
  await connectDb();

  const stopExecutor = startRunExecutor();
  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}/api`);
  });

  // Close connections cleanly when the process is stopped or the host restarts it.
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down…`);
    stopExecutor();
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Only start the continuous server & background executor when NOT on Vercel
if (!process.env.VERCEL) {
  main().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;