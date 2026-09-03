import { defineConfig } from 'drizzle-kit';
import { loadEnvConfig } from '@next/env';

/**
 * Drizzle Kit configuration.
 *
 * Credentials are read from the `DATABASE_URL` environment variable rather than
 * hardcoded here. `@next/env` loads it from `.env.local` (git-ignored) so this
 * file stays safe to commit.
 *
 * Required variable (must be defined or startup fails):
 *   DATABASE_URL   Postgres connection string
 *                  (e.g. postgresql://user:pass@host:5432/db — Supabase pooler
 *                  URLs carry their TLS mode in the query string, e.g. ?sslmode=require)
 */

const { combinedEnv } = loadEnvConfig(process.cwd());

function requireEnv(name: string): string {
  const value = combinedEnv[name];
  if (typeof value !== 'string' || value === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Define it in .env.local (git-ignored) or export it in your environment.`,
    );
  }
  return value;
}

// Supabase's Supavisor pooler requires TLS but its certificate chain is not
// publicly rooted, so drizzle-kit needs ssl: 'require' (→ rejectUnauthorized: false),
// which the URL form of dbCredentials cannot express — hence the host-form below.
const dbUrl = new URL(requireEnv('DATABASE_URL'));

export default defineConfig({
  schema: './lib/db/schema/index.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: dbUrl.hostname,
    port: Number(dbUrl.port),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.slice(1),
    ssl: 'require',
  },
  verbose: true,
  strict: true,
});
