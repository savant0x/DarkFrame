# FID-20260910-040 — Harvest Calculator Math Unification

**Date:** 2026-09-11 · **Trigger:** operator report "the Harvest Calculator's math seems off/incorrect."

## Audit findings (both calculators, verified against `harvestResourceTile`)

### StatsPanel "Harvest Calculator" (sidebar)
1. **Wrong base range** — displayed `Base 1,000` flat; the server rolls **800–1,500** (`GAME_CONSTANTS.HARVEST`).
2. **Balance term entirely missing** — the server applies the four-tier army-balance
   gathering multiplier (0.75/0.90/1.00/1.10) to every harvest; the panel never showed it.
   For the operator's STR-heavy army (CRITICAL ×0.75) every prediction was ~33% high.
3. **Fabricated Cave/Forest block** — claimed `500–1,500` resources with all multipliers;
   caves/forests credit **zero resources** (`harvestCaveTile`/`harvestForestTile` roll
   items at 30%/50% only).
4. **Shrine term mis-scaled in display** — `totalShrineBonus` sums raw `yieldBonus`
   (0.25) then rendered `+25%` correctly but multiplied by `(1 + 0.25)` while the
   server multiplies by `(1 + 25/100)` — coincidentally equal, but the "+%" label came
   from an unfiltered list (expired boosts included in display; module filters).

### Stats → Harvest Calc tab (`HarvestCalculatorTab`)
5. **Auto-detect scrape read nonexistent fields** — dug `inventory.items[].equipped` /
   `.yieldBonus`; `InventoryItem` has neither (`bonusPercent`/`bonusValue` it does).
   Digger bonus was **always 0**, even when fetch worked.
6. **Root data defect** — `sanitizePlayer`'s allowlist stripped `gatheringBonus` and
   `shrineBoosts` from `/api/player`, so no client could read the real yield drivers.
7. **Invented balance curve** — ±20% by ratio bands (0.45/0.49/0.53…); the real system
   is CRITICAL 0.75 · IMBALANCED 0.90 · BALANCED 1.00 · OPTIMAL 1.10.
8. **Default base 1,000** presented as typical; real mean is 1,150.

## Fix architecture — one pipeline, three consumers

- **`lib/harvestEstimate.ts` (new, pure)** — `estimateHarvest()` replicates the server
  pipeline exactly: base roll (800–1,500) → `floor(base × (1 + gathering% + temp% + shrine%))`
  → `floor(×2 VIP)` → `floor(×2 bearer)` → `floor(× balance.gatheringMultiplier)`.
  `estimateHarvestExpected()` seeds the roll mean (1,150) for stable headline numbers.
  `balanceService` is dependency-free, so this is client-safe.
- **`lib/harvestService.ts`** — the payout now computes through the shared module
  (dead hand-rolled accumulation removed; expired-boost persistence kept). UI drift is
  structurally impossible: both calculators and the server call the same function.
- **`lib/playerSanitize.ts`** — allowlist gains `gatheringBonus` + `shrineBoosts`
  (non-sensitive percent multipliers + boost expiry).
- **`components/StatsPanel.tsx`** — true base range, per-node gathering from
  `player.gatheringBonus`, shrine from filtered boosts, balance row (×multiplier +
  tier label), honest Cave/Forest block (item-drop odds), Expected = mean-based.
- **`components/StatsViewWrapper.tsx`** — real fields (gatheringBonus, not the scrape),
  Metal/Energy node selector (diggers are per-resource), read-only auto terms with the
  REAL balance tier chips, true roll bounds, server-identical breakdown steps.

## Tests & verification

- **`__tests__/lib/harvestEstimate.test.ts`** (12): default roll bounds, additive
  stacking, expired-boost/VIP filtering, stage-order floors (`floor(b×1.33)=1328 → ×2 =
  2656`, not 2655), ×4 VIP+bearer, all four balance tiers, full-pipeline order.
- **Live payout parity (prod :3001):** real harvest as fame (+39% metal, VIP active,
  flag bearer, CRITICAL balance) → `metalGained 5625` = `floor(floor(1349×1.39)×4)×0.75`
  — exactly the shared module's prediction, term-for-term including the balance penalty.
- **Payload smoke:** `/api/player` now ships `gatheringBonus {metalBonus:39, energyBonus:36}`
  and `balanceEffects.gatheringMultiplier 0.75`.
- Gates: tsc 0 · eslint 0 · vitest **487 passed** (12 new) · `next build` exit 0.

## Follow-ups (noted, not built)
- Cave/forest could credit a small resource consolation on miss — design decision, not a bug.
- StatsPanel sidebar and the Stats tab could share one component later; both now share the math.
