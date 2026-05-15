# FID-20260512-BEERBASE-TILE-INTEGRATION

| Field            | Value                              |
|------------------|------------------------------------|
| **Document ID**  | FID-20260512-BEERBASE-TILE-INTEGRATION |
| **Date Created** | 2026-05-12                         |
| **Status**       | OPEN                               |
| **Priority**     | HIGH                               |
| **Phase**        | Execution                          |

## Context

Beer bases are NPC bot bases functioning as "loot boxes on the map" — PvE targets for resource acquisition. Currently the system has no tile-level interaction: players see wasteland terrain instead of beer base artwork, and there's no attack flow from the tile.

Full design document: `dev/Designing DarkFrame's Beer Base System (1).md`

## Key Design Decisions

### Combat — Virtual Garrison
Beer base STR/DEF is partitioned into 4 archetype equivalents (Striker, Bulwark, Artillery, Support) based on specialization. Combat resolves in 3 phases:
1. **Artillery Phase** — Artillery targets Support first (disrupts multipliers)
2. **Support Phase** — Surviving Support amplifies remaining units (max +60%)
3. **Frontline Phase** — Striker→Bulwark (130%), remaining stats clash

Using Modified Lanchester attrition laws (fractional exponent ~0.66) for deterministic resolution.

### Loot Formula
`Loot = BasePool × Mtier × Mspec × V × DR`
- **BasePool**: Server-wide average hourly production × 12
- **Mtier**: 2x (Weak) to 20x (Legendary)
- **Mspec**: Specialization modifier (Hoarder 1.5x, Fortress 0.8x, etc.)
- **V**: Random variance 0.9-1.1 (VIP: 1.0-1.15)
- **DR**: Logarithmic diminishing returns (100% → 15% by 8th attack in 24h)

### Anti-Farming
- Logarithmic decay on successive attacks within 24h
- **Ruins state**: Defeated bases become ruins (10% scavenge yield, 48h auto-cleanup)
- Sink: High base defense forces unit casualties (target 40-60% net profit)

### Asset Mapping
| Tier | Asset |
|------|-------|
| Weak | `tiles/bases/1-2.jpg` |
| Mid | `tiles/bases/3-5.jpg` |
| Strong | `tiles/bases/6-10.jpg` |
| Elite | `tiles/market_plaza/` or `tiles/research_lab/` |
| Ultra | `tiles/vault/` or `tiles/ancient_forge/` |
| Legendary | `tiles/grand_temple/` or `tiles/war_memorial/` |

## Implementation Order

### Phase 1: Tile Display (Current Session)
- [ ] Add `entity_state` and related fields to beer base DB schema
- [ ] Tile renderer shows beer base artwork when bot at tile
- [ ] Tile info panel shows base name, tier, STR/DEF, resources
- [ ] Attack button appears on bot tiles

### Phase 2: Combat Resolution
- [ ] Virtual garrison partitioning (SPEC → archetype distribution)
- [ ] 3-phase combat resolution algorithm
- [ ] `/api/bot/attack` endpoint
- [ ] Attack result display in tile view

### Phase 3: Loot & Economy
- [ ] Loot calculation with all modifiers
- [ ] Diminishing returns tracking
- [ ] Resource transfer on victory
- [ ] Unit casualty application

### Phase 4: Defeat & Respawn
- [ ] Ruins state (scavenge mechanic)
- [ ] 48h auto-cleanup cron job
- [ ] Weekly respawn cycle integration
- [ ] Analytics tracking (TTK, net profit, DR efficacy)

## Verification
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Tile shows correct tier artwork for beer base
- [ ] Attack resolves with phased combat
- [ ] Loot applies diminishing returns correctly
- [ ] Defeated base shows ruins state
