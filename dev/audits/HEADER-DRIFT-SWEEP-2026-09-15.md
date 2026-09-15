# Header numeric-claim drift sweep — lib/ (2026-09-15)

**Task source:** operator directive — "Sweep every lib/ file header for the same drift
class: numeric claims in comments that no test or runtime check validates, and rank the
riskiest five." Follows FID-20260915-006a (tier-ladder comments drifted for months) and
the ladder-truth CI gate (SCOPE row 50) that now guards that one file.

## Method (and its limits)

Machine sweep of the **file-header comment block only** (up to first code line, ≤140
lines) of every `lib/**/*.ts`: regex extraction of percentages, multipliers, numeric
ranges, comma-grouped magnitudes, and time constants (noise-filtered: FIDs, dates,
version strings). ~200 claims across ~40 files. Each top candidate then adjudicated by
hand: claim ↔ code ↔ test-coverage check (import-level grep of `__tests__/`, not raw
substring count).

Limits: function-level comments are out of scope here (botService's are already
CI-guarded by `scripts/ladderTruth.ts`); test-coverage probes are greps, so a test that
pins a value without the literal is counted as uncovered (conservative — that's the
right bias for a risk ranking).

## The ranked five

### 1. `lib/factoryUpgradeService.ts` — header curve contradicts CI-pinned truth (HIGH)
Header documents: slots `5000 + (level−1)×500` (L1 = 5,000 … L10 = 9,500), regen
`416.67/hr`, costs `1000/500 × 1.5^level`, defense ladder 1,500 / 11,391 / 76,699 /
169,000. The live engine (pinned by `__tests__/lib/factoryCurves.test.ts`, green in
CI) is a **different design**: slots 400 + 150/level (L1 = 400 … L10 = 1,750), regen
120/hr, costs base 2,500/1,250 × 1.5^target, defense (L−1)²×12,500 with the L1 cliff
smoothed. This is not drift-in-waiting — **the header is already false**, in the exact
file family (`factory*`) that shipped the auction build-shape regression, and no test
reads the header. Any engineer tuning factories from the header tunes the wrong game.
Fix: rewrite header to the pinned curve; ideally re-point the doc at the test.

### 2. `lib/battleService.ts` — header documents superseded combat semantics (HIGH)
Header (L14–18): counter formula `DefenderDEF − AttackerSTR/2`, "HP loss translates to
unit casualties", "Winners capture 10–15%", "Base attacks allow 20% resource theft".
Reality: the capture constants (L140–141: 0.10/0.15) are true, but the theft line
predates FID-038's declared-resource rule and FID-20260915-004/-005's vault caps and
preserve-axis bookkeeping, and the formula line describes the pre-FID-20260915-001/002
engine — the exact algebra whose garrison mis-wire produced the annihilation incident.
Combat is the highest-blast-radius system in the game and this header is the first doc
any engineer reads. Fix: restate the live rules; keep capture (still true).

### 3. `lib/botGrowthEngine.ts` — build-rate/age block is true today, unguarded, and probabilistic (MEDIUM-HIGH)
Header build rates (Fortress 1/2h, Raider 1/h, Hoarder 1/4h, Ghost 1/1.5h, Balanced
1/h) match `BUILD_RATES` (L76–82: 0.5/1.0/0.25/0.67/1.0) — verified this sweep. But
zero tests import the table, builds are probabilistic (`Math.random() < rate`), and the
header's age multipliers (1× <7d, 1.5× 7–30d, 2× >30d) describe `getAgeMultiplier`
steps that nothing pins. This file just underwent its largest rewrite (FID-005/006);
the ladder-truth precedent shows how fast these tables rot. Fix: extend the ladder-truth
gate to `BUILD_RATES` + age steps + `REGENERATION_RATES`.

### 4. `lib/botSummoningService.ts` — feature claims with zero coverage (MEDIUM)
Header promises 1.5× summoned-bot resources and a 168h (7-day) cooldown. Both are real
today (`RESOURCE_MULTIPLIER` applied at L118–119, `COOLDOWN_HOURS: 168`) but no test
touches the service — the claims are enforced by nothing. These are *player-facing
promises*: if the multiplier is dropped during a refactor, summoning silently stops
delivering what the UI/tech-tree says it does. Fix: two unit pins (multiplier applied;
cooldown math).

### 5. `lib/rankingService.ts` — overlapping band table, docs-only risk (MEDIUM)
Header restates the four balance bands (0.5×/0.8×/1.0×/1.1×) with boundaries that
overlap in the text (Balanced 0.85–1.15 vs Optimal 0.95–1.05) without saying which wins.
Code drift is *currently impossible* — ranking consumes `balanceEffects.powerMultiplier`
from balanceService, single source — but the duplicated table can drift (it must be
edited in lockstep with balanceService's), no direct `rankingService` test exists, and
the overlap ambiguity invites a future wrong fix. Fix: one line ("band resolution lives
in balanceService.getBalanceEffects; values below are a mirror") + a parity test
mirroring the ladder-truth pattern.

## Honorable mentions

- `concentrationZoneService.ts`: "70%" (×2 in header) — concentration-yield claim, no test.
- `harvestEstimate.ts`: header's "wrong base ranges / fabricated blocks" narrative is
  *correctly labeled as history* and the module has a dedicated test — the model citizen.
- `terrainCodec.ts`: 22,500-tile payload math is a grid-size fact; codec tested, the
  magnitude claim isn't (cosmetic risk).
- Migration files (`migrations/*.ts`) carry one-off historical numbers — out of scope;
  they describe completed, non-recurring work.

## Recommendation

The riskiest five share one property: **numeric truth that lives in prose**. The
ladder-truth gate (row 50) already proves the pattern works; extending it costs ~30
lines per table. Suggested order: #1 and #2 are *already false* (doc corrections, not
just guards); #3–#5 are guard additions before they rot.
