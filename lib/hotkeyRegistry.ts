/**
 * @file lib/hotkeyRegistry.ts
 * @created 2026-09-04
 * @overview Single source of truth for hotkey binding rules.
 *
 * INVARIANT (operator directive): every key has exactly ONE mapping. The
 * movement keys `qweasdzxc` are RESERVED for movement — they may never be
 * bound as a bare hotkey (Shift/Ctrl/Alt+letter combos are allowed because
 * MovementControls ignores modifier-held presses, so exactly one thing fires).
 */

/** Keys owned exclusively by the 8-direction movement compass (+ S = refresh). */
export const MOVEMENT_KEYS: ReadonlySet<string> = new Set([
  'q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c',
]);

/** True when a hotkey binding would steal a movement key (bare, no modifiers). */
export function isReservedMovementKey(key: string, requiresShift = false, requiresCtrl = false, requiresAlt = false): boolean {
  const bare = key.toLowerCase();
  if (!MOVEMENT_KEYS.has(bare)) return false;
  return !requiresShift && !requiresCtrl && !requiresAlt;
}

/** A bindable hotkey: the key plus which modifiers are required. */
export interface HotkeyBinding {
  key: string;
  requiresShift?: boolean;
  requiresCtrl?: boolean;
  requiresAlt?: boolean;
}

/** Normalized combo identity — two bindings collide iff their identities match. */
export function bindingId(b: HotkeyBinding): string {
  return `${b.requiresShift ? 'Shift+' : ''}${b.requiresCtrl ? 'Ctrl+' : ''}${b.requiresAlt ? 'Alt+' : ''}${b.key.toLowerCase()}`;
}

export interface BindingConflict {
  /** The duplicate combo, e.g. 'Shift+e'. */
  combo: string;
  /** Every action bound to it. */
  actions: string[];
}

/** Every rule violation in a hotkey set: reserved movement keys + duplicates. */
export function findHotkeyConflicts(hotkeys: Array<HotkeyBinding & { action?: string; displayName?: string }>): BindingConflict[] {
  const label = (h: { action?: string; displayName?: string }) => h.action ?? h.displayName ?? '?';

  const conflicts: BindingConflict[] = [];

  // Rule 1: movement keys are not bindable bare.
  const reserved = new Map<string, string[]>();
  for (const h of hotkeys) {
    if (isReservedMovementKey(h.key, h.requiresShift, h.requiresCtrl, h.requiresAlt)) {
      const combo = h.key.toLowerCase();
      reserved.set(combo, [...(reserved.get(combo) ?? []), label(h)]);
    }
  }
  for (const [combo, actions] of reserved) {
    conflicts.push({ combo: `${combo} (reserved for movement)`, actions });
  }

  // Rule 2: no duplicate combos.
  const byCombo = new Map<string, string[]>();
  for (const h of hotkeys) {
    const id = bindingId(h);
    byCombo.set(id, [...(byCombo.get(id) ?? []), label(h)]);
  }
  for (const [combo, actions] of byCombo) {
    if (actions.length > 1) conflicts.push({ combo, actions });
  }

  return conflicts;
}
