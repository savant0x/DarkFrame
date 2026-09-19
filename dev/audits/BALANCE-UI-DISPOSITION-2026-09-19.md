# Balance-UI disposition — 2026-09-19 (survey P1 resolved: the gap does not exist)

**Directive:** "Investigate BalanceIndicator — the load-bearing STR/DEF balance
mechanic has UI that is mounted nowhere — and recommend mount-with-context or
delete with evidence."

**Verdict: neither. The premise was false — balance is already surfaced, twice.**
The archived component stays archived; no new UI is warranted.

## Evidence chain

### 1. The mechanic is load-bearing (confirmed)

`lib/balanceService.ts` (304 lines) computes a four-tier STR/DEF balance:

| Status | Ratio band | Power | Dealt | Taken | Gathering | Slot regen |
|---|---|---|---|---|---|---|
| CRITICAL | < 0.70 | ×0.50 | ×0.80 | ×1.30 | ×0.75 | ×0.85 |
| IMBALANCED | 0.70–0.85 | ×0.80 | ×0.90 | ×1.15 | ×0.90 | ×1.00 |
| BALANCED | 0.85–0.95 / 1.05–1.15 | ×1.00 | ×1.00 | ×1.00 | ×1.00 | ×1.00 |
| OPTIMAL | 0.95–1.05 | ×1.10 | ×1.05 | ×0.95 | ×1.10 | ×1.00 |

Consumers verified by reading each call site:
- **`battleService.ts:341-343`** — attacker AND defender balance compose every
  strike (dealt × attacker band, taken × defender band). FID-20260915-004.
- **`combatPowerService.ts:102`** — Combat Power = (STR+DEF) × balance.
- **`rankingService.ts:130`** — leaderboard ranking on balance-adjusted
  effective power (also `app/api/leaderboard/route.ts:165`).
- **`harvestEstimate.ts`** — gathering multiplier in harvest estimates
  (surface: StatsPanel harvest UX).
- **`/api/player/route.ts:62-73`** — computes `balanceEffects` per player GET.
- The `applyBalanceTo*` helpers (`balanceService.ts:186-251`) have **zero
  external callers** — the multipliers reach gameplay via the consumers above,
  not via those wrappers.

### 2. The UI already exists — live, rendered, client-fed

The survey's "mounted nowhere" was wrong at the census level (the census only
looked for the *component name* `BalanceIndicator`, not the *mechanic surface*):

- **`components/StatsPanel.tsx:300-301`** — STR/DEF proportion meters
  ("STRENGTH · NN%" / "DEFENSE · NN%" meter blocks).
- **`StatsPanel.tsx:519-529`** — a **Balance row**: `OPTIMAL ×1.10` /
  `CRITICAL ×0.50` etc., color-coded by status (green/secondary/amber).
- **`StatsPanel.tsx:530-545`** — a **"Dealt / Taken" row** showing both
  per-strike combat multipliers with tooltip and color coding.
- **`StatsPanel.tsx:564-568`** — a **caution note rendering
  `balanceEffects.recommendation`** ("Build NNN more DEF to reach balanced
  status") whenever status is CRITICAL/IMBALANCED.
- **`LeaderboardPanel.tsx:263-278`** — Effective Power (balance-adjusted) +
  balance status with multiplier percentage; same in `LeaderboardView`.

**Live-verified data path:** probe player registered on the running server;
`GET /api/player?username=…` returned the full `balanceEffects` object under
`/data` (status BALANCED, all multipliers ×1, "No army built yet" bonus note).
The sanitizer allowlist carries `balanceEffects` (`lib/playerSanitize.ts:87`),
so the object reaches the client intact — the exact shape StatsPanel reads.

### 3. The player population is heavily affected (DB census, 2026-09-19)

78 players, 58 armed:

| Band | Count | Share of armed |
|---|---|---|
| CRITICAL (< 0.70) | 21 | 36% |
| IMBALANCED (0.70–0.85) | 19 | 33% |
| OPTIMAL (0.95–1.05) | 8 | 14% |

Nearly **70% of armed players sit in penalty bands** — including the #1 power
player (Wailing_Bulwark, ratio 0.67 → power ×0.50, taking ×1.30 damage). This
is not a niche mechanic; it is the single largest hidden stat swing in the
game — and it is visible on the two surfaces players check most (stats panel,
leaderboard).

## Decision

- **Do not resurrect the archived component.** `BalanceIndicator` (124 lines)
  is a worse version of what StatsPanel now renders: a standalone bar with the
  same status/ratio data and none of the dealt/taken detail or actionable
  recommendation. The archive README already carries this caveat.
- **Do not build new UI.** Every load-bearing multiplier (power, dealt, taken,
  gathering, recommendation) already has a mounted surface fed by live data.
- **Update the survey record** (this document) so the P1 closes as
  "premise disprobed — already surfaced," matching how session-052's "level
  surfacing" hypothesis was resolved.

## Residual (optional, not recommended now)

The only balance information with no surface is the per-player **warnings /
bonuses lists** (e.g. "📉 Low morale: −25% gathering"). StatsPanel's dealt/taken
row covers the combat pair and the recommendation note covers the action; the
remaining text would be duplicative detail. If the operator ever wants it, it
belongs inside StatsPanel's existing Military Power block — not as a separate
component.
