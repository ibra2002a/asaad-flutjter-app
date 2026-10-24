import { defineConfig } from 'vitest/config';

/** Live Supabase tests. Requires SUPABASE_INTEGRATION=1 and the project variables. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
