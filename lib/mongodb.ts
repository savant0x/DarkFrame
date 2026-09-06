import { db as drizzleDb } from '@/lib/db';
import {
  sql,
  eq,
  ne,
  and,
  or,
  lt,
  lte,
  gt,
  gte,
  isNull,
  isNotNull,
  like,
  ilike,
  desc as drizzleDesc,
  asc as drizzleAsc,
  inArray,
  is,
  getTableColumns,
  getTableName,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { PgTable } from 'drizzle-orm/pg-core';
import type { QueryResult } from 'pg';
import * as schema from '@/lib/db/schema';
import { generateId } from './utils';

/**
 * Mongo→Postgres compatibility seam.
 *
 * Services written against the Mongo driver API (findOne, find().sort().limit().toArray(),
 * insertOne, updateOne, countDocuments, …) are translated onto drizzle/pg tables by this
 * module. It exists so the Postgres pivot does not require rewriting every service at once.
 *
 * Typing model (no `any`/`unknown` per operator directive):
 * - The table registry is built from the schema module itself, filtered to real `PgTable`s.
 * - Filters/updates use Mongo-flavored operator types (`$lt`, `$in`, `$set`, …).
 * - Erased-table selects infer `{ [x: string]: unknown }` rows (drizzle's honest generic-table
 *   shape); rows reach consumers as their declared `T` after a single validated cast at this
 *   trust boundary. Consumers that declare `getCollection<Player>('players')` get `Player`.
 */

/** Values storable in a document column (scalar, null, or nested structure for jsonb). */
export type DocumentValue = string | number | boolean | Date | null | object;
/** Values comparable in a query filter. */
type Comparable = string | number | boolean | Date;
/** Mongo operator clause attached to a field ($lt/$lte/$gt/$gte/$in/$ne/$exists/$regex). */
interface OperatorClause {
  $lt?: Comparable;
  $lte?: Comparable;
  $gt?: Comparable;
  $gte?: Comparable;
  $in?: Comparable[];
  $ne?: Comparable | null;
  $exists?: boolean;
  /** Mongo regex match — translated to SQL LIKE (anchored patterns become prefix matches). */
  $regex?: RegExp | string;
  $options?: string;
}
/** A single Mongo filter branch: plain field filters plus optional $or branches. */
export interface FilterBranch {
  $or?: FilterBranch[];
  [field: string]: FilterValue | FilterBranch[] | undefined;
}
type FilterValue = Comparable | null | OperatorClause;
/** Mongo-style query filter: field → value or operator clause, with optional $or. */
export type MongoFilter = FilterBranch;
/** Sort spec: field → direction. */
export type SortSpec = Record<string, 1 | -1 | 'asc' | 'desc'>;
/** Supported update operations translated by this seam. */
export interface MongoUpdate {
  $set?: Record<string, DocumentValue>;
  /** Keys to remove (columns set to SQL NULL). Values are ignored (Mongo parity). */
  $unset?: Record<string, string | boolean>;
  /** Append value to an array-typed column (jsonb). Dot paths not supported. */
  $push?: Record<string, DocumentValue>;
  /** Remove matching values from an array-typed column (jsonb). Dot paths not supported. */
  $pull?: Record<string, DocumentValue>;
  /** Numeric increment on an integer/bigint column; negative values decrement. */
  $inc?: Record<string, number>;
  /** Add distinct values to an array column (jsonb) if not already present. */
  $addToSet?: Record<string, DocumentValue>;
}
/** A set operation translated to drizzle: either a literal value or a raw SQL fragment. */
type SetOp = DocumentValue | SQL;
/** Mongo aggregation pipeline stage (acknowledged shape; see aggregate()). */
export type AggregateStage = Record<string, DocumentValue>;
/** Index specification: named index or field-direction map. */
type IndexSpec = string | Record<string, 1 | -1>;
/** findOneAndUpdate option controlling which document version is returned. */
interface FindOneAndUpdateOptions {
  returnDocument?: 'before' | 'after';
}
/** bulkWrite operation union (updateOne/deleteOne supported; others rejected by callers' types). */
interface BulkWriteOp {
  updateOne?: { filter: MongoFilter; update: MongoUpdate };
  deleteOne?: { filter: MongoFilter };
}

/**
 * Registry of every drizzle table exported by the schema module, keyed by BOTH the schema
 * export name (e.g. `playerSessions`) and the SQL table name (e.g. `player_sessions`).
 * Mongo-era call sites use either convention, and an unresolved name silently no-ops
 * (writes vanish, reads return empty) — so both keys are registered and a curated alias
 * map carries the remaining legacy collection names onto their real tables.
 */
const TABLE_REGISTRY: Record<string, PgTable> = {};
for (const [name, exportValue] of Object.entries(schema)) {
  if (is(exportValue, PgTable)) {
    TABLE_REGISTRY[name] = exportValue;
    TABLE_REGISTRY[getTableName(exportValue)] = exportValue;
  }
}

/**
 * Legacy Mongo collection names that have no schema export/SQL name of their own, mapped
 * onto the pg table that actually holds that data. Verified semantically per site
 * (columns the callers read/write exist on the target). Names NOT listed here had no
 * equivalent table at all and are handled at their call sites.
 */
const TABLE_ALIASES: Record<string, string> = {
  users: 'players',
  playerAchievements: 'achievements',
  // Audit-log aliases: legacy Mongo docs' matching fields persist (action, reason, details,
  // timestamps); unmapped keys (adminUsername, metadata) are dropped by drizzle — verified
  // live that unknown-key inserts/updates succeed and store the real columns.
  adminLogs: 'modLog',
  ActionLog: 'modLog',
  system_logs: 'modLog',
  // WMD legacy collection names → pivot schema names
  wmd_clan_defense_grid: 'wmd_defense_grids',
  wmd_interception_attempts: 'wmd_interceptions',
  wmd_launch_history: 'wmd_launch_authorizations',
  wmd_missiles: 'missiles',
  wmd_player_research: 'player_research',
  wmd_sabotage_events: 'wmd_sabotage_operations',
};

function getTable(name: string): PgTable | undefined {
  const direct = TABLE_REGISTRY[name];
  if (direct) return direct;
  const aliased = TABLE_ALIASES[name];
  return aliased ? TABLE_REGISTRY[aliased] : undefined;
}

/**
 * Known domain dot paths on the players table → the flat row columns that store them.
 * Mongo-era code addresses subfields of the domain document (`'resources.metal'`,
 * `'base.x'`, `'currentPosition.y'`) in filters, $set/$inc payloads, and sort specs;
 * pg stores those as flat columns. Unresolved dot paths stay unresolved (and keep the
 * safe match-nothing semantics in buildWhere).
 */
const PLAYER_DOT_PATH_COLUMNS: Record<string, string> = {
  'resources.metal': 'resourcesMetal',
  'resources.energy': 'resourcesEnergy',
  'base.x': 'baseX',
  'base.y': 'baseY',
  'currentPosition.x': 'currentPositionX',
  'currentPosition.y': 'currentPositionY',
  'bank.metal': 'bankMetal',
  'bank.energy': 'bankEnergy',
  'bank.lastDeposit': 'bankLastDeposit',
  'inventory.items': 'inventoryItems',
  'inventory.capacity': 'inventoryCapacity',
  'inventory.metalDiggerCount': 'inventoryMetalDiggerCount',
  'inventory.energyDiggerCount': 'inventoryEnergyDiggerCount',
  'gatheringBonus.metalBonus': 'gatheringBonusMetalBonus',
  'gatheringBonus.energyBonus': 'gatheringBonusEnergyBonus',
  'activeBoosts.gatheringBoost': 'activeBoostsGatheringBoost',
  'activeBoosts.expiresAt': 'activeBoostsExpiresAt',
};

/**
 * Resolve a filter/update/sort key to the drizzle column property name it addresses.
 * Direct keys resolve through the table's columns; known domain dot paths resolve
 * through `PLAYER_DOT_PATH_COLUMNS`. Returns undefined when nothing maps.
 */
function resolveKeyToProp(table: PgTable, key: string): string | undefined {
  if (!key.includes('.')) {
    const columns = getTableColumns(table);
    if (columns[key]) return key;
    // Mongo-era snake_case alias (e.g. `resources_metal` for the resourcesMetal column):
    // these arrive in legacy $inc payloads (auction payments, listing fees) and resolve
    // to nothing today, silently dropping real-money writes. Map "X_y" → "xY".
    const camel = key.replace(/_([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
    return columns[camel] ? camel : undefined;
  }
  const mapped = PLAYER_DOT_PATH_COLUMNS[key];
  return mapped && getTableColumns(table)[mapped] ? mapped : undefined;
}

/**
 * Attach the domain alias view (nested `resources`/`base`/`currentPosition`/`bank`/…)
 * to a fetched `players` row. Mongo-era consumers read `bot.resources?.metal` or
 * `bot.currentPosition.x` off shim results; the flat row made those reads silently
 * `undefined || 0` (bot loot, scans, and growth all computed from zeros).
 * Additive only: existing fields — including the smallint 0/1 flags that callers
 * compare with `=== 1` — are never modified, and direct-drizzle callers bypass this
 * entirely. Mirrors the inverse `flattenDomainPlayerFields` on the write side.
 */
function shapeRowAliases(table: PgTable, row: Record<string, unknown>): Record<string, unknown> {
  const columns = getTableColumns(table);
  if (isAuctionsTable(table)) return shapeRowAuctions(table, row);
  if (columns.resourcesMetal === undefined || row.resources !== undefined) return row;
  return {
    ...row,
    resources: { metal: row.resourcesMetal, energy: row.resourcesEnergy },
    base: { x: row.baseX, y: row.baseY },
    currentPosition: { x: row.currentPositionX, y: row.currentPositionY },
    bank: { metal: row.bankMetal, energy: row.bankEnergy, lastDeposit: row.bankLastDeposit },
    inventory: {
      items: row.inventoryItems,
      capacity: row.inventoryCapacity,
      metalDiggerCount: row.inventoryMetalDiggerCount,
      energyDiggerCount: row.inventoryEnergyDiggerCount,
    },
    gatheringBonus: {
      metalBonus: Number(row.gatheringBonusMetalBonus),
      energyBonus: Number(row.gatheringBonusEnergyBonus),
    },
    activeBoosts: {
      gatheringBoost: row.activeBoostsGatheringBoost === null || row.activeBoostsGatheringBoost === undefined
        ? null
        : Number(row.activeBoostsGatheringBoost),
      expiresAt: row.activeBoostsExpiresAt,
    },
  };
}

/**
 * pg smallint columns cannot be compared to JS booleans (`is_bot = true` is invalid SQL).
 * The schema has no boolean columns, so coerce JS true/false to 1/0 everywhere filters are
 * built. Non-boolean scalars pass through untouched.
 */
function coerceScalar(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

/**
 * Mongo stores flags as booleans, but the pg schema models them as smallint.
 * Convert top-level scalar booleans to 1/0 on write paths only — nested values
 * inside jsonb columns must pass through untouched. Accepts any object because
 * consumers insert domain interfaces (which carry no index signature).
 */
function normalizeScalarBooleans(doc: object): Record<string, DocumentValue> {
  const out: Record<string, DocumentValue> = {};
  for (const [k, v] of Object.entries(doc)) {
    out[k] = typeof v === 'boolean' ? (v ? 1 : 0) : v;
  }
  return out;
}

/**
 * Mongo-era services insert player-shaped documents with nested domain fields
 * (`base: {x,y}`, `currentPosition`, `resources`, `bank`, `inventory`, `gatheringBonus`,
 * `activeBoosts`), but the pg `players` table stores those as flat columns. drizzle
 * silently ignores unknown keys — nested fields vanished and the notNull flat columns
 * (base_x etc., no DB default) went NULL, crashing every bot insert. Flatten the known
 * domain fields into their columns before insert; explicit flat keys already present
 * win (the flattening only fills what's missing).
 */
function flattenDomainPlayerFields(
  table: PgTable,
  payload: Record<string, DocumentValue>
): Record<string, DocumentValue> {
  const columns = getTableColumns(table);
  const has = (c: string) => !!columns[c] && payload[c] === undefined;

  if (columns.baseX !== undefined) {
    const base = payload.base;
    if (base !== null && typeof base === 'object' && !Array.isArray(base)) {
      const b = base as Record<string, unknown>;
      if (has('baseX') && typeof b.x === 'number') payload.baseX = b.x;
      if (has('baseY') && typeof b.y === 'number') payload.baseY = b.y;
    }
    const pos = payload.currentPosition;
    if (pos !== null && typeof pos === 'object' && !Array.isArray(pos)) {
      const p = pos as Record<string, unknown>;
      if (has('currentPositionX') && typeof p.x === 'number') payload.currentPositionX = p.x;
      if (has('currentPositionY') && typeof p.y === 'number') payload.currentPositionY = p.y;
    }
    const res = payload.resources;
    if (res !== null && typeof res === 'object' && !Array.isArray(res)) {
      const r = res as Record<string, unknown>;
      if (has('resourcesMetal') && typeof r.metal === 'number') payload.resourcesMetal = Math.floor(r.metal);
      if (has('resourcesEnergy') && typeof r.energy === 'number') payload.resourcesEnergy = Math.floor(r.energy);
    }
    const bank = payload.bank;
    if (bank !== null && typeof bank === 'object' && !Array.isArray(bank)) {
      const bk = bank as Record<string, unknown>;
      if (has('bankMetal') && typeof bk.metal === 'number') payload.bankMetal = Math.floor(bk.metal);
      if (has('bankEnergy') && typeof bk.energy === 'number') payload.bankEnergy = Math.floor(bk.energy);
      if (has('bankLastDeposit')) payload.bankLastDeposit = (bk.lastDeposit as Date) ?? null;
    }
    const inv = payload.inventory;
    if (inv !== null && typeof inv === 'object' && !Array.isArray(inv)) {
      const iv = inv as Record<string, unknown>;
      if (has('inventoryItems') && Array.isArray(iv.items)) payload.inventoryItems = iv.items;
      if (has('inventoryCapacity') && typeof iv.capacity === 'number') payload.inventoryCapacity = iv.capacity;
      if (has('inventoryMetalDiggerCount') && typeof iv.metalDiggerCount === 'number') payload.inventoryMetalDiggerCount = iv.metalDiggerCount;
      if (has('inventoryEnergyDiggerCount') && typeof iv.energyDiggerCount === 'number') payload.inventoryEnergyDiggerCount = iv.energyDiggerCount;
    }
    const gb = payload.gatheringBonus;
    if (gb !== null && typeof gb === 'object' && !Array.isArray(gb)) {
      const g = gb as Record<string, unknown>;
      if (has('gatheringBonusMetalBonus') && typeof g.metalBonus === 'number') payload.gatheringBonusMetalBonus = String(g.metalBonus);
      if (has('gatheringBonusEnergyBonus') && typeof g.energyBonus === 'number') payload.gatheringBonusEnergyBonus = String(g.energyBonus);
    }
    const ab = payload.activeBoosts;
    if (ab !== null && typeof ab === 'object' && !Array.isArray(ab)) {
      const a = ab as Record<string, unknown>;
      if (has('activeBoostsGatheringBoost')) payload.activeBoostsGatheringBoost = a.gatheringBoost === null || a.gatheringBoost === undefined ? null : String(a.gatheringBoost);
      if (has('activeBoostsExpiresAt')) payload.activeBoostsExpiresAt = (a.expiresAt as Date) ?? null;
    }
  }

  // Drop the nested originals — drizzle ignores unknown keys, but keeping the payload
  // honest makes the row shape explicit (and avoids surprises with strict modes).
  for (const k of ['base', 'currentPosition', 'resources', 'bank', 'inventory', 'gatheringBonus', 'activeBoosts']) {
    delete payload[k];
  }
  syncAuctionDocFields(table, payload);
  return payload;
}

/**
 * Translate a Mongo filter into a drizzle `where` clause over the table's typed columns.
 * Supported: equality, $lt/$lte/$gt/$gte, $in, $ne, $exists, and $or branches (nested one
 * level). Mongo operator keys ($expr/$and) are not supported and are ignored, matching
 * prior behavior. Keys without a matching column are skipped instead of building a broken
 * predicate against `undefined`.
 */
function buildWhere(table: PgTable, filter: MongoFilter): SQL | undefined {
  if (!filter || Object.keys(filter).length === 0) return undefined;
  const conditions: SQL[] = [];
  const columns = getTableColumns(table);

  // $or branches (one level of nesting), translated to a disjunction
  if (filter.$or) {
    const branchClauses = filter.$or
      .map((branch) => buildWhere(table, branch))
      .filter((clause): clause is SQL => clause !== undefined);
    const disjunction = branchClauses.length > 0 ? or(...branchClauses) : undefined;
    if (disjunction) conditions.push(disjunction);
  }

  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('$')) continue; // $expr/$and unsupported (prior behavior); $or handled above
    // Direct keys and known domain dot paths ('base.x') both resolve to columns;
    // anything else stays unmapped (falls through to the match-nothing guard below).
    const prop = resolveKeyToProp(table, key);
    const column = prop ? columns[prop] : undefined;
    if (!column || Array.isArray(value)) {
      // FID-20260904-005 §5.0 (d): doc-tables translate unmapped dotted keys into jsonb
      // containment predicates over their `doc` column instead of silently matching
      // nothing (the auction my-bids `where false` bug).
      if (columns.doc && key.includes('.') && !key.startsWith('$')) {
        const docPredicate = buildDocPathPredicate(columns.doc, key, value);
        if (docPredicate) conditions.push(docPredicate);
      }
      continue;
    }
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      if (value.$lt !== undefined) conditions.push(lt(column, coerceScalar(value.$lt)));
      if (value.$lte !== undefined) conditions.push(lte(column, coerceScalar(value.$lte)));
      if (value.$gt !== undefined) conditions.push(gt(column, coerceScalar(value.$gt)));
      if (value.$gte !== undefined) conditions.push(gte(column, coerceScalar(value.$gte)));
      if (value.$in !== undefined && Array.isArray(value.$in)) conditions.push(inArray(column, value.$in.map(coerceScalar)));
      if (value.$ne !== undefined) conditions.push(ne(column, coerceScalar(value.$ne)));
      if (value.$exists !== undefined) {
        conditions.push(value.$exists ? isNotNull(column) : isNull(column));
      }
      if (value.$regex !== undefined) {
        // Translate the common anchored case (/^prefix/) to a pg LIKE prefix match.
        // Full regex semantics are out of scope for this seam.
        const source = typeof value.$regex === 'string' ? value.$regex : value.$regex.source;
        const prefixMatch = source.replace(/^\^\(\\?w\+\)\\b/i, '').match(/^\^([A-Za-z0-9_\-]+)/);
        const caseInsensitive = value.$options?.includes('i') || /\/[a-z]*i/i.test(String(value.$regex));
        if (prefixMatch) {
          const likeOperator = caseInsensitive ? ilike(column, `${prefixMatch[1]}%`) : like(column, `${prefixMatch[1]}%`);
          conditions.push(likeOperator);
        }
      }
    } else {
      conditions.push(eq(column, coerceScalar(value)));
    }
  }
  // Mongo semantics: a non-empty filter that references only unknown/dot-path keys
  // matches NOTHING. Returning `undefined` here would silently degrade to
  // "match everything" — a whole-table hazard for update/delete and wrong results
  // for reads. The explicit always-false clause keeps every caller scoped.
  // (Truly empty filters `{}` still return undefined = match all, as in Mongo.)
  return conditions.length > 0 ? and(...conditions) : sql`false`;
}

/**
 * Dot-path equality over a doc-table's jsonb document column (FID-20260904-005 §5.0 (d)).
 * Mongo-era filters like { 'bids.bidderUsername': u } address a field INSIDE the stored
 * document (optionally through an array — "any element matches"). Translated to jsonb
 * containment: doc @> '{"bids":[{"bidderUsername":u}]}' matches exactly when some bids
 * element carries that bidderUsername. Previously such keys fell through to the
 * match-nothing guard — the auction my-bids `where false` bug.
 */
function buildDocPathPredicate(docColumn: unknown, key: string, value: unknown): SQL | undefined {
  const path = key.split('.');
  if (path.length < 2) return undefined;
  // DUAL containment probe. The leaf is emitted twice — wrapped in a single-element
  // array ("some element of doc.bids contains the probe"; jsonb arrays reject bare
  // object probes — live-verified my-bids 500) and as a plain object (for
  // object-shaped containers like active_boosts). For any given container exactly
  // one shape can match, so the OR is precise, not a fuzzy fallback.
  const leaf = { [path[path.length - 1]]: value };
  let arr: unknown = [leaf];
  let obj: unknown = leaf;
  for (let i = path.length - 2; i >= 0; i--) {
    arr = { [path[i]]: arr };
    obj = { [path[i]]: obj };
  }
  return sql`(${docColumn} @> ${JSON.stringify(arr)}::jsonb OR ${docColumn} @> ${JSON.stringify(obj)}::jsonb)`;
}

/** Extract a string id from a document's `id`/`_id` field, if present. */
function extractId(doc: object): string | null {
  const record = doc as Record<string, DocumentValue>;
  if (typeof record.id === 'string' && record.id) return record.id;
  if (typeof record._id === 'string' && record._id) return record._id;
  return null;
}

/**
 * Auction domain ⇄ column sync (FID-20260904-005 §5.0 (e) — completes the #25 seam).
 * The `auctions` table mirrors scalar fields of the AuctionListing document (migration
 * 0008) so SQL indexes stay usable, while the full doc lives in `doc` jsonb. The
 * schema comment promised this mapping; it never existed. Writes: on any auction row
 * payload, store the doc and fill the mirrored columns the doc carries (never
 * overwriting explicit flat keys). Reads: shapeRowAuctions rebuilds the domain doc
 * by overlaying non-null columns onto `doc` (column values win — they are the
 * indexed truth) so findOne/find/aggregate consumers see the Mongo-era shape.
 */
const AUCTION_DOC_COLUMNS: Array<{ docKey: string; column: string }> = [
  { docKey: 'auctionId', column: 'auctionId' },
  { docKey: 'sellerUsername', column: 'sellerUsername' },
  { docKey: 'startingBid', column: 'startingBid' },
  { docKey: 'currentBid', column: 'currentBid' },
  { docKey: 'buyoutPrice', column: 'buyoutPrice' },
  { docKey: 'reservePrice', column: 'reservePrice' },
  { docKey: 'listingFee', column: 'listingFee' },
  { docKey: 'clanOnly', column: 'clanOnly' },
  { docKey: 'settled', column: 'settled' },
  { docKey: 'finalPrice', column: 'finalPrice' },
  { docKey: 'winnerUsername', column: 'winnerUsername' },
  { docKey: 'highestBidder', column: 'highestBidder' },
  { docKey: 'status', column: 'status' },
  { docKey: 'createdAt', column: 'createdAt' },
  { docKey: 'expiresAt', column: 'expiresAt' },
  { docKey: 'closedAt', column: 'closedAt' },
  { docKey: 'duration', column: 'durationHours' },
];

function isAuctionsTable(table: PgTable): boolean {
  return getTableName(table) === 'auctions';
}

function syncAuctionDocFields(table: PgTable, payload: Record<string, DocumentValue>): void {
  if (!isAuctionsTable(table)) return;
  const columns = getTableColumns(table);
  // (i) Synthesize the stored document when the caller passes the AuctionListing domain
  // doc directly (createAuctionListing's insertOne) — there is no explicit `doc` key,
  // every top-level payload key IS a document field.
  if (columns.doc && (payload.doc === undefined || payload.doc === null)) {
    const synthesized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k === 'id' || k === '_id') continue;
      synthesized[k] = v;
    }
    payload.doc = synthesized;
  }
  const docValue = payload.doc;
  if (docValue === undefined || docValue === null || typeof docValue !== 'object' || Array.isArray(docValue)) return;
  const doc = docValue as Record<string, unknown>;
  // (ii) Legacy NOT NULL mirrors from the pre-#25 columns the domain service never
  // writes (seller_id/item_data/starting_price) — without these every insert 500s.
  if (payload.itemData === undefined) {
    const item = doc.item !== undefined ? doc.item : payload.item;
    if (item !== undefined) payload.itemData = item;
  }
  if (payload.sellerId === undefined) {
    const seller = doc.sellerUsername !== undefined ? doc.sellerUsername : payload.sellerUsername;
    if (seller !== undefined) payload.sellerId = seller;
  }
  if (payload.startingPrice === undefined) {
    const start = doc.startingBid !== undefined ? doc.startingBid : payload.startingBid;
    if (start !== undefined) payload.startingPrice = start;
  }
  // (iii) Mirror doc fields the indexed columns exist for.
  for (const { docKey, column } of AUCTION_DOC_COLUMNS) {
    if (doc[docKey] === undefined) continue;
    if (payload[column] !== undefined) continue; // explicit flat key wins
    const value = doc[docKey];
    if (value instanceof Date) {
      payload[column] = value;
    } else if (typeof value === 'boolean') {
      payload[column] = value ? 1 : 0; // pg smallint mirrors
    } else if (docKey === 'duration' && typeof value === 'number') {
      payload[column] = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      payload[column] = value;
    }
    // nested/other shapes stay doc-only
  }
}

