/**
 * Vitest Setup File
 * Created: 2025-10-23
 * 
 * OVERVIEW:
 * Configures test environment with @testing-library/jest-dom matchers.
 * Sets up Supabase test environment variables.
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';

// Set test environment
(process.env as any).NODE_ENV = 'test';

// Polyfill TextEncoder/TextDecoder for jsdom environment
if (!(globalThis as any).TextEncoder) {
  (globalThis as any).TextEncoder = NodeTextEncoder as any;
}
if (!(globalThis as any).TextDecoder) {
  (globalThis as any).TextDecoder = NodeTextDecoder as any;
}

// Set test environment variables for Supabase
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
}
if (!process.env.MONGODB_DB) {
  process.env.MONGODB_DB = 'darkframe-test';
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret';
}

// Mock window.matchMedia for components using useMediaQuery hook
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated but might be used
      removeListener: vi.fn(), // deprecated but might be used
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// eslint-disable-next-line no-console
console.log('✅ Test environment configured');
