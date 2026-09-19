/**
 * Vitest Setup File
 * Created: 2025-10-23
 * Updated: 2026-09-19 (shim-exit commit 3: in-memory MongoDB block removed —
 * the Mongo stack is deleted; see lib/mongodb.ts removal)
 * 
 * OVERVIEW:
 * Configures test environment with @testing-library/jest-dom matchers.
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';
// FID-20260913-001: NO node-builtin import may live in this file. Under the
// jsdom environment, vite's browser-compat layer externalizes node builtins to
// the stub id "__vite-browser-external"; vitest 4.1.2's toBuiltin() reverse-maps
// that stub via id.slice(24) → "" and returns the literal specifier "node:",
// which Node rejects — every jsdom suite then dies at collection with
// "No such built-in module: node:" (75/76 files). Both the bare 'util' and the
// prefixed 'node:util' forms hit the same path (verified: the externalization
// warning names the import either way). The old TextEncoder/TextDecoder
// polyfill was therefore removed — see the marker below.

// Set test environment
(process.env as Record<string, string>).NODE_ENV = 'test';

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

// TextEncoder/TextDecoder polyfill REMOVED (FID-20260913-001): Node has shipped
// both as globals since v11 and the jsdom environment does not remove them, so
// the `if (!globalThis.TextEncoder)` guard could never fire — the polyfill was
// dead weight on this toolchain, while its 'util' import killed every jsdom
// suite at collection (see the FID note above).

// In-memory MongoDB block REMOVED (2026-09-19): the Mongo shim and stack are
// gone — nothing consumes the old Mongo env config anymore.
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

console.log('✅ Test environment configured');