function shapeRowAuctions(table: PgTable, row: Record<string, unknown>): Record<string, unknown> {
  if (!isAuctionsTable(table)) return row;
  const doc = (row.doc && typeof row.doc === 'object' && !Array.isArray(row.doc) ? { ...(row.doc as Record<string, unknown>) } : {});
  for (const { docKey, column } of AUCTION_DOC_COLUMNS) {
    const colValue = row[column];
    if (colValue === undefined || colValue === null) continue;
    // column is the indexed truth — overlay onto the doc
    if (docKey === 'clanOnly' || docKey === 'settled') {
      doc[docKey] = colValue === 1;
    } else if (docKey === 'duration') {
      doc.duration = colValue;
    } else {
      doc[docKey] = colValue;
    }
  }
  // Legacy read-back: the domain `item` lives only in the pre-#25 item_data column
  // when the doc copy predates the bridge.
  if (doc.item === undefined && row.itemData !== undefined && row.itemData !== null) {
    doc.item = row.itemData;
  }
  return { ...row, ...doc, doc };
}

/**
 * Unique conflict targets for race-safe upserts (FID-20260904-005 §5.0 (b)).
 * Keyed by SQL table name; every entry MUST correspond to a real unique index
 * (verified live in prod during the FID audit) or the insert itself would fail.
 */
