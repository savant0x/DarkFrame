/**
 * @file lib/jobs/flagRespawner.ts
 * @created 2026-05-05
 * @overview Flag auto-drop respawn — checks respawn_at timestamp, spawns new flag bot when ready
 */
import { createServiceClient } from '@/lib/supabase/server';
import { createFlagBot } from '@/lib/flagBotService';

let jobsStarted = false;

/**
 * Check if a dropped flag's respawn_at time has passed and spawn a new bot
 */
async function checkAndRespawn(): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date();

  // Check if there's a flag waiting to respawn
  const { data: flag } = await supabase
    .from('flags')
    .select('id, respawn_at, bearer_username')
    .limit(1)
    .maybeSingle();

  if (!flag) return;

  // If there's already a bearer, we're done
  if (flag.bearer_username) return;

  // If no respawn timer set, we're done
  if (!flag.respawn_at) return;

  const respawnAt = new Date(flag.respawn_at);
  if (now < respawnAt) return; // Not time yet

  // Time to respawn — spawn a new flag bot
  try {
    await createFlagBot();
    console.log('[Flag Respawner] 🏴 Flag respawned — new bot created');
  } catch (err) {
    console.error('[Flag Respawner] Failed to spawn flag bot:', err);
  }
}

/**
 * Start the flag respawn checker (runs every 60s)
 */
export function startFlagRespawner(): NodeJS.Timer {
  if (jobsStarted) return setInterval(checkAndRespawn, 60000);
  jobsStarted = true;
  console.log('[Flag Respawner] ⏰ Started — checking every 60s');
  return setInterval(checkAndRespawn, 60000);
}
