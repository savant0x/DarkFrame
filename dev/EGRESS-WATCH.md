# Egress Watch — FID-037 Post-Fix Measurement Plan

**Created:** 2026-09-11 · **Deadline context:** Supabase Fair Use grace ended Sep 13.
**How to read the dashboard:** Supabase → Project → Usage → Egress (Bandwidth), daily
granularity. Compare the 7 days BEFORE the FID-037 deploy against the 7 days after.

## What was fixed (the three furnaces from the Query Performance CSV)

| Fingerprint (CSV calls/week) | Before | After | Expected effect |
|---|---|---|---|
| players full-row auth select (187,781 calls × 90 cols) | ~6 KB/row | 6-col slim select (~0.4 KB) | ~93% smaller on the single biggest fingerprint |
| tutorial 3s forever-poll (130K + 128K calls, never stopped) | ran while idle, forever | poll stops on tutorial_complete | the ONLY query family that ran with nobody playing — unbounded savings |
| flag reads (125,982 flags + holder full-rows + trail selects) | 2–3 round trips per tile view | cached batched flag state (FID-037 seam) | ~60–70% fewer round trips on the flag cluster |

Secondary: `player_activity` INSERTs capped, `flag_trail` got a point index
(migration 0021), chat channel reads filtered, `pg_timezone_names` 40K-row
enumeration confirmed NOT from app code (client-side date polyfill — no server fix needed).

## Success criteria (check ~48h and ~7d after deploy)

- Daily egress drops from the ~3 GB/day spike regime to near the 5 GB/week plan line.
- Query Performance CSV re-export: the 187K full-row fingerprint should show far fewer
  calls AND much lower rows_read per call; the two tutorial fingerprints should flatline
  when nobody is mid-tutorial.

## If burn resumes — the re-audit recipe (one command, no guessing)

1. Re-export "Query Performance Statements" CSV from the Supabase logs page.
2. Rank by `calls × rows_read` (the egress proxy): the top fingerprint IS the new furnace.
3. Map the query text to its route (grep the unique table/column list in `app/api/`),
   fix at the source (slim select, cache, or stop the poll), re-run the CSV.

Known floor: the game cannot go below ~60–80 MB/week idle (session checks + schedulers).
Sustained burn above ~1 GB/day with no players online means a poll/loop escaped its stop
condition — check Scheduler Health (admin panel) and the tutorial poll first.

## Standing fixes already in place (do not regress)

- `lib/authMiddleware.ts` — slim session select (6 fields only).
- `components/tutorial/TutorialQuestPanel.tsx` — polling stops on tutorial completion.
- `lib/flagState.ts` — single cached batched read per tile view (no double getFlagState).
- Attribution guard note: commits stay clean; hooks active via `prepare` script.

## Reading Log (post-FID-037 fixes)

| Date | Egress used in period | Daily rate | Verdict |
|---|---|---|---|
| _(fill in from Supabase → Usage → Egress; one row per check-in)_ | | | |

How to fill a row: read "Used in period" GB and the period start date, compute
GB/day, and compare against the success criteria above (~plan line, no >1 GB/day
burn with zero players). Include the timestamp of your play sessions that day
so idle burn is distinguishable from gameplay burn.
