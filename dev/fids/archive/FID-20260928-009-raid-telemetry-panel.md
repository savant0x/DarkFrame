# FID-20260928-009: Raid telemetry panel — the tuning loop visible without curl

**Filename:** `FID-20260928-009-raid-telemetry-panel.md`
**ID:** FID-20260928-009
**Severity:** LOW
**Status:** closed (2026-09-28, commit recorded below)
**Created:** 2026-09-28

---

## 1. Summary

FID-20260928-008 shipped the raid-telemetry *endpoint*; the operator directed the visible face: *"Add an admin panel card that renders the raid-telemetry endpoint — win rate, loot vs cap, floor bites, top refusal pairs — so the data is visible without curl."* `components/admin/RaidTelemetryPanel.tsx` does exactly that, self-fetching (modal pattern: one mount line in `AdminView`, zero AdminView state changes) in the admin Charts section: window selector (24h/7d/30d/90d), headline metrics (raids, win rate, avg defender losses = the §4.2 floor's observable bite, metal/energy looted = the §4.1 cap's real-world position, unique attackers), the top hostility-refusal pairs with counts and verbatim reasons, and unique defenders/draws. Loading, error (gate refusal, network, reader-failure `outcomes: null`), and empty states are all rendered rows — the dashboard cannot crash on telemetry.

## 2. Design decisions (evidence-probed, not assumed)

| Decision | Evidence |
| -------- | -------- |
| Self-fetching panel, not AdminView-managed | AdminView is 3,900 lines with analytics state wired through `loadAnalyticsData`; the modal pattern (BattleLogsModal et al.) keeps new code in one file — minimal blast radius |
| `nn-chip--cyan` for the selected window, not a nonexistent `--active` variant | `app/neon-noir.css:491-507` — chip variants are color-based; probed before styling |
| `extractApiError` reused for error formatting | lib/apiClient.ts:61 — the house structured-error extractor; the panel never renders `[object Object]` (FID-20260911-041 precedent) |
| CRLF for the new component/test | probed all four sibling components — CRLF house convention |
| Endpoint shape consumed as typed (no `any`); `tuningTargets` deliberately not rendered yet | response contract from FID-20260928-008; the mapping lives in §4.6 of the design doc — the card surfaces data, the doc carries interpretation |

## 3. Verification (executed 2026-09-28)

- Component pins: **7 green** (`components/admin/RaidTelemetryPanel.test.tsx`) — metrics from a real payload (63% win rate from 25/40, loot, 6.25 avg defender losses), refusal pairs with verbatim alliance reason, error row on 403 (`extractApiError` output), `outcomes: null` degrade (em-dashes + "No hostility refusals in window."), window switch re-fetch (`windowHours=720`), refresh button, empty-refusals state.
- Gates: `npx tsc --noEmit` → 0 · `npx eslint . --max-warnings 0` → 0/0 · full suite **147 files** green · ledger census exit 0.
- **Honest limitation:** the "floor bites" metric renders as `avgDefenderLosses` — a per-raid floor-hit flag would need a `battle_logs` column; the aggregate is the honest proxy until that column exists (recorded in FID-008's limitations).

## 4. Closure

- **Gates:** [x] typecheck 0 · [x] lint 0/0 · [x] suite 147 files · [x] census 0.
- **Commit hash (G2):** recorded in the ledger-closure commit citing this FID (code commit precedes it).
- **Archive:** filed directly at `closed` in `dev/fids/archive/` per the compact-FID precedent; session-summary follow-through; CHANGELOG/VERSION 0.0.55.

---

**Final status:** closed
