
## 2026-09-11 — FID-20260910-040 Harvest Calculator math unification
Audited both Harvest Calculators against `harvestResourceTile`; found 8 defects
(wrong base range, missing balance term, fabricated cave/forest resource block,
scrape of nonexistent inventory fields, sanitizer stripping gatheringBonus/
shrineBoosts, invented balance curve). Built `lib/harvestEstimate.ts` as the
single server-identical pipeline now used by the payout path AND both UIs;
sanitizer exposes the yield drivers; 12 parity tests; live payout parity proven
(5625 = exact predicted term-for-term output incl. ×4 VIP/bearer × CRITICAL 0.75).
Gates: tsc 0 · eslint 0 · vitest 487 · build 0. Flag R2 (409 client guards +
idempotent rejoin) also landed this session — see FID-039 R2.
