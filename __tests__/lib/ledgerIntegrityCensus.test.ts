/**
 * @file __tests__/lib/ledgerIntegrityCensus.test.ts
 * @created 2026-09-24
 * @last_updated 2026-09-25 — check D (the session record) added
 * @overview Pins that the ledger-integrity census gate holds on the real tree,
 *            and drills each of its four failure modes against fixtures — the
 *            live directory is legitimately empty today, so a green run alone
 *            would prove nothing about checks A and B, and every FID closed
 *            on/after the cutover is already recorded, so a green run would prove
 *            nothing about check D either.
 *
 * Fixtures live under `dev/tmp/` (gitignored) but INSIDE this repository, so the
 * census can still resolve cited hashes through the enclosing git repo.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';

const ROOT = process.cwd();
const SCRIPT = join(ROOT, 'scripts', 'ledgerIntegrityCensus.cjs');

const created: string[] = [];

function runLedgerCensus(root?: string): { code: number; out: string } {
  const args = [SCRIPT];
  if (root) args.push('--root', root);
  try {
    return { code: 0, out: execFileSync('node', args, { encoding: 'utf8', cwd: ROOT }) };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const DEFAULT_SCOPE = '# SCOPE\n\n| # | Note |\n| --- | --- |\n';
const STUB_SUMMARY = '# SESSION-2099-01-01-001 — stub\n\nNo ledger FID is cited by this fixture stub.\n';

/**
 * Materialize a `dev/fids` + `SCOPE.md` tree to audit. `summaries` is created by
 * default (a stub that cites nothing) because check D refuses when the session
 * record is missing or empty; pass `null` to omit the directory, or a map to
 * control what the summaries say.
 */
function fixture(
  fids: Record<string, string>,
  scope = DEFAULT_SCOPE,
  opts: { archive?: Record<string, string>; summaries?: Record<string, string> | null } = {},
): string {
  mkdirSync(join(ROOT, 'dev', 'tmp'), { recursive: true });
  const root = mkdtempSync(join(ROOT, 'dev', 'tmp', 'ledger-census-'));
  created.push(root);
  mkdirSync(join(root, 'dev', 'fids', 'archive'), { recursive: true });
  for (const [name, body] of Object.entries(fids)) {
    writeFileSync(join(root, 'dev', 'fids', name), body);
  }
  for (const [name, body] of Object.entries(opts.archive ?? {})) {
    writeFileSync(join(root, 'dev', 'fids', 'archive', name), body);
  }
  if (opts.summaries !== null) {
    const summaries = opts.summaries ?? { 'SESSION-2099-01-01-001.md': STUB_SUMMARY };
    mkdirSync(join(root, 'dev', 'session-summaries'), { recursive: true });
    for (const [name, body] of Object.entries(summaries)) {
      writeFileSync(join(root, 'dev', 'session-summaries', name), body);
    }
  }
  writeFileSync(join(root, 'SCOPE.md'), scope);
  return root;
}

function fid(status: string): string {
  return `# FID-20990101-001 — fixture\n\n**ID:** FID-20990101-001\n**Status:** ${status}\n**Created:** 2099-01-01\n`;
}

