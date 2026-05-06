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
    exclude: ['node_modules', 'dist', '.next', 'out'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'vitest.config.ts',
        'vitest.setup.ts',
        '**/*.d.ts',
        '**/*.config.js',
        '**/*.config.ts',
        '**/dist/**',
        '**/.next/**',
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