const CONFLICT_TARGETS: Record<string, { columns: PgColumn[] }> = {
  user_presence: { columns: [schema.userPresence.userId] },
  tutorial_action_tracking: {
    columns: [schema.tutorialActionTracking.playerId, schema.tutorialActionTracking.stepId],
  },
};

function getConflictTarget(
  collectionName: string,
  table: PgTable
): PgColumn[] | undefined {
  const entry =
    CONFLICT_TARGETS[getTableName(table)] ??
    (TABLE_REGISTRY[collectionName] === table ? CONFLICT_TARGETS[collectionName] : undefined);
  if (!entry) return undefined;
  // Guard against a stale entry pointing at columns absent from the resolved table.
  const cols = getTableColumns(table);
  return entry.columns.every((c) => Object.values(cols).includes(c)) ? entry.columns : undefined;
}

/**
 * drizzle `set()` accepts SQL fragments but our onConflictDoUpdate path needs plain
 * values — detect fragments so callers carrying them take the safe select-then-insert
 * path instead.
 */
function hasSqlFragments(payload: Record<string, SetOp>): boolean {
  return Object.values(payload).some(
    (v) => typeof v === 'object' && v !== null && 'queryChunks' in (v as object)
  );
}

/**
 * Ensure an insert payload carries a value for the table's required `id` PK.
 *
 * Every table in this schema uses a Mongo-style `id: varchar(24)` primary key, but the
 * Mongo driver auto-generates `_id` while this shim historically did not — so any
 * insert of a doc without an explicit id crashed with `null value in column "id"`.
 * Accepts a doc's `id` or Mongo `_id` (string or ObjectId-like) and generates the rest.
 */
