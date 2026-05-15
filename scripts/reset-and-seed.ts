/**
 * DarkFrame — Complete Game Reset & Seed Script
 *
 * Wipes ALL game data and re-seeds from scratch.
 * Run: npx tsx scripts/reset-and-seed.ts
 *
 * What it does:
 * 1. Clears all game data tables
 * 2. Seeds the 150×150 map with proper terrain distribution (22,500 tiles)
 * 3. Seeds discoveries and achievements
 * 4. Creates admin player
 * 5. Initializes game config constants
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { findAndClaimSpawnTile } from '@/lib/playerService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ADMIN_EMAIL = 'spencerhowell84@gmail.com';
const ADMIN_USERNAME = 'FAME';
const ADMIN_PASSWORD = 'Sthcnh4525!';

const TERRAIN_DISTRIBUTION: { terrain: string; count: number }[] = [
  { terrain: 'Wasteland', count: 9440 },
  { terrain: 'Metal', count: 5625 },
  { terrain: 'Energy', count: 3375 },
  { terrain: 'Cave', count: 1350 },
  { terrain: 'Forest', count: 450 },
  { terrain: 'Factory', count: 2250 },
  { terrain: 'Shrine', count: 1 },
  { terrain: 'AuctionHouse', count: 1 },
  { terrain: 'Bank', count: 8 },
];

const BANK_POSITIONS = [
  { x: 38, y: 38, type: 'metal' },
  { x: 112, y: 38, type: 'energy' },
  { x: 38, y: 112, type: 'exchange' },
  { x: 112, y: 112, type: 'exchange' },
  { x: 75, y: 25, type: 'metal' },
  { x: 25, y: 75, type: 'energy' },
  { x: 75, y: 125, type: 'exchange' },
  { x: 125, y: 75, type: 'exchange' },
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
    'game_config', 'seeds', 'player_units', 'discoveries',
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

  const tiles: { x: number; y: number; terrain: string; occupied_by_base: boolean; bank_type?: string }[] = [];
  let idx = 0;
  for (let y = 1; y <= 150; y++) {
    for (let x = 1; x <= 150; x++) {
      const bankPos = BANK_POSITIONS.find(b => b.x === x && b.y === y);
      if (x === 1 && y === 1) {
        tiles.push({ x, y, terrain: 'Shrine', occupied_by_base: false });
      } else if (x === 10 && y === 10) {
        tiles.push({ x, y, terrain: 'AuctionHouse', occupied_by_base: false });
      } else if (bankPos) {
        tiles.push({ x, y, terrain: 'Bank', occupied_by_base: false, bank_type: bankPos.type });
      } else {
        tiles.push({ x, y, terrain: terrainPool[idx++ % terrainPool.length], occupied_by_base: false });
      }
    }
  }

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
    { discovery_id: 'ancient_mining_tech', name: 'Ancient Mining Tech', description: '+10% harvest yield', effect: { type: 'harvestBonus', value: 0.1 }, rarity: 2 },
    { discovery_id: 'cave_mapping', name: 'Cave Mapping', description: '+5% cave loot chance', effect: { type: 'caveLootBonus', value: 0.05 }, rarity: 1 },
    { discovery_id: 'efficient_smelting', name: 'Efficient Smelting', description: 'Metal bank capacity +20%', effect: { type: 'bankCapacityBonus', value: 0.2 }, rarity: 3 },
    { discovery_id: 'energy_condensation', name: 'Energy Condensation', description: 'Energy bank capacity +20%', effect: { type: 'bankEnergyBonus', value: 0.2 }, rarity: 3 },
    { discovery_id: 'rapid_construction', name: 'Rapid Construction', description: 'Factory regen +15%', effect: { type: 'factoryRegenBonus', value: 0.15 }, rarity: 4 },
    { discovery_id: 'advanced_recon', name: 'Advanced Recon', description: 'Scout range +3 tiles', effect: { type: 'scoutRangeBonus', value: 3 }, rarity: 2 },
    { discovery_id: 'unit_preservation', name: 'Unit Preservation', description: 'Combat losses -10%', effect: { type: 'combatLossReduction', value: 0.1 }, rarity: 3 },
    { discovery_id: 'master_tactician', name: 'Master Tactician', description: 'Combat power +5%', effect: { type: 'combatPowerBonus', value: 0.05 }, rarity: 5 },
  ];
  const { error: dErr } = await supabase.from('discoveries').insert(discoveries);
  if (dErr) console.log(`  ⚠️  ${dErr.message}`); else console.log(`  ✅ ${discoveries.length} discoveries`);
  console.log();

  // STEP 4: Seed achievements
  console.log('Step 4: Seeding achievements...\n');
  const achievements = [
    { achievement_id: 'first_harvest', name: 'First Harvest', description: 'Harvest your first tile', requirement: { type: 'harvest', threshold: 1 }, reward: { type: 'xp', value: 100 }, prestige_value: 1 },
    { achievement_id: 'harvest_100', name: 'Dedicated Farmer', description: 'Harvest 100 tiles', requirement: { type: 'harvest', threshold: 100 }, reward: { type: 'metal', value: 5000 }, prestige_value: 2 },
    { achievement_id: 'harvest_1000', name: 'Master Harvester', description: 'Harvest 1,000 tiles', requirement: { type: 'harvest', threshold: 1000 }, reward: { type: 'metal', value: 25000 }, prestige_value: 3 },
    { achievement_id: 'harvest_5k', name: 'Seasoned Harvester', description: 'Harvest 5,000 tiles', requirement: { type: 'harvest', threshold: 5000 }, reward: { type: 'rp', value: 50 }, prestige_value: 4 },
    { achievement_id: 'harvest_25k', name: 'Expert Harvester', description: 'Harvest 25,000 tiles', requirement: { type: 'harvest', threshold: 25000 }, reward: { type: 'rp', value: 150 }, prestige_value: 5 },
    { achievement_id: 'harvest_500k', name: 'Legendary Harvester', description: 'Harvest 500,000 tiles', requirement: { type: 'harvest', threshold: 500000 }, reward: { type: 'rp', value: 500 }, prestige_value: 6 },
    { achievement_id: 'first_factory', name: 'Factory Owner', description: 'Capture your first factory', requirement: { type: 'factory', threshold: 1 }, reward: { type: 'rp', value: 10 }, prestige_value: 2 },
    { achievement_id: 'factory_5', name: 'Industrialist', description: 'Control 5 factories', requirement: { type: 'factory', threshold: 5 }, reward: { type: 'rp', value: 50 }, prestige_value: 4 },
    { achievement_id: 'combat_10', name: 'Warrior', description: 'Win 10 battles', requirement: { type: 'combat', threshold: 10 }, reward: { type: 'xp', value: 5000 }, prestige_value: 3 },
    { achievement_id: 'combat_50', name: 'Battle Hardened', description: 'Win 50 battles', requirement: { type: 'combat', threshold: 50 }, reward: { type: 'xp', value: 25000 }, prestige_value: 5 },
    { achievement_id: 'flag_1', name: 'Flag Bearer', description: 'Hold the flag once', requirement: { type: 'flag', threshold: 1 }, reward: { type: 'xp', value: 10000 }, prestige_value: 4 },
    { achievement_id: 'referral_1', name: 'Recruiter', description: 'Refer 1 player', requirement: { type: 'referral', threshold: 1 }, reward: { type: 'metal', value: 10000 }, prestige_value: 2 },
    { achievement_id: 'referral_10', name: 'Growth Hacker', description: 'Refer 10 players', requirement: { type: 'referral', threshold: 10 }, reward: { type: 'metal', value: 100000 }, prestige_value: 5 },
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
    { key: 'HARVEST_MAX_SLOTS', value: '36', type: 'number', category: 'harvest' },
    { key: 'XP_PER_HARVEST', value: '12', type: 'number', category: 'progression' },
    { key: 'XP_CURVE_CONSTANT', value: '250', type: 'number', category: 'progression' },
    { key: 'DIGGER_DROP_CHANCE', value: '0.10', type: 'number', category: 'diggers' },
    { key: 'DIGGER_BONUS_CAP', value: '100', type: 'number', category: 'diggers' },
    { key: 'DIGGER_SACRIFICE_CAP', value: '100', type: 'number', category: 'diggers' },
    { key: 'DIGGER_GUARANTEED_INTERVAL', value: '500', type: 'number', category: 'diggers' },
    { key: 'FLAG_HOLD_BONUS', value: '50', type: 'number', category: 'flag' },
    { key: 'FLAG_HOLD_XP_BONUS', value: '50', type: 'number', category: 'flag' },
    { key: 'VIP_HARVEST_BONUS', value: '50', type: 'number', category: 'vip' },
    { key: 'VIP_AUTO_FARM_SPEED', value: '2', type: 'number', category: 'vip' },
    { key: 'SHRINE_BOOST_DURATION_HOURS', value: '12', type: 'number', category: 'shrine' },
    { key: 'SHRINE_MAX_BOOST_PERCENT', value: '70', type: 'number', category: 'shrine' },
    { key: 'ATTACK_COST_METAL', value: '1000', type: 'number', category: 'combat' },
    { key: 'ATTACK_COST_ENERGY', value: '1000', type: 'number', category: 'combat' },
    { key: 'PVP_BURN_RATE', value: '0.20', type: 'number', category: 'combat' },
    // FID-20260511-FACTORY-UNIT-REDESIGN: New factory config values
    { key: 'FACTORY_BASE_DEFENSE', value: '5000', type: 'number', category: 'factory' },
    { key: 'FACTORY_BASE_SLOTS', value: '5000', type: 'number', category: 'factory' },
    { key: 'FACTORY_SLOT_SCALING', value: '1.15', type: 'number', category: 'factory' },
    { key: 'FACTORY_BURST_PERCENT', value: '80', type: 'number', category: 'factory' },
    { key: 'FACTORY_DECAY_HOURS', value: '12', type: 'number', category: 'factory' },
    { key: 'FACTORY_ENTROPY_HOURS', value: '72', type: 'number', category: 'factory' },
    { key: 'FACTORY_UPGRADE_COST_MULTIPLIER', value: '1.35', type: 'number', category: 'factory' },
    { key: 'FACTORY_MAX_LEVEL', value: '10', type: 'number', category: 'factory' },
    { key: 'FACTORY_MAX_PER_PLAYER', value: '10', type: 'number', category: 'factory' },
    { key: 'UNIT_ARCHETRIES', value: 'STRIKER,BULWARK,ARTILLERY,SUPPORT', type: 'string', category: 'units' },
    { key: 'COMBAT_DAMAGE_FORMULA', value: 'asymptotic', type: 'string', category: 'combat' },
    { key: 'COMBAT_SUPPORT_BUFF_CAP', value: '60', type: 'number', category: 'combat' },
    { key: 'OPERATIONAL_DATA_PER_100_SLOTS', value: '1', type: 'number', category: 'progression' },
  ];
  const { error: cErr } = await supabase.from('game_config').insert(config);
  if (cErr) console.log(`  ⚠️  ${cErr.message}`); else console.log(`  ✅ ${config.length} config entries`);
  console.log();

  // STEP 6: Create admin player with random wasteland base
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

  // Find a random wasteland tile for the admin base (same as any player)
  console.log('  Finding spawn tile for admin base...');
  const spawnTile = await findAndClaimSpawnTile();
  if (!spawnTile) {
    console.log('  ❌ No available wasteland tiles for base!');
  } else {
    console.log(`  ✅ Spawn tile found at (${spawnTile.x}, ${spawnTile.y})`);
  }

  const baseX = spawnTile?.x ?? 75;
  const baseY = spawnTile?.y ?? 75;

  const { error: pErr } = await supabase.from('players').upsert({
    username: ADMIN_USERNAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, is_admin: true, rank: 5, level: 1,
    xp: 0, research_points: 0, resources_metal: 100000, resources_energy: 100000,
    bank_metal: 0, bank_energy: 0,
    inventory_capacity: 2000,
    factory_count: 0, is_vip: false,
    base_x: baseX, base_y: baseY, current_x: baseX, current_y: baseY,
    unlocked_tiers: [1],
  });
  if (pErr) console.log(`  ⚠️  Player: ${pErr.message}`); else console.log(`  ✅ Admin player: ${ADMIN_USERNAME} at (${baseX}, ${baseY})`);
  console.log();

  // STEP 6b: Initialize flag system
  console.log('Step 6b: Initializing flag system...');
  try {
    const { data: existingFlag } = await supabase.from('flags').select('id').maybeSingle();
    if (!existingFlag) {
      // Spawn flag bot at admin's base location
      const { error: flagErr } = await supabase.from('flags').insert({
        bearer_id: ADMIN_USERNAME,
        bearer_username: 'Flag-Bearer-001',
        is_bot: true,
        position_x: baseX,
        position_y: baseY,
        current_hp: 1000,
        max_hp: 1000,
        claimed_at: new Date().toISOString(),
        grace_until: new Date(0).toISOString(),
        max_hold_expires_at: new Date(Date.now() + 43200000).toISOString(),
      });
      if (flagErr) console.log(`  ⚠️  Flag init: ${flagErr.message}`);
      else console.log(`  ✅ Flag system initialized with bot bearer at (${baseX}, ${baseY})`);
    } else {
      console.log(`  ✅ Flag system already initialized`);
    }
  } catch (err) {
    console.log(`  ⚠️  Flag init failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log();

  // STEP 6c: Spawn initial beer bases
  console.log('Step 6c: Spawning beer bases...');
  try {
    const { data: existingBases } = await supabase.from('players').select('username').eq('is_bot', true).eq('is_special_base', true).limit(1);
    if (existingBases && existingBases.length > 0) {
      console.log(`  ✅ Beer bases already exist`);
    } else {
      // Spawn ~20 beer bases on random wasteland tiles
      const { data: wastelandTiles } = await supabase
        .from('tiles')
        .select('x, y')
        .eq('terrain', 'Wasteland')
        .eq('occupied_by_base', false)
        .limit(500);

      const positions = (wastelandTiles || [])
        .sort(() => Math.random() - 0.5)
        .slice(0, 20);

      if (positions.length < 20) {
        console.log(`  ⚠️  Only ${positions.length} wasteland tiles available`);
      }

      for (let i = 0; i < positions.length; i++) {
        const { x, y } = positions[i];
        const tier = Math.random() < 0.5 ? 'WEAK' : Math.random() < 0.8 ? 'MEDIUM' : 'STRONG';
        const metal = tier === 'WEAK' ? 5000 : tier === 'MEDIUM' ? 15000 : 40000;
        const energy = tier === 'WEAK' ? 5000 : tier === 'MEDIUM' ? 15000 : 40000;
        const str = tier === 'WEAK' ? 500 : tier === 'MEDIUM' ? 2000 : 5000;
        const def = tier === 'WEAK' ? 500 : tier === 'MEDIUM' ? 2000 : 5000;

        await supabase.from('players').insert({
          username: `BeerBase-${tier}-${i + 1}`,
          email: `beerbase-${i + 1}@system.local`,
          password: 'SYSTEM',
          is_bot: true,
          is_special_base: true,
          current_x: x,
          current_y: y,
          base_x: x,
          base_y: y,
          resources_metal: metal,
          resources_energy: energy,
          total_strength: str,
          total_defense: def,
          level: tier === 'WEAK' ? 5 : tier === 'MEDIUM' ? 10 : 15,
          xp: 0,
          rank: 1,
        });
      }
      console.log(`  ✅ Spawned ${positions.length} beer bases`);
    }
  } catch (err) {
    console.log(`  ⚠️  Beer base spawn failed: ${err instanceof Error ? err.message : String(err)}`);
  }
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
