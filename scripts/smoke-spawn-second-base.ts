/**
 * FID-20260909-034 win-path smoke re-run — spawn one fresh Beer Base via the
 * production pipeline and print its name for the smoke driver.
 *
 * Run: npx tsx --env-file=.env.local scripts/smoke-spawn-second-base.ts
 */
import { spawnBeerBase } from '../lib/beerBaseService';

(async () => {
  const name = await spawnBeerBase();
  console.log(`SECOND_BASE=${name}`);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
