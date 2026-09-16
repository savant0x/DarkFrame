/**
 * FID-20260909-030 Fix E — live-data repair.
 *
 * The only surviving bot (Flag_Bearer_1027) holds a pre-helper claim on
 * tile (114,55), which is Factory terrain — a violation of the placement
 * contract (Wasteland only, per docs/README_NEW.md §Terrain Distribution).
 * Re-lease the illegal tile, claim a legal Wasteland tile through the same
 * helper every other bot path now uses, and update the player row.
 *
 * Run: npx tsx -r dotenv/config scripts/reseat-flag-bearer.ts
 */
import { claimBotBaseTile, releaseBotBaseTile } from '../lib/botService';
import { db } from '../lib/db';
import { players } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

const BOT = 'Flag_Bearer_1027';
const OLD = { x: 114, y: 55 };

(async () => {
  await releaseBotBaseTile(OLD.x, OLD.y, BOT);
  const claimed = await claimBotBaseTile({ zone: null, ownerUsername: BOT });
  await db
    .update(players)
    .set({ baseX: claimed.x, baseY: claimed.y })
    .where(eq(players.username, BOT));
  console.log(`${BOT} re-seated: (${OLD.x},${OLD.y}) Factory -> (${claimed.x},${claimed.y}) ${claimed.terrain}`);
  process.exit(0);
})().catch((e: Error) => {
  console.error('RESEAT FAILED:', e.message);
  process.exit(1);
});