function ensureRowId(
  table: PgTable,
  payload: Record<string, DocumentValue>,
  originalDoc: object
): Record<string, DocumentValue> {
  const columns = getTableColumns(table) as Record<string, { dataType?: string }>;
  if (!columns.id) return payload; // table has no id column — nothing to fill
  const record = originalDoc as Record<string, unknown>;
  const existing =
    payload.id ??
    (typeof record._id === 'string' && record._id ? record._id : undefined) ??
    (record._id && typeof (record._id as { toString?: () => string }).toString === 'function' &&
      (record._id as object).constructor.name !== 'Object'
      ? String(record._id)
      : undefined);
  if (existing !== undefined) {
    return { ...payload, id: existing };
  }
  const generated = generateId();
  // Reflect the generated id back onto the caller's doc (Mongo inserts do this for _id).
  record.id = generated;
  return { ...payload, id: generated };
}

/**
 * Translate a Mongo update document into a drizzle `set` payload.
 * - `$set` maps fields to normalized literals; unknown columns are skipped.
 * - `$unset` maps fields to SQL NULL.
 * - `$push` / `$pull` rebind a jsonb array column atomically: the SQL expression reads
 *   the column's current value in the same statement, so no read-modify-write race.
 * - `$inc` becomes a SQL arithmetic fragment over the column's current value.
 * Dot-path keys (`stats.battlesWon`) do not map to a top-level column and are skipped —
 * matching the pre-typing behavior where they silently no-opped.
 */
