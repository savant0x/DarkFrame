/**
 * @file lib/discoveryService.ts
 * @overview Discovery system — Supabase backend (player_discoveries table)
 */

import { createServiceClient } from '@/lib/supabase/server';

export enum DiscoveryCategory { Industrial = 'industrial', Combat = 'combat', Strategic = 'strategic' }

export interface Discovery { id: string; name: string; category: DiscoveryCategory; description: string; bonus: string; discoveredAt: Date; discoveredInCave: { x: number; y: number }; }
export interface DiscoveryConfig { id: string; name: string; category: DiscoveryCategory; description: string; bonus: string; icon: string; bonusEffect: { type: string; value: number }; }

export const ANCIENT_TECHNOLOGIES: Record<string, DiscoveryConfig> = {
  AUTO_HARVESTER: { id: 'AUTO_HARVESTER', name: 'Automated Harvester', category: DiscoveryCategory.Industrial, description: 'Ancient blueprints for automated resource extraction systems.', bonus: '+15% Metal Yield', icon: '⚙️', bonusEffect: { type: 'metal_yield', value: 0.15 } },
  FUSION_CORE: { id: 'FUSION_CORE', name: 'Fusion Core Reactor', category: DiscoveryCategory.Industrial, description: 'Advanced energy generation technology.', bonus: '+15% Energy Yield', icon: '⚡', bonusEffect: { type: 'energy_yield', value: 0.15 } },
  NANO_FORGE: { id: 'NANO_FORGE', name: 'Nano-Fabrication Forge', category: DiscoveryCategory.Industrial, description: 'Molecular assembly technology.', bonus: '-10% All Unit Costs', icon: '🔧', bonusEffect: { type: 'unit_cost_reduction', value: 0.10 } },
  QUANTUM_FACTORY: { id: 'QUANTUM_FACTORY', name: 'Quantum Factory Matrix', category: DiscoveryCategory.Industrial, description: 'Multi-dimensional manufacturing framework.', bonus: '+2 Factory Slots', icon: '🏭', bonusEffect: { type: 'factory_slots', value: 2 } },
  RAPID_ASSEMBLY: { id: 'RAPID_ASSEMBLY', name: 'Rapid Assembly Protocol', category: DiscoveryCategory.Industrial, description: 'Accelerated production techniques.', bonus: '+20% Slot Regen Speed', icon: '⏱️', bonusEffect: { type: 'slot_regen_speed', value: 0.20 } },
  TITAN_ARMOR: { id: 'TITAN_ARMOR', name: 'Titan Composite Armor', category: DiscoveryCategory.Combat, description: 'Advanced defensive plating.', bonus: '+10% Unit Defense', icon: '🛡️', bonusEffect: { type: 'unit_defense', value: 0.10 } },
  PLASMA_WEAPONS: { id: 'PLASMA_WEAPONS', name: 'Plasma Weapon Systems', category: DiscoveryCategory.Combat, description: 'Devastating energy weapons.', bonus: '+10% Unit Strength', icon: '⚔️', bonusEffect: { type: 'unit_strength', value: 0.10 } },
  TACTICAL_AI: { id: 'TACTICAL_AI', name: 'Tactical Combat AI', category: DiscoveryCategory.Combat, description: 'AI for battlefield command.', bonus: '+5% Damage Dealt', icon: '🧠', bonusEffect: { type: 'damage_dealt', value: 0.05 } },
  SHIELD_MATRIX: { id: 'SHIELD_MATRIX', name: 'Energy Shield Matrix', category: DiscoveryCategory.Combat, description: 'Force field technology.', bonus: '-5% Damage Taken', icon: '💠', bonusEffect: { type: 'damage_taken_reduction', value: 0.05 } },
  REPAIR_NANITES: { id: 'REPAIR_NANITES', name: 'Regenerative Nanites', category: DiscoveryCategory.Combat, description: 'Self-repairing microscopic machines.', bonus: '+15% Unit HP', icon: '💉', bonusEffect: { type: 'unit_hp', value: 0.15 } },
  BANK_PROTOCOL: { id: 'BANK_PROTOCOL', name: 'Secure Banking Protocol', category: DiscoveryCategory.Strategic, description: 'Ancient encryption methods.', bonus: '+25% Bank Capacity', icon: '🏦', bonusEffect: { type: 'bank_capacity', value: 0.25 } },
  SHRINE_BLESSING: { id: 'SHRINE_BLESSING', name: 'Ancient Shrine Blessing', category: DiscoveryCategory.Strategic, description: 'Amplifies shrine rituals.', bonus: '+10% Shrine Boost Duration', icon: '🕌', bonusEffect: { type: 'shrine_boost_duration', value: 0.10 } },
  WARP_DRIVE: { id: 'WARP_DRIVE', name: 'Warp Drive Prototype', category: DiscoveryCategory.Strategic, description: 'FTL technology unlocks instant travel.', bonus: 'Fast Travel Unlocked', icon: '🚀', bonusEffect: { type: 'fast_travel', value: 1 } },
  CRYSTAL_RESONATOR: { id: 'CRYSTAL_RESONATOR', name: 'Crystal Resonator', category: DiscoveryCategory.Strategic, description: 'Harmonic amplification device.', bonus: '+20% XP Gain', icon: '💎', bonusEffect: { type: 'xp_multiplier', value: 0.20 } },
  FORTUNE_ALGORITHM: { id: 'FORTUNE_ALGORITHM', name: 'Fortune Algorithm', category: DiscoveryCategory.Strategic, description: 'Predictive analysis software.', bonus: '+10% Better Cave Loot', icon: '🎲', bonusEffect: { type: 'cave_loot_quality', value: 0.10 } },
};

