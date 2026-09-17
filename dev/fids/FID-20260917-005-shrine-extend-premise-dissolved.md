# FID-20260917-005 — Shrine-extend survey item: premise dissolved (finding record, no wiring FID)

**Status:** `analyzed (premise dissolved)` — finding record, zero code delta
**Session:** 2026-09-17 (040)
**Origin:** Operator directive: "file and run the loop for the shrine-extend FID — the
remaining real P2 gap from the survey." Grounding dissolved the premise before any
spec was written.

## 1. Finding

The 2026-09-16 feature survey (session 030) recommended wiring `POST /api/shrine/extend`
as "a real small gap." That recommendation was overtaken by events: FID-20260917-002
(filed and looped by session 036, operator-ratified Option B) had already re-grounded
the same survey line and found the live `ShrinePanel` **already extends** boosts
through `POST /api/shrine/activate` ("Replace / Extend" → remaining time + new
duration, same 8h cap). The operator's ratified resolution was **deletion**:
`/extend` (the dead second economy and sole writer of `shrineTradeCount`/shrine XP)
and `/sacrifice` were removed from the tree. Filing a wire-the-route FID now would
resurrect ratified-dead code.

## 2. Evidence (probed this session, file:line / commit hashes)

- `dev/fids/archive/FID-20260917-002-shrine-dead-economy-cleanup-and-parity.md` §1:
  "Grounding dissolved that premise: the live ShrinePanel already extends boosts
  through POST /api/shrine/activate ('Replace / Extend' → remaining time + new
  duration, 8h cap)."
- `find app/api/shrine -name route.ts` → exactly `activate` + `boost-all`.
- `git log --diff-filter=D -- 'app/api/shrine/extend/*'` → `b11c370`
  ("delete dead sacrifice/extend economy, wire trade parity + presence enforcement").
- `components/ShrinePanel.tsx`: `estimateDuration` / `formatDuration` /
  `MAX_BUFF_DURATION_HOURS` / preset durations — the extend affordance is live.
- `app/api/shrine/activate/route.ts`: `calculateDuration(itemsToConsume)`, 8h cap,
  NaN guard — the live duration-purchase path.
- `git log --oneline -1 7f95217` → "record live E2E pass (20/20)" — post-cleanup
  shrine flow verified end-to-end.
- SCOPE row #75 (shrine status orphan) already Closed at `16a7fcb`.

## 3. Disposition

`analyzed (premise dissolved)` — **no code change, no implementation, no loop.**
The survey's shrine line closes as: gap resolved by deleting the candidate, not
wiring it. Errata appended to `dev/audits/FEATURE-SURVEY-2026-09-16.md` and
`dev/session-summaries/SESSION-2026-09-16-030.md`.

## 4. Probe log

See §2 — six probes, all green, all reproduced this session (040). No code was
modified; no build state was disturbed.

## 5. Notes

- Adjacent output of the same directive: the tutorial `/complete` writer census was
  completed (survey's pending one-probe census): `completeStep`'s only callers are
  `app/api/tutorial/complete/route.ts:42` (the orphan) and
  `lib/tutorialService.ts:892/980` (track-action/decline live paths) — third path to
  an already-served capability; evidence-complete deletion candidate for a future FID.
- Recorded in SCOPE row #78 (`Closed` — no-action finding).

## 6. Loop record

**Not warranted.** A perfection loop converges a design for implementation; this
record documents that no design is needed because the requested feature already
exists under a different route and the candidate route is operator-deleted. There is
no design to converge and nothing to implement; §3 disposition is terminal.
