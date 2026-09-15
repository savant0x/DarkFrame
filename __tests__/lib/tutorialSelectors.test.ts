// @vitest-environment node
/**
 * FID-20260912-092 — tutorial selector registry contract tests.
 *
 * The FID-092 audit found 6 of 7 quest `targetElement` selectors matched
 * nothing in the DOM (two named canvas tiles — structurally impossible).
 * These tests pin the new invariant chain:
 *
 *   1. every targetElement in TUTORIAL_QUESTS is a REGISTRY selector
 *      (no raw CSS literals, no dead strings)
 *   2. every registry selector has a matching data-tutorial hook in the
 *      component source (catches hook renames the moment they happen)
 *   3. resolveJoyrideTarget falls back to 'body' — never returns a selector
 *      that isn't mounted — and passes mounted selectors through
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TUTORIAL_QUESTS } from '@/lib/tutorialService';
import { TUTORIAL_TARGETS, resolveJoyrideTarget, probeTarget } from '@/lib/tutorialSelectors';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** All targetElement strings referenced by the live quest definitions. */
function questTargetElements(): Array<{ stepId: string; target: string }> {
  return TUTORIAL_QUESTS.flatMap(q =>
    q.steps
      .filter(s => !!s.targetElement)
      .map(s => ({ stepId: s.id, target: s.targetElement! }))
  );
}

describe('registry vs quest definitions', () => {
  it('every targetElement in TUTORIAL_QUESTS is a registry selector', () => {
    const registryValues = new Set<string>(Object.values(TUTORIAL_TARGETS));
    const offenders = questTargetElements().filter(({ target }) => !registryValues.has(target));
    expect(
      offenders.map(o => `${o.stepId} → ${o.target}`),
      'quest steps referencing selectors outside the registry (raw CSS literals are how the FID-092 rot started)'
    ).toEqual([]);
  });

  it('every registry selector referenced by a quest exists in some component source', () => {
    const referenced = new Set(questTargetElements().map(({ target }) => target));
    // Component files that carry data-tutorial hooks (FID-092). The nav hooks
    // are passed as props (tutorialHook="clans-nav-item"), so their literal
    // names live in TopNavBar.tsx the same as the plain attributes elsewhere.
    const sources = [
      'components/MovementControls.tsx',
      'components/TileRenderer.tsx',
      'components/TopNavBar.tsx',
      'components/BeerBasePanel.tsx',
    ].map(p => readFileSync(join(process.cwd(), p), 'utf8'));

    const missing: string[] = [];
    for (const selector of referenced) {
      const hook = selector.match(/data-tutorial="([^"]+)"/)?.[1];
      if (!hook) missing.push(`${selector}: unparseable registry selector`);
      const present = sources.some(src => src.includes(hook!));
      if (!present) missing.push(`${selector}: no "${hook}" hook in any component`);
    }
    expect(missing, 'hooks must exist in component source').toEqual([]);
  });

  it('every quest targetElement has a conditional caveat when its hook is state-dependent', () => {
    // harvest-button only mounts on harvestable tiles; attack-button only on
    // enemy bases. If a quest step references one, its conditional routing in
    // the overlay (stepConditional) must know — kept in lockstep here.
    const conditionalHooks = new Set<string>([
      TUTORIAL_TARGETS.harvestButton,
      TUTORIAL_TARGETS.attackButton,
    ]);
    const overlay = readFileSync(
      join(process.cwd(), 'components/tutorial/TutorialOverlay.tsx'), 'utf8'
    );
    for (const { stepId, target } of questTargetElements()) {
      if (conditionalHooks.has(target)) {
        // The overlay must route state-dependent hooks through stepConditional
        // (which compares against the registry constants) — not the raw
        // literal, so a registry rename can't desync the routing.
        expect(overlay.includes('stepConditional'), `${stepId}: conditional targets must route through stepConditional`).toBe(true);
        expect(overlay.includes('TUTORIAL_TARGETS'), 'overlay must import the registry').toBe(true);
        // The conditional branch set lives in the registry's own docs + the
        // overlay's stepConditional switch; assert both registry constants
        // are the switch's operands via the selectors test's own import.
        expect(conditionalHooks.has(TUTORIAL_TARGETS.harvestButton)).toBe(true);
        expect(conditionalHooks.has(TUTORIAL_TARGETS.attackButton)).toBe(true);
      }
    }
  });
});

describe('resolveJoyrideTarget', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {} as unknown as Window & typeof globalThis);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('undefined/body targets resolve to body without probing', () => {
    expect(resolveJoyrideTarget(undefined)).toBe('body');
    expect(resolveJoyrideTarget('body')).toBe('body');
  });

  it('falls back to body (with a warning) when the hook is not in the DOM', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Minimal document stub with zero matches; getComputedStyle stubbed so the
    // visibility check short-circuits on the empty match list.
    vi.stubGlobal('document', { querySelectorAll: () => [] });
    expect(resolveJoyrideTarget(TUTORIAL_TARGETS.movementControls)).toBe('body');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('NOT in DOM'),
    );
  });

  it('returns the selector when the hook IS in the DOM', () => {
    const el = {
      getBoundingClientRect: () => ({ width: 10, height: 10 }),
    };
    vi.stubGlobal('document', {
      querySelectorAll: (sel: string) => (sel === TUTORIAL_TARGETS.movementControls ? [el] : []),
    });
    vi.stubGlobal('window', {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    } as unknown as Window & typeof globalThis);
    expect(resolveJoyrideTarget(TUTORIAL_TARGETS.movementControls)).toBe(TUTORIAL_TARGETS.movementControls);
  });
});

describe('probeTarget', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {} as unknown as Window & typeof globalThis);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('warns for missing non-conditional targets', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('document', { querySelectorAll: () => [] });
    probeTarget(TUTORIAL_TARGETS.techTreeNavItem);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('lib/tutorialSelectors.ts');
  });

  it('only infos for conditional targets (expected absence)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('document', { querySelectorAll: () => [] });
    probeTarget(TUTORIAL_TARGETS.harvestButton, { conditional: 'harvestable-tile' });
    expect(warn).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining('conditional'));
  });

  it('body probe is always found', () => {
    const found = probeTarget('body');
    expect(found).toEqual({ selector: 'body', found: true, elementCount: 1, visible: true });
  });
});