/** An archived (closed) FID body — check D reads these, not the live ones. */
function archived(status: string): string {
  return `# FID-20990101-001 — fixture\n\n**ID:** FID-20990101-001\n**Status:** ${status}\n`;
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop() as string;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('ledger-integrity census', () => {
  it('passes on the current tree and names the waived destroyed-by-design hashes', () => {
    const { code, out } = runLedgerCensus();
    expect(code, out).toBe(0);
    expect(out).toContain('ledger census clean');
    // The four dead citations are waived by reason, not by silence.
    expect(out).toContain('destroyed-by-design hash(es) waived by reason');
    expect(out).toContain('af1e61e');
  });

  it('reads the status vocabulary from protocol.config.yaml, not a private copy', () => {
    const { out } = runLedgerCensus();
    expect(out).toContain('allowedStatuses=[created, analyzed, fixed, verified, loop-complete, implemented, no-action, closed]');
    expect(out).toContain('terminalStatuses=[closed, no-action]');
  });

  it('fails a live FID whose status is outside allowed_statuses', () => {
    const root = fixture({ 'FID-20990101-001-fixture.md': fid('bogus-status') });
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(1);
    expect(out).toContain('LIVE FID STATUS OUTSIDE allowed_statuses');
    expect(out).toContain('bogus-status');
    expect(out).toContain('1 live FID(s)');
  });

  it('fails a legacy synonym used as a LIVE status (synonyms are archive-scoped)', () => {
    const root = fixture({ 'FID-20990101-001-fixture.md': fid('converged') });
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(1);
    expect(out).toContain('LIVE FID STATUS OUTSIDE allowed_statuses');
  });

  it('fails a live FID with no parsable Status field', () => {
    const root = fixture({ 'FID-20990101-001-fixture.md': '# FID-20990101-001 — fixture\n' });
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(1);
    expect(out).toContain('(no parsable Status field)');
  });

  it('fails a terminal FID still parked in dev/fids/', () => {
    const root = fixture({ 'FID-20990101-001-fixture.md': fid('closed (2099-01-01, commit abc1234)') });
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(1);
    expect(out).toContain('TERMINAL FIDs STILL IN dev/fids/');
  });

  it('passes a lawful live status', () => {
    for (const status of ['created', 'analyzed', 'fixed', 'verified', 'loop-complete', 'implemented']) {
      const root = fixture({ 'FID-20990101-001-fixture.md': fid(status) });
      const { code, out } = runLedgerCensus(root);
      expect(code, `${status}: ${out}`).toBe(0);
      // Guard against a vacuous pass: the fixture FID must actually be the file
      // under audit, or checks A/B would be passing on an empty directory.
      expect(out, `${status}: ${out}`).toContain('1 live FID(s)');
    }
  });

  it('fails a SCOPE row citing a hash that does not resolve', () => {
    const root = fixture({}, '# SCOPE\n\n| # | Note |\n| --- | --- |\n| 1 | Fixed in `abc1234` |\n');
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(1);
    expect(out).toContain('SCOPE.md HASH CITATIONS THAT DO NOT RESOLVE');
    expect(out).toContain('abc1234');
  });

  it('passes a SCOPE row citing a real commit', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: ROOT }).trim();
    const root = fixture({}, `# SCOPE\n\n| # | Note |\n| --- | --- |\n| 1 | Fixed in \`${head.slice(0, 7)}\` |\n`);
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(0);
  });

  it('ignores hashes inside fenced code blocks (a pasted transcript is not a citation)', () => {
    const root = fixture({}, '# SCOPE\n\n```\n$ git log\nabc1234 some pasted output\n```\n\n| # | Note |\n| --- | --- |\n');
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(0);
  });

  it('refuses rather than passing when the tree has no live FID directory', () => {
    mkdirSync(join(ROOT, 'dev', 'tmp'), { recursive: true });
    const empty = mkdtempSync(join(ROOT, 'dev', 'tmp', 'ledger-census-bare-'));
    created.push(empty);
    const { code, out } = runLedgerCensus(empty);
    expect(code).toBe(2);
    expect(out).toContain('LEDGER CENSUS REFUSED');
  });

  it('refuses rather than passing when SCOPE.md is absent (check C cannot be vacuous)', () => {
    const root = fixture({ 'FID-20990101-001-fixture.md': fid('created') });
    rmSync(join(root, 'SCOPE.md'));
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(2);
    expect(out).toContain('LEDGER CENSUS REFUSED');
    expect(out).toContain('vacuous');
  });

  // ---- D: the session record (added 2026-09-25) -----------------------------

  it('fails a FID closed after the cutover that no session summary cites', () => {
    const root = fixture(
      {},
      DEFAULT_SCOPE,
      { archive: { 'FID-20990101-001-fixture.md': archived('closed (2099-01-01, commit abc1234)') } },
    );
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(1);
    expect(out).toContain('FIDs CLOSED ON/AFTER 2026-09-24 WITH NO SESSION RECORD');
    expect(out).toContain('FID-20990101-001');
  });

  it('passes when a session summary cites the closure', () => {
    const root = fixture(
      {},
      DEFAULT_SCOPE,
      {
        archive: { 'FID-20990101-001-fixture.md': archived('closed (2099-01-01, commit abc1234)') },
        summaries: { 'SESSION-2099-01-01-001.md': '# SESSION-2099-01-01-001 — cites FID-20990101-001\n' },
      },
    );
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(0);
    expect(out).toContain('session record — 1 terminal FID(s) closed on/after 2026-09-24');
  });

  it('fails a post-cutover terminal closure with no date (check D would be unfalsifiable)', () => {
    const root = fixture(
      {},
      DEFAULT_SCOPE,
      { archive: { 'FID-20990101-001-fixture.md': archived('closed') } },
    );
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(1);
    expect(out).toContain('TERMINAL FIDs FILED ON/AFTER 2026-09-24 WITH NO DATED CLOSURE');
  });

  it('reports pre-cutover closures as advisory history, never as violations', () => {
    const root = fixture(
      {},
      DEFAULT_SCOPE,
      {
        archive: {
          // Undated terminal closure, filed before the cutover: history.
          'FID-20260101-001-old.md': archived('closed'),
          // Dated closure before the cutover: also history.
          'FID-20260101-002-older.md': archived('closed (2026-01-01, commit abc1234)'),
        },
      },
    );
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(0);
    expect(out).toContain('predate 2026-09-24 or carry no closure date');
    expect(out).toContain('session record — 0 terminal FID(s) closed on/after 2026-09-24');
  });

  it('refuses rather than passing when the session-summaries directory is absent', () => {
    const root = fixture({ 'FID-20990101-001-fixture.md': fid('created') }, DEFAULT_SCOPE, { summaries: null });
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(2);
    expect(out).toContain('LEDGER CENSUS REFUSED');
    expect(out).toContain('vacuous');
  });

  it('refuses when the summary directory holds no summary at all', () => {
    const root = fixture({ 'FID-20990101-001-fixture.md': fid('created') }, DEFAULT_SCOPE, { summaries: {} });
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(2);
    expect(out).toContain('the defect check D exists for');
  });
});
