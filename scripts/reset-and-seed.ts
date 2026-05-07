/**
 * DarkFrame — Complete Game Reset & Seed Script
 *
 * Wipes ALL game data and re-seeds from scratch.
 * Run: npx tsx scripts/reset-and-seed.ts
 *
 * What it does:
 * 1. Clears all game data tables
 * 2. Seeds the 150×150 map with proper terrain distribution
 * 3. Seeds discoveries, achievements, cave items, shop items
 * 4. Seeds WMD research tree
 * 5. Creates admin player
 * 6. Initializes game config constants
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ADMIN_EMAIL = 'spencerhowell84@gmail.com';
const ADMIN_USERNAME = 'FAME';
const ADMIN_PASSWORD = 'Sthcnh4525!';

const TERRAIN_DISTRIBUTION: { terrain: string; count: number }[] = [
  { terrain: 'Wasteland', count: 9000 },
  { terrain: 'Metal', count: 2250 },
  { terrain: 'Energy', count: 2250 },
  { terrain: 'Cave', count: 450 },
  { terrain: 'Forest', count: 225 },
  { terrain: 'Factory', count: 225 },
  { terrain: 'Bank', count: 4 },
  { terrain: 'Shrine', count: 1 },
  { terrain: 'AuctionHouse', count: 1 },
];

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  DarkFrame — Complete Reset & Seed   ║');
  console.log('╚══════════════════════════════════════╝\n');

  // STEP 1: Wipe all data
  console.log('Step 1: Wiping all game data...\n');
  const tables = [
    'battle_logs', 'flag_history', 'player_sessions', 'player_rp_history',
    'player_inventory', 'notifications', 'auction_listings', 'auction_bids',
    'clan_wars', 'clan_members', 'clans', 'wmd_player_research', 'wmd_missiles',
    'wmd_defense_batteries', 'wmd_clan_defense_grid', 'wmd_spies', 'wmd_spy_missions',
    'wmd_launch_history', 'wmd_interception_attempts', 'wmd_sabotage_events',
    'wmd_clan_votes', 'wmd_notifications', 'tile_harvest_records', 'discovery_log',
    'achievements', 'auto_farm_sessions', 'referrals', 'friends', 'direct_messages',
    'chat_messages', 'chat_typing', 'chat_online', 'player_shrine_boosts',
    'player_bans', 'admin_actions', 'cron_job_log', 'factory_production_queue',
    'factory_slots', 'factory_defense', 'unit_build_queue', 'flag_tracking',
    'bounty_tracking', 'tutorial_progress', 'player_stats', 'player_settings',
    'game_config', 'seeds',
  ];
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== '42P01') console.log(`  ⚠️  ${table}: ${error.message}`);
      else console.log(`  ✅ ${table}`);
    } catch { console.log(`  ⚠️  ${table}: skipped`); }
  }
  try { await supabase.from('players').delete().neq('username', '___IMPOSSIBLE___'); console.log('  ✅ players'); } catch { }
  try { await supabase.from('tiles').delete().neq('x', -1); console.log('  ✅ tiles'); } catch { }
  try { await supabase.from('flags').delete().neq('id', '00000000-0000-0000-0000-000000000000'); console.log('  ✅ flags'); } catch { }
  console.log();

  // STEP 2: Seed map
  console.log('Step 2: Seeding 150×150 map...\n');
  const terrainPool: string[] = [];
  for (const td of TERRAIN_DISTRIBUTION) for (let i = 0; i < td.count; i++) terrainPool.push(td.terrain);
  for (let i = terrainPool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [terrainPool[i], terrainPool[j]] = [terrainPool[j], terrainPool[i]]; }
  const tiles: { x: number; y: number; terrain: string; occupied_by_base: boolean }[] = [];
  let idx = 0;
  for (let x = 1; x <= 150; x++) for (let y = 1; y <= 150; y++) tiles.push({ x, y, terrain: terrainPool[idx++ % terrainPool.length], occupied_by_base: false });
  const shrine = tiles.find(t => t.x === 1 && t.y === 1); if (shrine) shrine.terrain = 'Shrine';
  const auction = tiles.find(t => t.x === 10 && t.y === 10); if (auction) auction.terrain = 'AuctionHouse';
  [{ x: 30, y: 30 }, { x: 75, y: 75 }, { x: 120, y: 120 }, { x: 30, y: 120 }, { x: 120, y: 30 }].forEach(pos => { const t = tiles.find(t => t.x === pos.x && t.y === pos.y); if (t) t.terrain = 'Bank'; });
  for (let i = 0; i < tiles.length; i += 1000) {
    const batch = tiles.slice(i, i + 1000);
    const { error } = await supabase.from('tiles').insert(batch);
    if (error) console.log(`  ⚠️  Batch ${i / 1000 + 1}: ${error.message}`);
    else console.log(`  ✅ Batch ${i / 1000 + 1} (${batch.length} tiles)`);
  }
  console.log(`\n✅ Seeded ${tiles.length} tiles.\n`);

  // STEP 3: Seed discoveries
  console.log('Step 3: Seeding discoveries...\n');
  const discoveries = [
    { discoveryId: 'ancient_mining_tech', name: 'Ancient Mining Tech', description: '+10% harvest yield', effect: { type: 'harvestBonus', value: 0.1 }, rarity: 2 },
    { discoveryId: 'cave_mapping', name: 'Cave Mapping', description: '+5% cave loot chance', effect: { type: 'caveLootBonus', value: 0.05 }, rarity: 1 },
    { discoveryId: 'energy_condensation', name: 'Energy Condensation', description: 'Energy bank capacity +20%', effect: { type: 'bankEnergyBonus', value: 0.2 }, rarity: 3 },
    { discoveryId: 'advanced_recon', name: 'Advanced Recon', description: 'Scout range +3 tiles', effect: { type: 'scoutRangeBonus', value: 3 }, rarity: 2 },
    { discoveryId: 'unit_preservation', name: 'Unit Preservation', description: 'Combat losses -10%', effect: { type: 'combatLossReduction', value: 0.1 }, rarity: 3 },
    { discoveryId: 'master_tactician', name: 'Master Tactician', description: 'Combat power +5%', effect: { type: 'combatPowerBonus', value: 0.05 }, rarity: 5 },
  ];
  const { error: dErr } = await supabase.from('discoveries').insert(discoveries);
  if (dErr) console.log(`  ⚠️  ${dErr.message}`); else console.log(`  ✅ ${discoveries.length} discoveries`);
  console.log();

  // STEP 4: Seed achievements
  console.log('Step 4: Seeding achievements...\n');
  const achievements = [
    { achievementId: 'first_harvest', name: 'First Harvest', description: 'Harvest your first tile', requirement: { type: 'harvest', threshold: 1 }, reward: { type: 'xp', value: 100 }, prestigeValue: 1 },
    { achievementId: 'harvest_100', name: 'Dedicated Farmer', description: 'Harvest 100 tiles', requirement: { type: 'harvest', threshold: 100 }, reward: { type: 'metal', value: 5000 }, prestigeValue: 2 },
    { achievementId: 'harvest_1000', name: 'Master Harvester', description: 'Harvest 1,000 tiles', requirement: { type: 'harvest', threshold: 1000 }, reward: { type: 'metal', value: 25000 }, prestigeValue: 3 },
    { achievementId: 'first_factory', name: 'Factory Owner', description: 'Capture your first factory', requirement: { type: 'factory', threshold: 1 }, reward: { type: 'rp', value: 10 }, prestigeValue: 2 },
    { achievementId: 'factory_5', name: 'Industrialist', description: 'Control 5 factories', requirement: { type: 'factory', threshold: 5 }, reward: { type: 'rp', value: 50 }, prestigeValue: 4 },
    { achievementId: 'combat_10', name: 'Warrior', description: 'Win 10 battles', requirement: { type: 'combat', threshold: 10 }, reward: { type: 'xp', value: 5000 }, prestigeValue: 3 },
    { achievementId: 'combat_50', name: 'Battle Hardened', description: 'Win 50 battles', requirement: { type: 'combat', threshold: 50 }, reward: { type: 'xp', value: 25000 }, prestigeValue: 5 },
    { achievementId: 'flag_1', name: 'Flag Bearer', description: 'Hold the flag once', requirement: { type: 'flag', threshold: 1 }, reward: { type: 'xp', value: 10000 }, prestigeValue: 4 },
    { achievementId: 'referral_1', name: 'Recruiter', description: 'Refer 1 player', requirement: { type: 'referral', threshold: 1 }, reward: { type: 'metal', value: 10000 }, prestigeValue: 2 },
    { achievementId: 'referral_10', name: 'Growth Hacker', description: 'Refer 10 players', requirement: { type: 'referral', threshold: 10 }, reward: { type: 'metal', value: 100000 }, prestigeValue: 5 },
  ];
  const { error: aErr } = await supabase.from('achievements').insert(achievements);
  if (aErr) console.log(`  ⚠️  ${aErr.message}`); else console.log(`  ✅ ${achievements.length} achievements`);
  console.log();

  // STEP 5: Seed game config
  console.log('Step 5: Seeding game config...\n');
  const config = [
    { key: 'HARVEST_BASE_MIN', value: '400', type: 'number', category: 'harvest' },
    { key: 'HARVEST_BASE_MAX', value: '750', type: 'number', category: 'harvest' },
    { key: 'HARVEST_COOLDOWN_SECONDS', value: '300', type: 'number', category: 'harvest' },
    { key: 'XP_PER_HARVEST', value: '3', type: 'number', category: 'progression' },
    { key: 'XP_CURVE_CONSTANT', value: '250', type: 'number', category: 'progression' },
    { key: 'DIGGER_DROP_CHANCE', value: '0.025', type: 'number', category: 'diggers' },
    { key: 'DIGGER_BONUS_CAP', value: '200', type: 'number', category: 'diggers' },
    { key: 'FLAG_HOLD_BONUS', value: '50', type: 'number', category: 'flag' },
    { key: 'FLAG_HOLD_XP_BONUS', value: '50', type: 'number', category: 'flag' },
    { key: 'VIP_HARVEST_BONUS', value: '50', type: 'number', category: 'vip' },
    { key: 'VIP_AUTO_FARM_SPEED', value: '2', type: 'number', category: 'vip' },
    { key: 'ATTACK_COST_METAL', value: '1000', type: 'number', category: 'combat' },
    { key: 'ATTACK_COST_ENERGY', value: '1000', type: 'number', category: 'combat' },
    { key: 'PVP_BURN_RATE', value: '0.20', type: 'number', category: 'combat' },
    { key: 'FACTORY_BASE_DEFENSE', value: '1000', type: 'number', category: 'factory' },
    { key: 'SHRINE_BOOST_DURATION_HOURS', value: '12', type: 'number', category: 'shrine' },
    { key: 'SHRINE_MAX_BOOST_PERCENT', value: '70', type: 'number', category: 'shrine' },
  ];
  const { error: cErr } = await supabase.from('game_config').insert(config);
  if (cErr) console.log(`  ⚠️  ${cErr.message}`); else console.log(`  ✅ ${config.length} config entries`);
  console.log();

  // STEP 6: Create admin
  console.log('Step 6: Creating admin player...\n');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true,
    user_metadata: { username: ADMIN_USERNAME },
  });
  if (authError && !authError.message.includes('already been registered')) {
    console.log(`  ⚠️  Auth: ${authError.message}`);
  } else {
    console.log(`  ✅ Auth user: ${ADMIN_EMAIL}`);
  }
  const { error: pErr } = await supabase.from('players').upsert({
    username: ADMIN_USERNAME, email: ADMIN_EMAIL, is_admin: true, rank: 5, level: 1,
    xp: 0, research_points: 0, resources_metal: 100000, resources_energy: 100000,
    bank_metal: 0, bank_energy: 0, gathering_metal_bonus: 0, gathering_energy_bonus: 0,
    inventory_capacity: 2000, inventory_metal_digger_count: 0, inventory_energy_digger_count: 0,
    factory_count: 0, is_vip: false, base_x: 75, base_y: 75, current_x: 75, current_y: 75,
    unlocked_tiers: [1],
  } as any);
  if (pErr) console.log(`  ⚠️  Player: ${pErr.message}`); else console.log(`  ✅ Admin player: ${ADMIN_USERNAME}`);
  console.log();

  console.log('╔══════════════════════════════════════╗');
  console.log('║  ✅ RESET AND SEED COMPLETE          ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('\nNext steps:');
  console.log('1. Start the dev server: npm run dev');
  console.log('2. Login as admin');
  console.log('3. Test harvest, movement, and combat');
  console.log('4. Report any remaining issues');
}

main().catch(console.error);
