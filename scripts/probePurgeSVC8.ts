/**
 * One-shot purge of `svc8_%` probe fixtures (players + their factories).
 * Exits explicitly because ESM + open pg pools keep the process alive.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { like } from 'drizzle-orm';
import { db } from '../lib/db';
import { players, factories } from '../lib/db/schema';

async function main(): Promise<void> {
  // Factories first in case owner carries an FK to players.username.
  const deadF = await db.delete(factories).where(like(factories.owner, 'svc8_%'));
  console.log('purged factory rows:', String(deadF.rowCount ?? '(n/a)'));

  const dead = await db
    .delete(players)
    .where(like(players.username, 'svc8_%'))
    .returning({ u: players.username });
  console.log('purged players:', dead.map((d) => d.u).join(', ') || '(none)');

  process.exit(0);
}

main().catch((err) => {
  console.error('purge failed:', err);
  process.exit(1);
});
