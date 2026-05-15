# DarkFrame — Map Seeding Research Prompt

> Research prompt for optimizing terrain distribution and map seeding.
> All values reflect the CURRENT post-balance state (verified against source code, May 2026).

---

## Map Context

DarkFrame is a 150×150 tile browser strategy MMO (22,500 total tiles). Players harvest resources, build armies, capture factories, and compete for a flag. The map is procedurally generated at reset.

---

## Current Terrain Distribution

| Terrain | Count | % of Map | Purpose |
|---------|-------|----------|---------|
| Wasteland | 8,995 | 39.98% | Filler/empty |
| Metal | 4,500 | 20.0% | Primary resource |
| Energy | 4,500 | 20.0% | Primary resource |
| Cave | 1,800 | 8.0% | High-risk items/diggers |
| Forest | 450 | 2.0% | Better loot than caves |
| Factory | 2,250 | 10.0% | Strategic/PvP |
| Bank | 4 | 0.018% | Storage (fixed locations) |
| Shrine | 1 | 0.004% | Buffs (fixed at 1,1) |
| AuctionHouse | 1 | 0.004% | Trading (fixed at 10,10) |

**Total: 22,500 tiles**

**Notes:**
- The shuffled terrain array starts with Wasteland at 9,000 but 5 tiles are overwritten by fixed special locations (1 Shrine + 4 Banks), leaving **8,995 Wasteland** in practice.
- Cave count in `TERRAIN_COUNTS` is **1,800** (the JSDoc comment in `generateTerrainArray()` saying 2,250 is stale/wrong).
- Forest tiles are harvested identically to Cave tiles (same `harvestCaveTile` function) with the same drop rates.

---

## Current Economic Parameters

### Harvest
- Base: **400–750** per tile (random uniform)
- Reset: **Split cycle** — Tiles at x=1-75 reset at **midnight (00:00)**, tiles at x=76-150 reset at **noon (12:00)**
- Per-player harvest tracking via `tile_harvest_records` table

### Cave/Forest Drops
- Base drop rate: **2.5%** per cave/forest exploration
- Drop split: **20% diggers**, **80% tradeable items**
- Guaranteed digger every **75 caves** explored (anti-bad-luck)
- Expected diggers per full 1,800-cave sweep: **~33** (9 normal + 24 guaranteed)

### Digger Bonus (Exponential Decay)
Formula: `bonus = 200 × (1 - e^(-0.008×n))` where n = digger count, cap = 200%

| Diggers | Bonus |
|---------|-------|
| 10 | +15.4% |
| 25 | +36.3% |
| 50 | +65.9% |
| 100 | +110.1% |
| 150 | +139.8% |
| 200 | +159.6% |

Old linear `DIGGER_TIERS` constant is still in `GAME_CONSTANTS` but is **not used** — `itemUtils.ts` is the only import and is untested/legacy. Active system is in `diggerService.ts`.

### Shrine Boost
- 4 tiers: spade (3 items, 1hr), heart (10 items, 1hr), diamond (30 items, 4hr), club (60 items, 8hr)
- Each gives `yield_bonus: 0.25` (+25% raw)
- **Internal diminishing within shrine**: 1st=+25%, 2nd=+20%, 3rd=+15%, 4th=+10% → **max +70% from shrine alone**

### VIP Bonus
- **+50%** additive, applied only while VIP subscription is active (checked against `vip_expiration` date)

### Flag Bearer Bonus
- **+50%** additive

### Bonus Stacking (Multiplier System)
All bonuses are combined additively then passed through tiered diminishing returns:

| Raw Bonus Tier | Effectiveness |
|----------------|---------------|
| First +100% | 100% effective |
| Next +100% | 75% effective |
| Next +100% | 50% effective |
| Beyond +300% | 10% effective |

**Example — VIP (+50%) + Flag Bearer (+50%) + Shrine (+70%) = +170% raw:**
- First 100% × 1.0 = 100%
- Remaining 70% × 0.75 = 52.5%
- Effective: +152.5% → **final multiplier = 2.525x**

### Max Single-Tile Harvest
`750 (base) × (1 + 2.00 (max digger)) × 2.525 (all bonuses) = **5,681** per tile`
Realistic sustained max (moderate diggers): `750 × 1.66 × 2.525 ≈ 3,144`

### XP Curve: `XP = 250 × L^2.5`

| Level | XP to Reach | XP for This Level | Est. Days (100 harvests/day, 3 XP/harvest) |
|-------|-------------|-------------------|---------------------------------------------|
| 5 | 13,975 | 5,975 | 47 days |
| 10 | 79,056 | 18,306 | 264 days |
| 15 | 217,855 | 34,514 | 727 days |
| 20 | 447,213 | 53,823 | 1,491 days |
| 25 | 781,250 | 75,797 | 2,605 days |
| 30 | 1,232,375 | 100,145 | 4,108 days |

