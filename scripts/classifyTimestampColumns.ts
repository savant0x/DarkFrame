#!/usr/bin/env tsx
/**
 * Timestamp writer-convention classifier (FID-20260923-001, step 1 of the plan).
 *
 * EVIDENCE-ONLY: this script never writes to the database. It reads
 * `information_schema`, samples each naive (`timestamp without time zone`)
 * column, and reports — per column — the writer convention, the population,
 * and whether the stored values cluster. Its job is to surface mixed-writer,
 * environment-mixed, date-only and unanchored columns BEFORE migration 0040 is
 * written, exactly as FID-20260923-001 §5 requires.
 *
 * WHY THE LIVE MATH IS ALL IN SQL
 * The Node process runs America/New_York and node-pg parses `timestamp without
 * time zone` as *local* time. Arithmetic done in JS therefore silently shifts by
 * the process offset. Every delta below is computed server-side and returned as
 * epoch seconds or `to_char` text, so nothing is parsed client-side.
 *
 * THE DISCRIMINATOR
 * For a naive column, let `d = anchor_utc_wall - value`, where `anchor_utc_wall`
 * is a true instant expressed as UTC wall clock (a `timestamptz` anchor, or a
 * naive column the DB itself writes with `DEFAULT now()` — the DB session is
 * UTC, so that value *is* the instant's UTC wall clock):
 *   - a row written by a UTC-convention writer stores the instant's UTC wall
 *     clock, so `d` equals the true relationship;
 *   - a row written by an app-local writer (process TZ = New York) stores the
 *     instant's local wall clock, so `d` is the true relationship **plus the
 *     offset** (4h DST / 5h EST);
 *   - a row written by the app from a UTC host is indistinguishable from a DB
 *     write — the environment-mixed case this pass must surface.
 * So a naive column written by two conventions shows **two clusters separated by
 * exactly the offset**. This is the cluster test below.
 *
 * `now()` cannot serve as the anchor on an idle database (a column's newest
 * value is only "now" if something wrote recently), so the now-anchor histogram
 * is reported alongside a freshness frontier that says why it is empty.
 *
 * Usage:
 *   npx tsx scripts/classifyTimestampColumns.ts             # console summary + report file
 *   npx tsx scripts/classifyTimestampColumns.ts --dry       # console only, no report file
 */

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT, 'lib', 'db', 'schema');
const REPORT_PATH = path.join(ROOT, 'dev', 'TIMESTAMP-CLASSIFICATION-2026-09-23.md');
const WRITE_REPORT = !process.argv.includes('--dry');

/** Process timezone — the offset every app-written naive column carries. */
const PROCESS_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
/** DST offset range for the process TZ (America/New_York): 4h..5h. */
const OFFSET_MIN_H = 4;
const OFFSET_MAX_H = 5;

// ---------------------------------------------------------------------------
// 1. Drizzle schema metadata
// ---------------------------------------------------------------------------

interface SchemaCol {
  prop: string;
  col: string;
  withTimezone: boolean;
  defaultNow: boolean;
  line: number;
}

interface SchemaTable {
  ident: string;
  cols: SchemaCol[];
}

