# FID-20260911-041 — Swallowed-Error Audit: Every Server Rejection Surfaces In-Game

**Date:** 2026-09-11 · **Trigger:** Directive to audit all game API handlers for swallowed
error bodies and surface each server rejection reason as an in-game toast instead of
console-only failures. Companion constraint: **the Shrine Buffs panel is vital and must
remain in StatsPanel — fixed, not removed.**

## Root cause map

The codebase has **~183 `await response.json()` call sites** and three failure classes
that hid the server's reason:

1. **Body never read** — `catch { /* nothing */ }` or `catch (e) { console.error(e) }`
   (ShrinePanel activate paths, game-page harvest/attack handlers, GameContext move).
2. **`result.error || 'fallback'`** — the error system ships
   `{ success: false, error: { code, message, details } }` (lib/errors/responses.ts), so
   `error` is an **object**: the template string rendered "[object Object]" (FlagTracker
   challenge handlers pre-FID-039-R2, BotMagnet, BotSummoning, WMD×5, ClanChat,
   Alliance, CombatAttackModal, Specialization).
3. **`data.message || 'generic'`** — `message` only exists on SUCCESS payloads; error
   bodies carry the reason under `error.message` (ShrinePanel, BankPanel×3, auction×8,
   HotkeyManager, HarvestButton).

**Shrine Buffs panel status:** preserved in StatsPanel (line ~666, `HudPanel` violet
accent). Its earlier defect was data starvation, not design — FID-040's sanitizer fix
now exposes `shrineBoosts`, the panel filters expired boosts, and ShrinePanel's activate
errors now surface real server reasons via the new extractor.

## The fix — one extractor, wired everywhere

**`lib/apiClient.ts`** (new):
- `extractApiError(body, status)` — pure; reads every shape in use: structured
  `error.message`, Zod `details.errors[].message`, legacy flat `error` string, flat
  `message` soft-fails, raw text, and status-based fallbacks. Never returns
  "[object Object]".
- `apiFetch(url, init)` — fetch + parse + non-2xx→`ok:false` + reason extraction;
  network failures resolve `ok:false, status:0` with a readable message.
- `apiFetchOrToast(url, init, fallback)` — apiFetch + automatic `showError` toast.

**Wired call sites (reasons now visible in-game):**

| Surface | Before | After |
|---|---|---|
| Game page: harvest, base attack, factory attack, flag challenge/flee/claim | `[object Object]` or silent | toast with server reason (FID-039-R2 guards kept) |
| GameContext `movePlayer` | wrote to an `error` state **consumed by no route** | toast in the catch (context state kept for future consumers) |
| ShrinePanel activate/boost-all | `data.message \|\| 'Activation failed'` (never true) | server reason inline |
| BankPanel deposit/withdraw/exchange | same pattern ×3 | server reason via toast |
| BotMagnetPanel deploy/deactivate | `data.error \|\|` object render | server reason |
| BotSummoningPanel summon | same | server reason |
| CombatAttackModal attack | `throw new Error(data.error \|\| …)` object stringification | server reason in modal error slot |
| HarvestButton | `data.message \|\| 'Harvest failed'` | server reason via result callback |
| BeerBasePanel attack | structured failures rendered an **empty result modal** | reason injected into the result |
| AuctionHousePanel / AuctionListingCard / CreateListingModal | 8× `data.message \|\|` | server reasons |
| ClanChatPanel / AlliancePanel | 11× `data.error \|\|` | server reasons |
| FundDistribution / PassiveIncome / TierUnlock / UnitBuildEnhanced | 5× | server reasons |
| WMD Defense/Intelligence/Missile/Research/Voting | 11× `data.error \|\|` | server reasons |
| HotkeyManagerPanel | 2× `data.message \|\|` | server reasons |
| SpecializationPanel choose/respec | 2× toasts | server reasons |

Deliberately **unchanged**: TopNavBar activity/WMD advisory polls (background, explicit
"silently fail" comments — noise-toasting a 30s poll would be a defect).

## Verification

- **Unit:** 6 new tests pinning `extractApiError` against every body shape, including
  the "[object Object]" regression guard and Zod-details precedence.
- **Live smoke (production build on :3001):** `/api/harvest` unauthenticated →
  structured `{ error: { code, message } }` (extractor reads it); `/api/flag/challenge`
  → legacy flat `{ error: "Unauthorized - please log in" }` (extractor reads it);
  `/api/health` 200.
- **Gates:** tsc 0 · eslint 0 · vitest 493 passed / 1 skipped · `next build` exit 0.
