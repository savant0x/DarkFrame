/**
 * Vitest Setup File
 * Created: 2025-10-23
 * 
 * OVERVIEW:
 * Configures test environment with @testing-library/jest-dom matchers.
 * MongoDB memory server setup is optional and only used for integration tests.
 */

import '@testing-library/jest-dom';
import { vi, afterAll } from 'vitest';
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';

// Set test environment
(process.env as any).NODE_ENV = 'test';

// Fail-fast DB guard (FID-20260902-001): connection.ts throws at import when
// DATABASE_URL is missing. Tests mock the DB layer, so provide a stub URL.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';

// React 18 requires this flag for act() to flush the concurrent scheduler synchronously.
// @testing-library/react only auto-sets it when running under jest — under vitest it
// must be declared explicitly (SESSION-2026-09-02-006): without it, renders inside
// act() may not commit (empty <body/>), user-event dispatches never settle, and
// waitFor hangs to the test timeout.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// @testing-library/dom's waitFor only advances FAKE timers when it detects jest
// (`jestFakeTimersAreEnabled()` hard-checks `typeof jest` before its sinon-clock
// check, so vitest's sinon-based fake timers are never seen). Without this shim,
// any waitFor under vi.useFakeTimers() spins on a frozen clock until the test
// timeout (SESSION-2026-09-02-006, Class A/B/C root cause). Delegate only the
// timer-advance surface RTL actually calls — nothing else is emulated.
import { vi as __vi } from 'vitest';
Object.assign(globalThis, {
  jest: {
    advanceTimersByTime: (ms: number) => __vi.advanceTimersByTime(ms),
    advanceTimersByTimeAsync: async (ms: number) => await __vi.advanceTimersByTimeAsync(ms),
    runAllTimers: () => __vi.runAllTimers(),
    runAllTimersAsync: async () => await __vi.runAllTimersAsync(),
    clearAllTimers: () => __vi.clearAllTimers(),
  },
});

// Polyfill TextEncoder/TextDecoder for jsdom environment
if (!(globalThis as any).TextEncoder) {
  (globalThis as any).TextEncoder = NodeTextEncoder as any;
}
if (!(globalThis as any).TextDecoder) {
  (globalThis as any).TextDecoder = NodeTextDecoder as any;
}

// In-memory MongoDB is OPT-IN (TEST_MONGO_MEMORY=1).
// The runtime DB is the compat layer over drizzle (DATABASE_URL) — nothing in the
// test tree consumes MONGODB_URI, and booting one mongod per vitest worker per run
// (5+ instances observed) cost real memory for zero coverage (heap-OOM contributor).
// Set TEST_MONGO_MEMORY=1 only for legacy suites that genuinely need it.
let __memoryMongo: unknown | null = null;
if (process.env.TEST_MONGO_MEMORY === '1') {
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    // No structural annotation: infer the real class type (a hand-rolled
    // object-type annotation fails against the class in strict mode).
    const memory = await MongoMemoryServer.create();
    __memoryMongo = memory;
    const uri = memory.getUri('darkframe-test');
    process.env.MONGODB_URI = uri;
    // Optionally set DB name for helpers that read it
    if (!process.env.MONGODB_DB) process.env.MONGODB_DB = 'darkframe-test';
    // eslint-disable-next-line no-console
    console.log(`✅ In-memory MongoDB started for tests: ${uri}`);
  } catch (err) {
    // Fallback to localhost only if memory server fails to start
    if (!process.env.MONGODB_URI) {
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/darkframe-test';
    }
    // eslint-disable-next-line no-console
    console.warn('⚠️ mongodb-memory-server failed to start, falling back to localhost:', err);
  }
} else {
  // eslint-disable-next-line no-console
  console.log('ℹ️ In-memory MongoDB disabled (set TEST_MONGO_MEMORY=1 to enable)');
}
// Ensure JWT secret is set for tests that generate real tokens
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';

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
  // Ensure the in-memory server is stopped when tests finish
  afterAll(async () => {
    if (__memoryMongo) {
      try {
        await (__memoryMongo as { stop: () => Promise<void> }).stop();
        // eslint-disable-next-line no-console
        console.log('🧹 In-memory MongoDB stopped');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('⚠️ Failed to stop in-memory MongoDB:', e);
      }
    }
  });

console.log('✅ Test environment configured');

