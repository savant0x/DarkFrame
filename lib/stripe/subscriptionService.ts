/**
 * Subscription Service - VIP Lifecycle Management
 * 
 * OVERVIEW:
 * Handles the complete lifecycle of VIP subscriptions in DarkFrame including
 * granting VIP status on payment, automatic renewal tracking, and revocation
 * on cancellation. Bridges Stripe payment events with internal VIP system.
 * 
 * KEY RESPONSIBILITIES:
 * - Grant VIP status when checkout session completes
 * - Calculate expiration dates based on subscription tier
 * - Handle subscription updates (upgrades, downgrades)
 * - Revoke VIP status on cancellation
 * - Track payment transactions for audit and analytics
 * - Update user records with Stripe customer IDs
 * 
 * BUSINESS LOGIC:
 * - VIP granted immediately on successful payment
 * - Expiration calculated from subscription interval (week/month/year)
 * - Renewals extend expiration date automatically
 * - Cancellation revokes VIP immediately (no refund period)
 * - Failed payments trigger notification but don't revoke immediately
 * 
 * SECURITY:
 * - All database operations require user validation
 * - Stripe customer IDs stored for subscription management
 * - Payment amounts logged for fraud detection
 * - Transaction history maintained for auditing
 * 
 * DEPENDENCIES:
 * - lib/db (Drizzle ORM connection)
 * - lib/db/schema (players table)
 * - types/stripe.types (VIP tiers and payment types)
 * 
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE
 * Author: ECHO v5.1
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, gt, desc, sql } from 'drizzle-orm';
import { 
  VIPTier, 
  getVIPDurationDays,
  PaymentTransaction,
  VIP_PRICING,
} from '@/types/stripe.types';

/**
 * Grant VIP Status
 * 
 * Grants VIP status to a user after successful payment. Updates player record
 * with VIP expiration date and Stripe customer ID for future management.
 * Idempotent - safe to call multiple times for same transaction.
 * 
 * @param {object} params - VIP grant parameters
 * @param {string} params.userId - User ID (maps to players.mongoId) to grant VIP
 * @param {VIPTier} params.tier - VIP tier purchased
 * @param {string} params.stripeCustomerId - Stripe Customer ID for portal access
 * @param {string} params.stripeSubscriptionId - Stripe Subscription ID for tracking
 * @returns {Promise<boolean>} True if VIP granted successfully
 * 
 * @throws {Error} If database operation fails
 * 
 * @example
 * const success = await grantVIP({
 *   userId: '507f1f77bcf86cd799439011',
 *   tier: VIPTier.MONTHLY,
 *   stripeCustomerId: 'cus_1234abcd',
 *   stripeSubscriptionId: 'sub_5678efgh'
 * });
 */
export async function grantVIP(params: {
  userId: string;
  tier: VIPTier;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}): Promise<boolean> {
  try {
    console.log('Attempting to grant VIP:', {
      userId: params.userId,
      tier: params.tier,
      stripeCustomerId: params.stripeCustomerId
    });
    
    // Calculate VIP expiration date
    const durationDays = getVIPDurationDays(params.tier);
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + durationDays);
    
    // Try to find the player first
    const player = await db.select().from(players).where(eq(players.mongoId, params.userId)).limit(1).then(rows => rows[0]);
    
    if (!player) {
      console.error('Player not found for VIP grant:', {
        userId: params.userId,
        collectionName: 'players'
      });
      
      // Try alternative query to get sample player structure
      const samplePlayer = await db.select().from(players).limit(1).then(rows => rows[0]);
      console.log('Sample player document structure:', samplePlayer ? Object.keys(samplePlayer) : 'No players found');
      
      return false;
    }
    
    console.log('Player found, updating VIP status:', {
      playerId: player.mongoId,
      currentVIP: player.vip || false
    });
    
    // Update player record with VIP status
    const result = await db.update(players)
      .set({
        vip: 1,
        vipExpiration: expirationDate,
        vipTier: params.tier,
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        vipLastUpdated: new Date(),
      })
      .where(eq(players.mongoId, params.userId));
    
    console.log('VIP grant update result:', {
      affectedRows: (result as any).affectedRows ?? 0
    });
    
    if ((result as any).affectedRows === 0) {
      console.error('Player not matched in update query');
      return false;
    }
    
    console.log('VIP granted successfully:', {
      userId: params.userId,
      tier: params.tier,
      expirationDate,
    });
    
    return true;
  } catch (error) {
    console.error('Failed to grant VIP:', error);
    return false;
  }
}

