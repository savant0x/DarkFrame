# FID-20260906-003: Admin Panel Full Review

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-003-admin-panel-full-review.md`
**ID:** FID-20260906-003
**Severity:** HIGH (operator control surface; partially broken)
**Status:** created (RED in progress; converges in loop)

---

## 1. Summary

Operator directive: complete review of the admin panel. Post-FID-20260905-001 the admin API
layer is materially healthier (34 endpoints rebuilt, gates unified to `requireAdmin`), but the
panel has never been reviewed **as a whole** — dead tabs, mock remnants, broken workflows, and
the missing `CRON_SECRET` class of silent config failures.

## 2. Findings (RED — verified)

### A1 — Identity chain verified sound (false-alarm checked and closed)
- `players.is_admin` smallint maps via `lib/db/schema/players.ts:61`; live row `fame`
  → `is_admin: 1`; JWT carries `isAdmin` (`app/api/auth/login/route.ts:73`); `requireAdmin`
  reads the claim. Live: `GET /api/admin/stats` → 200 for the owner. **The owner can use the
  panel after re-login** (JWT minted before `is_admin` existed would carry `isAdmin:false` —
  operator should re-login if any 403s appear; noted for the closure email).

### A2 — Panel inventory not yet complete (phase's first task)
- Known-unverified: every tab in `app/admin/AdminView.tsx` against its data route — dead tabs,
  tabs calling rebuilt routes with stale contracts, pagination/search claims.
- Known dead/dubious from prior sessions: `migrate-factory-slots` (one-shot tool exposed as a
  panel action?), `system-reset` (what does it actually reset?), `bot-migration` (rank-gated
  route outside `/admin`), legacy `flag/init` (kept behind admin gate earlier — verify).

### A3 — Cron/config silent failures
- §7.3 of FID-20260905-001: `CRON_SECRET` was unset in prod — admin panel showed nothing
  wrong. Panel needs a health strip: cron reachability, DB connectivity, migration version —
  served by a new admin-only `/api/admin/health` (real checks, no mocks).

### A4 — Audit-trail gaps
- VIP grant/revoke now write `mod_log` (FID-20260905-001 batch 2). Other destructive admin
  actions (ban, unban, system-reset, give-resources) — audit rows verified per-route during
  implementation; any missing get the same `mod_log` treatment.

## 3. Five Questions (RED)

1. **Do nothing?** Operator flies blind on cron/config failures; dead tabs erode trust in the
   panel; destructive actions stay unaudited.
2. **Why now?** Operator directive; admin surface is the control plane for the balance/WMD work.
3. **Who is affected?** Admins only (write side); players indirectly via faster incident response.
4. **Smallest correct change?** Tab-by-tab live drive (preview) + per-tab route census; fix
   broken contracts; add the health strip; audit-row completeness. No redesign.
5. **What must NOT change?** `requireAdmin` gate semantics; the 403-not-404 error contract;
   `mod_log` id conventions.

## 4. GREEN Design (sketch)

- **G1:** tab↔route census script (like dead-wire-audit) — every fetch in `app/admin/*` +
  `components/admin/*` resolves to an existing route export; zero dead calls.
- **G2:** live drive of every tab in the preview as the owner account; each tab's data renders
  real rows; console clean.
- **G3:** `GET /api/admin/health` — checks DB, latest migration applied, cron endpoints
  (self-ping with `CRON_SECRET`), env completeness (`JWT_SECRET`, `DATABASE_URL`,
  `CRON_SECRET`, `STRIPE_SECRET_KEY` presence-only). Panel header renders it.
- **G4:** audit completeness pass — every destructive admin POST/DELETE writes `mod_log`.

## 5. Verification plan (GREEN)

1. Census zero dead calls; tsc 0; tests green.
2. Live preview drive: screenshot each tab with real data; zero console errors.
3. Health strip: break `CRON_SECRET` locally → panel shows the failure; restore → green.
4. Audit rows: perform one ban/unban + one give-resources; verify `mod_log` rows.

## 6. Loop record

- **Pass 1:** A1 checked live and closed (identity chain sound); remaining findings are
  explicitly marked as phase-initial-tasks, not conclusions. Pass-2 delta pending the census
  script (RED completion).

**Status:** created — RED completion is the first loop step.
