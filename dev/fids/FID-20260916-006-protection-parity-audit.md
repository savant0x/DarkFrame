# FID-20260916-006: Protection parity audit — remaining PvP surfaces

**Filename:** `FID-20260916-006-protection-parity-audit.md`
**ID:** FID-20260916-006
**Severity:** HIGH (aggregate: one HIGH gap live-reachable)
**Status:** created
**Created:** 2026-09-16

**Provenance:** operator directive — audit the remaining PvP surfaces (factory attack,
espionage, anything that hits another player) for protection parity with the infantry and
WMD seams. Audit only; enforcement specs follow per gap on decision.

---

## 1. Summary

FID-002 established the protection contract (shield protects arrival, not action) and
FID-003/-004/-005 enforced it on infantry attack, WMD launch, war-clan join, and WMD
targeting. This audit sweeps **every other surface that touches another player** for
parity. Result: **three live-reachable gaps and one latent gap** — the worst being spy
sabotage, where a protected account can destroy another player's missile components,
delay construction, and waste resources with zero protection interaction on either side.

## 2. Parity matrix (all claims tool-verified 2026-09-16)

| Surface | Harm to target | Target-side refusal | Attacker void | Live-reachable | Verdict |
| ------- | -------------- | ------------------- | ------------- | -------------- | ------- |
| Infantry attack (`battleService:675`, route :113) | direct PvP | ✅ | ✅ | ✅ | REFERENCE |
| WMD launch (`missileService:233` void, `-005` validation) | mass-casualty outgoing | ✅ | ✅ | ✅ | REFERENCE |
| War-clan join (`clanService:539`) | war by proxy | n/a | ✅ (ACTIVE-war gate) | ✅ | REFERENCE |
| Beer-base raid (`executeBaseAttack`) | bots-only by contract | n/a | intentionally no void (documented at :669-673) | ✅ | CLEAN |
| **Factory capture** (`factoryService:386`) | steals a player-owned factory | ✅ refusal exists | ❌ no void | ✅ (`FactoryButton`, R-key) | **GAP: void** |
| **Player battle resolve** (`resolveBattle` via `app/api/battle/attack`) | direct PvP | ❌ (defender protection never checked) | ✅ void fires inside `resolveBattle` | ❌ **no client caller** (API mounted, unreferenced) | **GAP: refusal — LATENT** |
| **Spy sabotage** (`executeSabotage`, `spyService:476`) | destroys missile components, delays builds, wastes resources (`applySabotageDamage` :1239) | ❌ zero `protection` refs in spyService | ❌ | ✅ (`WMDIntelligencePanel`) | **GAP: both — HIGH** |
| **Spy missions** (`startMission:280`) | reconnaissance/information ops | partial (`validateMissionTarget:853` checks existence + own-clan only) | ❌ | ✅ | **GAP: decision** (intel ≠ destruction — operator call) |
| **Flag steal** (`startChallenge` via `/api/flag/challenge`) | steals held Flag | ❌ | ❌ | ✅ (`app/game/page.tsx`) | **GAP: decision** (contested-object PvP; bearer accepted steal risk?) |
| **Territory capture** (`clan/warfare/capture`) | tile capture | war-gated by design | ❌ no void | war-context only | **GAP: void — LOW** (war gate already implies context) |

## 3. Impact Analysis

- **Spy sabotage (HIGH):** the exact shield-bypass shape FID-005 closed for WMD strikes,
  one layer down — a protected account fields spies from inside its 72h window and
  destroys a veteran's warhead components. Live panel → live route → live service.
- **Factory capture void:** a protected player captures player-owned factories while
  shielded — committed action, no forfeit; asymmetric with infantry/WMD precedent.
- **Latent battle route:** server-side unprotected endpoint with attacker void already
  inside `resolveBattle` but no defender refusal — if ever wired to a client it ships
  the pre-002 shield bypass. Cheap pin now prevents a future resurrection bug.
- **Flag steal / recon missions:** policy decisions more than defects — does information
  warfare or a contested-object minigame count as aggression under the ratified
  principle? Both need an operator call, not a mechanical fix.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | Yes — the matrix enumerates every player-touching surface found by route/service/client sweeps |
| Scales? | Yes — each gap is one seam in an existing service, same shape as -004/-005 |
| Survives a hostile attacker? | That is the point — every gap is currently exploitable by a shielded account |
| Maintainable? | Yes — pins per seam, same harness idioms |
| Sets the standard? | Yes — one principle, uniformly enforced, beats per-surface improvisation |

## 5. Recommended Dispositions (operator decides; enforcement via follow-up FIDs)

1. **Spy sabotage** → void on execution + refuse protected targets (parity with launch). HIGH.
2. **Factory capture** → void on capture of a player-owned factory (refusal already exists). MEDIUM.
3. **Latent battle route** → add the target-side refusal to `resolveBattle` or its route + pin, even while client-unwired. LOW cost, prevents resurrection.
4. **Territory capture** → void on personal capture execution. LOW (war context).
5. **Recon missions / flag steal** → operator policy call recorded in this FID's decision log; no code until decided.

## 6. Audit Record

Not yet run — filed at `created` as an audit deliverable. Loop on operator directive.

## 7. Implementation Record

- **Status:** not-started — audit only; enforcement specs are follow-up FIDs.

## 8. Closure

- **Gates:** [x] every surface enumerated by route+service+client sweep · [x] all claims file:line tool-verified · [x] reachability checked
- **Commit hash (G2):** `<hash>`
- **Staging plan (G1):** `git add dev/fids/FID-20260916-006-protection-parity-audit.md dev/session-summaries/SESSION-2026-09-16-013.md SCOPE.md`
- **Commit message (G8):** `docs(fid): protection parity audit — 3 live gaps (spy sabotage HIGH) + 2 policy calls (FID-20260916-006)`

---

**Final status:** created
