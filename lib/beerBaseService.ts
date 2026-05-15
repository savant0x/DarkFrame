/**
 * Beer Base Service — Supabase backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import { fromJsonb, toJsonb } from '@/lib/supabase/jsonb';
import { createBotPlayer } from './botService';
import { BotSpecialization, PlayerUnit, UnitType } from '@/types/game.types';
import type { Tables, Json, Database } from '@/types/database';

const MAP_SIZE = 150;

export interface BeerBaseConfig {
  spawnRateMin: number; spawnRateMax: number; resourceMultiplier: number;
  respawnDay: number; respawnHour: number; enabled: boolean;
  varietyEnabled?: boolean; minWeakPercent?: number; minMediumPercent?: number;
  minStrongPercent?: number; minElitePercent?: number; maxSameTierPercent?: number;
  schedulesEnabled?: boolean; schedules?: RespawnSchedule[];
  usePredictiveSpawning?: boolean; predictiveWeeksAhead?: number;
}

export interface RespawnSchedule {
  id: string; enabled: boolean; dayOfWeek: number; hour: number;
  spawnPercentage: number; timezone: string; name?: string; lastRun?: Date;
}

const DEFAULT_CONFIG: BeerBaseConfig = {
  spawnRateMin: 5, spawnRateMax: 10, resourceMultiplier: 3,
  respawnDay: 0, respawnHour: 4, enabled: true,
  varietyEnabled: true, minWeakPercent: 15, minMediumPercent: 20,
  minStrongPercent: 15, minElitePercent: 10, maxSameTierPercent: 60,
  schedulesEnabled: false,
  schedules: [{ id: 'default-schedule', enabled: true, dayOfWeek: 0, hour: 4, spawnPercentage: 100, timezone: 'America/New_York', name: 'Sunday Morning Spawn' }],
  usePredictiveSpawning: false, predictiveWeeksAhead: 2,
};

export async function getBeerBaseConfig(): Promise<BeerBaseConfig> {
  const supabase = createServiceClient();
  const { data: config } = await supabase.from('bot_config').select('*').eq('config_key', 'beerBase').single();
  if (config) {
    const cfg = fromJsonb<Partial<BeerBaseConfig>>(config.config_value);
    return { ...DEFAULT_CONFIG, ...cfg };
  }
  return DEFAULT_CONFIG;
}

export async function updateBeerBaseConfig(config: Partial<BeerBaseConfig>): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from('bot_config').upsert({
    config_key: 'beerBase',
    config_value: toJsonb({ ...config, updatedAt: new Date().toISOString() }),
  }, { onConflict: 'config_key' });
}

export async function addSchedule(schedule: RespawnSchedule): Promise<void> {
  const config = await getBeerBaseConfig();
  const schedules = [...(config.schedules || []), schedule];
  await updateBeerBaseConfig({ schedules });
}

export async function updateSchedule(id: string, updates: Partial<RespawnSchedule>): Promise<RespawnSchedule | void> {
  const config = await getBeerBaseConfig();
  const schedules = config.schedules || [];
  const idx = schedules.findIndex(s => s.id === id);
  if (idx === -1) return undefined;
  schedules[idx] = { ...schedules[idx], ...updates, id };
  await updateBeerBaseConfig({ schedules });
  return schedules[idx];
}

export async function deleteSchedule(scheduleId: string): Promise<RespawnSchedule | void> {
  const config = await getBeerBaseConfig();
  const schedules = config.schedules || [];
  const idx = schedules.findIndex(s => s.id === scheduleId);
  if (idx === -1) return undefined;
  const removed = schedules.splice(idx, 1)[0];
  await updateBeerBaseConfig({ schedules });
  return removed;
}

export function getSchedules(): Promise<RespawnSchedule[]> {
  return getBeerBaseConfig().then(c => c.schedules || []);
}

export async function getTargetBeerBaseCount(): Promise<number> {
  const config = await getBeerBaseConfig();
  const supabase = createServiceClient();

  // Count ONLY regular bots (exclude Beer Bases and human players)
  const { count: regularBots } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('is_bot', true)
    .neq('is_special_base', true);

  const totalRegularBots = regularBots || 0;

  // FIX from FID-20251025-BEERBASE-EMERGENCY: Return 0 if no regular bots exist
  if (totalRegularBots === 0) return 0;

  // Use average spawn rate (no random variance — prevents fluctuation bugs)
  const spawnRate = (config.spawnRateMin + config.spawnRateMax) / 2;
  let targetCount = Math.floor(totalRegularBots * (spawnRate / 100));

  // SAFETY CAP #1: Get botConfig totalBotCap
  const { data: botCfg } = await supabase
    .from('bot_config').select('config_value').eq('config_key', 'botConfig').single();
  const totalBotCap = (botCfg?.config_value as { totalBotCap?: number })?.totalBotCap || 1000;

  // SAFETY CAP #2: Never exceed 10% of total bot cap
  const maxAllowed = Math.floor(totalBotCap * 0.10);
  targetCount = Math.min(targetCount, maxAllowed);

  // SAFETY CAP #3: Absolute maximum of 1000
  targetCount = Math.min(targetCount, 1000);

  return Math.max(1, targetCount);
}

export async function getCurrentBeerBaseCount(): Promise<number> {
  const { count } = await createServiceClient().from('players').select('*', { count: 'exact', head: true }).eq('is_bot', true).eq('is_special_base', true);
  return count || 0;
}

enum PowerTier { Weak = 'WEAK', Mid = 'MID', Strong = 'STRONG', Elite = 'ELITE', Ultra = 'ULTRA', Legendary = 'LEGENDARY' }

function getRandomPosition(): { x: number; y: number } {
  return { x: Math.floor(Math.random() * MAP_SIZE), y: Math.floor(Math.random() * MAP_SIZE) };
}

/**
 * Query for a random Wasteland tile that is not occupied by a base.
 * Falls back to getRandomPosition() if no Wasteland tiles found.
 */
