import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'dist/**', 'node_modules/**'],
  },
});
