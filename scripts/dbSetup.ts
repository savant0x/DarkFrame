/**
 * @file scripts/dbSetup.ts
 * @overview A–Z database scaffolding: takes an empty/fresh Postgres database and
 * provisions it for DarkFrame — connectivity → migrations → map → owner account.
 *
 * Idempotent: every step is safe to re-run on an already-provisioned database
 * (steps skip or no-op when their prerequisite already exists). No destructive
 * operations anywhere.
 *
 * Credentials come from git-ignored `.env.local` (DATABASE_URL, OWNER_USERNAME,
 * OWNER_EMAIL, OWNER_PASSWORD). Owner password is written by the operator, never
 * logged by this script.
 *
 * Usage: npm run db:setup
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';

// Load environment variables from .env.local before anything imports lib/db.
config({ path: resolve(process.cwd(), '.env.local') });

const ok = (msg: string): void => console.log(`  ✅ ${msg}`);
const fail = (msg: string): void => {
  console.error(`  ❌ ${msg}`);
  process.exitCode = 1;
};

async function stepConnectivity(): Promise<void> {
  console.log('\n[1/5] Connectivity');
  const { db } = await import('../lib/db');
  const { sql } = await import('drizzle-orm');
  const res = await db.execute(sql`SELECT 1 AS ok`);
  if (res.rows[0]?.ok === 1) {
    ok(`database reachable (${process.env.DATABASE_URL?.replace(/\/\/[^@]*@/, '//***@').split('?')[0]})`);
  } else {
    fail('SELECT 1 did not return ok');
  }
}

function stepMigrations(): void {
  console.log('\n[2/5] Migrations');
  const migrationDir = resolve(process.cwd(), 'lib/db/migrations');
  const sqlFiles = existsSync(migrationDir)
    ? readdirSync(migrationDir).filter((f) => f.endsWith('.sql'))
    : [];
  if (sqlFiles.length === 0) {
    console.log('  … no migration SQL yet — generating initial migration');
    execSync('npx drizzle-kit generate --name init', { cwd: process.cwd(), stdio: 'inherit' });
  }
  execSync('npx drizzle-kit migrate', { cwd: process.cwd(), stdio: 'inherit' });
  ok('migrations applied');
}

async function stepMap(): Promise<void> {
  console.log('\n[3/5] Game map');
  const { initializeMap } = await import('../lib/mapGeneration');
  await initializeMap(); // idempotent: skips generation when tiles already exist
  ok('map ready (skips if already generated)');
}

async function stepOwnerAccount(): Promise<void> {
  console.log('\n[4/5] Owner account');
  const ownerUsername = process.env.OWNER_USERNAME || 'owner';
  const ownerEmail = process.env.OWNER_EMAIL || 'owner@darkframe.local';
  const ownerPassword = process.env.OWNER_PASSWORD;
  if (!ownerPassword) {
    fail('OWNER_PASSWORD is not set in .env.local');
    return;
  }

  const { db } = await import('../lib/db');
  const { eq } = await import('drizzle-orm');
  const { players } = await import('../lib/db/schema');
  const { hashPassword } = await import('../lib/authService');
  const { createPlayerWithAuth } = await import('../lib/playerService');

  const hashed = await hashPassword(ownerPassword);
  const existing = await db
    .select({ username: players.username })
    .from(players)
    .where(eq(players.username, ownerUsername))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(players)
      .set({ email: ownerEmail, password: hashed, isAdmin: 1 })
      .where(eq(players.username, ownerUsername));
    ok(`'${ownerUsername}' promoted to admin (is_admin=1, credentials refreshed)`);
  } else {
    await createPlayerWithAuth(ownerUsername, ownerEmail, hashed); // claims a spawn tile
    await db
      .update(players)
      .set({ isAdmin: 1 })
      .where(eq(players.username, ownerUsername));
    ok(`'${ownerUsername}' created with is_admin=1 (spawn tile claimed)`);
  }
}

async function stepVerify(): Promise<void> {
  console.log('\n[5/5] Verify');
  const { db } = await import('../lib/db');
  const { sql, eq } = await import('drizzle-orm');
  const { players } = await import('../lib/db/schema');

  const tables = await db.execute(
    sql`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '%drizzle%'`,
  );
  const tiles = await db.execute(sql`SELECT count(*)::int AS n FROM tiles`);
  const playerCount = await db.execute(sql`SELECT count(*)::int AS n FROM players`);
  const owner = await db
    .select({ username: players.username, email: players.email, isAdmin: players.isAdmin, baseX: players.baseX, baseY: players.baseY })
    .from(players)
    .where(eq(players.username, process.env.OWNER_USERNAME || 'owner'))
    .limit(1);

  ok(`schema tables: ${tables.rows[0].n}`);
  ok(`tiles: ${tiles.rows[0].n}`);
  ok(`players: ${playerCount.rows[0].n}`);
  if (owner[0]) {
    ok(
      `owner '${owner[0].username}' (${owner[0].email}) is_admin=${owner[0].isAdmin} at base (${owner[0].baseX},${owner[0].baseY})`,
    );
  } else {
    fail('owner account row not found after setup');
  }
}

async function main(): Promise<void> {
  console.log('🚀 DarkFrame DB Setup (A–Z)');
  try {
    await stepConnectivity();
    stepMigrations();
    await stepMap();
    await stepOwnerAccount();
    await stepVerify();
    console.log('\n✅ DB setup complete.');
  } catch (error) {
    console.error('\n❌ DB setup failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main();
