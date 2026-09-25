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
 *   D. A FID closed on/after RECORD_FROM that no session summary cites — plus a
 *      post-cutover terminal FID with no dated closure, which would make the
 *      check unfalsifiable. Found 2026-09-25 by probing rather than trusting the
 *      ledger's account of itself: four FID closures and nine commits shipped on
 *      2026-09-24 (releases 0.0.33-0.0.35 — the ledger census, the lint gate, the
 *      typecheck and suite gates, and CI running the same chain) with no session
 *      summary at all, and `grep -n session-summaries` over `.githooks/*`,
 *      `.github/workflows/*.yml` and `scripts/*.cjs` exited 1 — NOTHING read the
 *      directory, so a green chain and a missing record coexisted. The directory
 *      is where Law 8 lives (`dev/session-summaries/README.md`) and where the FID
 *      auto-archive rule says to log the archival (`dev/echo-v0.1.2-single-agent.md`
 *      "Log the archival in the session summary").
 *
 * The advisory lines (archived non-terminal statuses; hashes that resolve but are
 * not reachable from HEAD; terminal closures that PREDATE the session-record
 * cutover) are REPORTED, never fatal: archives keep their historical labels by
 * rule, pre-rewrite objects may legitimately live only on a backup ref, and the
 * pre-cutover record cannot be retroactively demanded by a gate — the 2026-09-19 …
 * 09-22 span (71 commits, releases 0.0.13-0.0.31) is an OPEN operator decision
 * (SCOPE.md row 124), not something this check may silently declare a violation.
 * Only A, B, C and D fail.
 *
 * SCOPE: `dev/fids/*.md` (top level — `archive/` is deliberately unchecked for
 * statuses, but IS checked for session records), `dev/session-summaries/*.md`, and
 * `SCOPE.md` ledger lines (table rows and bullets; fenced code blocks are skipped,
 * since a pasted transcript is not a citation).
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
const SUMMARY_DIR = path.join(ROOT, 'dev', 'session-summaries');

/**
 * The date from which a terminal FID must be cited by a session summary.
 *
 * 2026-09-24 is the first day for which the record is demonstrably complete: the
 * timestamp batch (`SESSION-2026-09-24-001`) and the gate campaign
 * (`SESSION-2026-09-24-002`) both have summaries, and every FID closed that day is
 * cited by one (probed 2026-09-25: 8/8). Choosing a later date would exempt
 * closures that ARE recorded and weaken the check for nothing; choosing an earlier
 * one would fail history the gate has no business rewriting — FIDs closed
 * 2026-09-19 … 09-22 have no summary because the session-record step was skipped
 * for six days, and "retro-file that span or start clean" is an operator decision
 * (SCOPE.md row 124), not a gate verdict.
 */
const RECORD_FROM = '2026-09-24';

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
    // `closed (2026-09-24, commit `43ab259`)` → the closure date, when the
    // record states one. The convention is `<status> (YYYY-MM-DD, …)`; an absent
    // date is not guessed from git history, because the point of check D is that
    // the record must SAY when it closed.
    const dated = /\b(\d{4}-\d{2}-\d{2})\b/.exec(value);
    // Keep the raw-ish value for the report (markdown stripped already).
    return {
      token: value.split(/[\s(,]+/)[0].toLowerCase(),
      value,
      date: dated ? dated[1] : '',
      line: i + 1,
    };
  }
  return { token: '', value: '', date: '', line: 0 };
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

// ---- D: the session record --------------------------------------------------
// Fail-closed on the INPUT, not on the verdict: a missing or empty
// dev/session-summaries/ would make check D vacuously true, which is the class
// this project hardened out of its hooks (an absent tool is not a pass).
if (!fs.existsSync(SUMMARY_DIR)) {
  refuse(`no ${SUMMARY_DIR} (the session record the auto-archive rule writes to) — check D would be vacuous`);
}
let summaryNames;
try {
  summaryNames = fs.readdirSync(SUMMARY_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => e.name)
    .sort();
} catch (e) {
  refuse(`cannot read ${SUMMARY_DIR}: ${e.message}`);
}
if (summaryNames.length === 0) {
  refuse(`no session summary in ${SUMMARY_DIR} — a closure with no session record is the defect check D exists for`);
}
const summaryTexts = summaryNames.map((name) => {
  try {
    return { name, text: fs.readFileSync(path.join(SUMMARY_DIR, name), 'utf8') };
  } catch (e) {
    refuse(`cannot read ${path.join(SUMMARY_DIR, name)}: ${e.message}`);
  }
});

