import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.*', 'src/**/__tests__/**', 'src/lib/i18n/translations/**'],
      thresholds: {
        statements: 40,
        branches: 30,
        functions: 30,
        lines: 40,
      },
    },
  },
});