async function getRandomWastelandPosition(supabase: ReturnType<typeof createServiceClient>): Promise<{ x: number; y: number }> {
  const { data: tiles } = await supabase
    .from('tiles')
    .select('x, y')
    .eq('terrain', 'Wasteland')
    .eq('occupied_by_base', false)
    .limit(500);

  if (tiles && tiles.length > 0) {
    const tile = tiles[Math.floor(Math.random() * tiles.length)];
    return { x: tile.x, y: tile.y };
  }
  return getRandomPosition();
}

function selectRandomPowerTier(): PowerTier {
  const roll = Math.random() * 100;
  if (roll < 10) return PowerTier.Weak; if (roll < 40) return PowerTier.Mid;
  if (roll < 70) return PowerTier.Strong; if (roll < 90) return PowerTier.Elite;
  if (roll < 98) return PowerTier.Ultra; return PowerTier.Legendary;
}

export async function spawnBeerBase(): Promise<string> {
  const supabase = createServiceClient();
  const config = await getBeerBaseConfig();
  const specializations = [
    BotSpecialization.Hoarder, BotSpecialization.Hoarder, BotSpecialization.Hoarder,
    BotSpecialization.Fortress, BotSpecialization.Fortress,
    BotSpecialization.Raider, BotSpecialization.Raider,
    BotSpecialization.Balanced, BotSpecialization.Balanced, BotSpecialization.Ghost,
  ];
  const specialization = specializations[Math.floor(Math.random() * specializations.length)];
  const powerTier = selectRandomPowerTier();
  const position = await getRandomWastelandPosition(supabase);

  const bot = await createBotPlayer(null, specialization, true);
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000);
  const botUsername = `🍺BeerBase-${powerTier}-${timestamp}-${randomSuffix}`;

  const resourceMultipliers: Record<string, number> = {
    [PowerTier.Weak]: 2, [PowerTier.Mid]: 3, [PowerTier.Strong]: 5,
    [PowerTier.Elite]: 8, [PowerTier.Ultra]: 12, [PowerTier.Legendary]: 20,
  };
  const multiplier = resourceMultipliers[powerTier] * config.resourceMultiplier;
  const botResources = bot.resources ?? { metal: 1000, energy: 1000 };
  const metal = Math.floor((botResources.metal || 1000) * multiplier);
  const energy = Math.floor((botResources.energy || 1000) * multiplier);

  const insertData: Database['public']['Tables']['players']['Insert'] = {
    username: botUsername,
    email: `${botUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}@bot.darkframe.local`,
    password: 'beerbase_bot_auth_placeholder',
    is_bot: true,
    is_special_base: true,
    is_admin: false,
    level: Math.floor(Math.random() * 10) + 1,
    xp: 0,
    rank: 1,
    resources_metal: metal,
    resources_energy: energy,
    total_strength: bot.totalStrength ?? 100,
    total_defense: bot.totalDefense ?? 100,
    current_x: position.x,
    current_y: position.y,
    base_x: position.x,
    base_y: position.y,
    factory_count: 0,
    inventory_capacity: 2000,
    research_points: 0,
    spec_doctrine: 'none',
  };
  await supabase.from('players').insert(insertData);

  return botUsername;
}

