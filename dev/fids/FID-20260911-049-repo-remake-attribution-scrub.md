# FID-20260911-049 — Repository Remake: Attribution-Scrubbed GitHub Rebirth

**Date:** 2026-09-11 · **Trigger:** `codebuff-team` appears as a permanent
contributor on `savant0x/DarkFrame` (GitHub computes contributors from commit
authorship across default-branch history; contributors cannot be removed
without abandoning that history).

## Root cause

The pre-guard history (pushed before FID-20260909-036) carried 58
`Co-Authored-By: Codebuff` trailers → GitHub's contributor graph listed
`codebuff-team` alongside the owner. Remaking the repo was the only clean fix.

## What was done

1. **Local history verified clean across every ref**: all 157 commits authored
   AND committed by `savant0x` only; zero co-author trailers. The single
   remaining *mention* of the word in one guard commit's message was reworded
   (`filter-branch --msg-filter`) so the new repo is 100% trace-free; tree
   content byte-identical, then re-verified (0 mentions / 0 trailers / 1
   identity).
2. **Guard made self-arming**: `core.hooksPath` is per-clone and does not
   travel with the repo — every fresh clone previously had `.githooks/` on
   disk but *unarmed*. New `scripts/ensure-hooks.js` (npm `postinstall`)
   arms it idempotently; proven live by unsetting, reinstalling, and
   observing re-arm.
3. **Old repo retired**: `gh repo delete` requires the `delete_repo` scope
   (not granted); instead renamed to `savant0x/DarkFrame-retired-20260911`
   and flipped **private** — old name frees immediately, no scope needed,
   old contributor list no longer publicly exposed. Repo had 0 stars/forks/
   issues/releases (nothing lost).
4. **New `savant0x/DarkFrame` created** and clean main pushed. Initial push
   failed repeatedly (`unexpected disconnect`, HTTP 403): the pack is
   425 MB — all 55 art blobs (402 MB) were committed in commit 1, so no
   commit-level chunking can shrink the first transfer. A single full push
   with a 30-minute budget succeeded (19:50:26 → 20:12:32).

## Verification (live, via API)

| Check | Result |
|---|---|
| Contributors | `savant0x (158)` — single contributor |
| Remote history scan (all 158 commits) | 0 codebuff mentions, 0 co-authored trailers |
| Remote author identities | 158× `savant0x` |
| Remote tip | `aabf429…` == local main (`VERIFIED` in push log) |
| Retired repo | private, name freed |

## Hygiene notes

- Local `backup-main-pre-rewrite` branch (58 trailers) is **never** pushed —
  it is the pre-rewrite safety copy and must stay local-only.
- `.githooks/` commit-msg + pre-push remain fail-closed; the pre-push scan
  ran clean on every push during this session, and its log is the provenance
  record for the pushed history.
- Future path if you ever want true deletion of the retired repo:
  `gh auth refresh -h github.com -s delete_repo`, then `gh repo delete
  savant0x/DarkFrame-retired-20260911 --yes`.
