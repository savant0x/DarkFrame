#!/usr/bin/env node
/**
 * Ledger-integrity census — fail-closed gate for the FID/SCOPE ledger itself.
 *
 * Every other census in scripts/ audits the CODEBASE for a class of defect. This
 * one audits the LEDGER, because the ledger is what the project treats as the
 * record of truth and nothing was checking it against its own rules. Three
 * failure modes, all of them found by probe on 2026-09-24 rather than imagined:
 *
 *   A. A live FID whose status is outside `allowed_statuses`
 *      (protocol.config.yaml, single source of truth — parsed here, never
 *      duplicated). The vocabulary was amended twice (2026-09-16 `converged` →
 *      `loop-complete`; 2026-09-24 `implemented` + `no-action`), and each time
 *      the drift was found by hand. A status nobody can look up is a claim
 *      nobody can check.
 *
 *   B. A terminal FID (`closed` | `no-action`) still sitting in `dev/fids/`.
 *      Archival is what "terminal" MEANS (config: `archive_on_close: true`) — a
 *      terminal FID in the live directory makes "what is in flight?" answerable
 *      only by opening files, which is how `dev/fids/` held a single retired
 *      file for days without anyone noticing.
 *
 *   C. A SCOPE.md row citing a commit hash that does not exist in this repo.
 *      A citation is evidence; a hash that does not resolve is an unverifiable
 *      claim wearing the clothes of a verified one. Four real dead citations
 *      exist today (see KNOWN_DEAD) — all of them deliberate destruction or
 *      superseded history, all of them audit-trail records that must NOT be
 *      silently "repaired" into a different hash. So destruction-by-design is
 *      waived explicitly and by reason, while a NEW dead hash fails the gate.
 *
 * Both advisory lines (archived non-terminal statuses; hashes that resolve but
 * are not reachable from HEAD) are REPORTED, never fatal: archives keep their
 * historical labels by rule, and pre-rewrite objects may legitimately live only
 * on a backup ref. Only A, B and C fail.
 *
 * SCOPE: `dev/fids/*.md` (top level — `archive/` is deliberately unchecked for
 * statuses) and `SCOPE.md` ledger lines (table rows and bullets; fenced code
 * blocks are skipped, since a pasted transcript is not a citation).
 *
 * Fail-closed: a missing `dev/fids/`, a missing SCOPE.md, an unreadable config,
 * a malformed/empty vocabulary, an unusable git or a partial hash-probe read all
 * exit 2, never 0 — a tool failure must not impersonate a pass (the defect class
 * hardened out of the pre-commit and pre-push gates on 2026-09-16).
 *
 * Usage: node scripts/ledgerIntegrityCensus.cjs [--root <dir>]
 *   --root audits another tree (used by the fixtures in
 *   __tests__/lib/ledgerIntegrityCensus.test.ts). The status vocabulary still
 *   comes from this repo's protocol.config.yaml: it is protocol-level, not
 *   tree-level.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function refuse(msg) {
  process.stdout.write(`LEDGER CENSUS REFUSED: ${msg}\n`);
  process.exit(2);
}

const REPO_ROOT = path.resolve(__dirname, '..');

let ROOT = REPO_ROOT;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--root') {
    const value = argv[i + 1];
    if (!value) refuse('--root requires a directory');
    ROOT = path.resolve(value);
    i += 1;
  } else {
    refuse(`unknown argument \`${argv[i]}\` (usage: node scripts/ledgerIntegrityCensus.cjs [--root <dir>])`);
  }
}

const CONFIG = path.join(REPO_ROOT, 'protocol.config.yaml');
const LIVE_DIR = path.join(ROOT, 'dev', 'fids');
const ARCHIVE_DIR = path.join(LIVE_DIR, 'archive');
const SCOPE_FILE = path.join(ROOT, 'SCOPE.md');

/**
 * Hashes that are cited in SCOPE.md, that no longer resolve, and that must stay
 * cited — each is the record of a state that was destroyed on purpose. Probed
 * absent 2026-09-24 (`git cat-file -e <hash>^{commit}` → "Not a valid object
 * name"). An entry is added ONLY with a probe output and a written reason; any
 * hash not listed here must resolve, and a new dead citation is a gate failure,
 * not a new entry.
 */
