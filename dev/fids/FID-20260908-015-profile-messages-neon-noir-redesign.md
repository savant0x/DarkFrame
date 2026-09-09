# FID-20260908-015: Profile + messages family — full neon noir structural redesign

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID. No attribution fields.
-->

**Filename:** `FID-20260908-015-profile-messages-neon-noir-redesign.md`
**ID:** FID-20260908-015
**Severity:** MEDIUM (display-debt; census wave-B surfaces, scope corrected on RED)
**Status:** converged
**Created:** 2026-09-08

---

## 1. Summary

The Phase 6 census listed profile (55) + messages (51) = **106**. The RED re-census falsifies both
the count and the scope: the banned-class pattern plus gradient stops, raw-blue focus rings,
`rounded-full` pills, and un-gated spin/pulse animations total **~184 instances across 5 files** —
the census missed `components/messaging/MessageInbox.tsx` (24) and `MessageThread.tsx` (15)
entirely, and under-counted gradient *stops* (`from-bg-space/via-bg-nebula/to-bg-space`,
`amber→amber` no-ops). Per operator mandate: **hand migration, file by file, verified per file.**

## 2. Evidence (RED)

### 2.1 Corrected census (pre-migration)

| File | Lines | Core banned | Gradients | Un-gated anim | Strays |
| ---- | ----- | ----------- | --------- | -------------- | ------ |
| app/profile/ProfileView.tsx | 410 | ~57 | 4 (incl. `amber→amber` no-op) | 0 | — |
| app/profile/[username]/page.tsx | 228 | ~21 | 0 | 0 | — |
| app/messages/page.tsx | 588 | ~28 | 2 shells (`from-bg-space via-bg-nebula to-bg-space`) | 1 `animate-spin` + 2 `animate-pulse` | `rounded-full` pills, non-token Retry contrast |
| components/messaging/MessageInbox.tsx | 397 | ~30 | 0 | 1 `animate-spin` | `border-l-blue-500`, `focus:border-blue-500`, `rounded-full` chips |
| components/messaging/MessageThread.tsx | 512 | ~25 | 0 | 2 `animate-spin` | `focus:border-blue-500`, `bg-glass-darker` (undefined token) |
| **Total** | 2,135 | **~161** | **6** | **6** | blue strays ×3 files |

Kit imports: ProfileView only (`RichTextEditor` — audited retention, stays). framer-motion: 0.

### 2.2 Substantive defect found (fixed en route)

ProfileView's **Base Defenses card renders `baseDefenses.won` for both "won (defended)" and
"lost (breached)"** — the interface exposes `lost` (`{ total; won; lost }`) but the JSX reads
`won` twice, so breaches always displayed as the won count. Corrected to `lost` (substantive,
recorded in §7; everything else is chrome-only).

### 2.3 MessageThread's `bg-glass-darker` references a token that does not exist in
`neon-noir.css` (`--nn-glass-light/dark/border` only) — the emoji picker background silently
falls back to transparent. Fixed to `nn-surface--dark`.

## 3. Impact Analysis

- **Affected:** 5 files restyled; all fetch/WS/socket/pagination/greeting-save logic
  byte-preserved. One corrected stat read (`baseDefenses.lost`).
- **Blast radius:** none server-side. `neon-noir.css` gains one gated utility (`.nn-pulse`) for the
  connection indicator — reduced-motion respected, matching the `.nn-spin-icon` gate pattern.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| ALL cases? | Yes — post-migration census of the 5 files must be 0 banned / 0 gradients / 0 un-gated anim / 0 raw-blue |
| Scales? | Yes — same primitives as prior families; one new gated utility, no new components |
| Hostile attacker? | N/A (display); SafeHtmlRenderer boundaries untouched; no new HTML injection surface |
| Maintainable? | Yes — single token system; messaging joins the ChatPanel `nn-msg` idiom |
| Industry standard? | Yes — same rubric as FID-006 program |

## 5. Proposed Fix (GREEN)

Hand-migrate file by file (tsc + census after each):

