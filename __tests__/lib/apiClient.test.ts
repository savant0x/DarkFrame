/**
 * @file __tests__/lib/apiClient.test.ts
 * @overview FID-20260911-041 — the error-reason extractor's contract.
 *
 * Every game component routes server rejections through extractApiError.
 * These tests pin all body shapes the codebase emits so a future error-system
 * change can't silently regress surfaces to "[object Object]" or generic text.
 */

import { describe, it, expect } from 'vitest';
import { extractApiError } from '@/lib/apiClient';

describe('extractApiError — FID-20260911-041 contract', () => {
  it('reads structured error.message (lib/errors/responses.ts shape)', () => {
    const body = {
      success: false,
      error: { code: 'AUTH_UNAUTHORIZED', message: 'You must be logged in to access this' },
    };
    expect(extractApiError(body, 401)).toBe('You must be logged in to access this');
  });

  it('prefers Zod field errors from details.errors[].message', () => {
    const body = {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: { errors: [{ field: 'username', message: 'String must contain at least 1 character(s)' }] },
      },
    };
    expect(extractApiError(body, 400)).toBe('String must contain at least 1 character(s)');
  });

  it('reads legacy flat string error bodies', () => {
    expect(extractApiError({ success: false, error: 'Unauthorized - please log in' }, 401))
      .toBe('Unauthorized - please log in');
  });

  it('reads flat message on success:false soft failures', () => {
    expect(extractApiError({ success: false, message: 'You are already holding the flag' }, 200))
      .toBe('You are already holding the flag');
  });

  it('never stringifies an object error into [object Object]', () => {
    const out = extractApiError({ success: false, error: { code: 'RATE_LIMITED', message: 'Slow down' } }, 429);
    expect(out).not.toContain('[object Object]');
    expect(out).toBe('Slow down');
  });

  it('falls back to a status-based message for empty/HTML bodies', () => {
    expect(extractApiError(null, 502)).toBe('Request failed (502)');
    expect(extractApiError('<html>gateway</html>', 502)).toBe('<html>gateway</html>');
  });
});