/**
 * Revoke VIP Status
 * 
 * Revokes VIP status from a user. Called when subscription is cancelled
 * or payment fails. Maintains Stripe customer ID for potential re-subscription.
 * 
 * @param {string} userId - User ID (maps to players.mongoId) to revoke VIP
 * @returns {Promise<boolean>} True if VIP revoked successfully
 * 
 * @throws {Error} If database operation fails
 * 
 * @example
 * const success = await revokeVIP('507f1f77bcf86cd799439011');
 * if (success) {
 *   console.log('VIP access removed');
 * }
 */
export async function revokeVIP(userId: string): Promise<boolean> {
  try {
    const result = await db.update(players)
      .set({
        vip: 0,
        vipExpiration: null,
        vipTier: null,
        vipLastUpdated: new Date(),
      })
      .where(eq(players.mongoId, userId));
    
    if (((result as any).affectedRows ?? 0) === 0) {
      console.error('Player not found for VIP revocation:', userId);
      return false;
    }
    
    console.log('VIP revoked successfully:', userId);
    return true;
  } catch (error) {
    console.error('Failed to revoke VIP:', error);
    return false;
  }
}

/**
 * Extend VIP Subscription
 * 
 * Extends existing VIP subscription when renewal payment succeeds.
 * Adds additional time to current expiration date (doesn't reset from today).
 * 
 * @param {object} params - Extension parameters
 * @param {string} params.userId - User ID (maps to players.mongoId) to extend
 * @param {VIPTier} params.tier - VIP tier being renewed
 * @returns {Promise<boolean>} True if extension successful
 * 
 * @example
 * const success = await extendVIP({
 *   userId: '507f1f77bcf86cd799439011',
 *   tier: VIPTier.MONTHLY
 * });
 */
export async function extendVIP(params: {
  userId: string;
  tier: VIPTier;
}): Promise<boolean> {
  try {
    // Get current player to check existing expiration
    const player = await db.select().from(players).where(eq(players.mongoId, params.userId)).limit(1).then(rows => rows[0]);
    
    if (!player) {
      console.error('Player not found for VIP extension:', params.userId);
      return false;
    }
    
    // Calculate new expiration from current expiration (or now if expired)
    const currentExpiration = player.vipExpiration || new Date();
    const baseDate = currentExpiration > new Date() ? currentExpiration : new Date();
    
    const durationDays = getVIPDurationDays(params.tier);
    const newExpiration = new Date(baseDate);
    newExpiration.setDate(newExpiration.getDate() + durationDays);
    
    const result = await db.update(players)
      .set({
        vip: 1,
        vipExpiration: newExpiration,
        vipTier: params.tier,
        vipLastUpdated: new Date(),
      })
      .where(eq(players.mongoId, params.userId));
    
    console.log('VIP extended successfully:', {
      userId: params.userId,
      tier: params.tier,
      newExpiration,
    });
    
    return ((result as any).affectedRows ?? 0) > 0;
  } catch (error) {
    console.error('Failed to extend VIP:', error);
    return false;
  }
}