1. **ProfileView** (game-tab panel) — outer glass slab → `nn-surface` shell + `nn-panel__header`
   strip; Commander Info → `nn-stat` quartet (domain glows); Referral gradient slab →
   `nn-panel--violet` with `nn-well` stat cells + `nn-chip--violet/amber` pills + `nn-btn` links;
   Resources → `nn-well` + `nn-num`; greeting editor → `nn-panel`, preview → `nn-well`,
   Edit/Save/Cancel → `nn-btn` variants; error/success → `nn-note` (FID-011 idiom); battle stats →
   `nn-well` grid **with the `lost` fix**.
2. **[username] public profile** — `bg-glass-dark` page → `var(--nn-void)` shell; header →
   `nn-panel`; VIP pill → `nn-chip--amber`; bot banner → `nn-brief--amber`; stat grid →
   `nn-stat` ×4; sections → `nn-panel` scanline headers; combat JSON → `nn-well`; back buttons →
   `nn-btn`.
3. **messages/page** — both gradient shells → `var(--nn-void)`; sticky header → `nn-surface`
   strip; unread counter → `nn-chip--magenta`; connection dot stays a token dot but
   `animate-pulse` → gated `.nn-pulse`; Reconnect → `nn-link`; Retry Now → `nn-btn--danger`
   (replacing the non-token white-bg/magenta-text button); main split container → `nn-surface`;
   empty-thread state → token text.
4. **MessageInbox** — `nn-surface--dark` pane; search → `nn-input` (kills `focus:border-blue-500`);
   filter pills → `nn-tabchip`/`nn-tabchip--on`; loading → `Loader2` + gated `nn-spin-icon`;
   selected row `border-l-blue-500` → cyan token left rule; unread badge → `nn-chip--cyan`;
   retry → `nn-btn`.
5. **MessageThread** — `nn-surface--dark` pane + `nn-surface` header/input strips; bubbles →
   `nn-msg`/`nn-msg--own` (ChatPanel idiom); `Loader` + `animate-spin` → `Loader2` +
   `nn-spin-icon`; emoji picker `bg-glass-darker` → `nn-surface--dark`; textarea focus
   `border-blue-500` → cyan token focus; status icons + char count → token text classes.
6. **neon-noir.css** — add gated `.nn-pulse` (opacity keyframe + reduced-motion off), documented.
7. **Gates:** tsc 0 · eslint 0 · full vitest · census greps 0.

**Verification plan:** per-file tsc/census between migrations; handler census HEAD↔working at the
end; Method-2 re-read of all five files.

## 6. Audit Record

| Method | What was checked | Evidence | Result |
| ------ | ---------------- | -------- | ------ |
| Method 1: static analysis | tsc / eslint / vitest / rubric greps | *(pasted at implementation)* | pass |
| Method 2: manual re-read | logic diff = 0; `lost` fix verified against BattleStatistics type; glass-darker token check | *(pasted at implementation)* | pass |

- Audit outcome: PASS → `converged`.

## 7. Implementation Record

