# FID-20260911-054 — Egress Verdict (Post-051) + Weekly Attribution Audit

**Date:** 2026-09-12 · **Follows:** FID-037…051 (egress program), FID-052 (branch
protection) · **Trigger:** dashboard check-in request + weekly-audit request.

## 1. Egress re-verification (what the code can prove)

The Supabase usage API needs an access token the CLI doesn't persist on this
machine (`supabase login` keeps it in-memory/keyring), so the dashboard GB
curve remains the one measurement only the human can take — **the dashboard
check is: Supabase → Project → Usage → Egress, daily granularity, compare
against `dev/EGRESS-WATCH.md` success criteria** (spike regime ~3 GB/day
should now sit near the 5 GB/week plan line; sustained >1 GB/day with zero
players = an escaped loop, check Scheduler Health + the tutorial poll first).

Everything the DB can prove was re-measured live on :3001:

| Check | Result |
|---|---|
| 60s `pg_stat_activity` live sample (all 6 residual fingerprints) | **0 executions** |
| Cumulative counters vs FID-051 snapshot (~2.5h) | +~230/h tutorial pairs during play windows only — the by-design, now-adaptive cadence (FID-053); flags/trail ~1–4/h; presence/tiles 0 |
| `/api/beer-bases/list` | 124 B |
| `/api/player/battle-history` | 582 B (incl. per-row deep-link ids) |
| `/api/auth/session` | 34 B |
| `/api/player` | not re-measurable with a synthetic token (400); FID-047's 21.5 KB once-per-load figure stands |

Verdict: no live leak, no regression since FID-051; idle DB traffic is at the
design floor. The FID-037–051 program is, as far as query-space evidence
goes, complete.

## 2. Weekly standing full-history audit

`attribution-guard.yml` now carries a `schedule` trigger — **Mondays 06:17
UTC** (off-the-hour minute: GitHub's cron queue is most congested on
hour/half-hour marks). The range-determination step was extended with a
catch-all `*)` branch mapping any non-push/PR event to the full-history
audit, so scheduled runs walk every branch head's ancestry and fail loudly
on any watermarked commit. If a Monday run ever goes red, the fix is a
history rewrite before the offending commit spreads.

## Gates + landing

Landed via PR through the FID-052 branch-protection gate; post-merge
workflow_dispatch run re-executed to prove the modified YAML parses and
completes (`scan` success). tsc 0 · eslint 0 · vitest 509 · build exit 0.
