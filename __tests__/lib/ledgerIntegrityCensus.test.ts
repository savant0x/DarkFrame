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
    // The dead citations are waived by reason, not by silence. FID-20260927-002:
    // the full list is pinned so silent waiver-list rot fails the suite — these
    // are the 2026-09-03 rewrite-debris hashes CI (a fresh clone) probed absent.
    expect(out).toContain('destroyed-by-design hash(es) waived by reason');
    for (const h of [
      'af1e61e', '23cdc63', '53c1531', '49b5991',
      '2426cf4', 'f7f0921', '049459b', '4674b73', '0e82eb5', '8be0bde', 'de914fa',
    ]) {
      expect(out).toContain(h);
    }
    // The old advisory branch is gone: a present-but-unreachable citation is now
    // fatal (waived entries land in the waived line instead), so a clean run can
// no longer print the advisory wording at all.
    expect(out).not.toContain('exist but are not reachable from HEAD');
    // Check E must have actually run over the real register, not vacuously:
    // the live SCOPE.md carries 137 numbered rows and no duplicate number.
    const rowLine = /(\d+) numbered row\(s\), (\d+) duplicate number\(s\)/.exec(out);
    expect(rowLine, out).not.toBeNull();
    expect(Number(rowLine?.[1])).toBeGreaterThan(100);
    expect(rowLine?.[2]).toBe('0');
  });

  it('fails a citation that exists in the object store but is unreachable from HEAD (a fresh clone sees it as missing)', () => {
    // FID-20260927-002: CI run 36334419960 refused seven SCOPE citations the
    // host resolved as present-but-unreachable objects — the census verdict
    // depended on local gc state. This pin creates exactly that shape: an orphan
    // commit (an object with no ref) cited from a fixture SCOPE.
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: 'fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    };
    const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8', cwd: ROOT }).trim();
    const orphan = execFileSync('git', ['commit-tree', tree, '-m', 'orphan fixture commit (FID-20260927-002)'], {
      encoding: 'utf8', cwd: ROOT, env,
    }).trim();
    const root = fixture({}, `# SCOPE\n\n| # | Note |\n| --- | --- |\n| 1 | Fixed in \`${orphan.slice(0, 7)}\` |\n`);
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(1);
    expect(out).toContain('EXISTS LOCALLY BUT IS NOT REACHABLE FROM HEAD');
    expect(out).toContain('a fresh clone (and CI) sees it as missing');
    expect(out).toContain(orphan.slice(0, 7));
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

  // FID-20260927-004 (SCOPE row 134): this was one `it()` looping six statuses,
  // and each iteration spawns the census as a real node subprocess (~1s). Six
  // sequential spawns need ~6s against vitest's 5s default, so the test passed in
  // isolation and failed under full-suite parallel load — the exact
  // "1 failed | N passed" signature row 134 recorded without ever identifying.
  // Each status is now its own case, so each gets its own timeout budget and a
  // failure names the status that broke instead of the whole loop.
  it.each(['created', 'analyzed', 'fixed', 'verified', 'loop-complete', 'implemented'])(
    'passes a lawful live status: %s',
    (status) => {
      const root = fixture({ 'FID-20990101-001-fixture.md': fid(status) });
      const { code, out } = runLedgerCensus(root);
      expect(code, `${status}: ${out}`).toBe(0);
      // Guard against a vacuous pass: the fixture FID must actually be the file
      // under audit, or checks A/B would be passing on an empty directory.
      expect(out, `${status}: ${out}`).toContain('1 live FID(s)');
    },
  );

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

  it('fails a closure dated before the FID was filed (the cutover cannot be dodged by writing a date)', () => {
    const root = fixture(
      {},
      DEFAULT_SCOPE,
      { archive: { 'FID-20990101-001-fixture.md': archived('closed (2026-01-01, commit abc1234)') } },
    );
    const { code, out } = runLedgerCensus(root);
    expect(code).toBe(1);
    expect(out).toContain('CLOSURES DATED BEFORE THE FID WAS FILED');
    expect(out).toContain('a closure cannot precede the filing');
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

  // ---- E: register row identity and order (added 2026-09-27) ----------------
  //
  // SCOPE.md carried a duplicate row 66 for years — a 2026-09-16 spy-sabotage
  // finding and an unrelated 2026-09-25 CI finding — while three session records
  // cited "row 66" meaning the older one. The census judged SCOPE by hash
  // citation only, so nothing ever noticed.

  it('fails a register that declares the same row number twice (a citation is ambiguous)', () => {
    const root = fixture(
      {},
      '# SCOPE\n\n| # | Item | Date | Status |\n| - | ---- | ---- | ------ |\n' +
        '| 1 | First finding | 2026-09-25 | Closed |\n' +
        '| 1 | An unrelated finding | 2026-09-26 | Closed |\n',
    );
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(1);
    expect(out).toContain('SCOPE.md DUPLICATE ROW NUMBERS');
    expect(out).toContain('row 1 is declared twice');
    // Both lines must be named, so the operator can see WHICH two rows collide.
    expect(out).toMatch(/SCOPE\.md:5 and 6/);
  });

  it('reports an out-of-order row number as advisory, never fatal (a row still resolves by number)', () => {
    // Deliberately inverted, and the live register still carries one such pair
    // (58 above 57) — so this case must NOT red the gate before it is fixed.
    const root = fixture(
      {},
      '# SCOPE\n\n| # | Item | Date | Status |\n| - | ---- | ---- | ------ |\n' +
        '| 2 | Second | 2026-09-25 | Closed |\n' +
        '| 1 | First | 2026-09-26 | Closed |\n',
    );
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(0);
    expect(out).toContain('out-of-order SCOPE row number(s)');
    expect(out).toContain('row 1 (SCOPE.md:6) is printed after row 2 (SCOPE.md:5)');
    expect(out).toContain('ledger census clean');
  });

  it('counts a row whose cell contains an escaped pipe once, at the right number', () => {
    // The row-134 shape: a description cell carrying the literal text
    // `1 failed \| 1338 passed (1339)`. A naive split on `|` shifts every later
    // cell, and an audit reading a fixed column index off such a row read the
    // DATE column as the row's status and reported a defect that did not exist.
    // Here the row must count ONCE, as row 1, with no phantom duplicate and no
    // phantom inversion — the escaped pipe must not be read as a delimiter.
    const root = fixture(
      {},
      '# SCOPE\n\n| # | Item | Date | Status |\n| - | ---- | ---- | ------ |\n' +
        '| 1 | Reported `1 failed \\| 1338 passed (1339)` | 2026-09-27 | Open |\n' +
        '| 2 | A second row | 2026-09-27 | Open |\n',
    );
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(0);
    expect(out).toContain('2 numbered row(s), 0 duplicate number(s)');
    expect(out).not.toContain('out-of-order');
  });

  it('ignores the session-ledger and Operator-Decisions tables when counting register rows', () => {
    // SCOPE.md carries three tables. Only the item register is numbered; the
    // decisions table opens with an ISO date (not `^\\d+$`) and the session ledger
    // opens with prose, so neither may be counted as a row.
    const root = fixture(
      {},
      [
        '# SCOPE',
        '',
        '| # | Item | Date | Status |',
        '| - | ---- | ---- | ------ |',
        '| 1 | The only register row | 2026-09-25 | Closed |',
        '',
        '## Operator Decisions',
        '',
        '| Date | Decision | Disposition |',
        '| ---- | -------- | ----------- |',
        '| 2026-09-01 | A decision was taken | Executed |',
        '',
        '| Session 2026-09-06: a session log line, not a register row. |',
        '',
      ].join('\n'),
    );
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(0);
    expect(out).toContain('1 numbered row(s), 0 duplicate number(s)');
  });

  // ---- F: register row shape (added 2026-09-27) ----------------------------
  //
  // A description cell carrying an UNESCAPED `|` makes the row a row with a
  // phantom column: every later cell shifts, and any reader that indexes by
  // position reads the wrong one. The census counts hash citations, not table
  // shape, so it printed `ledger census clean` over SCOPE row 138 on the day
  // that row shipped with seven structural pipes instead of five. Check F makes
  // the shape fatal, and it found four more such rows the moment it landed.
  const HEADER4 = ['# SCOPE', '', '| # | Item | Date | Status |', '| - | ---- | ---- | ------ |'].join('\n');

  it('fails a register row whose description contains an unescaped pipe', () => {
    // `string|null` — the real shape of SCOPE row 104. A reader indexing cells
    // by position reads the DATE column as the row's status.
    const root = fixture({}, `${HEADER4}\n| 1 | Owner is Factory.owner: string|null | 2026-09-27 | Open |\n`);
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(1);
    expect(out).toContain('MALFORMED REGISTER ROWS');
    expect(out).toContain('row 1');
    expect(out).toContain('6 structural pipe(s)');
  });

  it('fails a register row truncated below every lawful shape', () => {
    // Two structural pipes is neither `| n | text |` nor `| n | text | date | status |`.
    const root = fixture({}, `${HEADER4}\n| 1 |\n`);
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(1);
    expect(out).toContain('MALFORMED REGISTER ROWS');
    expect(out).toContain('2 structural pipe(s)');
  });

  it('accepts the two-column register shape the ledger has always used', () => {
    // SCOPE rows 52-54: the disposition is the description's last sentence, not
    // a column of its own. Three structural pipes, and lawful — a blanket
    // "must be 5" rule would have failed three valid historical rows.
    const root = fixture(
      {},
      `${HEADER4}\n| 1 | Shaped like rows 52-54; the disposition is the last sentence. Status: Closed |\n`,
    );
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(0);
    expect(out).toContain('1 numbered row(s), 0 duplicate number(s), 0 malformed row(s)');
  });

  it('does not count an escaped pipe as a delimiter when judging shape', () => {
    const root = fixture(
      {},
      `${HEADER4}\n| 1 | Reported \`1 failed \\| 1338 passed\`, and that pipe is content | 2026-09-27 | Open |\n`,
    );
    const { code, out } = runLedgerCensus(root);
    expect(code, out).toBe(0);
    expect(out).toContain('0 malformed row(s)');
  });

  it('reports the live register as well-shaped, with a non-vacuous row count', () => {
    // Guard against a vacuous pass: the shape check must actually have run over
    // the real register, which carries 138 rows and no mis-shaped one.
    const { code, out } = runLedgerCensus();
    expect(code, out).toBe(0);
    const m = /(\d+) numbered row\(s\), (\d+) duplicate number\(s\), (\d+) malformed row\(s\)/.exec(out);
    expect(m, out).not.toBeNull();
    expect(Number(m?.[1])).toBeGreaterThan(100);
    expect(m?.[3]).toBe('0');
  });
});
