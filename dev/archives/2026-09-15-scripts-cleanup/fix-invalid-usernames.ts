/**
 * @file scripts/fix-invalid-usernames.ts
 * @overview One-time repair for bot players whose usernames violate
 *           UsernameSchema (/^[A-Za-z0-9_]+$, 3–20 chars).
 *
 * Older bot generators emitted hyphens ("Flag-Bearer-4523") and spaces
 * ("Rusted Redoubt"). The generators are fixed; this script DELETES the
 * invalid bot rows so the (now schema-valid) generators recreate them on
 * their natural respawn cycles. Bots only — human accounts are never touched,
 * and no rename is attempted (username is the players PK referenced by value
 * in battles/chat/flags/marketplace, so renames would orphan that history).
 *
 * Run: npx tsx -r dotenv/config scripts/fix-invalid-usernames.ts dotenv_config_path=.env.local
 */

import { db } from '../lib/db';
import { players } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

const VALID = /^[A-Za-z0-9_]{3,20}$/;

async function fixInvalidUsernames() {
  console.log('Scanning for invalid bot usernames...');

  const all = await db.select().from(players);
  const invalid = all.filter((p) => p.isBot && !VALID.test(p.username));
  const humanInvalid = all.filter((p) => !p.isBot && !VALID.test(p.username));

  console.log(`Found ${invalid.length} invalid bot usernames of ${all.length} players.`);
  for (const row of invalid) console.log(`  DELETE bot: ${row.username}`);
  if (humanInvalid.length) {
    console.log(`WARNING: ${humanInvalid.length} HUMAN accounts also have invalid names (left untouched):`);
    for (const row of humanInvalid) console.log(`  human: ${row.username}`);
  }

  for (const row of invalid) {
    await db.delete(players).where(eq(players.username, row.username));
  }

  console.log(`Deleted ${invalid.length} invalid bot rows. Generators will respawn them with valid names.`);
  process.exit(0);
}

fixInvalidUsernames().catch((err) => {
  console.error('Repair failed:', err);
  process.exit(1);
});
