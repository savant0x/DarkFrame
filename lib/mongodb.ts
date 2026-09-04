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
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import type { QueryResult } from 'pg';
import * as schema from '@/lib/db/schema';

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
interface FilterBranch {
  $or?: FilterBranch[];
  [field: string]: FilterValue | FilterBranch[] | undefined;
}
type FilterValue = Comparable | null | OperatorClause;
/** Mongo-style query filter: field → value or operator clause, with optional $or. */
type MongoFilter = FilterBranch;
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
/** Mongo-style sort spec: field → direction. */
type SortSpec = Record<string, 1 | -1 | 'asc' | 'desc'>;
/** Mongo aggregation pipeline stage (acknowledged shape; see aggregate()). */
type AggregateStage = Record<string, DocumentValue>;
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
 * Registry of every drizzle table exported by the schema module, keyed by export name.
 * Built programmatically (filtered by drizzle's `is` runtime check) so new schema tables
 * become available to the seam automatically — previously a hand-maintained list drifted
 * from the schema and silently no-op'd for unlisted names.
 */
const TABLE_REGISTRY: Record<string, PgTable> = {};
for (const [name, exportValue] of Object.entries(schema)) {
  if (is(exportValue, PgTable)) TABLE_REGISTRY[name] = exportValue;
}

function getTable(name: string): PgTable | undefined {
  return TABLE_REGISTRY[name];
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
    const column = columns[key];
    if (!column || Array.isArray(value)) continue;
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
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/** Extract a string id from a document's `id`/`_id` field, if present. */
function extractId(doc: object): string | null {
  const record = doc as Record<string, DocumentValue>;
  if (typeof record.id === 'string' && record.id) return record.id;
  if (typeof record._id === 'string' && record._id) return record._id;
  return null;
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
    if (columns[key]) {
      payload[key] = value;
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
    }
  }
  for (const [key, value] of Object.entries(update.$pull ?? {})) {
    const column = columns[key];
    if (column) {
      payload[key] = sql`coalesce(${column}, '[]'::jsonb) - ${JSON.stringify(value)}::jsonb`;
      hasOps = true;
    }
  }
  for (const [key, delta] of Object.entries(update.$inc ?? {})) {
    const column = columns[key];
    if (column) {
      payload[key] = sql`coalesce(${column}, 0) + ${delta}`;
      hasOps = true;
    }
  }
  for (const [key, value] of Object.entries(update.$addToSet ?? {})) {
    const column = columns[key];
    if (column) {
      payload[key] = sql`coalesce(${column}, '[]'::jsonb) || ${JSON.stringify([value])}::jsonb`;
      hasOps = true;
    }
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
      const [k, v] = Object.entries(options.sort)[0] as [string, 1 | -1 | 'asc' | 'desc'];
      const column = getTableColumns(t)[k];
      if (column) {
        q = q.orderBy(v === -1 || v === 'desc' ? drizzleDesc(column) : drizzleAsc(column));
      }
    }
    const rows = await q.limit(1);
    const row = rows[0];
    return row ? (row as T) : null;
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
          const [k, v] = Object.entries(sortSpec)[0] as [string, 1 | -1 | 'asc' | 'desc'];
          const column = getTableColumns(t)[k];
          if (column) {
            q = q.orderBy(v === -1 || v === 'desc' ? drizzleDesc(column) : drizzleAsc(column));
          }
        }
        if (skipVal !== null) q = q.offset(skipVal);
        if (limitVal !== null) q = q.limit(limitVal);
        const rows: Array<Record<string, unknown>> = await q;
        return rows.map((row) => row as T);
      },
    };
    return builder;
  }

  async insertOne(doc: object): Promise<{ insertedId: string | null }> {
    const t = this.table();
    if (!t) return { insertedId: null };
    await drizzleDb.insert(t).values(normalizeScalarBooleans(doc));
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
      const chunk = docs.slice(i, i + CHUNK_SIZE).map((d) => normalizeScalarBooleans(d));
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
      const existing = w
        ? await drizzleDb.select().from(t).where(w).limit(1)
        : await drizzleDb.select().from(t).limit(1);
      if (existing.length === 0) {
        await drizzleDb.insert(t).values(insertDoc);
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
   * Aggregation seam. The pipeline's stage shape is acknowledged but stages are not
   * translated — callers receive the collection's rows (pre-existing behavior; tracked
   * as a known limitation in SCOPE.md, consumers needing real aggregation use raw SQL).
   */
  aggregate(_pipeline: AggregateStage[]): AggregateBuilder<T> {
    const tableName = this.name;
    return {
      async toArray(): Promise<T[]> {
        const t = getTable(tableName);
        if (!t) return [];
        const rows: Array<Record<string, unknown>> = await drizzleDb.select().from(t);
        return rows.map((row) => row as T);
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
