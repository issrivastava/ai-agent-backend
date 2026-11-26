import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false, // test files run one at a time, so rate limits and ports never collide
    hookTimeout: 120_000, // the first run downloads the MongoDB binary
    testTimeout: 20_000,
    // Fake settings so the app's env validation passes. Real .env files are never loaded in tests.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/not-used-in-tests',
      CLIENT_ORIGIN: 'http://localhost:3000',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123',
      LLM_API_KEY: '', // empty keeps agents in simulated mode
    },
  },
});