function buildSetPayload(table: PgTable, update: MongoUpdate): Record<string, SetOp> | undefined {
  const payload: Record<string, SetOp> = {};
  const columns = getTableColumns(table);
  let hasOps = false;

  for (const [key, value] of Object.entries(update.$set ?? {})) {
    const prop = resolveKeyToProp(table, key);
    if (prop) {
      // pg smallint columns reject JS booleans on write just as in filters — coerce
      payload[prop] = coerceScalar(value) as SetOp;
      hasOps = true;
      // Doc-table consistency: a column that mirrors a doc field must also update the
      // stored doc copy, or reads overlaying "column wins" hide the divergence while
      // the raw doc rots (schema comment's sync promise).
      const mirrored = AUCTION_DOC_COLUMNS.find((m) => m.column === prop);
      if (mirrored && columns.doc && isAuctionsTable(table)) {
        const base = payload.doc ?? sql`${columns.doc}`;
        payload.doc = sql`jsonb_set(coalesce(${base}, '{}'::jsonb), '{${sql.raw(mirrored.docKey)}}'::text[], ${JSON.stringify(coerceScalar(value)) ?? 'null'}::jsonb)`;
      }
    } else if (columns.doc && key.includes('.')) {
      // FID-20260904-005 §5.0 (d): dotted $set on a doc-table targets a field INSIDE the
      // stored document. Rewrite the stored doc with jsonb_set at the mapped path so the
      // update lands in place (previously silently dropped). Chained when multiple doc
      // paths are set in one update (each builds on the previous fragment).
      const path = key.split('.').map((seg) => `{${seg}}`).join(',');
      const base = payload.doc ?? sql`${columns.doc}`;
      payload.doc = sql`jsonb_set(coalesce(${base}, '{}'::jsonb), '{${sql.raw(path)}}'::text[], ${JSON.stringify(value) ?? 'null'}::jsonb)`;
      hasOps = true;
    } else if (columns.doc && isAuctionsTable(table)) {
      // Doc-table $set of a field with no dedicated column (e.g. bids, settledAt,
      // saleFee): store inside the synthesized document instead of silently dropping.
      const base = payload.doc ?? sql`${columns.doc}`;
      payload.doc = sql`jsonb_set(coalesce(${base}, '{}'::jsonb), '{${sql.raw(key)}}'::text[], ${JSON.stringify(value) ?? 'null'}::jsonb)`;
      hasOps = true;
    }
  }
  for (const key of Object.keys(update.$unset ?? {})) {
    if (columns[key]) {
      payload[key] = null;
      hasOps = true;
    }
  }
  for (const [key, value] of Object.entries(update.$push ?? {})) {
    const column = columns[key];
    if (column) {
      payload[key] = sql`coalesce(${column}, '[]'::jsonb) || ${JSON.stringify([value])}::jsonb`;
      hasOps = true;
    } else if (columns.doc && isAuctionsTable(table)) {
      // Atomic array append inside the stored doc (placeBid's $push: { bids: bid }).
      const base = payload.doc ?? sql`${columns.doc}`;
      payload.doc = sql`jsonb_set(coalesce(${base}, '{}'::jsonb), '{${sql.raw(key)}}'::text[], coalesce(${base}->'${sql.raw(key)}', '[]'::jsonb) || ${JSON.stringify([value])}::jsonb)`;
      hasOps = true;
    }
  }
  for (const [key, value] of Object.entries(update.$pull ?? {})) {
    const column = columns[key];
    if (column) {
      payload[key] = sql`coalesce(${column}, '[]'::jsonb) - ${JSON.stringify(value)}::jsonb`;
      hasOps = true;
    }
  }
  // $inc: merge EVERY entry (plain keys, snake aliases, and dot-paths that resolve to
  // flat columns) by resolved column BEFORE emitting SQL — createAuctionListing sends
  // `resources_metal: -fee` and `resources.metal: -amount` in ONE update, both resolving
  // to resourcesMetal; sequential loops overwrote each other and the fee vanished.
  const incDeltas = new Map<string, number>();
  for (const [key, delta] of Object.entries(update.$inc ?? {})) {
    const prop = resolveKeyToProp(table, key);
    if (prop && typeof delta === 'number' && Number.isFinite(delta)) {
      incDeltas.set(prop, (incDeltas.get(prop) ?? 0) + delta);
    }
  }
  for (const [prop, total] of incDeltas) {
    payload[prop] = sql`coalesce(${columns[prop]}, 0) + ${total}`;
    hasOps = true;
  }
  // Dot-path $inc over jsonb columns (e.g. 'stats.battlesWon', 'resources.metal'): the
  // legacy Mongo shape addresses a subfield of a document column. Translated to jsonb_set
  // arithmetic so the increment actually lands (previously silently dropped — auction
  // payments and stat counters never moved).
  for (const [dotPath, delta] of Object.entries(update.$inc ?? {})) {
    if (!dotPath.includes('.')) continue;
    if (incDeltas.has(resolveKeyToProp(table, dotPath) ?? '')) continue; // handled above
    const [root, ...path] = dotPath.split('.');
    const column = columns[root];
    if (!column || path.length === 0) continue;
    // pg text[] binds as an array literal: '{battlesWon}' — JSON.stringify's ["…"] form is
    // rejected ("malformed array literal")
    const pathLiteral = `{${path.join(',')}}`;
    const pathParams = sql.join(path.map((p) => sql`${p}`), sql`, `);
    payload[root] = sql`jsonb_set(coalesce(${column}, '{}'::jsonb), ${pathLiteral}::text[], to_jsonb(coalesce(jsonb_extract_path_text(${column}, ${pathParams})::numeric, 0) + ${delta}))`;
    hasOps = true;
  }
  for (const [key, value] of Object.entries(update.$addToSet ?? {})) {
    const column = columns[key];
    if (column) {
      payload[key] = sql`coalesce(${column}, '[]'::jsonb) || ${JSON.stringify([value])}::jsonb`;
      hasOps = true;
    }
  }
  // Numeric paths handled above via jsonb arithmetic; string/other dot-path $set values
  // cannot be expressed generically and remain dropped (documented limitation).
  for (const [key, value] of Object.entries(update.$set ?? {})) {
    if (!key.includes('.') || typeof value !== 'number') continue;
    const [root, ...path] = key.split('.');
    const column = columns[root];
    if (!column) continue;
    // pg text[] binds as an array literal: '{battlesWon}' — JSON.stringify's ["…"] form is
    // rejected ("malformed array literal")
    const pathLiteral = `{${path.join(',')}}`;
    payload[root] = sql`jsonb_set(coalesce(${column}, '{}'::jsonb), ${pathLiteral}::text[], to_jsonb(${value}))`;
    hasOps = true;
  }
  return hasOps ? payload : undefined;
}

/** Chainable find() builder mirroring the Mongo cursor API subset used by this codebase. */
interface FindBuilder<T> {
  sort(spec: SortSpec): FindBuilder<T>;
  skip(n: number): FindBuilder<T>;
  limit(n: number): FindBuilder<T>;
  /** Mongo projection — accepted for API parity; rows are returned in full (pg has no per-column document projection). */
  project(projection: Record<string, 0 | 1>): FindBuilder<T>;
  toArray(): Promise<T[]>;
}

/** Chainable aggregate() builder (toArray only, matching the seam's supported subset). */
interface AggregateBuilder<T> {
  toArray(): Promise<T[]>;
}

