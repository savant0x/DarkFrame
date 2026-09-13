/**
 * @file lib/tutorialSelectors.ts
 * @created 2026-09-13
 * @overview FID-20260912-092 — the verified selector registry for tutorial
 * target highlighting.
 *
 * FID-092 audit: 6 of the 7 `targetElement` strings in the quest definitions
 * matched NOTHING in the DOM — joyride silently fell back to a centered
 * spotlight on `body`, so steps like "Harvest the Cave" highlighted empty
 * space. Two selectors (`.cave-tile`, `.beer-base-tile`) were structurally
 * impossible: they name canvas-drawn tiles that can never be DOM elements.
 *
 * Rule now: a step's highlight target must come from THIS registry, whose
 * `data-tutorial` hooks are added to real components and whose `probe()`
 * verifies presence at step start — a missing target is logged loudly and
 * falls back to `body` with an explicit message instead of a silent no-op.
 *
 * Contract test: every `targetElement` referenced by TUTORIAL_QUESTS must be
 * a registry key, and every registry entry must map to a mounted hook when
 * the game page renders (the parts testable without a browser are pinned in
 * __tests__/lib/tutorialSelectors.test.ts).
 */

export interface TutorialTarget {
  /** The CSS selector joyride receives (a [data-tutorial=…] hook). */
  selector: string;
  /** What this highlights, for the diagnostic + logs. */
  description: string;
  /**
   * Structural caveat: `conditional` targets only exist in some game states
   * (e.g. the HARVEST button renders only on harvestable tiles). Joyride's
   * body fallback is EXPECTED for those when the condition doesn't hold —
   * the probe tolerates it instead of warning.
   */
  conditional?: 'harvestable-tile' | 'enemy-base-tile';
}

/**
 * The registry. Keys are semantic names; values are the selectors referenced
 * by quest definitions. Adding a step with a new target starts here.
 */
export const TUTORIAL_TARGETS = {
  /** MovementControls D-pad cluster (ControlsPanel HUD). */
  movementControls: '[data-tutorial="movement-controls"]',
  /** HARVEST button in TileRenderer — only mounted on harvestable tiles. */
  harvestButton: '[data-tutorial="harvest-button"]',
  /** ATTACK · METAL CTA in TileRenderer — only mounted on enemy base tiles. */
  attackButton: '[data-tutorial="attack-button"]',
  /** Clans NavItem in TopNavBar — only rendered for level ≥ 10. */
  clansNavItem: '[data-tutorial="clans-nav-item"]',
  /** Tech Tree NavItem in TopNavBar. */
  techTreeNavItem: '[data-tutorial="tech-tree-nav-item"]',
  /**
   * Beer Bases panel root (BeerBasePanel). The panel opens via Shift+E and
   * is null when closed — the tutorial's find/attack steps route players
   * onto the base tile itself, where the tile view is the real surface.
   */
  beerBasePanel: '[data-tutorial="beer-base-panel"]',
} as const satisfies Record<string, string>;

export type TutorialTargetKey = keyof typeof TUTORIAL_TARGETS;

/** Probe result for one selector at step start. */
export interface TargetProbe {
  selector: string;
  found: boolean;
  elementCount: number;
  visible: boolean;
}

function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Verify a selector against the live DOM. Client-only (uses window).
 * Every miss is reported to the console with the registry description so a
 * renamed hook shows up as a loud warning, not a silent centered spotlight.
 */
export function probeTarget(
  selector: string,
  opts: { conditional?: TutorialTarget['conditional'] } = {}
): TargetProbe {
  if (typeof window === 'undefined' || selector === 'body') {
    return { selector, found: selector === 'body', elementCount: selector === 'body' ? 1 : 0, visible: true };
  }

  const elements = Array.from(document.querySelectorAll(selector));
  const found = elements.length > 0;
  const visible = found && elements.some(isElementVisible);

  if (!found) {
    const known = Object.entries(TUTORIAL_TARGETS).find(([, sel]) => sel === selector);
    const description = known ? known[1] : 'unregistered selector';
    if (opts.conditional) {
      console.info(
        `[Tutorial] target ${selector} not mounted (conditional: ${opts.conditional}) — spotlight centers; the condition will appear as the player progresses.`
      );
    } else {
      console.warn(
        `[Tutorial] target ${selector} NOT in DOM (${description}). If this persists, the data-tutorial hook was renamed or removed — see lib/tutorialSelectors.ts. Falling back to centered spotlight.`
      );
    }
  }

  return { selector, found, elementCount: elements.length, visible };
}

/**
 * Resolve a step's joyride target: registry selector if present in the DOM,
 * else `body` (joyride's centered fallback) — never a dead selector string,
 * which joyride treats as an error state.
 */
export function resolveJoyrideTarget(
  targetElement: string | undefined,
  conditional?: TutorialTarget['conditional']
): string {
  if (!targetElement || targetElement === 'body') return 'body';
  const probe = probeTarget(targetElement, { conditional });
  return probe.found ? targetElement : 'body';
}
