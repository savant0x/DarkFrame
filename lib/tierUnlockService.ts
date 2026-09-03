/**
 * @file lib/tierUnlockService.ts
 * @created 2025-10-17
 * @overview Tier unlock service for managing RP-based unit tier unlocks
 * 
 * OVERVIEW:
 * Handles unlocking of unit tiers using Research Points (RP). Players must spend
 * RP to unlock higher unit tiers. Once unlocked, a tier remains accessible forever.
 * Tier 1 is always unlocked by default.
 */

import { getCollection } from './mongodb';
import { Player, UnitTier, TIER_UNLOCK_REQUIREMENTS } from '@/types';

/**
 * Check if player can unlock a specific tier
 * 
 * @param playerId - Player username
 * @param tier - Tier to check (1-5)
 * @returns Object with canUnlock status and reason if false
 */
export async function canUnlockTier(
  playerId: string,
  tier: UnitTier
): Promise<{ canUnlock: boolean; reason?: string; requirements?: { level: number; rp: number } }> {
  const playersCollection = await getCollection<Player>('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player) {
    return { canUnlock: false, reason: 'Player not found' };
  }

  // Tier 1 is always unlocked
  if (tier === UnitTier.Tier1) {
    return { canUnlock: true };
  }

  const requirements = TIER_UNLOCK_REQUIREMENTS[tier];

  // Check if already unlocked
  if (player.unlockedTiers?.includes(tier)) {
    return { canUnlock: false, reason: 'Tier already unlocked' };
  }

  // Check level requirement
  if (player.level < requirements.level) {
    return {
      canUnlock: false,
      reason: `Requires level ${requirements.level} (current: ${player.level})`,
      requirements
    };
  }

  // Check RP requirement
  if (player.researchPoints < requirements.rp) {
    return {
      canUnlock: false,
      reason: `Requires ${requirements.rp} RP (current: ${player.researchPoints})`,
      requirements
    };
  }

  return { canUnlock: true, requirements };
}

/**
 * Unlock a tier for a player by spending RP
 * 
 * @param playerId - Player username
 * @param tier - Tier to unlock (2-5, Tier 1 is free)
 * @returns Success status and updated player data
 */
export async function unlockTier(
  playerId: string,
  tier: UnitTier
): Promise<{
  success: boolean;
  message: string;
  tierUnlocked?: UnitTier;
  rpSpent?: number;
  rpRemaining?: number;
  unlockedTiers?: UnitTier[];
}> {
  // Validate tier unlocking eligibility
  const eligibility = await canUnlockTier(playerId, tier);

  if (!eligibility.canUnlock) {
    return {
      success: false,
      message: eligibility.reason || 'Cannot unlock tier'
    };
  }

  const requirements = TIER_UNLOCK_REQUIREMENTS[tier];
  const playersCollection = await getCollection<Player>('players');

  // Perform atomic update: deduct RP and add tier to unlocked list
  const updateResult = await playersCollection.findOneAndUpdate(
    {
      username: playerId,
      researchPoints: { $gte: requirements.rp } // Double-check RP availability
    },
    {
      $inc: { researchPoints: -requirements.rp },
      $addToSet: { unlockedTiers: tier },
      $push: {
        rpHistory: {
          amount: -requirements.rp,
          reason: `Unlocked Tier ${tier} units`,
          timestamp: new Date(),
          balance: 0 // Will be set in post-processing
        }
      }
    },
    { returnDocument: 'after' }
  );

  if (!updateResult) {
    return {
      success: false,
      message: 'Failed to unlock tier (insufficient RP or already unlocked)'
    };
  }

  // Update the balance in the most recent RP history entry
  if (updateResult.rpHistory && updateResult.rpHistory.length > 0) {
    const lastEntry = updateResult.rpHistory[updateResult.rpHistory.length - 1];
    lastEntry.balance = updateResult.researchPoints;

    await playersCollection.updateOne(
      { username: playerId },
      { $set: { rpHistory: updateResult.rpHistory } }
    );
  }

  return {
    success: true,
    message: `Tier ${tier} unlocked! You can now build advanced units.`,
    tierUnlocked: tier,
    rpSpent: requirements.rp,
    rpRemaining: updateResult.researchPoints,
    unlockedTiers: updateResult.unlockedTiers || [UnitTier.Tier1]
  };
}

/**
 * Get player's tier unlock status
 * 
 * @param playerId - Player username
 * @returns Array of tier unlock information
 */
export async function getTierUnlockStatus(playerId: string): Promise<{
  playerLevel: number;
  currentRP: number;
  unlockedTiers: UnitTier[];
  availableTiers: Array<{
    tier: UnitTier;
    isUnlocked: boolean;
    canUnlock: boolean;
    requirements: { level: number; rp: number };
    reason?: string;
  }>;
}> {
  const playersCollection = await getCollection<Player>('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player) {
    throw new Error('Player not found');
  }

  const unlockedTiers = player.unlockedTiers || [UnitTier.Tier1];

  // Check status for all tiers
  const availableTiers = await Promise.all(
    [UnitTier.Tier1, UnitTier.Tier2, UnitTier.Tier3, UnitTier.Tier4, UnitTier.Tier5].map(
      async (tier) => {
        const requirements = TIER_UNLOCK_REQUIREMENTS[tier];
        const isUnlocked = unlockedTiers.includes(tier);
        const eligibility = await canUnlockTier(playerId, tier);

        return {
          tier,
          isUnlocked,
          canUnlock: eligibility.canUnlock && !isUnlocked,
          requirements,
          reason: eligibility.reason
        };
      }
    )
  );

  return {
    playerLevel: player.level,
    currentRP: player.researchPoints,
    unlockedTiers,
    availableTiers
  };
}

/**
 * Get all units available to player (based on unlocked tiers)
 * 
 * @param playerId - Player username
 * @returns Array of available unit configurations
 */
export async function getPlayerAvailableUnits(playerId: string) {
  const playersCollection = await getCollection<Player>('players');
  const player = await playersCollection.findOne({ username: playerId });

  if (!player) {
    throw new Error('Player not found');
  }

  const { getAvailableUnits } = await import('@/types');
  const unlockedTiers = player.unlockedTiers || [UnitTier.Tier1];

  return getAvailableUnits(player.level, unlockedTiers);
}

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * TIER UNLOCK SYSTEM:
 * 
 * - Tier 1: Always unlocked (0 RP, Level 1+)
 * - Tier 2: 5 RP, Level 5+
 * - Tier 3: 15 RP, Level 10+
 * - Tier 4: 30 RP, Level 20+
 * - Tier 5: 50 RP, Level 30+
 * 
 * UNLOCK FLOW:
 * 1. Player gains levels through gameplay
 * 2. Each level grants 1 RP
 * 3. Player spends RP to unlock higher tiers
 * 4. Once unlocked, tier is permanently available
 * 5. All units in unlocked tier become buildable
 * 
 * RP ECONOMY:
 * - Level 5: 5 RP earned → Can unlock Tier 2
 * - Level 10: 10 RP earned → After Tier 2 (5 RP), have 5 RP, need 10 more for Tier 3
 * - Level 25: 25 RP earned → Can unlock all tiers by strategic spending
 * - Level 50+: Excess RP can be used for future features
 * 
 * STRATEGIC CHOICES:
 * - Rush higher tiers early for powerful units (risky, fewer unit types)
 * - Unlock tiers gradually as needed (safe, diverse army)
 * - Save RP for future content (patient, planning ahead)
 */