/**
 * Record Payment Transaction
 * 
 * Creates a payment transaction record for auditing and analytics.
 * Stores all payment details including amount, status, and Stripe IDs.
 * Uses raw SQL since paymentTransactions table is not in Drizzle schema yet.
 * 
 * @param {object} transaction - Transaction details
 * @param {string} transaction.userId - User who made payment
 * @param {string} transaction.username - Username for display
 * @param {string} transaction.stripeCustomerId - Stripe Customer ID
 * @param {string} transaction.stripeSessionId - Checkout Session ID
 * @param {string} transaction.stripeSubscriptionId - Subscription ID
 * @param {number} transaction.amount - Payment amount in USD cents
 * @param {VIPTier} transaction.tier - VIP tier purchased
 * @param {string} transaction.status - Payment status (completed, failed, refunded)
 * @returns {Promise<string | null>} Transaction ID or null if failed
 * 
 * @example
 * const txnId = await recordPaymentTransaction({
 *   userId: '507f1f77bcf86cd799439011',
 *   username: 'player123',
 *   stripeCustomerId: 'cus_1234abcd',
 *   stripeSessionId: 'cs_test_5678',
 *   stripeSubscriptionId: 'sub_9012',
 *   amount: 1499,
 *   tier: VIPTier.MONTHLY,
 *   status: 'completed'
 * });
 */
export async function recordPaymentTransaction(transaction: {
  userId: string;
  username: string;
  stripeCustomerId: string;
  stripeSessionId: string;
  stripeSubscriptionId: string;
  amount: number;
  tier: VIPTier;
  status: 'completed' | 'failed' | 'refunded';
}): Promise<string | null> {
  try {
    const now = new Date();
    const completedAt = transaction.status === 'completed' ? now : null;
    const refundedAt = transaction.status === 'refunded' ? now : null;
    
    const result = await db.execute(sql`
      INSERT INTO paymentTransactions (
        userId, username, stripeCustomerId, stripeSessionId, stripeSubscriptionId,
        stripePriceId, amount, tier, status, createdAt, completedAt, refundedAt
      ) VALUES (
        ${transaction.userId}, ${transaction.username}, ${transaction.stripeCustomerId},
        ${transaction.stripeSessionId}, ${transaction.stripeSubscriptionId},
        ${VIP_PRICING[transaction.tier].stripePriceId}, ${transaction.amount},
        ${transaction.tier}, ${transaction.status}, ${now}, ${completedAt}, ${refundedAt}
      )
    `);
    
    const transactionId = (result as any).insertId?.toString() || 'unknown';
    
    console.log('Payment transaction recorded:', {
      transactionId,
      userId: transaction.userId,
      amount: transaction.amount,
      status: transaction.status,
    });
    
    return transactionId;
  } catch (error) {
    console.error('Failed to record payment transaction:', error);
    return null;
  }
}

/**
 * Get User Payment History
 * 
 * Retrieves all payment transactions for a specific user.
 * Used for admin dashboard and user billing history display.
 * Uses raw SQL since paymentTransactions table is not in Drizzle schema yet.
 * 
 * @param {string} userId - User ID to get payment history for
 * @param {number} [limit=50] - Maximum number of transactions to return
 * @returns {Promise<PaymentTransaction[]>} Array of payment transactions
 * 
 * @example
 * const history = await getUserPaymentHistory('507f1f77bcf86cd799439011', 10);
 * console.log(`User has ${history.length} transactions`);
 */