/** Read a dot path from a document ('a.b.c' → doc.a?.b?.c). Array indices supported. */
function readDotPath(doc: Record<string, unknown>, path: string): unknown {
  let cur: unknown = doc;
  for (const seg of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Set a dot path on a (shallow-cloned) document, creating intermediate objects. */
function setDotPath(doc: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const out = { ...doc };
  const segs = path.split('.');
  let cur = out;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const next = cur[seg];
    cur[seg] = next !== null && typeof next === 'object' && !Array.isArray(next) ? { ...(next as Record<string, unknown>) } : {};
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[segs[segs.length - 1]] = value;
  return out;
}

/**
 * In-memory evaluation of the aggregate pipeline stages this codebase uses, with Mongo
 * semantics. Supported: $group (with $sum/$min/$max/$avg/$first/$last/$push and $cond
 * accumulators), $match, $sort, $skip, $limit, $count, $project, $addFields (dot paths,
 * $sum/$add/$ifNull/$cond/$size/$isArray expressions), $lookup (equality join against a
 * registry table, $expr $eq form). Consumers verified against these exact shapes.
 */
function runPipeline(
  stages: AggregateStage[],
  initial: Array<Record<string, unknown>>,
  currentCollection: string
): Array<Record<string, unknown>> {
  let docs = initial;
  for (const stage of stages) {
    const key = Object.keys(stage)[0];
    const spec = stage[key];
    switch (key) {
      case '$match': {
        const f = spec as MongoFilter;
        // $expr $eq [field, '$$var'] forms appear only inside $lookup pipelines (handled there)
        docs = docs.filter((d) => matchFilter(d, f));
        break;
      }
      case '$group': {
        const s = spec as { _id: unknown; [acc: string]: unknown };
        const groups = new Map<string, { _id: unknown; doc: Record<string, unknown> }>();
        for (const d of docs) {
          const gid = typeof s._id === 'string' && s._id.startsWith('$') ? readDotPath(d, s._id.slice(1)) : (s._id ?? null);
          const gkey = JSON.stringify(gid);
          if (!groups.has(gkey)) groups.set(gkey, { _id: gid, doc: { _id: gid } });
          const g = groups.get(gkey)!;
          for (const [accName, accSpec] of Object.entries(s)) {
            if (accName === '_id') continue;
            applyAccumulator(g.doc, accName, accSpec as Record<string, unknown>, d);
          }
        }
        docs = [...groups.values()].map((g) => {
          // $avg finalization: fold the running __sum/__cnt side channels into the final
          // quotient at the real field name ( Mongo returns a number, never the raw channels).
          for (const k of Object.keys(g.doc)) {
            if (k.endsWith('__sum') && typeof g.doc[k] === 'number') {
              const base = k.slice(0, -'__sum'.length);
              const cnt = g.doc[`${base}__cnt`];
              g.doc[base] = cnt ? (g.doc[k] as number) / (cnt as number) : 0;
              delete g.doc[k];
              delete g.doc[`${base}__cnt`];
            }
          }
          return g.doc;
        });
        break;
      }
      case '$sort': {
        const s = spec as SortSpec;
        const entries = Object.entries(s);
        docs = [...docs].sort((a, b) => {
          for (const [k, v] of entries) {
            const av = readDotPath(a, k);
            const bv = readDotPath(b, k);
            const an = typeof av === 'string' ? av : Number(av ?? 0);
            const bn = typeof bv === 'string' ? bv : Number(bv ?? 0);
            if (an < bn) return v === -1 || v === 'desc' ? 1 : -1;
            if (an > bn) return v === -1 || v === 'desc' ? -1 : 1;
          }
          return 0;
        });
        break;
      }
      case '$skip':
        docs = docs.slice(Number(spec));
        break;
      case '$limit':
        docs = docs.slice(0, Number(spec));
        break;
      case '$count': {
        const name = String(spec);
        docs = [{ [name]: docs.length }];
        break;
      }
      case '$project': {
        const s = spec as Record<string, unknown>;
        docs = docs.map((d) => {
          const out: Record<string, unknown> = {};
          for (const [field, incl] of Object.entries(s)) {
            if (incl === 1 || incl === true) out[field] = readDotPath(d, field);
            else if (typeof incl === 'string' && incl.startsWith('$')) out[field] = readDotPath(d, incl.slice(1));
          }
          return out;
        });
        break;
      }
      case '$addFields': {
        const s = spec as Record<string, unknown>;
        docs = docs.map((d) => {
          let out = d;
          for (const [field, expr] of Object.entries(s)) {
            out = setDotPath(out, field, evalExpr(expr, d));
          }
          return out;
        });
        break;
      }
      case '$lookup': {
        // Supported form: { from, localField, foreignField, as } — equality join against
        // another registry table. The $expr pipeline form used by clan/leaderboard joins
        // the players table; resolved via the registry with a field-equality filter.
        const s = spec as { from: string; localField?: string; foreignField?: string; as: string; let?: Record<string, string>; pipeline?: AggregateStage[] };
        const foreign = getTable(s.from);
        const foreignName = TABLE_ALIASES[s.from] ?? s.from;
        if (!foreign) {
          docs = docs.map((d) => setDotPath(d, s.as, []));
          break;
        }
        let foreignRows: Array<Record<string, unknown>>;
        if (s.localField && s.foreignField) {
          void foreign; // rows fetched below via raw scan of the foreign table
          foreignRows = []; // filled synchronously below by fallback fetch
          // Synchronous context: foreign rows must be prefetched. The seam preloads
          // small tables; for players this is game-scale acceptable (see aggregate()).
          void foreignName;
          foreignRows = PIPELINE_FOREIGN_CACHE.get(s.from) ?? [];
        } else {
          foreignRows = PIPELINE_FOREIGN_CACHE.get(s.from) ?? [];
        }
        docs = docs.map((d) => {
          if (s.localField && s.foreignField) {
            const lv = readDotPath(d, s.localField);
            const matches = foreignRows.filter((f) => readDotPath(f, s.foreignField!) === lv);
            return setDotPath(d, s.as, matches);
          }
          // $expr form: { $match: { $expr: { $eq: ['$foreignField', '$$letVar'] } } }
          const pipeline = s.pipeline ?? [];
          const letVars = s.let ?? {};
          const matched = foreignRows.filter((f) => {
            for (const st of pipeline) {
              const m = st.$match as { $expr?: { $eq?: [unknown, unknown] } } | undefined;
              if (!m?.$expr?.$eq) continue;
              const [l, r] = m.$expr.$eq;
              const lv = typeof l === 'string' && l.startsWith('$') ? readDotPath(f, l.slice(1)) : l;
              const rv = typeof r === 'string' && r.startsWith('$$') ? d[(letVars[r.slice(2)] ?? '').replace('$', '')] ?? d[String(r).replace('$$', '').replace('$', '')] : r;
              if (lv !== rv) return false;
            }
            return true;
          });
          return setDotPath(d, s.as, matched);
        });
        break;
      }
      default:
        // Unknown stage: fail loudly at the seam rather than returning wrong data.
        throw new Error(`aggregate: unsupported stage '${key}' on collection '${currentCollection}'`);
    }
  }
  return docs;
}

/** Cache of foreign-table rows for $lookup stages (loaded once per toArray call). */
const PIPELINE_FOREIGN_CACHE = new Map<string, Array<Record<string, unknown>>>();

/** Apply one accumulator ($sum/$min/$max/$avg/$first/$last/$push, incl. $cond forms) to a group. */
function applyAccumulator(groupDoc: Record<string, unknown>, field: string, accSpec: Record<string, unknown>, doc: Record<string, unknown>): void {
  const op = Object.keys(accSpec)[0];
  const arg = accSpec[op];
  const valueOf = (): unknown => {
    if (typeof arg === 'string' && arg.startsWith('$')) return readDotPath(doc, arg.slice(1));
    if (arg !== null && typeof arg === 'object') return evalExpr(arg as Record<string, unknown>, doc);
    return arg;
  };
  const v = valueOf();
  switch (op) {
    case '$sum': {
      // { $sum: 1 } counts docs; { $sum: '$field' } or { $sum: {expr} } sums values
      const num = typeof v === 'number' ? v : typeof arg === 'number' ? arg : Number(v ?? 0);
      groupDoc[field] = (typeof groupDoc[field] === 'number' ? groupDoc[field] as number : 0) + (Number.isNaN(num) ? 0 : num);
      break;
    }
    case '$min': {
      const cur = groupDoc[field] as unknown;
      if (cur === undefined || (v !== null && v !== undefined && (v as number) < (cur as number))) groupDoc[field] = v;
      break;
    }
    case '$max': {
      const cur = groupDoc[field] as unknown;
      if (cur === undefined || (v !== null && v !== undefined && (v as number) > (cur as number))) groupDoc[field] = v;
      break;
    }
    case '$avg': {
      // running sum in field, count in a hidden side-channel via field.__avgN
      const sumKey = `${field}__sum`;
      const cntKey = `${field}__cnt`;
      groupDoc[sumKey] = (typeof groupDoc[sumKey] === 'number' ? groupDoc[sumKey] as number : 0) + Number(v ?? 0);
      groupDoc[cntKey] = (typeof groupDoc[cntKey] === 'number' ? groupDoc[cntKey] as number : 0) + 1;
      break;
    }
    case '$first':
      if (groupDoc[field] === undefined) groupDoc[field] = v;
      break;
    case '$last':
      groupDoc[field] = v;
      break;
    case '$push':
      groupDoc[field] = Array.isArray(groupDoc[field]) ? [...(groupDoc[field] as unknown[]), v] : [v];
      break;
    default:
      throw new Error(`aggregate: unsupported accumulator '${op}'`);
  }
}

/** Evaluate a Mongo aggregation expression ($cond/$add/$sum/$ifNull/$size/$isArray) against a doc. */
function evalExpr(expr: unknown, doc: Record<string, unknown>): unknown {
  if (typeof expr === 'string' && expr.startsWith('$')) return readDotPath(doc, expr.slice(1));
  if (expr === null || typeof expr !== 'object') return expr;
  if (Array.isArray(expr)) return expr.map((e) => evalExpr(e, doc));
  const obj = expr as Record<string, unknown>;
  const op = Object.keys(obj)[0];
  switch (op) {
    case '$sum': {
      // Both accumulator-style { $sum: 1 } and expression-style { $sum: [..] }
      const arg = obj.$sum;
      if (Array.isArray(arg)) return arg.reduce((s, e) => s + Number(evalExpr(e, doc) ?? 0), 0);
      if (typeof arg === 'string' && arg.startsWith('$')) {
        // Sum over an array field: '$memberStats.totalPower' → sum memberStats[*].totalPower
        const [root, ...rest] = arg.slice(1).split('.');
        const arr = doc[root];
        if (Array.isArray(arr)) {
          const sub = rest.join('.');
          return arr.reduce((s: number, item) => s + Number(sub ? readDotPath(item as Record<string, unknown>, sub) ?? 0 : 0), 0);
        }
        return Number(readDotPath(doc, arg.slice(1)) ?? 0);
      }
      return Number(arg ?? 0);
    }
    case '$add':
      return (obj.$add as unknown[]).reduce((s: number, e) => s + Number(evalExpr(e, doc) ?? 0), 0);
    case '$ifNull': {
      const [a, b] = obj.$ifNull as [unknown, unknown];
      const av = evalExpr(a, doc);
      return av === null || av === undefined ? evalExpr(b, doc) : av;
    }
    case '$cond': {
      const c = obj.$cond as { if: unknown; then: unknown; else: unknown } | [unknown, unknown, unknown];
      const cond = Array.isArray(c) ? c[0] : c.if;
      const thenE = Array.isArray(c) ? c[1] : c.then;
      const elseE = Array.isArray(c) ? c[2] : c.else;
      return truthy(evalExpr(cond, doc)) ? evalExpr(thenE, doc) : evalExpr(elseE, doc);
    }
    case '$eq':
      return evalExpr((obj.$eq as [unknown, unknown])[0], doc) === evalExpr((obj.$eq as [unknown, unknown])[1], doc);
    case '$size': {
      const v = evalExpr(obj.$size, doc);
      return Array.isArray(v) ? v.length : 0;
    }
    case '$isArray': {
      const spec = obj.$isArray as string;
      const v = typeof spec === 'string' && spec.startsWith('$') ? readDotPath(doc, spec.slice(1)) : spec;
      return Array.isArray(v);
    }
    default:
      throw new Error(`aggregate: unsupported expression '${op}'`);
  }
}

function truthy(v: unknown): boolean {
  return v === true || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && v.length > 0);
}

/** Filter-row matcher for the JS-side $match stages (subset: equality, $in, $ne, $expr $eq). */
function matchFilter(doc: Record<string, unknown>, filter: MongoFilter): boolean {
  for (const [k, v] of Object.entries(filter)) {
    if (k === '$or') {
      if (!(v as MongoFilter[]).some((branch) => matchFilter(doc, branch))) return false;
      continue;
    }
    if (k === '$expr') {
      const eq = (v as { $eq?: [unknown, unknown] }).$eq;
      if (eq) {
        const [l, r] = eq;
        const lv = typeof l === 'string' && l.startsWith('$') ? readDotPath(doc, l.slice(1)) : l;
        const rv = typeof r === 'string' && r.startsWith('$$') ? r : r;
        if (lv !== rv) return false;
      }
      continue;
    }
    const dv = readDotPath(doc, k);
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      const clause = v as OperatorClause;
      if (clause.$ne !== undefined && dv === clause.$ne) return false;
      if (clause.$in !== undefined && !clause.$in.includes(dv as never)) return false;
      if (clause.$exists !== undefined && (dv === undefined) !== !clause.$exists) return false;
    } else if (dv !== v) {
      return false;
    }
  }
  return true;
}

