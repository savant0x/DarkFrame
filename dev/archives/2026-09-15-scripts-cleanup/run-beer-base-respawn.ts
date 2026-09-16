/**
 * FID-032 follow-up: run the Beer Base weekly respawn as a detached script
 * (the earlier inline tsx -e hung on Supabase pooler socket teardown; the
 * explicit process.exit here guarantees termination).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { weeklyBeerBaseRespawn } from '../lib/beerBaseService';

(async () => {
  const r = await weeklyBeerBaseRespawn();
  console.log('RESPAWN RESULT:', JSON.stringify(r));
  process.exit(0);
})().catch((e) => {
  console.error('RESPAWN FAILED:', e);
  process.exit(1);
});