- **Status:** complete
- **Changes applied:**
  - **app/profile/ProfileView.tsx** — glass slab shell → `nn-surface` + `nn-panel__header` strip;
    Commander Info → `nn-stat` quartet (amber/green/violet glows); Referral gradient slab →
    `nn-panel--violet` with `nn-well` stat cells, `nn-chip--violet/amber` pills, `nn-btn` links;
    Resources → `nn-well` + glow numerals; greeting editor → `nn-panel` with `nn-well` preview and
    Edit/Save(`nn-btn--primary`)/Cancel(`nn-btn--ghost`); error/success → `nn-note`; battle stats →
    `nn-well` grid. **Substantive fix:** Base Defenses "breached" now reads `baseDefenses.lost`
    (was `.won` — both rows identical, interface has `lost`). Loading spinner → `Loader2` +
    `nn-spin-icon`. RichTextEditor retention unchanged.
  - **app/profile/[username]/page.tsx** — `bg-glass-dark` page → `var(--nn-void)` shell; header →
    `nn-panel` with `nn-num` identity row; VIP pill → `nn-chip--amber`; bot banner → `nn-brief--amber`;
    404 state → `nn-panel--magenta`; stat grid → `nn-stat` ×4 via glow-parameterized local `StatCard`;
    sections → `nn-panel` scanline headers with meta tags; combat JSON → `nn-well`; back buttons →
    `nn-btn`/`nn-btn--ghost`; loading → `Loader2` + gated spin.
  - **app/messages/page.tsx** — both gradient shells → `var(--nn-void)`; sticky header → `nn-surface`
    strip; unread counter → `nn-chip--magenta`; connection dot: rounded-full+22%-mix pills → square
    full-token dots, `animate-pulse` → gated `.nn-pulse` (new utility); Reconnect → `nn-link`;
    fixed Connection-Lost banner → `nn-brief--magenta`, Retry Now → `nn-btn--danger` (replaces the
    non-token white-bg/magenta-text button); split container → `nn-surface`; empty-thread state →
    token text; loading → `Loader2` + gated spin. Logic region untouched except: the two
    `payload as any` casts replaced by a `toConversation()` narrowing adapter (the real type delta:
    wire `participants: string[]` vs client `[string, string]` tuple — length-2 arrays satisfy the
    tuple, longer arrays now fail loudly instead of silently corrupting inbox state).
  - **components/messaging/MessageInbox.tsx** — pane → `nn-surface--dark`; search → `nn-input`
    (kills `focus:border-blue-500`); filter pills → `nn-tabchip`/`nn-tabchip--on`; loading →
    `Loader2` + gated spin; selected row `border-l-blue-500` → token cyan inset box-shadow rule;
    unread badge → `nn-chip--cyan`; retry → `nn-btn`; timestamps/preview → `nn-footnote`;
    avatar → token block with `nn-num` initial.
  - **components/messaging/MessageThread.tsx** — pane → `nn-surface--dark`, header/input strips →
    `nn-surface`; bubbles → `nn-msg`/`nn-msg--own` (ChatPanel idiom); `Loader`+`animate-spin` →
    `Loader2`+`nn-spin-icon` (×2); **`bg-glass-darker` (undefined token, silent transparent bg) →
    `nn-surface--dark`** on the emoji picker; textarea focus `border-blue-500` → cyan token focus;
    Load-older → `nn-link`; send → `nn-btn--primary`; char counter → `nn-num` tokens; status icons →
    token text classes.
  - **app/neon-noir.css** — added gated `.nn-pulse` (opacity keyframe, `prefers-reduced-motion`
    off) for the connecting-state indicator; documented like `.nn-spin-icon`.
  - **Logic preservation:** handler census identical HEAD↔working on all five files (2/2, 3/3,
    13/13, 8/8, 14/14). Only behavior deltas: the `lost` fix (§2.2) and the tuple-narrowing adapter
    (fail-loud on malformed payloads).
- **Gates:** tsc 0 · eslint 0 (family, incl. 2 pre-existing `any`s remediated) · full vitest
  **362 passed / 0 failed / 1 skipped** · rubric census: 0 banned classes, 0 gradients, 0 un-gated
  animations, 0 raw-blue strays across all 5 files.
- **Audit Method 2:** per-file diff re-read + per-file census between migrations; handler census
  HEAD↔working; `lost` verified against `BattleStatistics` contract; `--nn-glass-darker` confirmed
  undefined pre-fix; `MessagingConversationPayload` vs `Conversation` type delta read from both
  type files before writing the adapter.

## 8. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0 · [x] tests pass · [x] rubric census 0
- **Commit hash (G2):** pending — agent prepares, operator commits
- **Staging plan:** `git add app/profile/ProfileView.tsx "app/profile/[username]/page.tsx" app/messages/page.tsx components/messaging/MessageInbox.tsx components/messaging/MessageThread.tsx app/neon-noir.css dev/fids/FID-20260908-015-profile-messages-neon-noir-redesign.md dev/fids/FID-20260908-006-neon-noir-full-internal-redesign.md dev/session-summaries/SESSION-2026-09-08-002.md`
- **Follow-through (proposed, not executed):** raw-blue strays also exist in leaderboard family
  (`app/leaderboard`, `components/LeaderboardPanel/View`) — next wave candidate with the remaining
  small pages.
