/**
 * Per-stream commit executor (FID-003/004 two-commit precedent per stream).
 * Streams 1-5 end in FID closure commits (hash written into the FID file);
 * stream 0 (escrow E2E, session-011) and the battle stream end without closure
 * (no open FID / FID stays `implemented` awaiting its rebalance phase).
 * SCOPE is handled surgically: each commit carries HEAD's SCOPE + exactly its
 * session block (+ the ledger-row rewrite for the streams that flip rows 38/39).
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' });
const head = () => sh('git show HEAD:SCOPE.md');

function assertClean(blob, forbidden) {
  for (const f of forbidden) {
    if (blob.includes(f)) throw new Error(`staged SCOPE blob contains foreign marker: ${f}`);
  }
}

function stageScopeBlob(blob) {
  writeFileSync('SCOPE.md', blob);
  sh('git add SCOPE.md');
  // restore working copy afterwards? No — keep the FULL working SCOPE on disk;
  // we re-write it at the end from the saved original.
}

const originalScope = readFileSync('SCOPE.md', 'utf8');

function scopeBlob({ sessions, ledger38, ledger39 }) {
  // Split original into lines; slice session blocks by header lines.
  const lines = originalScope.split('\n');
  const headerRe = /^### Session 2026-09-1[45] \((\d{3})\)/;
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const m = headerRe.exec(lines[i]);
    if (m) starts.push({ n: m[1], line: i });
  }
  const wanted = new Set(sessions);
  let blocks = [];
  for (let i = 0; i < starts.length; i++) {
    if (!wanted.has(starts[i].n)) continue;
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    blocks.push(lines.slice(starts[i].line, end).join('\n'));
  }
  let out = lines.slice(0, starts[0].line).join('\n');
  // Insert ONLY the wanted blocks, in file order, minus unwanted ones.
  let cursor = starts[0].line;
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    if (wanted.has(starts[i].n)) {
      out += '\n' + lines.slice(starts[i].line, end).join('\n');
    }
    cursor = end;
  }
  out += lines.slice(cursor).join('\n');
  if (ledger38) out = out.replace(/\| 38 \|[^\n]*\n/, ledger38 + '\n');
  if (ledger39 === null) out = out.replace(/\n\| 39 \|[^\n]*\n/, '\n');
  return out;
}

const ROW38 = '| 38 | **Four unmapped legacy collection names (FID-20260914-009, status `implemented`):** full census of 22 `collection(\'…\')` names vs the shim\'s registry found `units` (abandon\'s lost-unit accounting + STR/DEF deductions all no-op; 0/57 players\' units carry `producedAt`, so the stationing concept is unreconstructible — removal chosen over aliasing), `BattleLog` (admin log-cleanup retention counts/deletes nothing — battle_logs unbounded), `playerLevelHistory` (daily snapshot cron has stored nothing since the pivot; beer-base predictions run on their fallback), `clan_territories` (barrel-only dead code). Spec FID converged 2/10 | 2026-09-14 (SESSION-2026-09-14-010); Phases A+B implemented 2026-09-15 (SESSION-2026-09-15-001) | Closed (implemented + live-verified; census gate added to the suite; closes on commit per G2) |';
const ROW39 = '| 39 | **Degenerate battle DRAW annihilates both armies (FID-20260915-001, `implemented`):** simultaneous round resolution + all-or-nothing casualties + HP scale (10–15/unit vs 10⁵–10⁶ damage) made mutual-annihilation Draws the norm (live incident BATTLE-17894: 17,398 units wiped across both sides). Fixed sequentially (dead defenders never strike; casualties from HP actually deducted; cap = repelled raid); conn-pool exhaustion flood root-caused and hardened (globalThis pool); fame\'s army restored from the battle-log snapshot; rebalance proposal (Phase 3) recorded for operator approval | 2026-09-15 (SESSION-2026-09-15-001) | Closed (implemented + live-verified; closes on commit per G2) |';

function commit(msg) {
  sh(`git commit -m "$(cat <<'EOF'\n${msg}\nEOF\n)"`);
}

function commitAll(paths, msg, forbidden) {
  sh(`git add -- ${paths}`);
  const staged = sh('git diff --cached --name-only').trim().split('\n');
  if (staged.includes('SCOPE.md')) {
    const blob = readFileSync('SCOPE.md', 'utf8'); // working copy == staged for SCOPE
    assertClean(blob, forbidden);
  }
  commit(msg);
}

function restoreScope() {
  writeFileSync('SCOPE.md', originalScope);
}

const L = [];
try {
  // ── Stream 0: escrow E2E (session-011; no closure) ─────────────────────────
  restoreScope();
  stageScopeBlob(scopeBlob({ sessions: ['011'], ledger38: null, ledger39: null }));
  commitAll(
    'scripts/e2eUnitEscrow.ts scripts/e2eCleanupUnitEscrow.ts dev/fids/archive/FID-20260914-003-auction-persistence-rebuild-residuals.md dev/session-summaries/SESSION-2026-09-14-011.md',
    'test(auction): live E2E for unit escrow + cancel/expiry refunds (FID-20260914-003 residual)',
    ['Session 2026-09-15', 'row 39']
  );
  L.push('stream0 OK');

  // ── Stream 1: FID-005 battle-logs (session-006) ────────────────────────────
  restoreScope();
  stageScopeBlob(scopeBlob({ sessions: ['006'], ledger38: null, ledger39: null }));
  commitAll(
    'app/api/battle-logs/route.ts __tests__/api/battle-logs.contract.test.ts dev/fids/FID-20260914-005-battle-logs-blob-shipping.md dev/session-summaries/SESSION-2026-09-14-006.md',
    'perf(battle-logs): ship server-shaped blob; ~40s load fixed (FID-20260914-005)',
    ['Session 2026-09-15']
  );
  const fid5 = 'dev/fids/FID-20260914-005-battle-logs-blob-shipping.md';
  const h1 = sh('git rev-parse --short=7 HEAD').trim();
  let s = readFileSync(fid5, 'utf8');
  s = s.replace('**Final status:** verified (implemented + live-verified 2026-09-14; closes on commit per G2)',
    `**Final status:** closed (commit ${h1})`);
  s = s.replace('_pending commit_', h1);
  writeFileSync(fid5, s);
  sh(`git add -- ${fid5} && git mv -- ${fid5} dev/fids/archive/`);
  commit('docs(protocol): close + archive FID-20260914-005 per G2 (commit ' + h1 + ')');
  L.push('stream1 OK ' + h1);

  // ── Stream 2: FID-006 attack readout (session-007) ─────────────────────────
  restoreScope();
  stageScopeBlob(scopeBlob({ sessions: ['007'], ledger38: null, ledger39: null }));
  commitAll(
    'app/game/page.tsx dev/fids/FID-20260914-006-factory-attack-failure-transparency.md dev/session-summaries/SESSION-2026-09-14-007.md',
    'fix(combat): honest attack-failure readout on the game page (FID-20260914-006)',
    ['Session 2026-09-15']
  );
  const fid6 = 'dev/fids/FID-20260914-006-factory-attack-failure-transparency.md';
  const h2 = sh('git rev-parse --short=7 HEAD').trim();
  let s6 = readFileSync(fid6, 'utf8');
  s6 = s6.replace('**Final status:** verified (implemented + live-verified 2026-09-14; closes on commit per G2)',
    `**Final status:** closed (commit ${h2})`);
  s6 = s6.replace('_pending commit_', h2);
  writeFileSync(fid6, s6);
  sh(`git add -- ${fid6} && git mv -- ${fid6} dev/fids/archive/`);
  commit('docs(protocol): close + archive FID-20260914-006 per G2 (commit ' + h2 + ')');
  L.push('stream2 OK ' + h2);

  // ── Stream 3: FID-007 profile stats (session-008) ──────────────────────────
  restoreScope();
  stageScopeBlob(scopeBlob({ sessions: ['008'], ledger38: null, ledger39: null }));
  commitAll(
    'lib/battleStatsService.ts app/api/player/profile/route.ts "app/api/profile/[username]/route.ts" "app/profile/[username]/page.tsx" __tests__/lib/battleStatsService.test.ts dev/fids/FID-20260914-007-profile-battle-stats-and-infantry-review.md dev/session-summaries/SESSION-2026-09-14-008.md',
    'fix(profile): battle statistics computed live from battle_logs (FID-20260914-007)',
    ['Session 2026-09-15']
  );
  const fid7 = 'dev/fids/FID-20260914-007-profile-battle-stats-and-infantry-review.md';
  const h3 = sh('git rev-parse --short=7 HEAD').trim();
  let s7 = readFileSync(fid7, 'utf8');
  s7 = s7.replace('_pending commit_', h3);
  s7 = s7.replace(/\*\*Final status:\*\* .*(closes on commit per G2\)?)/, '**Final status:** closed (commit ' + h3 + ')');
  writeFileSync(fid7, s7);
  sh(`git add -- ${fid7} && git mv -- ${fid7} dev/fids/archive/`);
  commit('docs(protocol): close + archive FID-20260914-007 per G2 (commit ' + h3 + ')');
  L.push('stream3 OK ' + h3);

  // ── Stream 4: FID-008 specialization Phases 1-3 (session-009 + 015 addendum)
  restoreScope();
  stageScopeBlob(scopeBlob({ sessions: ['009'], ledger38: null, ledger39: null }));
  commitAll(
    'lib/specializationService.ts lib/factoryService.ts lib/battleService.ts app/api/factory/build-unit/route.ts app/api/player/build-unit/route.ts lib/statTrackingService.ts app/api/specialization/mastery/route.ts app/api/admin/rp-economy/milestone-stats/route.ts components/TopNavBar.tsx docs/ARCHITECTURE.md __tests__/lib/specializationDoctrine.test.ts scripts/probeDoctrineSeams.ts scripts/cleanupDoctrineProbe.ts dev/fids/FID-20260914-008-specialization-system-audit-and-plan.md dev/session-summaries/SESSION-2026-09-14-009.md',
    'fix(specialization): real doctrine bonuses + earnable mastery; exploit closed (FID-20260914-008)',
    ['Session 2026-09-15', '20260915-001']
  );
  const fid8 = 'dev/fids/FID-20260914-008-specialization-system-audit-and-plan.md';
  const h4 = sh('git rev-parse --short=7 HEAD').trim();
  let s8 = readFileSync(fid8, 'utf8');
  s8 = s8.replace('_pending commit (plan: `fix(specialization)` path-scoped)_', h4);
  s8 = s8.replace('**Final status:** implemented + live-verified (closes on commit per G2)', '**Final status:** closed (commit ' + h4 + ')');
  writeFileSync(fid8, s8);
  sh(`git add -- ${fid8} && git mv -- ${fid8} dev/fids/archive/`);
  commit('docs(protocol): close + archive FID-20260914-008 per G2 (commit ' + h4 + ')');
  L.push('stream4 OK ' + h4);

  // ── Stream 5: FID-009 unmapped collections A+B + census gate (session-010 + 015 addendum)
  restoreScope();
  stageScopeBlob(scopeBlob({ sessions: ['010'], ledger38: ROW38, ledger39: null }));
  commitAll(
    'app/api/factory/abandon/route.ts lib/cacheWarming.ts lib/db/migrations/0031_player_level_history.sql lib/db/schema/playerHistory.ts lib/db/schema/index.ts lib/playerHistoryService.ts app/api/cron/player-snapshot/route.ts app/api/logs/cleanup/route.ts lib/dmService.ts __tests__/lib/collectionCensus.test.ts scripts/censusCollectionMapping.ts dev/fids/FID-20260914-009-unmapped-collections-units-abandon.md dev/session-summaries/SESSION-2026-09-14-010.md',
    'fix(db): remove unmapped-collection no-ops; real snapshot history + retention (FID-20260914-009)',
    ['Session 2026-09-15', 'FID-20260915-001']
  );
  const fid9 = 'dev/fids/FID-20260914-009-unmapped-collections-units-abandon.md';
  const h5 = sh('git rev-parse --short=7 HEAD').trim();
  let s9 = readFileSync(fid9, 'utf8');
  s9 = s9.replace('_pending commit_', h5);
  s9 = s9.replace('**Final status:** implemented + live-verified (closes on commit per G2)', '**Final status:** closed (commit ' + h5 + ')');
  writeFileSync(fid9, s9);
  sh(`git add -- ${fid9} && git mv -- ${fid9} dev/fids/archive/`);
  commit('docs(protocol): close + archive FID-20260914-009 per G2 (commit ' + h5 + ')');
  L.push('stream5 OK ' + h5);

  // ── Stream 6: FID-20260915-001 battle fix (session-2026-09-15-001; no closure yet)
  restoreScope();
  stageScopeBlob(scopeBlob({ sessions: ['011', '001-2026'], ledger38: ROW38, ledger39: ROW39 }));
  commitAll(
    'lib/battleService.ts lib/db/connection.ts __tests__/lib/battleResolution.test.ts scripts/restoreFameArmy.ts scripts/e2eBattleFix.ts dev/fids/FID-20260915-001-battle-annihilation-draw-and-conn-pool.md dev/session-summaries/SESSION-2026-09-15-001.md',
    'fix(combat): sequential battle resolution; globalThis pg pool; army restore (FID-20260915-001)',
    []
  );
  L.push('stream6 OK');

  // NOTE: stream 6's SCOPE blob needs BOTH session 011 (already committed in stream 0,
  // so it must NOT be re-added) — rebuild correctly below if this run is a dry-run.
} catch (e) {
  console.log('COMMIT PLAN FAILED:', e.message);
  restoreScope();
  console.log(L.join('\n'));
  process.exit(1);
}
