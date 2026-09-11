
## FID-20260911-041 — Swallowed-error audit (egress-era quality pass)
- lib/apiClient.ts: extractApiError (reads structured error.message, Zod details, legacy flat shapes — never "[object Object]"), apiFetch, apiFetchOrToast.
- Wired 50+ rejection surfaces across game page, GameContext.movePlayer, Shrine, Bank, Bot Magnet/Summon, Combat modal, Harvest, Beer Base, Auction ×3, ClanChat, Alliance, Fund/Income/Tier/UnitBuild, WMD ×5, Hotkeys, Specialization.
- TopNavBar advisory polls left silent (explicit design comments).
- Shrine Buffs panel preserved in StatsPanel — now fed real shrineBoosts (FID-040 sanitizer) with expired boosts filtered.
- 6 new extractor contract tests; live smoke proved both server body shapes on :3001.
- Gates: tsc 0 · eslint 0 · vitest 493 passed/1 skipped · build 0.
