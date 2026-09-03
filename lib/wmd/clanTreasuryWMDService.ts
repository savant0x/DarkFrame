/**
 * @file lib/wmd/clanTreasuryWMDService.ts
 * @created 2025-10-22
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @overview Clan Treasury WMD Funding System
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clans } from '@/lib/db/schema/clans';
import { ClanBankTransactionType } from '@/types/clan.types';
import type { ClanBankTransaction } from '@/types/clan.types';

export enum WMDPurchaseType {
  MISSILE_COMPONENT = 'MISSILE_COMPONENT',
  MISSILE_ASSEMBLY = 'MISSILE_ASSEMBLY',
  DEFENSE_BATTERY = 'DEFENSE_BATTERY',
  SPY_RECRUITMENT = 'SPY_RECRUITMENT',
  SPY_MISSION = 'SPY_MISSION',
  RESEARCH_RP = 'RESEARCH_RP',
}

interface WMDTreasuryTransaction {
  transactionId: string;
  clanId: string;
  purchaseType: WMDPurchaseType;
  requestedBy: string;
  requestedByUsername: string;
  cost: { metal: number; energy: number };
  perMemberCost: { metal: number; energy: number };
  clanMemberCount: number;
  description: string;
  timestamp: Date;
  refunded?: boolean;
  refundedAt?: Date;
}

const MINIMUM_CLAN_SIZE_FOR_WMD = 3;

export async function validateClanWMDFunds(
  clanId: string,
  cost: { metal: number; energy: number }
): Promise<{
  valid: boolean;
  message: string;
  treasury?: { metal: number; energy: number };
  shortfall?: { metal: number; energy: number };
  perMemberCost?: { metal: number; energy: number };
  memberCount?: number;
}> {
  try {
    const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
    const clan = clanResult[0];

    if (!clan) {
      return { valid: false, message: 'Clan not found' };
    }

    const memberCount = clan.members?.length || 0;
    if (memberCount < MINIMUM_CLAN_SIZE_FOR_WMD) {
      return {
        valid: false,
        message: `WMD systems require minimum ${MINIMUM_CLAN_SIZE_FOR_WMD} clan members. Current: ${memberCount}`,
        memberCount,
      };
    }

    const treasury = {
      metal: Number(clan.bankTreasuryMetal),
      energy: Number(clan.bankTreasuryEnergy),
    };

    const hasMetal = treasury.metal >= cost.metal;
    const hasEnergy = treasury.energy >= cost.energy;

    if (!hasMetal || !hasEnergy) {
      const shortfall = {
        metal: Math.max(0, cost.metal - treasury.metal),
        energy: Math.max(0, cost.energy - treasury.energy),
      };

      const perMemberShortfall = {
        metal: Math.ceil(shortfall.metal / memberCount),
        energy: Math.ceil(shortfall.energy / memberCount),
      };

      return {
        valid: false,
        message: `Insufficient clan treasury. Need ${shortfall.metal.toLocaleString()} more metal, ${shortfall.energy.toLocaleString()} more energy. Per member: ${perMemberShortfall.metal.toLocaleString()} metal, ${perMemberShortfall.energy.toLocaleString()} energy`,
        treasury,
        shortfall,
        perMemberCost: perMemberShortfall,
        memberCount,
      };
    }

    const perMemberCost = {
      metal: Math.ceil(cost.metal / memberCount),
      energy: Math.ceil(cost.energy / memberCount),
    };

    return {
      valid: true,
      message: 'Clan treasury has sufficient funds',
      treasury,
      perMemberCost,
      memberCount,
    };
  } catch (error) {
    console.error('[WMD Treasury] Validation error:', error);
    return { valid: false, message: 'Treasury validation failed' };
  }
}

export async function deductWMDCost(
  clanId: string,
  purchaseType: WMDPurchaseType,
  requestedBy: string,
  requestedByUsername: string,
  cost: { metal: number; energy: number },
  description: string
): Promise<{
  success: boolean;
  message: string;
  transactionId?: string;
  remainingTreasury?: { metal: number; energy: number };
  perMemberCost?: { metal: number; energy: number };
}> {
  try {
    const validation = await validateClanWMDFunds(clanId, cost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
    const clan = clanResult[0];
    if (!clan) {
      return { success: false, message: 'Clan not found' };
    }

    const transactionId = `wmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const bankTransaction: ClanBankTransaction = {
      transactionId,
      type: ClanBankTransactionType.WMD_PURCHASE,
      playerId: requestedBy,
      username: requestedByUsername,
      amount: { metal: cost.metal, energy: cost.energy },
      timestamp: new Date(),
      description,
    };

    const existingTransactions = clan.bankTransactions || [];
    const updatedTransactions = [...existingTransactions, bankTransaction].slice(-100);

    await db.update(clans).set({
      bankTreasuryMetal: Number(clan.bankTreasuryMetal) - cost.metal,
      bankTreasuryEnergy: Number(clan.bankTreasuryEnergy) - cost.energy,
      bankTransactions: updatedTransactions,
    }).where(eq(clans.id, clanId));

    const remainingTreasury = {
      metal: Number(clan.bankTreasuryMetal) - cost.metal,
      energy: Number(clan.bankTreasuryEnergy) - cost.energy,
    };

    console.log(`[WMD Treasury] Deducted ${cost.metal} metal, ${cost.energy} energy from clan ${clanId}. Per member: ${validation.perMemberCost!.metal} metal, ${validation.perMemberCost!.energy} energy`);

    return {
      success: true,
      message: `Purchased from clan treasury. Cost split among ${validation.memberCount} members.`,
      transactionId,
      remainingTreasury,
      perMemberCost: validation.perMemberCost,
    };
  } catch (error) {
    console.error('[WMD Treasury] Deduction error:', error);
    return { success: false, message: 'Failed to deduct from clan treasury' };
  }
}

export async function refundWMDCost(
  _clanId: string,
  _transactionId: string,
  _reason: string
): Promise<{ success: boolean; message: string }> {
  return { success: false, message: 'Refund requires wmd_treasury_transactions table' };
}

export async function getWMDTransactionHistory(
  _clanId: string,
  _limit: number = 50
): Promise<WMDTreasuryTransaction[]> {
  return [];
}

export async function calculateMemberContributions(
  clanId: string,
  targetCost: { metal: number; energy: number }
): Promise<{
  currentTreasury: { metal: number; energy: number };
  targetCost: { metal: number; energy: number };
  shortfall: { metal: number; energy: number };
  perMemberContribution: { metal: number; energy: number };
  memberCount: number;
  message: string;
}> {
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0];

  if (!clan) {
    throw new Error('Clan not found');
  }

  const memberCount = clan.members?.length || 0;
  const currentTreasury = {
    metal: Number(clan.bankTreasuryMetal),
    energy: Number(clan.bankTreasuryEnergy),
  };

  const shortfall = {
    metal: Math.max(0, targetCost.metal - currentTreasury.metal),
    energy: Math.max(0, targetCost.energy - currentTreasury.energy),
  };

  const perMemberContribution = {
    metal: memberCount > 0 ? Math.ceil(shortfall.metal / memberCount) : 0,
    energy: memberCount > 0 ? Math.ceil(shortfall.energy / memberCount) : 0,
  };

  const message = shortfall.metal > 0 || shortfall.energy > 0
    ? `Each of ${memberCount} members should deposit: ${perMemberContribution.metal.toLocaleString()} metal, ${perMemberContribution.energy.toLocaleString()} energy`
    : 'Clan treasury has sufficient funds!';

  return {
    currentTreasury,
    targetCost,
    shortfall,
    perMemberContribution,
    memberCount,
    message,
  };
}
