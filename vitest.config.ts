import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // server tests use Jest, not Vitest — exclude them
    exclude: ['server/**', 'node_modules/**', 'dist/**'],
    globals: true,
    environment: 'node',
  },
});
