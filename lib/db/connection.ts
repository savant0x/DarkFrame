import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Lazy Postgres connection.
 *
 * The DATABASE_URL check MUST NOT run at module scope: Vercel's "collecting
 * page data" build step imports every route module, and a top-level throw
 * fails the entire build when the var is only configured at runtime
 * (Buildtime env vars unchecked). Instead we build the pool on first use —
 * an actual misconfiguration then throws at the first query, with the same
 * clear message the import-time check used to produce (FID-20260902-001).
 */

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required (Postgres connection string, e.g. postgresql://…)"
    );
  }
  return url;
}

/**
 * Supabase's Supavisor pooler requires TLS but its certificate chain is not
 * publicly rooted, so the documented Node pattern is rejectUnauthorized: false.
 *
 * Pool sizing: session-mode poolers cap concurrent clients per account
 * (Supavisor: 15). pg's default pool max is 10 per pool, and build workers,
 * the dev server, and serverless lambdas each open their own pool — which
 * tripped EMAXCONNSESSION during `next build`. Cap low enough that several
 * concurrent processes stay under the provider ceiling; override with
 * DATABASE_POOL_MAX where a bigger pool is safe (e.g. the game server).
 */
function getPool(): Pool {
  if (_pool) return _pool;
  const POOL_MAX = Number(process.env.DATABASE_POOL_MAX || 5);
  _pool = new Pool({
    connectionString: requireDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
    max: POOL_MAX,
  });
  return _pool;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) _db = drizzle({ client: getPool(), schema });
  return _db;
}

/** Module-level `db` proxy: same ergonomics as before, connects lazily. */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export const connectToDatabase = async () => db;
export const testConnection = async () => {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};
export const closeConnection = async () => {
  if (_pool) {
    await _pool.end().catch(() => {});
    _pool = null;
    _db = null;
  }
};
