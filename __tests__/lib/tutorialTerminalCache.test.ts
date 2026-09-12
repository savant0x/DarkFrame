/**
 * @file __tests__/lib/tutorialTerminalCache.test.ts
 * @overview FID-20260911-051 — terminal-state gate contract.
 *
 * Pins the correctness contract that makes stale-tab polls free without
 * ever pinning a wrong answer: only terminal states are cached, entries
 * expire (self-healing), and restart invalidates immediately.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Fresh module instance per test (module-scoped Map).
beforeEach(() => {
  vi.resetModules();
});

async function loadCache() {
  return import('@/lib/tutorialTerminalCache');
}

describe('tutorialTerminalCache', () => {
  it('reports uncached players as non-terminal', async () => {
    const c = await loadCache();
    expect(c.isTutorialTerminalCached('nova')).toBe(false);
  });

  it('pins terminal state only after markTutorialTerminal', async () => {
    const c = await loadCache();
    c.markTutorialTerminal('nova');
    expect(c.isTutorialTerminalCached('nova')).toBe(true);
    expect(c.tutorialTerminalCacheSize()).toBe(1);
  });

  it('invalidateTutorialTerminal immediately un-pins (restart path)', async () => {
    const c = await loadCache();
    c.markTutorialTerminal('nova');
    c.invalidateTutorialTerminal('nova');
    expect(c.isTutorialTerminalCached('nova')).toBe(false);
  });

  it('entries expire after the TTL window (self-healing re-check)', async () => {
    vi.useFakeTimers();
    const c = await loadCache();
    c.markTutorialTerminal('nova');
    expect(c.isTutorialTerminalCached('nova')).toBe(true);
    vi.advanceTimersByTime(10 * 60 * 1000 + 1); // TTL + 1ms
    expect(c.isTutorialTerminalCached('nova')).toBe(false);
    vi.useRealTimers();
  });

  it('tracks independent players separately', async () => {
    const c = await loadCache();
    c.markTutorialTerminal('nova');
    c.markTutorialTerminal('fame');
    c.invalidateTutorialTerminal('fame'); // fame restarted
    expect(c.isTutorialTerminalCached('nova')).toBe(true);
    expect(c.isTutorialTerminalCached('fame')).toBe(false);
  });
});