**Note:** XP from harvesting is only 3 XP/tile. Higher XP comes from combat (300 XP/win), factory captures (200 XP), and cave exploration (30 XP). The harvest-only XP pace above is a lower bound — actual play with combat will be substantially faster.

### Tier Unlocks
| Tier | Level | RP Cost | Metal Cost |
|------|-------|---------|------------|
| 1 | 1 | 0 | 0 |
| 2 | 10 | 50 | 100,000 |
| 3 | 20 | 150 | 500,000 |
| 4 | 35 | 350 | 2,500,000 |
| 5 | 50 | 750 | 10,000,000 |

**1 RP is awarded per level gained** (in addition to special RP sources like daily harvest milestones).

### Faucet Controls
- Resource decay: **0.25% daily** on amount above **1M threshold**, max **250K decay/day** per resource
- Auto-farm: **Continuous client-side traversal engine** (not a timed toggle). Client-side start/stop/pause/resume. VIP gets faster movement (200ms vs 500ms) and harvest delay (800ms+0ms vs 800ms+2000ms).
- Manual attacks: No cooldown (rate-limited to 30 req/min)

---

## Questions

### Distribution
1. Wasteland at ~40% — too much? Should it be reduced to increase resource density?
2. Metal/Energy at 20% each — should Metal be rarer since it's commonly used for military (T2+ units cost more metal than energy)?
3. Caves at 8% (1,800 tiles) — with 2.5% drop rate and 20% digger chance, that's ~33 diggers per full sweep. Is this the right pace for digger accumulation?
4. Forests at 2% (450 tiles) — same drop mechanics as caves but described as "better loot." Should Forests remain rare or be buffed to differentiate from Caves?
5. Factories at 10% (2,250 tiles) — for the expected concurrent player count, are 2,250 factories enough to create hotspots of competition?
6. Banks at 4 — should there be more (8-12) to reduce travel time for storage?
7. Forest tiles are listed separately but use identical harvest logic as Cave tiles. Should Forests have a distinct, better loot table to justify their own terrain type?

### Resources
8. Base harvest 400-750 — does this create the right income curve for early/mid/late game spending needs?
9. With all bonuses, max harvest ≈ **5,681** per tile. Is this the right ceiling for a single action?
10. Digger exponential decay cap at 200% — does this feel meaningful without being oppressive given that a full sweep yields ~33 diggers?
11. Diggers have a guaranteed drop every 75 caves (anti-bad-luck). Does this feel fair?

### Progression
12. XP curve `250 × L^2.5` — level 50 requires 4.4M XP. Players also earn XP from combat (300/cave explore, 200/factory capture, 300/infantry win). Is the curve balanced for players who actively fight vs. passive harvesters?
13. At 1 RP per level gained, a player reaching level 30 earns ~30 RP from levels alone — far below the T4 unlock cost of 350 RP. Are supplementary RP sources (daily milestones, achievements) sufficient?
14. Tier unlock level gates (L10→T2, L20→T3, L35→T4, L50→T5) — with the XP curve, T5 at L50 is essentially unreachable for most players. Is this intentional as an aspirational goal?

### Strategic
15. Shrine at corner (1,1) — should it move to center (75,75) for more contested gameplay?
16. Banks at (25,25), (75,75), (50,50), (100,100) — should they form a diamond pattern at 1/3 and 2/3 positions instead?
17. Should the map be clustered by region (e.g., resource-rich vs. wasteland sectors) or remain purely random?
18. Spawn points — should new players spawn in outer 20% ring with guaranteed nearby resources?
19. Auction House at (10,10) — very near Shrine at (1,1). Should these be placed farther apart?

### Known Discrepancies to Resolve
20. `DIGGER_TIERS` in `GAME_CONSTANTS` describes old linear system and is a dead constant. Should it be cleaned up?
21. `generateTerrainArray()` JSDoc says "Cave: 2,250" but `TERRAIN_COUNTS` actually sets Cave: 1,800. JSDoc should be corrected.
22. `game.types.ts` line 22 says "Wasteland: 8,500 tiles (38%)" but `TERRAIN_COUNTS` sets Wasteland: 9,000. The 8,500 figure accounts for the 5 overwritten special tiles but the percentage (38%) doesn't match 8,500/22,500 = 37.78%. Should the type-level JSDoc match the code constants or the post-overwrite actuals?

---

## Version History
- **May 2026**: Corrected all values against source code. Fixed terrain counts, tier unlock requirements (RP/metal/levels), XP curve values, resource decay parameters, digger formula, bonus stacking mechanics, and max harvest calculation. Added Forest terrain, split reset cycle, and cave drop specifics.
