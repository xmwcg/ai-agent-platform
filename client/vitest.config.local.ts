import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: [
      'client/src/pages/project-grade-request-guard.test.ts',
      'client/src/services/api.project-grade.test.ts',
      'client/src/config/site-features.project-grade.test.ts',
    ],
    globals: true,
    environment: 'node',
    reporters: 'default',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});