/**
 * @dev/reset-and-seed.ts
 * Complete game reset and seed script.
 * WARNING: Destroys all game data. Use only for fresh starts.
 *
 * Usage: npx tsx dev/reset-and-seed.ts
 *
 * What it does:
 * 1. Clears all game data tables (players, factories, flags, etc.)
 * 2. Seeds the map with terrain distribution
 * 3. Creates default shrine at (1,1)
 * 4. Creates bank tiles
 * 5. Seeds cave items and discoveries
 * 6. Initializes game config constants
 */

import { createServiceClient } from '@/lib/supabase/server';

const supabase = createServiceClient();

const TERRAIN_DISTRIBUTION = [
  { terrain: 'Wasteland', weight: 9000, max: 9000 },
  { terrain: 'Metal', weight: 2250, max: 2250 },
  { terrain: 'Energy', weight: 2250, max: 2250 },
  { terrain: 'Cave', weight: 450, max: 450 },
  { terrain: 'Forest', weight: 225, max: 225 },
  { terrain: 'Factory', weight: 225, max: 225 },
  { terrain: 'Bank', weight: 4, max: 4 },
  { terrain: 'Shrine', weight: 1, max: 1 },
  { terrain: 'AuctionHouse', weight: 1, max: 1 },
];

async function main() {
  console.log('🔥 DARKFRAME RESET AND SEED');
  console.log('================================\n');

  // STEP 1: Clear all game data
  console.log('Step 1: Clearing all game data...');

  const tablesToClear = [
    'battle_logs',
    'flag_history',
    'player_sessions',
    'player_rp_history',
    'player_inventory',
    'notifications',
    'auction_listings',
    'auction_bids',
    'clan_wars',
    'clan_members',
    'clans',
    'wmd_player_research',
    'wmd_missiles',
    'wmd_defense_batteries',
    'wmd_clan_defense_grid',
    'wmd_spies',
    'wmd_spy_missions',
    'wmd_launch_history',
    'wmd_interception_attempts',
    'wmd_sabotage_events',
    'wmd_clan_votes',
    'wmd_notifications',
    'tile_harvest_records',
    'discovery_log',
    'achievements',
    'auto_farm_sessions',
    'referrals',
    'friends',
    'direct_messages',
    'chat_messages',
    'chat_typing',
    'chat_online',
    'player_shrine_boosts',
    'player_bans',
    'admin_actions',
    'cron_job_log',
    'factory_production_queue',
    'factory_slots',
    'factory_defense',
    'unit_build_queue',
    'flag_tracking',
    'bounty_tracking',
    'tutorial_progress',
    'player_stats',
    'player_settings',
    'game_config',
    'seeds',
  ];

  for (const table of tablesToClear) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== '42P01') { // 42P01 = table doesn't exist
        console.log(`  ⚠️  ${table}: ${error.message}`);
      } else {
        console.log(`  ✅ ${table} cleared`);
      }
    } catch (err) {
      console.log(`  ⚠️  ${table}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Clear players last (foreign key constraints)
  try {
    const { error } = await supabase.from('players').delete().neq('username', '___IMPOSSIBLE___');
    if (error) console.log(`  ⚠️  players: ${error.message}`);
    else console.log('  ✅ players cleared');
  } catch (err) {
    console.log(`  ⚠️  players: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Clear tiles
  try {
    const { error } = await supabase.from('tiles').delete().neq('x', -1);
    if (error) console.log(`  ⚠️  tiles: ${error.message}`);
    else console.log('  ✅ tiles cleared');
  } catch (err) {
    console.log(`  ⚠️  tiles: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Clear flags
  try {
    const { error } = await supabase.from('flags').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.log(`  ⚠️  flags: ${error.message}`);
    else console.log('  ✅ flags cleared');
  } catch (err) {
    console.log(`  ⚠️  flags: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('\n✅ All game data cleared.\n');

  // STEP 2: Seed terrain
  console.log('Step 2: Seeding 150×150 map terrain...');

  const terrainPool: string[] = [];
  for (const td of TERRAIN_DISTRIBUTION) {
    for (let i = 0; i < td.weight; i++) {
      terrainPool.push(td.terrain);
    }
  }

  // Shuffle
  for (let i = terrainPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [terrainPool[i], terrainPool[j]] = [terrainPool[j], terrainPool[i]];
  }

  let tileIndex = 0;
  const tiles: { x: number; y: number; terrain: string; occupied_by_base: boolean }[] = [];

  for (let x = 1; x <= 150; x++) {
    for (let y = 1; y <= 150; y++) {
      const terrain = terrainPool[tileIndex % terrainPool.length];
      tiles.push({ x, y, terrain, occupied_by_base: false });
      tileIndex++;
    }
  }

  // Set shrine at (1,1) and banks at fixed positions
  const shrineTile = tiles.find(t => t.x === 1 && t.y === 1);
  if (shrineTile) shrineTile.terrain = 'Shrine';

  const bankPositions = [
    { x: 30, y: 30 }, { x: 75, y: 75 }, { x: 120, y: 120 },
    { x: 30, y: 120 }, { x: 120, y: 30 },
  ];
  for (const pos of bankPositions) {
    const bankTile = tiles.find(t => t.x === pos.x && t.y === pos.y);
    if (bankTile) bankTile.terrain = 'Bank';
  }

  // Auction house at (10,10)
  const auctionTile = tiles.find(t => t.x === 10 && t.y === 10);
  if (auctionTile) auctionTile.terrain = 'AuctionHouse';

  // Batch insert tiles
  const BATCH_SIZE = 1000;
  for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
    const batch = tiles.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('tiles').insert(batch);
    if (error) {
      console.log(`  ⚠️  Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
    } else {
      console.log(`  ✅ Batch ${i / BATCH_SIZE + 1} (${batch.length} tiles)`);
    }
  }

  console.log(`\n✅ Seeded ${tiles.length} tiles.\n`);

  // STEP 3: Seed game config
  console.log('Step 3: Seeding game config...');

  const gameConfig = [
    { key: 'HARVEST_BASE_MIN', value: '400', type: 'number', category: 'harvest', description: 'Minimum base harvest amount per tile' },
    { key: 'HARVEST_BASE_MAX', value: '750', type: 'number', category: 'harvest', description: 'Maximum base harvest amount per tile' },
    { key: 'HARVEST_COOLDOWN_SECONDS', value: '300', type: 'number', category: 'harvest', description: 'Cooldown between harvests per tile (5 minutes)' },
    { key: 'HARVEST_MAX_SLOTS', value: '36', type: 'number', category: 'harvest', description: 'Maximum harvest slots (12h / 5min = 36 resets in 12h cycle)' },
    { key: 'XP_PER_HARVEST', value: '3', type: 'number', category: 'progression', description: 'XP gained per harvest action' },
    { key: 'XP_CURVE_CONSTANT', value: '250', type: 'number', category: 'progression', description: 'Polynomial XP curve constant: XP = 250 × L^2.5' },
    { key: 'DIGGER_DROP_CHANCE', value: '0.025', type: 'number', category: 'diggers', description: 'Digger drop chance per cave exploration (2.5%)' },
    { key: 'DIGGER_BONUS_CAP', value: '200', type: 'number', category: 'diggers', description: 'Maximum digger gathering bonus (200%)' },
    { key: 'FLAG_HOLD_BONUS', value: '50', type: 'number', category: 'flag', description: 'Flag bearer harvesting bonus (+50%)' },
    { key: 'FLAG_HOLD_XP_BONUS', value: '50', type: 'number', category: 'flag', description: 'Flag bearer XP bonus (+50%)' },
    { key: 'VIP_HARVEST_BONUS', value: '50', type: 'number', category: 'vip', description: 'VIP harvesting bonus (+50% additive)' },
    { key: 'VIP_AUTO_FARM_SPEED', value: '2', type: 'number', category: 'vip', description: 'VIP auto-farm speed multiplier (2x)' },
    { key: 'SHRINE_BOOST_DURATION_HOURS', value: '12', type: 'number', category: 'shrine', description: 'Shrine boost duration in hours' },
    { key: 'SHRINE_MAX_BOOST_PERCENT', value: '70', type: 'number', category: 'shrine', description: 'Maximum shrine boost (+70% with diminishing returns)' },
    { key: 'ATTACK_COST_METAL', value: '1000', type: 'number', category: 'combat', description: 'Metal cost to attack a factory' },
    { key: 'ATTACK_COST_ENERGY', value: '1000', type: 'number', category: 'combat', description: 'Energy cost to attack a factory' },
    { key: 'PVP_BURN_RATE', value: '0.20', type: 'number', category: 'combat', description: 'Percentage of stolen resources permanently burned (20%)' },
    { key: 'FACTORY_BASE_DEFENSE', value: '1000', type: 'number', category: 'factory', description: 'Base factory defense at level 1' },
    { key: 'FACTORY_SLOT_REGEN_PER_HOUR', value: '416.67', type: 'number', category: 'factory', description: 'Factory slot regeneration per hour' },
  ];

  const { error: configError } = await supabase.from('game_config').insert(gameConfig);
  if (configError) {
    console.log(`  ⚠️  Game config: ${configError.message}`);
  } else {
    console.log(`  ✅ Seeded ${gameConfig.length} game config entries`);
  }

  console.log('\n✅ Game config seeded.\n');

  // STEP 4: Seed discoveries
  console.log('Step 4: Seeding discoveries...');

  const discoveries = [
    { discoveryId: 'ancient_mining_tech', name: 'Ancient Mining Tech', description: '+10% harvest yield', effect: { type: 'harvestBonus', value: 0.1 }, rarity: 2 },
    { discoveryId: 'cave_mapping', name: 'Cave Mapping', description: '+5% cave loot chance', effect: { type: 'caveLootBonus', value: 0.05 }, rarity: 1 },
    { discoveryId: 'efficient_smelting', name: 'Efficient Smelting', description: 'Metal bank capacity +20%', effect: { type: 'bankCapacityBonus', value: 0.2 }, rarity: 3 },
    { discoveryId: 'energy_condensation', name: 'Energy Condensation', description: 'Energy bank capacity +20%', effect: { type: 'bankEnergyBonus', value: 0.2 }, rarity: 3 },
    { discoveryId: 'rapid_construction', name: 'Rapid Construction', description: 'Factory regen +15%', effect: { type: 'factoryRegenBonus', value: 0.15 }, rarity: 4 },
    { discoveryId: 'advanced_recon', name: 'Advanced Recon', description: 'Scout range +3 tiles', effect: { type: 'scoutRangeBonus', value: 3 }, rarity: 2 },
    { discoveryId: 'unit_preservation', name: 'Unit Preservation', description: 'Combat losses -10%', effect: { type: 'combatLossReduction', value: 0.1 }, rarity: 3 },
    { discoveryId: 'master_tactician', name: 'Master Tactician', description: 'Combat power +5%', effect: { type: 'combatPowerBonus', value: 0.05 }, rarity: 5 },
  ];

  const { error: discError } = await supabase.from('discoveries').insert(discoveries);
  if (discError) {
    console.log(`  ⚠️  Discoveries: ${discError.message}`);
  } else {
    console.log(`  ✅ Seeded ${discoveries.length} discoveries`);
  }

  console.log('\n✅ Discoveries seeded.\n');

  console.log('================================');
  console.log('🎉 RESET AND SEED COMPLETE');
  console.log('================================');
  console.log('');
  console.log('Next steps:');
  console.log('1. Register a new test player');
  console.log('2. Test harvest, movement, and combat');
  console.log('3. Verify all balance changes are working');
  console.log('4. Report any remaining issues');
}

main().catch(console.error);