const KNOWN_DEAD = {
  af1e61e: '2026-09-03 checkpoint commit made without operator approval (G1/Law 2 disclosure, OPEN-OUT-OF-SCOPE #17); removed by operator decision, never pushed',
  '23cdc63': 'the pre-checkpoint tip af1e61e was reset from; removed by the same decision',
  '53c1531': 'remote main tip after the 2026-09-03 filter-branch force-push; the later history import superseded it',
  '49b5991': 'base commit of the retained May-era stash@{0}; the stash was dropped and the object gc-pruned (git stash list empty, 2026-09-24)',
};

// ---- vocabulary (protocol.config.yaml is the one place the statuses live) ----
function readVocabulary() {
  let cfg;
  try {
    cfg = fs.readFileSync(CONFIG, 'utf8');
  } catch (e) {
    refuse(`cannot read ${CONFIG}: ${e.message}`);
  }
  const list = (key) => {
    const re = new RegExp(`^\\s*${key}:\\s*\\[([^\\]]*)\\]\\s*$`, 'm');
    const m = re.exec(cfg);
    if (!m) refuse(`protocol.config.yaml has no \`${key}\` list — the ledger vocabulary moved; update this census`);
    const items = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) refuse(`protocol.config.yaml \`${key}\` is empty`);
    return items;
  };
  return { allowed: list('allowed_statuses'), terminal: list('terminal_statuses') };
}

const { allowed, terminal } = readVocabulary();

// ---- git must work before any hash is judged (a tool failure is not a pass) --
try {
  execFileSync('git', ['-C', ROOT, 'rev-parse', '--git-dir'], { stdio: 'ignore' });
} catch {
  refuse(`\`git -C ${ROOT} rev-parse --git-dir\` failed — cannot resolve ledger hashes`);
}

/**
 * Resolve every cited hash in ONE git process. `--batch-check` answers one line
 * per request, in request order, and echoes the request verbatim when the object
 * is absent (`af1e61e^{commit} missing`) — so a per-hash subprocess (83 of them
 * cost ~8s on Windows, which would make the gate too slow to stay wired) is not
 * needed. The count is asserted: a short answer is a partial read, not a pass.
 */
