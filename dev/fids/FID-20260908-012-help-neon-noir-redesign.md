# FID-20260908-012: Help page — worst single-file debt holder (97 banned-class instances) + stale keyboard reference

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-012-help-neon-noir-redesign.md`
**ID:** FID-20260908-012
**Severity:** MEDIUM (player-facing documentation with FACTUALLY WRONG control bindings — misleading regardless of styling; plus 97 banned-class instances per the Phase 6 census)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

`app/help/page.tsx` (428 lines, single static file) is the Phase 6 census's worst debt holder: 97 banned-class instances (`bg-glass-light` ×31, `text-text-secondary` ×34, `text-text-primary` ×18, `bg-glass-dark` ×14), a decorative gradient page shell, gradient slab and `bg-glass-dark` border-l tips. RED re-reading surfaced a second, more serious defect the census could not see: **the keyboard reference table is stale against the actual bindings** — it documents keys that no longer exist, omits the Shift-displacement rule, and in three rows teaches wrong movement directions. Players following the help page press keys that do nothing or do something else.

## 2. Evidence (RED)

### 2.1 Styling census (97)

| Pattern | Count | Notes |
| ------- | ----- | ----- |
| `text-text-secondary` | 34 | legacy text utility |
| `bg-glass-light` | 31 | section cards + every `<kbd>` |
| `text-text-primary` | 18 | legacy text utility |
| `bg-glass-dark` | 14 | tip blocks + terrain grid |
| gradient page shell (`from-bg-space to-black`) | 1 | anti-rubric gradient |
| gradient slab (violet→magenta, Auto-Farm section) | 1 | decorative |

No kit imports, no framer/transitions, no un-gated animations.

### 2.2 Stale keyboard reference (verified against `app/game/page.tsx` + `types/hotkey.types.ts` `DEFAULT_HOTKEYS` + `components/MovementControls.tsx`)

| Help page claims | Actual (code) | Evidence |
| --------------- | ------------- | -------- |
| Move North: **Q** | Q = **Northwest**; North = W | MovementControls titles |
| Move West: **A** | correct | ✓ |
| Move South: **Z** | Z = **Southwest**; South = X | MovementControls titles |
| Move East: **C** | C = **Southeast**; East = D | MovementControls titles |
| NE/NW/SE/SW: "W E D X" | garbled — actual: Q/W/E (top row), Z/X/C (bottom row) | MovementControls |
| Return to Base: **Shift+H** | no such binding exists | grep: 0 hits |
| Discovery Log: **V** | **Shift+D** (DiscoveryLogPanel) — V = Achievements | DiscoveryLogPanel.tsx |
| Achievements: **H** | **V** ("achieVements") — H = Auction House | app/game/page.tsx:419 |
| Specialization: **N** | **Shift+P** (N = Shrine, "shriNe") | SpecializationPanel.tsx |
| Open Bank: B | correct (Bank-tile-gated) | ✓ |
| Visit Shrine: **S** | **N** (S is movement South) | ✓ registry |
| Attack Factory: R | correct | ✓ |
| Auto-Farm Start/Pause/Resume: **R** | **Shift+F** (R = Attack Factory) | registry + page.tsx:445 |
| Auto-Farm Stats: Shift+S | correct | ✓ |
| Auto-Farm Stop: Shift+R | registered enum exists; not wired in page keydown (document as registered) | types/hotkey.types.ts:37 |
| Panels missing entirely | Shift+E Beer Bases, Shift+X Bot Scanner, J Bot Magnet, Y Bot Summoning, O Bounty Board, L Clan Leaderboards, P Player Leaderboard, Shift+C Clan View | DEFAULT_HOTKEYS |

Root cause of staleness: the help page was never updated when the single-mapping hotkey reform (movement-reserved `qweasdzxc`, displaced actions to Shift+letter) landed; `lib/hotkeyRegistry.ts` and `DEFAULT_HOTKEYS` are the sources of truth.

## 3. Impact Analysis

- **Affected:** every new/confused player consulting the guide; the movement table is the first section a player reads.
- **Blast radius:** 1 file (static, no data, no fetch). Content corrections are presentation-independent.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — 97/97 banned instances; every stale row replaced with the registry-verified binding |
| Scales? | Yes — static doc; corrections sourced from `DEFAULT_HOTKEYS` (the same data `HotkeyManagerPanel` exposes) |
| Hostile attacker? | N/A (static content); no user input, no fetch |
| Maintainable? | Yes — one page, documented binding provenance in file header |
| Industry standard? | Yes — FID-006 rubric |

## 5. Proposed Fix (GREEN)

1. Page shell → flat `var(--nn-void)` token background (sibling-page pattern, stats page); `BackButton` retained; title → `nn-num nn-text-cyan` display heading; emoji dropped from section headings (emoji slabs are banned chrome), **except terrain glyphs** (⚙️⚡🕳️🌲🏭🏜️🏦⛩️) which match TileRenderer's in-world tile icons exactly and stay as game imagery.
2. Section cards → `.nn-panel` with `.nn-panel__header` scanline strips and domain accents (Quick Start/controls = cyan, Auto-Farm = violet, Mechanics = green, Tips = amber, Terrain = cyan, FAQ = amber).
3. Every `<kbd>` → `.nn-kbd` primitive (new: square token keycap — void fill, glass border, `--nn-font-display`).
4. Key tables → `.nn-table` ledger rows (action label left, key right); lists → compact token lists; tips → `.nn-well` with semantic accent borders (replacing `bg-glass-dark` border-l blocks).
5. **Content corrections:** full rewrite of the keyboard reference to the verified bindings — corrected compass (Q/W/E · A/D · Z/X/C), Shift-displacement rule stated once, full panel/view list from `DEFAULT_HOTKEYS`, Auto-Farm Shift+F/Shift+S (Shift+R marked registered-not-wired), Specialization = Shift+P, Discovery Log = Shift+D, Achievements = V, Auction House = H, Shrine = N. Provenance comment in file header pointing at the three source files.
6. All static content otherwise preserved (mechanics, tips, FAQ text byte-preserved except binding references).

**Verification plan:** tsc 0; eslint 0 (file); vitest full (page has no tests — suite must stay green); rubric greps 0 banned instances; Method 2 re-read = binding rows diffed against `DEFAULT_HOTKEYS` + page.tsx handlers.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint / vitest / rubric greps | *(pasted at implementation)* | pass |
| Method 2: manual re-read | keyboard rows diffed against DEFAULT_HOTKEYS, page.tsx handlers, MovementControls, panel-local handlers | *(pasted at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied:**
  - Page shell: gradient void → flat `var(--nn-void)` token background; content column on one centered `max-w-5xl` axis; `nn-num` display heading (emoji slab removed).
  - Seven section cards → `nn-panel` + scanline headers with domain accents; Auto-Farm gradient slab removed (violet accent carries the domain).
  - All 26 `<kbd>` keycaps → new `.nn-kbd` token primitive (added to `app/neon-noir.css`, reduced-motion n/a — static).
  - Key tables → `nn-table` ledger rows; prose lists tokenized; tip blocks → `nn-well` with semantic accent borders; terrain grid → `nn-well` cells (in-world glyphs retained).
  - **Keyboard reference fully corrected** (§2.2 rows): compass fixed to Q/W/E · A/D · Z/X/C with the NW/N/NE, W/E, SW/S/SE layout; Shift+displacement rule documented; full panel/view binding list from `DEFAULT_HOTKEYS`; Auto-Farm = Shift+F (start/pause/resume) + Shift+S (stats), Shift+R marked registered-not-wired; Discovery Log = Shift+D; Achievements = V; Auction House = H; Shrine = N; Specialization = Shift+P. Removed the phantom Shift+H "Return to Base" row. Provenance comment added to the file header.
  - 97/97 banned-class instances eliminated; 2 decorative gradients removed.
- **Gates:** tsc 0 · eslint 0 (file) · full vitest **362 passed / 0 failed / 1 skipped** · rubric greps: 0 `bg-glass-*`, 0 `text-text-*`, 0 `bg-bg-*`, 0 anti-rubric gradients.
- **Audit Method 2:** every binding row re-diffed against `types/hotkey.types.ts` `DEFAULT_HOTKEYS`, `app/game/page.tsx` keydown handlers, `components/MovementControls.tsx` titles, and panel-local Shift+D/Shift+P handlers — 0 mismatches. Movement table vs MovementControls: 8/8 directions match. Content text otherwise byte-preserved.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] rubric greps
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/help/page.tsx app/neon-noir.css dev/fids/FID-20260908-012-help-neon-noir-redesign.md dev/session-summaries/SESSION-2026-09-08-002.md`
