/**
 * @file lib/caveItemService.ts
 * @overview Cave item generation — Supabase backend
 */
import { createServiceClient } from '@/lib/supabase/server';
import { ItemType, ItemRarity, TerrainType, InventoryItem, GAME_CONSTANTS } from '@/types';
import { canHarvestTile, getCurrentResetPeriod } from './harvestService';
import { getHarvestSuccessMessage } from './harvestMessages';
import { pickRandomName, getRarityEffect, getDiggerBonus } from './itemUtils';
import { FLAG_CONFIG } from '@/types/flag.types';

export interface CaveHarvestResult { success: boolean; message: string; item?: InventoryItem; bonusApplied?: number; diggerCount?: number; }

function generateItemId() { return crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; }

function generateCaveItem(dropRateMultiplier = 1, currentDiggerCount = 0): InventoryItem | null {
  const roll = Math.random();
  if (roll > 0.30 * dropRateMultiplier) return null;
  const typeRoll = Math.random();
  let itemType: ItemType;
  let rarity: ItemRarity;
  if (typeRoll < 0.40) { itemType = ItemType.MetalDigger; rarity = ItemRarity.Common; }
  else if (typeRoll < 0.60) { itemType = ItemType.EnergyDigger; rarity = ItemRarity.Common; }
  else if (typeRoll < 0.65) { itemType = ItemType.UniversalDigger; rarity = ItemRarity.Rare; }
  else { itemType = ItemType.TradeableItem; rarity = ItemRarity.Uncommon; }

  const typeStr = itemType as string;
  const rarityStr = rarity as string;
  const bonusPercent = itemType === ItemType.TradeableItem
    ? 0
    : getDiggerBonus(typeStr, currentDiggerCount);

  return {
    id: generateItemId(),
    name: pickRandomName(typeStr, rarityStr),
    type: itemType,
    quantity: 1,
    rarity,
    bonusPercent,
    bonusValue: undefined,
    description: getRarityEffect(rarityStr),
    foundAt: { x: 0, y: 0 },
    foundDate: new Date(),
  };
}

function createTutorialDigger(currentDiggerCount: number): InventoryItem {
  const bonus = getDiggerBonus('UNIVERSAL_DIGGER', currentDiggerCount);
  return {
    id: `tutorial-digger-${Date.now()}`,
    name: pickRandomName('UNIVERSAL_DIGGER', 'Rare'),
    type: ItemType.UniversalDigger,
    quantity: 1,
    rarity: ItemRarity.Rare,
    bonusPercent: bonus,
    bonusValue: undefined,
    description: 'A gift from the wasteland guides',
    foundAt: { x: 0, y: 0 },
    foundDate: new Date(),
  };
}

async function getInventoryItemCount(username: string): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase.from('player_inventory').select('*', { count: 'exact', head: true }).eq('player_username', username);
  return count || 0;
}

