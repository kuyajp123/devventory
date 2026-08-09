import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    clearMocks: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    maxWorkers: process.env.CI ? 2 : 4,
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 15_000,
  },
});