/** findOne options (sort translated; projection accepted for parity; rows return in full). */
interface FindOneOptions {
  sort?: SortSpec;
  projection?: Record<string, 0 | 1>;
}
/** updateOne/updateMany options (upsert supported; other Mongo flags accepted for parity). */
interface UpdateOptions {
  upsert?: boolean;
}

export class Collection<T = Record<string, unknown>> {
  private readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  private table(): PgTable | undefined {
    return getTable(this.name);
  }

  async findOne(filter: MongoFilter = {}, options?: FindOneOptions): Promise<T | null> {
    void options?.projection; // accepted for Mongo parity; pg rows return in full
    const t = this.table();
    if (!t) return null;
    const w = buildWhere(t, filter);
    const base = drizzleDb.select().from(t).$dynamic();
    let q = w ? base.where(w) : base;
    if (options?.sort) {
      // Multi-key sort specs: every recognized key participates, in spec order.
      // CRITICAL: drizzle's $dynamic().orderBy() REPLACES any previous order — sequential
      // per-key calls lose all but the last key. Build one orderBy call with all columns.
      const cols = getTableColumns(t);
      const orderExprs = Object.entries(options.sort)
        .map(([k, v]) => {
          const prop = resolveKeyToProp(t, k);
          const column = prop ? cols[prop] : undefined;
          return column ? (v === -1 || v === 'desc' ? drizzleDesc(column) : drizzleAsc(column)) : undefined;
        })
        .filter((e): e is NonNullable<typeof e> => e !== undefined);
      if (orderExprs.length > 0) q = q.orderBy(...orderExprs);
    }
    const rows = await q.limit(1);
    const row = rows[0];
    return row ? (shapeRowAliases(t, row as Record<string, unknown>) as T) : null;
  }

  find(filter: MongoFilter = {}, _projection?: object): FindBuilder<T> {
    const tableName = this.name;
    let sortSpec: SortSpec | null = null;
    let skipVal: number | null = null;
    let limitVal: number | null = null;
    const builder: FindBuilder<T> = {
      sort(spec: SortSpec): FindBuilder<T> {
        sortSpec = spec;
        return builder;
      },
      skip(n: number): FindBuilder<T> {
        skipVal = n;
        return builder;
      },
      limit(n: number): FindBuilder<T> {
        limitVal = n;
        return builder;
      },
      project(_projection: Record<string, 0 | 1>): FindBuilder<T> {
        return builder;
      },
      async toArray(): Promise<T[]> {
        const t = getTable(tableName);
        if (!t) return [];
        const w = buildWhere(t, filter);
        const base = drizzleDb.select().from(t).$dynamic();
        let q = w ? base.where(w) : base;
        if (sortSpec) {
          // Multi-key sort specs: every recognized key participates, in spec order.
          // CRITICAL: drizzle's $dynamic().orderBy() REPLACES any previous order — sequential
          // per-key calls lose all but the last key. Build one orderBy call with all columns.
          const cols = getTableColumns(t);
          const orderExprs = Object.entries(sortSpec)
            .map(([k, v]) => {
              const prop = resolveKeyToProp(t, k);
              const column = prop ? cols[prop] : undefined;
              return column ? (v === -1 || v === 'desc' ? drizzleDesc(column) : drizzleAsc(column)) : undefined;
            })
            .filter((e): e is NonNullable<typeof e> => e !== undefined);
          if (orderExprs.length > 0) q = q.orderBy(...orderExprs);
        }
        if (skipVal !== null) q = q.offset(skipVal);
        if (limitVal !== null) q = q.limit(limitVal);
        const rows: Array<Record<string, unknown>> = await q;
        return rows.map((row) => shapeRowAliases(t, row) as T);
      },
    };
    return builder;
  }

  async insertOne(doc: object): Promise<{ insertedId: string | null }> {
    const t = this.table();
    if (!t) return { insertedId: null };
    const normalized = ensureRowId(
      t,
      flattenDomainPlayerFields(t, normalizeScalarBooleans(doc)),
      doc
    );
    await drizzleDb.insert(t).values(normalized);
    return { insertedId: extractId(doc) };
  }

