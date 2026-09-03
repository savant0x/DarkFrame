import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

// Fail-fast: an empty/missing DATABASE_URL previously produced a driver that threw
// opaque errors at query time (FID-20260902-001 §5.1 hardening).
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required (Postgres connection string, e.g. postgresql://…)");
}

// Supabase's Supavisor pooler requires TLS but its certificate chain is not
// publicly rooted, so the documented Node pattern is rejectUnauthorized: false.
export const db = drizzle({
  connection: {
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },
  schema,
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
export const closeConnection = async () => {};
