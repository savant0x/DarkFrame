/**
 * @file lib/playerService.ts
 * @created 2025-10-16
 * @updated 2026-05-03 (FID-20260503-SUPABASE: MongoDB → Supabase)
 * @overview Player management service — Supabase Postgres backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/types/database';
import { GAME_CONSTANTS } from '@/types';

type PlayerRow = Tables<'players'>;
type TileRow = Tables<'tiles'>;

const SUPABASE_PASSWORD_PLACEHOLDER = 'supabase_auth';

/**
 * Check if username is already taken
 */
export async function usernameExists(username: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('players')
    .select('username')
    .eq('username', username)
    .maybeSingle();
  return data !== null;
}

/**
 * Get player by username
 */
export async function getPlayerByUsername(username: string): Promise<PlayerRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('username', username)
    .single();
  if (error) return null;
  return data;
}

/**
 * Find and atomically claim a random Wasteland tile for spawning.
 * Uses a PostgreSQL CTE with FOR UPDATE to prevent race conditions.
 */
export async function findAndClaimSpawnTile(): Promise<TileRow | null> {
  const supabase = createServiceClient();

  const { data: tiles } = await supabase
    .from('tiles')
    .select('*')
    .eq('terrain', 'Wasteland')
    .eq('occupied_by_base', false)
    .limit(50);

  if (!tiles || tiles.length === 0) return null;

  const selected = tiles[Math.floor(Math.random() * tiles.length)];

  const { data: claimed, error } = await supabase
    .from('tiles')
    .update({ occupied_by_base: true })
    .eq('x', selected.x)
    .eq('y', selected.y)
    .eq('occupied_by_base', false)
    .select('*')
    .single();

  if (error || !claimed) {
    return findAndClaimSpawnTile();
  }

  return claimed;
}

/**
 * Build a PlayerInsert record with defaults for a new player.
 */
function buildPlayerInsert(username: string, email: string, spawnX: number, spawnY: number): TablesInsert<'players'> {
  return {
    username,
    email,
    password: SUPABASE_PASSWORD_PLACEHOLDER,
    base_x: spawnX,
    base_y: spawnY,
    current_x: spawnX,
    current_y: spawnY,
    resources_metal: 0,
    resources_energy: 0,
    bank_metal: 0,
    bank_energy: 0,
    rank: 1,
    xp: 0,
    level: 1,
    research_points: 0,
    total_strength: 0,
    total_defense: 0,
    factory_count: 0,
    gathering_metal_bonus: 0,
    gathering_energy_bonus: 0,
    inventory_capacity: GAME_CONSTANTS.HARVEST.DEFAULT_INVENTORY_CAPACITY,
    inventory_metal_digger_count: 0,
    inventory_energy_digger_count: 0,
    unlocked_tiers: ['1'],
    unlocked_techs: [],
    is_bot: false,
    is_special_base: false,
    is_admin: false,
    is_vip: false,
    login_streak: 0,
    current_hp: 1000,
    max_hp: 1000,
    total_referrals: 0,
    pending_referrals: 0,
    referral_rewards_metal: 0,
    referral_rewards_energy: 0,
    referral_rewards_rp: 0,
    referral_rewards_xp: 0,
    referral_rewards_vip_days: 0,
    referral_milestones: [],
    referral_milestones_reached: [],
    referral_validated: false,
    spec_doctrine: 'none',
    spec_mastery_level: 0,
    spec_mastery_xp: 0,
    spec_total_units_built: 0,
    spec_total_battles_won: 0,
    stat_battles_won: 0,
    stat_total_units_built: 0,
    stat_total_resources_gathered: 0,
    stat_total_resources_banked: 0,
    stat_shrine_trade_count: 0,
    stat_caves_explored: 0,
    battle_infantry_initiated: 0,
    battle_infantry_won: 0,
    battle_infantry_lost: 0,
    battle_base_initiated: 0,
    battle_base_won: 0,
    battle_base_lost: 0,
    battle_base_defense_total: 0,
    battle_base_defense_won: 0,
    battle_base_defense_lost: 0,
  };
}

/**
 * Create a new player with spawn location (legacy — no email/password).
 */
export async function createPlayer(username: string): Promise<PlayerRow> {
  const trimmed = username.trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 20) {
    throw new Error('Username must be between 3 and 20 characters');
  }

  const exists = await usernameExists(trimmed);
  if (exists) throw new Error('Username already taken');

  const spawnTile = await findAndClaimSpawnTile();
  if (!spawnTile) throw new Error('No available spawn locations');

  const insert = buildPlayerInsert(trimmed, `${trimmed}@legacy.local`, spawnTile.x, spawnTile.y);

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('players').insert(insert).select('*').single();
  if (error) throw new Error(`Failed to create player: ${error.message}`);

  return data;
}

/**
 * Get player by username with computed factory count.
 */
export async function getPlayer(username: string): Promise<PlayerRow | null> {
  const supabase = createServiceClient();
  const { data: player, error } = await supabase
    .from('players')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !player) return null;

  const { count } = await supabase
    .from('factories')
    .select('*', { count: 'exact', head: true })
    .eq('owner', username);

  return { ...player, factory_count: count ?? 0 };
}

/**
 * Update player's current position.
 */
export async function updatePlayerPosition(
  username: string,
  newPosition: { x: number; y: number }
): Promise<PlayerRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('players')
    .update({ current_x: newPosition.x, current_y: newPosition.y })
    .eq('username', username)
    .select('*')
    .single();

  if (error) return null;
  return data;
}

/**
 * No longer needed — indexes created by migration. Kept for backward compat.
 */
export async function createPlayerIndexes(): Promise<void> {}

/**
 * Check if email is already registered.
 */
export async function emailInUse(email: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('players')
    .select('username')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  return data !== null;
}

/**
 * Get player by email.
 */
export async function getPlayerByEmail(email: string): Promise<PlayerRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single();
  if (error) return null;
  return data;
}

/**
 * Create a new player with authentication credentials (used by Supabase Auth register flow).
 * Supabase Auth handles password hashing — we just store the player record.
 */
export async function createPlayerWithAuth(
  username: string,
  email: string,
  _hashedPassword: string
): Promise<PlayerRow> {
  const trimmed = username.trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 20) {
    throw new Error('Username must be between 3 and 20 characters');
  }

  const supabase = createServiceClient();

  const { data: existingUser } = await supabase
    .from('players')
    .select('username')
    .eq('username', trimmed)
    .maybeSingle();
  if (existingUser) throw new Error('Username already taken');

  const { data: existingEmail } = await supabase
    .from('players')
    .select('username')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  if (existingEmail) throw new Error('Email already registered');

  const spawnTile = await findAndClaimSpawnTile();
  if (!spawnTile) throw new Error('No available spawn locations');

  const insert = buildPlayerInsert(trimmed, email.toLowerCase().trim(), spawnTile.x, spawnTile.y);

  const { data, error } = await supabase.from('players').insert(insert).select('*').single();
  if (error) throw new Error(`Failed to create player: ${error.message}`);

  return data;
}
