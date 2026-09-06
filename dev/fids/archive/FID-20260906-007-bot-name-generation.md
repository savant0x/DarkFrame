# FID-20260906-007: Bot Name Generation — Unthemed Beer Base Names & varchar(20) Overflow Risk

**Filename:** `FID-20260906-007-bot-name-generation.md`
**ID:** FID-20260906-007
**Severity:** HIGH (player-facing quality defect + latent insert-crash class; no data-loss exposure)
**Status:** closed
**Created:** 2026-09-06

---

## 1. Summary

Players see bot names like `bS299792251945` and `bW788685172544` — machine slugs, not
game-themed identities. RED evidence shows these come from `spawnBeerBase`, which
**overwrites** the themed name `createBotPlayer` already generated with a
`b<tierLetter><ts8><rand4>` slug. Two adjacent defects share the same root cause
(username length budget ignored by all bot-name writers):

- **B1 (live):** Beer Base names are unthemed machine slugs.
- **B2 (latent):** `generateBotName()` has no length cap; measured word census
  (396 prefixes, 147 suffixes; longest `Legionnaire` = 11, `Nightmares` = 10) gives
  worst case `Legionnaire-Nightmares-999` = **26 chars** → `players.username` is
  `varchar(20)` **primary key** → insert crashes (same overflow class as the
  `flags.id` bug, SCOPE #20).
- **B3 (latent):** `createBossBot` emits `BOSS-${generateBotName()}` — worst case
  5 + 21 = **31 chars** (measured), crash on unlucky rolls. Bosses have not spawned
  yet to expose it.

`pamtpkziq5` was investigated and is **not** a bot (`is_bot=0`, test-row family:
`verifybuyer`, `smoketest1`, `testplayer1`) — recorded to close the operator's report.

---

## 2. RED — Findings with file:line evidence

### B1 — Beer Base slug overwrite (live, player-facing)

- `lib/beerBaseService.ts:1180-1183` — after `createBotPlayer()` returns a themed name
  (`botService.ts:139` `generateBotName()`: "Alpha-Command", "Quantum-Prime",
  "Shadow-Hunter"), the code replaces it:
  ```ts
  const timestamp = Date.now().toString().slice(-8);
  const randomSuffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  bot.username = `b${powerTier[0]}${timestamp}${randomSuffix}`;
  ```
- The comment at 1177-1179 states the slug exists to fit `players.username varchar(20)`
  and encodes the tier letter at index 1.
- **Live DB evidence (query against prod DB, 2026-09-06):** 3 bot rows total;
  `Flag-Bearer-4523` (themed), plus exactly the two reported slugs
  `bS299792251945` (2026-09-04), `bW788685172544` (2026-09-06).
- **Tier-letter consumers:** grep for `username[1]`, `charAt(1)`, `startsWith('b')`,
  `slice(1, 2)` → **zero matches** in `lib/`, `app/`, `components/`. The encoded tier
  metadata is dead weight — nothing parses it. The scanner shows Beer Bases via
  `bot.isSpecialBase` (`components/BotScannerPanel.tsx:338` renders 🍺), not via name.

### B2 — `generateBotName()` has no length guard (latent crash)

- `lib/botService.ts:139-145` — `prefix + '-' + suffix (+ '-' + 1-999)` over a 500-entry
  prefix list whose longest entries are 10-11 chars, suffixes up to 10 chars:
  `Hephaestus-Omicron-999` = 22 chars; even prefix-only compositions
  (`Hephaestus-Necromancer` = 23 chars) exceed 20.
- Consumers: `createBotPlayer` (botService.ts:474), `createBossBot` (botService.ts:616).
  All insert through `players.username varchar(20)` PK (`lib/db/schema/players.ts:7`).

### B3 — `BOSS-` prefix multiplies the overflow (latent crash)

- `lib/botService.ts:616` — `username: \`BOSS-${generateBotName()}\`` → worst case
  5 + 19 = 24 chars. Tier-7 boss spawns are operator-driven (`createBossBot`), so the
  crash fires on a live admin action with the wrong random draw.

### Non-finding (recorded): `pamtpkziq5`

- DB query: `is_bot=0`, level 1, created 2026-09-06 — same family as `verifybuyer`,
  `smoketest1`, `testplayer1` (test/probe rows from earlier verification work). Not a
  bot-naming defect; no code change warranted for it here.

---

## 3. Impact Analysis

- **Player experience:** Beer Bases are flagship targets (weekly respawn, 2-20x loot,
  🍺 marker). Their names are the most-visible bot identity in the game and currently
  read as debug artifacts — unacceptable for release quality.
- **Crash risk:** B2/B3 are the same insert-crash class already shipped once
  (flags.id varchar(24) overflow, SCOPE #20). Left in place, a future boss spawn or an
  unlucky regular-bot draw bricks that spawn path with `value too long for type
  character varying(20)`.
- **Data:** two live rows carry slugs; the `players.username` PK makes renaming safe
  only where nothing references the username. Beer Base bots are not referenced by
  battle logs, chat, or social rows (fresh DB, 3 bots total) — verified before repair.
- **Blast radius:** all edits confined to two functions (`spawnBeerBase`,
  `generateBotName` + its call site in `createBossBot`) plus a one-off data repair.
  No API contracts change; no downstream name-parsers exist (grep-proven).

## 4. Five Questions

1. **All cases?** Yes — the guard covers every writer: regular bots, bosses, Beer
   Bases, and the Flag-Bearer already conforms (`Flag-Bearer-4523` = 17 chars).
2. **Scale?** Yes — uniqueness comes from rejection sampling against the DB PK plus a
   numeric suffix space of 1-999 per composition; collisions are re-rolled, not
   tolerated.
3. **Hostile attacker?** Names are server-generated only (no user input anywhere in
   the path), so injection/griefing is out of scope by construction.
4. **Maintainable in 2 years?** Yes — one generator, one invariant (`≤ 20` enforced in
   code, not by comment), and the word lists stay in `botService.ts` where they live
   today (Law 13: no parallel list).
5. **Industry standard?** Themed, collision-safe name generation with an explicit
   length budget is standard for any persistent-identity game entity.

---

## 5. GREEN Design

### R1 — Themed Beer Base names (fixes B1, live defect)

**Decision:** Beer Bases are tavern-like fortified bases — give them a dedicated
compound-word identity drawn from the existing themed vocabulary, not the generic
`Prefix-Suffix` player-name format, so the base reads as a *place*, not a player:
`<Stronghold-Noun> <Descriptor>` (e.g. "Crimson Bastion", "Rusted Goliath",
"Obsidian Den").

- Remove the slug overwrite in `spawnBeerBase` (lines 1180-1183 + their comment).
- Add `generateBeerBaseName()` in `botService.ts` (same file as the word lists — Law 13)
  composing `<Noun> <Descriptor>` with an explicit ≤20-char cap and rejection against
  a short DB check for dupes within the spawn call.
- The power-tier letter is dropped — no code parses it (grep-proven), and tier remains
  visible via `level`, `rank`, and the scanner's 🍺 marker.

### R2 — Length-guarded `generateBotName()` (fixes B2)

- In `generateBotName()`, after composing, if the name exceeds 20 chars: re-roll (max
  8 attempts), then deterministically fall back to `Prefix-<n1-999>` which always fits
  (10 + 1 + 3 = 14 chars worst case). The invariant lives in the generator, so every
  current and future caller is covered.

### R3 — Boss name budget (fixes B3)

- `createBossBot` composes `BOSS-${name}` where the inner name is now length-guarded;
  additionally cap the composed result: if `BOSS-${name}` > 20, re-roll/fall back so
  the worst case is `BOSS-` + a ≤14-char fallback name = 19 chars. Boss identity stays
  visually distinct via the prefix.

### R4 — Data repair of the two live rows (fixes B1's existing damage)

- One-off script: rename `bS299792251945` and `bW788685172544` to fresh themed Beer
  Base names, guarded by a pre-check that no other row (chat, battle logs, social,
  notifications) references those usernames; abort renames if references exist and
  report instead.
- Idempotent: names already themed are skipped.

### Out of scope (recorded, not silently absorbed)

- `pamtpkziq5` + test-row family — flagged for operator cleanup decision (separate from
  bot naming; these are `is_bot=0` test rows from earlier probe work).
- Beer Base spawn flow otherwise (units, tiers, resources) — untouched; no balance
  change rides on this FID.

## 6. Verification Plan

1. **Static:** `tsc --noEmit` = 0 errors; `eslint` on touched files clean.
2. **Unit-level probe (Node):** call `generateBotName()` and `generateBeerBaseName()`
   through a TS-compiled harness: 200 samples each, assert all ≤ 20 chars, assert
   themed (regex: starts uppercase, no raw timestamps), assert composition variety
   (≥ 100 distinct of 200).
3. **Live probe (dev server):** invoke the Beer Base spawn path via the service on the
   dev DB; assert the inserted row's username is themed, ≤ 20 chars, and the row keeps
   `is_bot=1`, `isSpecialBase`, units, and tier resources intact.
4. **Regression:** full test suite (expect 341/341); Beer Base defeat path untouched —
   spot-check `removeBeerBase` still matches on `isSpecialBase`, not username.
5. **Data repair verification:** re-query the two renamed rows; confirm zero remaining
   slug-pattern bots (`username ~ '^b[A-Z][0-9]{12}$'` = 0 rows).

## 7. Loop Record

- **Pass 1 (RED→GREEN, this document):** findings cataloged with file:line + live-DB
  evidence; design settled; awaiting audit.
- **AUDIT round 1 (self-correct on the FID):** word census run against the actual
  lists (not comment estimates) — 396 prefixes / 147 suffixes, worst compositions
  26 and 31 chars (estimates in Pass 1 said 22/24; corrected). Second parser sweep
  (`username.slice/charAt/startsWith/match` across lib/app/components) returned only
  admin-username truncations — again zero bot-name/tier-letter consumers. FID claims
  now match measured reality; proceeding to implementation.
- **IMPLEMENT + verification (2026-09-06):**
  - R1/R2/R3 implemented: `generateBotName()` length-guarded (re-roll ×8 + bounded
    fallback), `generateBeerBaseName()` place-style names with measured variant
    budget, `generateBossName()` with 20-char `BOSS-` budget; slug overwrite removed
    from `spawnBeerBase` (lib/beerBaseService.ts); PK-collision retry (5 attempts,
    numeric variant) at the insert site.
  - **Self-correct round 2 (tests caught the design):** initial variant budget
    reserved 3 chars but a 3-digit variant renders 4 (`" 100"`) → 21-char name;
    budget made measured-suffix-based. Boss regex in the test wrongly forbade
    two-word cores; corrected to the real contract.
  - Contract tests: `__tests__/lib/botNameGeneration.test.ts` — 7/7 pass
    (500-sample length budgets ×3 generators, themed-shape regexes, variety ≥ 25%
    distinct, variant worst case).
  - Live probe (dev DB, `spawnBeerBase` full path): spawned **"Thundering Depot"**
    (16 chars, `is_special_base=1`, level 9) — themed row persisted through the
    real service. Generator variety: 200/200 distinct (regular), 162/200 distinct
    (Beer Base), all ≤ 20 chars.
  - R4 data repair: schema-driven reference discovery (28 username-bearing columns
    across all tables via information_schema), zero references found; renamed
    `bS299792251945` → **Rusted Redoubt**, `bW788685172544` → **Forsaken Outpost**.
    Convergence: slug-pattern bots (`^b[A-Z][0-9]{12}$`) remaining = **0**.
  - Gates: `tsc --noEmit` 0 errors; eslint clean on touched files; full suite
    **348 passed / 1 skipped (349)** (up from 341 — 7 new contract tests).
- **CLOSED** — all four requirements implemented and verified live; commit hash
  recorded in CHANGELOG entry.
