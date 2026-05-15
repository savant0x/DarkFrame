import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log('Seeding data...\n');

  // Discoveries
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
  const { error: dErr } = await supabase.from('discoveries').upsert(discoveries, { onConflict: 'discovery_id' });
  if (dErr) console.log('  ⚠️  Discoveries:', dErr.message);
  else console.log(`  ✅ ${discoveries.length} discoveries`);

  // Achievements
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
  const { error: aErr } = await supabase.from('achievements').upsert(achievements, { onConflict: 'achievement_id' });
  if (aErr) console.log('  ⚠️  Achievements:', aErr.message);
  else console.log(`  ✅ ${achievements.length} achievements`);

  // Game config
  const config = [
    { key: 'HARVEST_BASE_MIN', value: '400', type: 'number', category: 'harvest' },
    { key: 'HARVEST_BASE_MAX', value: '750', type: 'number', category: 'harvest' },
    { key: 'HARVEST_COOLDOWN_SECONDS', value: '300', type: 'number', category: 'harvest' },
    { key: 'HARVEST_MAX_SLOTS', value: '36', type: 'number', category: 'harvest' },
    { key: 'XP_PER_HARVEST', value: '12', type: 'number', category: 'progression' },
    { key: 'XP_CURVE_CONSTANT', value: '250', type: 'number', category: 'progression' },
    { key: 'DIGGER_DROP_CHANCE', value: '0.015', type: 'number', category: 'diggers' },
    { key: 'DIGGER_BONUS_CAP', value: '200', type: 'number', category: 'diggers' },
    { key: 'FLAG_HOLD_BONUS', value: '50', type: 'number', category: 'flag' },
    { key: 'FLAG_HOLD_XP_BONUS', value: '50', type: 'number', category: 'flag' },
    { key: 'VIP_HARVEST_BONUS', value: '50', type: 'number', category: 'vip' },
    { key: 'VIP_AUTO_FARM_SPEED', value: '2', type: 'number', category: 'vip' },
    { key: 'SHRINE_BOOST_DURATION_HOURS', value: '12', type: 'number', category: 'shrine' },
    { key: 'SHRINE_MAX_BOOST_PERCENT', value: '70', type: 'number', category: 'shrine' },
    { key: 'ATTACK_COST_METAL', value: '1000', type: 'number', category: 'combat' },
    { key: 'ATTACK_COST_ENERGY', value: '1000', type: 'number', category: 'combat' },
    { key: 'PVP_BURN_RATE', value: '0.20', type: 'number', category: 'combat' },
    { key: 'FACTORY_BASE_DEFENSE', value: '1000', type: 'number', category: 'factory' },
    { key: 'FACTORY_SLOT_REGEN_PER_HOUR', value: '416.67', type: 'number', category: 'factory' },
  ];
  const { error: cErr } = await supabase.from('game_config').upsert(config, { onConflict: 'key' });
  if (cErr) console.log('  ⚠️  Config:', cErr.message);
  else console.log(`  ✅ ${config.length} config entries`);

  console.log('\n✅ All data seeded');
}

main().catch(console.error);
