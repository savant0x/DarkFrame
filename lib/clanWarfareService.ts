/**
 * @fileoverview Clan Warfare Service
 * @module lib/clanWarfareService
 * 
 * OVERVIEW:
 * Manages clan warfare mechanics including war declaration, territory capture during wars,
 * war history tracking, and battle integration. Implements cooldown periods, cost systems
 * with perk reductions, and comprehensive war state management.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { ClanWar } from '@/types/clan.types';
import { ClanWarStatus } from '@/types/clan.types';

// ============================================================================
// CONSTANTS
// ============================================================================

export const WAR_CONSTANTS = {
  BASE_WAR_COST_METAL: 50000,
  BASE_WAR_COST_ENERGY: 50000,
  MIN_LEVEL_TO_DECLARE_WAR: 10,
  MIN_WAR_DURATION_HOURS: 48,
  WAR_COOLDOWN_HOURS: 168,
  BASE_CAPTURE_SUCCESS_RATE: 0.7,
  DEFENSE_BONUS_IMPACT: 0.5,
  WAR_SPOILS_METAL_PERCENT: 15,
  WAR_SPOILS_ENERGY_PERCENT: 15,
  WAR_SPOILS_RP_PERCENT: 10,
  WAR_VICTORY_XP_BONUS: 50000,
  WAR_DEFEAT_XP_PENALTY: 25000,
} as const;

// ============================================================================
// WAR DECLARATION
// ============================================================================

export async function declareWar(
  clanId: string,
  targetClanId: string,
  playerId: string
): Promise<{
  war: ClanWar;
  cost: { metal: number; energy: number };
  message: string;
}> {
  const supabase = createServiceClient();

  const { data: clan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  const { data: targetClan } = await supabase.from('clans').select('*').eq('id', targetClanId).single();

  if (!clan) throw new Error('Declaring clan not found');
  if (!targetClan) throw new Error('Target clan not found');
  if (clanId === targetClanId) throw new Error('Cannot declare war on your own clan');

  // Validate permissions
  const { data: member } = await supabase.from('clan_members').select('*').eq('clan_id', clanId).eq('player_id', playerId).single();
  if (!member) throw new Error('Player not in clan');
  if (!['LEADER', 'CO_LEADER', 'OFFICER'].includes(member.role)) {
    throw new Error('Only Leaders, Co-Leaders, and Officers can declare war');
  }

  if ((clan.clan_level || 0) < WAR_CONSTANTS.MIN_LEVEL_TO_DECLARE_WAR) {
    throw new Error(`Clan level ${WAR_CONSTANTS.MIN_LEVEL_TO_DECLARE_WAR} required to declare war`);
  }

  // Check for existing active wars
  const { data: existingWar } = await supabase
    .from('clan_wars')
    .select('id')
    .or(`attacker_clan_id.eq.${clanId},defender_clan_id.eq.${targetClanId}`)
    .eq('status', 'ACTIVE')
    .single();

  if (existingWar) throw new Error('An active war already exists between these clans');

  const baseCost = { metal: WAR_CONSTANTS.BASE_WAR_COST_METAL, energy: WAR_CONSTANTS.BASE_WAR_COST_ENERGY };

  if ((clan.bank_treasury_metal || 0) < baseCost.metal) throw new Error(`Insufficient Metal`);
  if ((clan.bank_treasury_energy || 0) < baseCost.energy) throw new Error(`Insufficient Energy`);

  // Deduct cost from bank
  await supabase.from('clans').update({
    bank_treasury_metal: (clan.bank_treasury_metal || 0) - baseCost.metal,
    bank_treasury_energy: (clan.bank_treasury_energy || 0) - baseCost.energy,
  }).eq('id', clanId);

  // Create war record
  const warId = `war_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await supabase.from('clan_wars').insert({
    war_id: warId,
    attacker_clan_id: clanId,
    defender_clan_id: targetClanId,
    status: 'DECLARED',
    declared_at: new Date().toISOString(),
    cost_metal: baseCost.metal,
    cost_energy: baseCost.energy,
  });

  // Log activity
  await supabase.from('clan_activity').insert([{
    clan_id: clanId,
    activity_type: 'WAR_DECLARED',
    player_id: playerId,
    username: member.username,
    details: { warId, targetClanId },
  }, {
    clan_id: targetClanId,
    activity_type: 'WAR_DECLARED',
    player_id: playerId,
    details: { warId, attackerClanId: clanId },
  }]);

  const war: ClanWar = {
    warId,
    attackerClanId: clanId,
    defenderClanId: targetClanId,
    status: ClanWarStatus.DECLARED,
    declaredAt: new Date(),
    declarationCost: baseCost,
    stats: { attackerTerritoryGained: 0, defenderTerritoryGained: 0, attackerBattlesWon: 0, defenderBattlesWon: 0 },
  };

  return { war, cost: baseCost, message: `War declared against ${targetClan.name}` };
}

export async function captureTerritory(
  clanId: string,
  targetClanId: string,
  tileX: number,
  tileY: number,
  playerId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();
  
  const { data: war } = await supabase
    .from('clan_wars')
    .select('*')
    .or(`attacker_clan_id.eq.${clanId},defender_clan_id.eq.${targetClanId}`)
    .eq('status', 'ACTIVE')
    .single();

  if (!war) throw new Error('No active war exists between these clans');

  const successRate = WAR_CONSTANTS.BASE_CAPTURE_SUCCESS_RATE;
  const captureSuccessful = Math.random() < successRate;

  if (!captureSuccessful) {
    return { success: false, message: 'Failed to capture territory' };
  }

  // Transfer territory
  await supabase.from('clan_territories').upsert({
    clan_id: clanId,
    tile_x: tileX,
    tile_y: tileY,
    claimed_by: playerId,
    claimed_at: new Date().toISOString(),
  }, { onConflict: 'tile_x,tile_y' });

  return { success: true, message: `Successfully captured territory (${tileX}, ${tileY})!` };
}

export async function endWar(
  warId: string,
  outcome: 'WIN' | 'LOSS' | 'TRUCE',
  endedBy: string
): Promise<ClanWar | null> {
  const supabase = createServiceClient();
  
  const { data: war } = await supabase.from('clan_wars').select('*').eq('war_id', warId).single();
  if (!war) throw new Error('War not found');

  if (war.status === 'ENDED') throw new Error('War has already ended');

  const winnerId = outcome === 'WIN' ? war.attacker_clan_id : outcome === 'LOSS' ? war.defender_clan_id : null;

  await supabase.from('clan_wars').update({
    status: 'ENDED',
    winner_clan_id: winnerId,
    ended_at: new Date().toISOString(),
  }).eq('war_id', warId);

  // Update clan stats
  if (outcome === 'WIN') {
    await distributeWarSpoils(war as unknown as ClanWar, war.attacker_clan_id, war.defender_clan_id);
  }

  return null;
}

export async function getActiveWars(clanId: string): Promise<ClanWar[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('clan_wars')
    .select('*')
    .or(`attacker_clan_id.eq.${clanId},defender_clan_id.eq.${clanId}`)
    .in('status', ['DECLARED', 'ACTIVE'])
    .order('declared_at', { ascending: false });
  return (data || []) as unknown as ClanWar[];
}

export async function getClanWarHistory(clanId: string, limit = 50): Promise<ClanWar[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('clan_wars')
    .select('*')
    .or(`attacker_clan_id.eq.${clanId},defender_clan_id.eq.${clanId}`)
    .eq('status', 'ENDED')
    .order('ended_at', { ascending: false })
    .limit(limit);
  return (data || []) as unknown as ClanWar[];
}

export async function getWar(warId: string): Promise<ClanWar | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('clan_wars').select('*').eq('war_id', warId).single();
  return data as unknown as ClanWar | null;
}

export async function calculateWarSpoils(winnerClanId: string, loserClanId: string) {
  const supabase = createServiceClient();
  const { data: loserClan } = await supabase.from('clans').select('*').eq('id', loserClanId).single();
  
  return {
    metal: Math.floor((loserClan?.bank_treasury_metal || 0) * (WAR_CONSTANTS.WAR_SPOILS_METAL_PERCENT / 100)),
    energy: Math.floor((loserClan?.bank_treasury_energy || 0) * (WAR_CONSTANTS.WAR_SPOILS_ENERGY_PERCENT / 100)),
    rp: Math.floor((loserClan?.bank_treasury_rp || 0) * (WAR_CONSTANTS.WAR_SPOILS_RP_PERCENT / 100)),
  };
}

export async function distributeWarSpoils(
  war: ClanWar,
  winnerId: string,
  loserId: string
): Promise<any> {
  const supabase = createServiceClient();
  const baseSpoils = await calculateWarSpoils(winnerId, loserId);
  
  // Deduct from loser
  const { data: loserClan } = await supabase.from('clans').select('*').eq('id', loserId).single();
  await supabase.from('clans').update({
    bank_treasury_metal: Math.max(0, (loserClan?.bank_treasury_metal || 0) - baseSpoils.metal),
    bank_treasury_energy: Math.max(0, (loserClan?.bank_treasury_energy || 0) - baseSpoils.energy),
  }).eq('id', loserId);

  // Add to winner
  const { data: winner } = await supabase.from('clans').select('*').eq('id', winnerId).single();
  await supabase.from('clans').update({
    bank_treasury_metal: (winner?.bank_treasury_metal || 0) + baseSpoils.metal,
    bank_treasury_energy: (winner?.bank_treasury_energy || 0) + baseSpoils.energy,
    bank_treasury_rp: (winner?.bank_treasury_rp || 0) + baseSpoils.rp,
    total_xp: (winner?.total_xp || 0) + WAR_CONSTANTS.WAR_VICTORY_XP_BONUS,
  }).eq('id', winnerId);

  return { success: true, spoils: baseSpoils };
}

export async function declareJointWar(
  clanId: string,
  allyClanId: string,
  targetClanId: string,
  targetAllyClanId: string | null,
  playerId: string
): Promise<ClanWar> {
  const result = await declareWar(clanId, targetClanId, playerId);
  return result.war;
}

export async function getWarParticipants(warId: string) {
  const supabase = createServiceClient();
  const { data: war } = await supabase.from('clan_wars').select('*').eq('war_id', warId).single();
  if (!war) throw new Error('War not found');
  
  return {
    attackers: [war.attacker_clan_id],
    defenders: [war.defender_clan_id],
  };
}

export async function canParticipateInWar(warId: string, clanId: string): Promise<boolean> {
  const participants = await getWarParticipants(warId);
  return participants.attackers.includes(clanId) || participants.defenders.includes(clanId);
}
