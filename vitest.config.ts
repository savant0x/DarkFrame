/**
 * Vitest Configuration
 * Created: 2025-10-23
 * 
 * OVERVIEW:
 * Configures Vitest testing framework for Next.js application with TypeScript support.
 * Provides path aliases matching tsconfig.json for clean imports in tests.
 * Uses jsdom for DOM environment simulation and includes setup file for test utilities.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // FID-20260928-002 (SCOPE row 128): dev/tmp/ is the gitignored scratch
    // area — never test discovery surface. (tsconfig + eslint carry the
    // matching exclusions.)
    exclude: ['node_modules', 'dist', '.next', 'out', 'dev/tmp/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      // FID-20260928-005: measure the production surface only — lib/ (services),
      // app/api/ (routes), utils/ (engine + helpers). Test files, config files,
      // type declarations and page/layout components are excluded by default
      // include-scoping; this list is the instrumented surface.
      include: ['lib/**', 'app/api/**', 'utils/**'],
      exclude: [
        'node_modules/',
        'vitest.config.ts',
        'vitest.setup.ts',
        '**/*.d.ts',
        '**/*.config.js',
        '**/*.config.ts',
        '**/dist/**',
        '**/.next/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/__tests__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/types': path.resolve(__dirname, './types'),
      '@/utils': path.resolve(__dirname, './utils'),
      '@/app': path.resolve(__dirname, './app'),
      '@/context': path.resolve(__dirname, './context'),
      '@/hooks': path.resolve(__dirname, './hooks'),
    },
  },
});