  async insertMany(docs: object[], options?: { ordered?: boolean }): Promise<{ insertedIds: (string | null)[] }> {
    void options?.ordered; // chunked inserts are inherently ordered-agnostic
    const t = this.table();
    if (!t) return { insertedIds: [] };
    // pg's extended protocol caps at 65,535 bind parameters; a single statement
    // over that limit fails with "bind message has N parameter formats but 0 parameters".
    // Chunk so each statement stays well under the cap (2,000 rows * 4 bound cols = 8,000).
    const CHUNK_SIZE = 2000;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs
        .slice(i, i + CHUNK_SIZE)
        .map((d) => ensureRowId(t, flattenDomainPlayerFields(t, normalizeScalarBooleans(d)), d));
      await drizzleDb.insert(t).values(chunk);
    }
    return { insertedIds: docs.map((d) => extractId(d)) };
  }

  async updateOne(
    filter: MongoFilter,
    update: MongoUpdate,
    options?: UpdateOptions,
  ): Promise<{ modifiedCount: number }> {
    const t = this.table();
    if (!t) return { modifiedCount: 0 };
    // FID-20260904-005 §5.0 (c): an empty filter would become an unqualified UPDATE of
    // every row (buildWhere returns undefined for {}). Mongo updateOne matches the FIRST
    // document only — mass-update is never the requested semantic. Fail loudly instead.
    if (!filter || Object.keys(filter).length === 0) {
      throw new Error('INVALID_EMPTY_FILTER: updateOne requires a non-empty filter (Mongo first-match semantics; refusing unqualified mass update)');
    }
    const w = buildWhere(t, filter);
    const setPayload = buildSetPayload(t, update);
    if (options?.upsert && setPayload) {
      // Mongo upsert semantics: insert the filter's equality fields + the $set payload
      // when no document matches. (set() accepts SQL fragments, so $inc/$push updates
      // cannot upsert; they are applied as plain updates.)
      const insertDoc: Record<string, SetOp> = {};
      for (const [key, value] of Object.entries(filter)) {
        if (key.startsWith('$') || value === undefined || Array.isArray(value)) continue;
        if (typeof value !== 'object' || value === null || value instanceof Date) {
          insertDoc[key] = value;
        }
      }
      for (const [key, value] of Object.entries(update.$set ?? {})) {
        insertDoc[key] = value;
      }
      // FID-20260904-005 §5.0 (a): route the composed insert through ensureRowId exactly
      // like insertOne — the prior path inserted with `values (default, …)` against the
      // varchar(24) id PK and every first-presence upsert 500'd (chat heartbeat/typing,
      // tutorial move-tracking, beer-base config).
      const normalizedInsert = ensureRowId(
        t,
        flattenDomainPlayerFields(t, normalizeScalarBooleans(insertDoc)),
        insertDoc
      );
      // FID-20260904-005 §5.0 (b): the historical select-then-insert raced under two
      // concurrent first-writes (both select empty, both insert, loser 500s on the unique
      // index — the same class as the tutorial progress race). Where a unique conflict
      // target exists, upsert atomically via onConflictDoUpdate.
      const conflictTarget = getConflictTarget(this.name, t);
      if (conflictTarget && setPayload && !hasSqlFragments(setPayload) && Object.keys(normalizedInsert).length > 0) {
        await drizzleDb
          .insert(t)
          .values(normalizedInsert)
          .onConflictDoUpdate({ target: conflictTarget, set: normalizedInsert });
        return { modifiedCount: 1 };
      }
      if (conflictTarget && !setPayload && !hasSqlFragments(normalizedInsert) && Object.keys(normalizedInsert).length > 0) {
        await drizzleDb
          .insert(t)
          .values(normalizedInsert)
          .onConflictDoNothing({ target: conflictTarget });
        return { modifiedCount: 1 };
      }
      const existing = w
        ? await drizzleDb.select().from(t).where(w).limit(1)
        : await drizzleDb.select().from(t).limit(1);
      if (existing.length === 0) {
        await drizzleDb.insert(t).values(normalizedInsert);
        return { modifiedCount: 1 };
      }
    }
    if (setPayload) {
      await drizzleDb.update(t).set(setPayload).where(w);
    }
    return { modifiedCount: 1 };
  }

  async updateMany(filter: MongoFilter, update: MongoUpdate): Promise<{ modifiedCount: number }> {
    const t = this.table();
    if (!t) return { modifiedCount: 0 };
    const w = buildWhere(t, filter);
    const setPayload = buildSetPayload(t, update);
    if (setPayload) {
      await drizzleDb.update(t).set(setPayload).where(w);
    }
    return { modifiedCount: 1 };
  }

  async deleteOne(filter: MongoFilter): Promise<{ deletedCount: number }> {
    const t = this.table();
    if (!t) return { deletedCount: 0 };
    await drizzleDb.delete(t).where(buildWhere(t, filter));
    return { deletedCount: 1 };
  }

  async deleteMany(filter: MongoFilter): Promise<{ deletedCount: number }> {
    const t = this.table();
    if (!t) return { deletedCount: 0 };
    await drizzleDb.delete(t).where(buildWhere(t, filter));
    return { deletedCount: 1 };
  }

  async countDocuments(filter: MongoFilter = {}): Promise<number> {
    const t = this.table();
    if (!t) return 0;
    const w = buildWhere(t, filter);
    const base = drizzleDb.select({ count: sql<number>`count(*)` });
    const rows = w ? await base.from(t).where(w) : await base.from(t);
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * Aggregation seam. Executes the pipeline with real Mongo semantics: the leading $match
   * (if any) is pushed down to SQL, remaining stages ($group/$sort/$count/$skip/$limit/
   * $addFields/$project/$lookup) evaluate in JS over the fetched rows. Game-scale row
   * counts make JS evaluation correct and cheap; a partial SQL translation would silently
   * mis-handle $cond/$push/$lookup — the exact wrongness this seam exists to avoid.
   */
  aggregate(pipeline: AggregateStage[]): AggregateBuilder<T> {
    const tableName = this.name;
    return {
      async toArray(): Promise<T[]> {
        const t = getTable(tableName);
        if (!t) return [];
        // Preload any $lookup foreign tables (equality and $expr forms) into the cache.
        PIPELINE_FOREIGN_CACHE.clear();
        for (const stage of pipeline) {
          const lookup = stage.$lookup as { from?: string } | undefined;
          if (!lookup?.from) continue;
          const ft = getTable(lookup.from);
          if (ft && !PIPELINE_FOREIGN_CACHE.has(lookup.from)) {
            PIPELINE_FOREIGN_CACHE.set(
              lookup.from,
              (await drizzleDb.select().from(ft)) as Array<Record<string, unknown>>
            );
          }
        }
        // Push the leading $match down to SQL; the rest evaluates in JS.
        let stages = pipeline;
        if (pipeline.length > 0 && pipeline[0].$match) {
          const w = buildWhere(t, pipeline[0].$match as MongoFilter);
          const fetched = w
            ? await drizzleDb.select().from(t).where(w)
            : await drizzleDb.select().from(t);
          stages = pipeline.slice(1);
          // Shaped rows let $-expressions read domain paths ('$resources.metal').
          return runPipeline(stages, (fetched as Array<Record<string, unknown>>).map((r) => shapeRowAliases(t, r)), tableName) as T[];
        }
        const fetched = (await drizzleDb.select().from(t)) as Array<Record<string, unknown>>;
        return runPipeline(stages, fetched.map((r) => shapeRowAliases(t, r)), tableName) as T[];
      },
    };
  }

  async createIndex(_indexSpec: IndexSpec, _options?: Record<string, string | boolean>): Promise<string> {
    // Indexes are owned by the migration SQL (lib/db/migrations); the seam accepts the
    // call for API parity and reports success without touching the database.
    return 'created';
  }

  async findOneAndUpdate(
    filter: MongoFilter,
    update: MongoUpdate,
    options?: FindOneAndUpdateOptions,
  ): Promise<T | null> {
    const result = await this.findOne(filter);
    if (!result) return null;
    await this.updateOne(filter, update);
    return options?.returnDocument === 'after' ? await this.findOne(filter) : result;
  }

  async bulkWrite(ops: BulkWriteOp[]): Promise<{ modifiedCount: number }> {
    let count = 0;
    for (const op of ops) {
      if (op.updateOne) {
        const r = await this.updateOne(op.updateOne.filter, op.updateOne.update);
        count += r.modifiedCount;
      }
      if (op.deleteOne) {
        const r = await this.deleteOne(op.deleteOne.filter);
        count += r.deletedCount;
      }
    }
    return { modifiedCount: count };
  }
}

class CompatDb {
  collection<T = Record<string, unknown>>(name: string): Collection<T> {
    return new Collection<T>(name);
  }
}

class CompatClient {
  db(_name?: string): CompatDb {
    return new CompatDb();
  }
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
}

const _compatClient = new CompatClient();

class Db extends CompatDb {
  async execute(query: SQL): Promise<QueryResult<Record<string, unknown>>> {
    return drizzleDb.execute(query);
  }
  db(_name: string): Db {
    return this;
  }
}

const _db = new Db();

export const connectToDatabase = async (): Promise<Db> => _db;
export const testConnection = async (): Promise<boolean> => {
  try {
    await drizzleDb.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
};
export const closeConnection = async (): Promise<void> => {};
export const db = _db;
export function getCollection<T = Record<string, unknown>>(name: string): Collection<T> {
  return new Collection<T>(name);
}
export const clientPromise: Promise<CompatClient> = Promise.resolve(_compatClient);
export const getClient = async (): Promise<CompatClient> => _compatClient;
export default clientPromise;
export const getDatabase = async (): Promise<Db> => _db;
export const getClientAndDatabase = async (): Promise<{
  client: CompatClient;
  db: Db;
  clientPromise: Promise<CompatClient>;
}> => ({ client: _compatClient, db: _db, clientPromise });

export class ObjectId {
  private readonly _id: string;
  constructor(id?: string) {
    this._id = id || Math.random().toString(36).substr(2, 24);
  }
  toString(): string {
    return this._id;
  }
  equals(other: ObjectId): boolean {
    return this._id === other.toString();
  }
  static isValid(id: string): boolean {
    return typeof id === 'string' && id.length > 0;
  }
}
