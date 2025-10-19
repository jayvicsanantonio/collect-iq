import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.test.ts'],
    testTimeout: 60000, // E2E tests may take longer
    hookTimeout: 30000,
    setupFiles: ['./src/tests/e2e/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'src/tests/**', '**/*.test.ts', '**/*.e2e.test.ts', 'dist/**'],
    },
  },
});
