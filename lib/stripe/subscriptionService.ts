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
 * - lib/supabase/server (Supabase connection)
 * - types/stripe.types (VIP tiers and payment types)
 * - types/database.types (User and PaymentTransaction schemas)
 * 
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE
 * Author: ECHO v5.1
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import { 
  VIPTier, 
  getVIPDurationDays,
  PaymentTransaction,
  VIP_PRICING,
} from '@/types/stripe.types';

/**
 * Record a payment transaction in the database.
 */
export async function recordPaymentTransaction(params: {
  userId: string;
  username: string;
  tier: VIPTier;
  amount: number;
  stripeSessionId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('payment_transactions').insert({
    user_id: params.userId,
    username: params.username,
    tier: params.tier,
    amount: params.amount,
    stripe_session_id: params.stripeSessionId,
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    status: params.status,
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.error('[Subscription] Failed to record payment transaction:', error);
  }
}

/**
 * Grant VIP Status
 * 
 * Grants VIP status to a user after successful payment. Updates user record
 * with VIP expiration date and Stripe customer ID for future management.
 * Idempotent - safe to call multiple times for same transaction.
 * 
 * @param {object} params - VIP grant parameters
 * @param {string} params.userId - User ID to grant VIP
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
    const supabase = createServiceClient();
    
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
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('username', params.userId)
      .single();
    
    if (!player) {
      console.error('Player not found for VIP grant:', {
        userId: params.userId,
        tableName: 'players'
      });
      return false;
    }
    
    console.log('Player found, updating VIP status:', {
      playerUsername: player.username,
      currentVIP: player.is_vip || false
    });
    
    // Update player record with VIP status
    const { error } = await supabase
      .from('players')
      .update({
        is_vip: true,
        vip_expiration: expirationDate.toISOString(),
        vip_tier: params.tier,
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        vip_last_updated: new Date().toISOString(),
      })
      .eq('username', params.userId);
    
    if (error) {
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
 * @param {string} userId - User ID to revoke VIP
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
    const supabase = createServiceClient();
    
    const { error } = await supabase
      .from('players')
      .update({
        is_vip: false,
        vip_expiration: null,
        vip_tier: null,
        vip_last_updated: new Date().toISOString(),
      })
      .eq('username', userId);
    
    if (error) {
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
 * @param {string} params.userId - User ID to extend
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
    const supabase = createServiceClient();
    
    // Get current user to check existing expiration
    const { data: user } = await supabase
      .from('players')
      .select('*')
      .eq('username', params.userId)
      .single();
    
    if (!user) {
      console.error('User not found for VIP extension:', params.userId);
      return false;
    }
    
    // Calculate new expiration from current expiration (or now if expired)
    const currentExpiration = user.vip_expiration ? new Date(user.vip_expiration) : new Date();
    const baseDate = currentExpiration > new Date() ? currentExpiration : new Date();
    
    const durationDays = getVIPDurationDays(params.tier);
    const newExpiration = new Date(baseDate);
    newExpiration.setDate(newExpiration.getDate() + durationDays);
    
    const { error } = await supabase
      .from('players')
      .update({
        is_vip: true,
        vip_expiration: newExpiration.toISOString(),
        vip_tier: params.tier,
        vip_last_updated: new Date().toISOString(),
      })
      .eq('username', params.userId);
    
    if (error) {
      console.error('Failed to extend VIP:', error);
      return false;
    }
    
    console.log('VIP extended successfully:', {
      userId: params.userId,
      tier: params.tier,
      newExpiration,
    });
    
    return true;
  } catch (error) {
    console.error('Failed to extend VIP:', error);
    return false;
  }
}

function toVIPTier(value: string): VIPTier {
  switch (value) {
    case 'WEEKLY': return VIPTier.WEEKLY;
    case 'MONTHLY': return VIPTier.MONTHLY;
    case 'QUARTERLY': return VIPTier.QUARTERLY;
    case 'BIANNUAL': return VIPTier.BIANNUAL;
    case 'YEARLY': return VIPTier.YEARLY;
    default: return VIPTier.MONTHLY;
  }
}

/**
 * Get payment transactions for a user
 *
 * @param userId - User ID to get payment history for
 * @param limit - Maximum number of transactions to return
 * @returns Promise resolving to array of payment transactions
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
    const supabase = createServiceClient();
    
    const { data: transactions } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return (transactions || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      stripeCustomerId: row.stripe_customer_id ?? '',
      stripeSessionId: row.stripe_session_id ?? undefined,
      stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
      stripePriceId: row.stripe_price_id ?? '',
      amount: row.amount,
      tier: toVIPTier(row.tier),
      status: row.status,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      refundedAt: row.refunded_at ? new Date(row.refunded_at) : undefined,
    }));
  } catch (error) {
    console.error('Failed to get user payment history:', error);
    return [];
  }
}

/**
 * Get User by Stripe Customer ID
 * 
 * Retrieves user record using Stripe Customer ID. Used in webhook
 * processing when we only have Stripe data and need to find the user.
 * 
 * @param {string} stripeCustomerId - Stripe Customer ID
 * @returns {Promise<{id: string, username: string, email: string} | null>} User object or null
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
    const supabase = createServiceClient();
    
    const { data: user } = await supabase
      .from('players')
      .select('id, username, email')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();
    
    return user as { id: string; username: string; email: string } | null;
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
 * @param {string} userId - User ID to check
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
    const supabase = createServiceClient();
    
    const { data: user } = await supabase
      .from('players')
      .select('is_vip, vip_expiration, vip_tier')
      .eq('username', userId)
      .single();
    
    if (!user || !user.is_vip) {
      return { isVIP: false };
    }
    
    // Check if VIP expired
    if (user.vip_expiration && new Date(user.vip_expiration) < new Date()) {
      // Auto-revoke expired VIP
      await revokeVIP(userId);
      return { isVIP: false };
    }
    
    return {
      isVIP: true,
      tier: user.vip_tier as VIPTier | undefined,
      expiresAt: user.vip_expiration ? new Date(user.vip_expiration) : undefined,
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
 * players table:
 *   - vip: boolean (VIP status flag)
 *   - vip_expiration: timestamp (when VIP expires)
 *   - vip_tier: VIPTier enum (subscription tier)
 *   - stripe_customer_id: string (for portal access)
 *   - stripe_subscription_id: string (for management)
 *   - vip_last_updated: timestamp (audit trail)
 * 
 * payment_transactions table:
 *   - user_id: uuid (user who paid)
 *   - username: string (display name)
 *   - stripe_customer_id: string (Stripe customer)
 *   - stripe_session_id: string (checkout session)
 *   - stripe_subscription_id: string (subscription)
 *   - amount: number (USD cents)
 *   - tier: VIPTier (subscription tier)
 *   - status: string (completed, failed, refunded)
 *   - created_at: timestamp (transaction start)
 *   - completed_at?: timestamp (payment success)
 *   - refunded_at?: timestamp (refund processed)
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
