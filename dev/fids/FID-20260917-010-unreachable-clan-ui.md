# FID-20260917-010 — Unreachable clan UI: mount AlliancePanel + enable the dead research tab

**Status:** `loop-complete (filed + implemented same session, on operator directive)`
**Session:** 2026-09-17 (053)
**Origin:** Product-remainder survey (session 052, row 87). Operator chose
"Alliance FID first" from the recommended order.

## 1. Goal (two surfaces, one disease)

UI exists but no player can reach it:

1. **AlliancePanel mounted nowhere.** Complete diplomacy UI (propose/accept/
   break + 4 contract types) + FIVE live routes (`app/api/clan/alliance/*`:
   list/create/break + contract + alliances) + services + schema — zero
   importers. An entire system, invisible.
2. **FID-20260916-012's ClanResearchPanel is mounted-but-unreachable.** Its
   only mount lives in ClanPanel's research tab — whose TabButton carries a
   bare `disabled` (:371). The FID-012 mount was dead on arrival. Discovered
   during THIS FID's mount-surface probe (Law 16: the census can't catch
   mount-level unreachability — routes exist, fetches exist, tabs don't open).

## 2. Loop decisions (resolved before implementation)

- **Mount surface: ClanPanel** (`components/clan/ClanPanel.tsx`, the /clan
  page surface — the one the top-nav clan badge routes to). Its inner
  ClanManagementView carries the tab system; the standalone
  `components/clan/ClanManagementView.tsx` (game-page sidebar view, 'chat'
  tab, no social/research) is a DIFFERENT component sharing the name —
  left untouched this FID.
- **New tab `alliances`** (Handshake icon), placed after Social, before
  Research. ClanTab type extended.
- **Props wiring, zero API changes:** full five-prop contract honored —
  `clanId` (existing idiom: `clanData._id?.toString() || player.clanId ||
  ''`), `playerId` = `player.username`, `role` = existing `playerRole`,
  `clanName` = `clanData.name`, `treasuryMetal` =
  `clanData.bank?.treasury?.metal ?? 0` — verified mapped through
  `rowToClan` (clanService :89-93) from `bankTreasuryMetal`, so the
  sanctioned `/api/clan/[id]` payload already carries it (FID-006's route).
  (First cut passed only three props; tsc TS2739 on both call sites — the
  panel's interface demands all five. Gate did its job.)
- **Research tab: remove the bare `disabled`** — the mount behind it is
  FID-012's verified panel; the flag made that FID's work unreachable.
- **Pin upgrade over FID-012/013 precedent:** those shipped without
  mount-level render pins — a gap this FID closes with a jsdom render pin
  that clicks the new tab through the REAL ClanPanel (mocked GameContext +
  fetch only) and asserts AlliancePanel's content renders.

## 3. Implementation

`components/clan/ClanPanel.tsx`:
- Import `Handshake` (lucide) + `AlliancePanel` (`../AlliancePanel`).
- ClanTab: + `'alliances'`.
- TabButton "Alliances" after Social, not disabled.
- Research TabButton: `disabled` removed.
- Tab content: `{activeTab === 'alliances' && <AlliancePanel clanId=… role={playerRole} treasuryMetal={clanData.bank?.treasury?.metal ?? 0} />}`.

## 4. Pins (`__tests__/components/ClanPanelAllianceMount.test.tsx`)

1. **Mount pin (the regression pin):** render real ClanPanel (GameContext
   mocked: player with clanId; fetch mocked: sanctioned `{success, clan}`
   fixture incl. bank.treasury.metal) → click "Alliances" tab →
   AlliancePanel renders ("Propose Alliance" visible).
2. **Reachability pin:** the "Research" tab button is NOT disabled.
3. **Panel-shape pin:** AlliancePanel renders standalone with the wired
   props (guards future prop drift on clanId/role/treasuryMetal).

## 5. Verification

Pins 3/3 under jsdom (render the REAL ClanPanel; only GameContext + fetch
mocked; fixture built from ClanPanel's actual read set incl. level/settings
— the first fixture crashed ClanHeader on level.currentLevel, the crash
proving the mount pin renders deep enough to matter) · census exit 0 ·
tsc 0 (after honoring the five-prop interface) · eslint 0 · full suite
1020+1skip.

## 6. Notes

- `clanName`/`playerId` are destructured away by the panel today (unused
  inside), but the declared interface requires them — passed truthfully
  rather than loosening the contract.
- PlayerLogPanel test is the house render-pin idiom (jsdom + RTL).

## 8. Closure

- **Gates:** — filled at closure on operator go-ahead.
- **Commit hash (G2):** — filled at closure.
- **Post-commit:** FID archived; SCOPE row 88 → Closed; CHANGELOG; VERSION.
