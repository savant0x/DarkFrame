# FID-20260911-050 — CI Attribution Guard, Retired-Repo Deletion, Raids Deep-Link, Egress Verdict

**Date:** 2026-09-11 · **Follows:** FID-20260911-049 (repo remake) · **Trigger:** queued
follow-ups from the remake + the 48h egress measurement checkpoint.

## 1. CI attribution guard (defense beyond the local clone)

`.github/workflows/attribution-guard.yml` mirrors the `.githooks/pre-push`
contract (same fail-closed regex: co-authored-by trailers naming
commandcodebot/commandcode.ai/codebuff, and "Generated with/by Codebuff"
lines). Modes:

- **push** — scans exactly the commits the push introduced
  (`github.event.before..after`; new-branch fallback = merge-base against
  `origin/main`).
- **pull_request** — scans `base..head` before merge.
- **workflow_dispatch** — full-history audit of every `refs/remotes/origin`
  branch head (standing sweep).

Rationale: local hooks protect this clone only; CI protects every clone, and
blocks `--no-verify` end-runs at the remote gate. `fetch-depth: 0` supplies
the ranges.

## 2. Retired repo permanently deleted

`gh auth refresh` added the `delete_repo` scope (user authorized via device
flow, code 4452-024E). `savant0x/DarkFrame-retired-20260911` — the old repo
carrying the 58 Codebuff trailers — was deleted permanently. The only
remaining copy of that history is the local `backup-main-pre-rewrite` branch
(intentionally never pushed).

## 3. Recent Raids deep-link into battle report cards

The HUD feed and the inbox are now one loop:

- `GET /api/player/battle-history` now ships `messageId` + `conversationId`
  alongside each summary (still ~50 B/row — egress rule holds).
- `BattleHistoryFeed` rows render as buttons routing to
  `/messages?conv=<id>&open=<messageId>`.
- `MessagesPage` (wrapped in Suspense for `useSearchParams`) consumes the
  params once, preselects the SYSTEM thread via the existing selection
  handler, and clears them with `router.replace` so refreshes don't re-fire.
- `MessageThread` accepts `focusMessageId` / `onFocusConsumed`: scrolls the
  report row into view and pulses a cyan focus ring for 3.2s
  (`.nn-msg--focused` + `nn-report-focus` keyframes). Rows carry
  `id="nn-msg-<id>"` anchors. If the report is older than the loaded window,
  the thread still opens on the right conversation without a false highlight.

Live-verified against :3001: both summaries now carry real row ids
(`a66c14de…` VICTORY, `a4cd5234…` DEFEAT, shared SYSTEM↔fame conversation
`a0ce2ec3…`).

## 4. Egress verdict (48h checkpoint, measured not guessed)

Compared live `pg_stat_statements` cumulative counts against the Sep-10 CSV
baseline (`scripts` probe run ad hoc; reset date Sep 3):

| Furnace (Sep-10 baseline calls) | Live | Verdict |
|---|---|---|
| players full-row 39KB read (187,781) | **0** — fingerprint extinct | ✅ dead |
| tutorial_action_tracking (130,410) | +6,865 (~286/h) | residual — pre-fix JS tab or poll-stop regression; monitor |
| tutorial_progress (128,121) | +13,586 (~566/h) | residual — same |
| flags (125,982) | +9,987 (~416/h) | residual |
| flag_trail (66,400) | +6,028 (~251/h) | residual |
| user_presence / tiles | +2,208 / +4,149 | low |

The single biggest furnace (93% of projected row bytes) executed **zero
times** since the fixes. Remaining residuals are 3–5× below baseline rates;
the authoritative GB verdict still needs a dashboard reading (management-API
usage endpoint unavailable to the CLI token), but the query-side program is
confirmably effective.

## Gates

tsc 0 · eslint 0 · vitest 499 passed / 1 skipped · build exit 0 (after
Suspense boundary fix on /messages) · battle-history live-verified on :3001.
