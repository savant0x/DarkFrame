import { createServiceClient } from '@/lib/supabase/server';
import { ItemType, ItemRarity, TerrainType, GAME_CONSTANTS } from '@/types/game.types';
import { canHarvestTile, getCurrentResetPeriod } from './harvestService';
import { getHarvestSuccessMessage } from './harvestMessages';
import { pickRandomName, getRarityEffect } from './itemUtils';
import { FLAG_CONFIG } from '@/types/flag.types';

export interface CaveHarvestResult {
  success: boolean;
  message: string;
  item?: {
    id: string;
    name: string;
    type: ItemType;
    rarity: ItemRarity;
    description: string;
    sacrificeValue: { metal: number; energy: number };
    foundAt: { x: number; y: number };
    foundDate: Date;
  };
  diggerCount?: number;
}

function generateItemId() {
  return crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a cave/forest item for the new sacrifice system.
 * Diggers no longer auto-stack — they go into inventory for manual sacrifice at the Shrine.
 */
function generateCaveItem(dropRateMultiplier = 1, isForest = false): CaveHarvestResult['item'] | null {
  const roll = Math.random();
  const baseRate = GAME_CONSTANTS.HARVEST.CAVE_DROP_RATE; // 1.5%
  const effectiveDropRate = isForest ? baseRate * 2 * dropRateMultiplier : baseRate * dropRateMultiplier;
  if (roll > effectiveDropRate) return null;

  const typeRoll = Math.random();
  let itemType: ItemType;
  let rarity: ItemRarity;
  let sacrificeMetal = 0;
  let sacrificeEnergy = 0;

  if (isForest) {
    // Forests: tradeables only, no diggers
    itemType = ItemType.TradeableItem;
    rarity = typeRoll < 0.6 ? ItemRarity.Uncommon : typeRoll < 0.9 ? ItemRarity.Rare : ItemRarity.Epic;
  } else {
    // Caves: rarity-weighted distribution
    // 60% Common, 25% Uncommon, 10% Rare, 4% Epic, 1% Legendary
    if (typeRoll < 0.60) {
      rarity = ItemRarity.Common;
    } else if (typeRoll < 0.85) {
      rarity = ItemRarity.Uncommon;
    } else if (typeRoll < 0.95) {
      rarity = ItemRarity.Rare;
    } else if (typeRoll < 0.99) {
      rarity = ItemRarity.Epic;
    } else {
      rarity = ItemRarity.Legendary;
    }

    // Determine digger type: 45% metal, 40% energy, 15% universal
    const typeDice = Math.random();
    if (typeDice < 0.45) {
      itemType = ItemType.MetalDigger;
      sacrificeMetal = getSacrificeValue(rarity);
    } else if (typeDice < 0.85) {
      itemType = ItemType.EnergyDigger;
      sacrificeEnergy = getSacrificeValue(rarity);
    } else {
      itemType = ItemType.UniversalDigger;
      const half = getSacrificeValue(rarity) / 2;
      sacrificeMetal = half;
      sacrificeEnergy = half;
    }
  }

  return {
    id: generateItemId(),
    name: pickRandomName(itemType, rarity),
    type: itemType,
    rarity,
    description: getRarityEffect(rarity),
    sacrificeValue: { metal: sacrificeMetal, energy: sacrificeEnergy },
    foundAt: { x: 0, y: 0 },
    foundDate: new Date(),
  };
}

/** Sacrifice value by rarity */
function getSacrificeValue(rarity: ItemRarity): number {
  switch (rarity) {
    case ItemRarity.Common: return 0.5;
    case ItemRarity.Uncommon: return 1.5;
    case ItemRarity.Rare: return 4.0;
    case ItemRarity.Epic: return 10.0;
    case ItemRarity.Legendary: return 25.0;
    default: return 0.5;
  }
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

  const { data: player } = await supabase
    .from('players')
    .select('inventory_capacity')
    .eq('username', username)
    .single();
  if (!player) return { success: false, message: 'Player not found' };

  const currentCount = await getInventoryItemCount(username);
  if (currentCount >= (player.inventory_capacity || GAME_CONSTANTS.HARVEST.DEFAULT_INVENTORY_CAPACITY)) return { success: false, message: 'Inventory full!' };

  const currentPeriod = getCurrentResetPeriod(tile.x);
  await supabase.from('tile_harvest_records').insert({
    tile_x: tile.x, tile_y: tile.y, player_id: username,
    harvested_at: new Date().toISOString(), reset_period: currentPeriod,
  });

  let dropRateMultiplier = 1;
  try {
    const { data: flag } = await supabase.from('flags').select('bearer_username').limit(1).maybeSingle();
    if (flag?.bearer_username === username) dropRateMultiplier = FLAG_CONFIG.FLAG_BONUSES.caveDropBoost;
  } catch {}

  const isForest = tile.terrain === TerrainType.Forest;
  const item = generateCaveItem(dropRateMultiplier, isForest);
  if (!item) return { success: true, message: getHarvestSuccessMessage(TerrainType.Cave, undefined, 'none') };

  item.foundAt = { x: tile.x, y: tile.y };

  await supabase.from('player_inventory').insert({
    player_username: username,
    item_id: item.id,
    name: item.name,
    item_type: item.type,
    rarity: item.rarity,
    quantity: 1,
    description: item.description,
    bonus_percent: item.sacrificeValue.metal + item.sacrificeValue.energy,
    digger_weight: item.type === ItemType.TradeableItem ? 0 : 1,
    found_at_x: item.foundAt.x,
    found_at_y: item.foundAt.y,
    found_date: new Date().toISOString(),
  });

  const isDigger = [ItemType.MetalDigger, ItemType.EnergyDigger, ItemType.UniversalDigger].includes(item.type);
  return {
    success: true,
    message: getHarvestSuccessMessage(TerrainType.Cave, item.sacrificeValue.metal + item.sacrificeValue.energy, isDigger ? 'digger' : 'tradeable'),
    item,
    diggerCount: 0,
  };
}

export async function awardTutorialDigger(username: string): Promise<{ success: boolean; message: string; digger?: CaveHarvestResult['item'] }> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('inventory_capacity').eq('username', username).single();
  if (!player) return { success: false, message: 'Player not found' };
  const currentCount = await getInventoryItemCount(username);
  if (currentCount >= (player.inventory_capacity || GAME_CONSTANTS.HARVEST.DEFAULT_INVENTORY_CAPACITY)) return { success: false, message: 'Inventory full!' };

  const digger: CaveHarvestResult['item'] = {
    id: `tutorial-digger-${Date.now()}`,
    name: pickRandomName('UNIVERSAL_DIGGER', 'Rare'),
    type: ItemType.UniversalDigger,
    rarity: ItemRarity.Rare,
    description: 'A gift from the wasteland guides. Sacrifice at the Shrine for permanent gathering bonus.',
    sacrificeValue: { metal: 2.0, energy: 2.0 },
    foundAt: { x: 0, y: 0 },
    foundDate: new Date(),
  };

  await supabase.from('player_inventory').insert({
    player_username: username,
    item_id: digger.id,
    name: digger.name,
    item_type: digger.type,
    rarity: digger.rarity,
    quantity: 1,
    description: digger.description,
    bonus_percent: digger.sacrificeValue.metal + digger.sacrificeValue.energy,
    digger_weight: 1,
    found_at_x: null,
    found_at_y: null,
    found_date: new Date().toISOString(),
  });

  return { success: true, message: 'Tutorial Universal Digger awarded!', digger };
}

export const harvestForestTile = harvestCaveTile;
export const awardTutorialDiggerToPlayer = awardTutorialDigger;
