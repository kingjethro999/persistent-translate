import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'jsdom',
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