export const DISCOVERY_DROP_RATE = 0.05;

async function getPlayerDiscoveries(username: string): Promise<{ discovery_id: string; discovered_at: string; discovered_x: number | null; discovered_y: number | null }[]> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('player_discoveries').select('discovery_id, discovered_at, discovered_x, discovered_y').eq('player_username', username);
  return (data || []).map(r => ({ discovery_id: r.discovery_id, discovered_at: r.discovered_at, discovered_x: r.discovered_x, discovered_y: r.discovered_y }));
}

export async function checkDiscoveryDrop(username: string, caveLocation: { x: number; y: number }): Promise<{ discovered: boolean; discovery?: Discovery; isNew: boolean; totalDiscoveries?: number }> {
  if (Math.random() > DISCOVERY_DROP_RATE) return { discovered: false, isNew: false };
  const existing = await getPlayerDiscoveries(username);
  const discoveredIds = existing.map(d => d.discovery_id);
  const available = Object.values(ANCIENT_TECHNOLOGIES).filter(t => !discoveredIds.includes(t.id));
  if (!available.length) return { discovered: true, isNew: false, totalDiscoveries: 15 };

  const tech = available[Math.floor(Math.random() * available.length)];
  const supabase = createServiceClient();
  await supabase.from('player_discoveries').insert({ player_username: username, discovery_id: tech.id, name: tech.name, category: tech.category, description: tech.description, bonus: tech.bonus, discovered_at: new Date().toISOString(), discovered_x: caveLocation.x, discovered_y: caveLocation.y });

  return { discovered: true, discovery: { id: tech.id, name: tech.name, category: tech.category, description: tech.description, bonus: tech.bonus, discoveredAt: new Date(), discoveredInCave: caveLocation }, isNew: true, totalDiscoveries: existing.length + 1 };
}

export async function getDiscoveryProgress(username: string) {
  const existing = await getPlayerDiscoveries(username);
  const byCategory = { industrial: 0, combat: 0, strategic: 0 } as Record<string, number>;
  for (const d of existing) { const c = ANCIENT_TECHNOLOGIES[d.discovery_id]?.category || ''; if (byCategory[c] !== undefined) byCategory[c]++; }
  const undiscovered = Object.values(ANCIENT_TECHNOLOGIES).filter(t => !existing.find(e => e.discovery_id === t.id));
  return { totalDiscovered: existing.length, totalAvailable: 15, progressPercent: Math.floor((existing.length / 15) * 100), byCategory, discoveries: existing.map(d => ({ ...d, config: ANCIENT_TECHNOLOGIES[d.discovery_id] })), undiscovered: undiscovered.map(t => ({ id: t.id, name: t.name, category: t.category, icon: t.icon, description: t.description })), completionStatus: existing.length >= 15 ? 'COMPLETE' : 'IN_PROGRESS' };
}

export async function getDiscoveryBonuses(username: string): Promise<Record<string, number | boolean>> {
  const existing = await getPlayerDiscoveries(username);
  const bonuses: Record<string, number> = { metalYield: 0, energyYield: 0, unitCostReduction: 0, factorySlots: 0, slotRegenSpeed: 0, unitDefense: 0, unitStrength: 0, damageDealt: 0, damageTakenReduction: 0, unitHp: 0, bankCapacity: 0, shrineBoostDuration: 0, xpMultiplier: 0, caveLootQuality: 0 };
  let fastTravel = false;
  for (const d of existing) {
    const cfg = ANCIENT_TECHNOLOGIES[d.discovery_id];
    if (!cfg) continue;
    const { type, value } = cfg.bonusEffect;
    const map: Record<string, string> = { metal_yield: 'metalYield', energy_yield: 'energyYield', unit_cost_reduction: 'unitCostReduction', factory_slots: 'factorySlots', slot_regen_speed: 'slotRegenSpeed', unit_defense: 'unitDefense', unit_strength: 'unitStrength', damage_dealt: 'damageDealt', damage_taken_reduction: 'damageTakenReduction', unit_hp: 'unitHp', bank_capacity: 'bankCapacity', shrine_boost_duration: 'shrineBoostDuration', xp_multiplier: 'xpMultiplier', cave_loot_quality: 'caveLootQuality' };
    if (type === 'fast_travel') fastTravel = true;
    else { const k = map[type]; if (k) bonuses[k] += value; }
  }
  return { ...bonuses, fastTravel };
}