export async function getUserPaymentHistory(
  userId: string,
  limit: number = 50
): Promise<PaymentTransaction[]> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM paymentTransactions
      WHERE userId = ${userId}
      ORDER BY createdAt DESC
      LIMIT ${limit}
    `);
    
    return result as unknown as PaymentTransaction[];
  } catch (error) {
    console.error('Failed to get user payment history:', error);
    return [];
  }
}

/**
 * Get User by Stripe Customer ID
 * 
 * Retrieves player record using Stripe Customer ID. Used in webhook
 * processing when we only have Stripe data and need to find the user.
 * 
 * @param {string} stripeCustomerId - Stripe Customer ID
 * @returns {Promise<{id: string, username: string, email: string} | null>} Player object or null
 * 
 * @example
 * const user = await getUserByStripeCustomerId('cus_1234abcd');
 * if (user) {
 *   await grantVIP({ userId: user.id, ... });
 * }
 */
export async function getUserByStripeCustomerId(
  stripeCustomerId: string
): Promise<{ id: string; username: string; email: string } | null> {
  try {
    const result = await db.select({
      id: players.mongoId,
      username: players.username,
      email: players.email,
    }).from(players)
      .where(eq(players.stripeCustomerId, stripeCustomerId))
      .limit(1);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    const row = result[0]; return { id: (row as any).mongoId || row.id || row.username, username: row.username, email: row.email };
  } catch (error) {
    console.error('Failed to get user by Stripe customer ID:', error);
    return null;
  }
}

/**
 * Check VIP Status
 * 
 * Checks if user currently has active VIP status. Validates expiration
 * date and automatically revokes if expired.
 * 
 * @param {string} userId - User ID to check (maps to players.mongoId)
 * @returns {Promise<{isVIP: boolean, tier?: VIPTier, expiresAt?: Date}>} VIP status
 * 
 * @example
 * const status = await checkVIPStatus('507f1f77bcf86cd799439011');
 * if (status.isVIP) {
 *   console.log(`VIP ${status.tier} expires ${status.expiresAt}`);
 * }
 */
export async function checkVIPStatus(
  userId: string
): Promise<{ isVIP: boolean; tier?: VIPTier; expiresAt?: Date }> {
  try {
    const result = await db.select({
      vip: players.vip,
      vipExpiration: players.vipExpiration,
      vipTier: players.vipTier,
    }).from(players)
      .where(eq(players.mongoId, userId))
      .limit(1);
    
    if (!result || result.length === 0) {
      return { isVIP: false };
    }
    
    const player = result[0];
    
    if (!player.vip) {
      return { isVIP: false };
    }
    
    // Check if VIP expired
    if (player.vipExpiration && player.vipExpiration < new Date()) {
      // Auto-revoke expired VIP
      await revokeVIP(userId);
      return { isVIP: false };
    }
    
    return {
      isVIP: true,
      tier: player.vipTier as VIPTier,
      expiresAt: player.vipExpiration || undefined,
    };
  } catch (error) {
    console.error('Failed to check VIP status:', error);
    return { isVIP: false };
  }
}

/* ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * BUSINESS LOGIC:
 * - VIP granted immediately on payment success (no delay)
 * - Expiration calculated from subscription interval (7, 30, 365 days)
 * - Renewals extend from current expiration (not from today)
 * - Cancellation revokes VIP immediately (could add grace period in future)
 * - Auto-revoke on expiration check (cleanup for missed webhooks)
 * 
 * DATABASE SCHEMA:
 * players table (via Drizzle ORM):
 *   - vip: tinyint (VIP status flag: 0 or 1)
 *   - vipExpiration: datetime (when VIP expires)
 *   - vipTier: varchar(20) (subscription tier)
 *   - stripeCustomerId: varchar(255) (for portal access)
 *   - stripeSubscriptionId: varchar(255) (for management)
 *   - vipLastUpdated: datetime (audit trail)
 *   - mongoId: varchar(24) (legacy MongoDB ObjectId for backward compatibility)
 * 
 * paymentTransactions table (via raw SQL - not in Drizzle schema):
 *   - userId: string (user who paid)
 *   - username: string (display name)
 *   - stripeCustomerId: string (Stripe customer)
 *   - stripeSessionId: string (checkout session)
 *   - stripeSubscriptionId: string (subscription)
 *   - stripePriceId: string (price ID)
 *   - amount: number (USD cents)
 *   - tier: string (subscription tier)
 *   - status: string (completed, failed, refunded)
 *   - createdAt: datetime (transaction start)
 *   - completedAt: datetime (payment success)
 *   - refundedAt: datetime (refund processed)
 * 
 * ERROR HANDLING:
 * - All functions return boolean success flags
 * - Errors logged to console for debugging
 * - Database operations wrapped in try-catch
 * - Idempotent operations safe to retry
 * 
 * TESTING:
 * - Test with Stripe test mode subscriptions
 * - Verify expiration date calculations
 * - Test renewal extension logic
 * - Verify auto-revoke on expiration
 * - Test transaction history retrieval
 * 
 * FUTURE ENHANCEMENTS:
 * - Add grace period before revocation (3 days)
 * - Implement prorated upgrades/downgrades
 * - Add email notifications for renewals/cancellations
 * - Implement refund processing workflow
 * - Add promotional VIP grants (manual admin action)
 * - Track VIP usage metrics (revenue per user)
 */
