//connects the DB, then starts listening
import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDb();

  const server = createApp().listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}/api`);
  });

  // Close connections cleanly when the process is stopped or the host restarts it.
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down…`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});