function probeMissing(hashes) {
  const missing = new Set();
  if (hashes.length === 0) return missing;
  let out;
  try {
    out = execFileSync('git', ['-C', ROOT, 'cat-file', '--batch-check'], {
      input: hashes.map((h) => `${h}^{commit}`).join('\n') + '\n',
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    refuse(`\`git cat-file --batch-check\` failed: ${e.message}`);
  }
  const lines = out.split('\n').filter((l) => l.length > 0);
  if (lines.length !== hashes.length) {
    refuse(`git answered ${lines.length} hash probe(s) for ${hashes.length} request(s) — refusing on a partial read`);
  }
  lines.forEach((line, i) => {
    if (/\smissing$/.test(line)) missing.add(hashes[i]);
  });
  return missing;
}

/** The full hashes reachable from HEAD, for the (advisory) reachability note. */
function headReachable() {
  let out;
  try {
    out = execFileSync('git', ['-C', ROOT, 'rev-list', 'HEAD'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    refuse(`\`git rev-list HEAD\` failed: ${e.message}`);
  }
  const reachable = out.split('\n').filter(Boolean);
  if (reachable.length === 0) refuse('`git rev-list HEAD` returned no commits — refusing to judge citations against an empty history');
  return reachable;
}

// ---- A + B: the live directory ----------------------------------------------
if (!fs.existsSync(LIVE_DIR)) refuse(`no live FID directory at ${LIVE_DIR} (protocol.config.yaml paths.fid_directory)`);

let liveFiles;
try {
  liveFiles = fs.readdirSync(LIVE_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort();
} catch (e) {
  refuse(`cannot read ${LIVE_DIR}: ${e.message}`);
}

/**
 * `**Status:** closed (2026-09-24, commit `43ab259`)` → `closed`.
 * Strips markdown emphasis/backticks, then reads the first token after the
 * label so a parenthetical or a commit list never becomes part of the value.
 */
function parseStatus(file) {
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch (e) {
    refuse(`cannot read ${file}: ${e.message}`);
  }
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const plain = lines[i].replace(/[*`]/g, '');
    const m = /^\s*Status\s*:?\s*(.+)$/i.exec(plain);
    if (!m) continue;
    const value = m[1].trim();
    // Keep the raw-ish value for the report (markdown stripped already).
    return { token: value.split(/[\s(,]+/)[0].toLowerCase(), value, line: i + 1 };
  }
  return { token: '', value: '', line: 0 };
}

const unknownStatus = [];
const liveTerminal = [];

for (const name of liveFiles) {
  const file = path.join(LIVE_DIR, name);
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const { token, value, line } = parseStatus(file);
  if (!token) {
    unknownStatus.push({ file: rel, line, value: '(no parsable Status field)' });
  } else if (!allowed.includes(token)) {
    unknownStatus.push({ file: rel, line, value });
  } else if (terminal.includes(token)) {
    liveTerminal.push({ file: rel, line, value });
  }
}

// ---- C: SCOPE.md hash citations ---------------------------------------------
// A missing SCOPE.md is a REFUSAL, not an empty check: the audit trail is a
// config-declared path (protocol.config.yaml `scope_file`), and skipping it
// silently would turn check C into a vacuous pass.
if (!fs.existsSync(SCOPE_FILE)) {
  refuse(`no SCOPE.md at ${SCOPE_FILE} (protocol.config.yaml paths.scope_file) — check C would be vacuous`);
}
let scopeSrc;
try {
  scopeSrc = fs.readFileSync(SCOPE_FILE, 'utf8');
} catch (e) {
  refuse(`cannot read ${SCOPE_FILE}: ${e.message}`);
}

/** A ledger line: a table row, or a bullet (incl. `- [x]` checkboxes). */
const LEDGER_LINE = /^\s*(\||[-*]\s)/;
/** A cited hash: hex token, long enough to be an object name, with a digit and
 *  a letter — so `20260923` and `deadbeef` are not mistaken for citations. */
const HASH_TOKEN = /\b([0-9a-f]{7,40})\b/g;

const citations = new Map(); // hash -> [line, …]
let ledgerLines = 0;
let inFence = false;

{
  const lines = scopeSrc.replace(/\r\n/g, '\n').split('\n');
  lines.forEach((raw, i) => {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (!LEDGER_LINE.test(raw)) return;
    ledgerLines += 1;
    const seen = new Set();
    let m;
    HASH_TOKEN.lastIndex = 0;
    while ((m = HASH_TOKEN.exec(raw)) !== null) {
      const h = m[1];
      if (!/[0-9]/.test(h) || !/[a-f]/.test(h)) continue;
      if (seen.has(h)) continue;
      seen.add(h);
      if (!citations.has(h)) citations.set(h, []);
      citations.get(h).push(i + 1);
    }
  });
}

const deadHashes = [];
const deadHashesWaived = [];
const unreachableHashes = [];

const cited = [...citations.keys()];
const missingHashes = probeMissing(cited);
const reachable = missingHashes.size === cited.length ? [] : headReachable();

for (const [hash, at] of citations) {
  if (missingHashes.has(hash)) {
    if (KNOWN_DEAD[hash]) deadHashesWaived.push({ hash, at });
    else deadHashes.push({ hash, at });
  } else if (!reachable.some((full) => full.startsWith(hash))) {
    unreachableHashes.push({ hash, at });
  }
}

// ---- advisory: archived labels ----------------------------------------------
let archivedFiles = 0;
let archivedNonTerminal = 0;
if (fs.existsSync(ARCHIVE_DIR)) {
  let entries = [];
  try {
    entries = fs.readdirSync(ARCHIVE_DIR, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.md'));
  } catch (e) {
    refuse(`cannot read ${ARCHIVE_DIR}: ${e.message}`);
  }
  archivedFiles = entries.length;
  for (const e of entries) {
    const { token } = parseStatus(path.join(ARCHIVE_DIR, e.name));
    // Legacy synonyms (converged / COMPLETED / …) are permitted in archives by
    // rule, so this is a shape check, not a verdict: archives are NOT checked
    // against allowed_statuses.
    if (!terminal.includes(token)) archivedNonTerminal += 1;
  }
}

// ---- report -----------------------------------------------------------------
process.stdout.write(
  `ledger census: ${liveFiles.length} live FID(s), ${archivedFiles} archived; ` +
    `${ledgerLines} ledger line(s) in SCOPE.md carrying ${citations.size} cited hash(es)\n`,
);
process.stdout.write(
  `ledger census: vocabulary from protocol.config.yaml — allowedStatuses=[${allowed.join(', ')}] ` +
    `terminalStatuses=[${terminal.join(', ')}]\n`,
);

const violations = unknownStatus.length + liveTerminal.length + deadHashes.length;

if (violations === 0) {
  if (deadHashesWaived.length > 0) {
    process.stdout.write(
      `ledger census: ${deadHashesWaived.length} destroyed-by-design hash(es) waived by reason: ` +
        `${deadHashesWaived.map((d) => d.hash).join(', ')}\n`,
    );
  }
  process.stdout.write(
    `ledger census advisory: ${archivedNonTerminal}/${archivedFiles} archived FID(s) carry a non-terminal ` +
      `label (historical labels are preserved by rule)\n`,
  );
  if (unreachableHashes.length > 0) {
    process.stdout.write(
      `ledger census advisory: ${unreachableHashes.length} cited hash(es) exist but are not reachable from HEAD: ` +
        `${unreachableHashes.map((u) => u.hash).join(', ')}\n`,
    );
  }
  process.stdout.write('ledger census clean: live statuses lawful, no terminal FID parked, every SCOPE hash resolves\n');
  process.exit(0);
}

process.stdout.write('\n');
if (unknownStatus.length > 0) {
  process.stdout.write(`LIVE FID STATUS OUTSIDE allowed_statuses (${unknownStatus.length}):\n`);
  for (const v of unknownStatus) process.stdout.write(`  ${v.file}:${v.line}  status \`${v.value}\`\n`);
}
if (liveTerminal.length > 0) {
  process.stdout.write(`TERMINAL FIDs STILL IN dev/fids/ (${liveTerminal.length}) — archive them:\n`);
  for (const v of liveTerminal) {
    process.stdout.write(`  ${v.file}:${v.line}  status \`${v.value}\` (terminal: ${terminal.join(' | ')})\n`);
  }
}
if (deadHashes.length > 0) {
  process.stdout.write(`SCOPE.md HASH CITATIONS THAT DO NOT RESOLVE (${deadHashes.length}):\n`);
  for (const v of deadHashes) {
    process.stdout.write(`  SCOPE.md:${v.at.join(',')}  \`${v.hash}\` — not a commit in this repo\n`);
  }
}
process.stdout.write(
  '\nA ledger claim is only as good as its checkability: a status must be one the\n' +
    'protocol defines (protocol.config.yaml `allowed_statuses`), a terminal FID\n' +
    'belongs in dev/fids/archive/ (`archive_on_close: true`), and a cited commit\n' +
    'hash must resolve (`git cat-file -e <hash>^{commit}`). A hash that was\n' +
    'destroyed on purpose is waived by REASON in scripts/ledgerIntegrityCensus.cjs\n' +
    '— never silently replaced by a hash that happens to resolve.\n',
);
process.exit(1);