function parseSchema(): Map<string, SchemaTable> {
  const out = new Map<string, SchemaTable>();
  for (const file of fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
    const src = fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf-8');
    const lines = src.split('\n');
    const tableRe = /export\s+const\s+(\w+)\s*=\s*pgTable\(\s*\n?\s*'([a-z_]+)'/g;
    let m: RegExpExecArray | null;
    while ((m = tableRe.exec(src)) !== null) {
      const [, ident, table] = m;
      const startLine = src.slice(0, m.index).split('\n').length;
      const cols: SchemaCol[] = [];
      for (let i = startLine - 1; i < lines.length; i++) {
        const line = lines[i];
        if (i > startLine - 1 && /^\}\);/.test(line)) break;
        const cm = /(\w+)\s*:\s*timestamp\(\s*'([a-z_]+)'(?:\s*,\s*\{([^}]*)\})?\s*\)([^,]*(?:,|$))/.exec(line);
        if (cm) {
          cols.push({
            prop: cm[1],
            col: cm[2],
            withTimezone: /withTimezone:\s*true/.test(cm[3] ?? ''),
            defaultNow: /defaultNow\(\)/.test(cm[4] ?? ''),
            line: i + 1,
          });
        }
      }
      out.set(table, { ident, cols });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Static writer census — STATEMENT-SCOPED so an assignment only counts when
//    the enclosing insert()/update() targets THIS table. (An earlier unscoped
//    pass attributed `createdAt:` from unrelated files to players.created_at —
//    the brittle-matching defect class, caught before it reached the report.)
// ---------------------------------------------------------------------------

type ValueKind = 'db-default' | 'js-date' | 'sql-now' | 'literal' | 'null' | 'app-var' | 'unknown';

const VALUE_KIND_LABEL: Record<ValueKind, string> = {
  'db-default': 'DEFAULT now()',
  'js-date': 'JS Date (process TZ)',
  'sql-now': 'SQL now() (server UTC)',
  literal: 'string literal',
  null: 'NULL',
  'app-var': 'app expression (unresolved)',
  unknown: 'unrecognised',
};

function classifyValue(expr: string): ValueKind {
  const e = expr.trim();
  if (/^null$/i.test(e)) return 'null';
  if (/\bnew Date\s*\(|\bDate\.now\s*\(|\.toISOString\s*\(/.test(e)) return 'js-date';
  if (/CURRENT_TIMESTAMP|\bNOW\s*\(\s*\)/i.test(e)) return 'sql-now';
  if (/^['"`]/.test(e)) return 'literal';
  if (/^[A-Za-z_$][\w$.]*$/.test(e)) return 'app-var'; // identifier: Date or number, unresolved
  return 'unknown';
}

interface WriteSite {
  file: string;
  line: number;
  /** lines between this assignment and the write statement it is attributed to */
  delta: number;
  kind: 'drizzle' | 'rawsql';
  via: string;
  expr: string;
  valueKind: ValueKind;
  /** runtime = lib/app/components (shipped); script = scripts/ (probe/seed harnesses) */
  scope: 'runtime' | 'script';
}

interface CorpusFile {
  file: string;
  lines: string[];
}

/** A write statement: the line that opens an insert/update for one table. */
interface Anchor {
  line: number;
  table: string;
  kind: 'drizzle' | 'rawsql';
  via: string;
}

/**
 * Ownership by nearest write statement.
 *
 * A hand-rolled TS statement splitter was tried first and abandoned: regex and
 * template literals desynchronise a naive tokenizer, which produced ONE region
 * spanning hundreds of lines and misattributed a mapping function to an insert
 * (caught by re-reading the report). Line-indexed anchors plus a bounded
 * distance are simpler and auditable.
 *
 * The distance window is what makes BOTH write shapes work:
 *   - inline:   db.insert(players).values({ createdAt: new Date() })   → Δ0
 *   - deferred: const row = { createdAt: new Date() }; ... values(row) → Δ = span
 * and it is what stops a distant unrelated assignment from being attributed.
 * Every reported site carries its Δ so a reader can audit the attribution.
 */
const ANCHOR_WINDOW = 40;

/** Rejects type-annotation lookalikes such as `createdAt: string,` in interfaces. */
const TYPE_LIKE = /^(string|number|boolean|Date|unknown|any|never|void|object|bigint)(\[\])?[;,)]?$/;

/**
 * Deferred payloads: the codebase's `const payload = { col: value }; … .set(payload)`
 * idiom puts the assignment far from the write statement, so the distance window
 * alone reports such columns as NO-WRITER (`players.last_xp_award` was one).
 * The object literal's own line range is treated as an anchor region for the table
 * the `.set()`/`.values()` call belongs to.
 */
interface PayloadRegion {
  table: string;
  startLine: number;
  endLine: number;
  via: string;
}

function buildPayloadRegions(corpus: CorpusFile[], idents: Map<string, string>): Map<string, PayloadRegion[]> {
  const out = new Map<string, PayloadRegion[]>();
  for (const cf of corpus) {
    const regions: PayloadRegion[] = [];
    cf.lines.forEach((line, idx) => {
      const anchor = /\.insert\(\s*([A-Za-z_$][\w$]*)\s*\)|\.update\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(line);
      if (!anchor) return;
      const ident = anchor[1] ?? anchor[2];
      const table = idents.get(ident);
      if (!table) return;
      for (const m of line.matchAll(/\.(?:values|set)\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
        const name = m[1];
        const decl = new RegExp(`(?:const|let|var)\\s+${name}\\s*(?::[^=;]+)?=\\s*\\{`).exec(cf.lines.slice(0, idx + 1).join('\n'));
        if (!decl) continue;
        const startLine = cf.lines.slice(0, idx + 1).join('\n').slice(0, decl.index).split('\n').length;
        let depth = 0;
        let endLine = startLine;
        for (let j = startLine - 1; j < cf.lines.length; j++) {
          depth += (cf.lines[j].match(/\{/g) ?? []).length;
          depth -= (cf.lines[j].match(/\}/g) ?? []).length;
          if (depth <= 0 && j >= startLine - 1) {
            endLine = j + 1;
            break;
          }
        }
        regions.push({ table, startLine, endLine, via: `.${anchor[1] ? 'insert' : 'update'}(${ident}) ${m[0]}` });
      }
    });
    if (regions.length) out.set(cf.file, regions);
  }
  return out;
}

function buildAnchors(corpus: CorpusFile[], idents: Map<string, string>): Map<string, Anchor[]> {
  const out = new Map<string, Anchor[]>();
  for (const cf of corpus) {
    const anchors: Anchor[] = [];
    cf.lines.forEach((line, idx) => {
      const dIns = /\.insert\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(line);
      const dUpd = /\.update\(\s*([A-Za-z_$][\w$]*)\s*\)/.exec(line);
      const rIns = /INSERT\s+INTO\s+"?([A-Za-z_][\w]*)"?/i.exec(line);
      const rUpd = /UPDATE\s+"?([A-Za-z_][\w]*)"?/i.exec(line);
      if (dIns || dUpd) {
        const ident = (dIns ?? dUpd)![1];
        const table = idents.get(ident);
        if (table) anchors.push({ line: idx + 1, table, kind: 'drizzle', via: `.${dIns ? 'insert' : 'update'}(${ident})` });
      } else if (rIns || rUpd) {
        anchors.push({ line: idx + 1, table: (rIns ?? rUpd)![1], kind: 'rawsql', via: rIns ? 'INSERT INTO' : 'UPDATE' });
      }
    });
    if (anchors.length) out.set(cf.file, anchors);
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip by exact path, not by directory name: excluding every `migrations`
      // directory also skipped `lib/migrations/**` — the runtime TS migration
      // modules that populate `migrations.applied_at` — a false NO-WRITER.
      if (p === path.join(ROOT, 'lib', 'db', 'migrations')) continue;
      if (['node_modules', '.next', 'archives'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) out.push(p);
  }
}

function buildCorpus(): CorpusFile[] {
  const files: string[] = [];
  for (const d of ['lib', 'app', 'components', 'scripts']) walk(path.join(ROOT, d), files);
  return files
    .filter(
      (p) =>
        !p.includes(`${path.sep}db${path.sep}schema${path.sep}`) &&
        !p.endsWith('classifyTimestampColumns.ts'),
    )
    .map((p) => ({
      file: path.relative(ROOT, p).replace(/\\/g, '/'),
      lines: fs.readFileSync(p, 'utf-8').split('\n'),
    }));
}

/** identity → table name, built from the schema parse. */
function identMap(schema: Map<string, SchemaTable>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [table, t] of schema) m.set(t.ident, table);
  return m;
}

function findWriteSites(
  anchors: Map<string, Anchor[]>,
  payloads: Map<string, PayloadRegion[]>,
  corpus: CorpusFile[],
  prop: string | null,
  col: string,
  table: string,
): WriteSite[] {
  const sites: WriteSite[] = [];
  for (const cf of corpus) {
    const fileAnchors = anchors.get(cf.file);
    if (!fileAnchors?.length) continue;
    cf.lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      // Nearest write statement wins; ties/overlaps resolve to the closest line.
      let best: Anchor | null = null;
      let bestD = Number.POSITIVE_INFINITY;
      for (const a of fileAnchors) {
        const d = Math.abs(a.line - lineNo);
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      }
      const inPayload = (payloads.get(cf.file) ?? []).find(
        (r) => r.table === table && lineNo >= r.startLine && lineNo <= r.endLine,
      );
      const nearAnchor = best && best.table === table && bestD <= ANCHOR_WINDOW ? best : null;
      if (!inPayload && !nearAnchor) return;
      const via = inPayload ? inPayload.via : nearAnchor!.via;
      const kind: 'drizzle' | 'rawsql' = inPayload ? 'drizzle' : nearAnchor!.kind;
      const delta = inPayload ? 0 : bestD;
      if (kind === 'drizzle' && prop) {
        const pushDrizzle = (expr: string) => {
          sites.push({
            file: cf.file,
            line: lineNo,
            delta,
            kind: 'drizzle',
            via,
            expr: expr.slice(0, 140),
            valueKind: classifyValue(expr),
            scope: cf.file.startsWith('scripts/') ? 'script' : 'runtime',
          });
        };
        const m = new RegExp(`(^|[^\\w.$])${prop}\\s*:\\s*([^,\\n}]+)`).exec(line);
        if (m) {
          const expr = m[2].trim();
          if (!TYPE_LIKE.test(expr)) pushDrizzle(expr);
          return;
        }
        // Shorthand property (`impactAt,` inside values({...})) — the value is the
        // local's initializer. Missing this shape hid missiles.impact_at entirely.
        if (
          new RegExp(`(^|[^\\w.$])${prop}\\s*(?=[,\\n}]|$)`).test(line) &&
          !/(const|let|var)\s*\{|import\b|function\b|interface\b|type\b/.test(line)
        ) {
          let init = '';
          for (let j = idx; j >= 0 && j > idx - 200; j--) {
            const dm = new RegExp(`(?:const|let|var)\\s+${prop}\\s*(?::[^=;]+)?=\\s*([^;\\n]+)`).exec(cf.lines[j]);
            if (dm) {
              init = dm[1].trim();
              break;
            }
          }
          pushDrizzle(init || `${prop} (shorthand, initializer not found)`);
        }
      }
      if (kind === 'rawsql' && new RegExp(`(^|[^\\w])"?${col}"?(?![\\w])`).test(line)) {
        const expr = line.replace(/^.*?=\s*/, '').trim() || line.trim();
        sites.push({
          file: cf.file,
          line: lineNo,
          delta,
          kind: 'rawsql',
          via,
          expr: expr.slice(0, 140),
          valueKind: classifyValue(expr),
          scope: cf.file.startsWith('scripts/') ? 'script' : 'runtime',
        });
      }
    });
  }
  const seen = new Set<string>();
  return sites.filter((s) => {
    const k = `${s.file}:${s.line}:${s.expr}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------
// 3. Live evidence (SQL-only arithmetic)
// ---------------------------------------------------------------------------

interface LiveEvidence {
  rows: number;
  nonNull: number;
  minTxt: string | null;
  maxTxt: string | null;
  midnightRows: number;
  futureRows: number;
  /** age of the newest non-future value, in hours (null when the column holds only future values) */
  minAgeH: number | null;
  /** delta = utc_wall_now - value, in hours: [<1,1-2,…,7-8,>8,future] */
  bins: number[];
}

const BIN_EDGES = [1, 2, 3, 4, 5, 6, 7, 8];

function populationSql(table: string, col: string): string {
  const t = `"${table}"`;
  const c = `"${col}"`;
  const nowWall = `(now() AT TIME ZONE 'UTC')`;
  const bins = BIN_EDGES.map((hi, idx) => {
    const lo = idx === 0 ? 0 : BIN_EDGES[idx - 1];
    return `count(*) FILTER (WHERE delta >= interval '${lo} hour' AND delta < interval '${hi} hour') AS b${idx}`;
  }).join(', ');
  return `
    WITH deltas AS (SELECT ${nowWall} - ${c} AS delta FROM ${t} WHERE ${c} IS NOT NULL)
    SELECT
      (SELECT count(*) FROM ${t})::int AS rows,
      (SELECT count(*) FROM ${t} WHERE ${c} IS NOT NULL)::int AS non_null,
      (SELECT to_char(min(${c}), 'YYYY-MM-DD HH24:MI:SS') FROM ${t}) AS min_txt,
      (SELECT to_char(max(${c}), 'YYYY-MM-DD HH24:MI:SS') FROM ${t}) AS max_txt,
      (SELECT count(*) FROM ${t} WHERE ${c} IS NOT NULL
         AND date_trunc('day', ${c}) = ${c})::int AS midnight_rows,
      (SELECT count(*) FROM ${t} WHERE ${c} IS NOT NULL AND ${c} > ${nowWall})::int AS future_rows,
      (SELECT round(extract(epoch FROM (${nowWall} - max(${c})))/3600.0, 2)::float8
         FROM ${t} WHERE ${c} IS NOT NULL AND ${c} <= ${nowWall}) AS min_age_h,
      ${bins},
      count(*) FILTER (WHERE delta >= interval '8 hour')::int AS bover,
      count(*) FILTER (WHERE delta < interval '0 hour')::int AS bfuture
    FROM deltas;`;
}

interface Cluster {
  /** cluster midpoint, in hours, relative to the anchor */
  midH: number;
  loH: number;
  hiH: number;
  n: number;
}

interface AnchorTest {
  anchor: string;
  anchorKind: 'timestamptz' | 'db-default-naive';
  rows: number;
  clusters: Cluster[];
  /** two tight clusters exactly ~4h/5h apart → two writing conventions */
  split: null | { gapH: number; a: Cluster; b: Cluster };
}

/** `d = anchor_utc_wall - value`, clustered at 15-minute granularity. */
function anchorSql(table: string, col: string, anchor: string, anchorKind: AnchorTest['anchorKind']): string {
  const anchorExpr = anchorKind === 'timestamptz' ? `("${anchor}" AT TIME ZONE 'UTC')` : `"${anchor}"`;
  return `
    WITH p AS (
      SELECT ${anchorExpr} - "${col}" AS d
      FROM "${table}"
      WHERE "${col}" IS NOT NULL AND "${anchor}" IS NOT NULL
    )
    SELECT round(extract(epoch FROM d) / 900.0)::int AS q, count(*)::int AS n
    FROM p WHERE d IS NOT NULL GROUP BY 1 ORDER BY 1;`;
}

function toClusters(rows: Array<{ q: number; n: number }>): Cluster[] {
  const out: Cluster[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && r.q - Math.round(last.hiH * 4) <= 1) {
      const total = last.n + r.n;
      last.midH = (last.midH * last.n + (r.q / 4) * r.n) / total;
      last.hiH = r.q / 4;
      last.n = total;
    } else {
      out.push({ midH: r.q / 4, loH: r.q / 4, hiH: r.q / 4, n: r.n });
    }
  }
  return out.sort((a, b) => b.n - a.n);
}

function detectSplit(clusters: Cluster[]): AnchorTest['split'] {
  const strong = clusters.filter((c) => c.n >= 3 && c.hiH - c.loH <= 1);
  for (let i = 0; i < strong.length; i++) {
    for (let j = i + 1; j < strong.length; j++) {
      const gap = Math.abs(strong[i].midH - strong[j].midH);
      if (gap >= OFFSET_MIN_H - 0.5 && gap <= OFFSET_MAX_H + 0.5) {
        return { gapH: Math.round(gap * 100) / 100, a: strong[i], b: strong[j] };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4. Classification
// ---------------------------------------------------------------------------

type StaticClass = 'DB-UTC' | 'APP-LOCAL' | 'SQL-NOW' | 'MIXED' | 'LITERAL' | 'NULL-ONLY' | 'NO-WRITER';
type Verdict =
  | 'CONFIRMED (DB-UTC)'
  | 'CONSISTENT (app-local)'
  | 'MIXED — live split proven'
  | 'MIXED — code split, data single-convention'
  | 'MIXED — code split, empty column'
  | 'MIXED (static only)'
  | 'CONTRADICTED'
  | 'UNANCHORED'
  | 'EMPTY'
  | 'LITERAL';

interface ColumnRow {
  table: string;
  col: string;
  dbDefault: string | null;
  schema: SchemaCol | null;
  sites: WriteSite[];
  staticClass: StaticClass;
  live: LiveEvidence;
  anchors: AnchorTest[];
  verdict: Verdict;
  flags: string[];
}

function classifyStatic(sites: WriteSite[], dbDefault: string | null): StaticClass {
  const kinds = new Set(sites.map((s) => s.valueKind));
  const hasDbDefault = !!dbDefault && /now\(\)|current_timestamp/i.test(dbDefault);
  const hasJsDate = kinds.has('js-date') || kinds.has('app-var');
  const hasSqlNow = kinds.has('sql-now');
  if (hasDbDefault && hasJsDate) return 'MIXED';
  if (hasSqlNow && hasJsDate) return 'MIXED';
  if (hasDbDefault) return 'DB-UTC';
  if (hasSqlNow) return 'SQL-NOW';
  if (hasJsDate) return 'APP-LOCAL';
  if (kinds.has('literal')) return 'LITERAL';
  // A column whose only write site assigns NULL is never populated — distinct
  // from having no write site at all, and it must not inherit a zone silently.
  if (sites.length > 0 && [...kinds].every((k) => k === 'null')) return 'NULL-ONLY';
  return 'NO-WRITER';
}

function decide(
  staticClass: StaticClass,
  live: LiveEvidence,
  anchors: AnchorTest[],
  sites: WriteSite[],
  dbDefault: string | null,
): { verdict: Verdict; flags: string[] } {
  const flags: string[] = [];
  const splitTest = anchors.find((a) => a.split) ?? null;
  const split = splitTest?.split ?? null;
  if (live.nonNull === 0) flags.push('column is EMPTY — no rows to migrate, but the declared type still needs a zone');
  if (live.nonNull > 0 && live.midnightRows === live.nonNull) flags.push('ALL VALUES AT 00:00:00 — may be a calendar date, not an instant');
  else if (live.nonNull > 0 && live.midnightRows / live.nonNull > 0.9) flags.push(`${live.midnightRows}/${live.nonNull} values at 00:00:00 — check date-vs-instant`);

  if (staticClass === 'LITERAL') {
    flags.push('string-literal timestamps — verify the literal denotes an instant');
    return { verdict: 'LITERAL', flags };
  }
  if (split) {
    flags.push(
      `MIXED WRITERS PROVEN: ${split.a.n} rows @ ${split.a.midH.toFixed(2)}h and ${split.b.n} rows @ ${split.b.midH.toFixed(2)}h ` +
        `vs ${splitTest?.anchor} — a ${split.gapH}h gap matching the process offset`,
    );
    return { verdict: 'MIXED — live split proven', flags };
  }
  if (staticClass === 'MIXED') {
    const dbDefaultWins = !!dbDefault && /now\(\)|current_timestamp/i.test(dbDefault);
    const appSites = sites.filter((s) => s.valueKind === 'js-date' || s.valueKind === 'app-var');
    const runtimeApp = appSites.filter((s) => s.scope === 'runtime');
    flags.push(
      `CODE SPLIT: app-local writer ${runtimeApp.length ? runtimeApp.slice(0, 2).map((s) => `\`${s.file}:${s.line}\``).join(', ') : '(scripts only)'}` +
        `; UTC-class writer ${dbDefaultWins ? '`DEFAULT now()` on the column' : '`now()` in SQL'}`,
    );
    if (runtimeApp.length) {
      flags.push(
        `the app-local site is SHIPPED runtime code — the split is real in production even if this database shows one convention`,
      );
    }
    const anchored = anchors.filter((a) => a.clusters.length === 1 && a.rows >= 3).sort((a, b) => b.rows - a.rows)[0];
    if (anchored) {
      const c = anchored.clusters[0];
      flags.push(
        `live data NOT split: ${anchored.rows}/${live.nonNull} rows form ONE cluster (${c.midH.toFixed(2)}h vs ${anchored.anchor});` +
          ` the other ${live.nonNull - anchored.rows} rows are unanchored — do NOT conclude the split is absent from production data`,
      );
      return { verdict: 'MIXED — code split, data single-convention', flags };
    }
    if (live.nonNull === 0) return { verdict: 'MIXED — code split, empty column', flags };
    flags.push('no single-cluster anchor on this DB — the split cannot be confirmed or ruled out from existing rows');
    return { verdict: 'MIXED (static only)', flags };
  }
  if (live.nonNull === 0) return { verdict: 'EMPTY', flags };
  // Single-cluster anchors: decisive only when the column and anchor share an event.
  const tight = anchors.filter((a) => a.clusters.length === 1 && a.rows >= 3).sort((a, b) => b.rows - a.rows)[0];
  if (staticClass === 'DB-UTC' || staticClass === 'SQL-NOW') {
    if (tight) return { verdict: 'CONFIRMED (DB-UTC)', flags };
    flags.push('no anchor rows with a single cluster — classification rests on static provenance');
    return { verdict: 'UNANCHORED', flags };
  }
  if (staticClass === 'APP-LOCAL') {
    if (tight) {
      // A single cluster at an integer-ish duration cannot prove the convention on
      // its own, but it does prove no offset split exists among these rows.
      return { verdict: 'CONSISTENT (app-local)', flags };
    }
    flags.push('no anchor rows — classification rests on static provenance');
    return { verdict: 'UNANCHORED', flags };
  }
  flags.push(
    staticClass === 'NULL-ONLY'
      ? 'only NULL writes found — the column is never populated; the type still needs a zone'
      : 'no writer found and no usable anchor — likely never written or written from an unmapped shape',
  );
  return { verdict: 'UNANCHORED', flags };
}

// ---------------------------------------------------------------------------
// 4b. Zone decisions (FID-20260923-001 §5) + migration emission
// ---------------------------------------------------------------------------

/**
 * Per-column zone for the MIXED class, decided from evidence (never silently):
 *
 *  - `auctions.expires_at`        app-local — every row sits an exact 12.00/24.00h
 *                                 from its app-local `created_at`, so both were
 *                                 written by the same (app) insert.
 *  - `flag_trail.created_at`      app-local — exact 8.0min from the app-local
 *                                 `expires_at` written in the same insert.
 *  - `players.created_at`         UTC — all 105 existing rows are DB-default
 *                                 UTC-wall (exactly 72.00h from the timestamptz
 *                                 `protection_until`); the shipped signup writer
 *                                 becomes correct automatically once the column is
 *                                 `timestamptz`.
 *  - `clan_wars.declared_at`      UTC — empty; the DB default governs the insert.
 *  - `clan_wars.updated_at`       UTC — empty; DB default on insert (a live system
 *                                 would then overwrite with an app-local value —
 *                                 recorded, data-moot here).
 *  - `player_level_history.captured_at` UTC — empty; DB default governs.
 *
 * For the empty columns the zone is data-moot (nothing to convert); it is
 * recorded so the decision is explicit rather than implied.
 */
const MIXED_ZONE: Record<string, 'UTC' | 'America/New_York'> = {
  'auctions.expires_at': 'America/New_York',
  'clan_wars.declared_at': 'UTC',
  'clan_wars.updated_at': 'UTC',
  'flag_trail.created_at': 'America/New_York',
  'player_level_history.captured_at': 'UTC',
  'players.created_at': 'UTC',
};

/**
 * The zone each column's stored wall clock was written in. App-written columns
 * hold the process-local wall clock (`America/New_York` here); DB-defaulted and
 * unwritten columns hold the session wall clock (UTC). Every MIXED column must
 * have an explicit entry in MIXED_ZONE — silence is an error, not a default.
 */
function zoneFor(r: ColumnRow): 'UTC' | 'America/New_York' {
  if (r.staticClass === 'MIXED') {
    const z = MIXED_ZONE[`${r.table}.${r.col}`];
    if (!z) throw new Error(`MIXED column ${r.table}.${r.col} has no explicit zone decision`);
    return z;
  }
  return r.staticClass === 'APP-LOCAL' ? 'America/New_York' : 'UTC';
}

/**
 * Emit migration 0040 — one idempotent DO block over a VALUES table of
 * (table, column, zone). The VALUES list is the decision record: every column's
 * zone is readable in the file, and the guard makes the script re-runnable
 * (a `timestamptz` column is skipped, because re-applying
 * `timestamptz AT TIME ZONE z` would silently re-shift it).
 */
function emitMigrationSql(rows: ColumnRow[]): string {
  const sorted = [...rows].sort((a, b) => (a.table === b.table ? a.col.localeCompare(b.col) : a.table.localeCompare(b.table)));
  const vals = sorted.map((r) => `      ('${r.table}', '${r.col}', '${zoneFor(r)}')`).join(',\n');
  const byZone = { UTC: 0, 'America/New_York': 0 } as Record<string, number>;
  let populated = 0;
  for (const r of rows) {
    byZone[zoneFor(r)]++;
    if (r.live.nonNull > 0) populated++;
  }
  const mixed = sorted.filter((r) => r.staticClass === 'MIXED');
  return [
    '-- 0040_timestamptz_conversion.sql (FID-20260923-001)',
    '--',
    '-- Eliminate the naive-timestamp class: convert every `timestamp without time',
    '-- zone` column to `timestamptz`, interpreting each stored wall clock with the',
    '-- zone it was WRITTEN in. Zone NAMES (not fixed offsets) are used so DST',
    '-- resolves per stored value, including pre-transition history.',
    '--',
    '--   * app-written columns hold the process-local wall clock -> America/New_York',
    '--   * DB-defaulted (`DEFAULT now()`) and unwritten columns hold the session',
    '--     wall clock (UTC) -> UTC',
    '--',
    `-- ${rows.length} columns total (${byZone['America/New_York']} app-local, ${byZone['UTC']} UTC);`,
    `-- ${populated} carry data, the rest are a pure type change.`,
    '--',
    '-- IDEMPOTENT: a column already `timestamp with time zone` is skipped. Reapplying',
    '-- the USING expression to an already-converted column would silently re-shift it',
    '-- (`timestamptz AT TIME ZONE z` yields a naive local timestamp), so the guard is',
    '-- load-bearing, not cosmetic.',
    '--',
    '-- CALIBRATED TO THIS ENVIRONMENT: `America/New_York` is the writing process TZ',
    '-- of the data here. A database whose naive rows were written by a UTC process',
    '-- must use `UTC` for those rows (see the provenance caveat in',
    '-- dev/TIMESTAMP-CLASSIFICATION-2026-09-23.md).',
    '',
    'DO $$',
    'DECLARE',
    '  r RECORD;',
    '  n_done int := 0;',
    'BEGIN',
    '  FOR r IN',
    '    SELECT * FROM (VALUES',
    vals,
    '    ) AS t(tbl, col, zone)',
    '  LOOP',
    '    IF EXISTS (',
    "      SELECT 1 FROM information_schema.columns",
    "      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.col",
    "        AND data_type = 'timestamp without time zone'",
    '    ) THEN',
    "      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE timestamptz USING (%I AT TIME ZONE %L)',",
    '                     r.tbl, r.col, r.col, r.zone);',
    '      n_done := n_done + 1;',
    '    END IF;',
    '  END LOOP;',
    "  RAISE NOTICE 'migration 0040: % column(s) converted to timestamptz', n_done;",
    'END $$;',
    '',
    '-- Explicit decisions for the MIXED (multi-writer) columns, recorded here so the',
    '-- zone list above is auditable against the evidence in',
    '-- dev/TIMESTAMP-CLASSIFICATION-2026-09-23.md §Mixed-writer columns:',
    ...mixed.map((r) => `--   ${r.table}.${r.col} -> ${zoneFor(r)}`),
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 5. Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const schema = parseSchema();
  const idents = identMap(schema);
  const corpus = buildCorpus();
  const writeAnchors = buildAnchors(corpus, idents);
  const payloadRegions = buildPayloadRegions(corpus, idents);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const meta = await client.query<{ table_name: string; column_name: string; column_default: string | null }>(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
    ORDER BY table_name, column_name`);

  const tzCols = await client.query<{ table_name: string; column_name: string }>(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'timestamp with time zone'`);

  const settings = await client.query<{ db_tz: string; utc_wall: string; offset_h: string }>(
    `SELECT current_setting('TimeZone') AS db_tz,
            to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS utc_wall,
            round(extract(epoch FROM ((now() AT TIME ZONE 'America/New_York') - (now() AT TIME ZONE 'UTC')))/3600.0, 2)::text AS offset_h`,
  );

  // Calibration: how does THIS driver render a known instant into each column
  // kind? Read-only — no table is touched. Two separate queries so PostgreSQL
  // cannot resolve the parameter type from a sibling cast.
  const KNOWN = new Date('2026-01-15T12:00:00.000Z'); // EST period → NY wall 07:00
  const wire = (await client.query<{ v: string }>('SELECT $1::text AS v', [KNOWN])).rows[0].v;
  const naiveWall = (
    await client.query<{ v: string }>(`SELECT to_char($1::timestamp, 'YYYY-MM-DD HH24:MI:SS') AS v`, [KNOWN])
  ).rows[0].v;
  const tzInstant = (
    await client.query<{ v: string }>(`SELECT to_char($1::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS v`, [KNOWN])
  ).rows[0].v;

  const tzByTable = new Map<string, string[]>();
  for (const r of tzCols.rows) tzByTable.set(r.table_name, [...(tzByTable.get(r.table_name) ?? []), r.column_name]);

  // DB-default naive columns are UTC-wall anchors in their own right.
  const dbDefaultByTable = new Map<string, string[]>();
  for (const r of meta.rows) {
    if (r.column_default && /now\(\)|current_timestamp/i.test(r.column_default)) {
      dbDefaultByTable.set(r.table_name, [...(dbDefaultByTable.get(r.table_name) ?? []), r.column_name]);
    }
  }

  const rows: ColumnRow[] = [];
  for (const m of meta.rows) {
    const schemaEntry = (schema.get(m.table_name)?.cols ?? []).find((c) => c.col === m.column_name) ?? null;
    const sites = findWriteSites(writeAnchors, payloadRegions, corpus, schemaEntry?.prop ?? null, m.column_name, m.table_name);
    const staticClass = classifyStatic(sites, m.column_default);

    let live: LiveEvidence;
    try {
      const x = (await client.query(populationSql(m.table_name, m.column_name))).rows[0] as Record<string, number | string>;
      live = {
        rows: Number(x.rows),
        nonNull: Number(x.non_null),
        minTxt: (x.min_txt as string) ?? null,
        maxTxt: (x.max_txt as string) ?? null,
        midnightRows: Number(x.midnight_rows),
        futureRows: Number(x.future_rows),
        minAgeH: x.min_age_h === null || x.min_age_h === undefined ? null : Number(x.min_age_h),
        bins: [...BIN_EDGES.map((_, i) => Number(x[`b${i}`] ?? 0)), Number(x.bover ?? 0), Number(x.bfuture ?? 0)],
      };
    } catch (e) {
      console.error(`  ! population probe failed for ${m.table_name}.${m.column_name}: ${(e as Error).message}`);
      live = { rows: 0, nonNull: 0, minTxt: null, maxTxt: null, midnightRows: 0, futureRows: 0, minAgeH: null, bins: new Array(BIN_EDGES.length + 2).fill(0) };
    }

    // Anchor tests: timestamptz siblings (true instants) and DB-default naive
    // siblings (UTC wall clocks). Both are "the instant, as UTC wall clock".
    const anchors: AnchorTest[] = [];
    if (live.nonNull > 0) {
      const candidates: Array<{ name: string; kind: AnchorTest['anchorKind'] }> = [
        ...(tzByTable.get(m.table_name) ?? []).map((c) => ({ name: c, kind: 'timestamptz' as const })),
        ...(dbDefaultByTable.get(m.table_name) ?? []).map((c) => ({ name: c, kind: 'db-default-naive' as const })),
      ].filter((c) => c.name !== m.column_name);
      for (const cand of candidates) {
        try {
          const r = await client.query<{ q: number; n: number }>(anchorSql(m.table_name, m.column_name, cand.name, cand.kind));
          const clusters = toClusters(r.rows.map((z) => ({ q: Number(z.q), n: Number(z.n) })));
          const total = r.rows.reduce((s, z) => s + Number(z.n), 0);
          if (total === 0) continue;
          anchors.push({ anchor: `${m.table_name}.${cand.name}`, anchorKind: cand.kind, rows: total, clusters, split: detectSplit(clusters) });
        } catch (e) {
          console.error(`  ! anchor probe failed for ${m.table_name}.${m.column_name} × ${cand.name}: ${(e as Error).message}`);
        }
      }
    }

    const { verdict, flags } = decide(staticClass, live, anchors, sites, m.column_default);
    rows.push({ table: m.table_name, col: m.column_name, dbDefault: m.column_default, schema: schemaEntry, sites, staticClass, live, anchors, verdict, flags });
  }

  await client.end();

  // Data provenance — how much of this database is real user traffic vs seeded/probe rows?
  // It bounds how much the live evidence says about production conventions.
  let provenance: { total: number; testLike: number } | null = null;
  try {
    const p = await client.query<{ total: number; test_like: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE split_part(email, '@', 2) IN
                ('darkframe.internal','probe.invalid','test.local','darkframe.test','example.com','probe.local'))::int AS test_like
       FROM players`,
    );
    provenance = { total: p.rows[0].total, testLike: p.rows[0].test_like };
  } catch {
    provenance = null;
  }

  // Freshness frontier — the youngest value anywhere (newest non-future), i.e.
  // the best case the now-anchor could ever have had on this DB.
  const anchoredCols = rows.filter((r) => r.anchors.length > 0);
  const anchorPairs = rows.reduce((s, r) => s + r.anchors.length, 0);
  const freshest = rows
    .filter((r) => r.live.minAgeH !== null)
    .map((r) => ({ col: `${r.table}.${r.col}`, age: r.live.minAgeH as number }))
    .sort((a, b) => a.age - b.age)[0];
  const freshRows = rows.reduce((s, r) => s + r.live.bins.slice(0, 8).reduce((a, b) => a + b, 0), 0);

  const by = (f: (r: ColumnRow) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(f(r), (m.get(f(r)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  console.log(`\n=== timestamp classification — ${rows.length} naive columns ===`);
  console.log(`process TZ=${PROCESS_TZ} (offset now ${settings.rows[0].offset_h}h)  db session TZ=${settings.rows[0].db_tz}  db UTC wall=${settings.rows[0].utc_wall}`);
  console.log(`calibration: known instant ${KNOWN.toISOString()} → wire '${wire}', naive column wall '${naiveWall}', timestamptz ${tzInstant}Z`);
  console.log(`now-anchor rows (any value within 8h): ${freshRows}   youngest value anywhere: ${freshest ? `${freshest.col} @ ${freshest.age}h old` : 'none'}`);
  console.log(`sibling anchors: ${anchorPairs} pair-tests over ${anchoredCols.length}/${rows.length} columns`);
  console.log('\nstatic class:'); for (const [k, v] of by((r) => r.staticClass)) console.log(`  ${k.padEnd(12)} ${v}`);
  console.log('\nverdict:'); for (const [k, v] of by((r) => r.verdict)) console.log(`  ${k.padEnd(26)} ${v}`);
  const splits = rows.filter((r) => r.verdict.startsWith('MIXED'));
  console.log(`\nmixed / flagged (${splits.length}):`);
  for (const r of splits) console.log(`  ! ${r.table}.${r.col} [${r.verdict}] — ${r.flags.join('; ')}`);

  const emitIdx = process.argv.indexOf('--emit-sql');
  if (emitIdx !== -1) {
    const outPath = process.argv[emitIdx + 1] ?? path.join(ROOT, 'lib', 'db', 'migrations', '0040_timestamptz_conversion.sql');
    fs.writeFileSync(outPath, emitMigrationSql(rows));
    console.log(`\nmigration emitted: ${path.relative(ROOT, outPath)} (${rows.length} columns)`);
    return;
  }

  // ---- Report ----
  const md: string[] = [];
  md.push('# Timestamp writer-convention classification — 2026-09-23');
  md.push('');
  md.push('**FID:** FID-20260923-001 (step 1: classify before migrating) · **Mode:** evidence-only, no DB writes');
  md.push('**Generated by:** `npx tsx scripts/classifyTimestampColumns.ts`');
  md.push(`**Process TZ:** \`${PROCESS_TZ}\` (offset at probe: ${settings.rows[0].offset_h}h) · **DB session TZ:** \`${settings.rows[0].db_tz}\` · **DB UTC wall at probe:** \`${settings.rows[0].utc_wall}\``);
  md.push('');
  md.push('## Method');
  md.push('');
  md.push('1. **Provenance (static)** — `information_schema.column_default` plus every write site in the runtime');
  md.push(`   corpus. Attribution is **ownership by nearest write statement**: every \`.insert(<ident>)\`/`);
  md.push('   `.update(<ident>)` / raw `INSERT INTO` / `UPDATE` line is an anchor for its table, and an assignment');
  md.push(`   \`prop: value\` is attributed to the anchor within **${ANCHOR_WINDOW} lines**, only when that anchor names the`);
  md.push('   column\'s table. Both write shapes are covered — inline (`values({ createdAt: new Date() })`, Δ0) and');
  md.push('   deferred (`const row = { createdAt: new Date() }; … values(row)`). Every site in §Write sites');
  md.push('   reports its Δ so the attribution can be audited.');
  md.push('');
  md.push('   *A stricter parser was tried and rejected.* A hand-rolled TS statement splitter (bracket/quote');
  md.push('   aware, splitting on `;`) **desynchronised on regex and template literals**, producing one region');
  md.push('   spanning hundreds of lines that misattributed `mapDomainPlayerToRow` to an insert and **missed the');
  md.push('   decisive `lib/playerService.ts:410`**. It was caught by re-reading the report, not by the tool, and is');
  md.push('   recorded here so it is not reintroduced.');
  md.push('2. **Population (live)** — row count, non-null count, min/max, zero-time-of-day count, future count,');
  md.push('   and the `now() - value` histogram.');
  md.push('3. **Clustering (live)** — for every sibling anchor that is a true instant (`timestamptz`, or a naive');
  md.push('   column the DB itself stamps with `DEFAULT now()`), the per-row delta `anchor_utc_wall - value` is');
  md.push('   clustered at 15-minute granularity. Two tight clusters separated by the process offset (4h/5h)');
  md.push('   **prove** two writing conventions in one column.');
  md.push('');
  md.push('**Calibration (read-only, no table touched).** A known instant passed as a JS `Date` through this driver:');
  md.push('');
  md.push('| representation | value | reading |');
  md.push('| --- | --- | --- |');
  md.push(`| true instant | \`${KNOWN.toISOString()}\` | UTC |`);
  md.push(`| what the wire carries | \`${wire}\` | ISO with offset — unambiguous |`);
  md.push(`| into a \`timestamptz\` | \`${tzInstant}\` | **correct** — the instant survives |`);
  md.push(`| into a \`timestamp\` (naive) | \`${naiveWall}\` | **process-local wall clock** — the offset is dropped |`);
  md.push('');
  md.push('So a naive column written by the app stores the process-local wall clock, while a naive column written by');
  md.push('`DEFAULT now()` (DB session = UTC) stores the UTC wall clock: the two differ by exactly the process offset.');
  md.push('');
  if (provenance) {
    md.push('**Data provenance caveat.** This database is a development fixture, not production traffic:');
    md.push(`${provenance.testLike} of ${provenance.total} \`players\` rows carry a test/seed email domain. Live evidence below`);
    md.push('therefore describes **probe and seed writes**, and a convention that is absent here may still be present in');
    md.push('production (and vice versa). Read the code split, not just the data split.');
    md.push('');
  }
  md.push('**Coverage and the `now()` anchor.** `now() - value` only discriminates when something wrote within the');
  md.push(`offset (${Math.abs(Number(settings.rows[0].offset_h))}h). On this database the youngest value anywhere is \`${freshest?.col ?? '—'}\``);
  md.push(`at **${freshest ? freshest.age : '—'}h old**, and there are ${freshRows} rows with any value inside the 8h window — the now-anchor`);
  md.push(`cannot fire. The sibling anchors carry the live leg: **${anchorPairs} pair-tests over ${anchoredCols.length} of ${rows.length} columns** (only`);
  md.push('tables holding a `timestamptz` column or a `DEFAULT now()` naive column can be anchored at all).');
  md.push('');
  md.push(`## Summary (${rows.length} naive columns)`);
  md.push('');
  md.push('| static class | columns |');
  md.push('| --- | --- |');
  for (const [k, v] of by((r) => r.staticClass)) md.push(`| ${k} | ${v} |`);
  md.push('');
  md.push('| verdict | columns |');
  md.push('| --- | --- |');
  for (const [k, v] of by((r) => r.verdict)) md.push(`| ${k} | ${v} |`);
  md.push('');
  md.push(`## Mixed-writer columns (${splits.length})`);
  md.push('');
  if (splits.length === 0) md.push('None.');
  md.push('');
  for (const r of splits) {
    md.push(`### \`${r.table}.${r.col}\` — ${r.verdict}`);
    md.push('');
    md.push(`- static class: **${r.staticClass}**${r.dbDefault ? ` · DB default \`${r.dbDefault}\`` : ''}`);
    md.push(`- population: ${r.live.nonNull}/${r.live.rows} non-null · min \`${r.live.minTxt ?? '—'}\` · max \`${r.live.maxTxt ?? '—'}\``);
    for (const a of r.anchors) {
      const shown = a.clusters.slice(0, 3).map((c) => `${c.midH.toFixed(2)}h×${c.n}`).join(', ');
      md.push(`- vs \`${a.anchor}\` (${a.anchorKind}, ${a.rows} rows): ${shown}${a.split ? ` — **SPLIT ${a.split.gapH}h**` : ''}`);
    }
    for (const f of r.flags) md.push(`- ⚠ ${f}`);
    md.push('');
    for (const s of r.sites.slice(0, 8)) md.push(`  - \`${s.file}:${s.line}\` [${s.kind} ${s.via}, ${s.scope}, Δ${s.delta}] \`${s.expr.slice(0, 90)}\` → ${VALUE_KIND_LABEL[s.valueKind]}`);
    md.push('');
  }
  md.push('## Live-layer coverage (honest limits)');
  md.push('');
  md.push(`The sibling-anchor test ran **${anchorPairs} pair-tests over ${anchoredCols.length} of ${rows.length} columns**. An anchor needs a`);
  md.push('`timestamptz` sibling (a true instant) or a `DEFAULT now()` naive sibling (a UTC wall clock) in the **same table**:');
  md.push('');
  md.push('| anchored column | anchor | rows | clusters |');
  md.push('| --- | --- | --- | --- |');
  for (const r of anchoredCols) {
    for (const a of r.anchors) {
      md.push(`| \`${r.table}.${r.col}\` | \`${a.anchor}\` (${a.anchorKind}) | ${a.rows} | ${a.clusters.slice(0, 3).map((c) => `${c.midH.toFixed(2)}h×${c.n}`).join(', ')}${a.split ? ' ⚠SPLIT' : ''} |`);
    }
  }
  md.push('');
  md.push('Everything else is **static-only**: its convention rests on provenance, not on a live measurement.');
  md.push('Two ways to close that gap, neither taken here because both write: (1) re-run during an active game session,');
  md.push('when the `now()` anchor fires; (2) a `BEGIN; INSERT …; measure; ROLLBACK` probe per table, which still needs a');
  md.push('NOT-NULL map per table.');
  md.push('');
  md.push('## Per-column detail');
  md.push('');
  md.push('| table.column | db default | static | rows | non-null | youngest (h) | min | max | anchor evidence | verdict |');
  md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    const a = r.anchors
      .slice(0, 2)
      .map((x) => `${x.anchor.split('.')[1]}: ${x.clusters.slice(0, 2).map((c) => `${c.midH.toFixed(1)}h×${c.n}`).join('/')}${x.split ? ' ⚠SPLIT' : ''}`)
      .join('; ');
    md.push(
      `| \`${r.table}.${r.col}\` | ${r.dbDefault ? '`' + r.dbDefault.slice(0, 28) + '`' : '—'} | ${r.staticClass} | ${r.live.rows} | ${r.live.nonNull} | ${r.live.minAgeH ?? '—'} | ${r.live.minTxt ?? '—'} | ${r.live.maxTxt ?? '—'} | ${a || '—'} | ${r.verdict} |`,
    );
  }
  md.push('');
  md.push('### Write sites (provenance evidence)');
  md.push('');
  for (const r of rows.filter((x) => x.sites.length)) {
    md.push(`- **\`${r.table}.${r.col}\`** (${r.staticClass})`);
    for (const s of r.sites.slice(0, 6)) md.push(`  - \`${s.file}:${s.line}\` [${s.kind} ${s.via}, ${s.scope}, Δ${s.delta}] \`${s.expr.slice(0, 90)}\` → ${VALUE_KIND_LABEL[s.valueKind]}`);
    if (r.sites.length > 6) md.push(`  - … ${r.sites.length - 6} more`);
  }
  md.push('');

  if (WRITE_REPORT) {
    fs.writeFileSync(REPORT_PATH, md.join('\n'));
    console.log(`\nreport: ${path.relative(ROOT, REPORT_PATH)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
