/** One-shot purge of orphaned FID-20260916-004 probe fixtures (crashed runs). */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

async function main(): Promise<void> {
  const wars = await db.execute(
    sql`DELETE FROM clan_wars WHERE attacker_clan_id LIKE 'svc_clan%' OR defender_clan_id LIKE 'svc_clan%'`
  );
  const invites = await db.execute(
    sql`DELETE FROM clan_invitations WHERE clan_id LIKE 'svc_clan%'`
  );
  const clans = await db.execute(
    sql`DELETE FROM clans WHERE description = 'FID-20260916-004 probe fixture'`
  );
  const players = await db.execute(
    sql`DELETE FROM players WHERE username LIKE 'svc_wmd_%' OR username LIKE 'svc_war_%' OR username LIKE 'svc_neu_%'`
  );
  const purge = (r: unknown) => (r as { rowCount: number | null }).rowCount ?? 0;
  console.log(
    `purged wars=${purge(wars)} invites=${purge(invites)} clans=${purge(clans)} players=${purge(players)}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
