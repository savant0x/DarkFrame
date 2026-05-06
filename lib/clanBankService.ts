/**
 * Clan Bank Service - Treasury & Tax Management
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan banking operations including treasury management, tax collection,
 * resource deposits/withdrawals, bank upgrades, and transaction history tracking.
 * Implements permission-based access control and capacity limits.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export function initializeClanBankService(): void {
  // Supabase is stateless — no initialization needed
}
import {
  ClanBankTransactionType,
  CLAN_BANK_CONSTANTS,
  calculateTaxAmount,
  hasPermission,
} from '@/types/clan.types';

export async function depositToBank(
  clanId: string,
  playerId: string,
  resources: { metal?: number; energy?: number; researchPoints?: number }
): Promise<any> {
  const supabase = createServiceClient();
  
  // Get clan
  const { data: clan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  if (!clan) throw new Error('Clan not found');

  // Verify player is member
  const { data: member } = await supabase.from('clan_members').select('*').eq('clan_id', clanId).eq('player_id', playerId).single();
  if (!member) throw new Error('Player not in clan');

  const depositMetal = resources.metal || 0;
  const depositEnergy = resources.energy || 0;
  const depositRP = resources.researchPoints || 0;

  if (depositMetal < 0 || depositEnergy < 0 || depositRP < 0) throw new Error('Deposit amounts must be positive');
  if (depositMetal === 0 && depositEnergy === 0 && depositRP === 0) throw new Error('Must deposit at least one resource');

  const capacity = clan.bank_capacity || 1000000;
  if ((clan.bank_treasury_metal || 0) + depositMetal > capacity) throw new Error('Metal capacity exceeded');
  if ((clan.bank_treasury_energy || 0) + depositEnergy > capacity) throw new Error('Energy capacity exceeded');

  // Get player resources
  const { data: player } = await supabase.from('players').select('resources_metal, resources_energy, research_points').eq('username', playerId).single();
  if (!player) throw new Error('Player not found');

  if ((player.resources_metal || 0) < depositMetal) throw new Error('Insufficient Metal');
  if ((player.resources_energy || 0) < depositEnergy) throw new Error('Insufficient Energy');
  if ((player.research_points || 0) < depositRP) throw new Error('Insufficient Research Points');

  // Update clan bank
  await supabase.from('clans').update({
    bank_treasury_metal: (clan.bank_treasury_metal || 0) + depositMetal,
    bank_treasury_energy: (clan.bank_treasury_energy || 0) + depositEnergy,
    bank_treasury_rp: (clan.bank_treasury_rp || 0) + depositRP,
  }).eq('id', clanId);

  // Deduct from player
  await supabase.from('players').update({
    resources_metal: (player.resources_metal || 0) - depositMetal,
    resources_energy: (player.resources_energy || 0) - depositEnergy,
    research_points: (player.research_points || 0) - depositRP,
  }).eq('username', playerId);

  // Record transaction
  await supabase.from('clan_bank_transactions').insert({
    clan_id: clanId,
    transaction_type: 'DEPOSIT',
    username: member.username,
    player_id: playerId,
    amount_metal: depositMetal > 0 ? depositMetal : 0,
    amount_energy: depositEnergy > 0 ? depositEnergy : 0,
    amount_rp: depositRP > 0 ? depositRP : 0,
    description: `${member.username} deposited resources to bank`,
  });

  // Log activity
  await logBankActivity(clanId, 'BANK_DEPOSIT', playerId, { resources, username: member.username });

  const { data: updatedClan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  return updatedClan;
}

export async function withdrawFromBank(
  clanId: string,
  playerId: string,
  resources: { metal?: number; energy?: number; researchPoints?: number }
): Promise<any> {
  const supabase = createServiceClient();
  
  const { data: clan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  if (!clan) throw new Error('Clan not found');

  const { data: member } = await supabase.from('clan_members').select('*').eq('clan_id', clanId).eq('player_id', playerId).single();
  if (!member) throw new Error('Player not in clan');

  if (!hasPermission(member.role, 'canWithdrawFromBank')) throw new Error('No permission to withdraw from bank');

  const withdrawMetal = resources.metal || 0;
  const withdrawEnergy = resources.energy || 0;
  const withdrawRP = resources.researchPoints || 0;

  if (withdrawMetal < 0 || withdrawEnergy < 0 || withdrawRP < 0) throw new Error('Withdrawal amounts must be positive');
  if (withdrawMetal === 0 && withdrawEnergy === 0 && withdrawRP === 0) throw new Error('Must withdraw at least one resource');

  if (withdrawMetal > (clan.bank_treasury_metal || 0)) throw new Error('Insufficient Metal in bank');
  if (withdrawEnergy > (clan.bank_treasury_energy || 0)) throw new Error('Insufficient Energy in bank');

  // Update clan bank
  await supabase.from('clans').update({
    bank_treasury_metal: (clan.bank_treasury_metal || 0) - withdrawMetal,
    bank_treasury_energy: (clan.bank_treasury_energy || 0) - withdrawEnergy,
    bank_treasury_rp: (clan.bank_treasury_rp || 0) - withdrawRP,
  }).eq('id', clanId);

  // Add to player
  const { data: player } = await supabase.from('players').select('resources_metal, resources_energy, research_points').eq('username', playerId).single();
  await supabase.from('players').update({
    resources_metal: (player?.resources_metal || 0) + withdrawMetal,
    resources_energy: (player?.resources_energy || 0) + withdrawEnergy,
    research_points: (player?.research_points || 0) + withdrawRP,
  }).eq('username', playerId);

  // Record transaction
  await supabase.from('clan_bank_transactions').insert({
    clan_id: clanId,
    transaction_type: 'WITHDRAWAL',
    username: member.username,
    player_id: playerId,
    amount_metal: withdrawMetal > 0 ? withdrawMetal : 0,
    amount_energy: withdrawEnergy > 0 ? withdrawEnergy : 0,
    amount_rp: withdrawRP > 0 ? withdrawRP : 0,
    description: `${member.username} withdrew resources from bank`,
  });

  await logBankActivity(clanId, 'BANK_WITHDRAWAL', playerId, { resources });

  const { data: updatedClan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  return updatedClan;
}

export async function setTaxRates(
  clanId: string,
  playerId: string,
  taxRates: { metal?: number; energy?: number; researchPoints?: number }
): Promise<any> {
  const supabase = createServiceClient();
  
  const { data: clan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  if (!clan) throw new Error('Clan not found');

  const { data: member } = await supabase.from('clan_members').select('*').eq('clan_id', clanId).eq('player_id', playerId).single();
  if (!member) throw new Error('Player not in clan');

  if (!hasPermission(member.role, 'canManageTaxes')) throw new Error('Only clan leader can manage tax rates');

  const updateFields: any = {};
  if (taxRates.metal !== undefined) updateFields.bank_tax_metal = taxRates.metal;
  if (taxRates.energy !== undefined) updateFields.bank_tax_energy = taxRates.energy;
  if (taxRates.researchPoints !== undefined) updateFields.bank_tax_rp = taxRates.researchPoints;

  await supabase.from('clans').update(updateFields as Database['public']['Tables']['clans']['Update']).eq('id', clanId);

  await logBankActivity(clanId, 'TAX_RATE_CHANGED', playerId, { newRates: taxRates });

  const { data: updatedClan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  return updatedClan;
}

export async function collectTax(
  clanId: string,
  playerId: string,
  harvestAmount: number,
  resourceType: 'metal' | 'energy'
): Promise<number> {
  const supabase = createServiceClient();
  
  const { data: clan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  if (!clan) return 0;

  const taxRate = resourceType === 'metal' ? (clan.bank_tax_metal || 0) : (clan.bank_tax_energy || 0);
  if (taxRate === 0) return 0;

  const taxAmount = calculateTaxAmount(harvestAmount, taxRate);
  if (taxAmount === 0) return 0;

  const currentAmount = resourceType === 'metal' ? (clan.bank_treasury_metal || 0) : (clan.bank_treasury_energy || 0);
  if (currentAmount + taxAmount > (clan.bank_capacity || 1000000)) return 0;

  const treasuryField = resourceType === 'metal' ? 'bank_treasury_metal' : 'bank_treasury_energy';
  await supabase.from('clans').update({
    [treasuryField]: currentAmount + taxAmount,
  } as Database['public']['Tables']['clans']['Update']).eq('id', clanId);

  await supabase.from('clan_bank_transactions').insert({
    clan_id: clanId,
    transaction_type: 'TAX_COLLECTION',
    username: playerId,
    player_id: playerId,
    amount_metal: resourceType === 'metal' ? taxAmount : 0,
    amount_energy: resourceType === 'energy' ? taxAmount : 0,
    amount_rp: 0,
    description: `Tax collected from ${playerId}'s harvest (${taxRate}%)`,
  });

  return taxAmount;
}

export async function upgradeBankCapacity(clanId: string, playerId: string): Promise<any> {
  const supabase = createServiceClient();
  
  const { data: clan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  if (!clan) throw new Error('Clan not found');

  const { data: member } = await supabase.from('clan_members').select('*').eq('clan_id', clanId).eq('player_id', playerId).single();
  if (!member) throw new Error('Player not in clan');

  if (!hasPermission(member.role, 'canUpgradeBank')) throw new Error('Only clan leader can upgrade bank');

  const currentLevel = clan.bank_upgrade_level || 1;
  if (currentLevel >= 6) throw new Error('Bank is already at maximum level');

  const upgradeCost = CLAN_BANK_CONSTANTS.UPGRADE_COSTS.find(u => u.level === currentLevel + 1);
  if (!upgradeCost) throw new Error('Invalid upgrade level');

  if ((clan.bank_treasury_metal || 0) < upgradeCost.metal) throw new Error('Insufficient Metal');
  if ((clan.bank_treasury_energy || 0) < upgradeCost.energy) throw new Error('Insufficient Energy');
  if ((clan.bank_treasury_rp || 0) < upgradeCost.rp) throw new Error('Insufficient RP');

  const multipliers = CLAN_BANK_CONSTANTS.CAPACITY_MULTIPLIERS;
  const newCapacity = Math.floor(1000000 * multipliers[currentLevel]);

  await supabase.from('clans').update({
    bank_treasury_metal: (clan.bank_treasury_metal || 0) - upgradeCost.metal,
    bank_treasury_energy: (clan.bank_treasury_energy || 0) - upgradeCost.energy,
    bank_treasury_rp: (clan.bank_treasury_rp || 0) - upgradeCost.rp,
    bank_upgrade_level: currentLevel + 1,
    bank_capacity: newCapacity,
  }).eq('id', clanId);

  await supabase.from('clan_bank_transactions').insert({
    clan_id: clanId,
    transaction_type: 'BANK_UPGRADE',
    username: member.username,
    player_id: playerId,
    amount_metal: upgradeCost.metal,
    amount_energy: upgradeCost.energy,
    amount_rp: upgradeCost.rp,
    description: `Bank upgraded to level ${currentLevel + 1}`,
  });

  await logBankActivity(clanId, 'BANK_UPGRADED', playerId, { newLevel: currentLevel + 1, newCapacity });

  const { data: updatedClan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  return updatedClan;
}

export async function getBankTransactionHistory(
  clanId: string,
  limit: number = CLAN_BANK_CONSTANTS.TRANSACTION_HISTORY_LIMIT
): Promise<any[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('clan_bank_transactions')
    .select('*')
    .eq('clan_id', clanId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getBankStats(clanId: string): Promise<any> {
  const supabase = createServiceClient();
  const { data: clan } = await supabase.from('clans').select('*').eq('id', clanId).single();
  if (!clan) throw new Error('Clan not found');

  const capacity = clan.bank_capacity || 0;
  
  let nextUpgradeCost;
  const currentLevel = clan.bank_upgrade_level || 1;
  if (currentLevel < 6) {
    nextUpgradeCost = CLAN_BANK_CONSTANTS.UPGRADE_COSTS.find(u => u.level === currentLevel + 1);
  }

  return {
    treasury: {
      metal: clan.bank_treasury_metal || 0,
      energy: clan.bank_treasury_energy || 0,
      researchPoints: clan.bank_treasury_rp || 0,
    },
    capacity,
    upgradeLevel: clan.bank_upgrade_level || 1,
    taxRates: {
      metal: clan.bank_tax_metal || 0,
      energy: clan.bank_tax_energy || 0,
      researchPoints: clan.bank_tax_rp || 0,
    },
    usage: {
      metal: capacity > 0 ? ((clan.bank_treasury_metal || 0) / capacity) * 100 : 0,
      energy: capacity > 0 ? ((clan.bank_treasury_energy || 0) / capacity) * 100 : 0,
      researchPoints: 0,
    },
    nextUpgradeCost,
  };
}

async function logBankActivity(
  clanId: string,
  activityType: string,
  playerId: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('clan_activity').insert({
      clan_id: clanId,
      activity_type: activityType as unknown as Database['public']['Enums']['clan_activity_type'],
      player_id: playerId,
      username: metadata.username || playerId,
      details: metadata,
    });
  } catch (error) {
    console.error('Failed to log bank activity:', error);
  }
}