// ---- advisory: archived labels ----------------------------------------------
let archivedFiles = 0;
let archivedNonTerminal = 0;
const noSessionRecord = []; // fatal: closed on/after RECORD_FROM, uncited
const undatedClosure = []; // fatal: filed on/after RECORD_FROM, terminal, no date
const closureBeforeFiling = []; // fatal: a closure dated before the FID was filed
let recordChecked = 0;
let recordHistory = 0;
if (fs.existsSync(ARCHIVE_DIR)) {
  let entries = [];
  try {
    entries = fs.readdirSync(ARCHIVE_DIR, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.md'));
  } catch (e) {
    refuse(`cannot read ${ARCHIVE_DIR}: ${e.message}`);
  }
  archivedFiles = entries.length;
  for (const e of entries) {
    const { token, value, date } = parseStatus(path.join(ARCHIVE_DIR, e.name));
    // Legacy synonyms (converged / COMPLETED / …) are permitted in archives by
    // rule, so this is a shape check, not a verdict: archives are NOT checked
    // against allowed_statuses.
    if (!terminal.includes(token)) {
      archivedNonTerminal += 1;
      continue;
    }
    const rel = `dev/fids/archive/${e.name}`;
    const idMatch = /^(FID-\d{4})(\d{2})(\d{2})-(\d{3})/.exec(e.name);
    const filedDate = idMatch ? `${idMatch[1].slice(4)}-${idMatch[2]}-${idMatch[3]}` : '';
    const fidId = idMatch ? `${idMatch[1]}${idMatch[2]}${idMatch[3]}-${idMatch[4]}` : '';
    if (!date) {
      // A post-cutover closure with no date cannot be judged at all, and leaving
      // it unjudged is how a check becomes decorative — so it fails instead.
      if (filedDate && filedDate >= RECORD_FROM) undatedClosure.push({ file: rel, value });
      else recordHistory += 1;
      continue;
    }
    // A closure cannot predate the filing — the one cheap sanity check that keeps
    // the date from being written to dodge the cutover (probed 2026-09-25: 0 of 36
    // dated closures in the real archive violate it).
    if (filedDate && date < filedDate) {
      closureBeforeFiling.push({ file: rel, value, date, filedDate });
      continue;
    }
    if (date < RECORD_FROM) {
      recordHistory += 1;
      continue;
    }
    const cited = fidId ? summaryTexts.some((s) => s.text.includes(fidId)) : false;
    if (!cited) noSessionRecord.push({ file: rel, id: fidId || e.name, value, date });
    else recordChecked += 1;
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

const violations =
  unknownStatus.length +
  liveTerminal.length +
  deadHashes.length +
  noSessionRecord.length +
  undatedClosure.length +
  closureBeforeFiling.length;

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
  process.stdout.write(
    `ledger census: session record — ${recordChecked} terminal FID(s) closed on/after ${RECORD_FROM} cited by ` +
      `${summaryNames.length} session summary file(s)\n`,
  );
  if (recordHistory > 0) {
    process.stdout.write(
      `ledger census advisory: ${recordHistory} terminal archived FID(s) predate ${RECORD_FROM} or carry no ` +
        `closure date (history, not demanded retroactively — the 2026-09-19..09-22 span is an open decision, SCOPE row 124)\n`,
    );
  }
  if (unreachableHashes.length > 0) {
    process.stdout.write(
      `ledger census advisory: ${unreachableHashes.length} cited hash(es) exist but are not reachable from HEAD: ` +
        `${unreachableHashes.map((u) => u.hash).join(', ')}\n`,
    );
  }
  process.stdout.write(
    'ledger census clean: live statuses lawful, no terminal FID parked, every SCOPE hash resolves, ' +
      `every closure from ${RECORD_FROM} carries a session record\n`,
  );
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
if (noSessionRecord.length > 0) {
  process.stdout.write(`FIDs CLOSED ON/AFTER ${RECORD_FROM} WITH NO SESSION RECORD (${noSessionRecord.length}):\n`);
  for (const v of noSessionRecord) {
    process.stdout.write(
      `  ${v.file}  ${v.date}  \`${v.id}\` — no dev/session-summaries/*.md cites it (Law 8 / the auto-archive rule)\n`,
    );
  }
}
if (undatedClosure.length > 0) {
  process.stdout.write(`TERMINAL FIDs FILED ON/AFTER ${RECORD_FROM} WITH NO DATED CLOSURE (${undatedClosure.length}):\n`);
  for (const v of undatedClosure) {
    process.stdout.write(
      `  ${v.file}  status \`${v.value}\` — write \`<status> (YYYY-MM-DD, commit <hash>)\`, or check D cannot judge it\n`,
    );
  }
}
if (closureBeforeFiling.length > 0) {
  process.stdout.write(`CLOSURES DATED BEFORE THE FID WAS FILED (${closureBeforeFiling.length}):\n`);
  for (const v of closureBeforeFiling) {
    process.stdout.write(
      `  ${v.file}  filed ${v.filedDate}  status \`${v.value}\` — a closure cannot precede the filing\n`,
    );
  }
}
process.stdout.write(
  '\nA ledger claim is only as good as its checkability: a status must be one the\n' +
    'protocol defines (protocol.config.yaml `allowed_statuses`), a terminal FID\n' +
    'belongs in dev/fids/archive/ (`archive_on_close: true`), a cited commit\n' +
    'hash must resolve (`git cat-file -e <hash>^{commit}`), and a closure from\n' +
    `${RECORD_FROM} forward must be a record someone wrote down: a session summary\n` +
    'in dev/session-summaries/ that cites the FID. A hash that was\n' +
    'destroyed on purpose is waived by REASON in scripts/ledgerIntegrityCensus.cjs\n' +
    '— never silently replaced by a hash that happens to resolve.\n',
);
process.exit(1);