export async function spawnBeerBases(count: number): Promise<string[]> {
  const spawned: string[] = [];
  for (let i = 0; i < count; i++) {
    try { spawned.push(await spawnBeerBase()); }
    catch (error) { console.error(`Failed to spawn Beer Base ${i + 1}:`, error); }
  }
  return spawned;
}

export async function removeBeerBase(username: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: bot } = await supabase.from('players').select('*').eq('username', username).eq('is_bot', true).eq('is_special_base', true).single();
  if (!bot) throw new Error('Bot is not a Beer Base or does not exist');
  await supabase.from('players').delete().eq('username', username);
}

export async function weeklyBeerBaseRespawn(): Promise<{ removed: number; spawned: number; beerBases: string[] }> {
  const supabase = createServiceClient();
  const config = await getBeerBaseConfig();
  if (!config.enabled) return { removed: 0, spawned: 0, beerBases: [] };
  const { count: removed } = await supabase.from('players').delete({ count: 'exact' }).eq('is_bot', true).eq('is_special_base', true);
  const targetCount = await getTargetBeerBaseCount();
  const beerBases = await spawnBeerBases(targetCount);
  return { removed: removed || 0, spawned: beerBases.length, beerBases };
}

export function getNextRespawnTime(config: BeerBaseConfig = DEFAULT_CONFIG): Date {
  const now = new Date(); const next = new Date();
  next.setHours(config.respawnHour, 0, 0, 0);
  let daysUntil = config.respawnDay - now.getDay();
  if (daysUntil < 0 || (daysUntil === 0 && now.getHours() >= config.respawnHour)) daysUntil += 7;
  next.setDate(now.getDate() + daysUntil);
  return next;
}

export async function getBeerBaseStats(): Promise<{ current: number; target: number; config: BeerBaseConfig; nextRespawn: Date; beerBases: Record<string, unknown>[] }> {
  const config = await getBeerBaseConfig();
  const current = await getCurrentBeerBaseCount();
  const target = await getTargetBeerBaseCount();
  const nextRespawn = getNextRespawnTime(config);
  const supabase = createServiceClient();
  const { data: beerBases } = await supabase.from('players').select('username, current_x, current_y, resources_metal, resources_energy, total_strength, total_defense').eq('is_bot', true).eq('is_special_base', true);
  return {
    current, target, config, nextRespawn,
    beerBases: (beerBases || []).map(bb => ({
      username: bb.username, specialization: 'Hoarder', tier: 1,
      position: { x: bb.current_x || 0, y: bb.current_y || 0 },
      resources: { metal: bb.resources_metal || 0, energy: bb.resources_energy || 0 },
      totalStrength: bb.total_strength || 0, totalDefense: bb.total_defense || 0,
    })),
  };
}

export function isRespawnTime(config: BeerBaseConfig = DEFAULT_CONFIG): boolean {
  const now = new Date();
  return now.getDay() === config.respawnDay && now.getHours() === config.respawnHour;
}

export async function manualBeerBaseRespawn() {
  try {
    const result = await weeklyBeerBaseRespawn();
    return { success: true, ...result };
  } catch (error) {
    console.error('Manual Beer Base respawn failed:', error);
    return { success: false, removed: 0, spawned: 0, beerBases: [] };
  }
}