export async function harvestCaveTile(username: string, tile: { x: number; y: number; terrain: TerrainType }): Promise<CaveHarvestResult> {
  const supabase = createServiceClient();
  if (tile.terrain !== TerrainType.Cave && tile.terrain !== TerrainType.Forest) return { success: false, message: 'Not a cave/forest tile' };
  if (!(await canHarvestTile(username, tile))) return { success: false, message: 'Already harvested. Wait for refresh.' };

  const { data: player } = await supabase.from('players').select('inventory_capacity, inventory_metal_digger_count, inventory_energy_digger_count, gathering_metal_bonus, gathering_energy_bonus').eq('username', username).single();
  if (!player) return { success: false, message: 'Player not found' };

  const currentCount = await getInventoryItemCount(username);
  if (currentCount >= (player.inventory_capacity || GAME_CONSTANTS.HARVEST.DEFAULT_INVENTORY_CAPACITY)) return { success: false, message: 'Inventory full!' };

  const currentPeriod = getCurrentResetPeriod(tile.x);
  await supabase.from('tile_harvest_records').insert({ tile_x: tile.x, tile_y: tile.y, player_id: username, harvested_at: new Date().toISOString(), reset_period: currentPeriod });

  let dropRateMultiplier = 1;
  try {
    const { data: flag } = await supabase.from('flags').select('bearer_username').limit(1).maybeSingle();
    if (flag?.bearer_username === username) dropRateMultiplier = FLAG_CONFIG.FLAG_BONUSES.caveDropBoost;
  } catch {}

  const currentDiggerCount = (player.inventory_metal_digger_count || 0) + (player.inventory_energy_digger_count || 0);
  const item = generateCaveItem(dropRateMultiplier, currentDiggerCount);
  if (!item) return { success: true, message: getHarvestSuccessMessage(TerrainType.Cave, undefined, 'none') };

  let bonusApplied = 0;
  item.foundAt = { x: tile.x, y: tile.y };

  await supabase.from('player_inventory').insert({ player_username: username, item_id: item.id, name: item.name, item_type: item.type, rarity: item.rarity, quantity: 1, description: item.description, bonus_percent: item.bonusPercent || 0, found_at_x: item.foundAt.x || null, found_at_y: item.foundAt.y || null, found_date: new Date().toISOString() });

  if ([ItemType.MetalDigger, ItemType.EnergyDigger, ItemType.UniversalDigger].includes(item.type)) {
    const bonus = item.bonusPercent || 0;
    let metalBonus = player.gathering_metal_bonus || 0;
    let energyBonus = player.gathering_energy_bonus || 0;
    let metalCount = player.inventory_metal_digger_count || 0;
    let energyCount = player.inventory_energy_digger_count || 0;
    if (item.type === ItemType.MetalDigger || item.type === ItemType.UniversalDigger) { metalBonus += bonus; metalCount++; }
    if (item.type === ItemType.EnergyDigger || item.type === ItemType.UniversalDigger) { energyBonus += bonus; energyCount++; }
    await supabase.from('players').update({ gathering_metal_bonus: metalBonus, gathering_energy_bonus: energyBonus, inventory_metal_digger_count: metalCount, inventory_energy_digger_count: energyCount }).eq('username', username);
    bonusApplied = bonus;
  }

  const isDigger = [ItemType.MetalDigger, ItemType.EnergyDigger, ItemType.UniversalDigger].includes(item.type);
  return { success: true, message: getHarvestSuccessMessage(TerrainType.Cave, item.bonusPercent, isDigger ? 'digger' : 'tradeable'), item, bonusApplied, diggerCount: (player.inventory_metal_digger_count || 0) + (player.inventory_energy_digger_count || 0) };
}

export async function awardTutorialDigger(username: string): Promise<{ success: boolean; message: string; digger?: InventoryItem }> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('inventory_capacity, inventory_metal_digger_count, inventory_energy_digger_count, gathering_metal_bonus, gathering_energy_bonus').eq('username', username).single();
  if (!player) return { success: false, message: 'Player not found' };
  const currentCount = await getInventoryItemCount(username);
  if (currentCount >= (player.inventory_capacity || GAME_CONSTANTS.HARVEST.DEFAULT_INVENTORY_CAPACITY)) return { success: false, message: 'Inventory full!' };

  const currentDiggerCount = (player.inventory_metal_digger_count || 0) + (player.inventory_energy_digger_count || 0);
  const digger = createTutorialDigger(currentDiggerCount);
  await supabase.from('player_inventory').insert({ player_username: username, item_id: digger.id, name: digger.name, item_type: digger.type, rarity: digger.rarity, quantity: 1, description: digger.description, bonus_percent: digger.bonusPercent || 0, found_at_x: null, found_at_y: null, found_date: new Date().toISOString() });
  await supabase.from('players').update({ gathering_metal_bonus: (player.gathering_metal_bonus || 0) + (digger.bonusPercent || 0), gathering_energy_bonus: (player.gathering_energy_bonus || 0) + (digger.bonusPercent || 0), inventory_metal_digger_count: (player.inventory_metal_digger_count || 0) + 1, inventory_energy_digger_count: (player.inventory_energy_digger_count || 0) + 1 }).eq('username', username);

  return { success: true, message: 'Tutorial Universal Digger awarded!', digger };
}

export const harvestForestTile = harvestCaveTile;
export const awardTutorialDiggerToPlayer = awardTutorialDigger;
