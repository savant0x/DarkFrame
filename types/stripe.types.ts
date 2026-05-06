/**
 * Stripe Payment System Type Definitions
 * 
 * OVERVIEW:
 * Comprehensive type system for Stripe payment processing integration.
 * Handles VIP subscription management, checkout flows, webhook events,
 * transaction tracking, and admin analytics. Ensures type safety across
 * the entire payment lifecycle from checkout to renewal to cancellation.
 * 
 * KEY FEATURES:
 * - Three VIP subscription tiers (Weekly, Monthly, Yearly)
 * - Stripe checkout session management
 * - Webhook event processing (checkout, subscription updates, cancellations)
 * - Transaction history tracking for audit trails
 * - Admin dashboard analytics types
 * - Customer portal integration
 * 
 * BUSINESS LOGIC:
 * - Weekly: $4.99 (7 days VIP)
 * - Monthly: $14.99 (30 days VIP, 20% savings)
 * - Yearly: $99.99 (365 days VIP, 44% savings)
 * 
 * SECURITY:
 * - All prices stored in USD cents (avoids floating point issues)
 * - Stripe Price IDs from environment variables (production safety)
 * - Transaction status tracking for refund management
 * 
 * DEPENDENCIES:
 * - stripe (Stripe SDK for server-side)
 * - Environment variables for Stripe Price IDs
 * 
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE
 * Author: ECHO v5.1
 */

import Stripe from 'stripe';

/**
 * VIP Subscription Tiers
 * 
 * Defines the five subscription tiers available for VIP membership.
 * Each tier corresponds to a specific duration and pricing model with volume discounts.
 * 
 * @enum {string}
 * 
 * @property {string} WEEKLY - 7-day VIP subscription ($9.99)
 * @property {string} MONTHLY - 30-day VIP subscription ($24.99, 17% savings)
 * @property {string} QUARTERLY - 90-day VIP subscription ($64.99, 22% savings)
 * @property {string} BIANNUAL - 180-day VIP subscription ($119.99, 28% savings)
 * @property {string} YEARLY - 365-day VIP subscription ($199.99, 33% savings)
 * 
 * @example
 * const tier = VIPTier.QUARTERLY;
 * const pricing = VIP_PRICING[tier]; // { price: 6499, interval: '3 months', ... }
 */
export enum VIPTier {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  BIANNUAL = 'BIANNUAL',
  YEARLY = 'YEARLY',
}

/**
 * VIP Tier Pricing Configuration
 * 
 * Complete pricing details for a VIP subscription tier including
 * Stripe integration details, display information, duration, and marketing copy.
 * Used throughout the application for consistent pricing display and Stripe checkout.
 * 
 * @interface VIPPricing
 * 
 * @property {VIPTier} tier - The VIP tier this configuration represents
 * @property {string} displayName - Human-readable tier name for UI display (e.g., "Monthly VIP")
 * @property {string} description - Detailed marketing description highlighting benefits and value
 * @property {number} price - Price in USD cents (e.g., 2499 = $24.99) - cents format prevents floating point errors
 * @property {'week' | 'month' | 'year'} interval - Stripe billing interval for recurring subscriptions
 * @property {number} durationDays - Duration of VIP access in days (7, 30, or 365)
 * @property {string} stripePriceId - Stripe Price ID from dashboard (loaded from env vars for security)
 * @property {string} [savings] - Optional savings text with emoji for visual appeal (e.g., "Save 17% 🔥")
 * @property {string[]} features - Array of key features/benefits to display in pricing cards
 * 
 * @example
 * const monthlyPricing: VIPPricing = {
 *   tier: VIPTier.MONTHLY,
 *   displayName: 'Monthly VIP',
 *   description: 'Perfect for dedicated players...',
 *   price: 2499,
 *   interval: 'month',
 *   durationDays: 30,
 *   stripePriceId: 'price_1234abcd',
 *   savings: 'Save 17% 🔥',
 *   features: ['Auto-farming', '2x Resources', ...]
 * };
 */
export interface VIPPricing {
  tier: VIPTier;
  displayName: string;
  description: string;
  price: number;
  interval: 'week' | 'month' | 'year';
  durationDays: number;
  stripePriceId: string;
  savings?: string;
  features: string[];
}

/**
 * Create Checkout Session Request
 * 
 * Request payload for creating a Stripe checkout session. Includes
 * VIP tier selection and optional custom redirect URLs.
 * 
 * @interface CreateCheckoutSessionRequest
 * 
 * @property {VIPTier} tier - Which VIP tier the user wants to purchase
 * @property {string} [successUrl] - Optional custom success redirect URL
 * @property {string} [cancelUrl] - Optional custom cancel redirect URL
 * 
 * @example
 * const request: CreateCheckoutSessionRequest = {
 *   tier: VIPTier.MONTHLY,
 *   successUrl: '/game/vip-upgrade/success',
 *   cancelUrl: '/game/vip-upgrade/cancel'
 * };
 */
export interface CreateCheckoutSessionRequest {
  tier: VIPTier;
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * Create Checkout Session Response
 * 
 * Response from checkout session creation endpoint. Includes session ID
 * and redirect URL for client-side checkout flow.
 * 
 * @interface CreateCheckoutSessionResponse
 * 
 * @property {boolean} success - Whether session creation succeeded
 * @property {string} [sessionId] - Stripe Checkout Session ID (if success)
 * @property {string} [url] - Redirect URL for Stripe Checkout (if success)
 * @property {string} [message] - Error message (if failure)
 * 
 * @example
 * const response: CreateCheckoutSessionResponse = {
 *   success: true,
 *   sessionId: 'cs_test_1234abcd',
 *   url: 'https://checkout.stripe.com/c/pay/cs_test_1234abcd'
 * };
 */
export interface CreateCheckoutSessionResponse {
  success: boolean;
  sessionId?: string;
  url?: string;
  message?: string;
}

/**
 * Stripe Webhook Event Types
 * 
 * Enum of Stripe webhook events we handle for subscription lifecycle
 * management. These events trigger automated VIP grant/revoke actions.
 * 
 * @enum {string}
 * 
 * @property {string} CHECKOUT_COMPLETED - Payment successful, grant VIP
 * @property {string} SUBSCRIPTION_UPDATED - Renewal or change, update VIP expiration
 * @property {string} SUBSCRIPTION_DELETED - Cancellation, revoke VIP at period end
 * @property {string} PAYMENT_FAILED - Payment failed, alert admin/user
 * 
 * @example
 * if (event.type === StripeWebhookEvent.CHECKOUT_COMPLETED) {
 *   await grantVIPFromCheckout(session);
 * }
 */
export enum StripeWebhookEvent {
  CHECKOUT_COMPLETED = 'checkout.session.completed',
  SUBSCRIPTION_UPDATED = 'customer.subscription.updated',
  SUBSCRIPTION_DELETED = 'customer.subscription.deleted',
  PAYMENT_FAILED = 'invoice.payment_failed',
}

/**
 * Payment Transaction Record
 * 
 * Database record for payment transaction tracking. Stores complete
 * transaction history for audit trails, refunds, and analytics.
 * 
 * @interface PaymentTransaction
 * 
 * @property {string} [_id] - MongoDB document ID
 * @property {string} userId - User ID who made the purchase
 * @property {string} username - Username for quick reference
 * @property {string} stripeCustomerId - Stripe Customer ID for this user
 * @property {string} [stripeSessionId] - Stripe Checkout Session ID
 * @property {string} [stripeSubscriptionId] - Stripe Subscription ID (recurring)
 * @property {string} stripePriceId - Stripe Price ID purchased
 * @property {VIPTier} tier - VIP tier purchased
 * @property {number} amount - Transaction amount in USD cents
 * @property {'pending' | 'completed' | 'failed' | 'refunded'} status - Transaction status
 * @property {Date} createdAt - When transaction initiated
 * @property {Date} [completedAt] - When payment completed
 * @property {Date} [refundedAt] - When refund processed (if applicable)
 * @property {Record<string, unknown>} [metadata] - Additional transaction metadata
 * 
 * @example
 * const transaction: PaymentTransaction = {
 *   userId: '507f1f77bcf86cd799439011',
 *   username: 'player123',
 *   stripeCustomerId: 'cus_1234abcd',
 *   stripeSessionId: 'cs_test_1234',
 *   stripePriceId: 'price_monthly',
 *   tier: VIPTier.MONTHLY,
 *   amount: 1499,
 *   status: 'completed',
 *   createdAt: new Date(),
 *   completedAt: new Date()
 * };
 */
export interface PaymentTransaction {
  _id?: string;
  userId: string;
  username: string;
  stripeCustomerId: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  stripePriceId: string;
  tier: VIPTier;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  completedAt?: Date;
  refundedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Subscription Status
 * 
 * Current subscription status for a user, used in admin dashboard
 * for subscription management and analytics.
 * 
 * @interface SubscriptionStatus
 * 
 * @property {string} userId - User ID of subscriber
 * @property {string} username - Username for display
 * @property {VIPTier} tier - Current VIP tier
 * @property {string} stripeSubscriptionId - Stripe Subscription ID
 * @property {'active' | 'canceled' | 'past_due' | 'unpaid'} status - Subscription status
 * @property {Date} currentPeriodStart - Current billing period start
 * @property {Date} currentPeriodEnd - Current billing period end (VIP expires)
 * @property {boolean} cancelAtPeriodEnd - Whether sub cancels at period end
 * @property {number} totalRevenue - Total revenue from this user (USD cents)
 * 
 * @example
 * const subStatus: SubscriptionStatus = {
 *   userId: '507f1f77bcf86cd799439011',
 *   username: 'player123',
 *   tier: VIPTier.MONTHLY,
 *   stripeSubscriptionId: 'sub_1234abcd',
 *   status: 'active',
 *   currentPeriodStart: new Date('2025-10-01'),
 *   currentPeriodEnd: new Date('2025-11-01'),
 *   cancelAtPeriodEnd: false,
 *   totalRevenue: 2998 // Two months paid
 * };
 */
export interface SubscriptionStatus {
  userId: string;
  username: string;
  tier: VIPTier;
  stripeSubscriptionId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  totalRevenue: number;
}

/**
 * Payment Statistics
 * 
 * Aggregated payment analytics for admin dashboard. Provides high-level
 * metrics for business intelligence and revenue tracking.
 * 
 * @interface PaymentStats
 * 
 * @property {number} totalRevenue - All-time revenue in USD cents
 * @property {number} monthlyRevenue - Current month revenue in USD cents
 * @property {number} activeSubscriptions - Number of active VIP subscriptions
 * @property {number} totalTransactions - Total payment transactions processed
 * @property {number} conversionRate - Checkout to payment conversion (0-100)
 * @property {number} churnRate - Monthly subscription cancellation rate (0-100)
 * @property {number} averageRevenuePerUser - ARPU in USD cents
 * 
 * @example
 * const stats: PaymentStats = {
 *   totalRevenue: 49950, // $499.50 total
 *   monthlyRevenue: 14990, // $149.90 this month
 *   activeSubscriptions: 15,
 *   totalTransactions: 42,
 *   conversionRate: 85.5,
 *   churnRate: 5.2,
 *   averageRevenuePerUser: 3330 // $33.30 ARPU
 * };
 */
export interface PaymentStats {
  totalRevenue: number;
  monthlyRevenue: number;
  activeSubscriptions: number;
  totalTransactions: number;
  conversionRate: number;
  churnRate: number;
  averageRevenuePerUser: number;
}

/**
 * Customer Portal Session Response
 * 
 * Response from customer portal session creation. Provides URL for
 * self-service subscription management (cancel, update payment, etc).
 * 
 * @interface CustomerPortalResponse
 * 
 * @property {boolean} success - Whether portal session creation succeeded
 * @property {string} [url] - Customer portal URL (if success)
 * @property {string} [message] - Error message (if failure)
 * 
 * @example
 * const portalResponse: CustomerPortalResponse = {
 *   success: true,
 *   url: 'https://billing.stripe.com/session/test_1234abcd'
 * };
 */
export interface CustomerPortalResponse {
  success: boolean;
  url?: string;
  message?: string;
}

/**
 * VIP Pricing Configuration (Constant)
 * 
 * Complete pricing configuration for all VIP tiers. Prices are stored
 * in USD cents to avoid floating point arithmetic issues. Stripe Price IDs
 * are loaded from environment variables for production safety.
 * 
 * PRICING BREAKDOWN (Premium Strategy):
 * - Weekly: $9.99 (7 days) = $1.43/day (commitment test tier)
 * - Monthly: $24.99 (30 days) = $0.83/day (BEST VALUE - 17% savings vs weekly)
 * - Yearly: $199.99 (365 days) = $0.55/day (BEST DEAL - 33% savings vs monthly)
 * 
 * BUSINESS RATIONALE:
 * - Premium positioning reflects game quality and sophistication
 * - Sustainable pricing supports server costs (MongoDB, Redis, Ably)
 * - Higher perceived value attracts serious, engaged players
 * - Room for promotional discounts and free VIP giveaways
 * - Easier to discount later than raise prices
 * 
 * @constant
 * @type {Record<VIPTier, VIPPricing>}
 * 
 * @example
 * const monthlyPrice = VIP_PRICING[VIPTier.MONTHLY].price; // 2499 cents ($24.99)
 * const displayName = VIP_PRICING[VIPTier.YEARLY].displayName; // "Yearly VIP"
 */
export const VIP_PRICING: Record<VIPTier, VIPPricing> = {
  [VIPTier.WEEKLY]: {
    tier: VIPTier.WEEKLY,
    displayName: 'Weekly VIP',
    description: 'Perfect for testing the waters! Experience all premium features for 7 days. Ideal for casual players who want to try VIP benefits before committing to a longer subscription. Cancel anytime with no strings attached.',
    price: 999, // $9.99
    interval: 'week',
    durationDays: 7,
    stripePriceId: process.env.STRIPE_PRICE_ID_WEEKLY || 'price_weekly',
    features: [
      'Automated Resource Farming - Set it and forget it',
      '2x Resource Multiplier - Double your efficiency',
      'Advanced Battle Analytics - Detailed combat insights',
      'Priority Factory Slots - 5 simultaneous productions',
      'Exclusive VIP Shop Access - Premium items only',
      'Unique VIP Badge - Show off your status',
      'Real-time Battle Notifications - Never miss action',
      'Faster Research Speed - 25% time reduction',
    ],
  },
  [VIPTier.MONTHLY]: {
    tier: VIPTier.MONTHLY,
    displayName: 'Monthly VIP',
    description: 'Popular choice for serious commanders. Get all premium features for 30 days at a great price. Perfect for dedicated players who want to dominate the battlefield and maximize their strategic advantage. Save 17% compared to weekly subscriptions.',
    price: 2499, // $24.99
    interval: 'month',
    durationDays: 30,
    stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY || 'price_monthly',
    savings: 'Save 17%',
    features: [
      'Automated Resource Farming - 24/7 passive income',
      '2x Resource Multiplier - Maximum efficiency gains',
      'Advanced Battle Analytics - Complete tactical breakdown',
      'Priority Factory Slots - 5 simultaneous productions',
      'Exclusive VIP Shop Access - Rare legendary items',
      'Unique VIP Badge and Title - Stand out from the crowd',
      'Real-time Battle Notifications - Instant alerts',
      'Faster Research Speed - 25% faster progress',
      'Monthly Bonus Rewards - Special care packages',
      'Priority Matchmaking - Better opponent selection',
      'Enhanced Statistics Dashboard - Track everything',
      'Priority Support - Get help faster',
    ],
  },
  [VIPTier.QUARTERLY]: {
    tier: VIPTier.QUARTERLY,
    displayName: '3-Month VIP',
    description: 'BEST VALUE! Three months of premium features at $64.99. Perfect balance of commitment and savings. Includes all VIP benefits with 22% savings compared to monthly. Ideal for competitive players who want sustained advantage without annual commitment. Most popular choice!',
    price: 6499, // $64.99
    interval: 'month',
    durationDays: 90,
    stripePriceId: process.env.STRIPE_PRICE_ID_QUARTERLY || 'price_quarterly',
    savings: 'Save 22%',
    features: [
      'Automated Resource Farming - 3 months passive income',
      '2x Resource Multiplier - Sustained growth acceleration',
      'Advanced Battle Analytics - Master tactical insights',
      'Priority Factory Slots - 5 simultaneous productions',
      'Exclusive VIP Shop Access - Extended rare item access',
      'Unique VIP Badge and Title - Elite status display',
      'Real-time Battle Notifications - Never miss anything',
      'Faster Research Speed - 25% faster progress',
      'Monthly Bonus Rewards - 3 months of special packages',
      'Priority Matchmaking - Consistent quality opponents',
      'Enhanced Statistics Dashboard - Complete analytics',
      'Priority Support - Premium assistance guaranteed',
      'Quarterly Bonus Pack - Exclusive 3-month rewards',
    ],
  },
  [VIPTier.BIANNUAL]: {
    tier: VIPTier.BIANNUAL,
    displayName: '6-Month VIP',
    description: 'Superior value at $119.99 for 6 months. Serious commitment for serious players with 28% savings. All premium features for half a year including exclusive biannual cosmetics and seasonal rewards. Perfect for dedicated commanders planning long-term strategy.',
    price: 11999, // $119.99
    interval: 'month',
    durationDays: 180,
    stripePriceId: process.env.STRIPE_PRICE_ID_BIANNUAL || 'price_biannual',
    savings: 'Save 28%',
    features: [
      'Automated Resource Farming - 6 months passive income',
      '2x Resource Multiplier - Long-term dominance growth',
      'Advanced Battle Analytics - Expert-level insights',
      'Priority Factory Slots - 5 simultaneous productions',
      'Exclusive VIP Shop Access - Premium rare selections',
      'Unique VIP Badge and Title - Distinguished status',
      'Real-time Battle Notifications - Constant awareness',
      'Faster Research Speed - 25% faster progress',
      'Monthly Bonus Rewards - 6 months of packages',
      'Priority Matchmaking - Elite opponent pools',
      'Enhanced Statistics Dashboard - Full analytics suite',
      'Priority Support - Dedicated VIP assistance',
      'Biannual Exclusive Cosmetics - Special 6-month items',
      'Seasonal Rewards - Two full seasons of bonuses',
    ],
  },
  [VIPTier.YEARLY]: {
    tier: VIPTier.YEARLY,
    displayName: 'Yearly VIP',
    description: 'ULTIMATE COMMITMENT! For the most dedicated DarkFrame commanders. Lock in 365 days of premium features at an incredible 33% discount. Perfect for competitive players serious about long-term domination. Best value, biggest savings, ultimate bragging rights!',
    price: 19999, // $199.99
    interval: 'year',
    durationDays: 365,
    stripePriceId: process.env.STRIPE_PRICE_ID_YEARLY || 'price_yearly',
    savings: 'Save 33%',
    features: [
      'Automated Resource Farming - Full year of passive income',
      '2x Resource Multiplier - Unstoppable growth',
      'Advanced Battle Analytics - Master-level insights',
      'Priority Factory Slots - 5 simultaneous productions',
      'Exclusive VIP Shop Access - Ultra-rare exclusives',
      'Unique VIP Badge and Title - Legendary status symbol',
      'Real-time Battle Notifications - Always in the know',
      'Faster Research Speed - 25% acceleration',
      'Monthly Bonus Rewards - 12 months of gifts',
      'Priority Matchmaking - Elite opponent pool',
      'Enhanced Statistics Dashboard - Complete analytics',
      'Priority Support - VIP treatment guaranteed',
      'Exclusive Yearly Cosmetics - Limited edition items',
      'Early Access to New Features - Be first to try',
      'Special Anniversary Rewards - Celebrate with bonuses',
    ],
  },
};

/**
 * Get VIP Duration Days
 * 
 * Returns the duration in days for a given VIP tier. Used for calculating
 * VIP expiration dates when granting or renewing subscriptions.
 * 
 * @param {VIPTier} tier - The VIP tier to get duration for
 * @returns {number} Duration in days (7, 30, or 365)
 * 
 * @example
 * const days = getVIPDurationDays(VIPTier.MONTHLY); // 30
 * const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
 */
export function getVIPDurationDays(tier: VIPTier): number {
  return VIP_PRICING[tier].durationDays;
}

/**
 * Get VIP Price
 * 
 * Returns the price in USD cents for a given VIP tier.
 * 
 * @param {VIPTier} tier - The VIP tier to get price for
 * @returns {number} Price in USD cents (499, 1499, or 9999)
 * 
 * @example
 * const price = getVIPPrice(VIPTier.MONTHLY); // 1499
 * console.log(`Price: $${price / 100}`); // "Price: $14.99"
 */
export function getVIPPrice(tier: VIPTier): number {
  return VIP_PRICING[tier].price;
}

/**
 * Format Price for Display
 * 
 * Converts price from USD cents to formatted dollar string with
 * currency symbol and two decimal places.
 * 
 * @param {number} cents - Price in USD cents
 * @returns {string} Formatted price string (e.g., "$14.99")
 * 
 * @example
 * formatPrice(1499); // "$14.99"
 * formatPrice(9999); // "$99.99"
 * formatPrice(0);    // "$0.00"
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Validate VIP Tier (Type Guard)
 * 
 * Type guard function to check if a string value is a valid VIP tier.
 * Provides type narrowing for TypeScript.
 * 
 * @param {string} tier - String value to check
 * @returns {tier is VIPTier} True if valid VIP tier, false otherwise
 * 
 * @example
 * const userInput = "MONTHLY";
 * if (isValidVIPTier(userInput)) {
 *   // userInput is now typed as VIPTier
 *   const price = getVIPPrice(userInput);
 * }
 */
export function isValidVIPTier(tier: string): tier is VIPTier {
  return Object.values(VIPTier).includes(tier as VIPTier);
}

/**
 * Stripe Webhook Event Payload
 * 
 * Typed structure for Stripe webhook events we receive. Provides type safety
 * for webhook handler implementation.
 * 
 * @interface StripeWebhookPayload
 * 
 * @property {string} id - Unique event ID
 * @property {StripeWebhookEvent} type - Event type (checkout, subscription, etc)
 * @property {object} data - Event data object
 * @property {Stripe.Checkout.Session | Stripe.Subscription} data.object - Event payload
 * 
 * @example
 * const payload: StripeWebhookPayload = {
 *   id: 'evt_1234abcd',
 *   type: StripeWebhookEvent.CHECKOUT_COMPLETED,
 *   data: {
 *     object: session // Stripe.Checkout.Session
 *   }
 * };
 */
export interface StripeWebhookPayload {
  id: string;
  type: StripeWebhookEvent;
  data: {
    object: Stripe.Checkout.Session | Stripe.Subscription;
  };
}

/* ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * 1. All prices stored in USD cents (integer arithmetic, no rounding errors)
 * 2. Stripe Price IDs loaded from environment variables for security
 * 3. Duration days used for VIP expiration calculation (addDays utility)
 * 4. Type guards provide runtime validation with compile-time type narrowing
 * 5. Helper functions centralize pricing logic for consistency
 * 6. Webhook payload typed for safe event processing
 * 
 * FUTURE ENHANCEMENTS:
 * - Support for promotional pricing (discounts, coupons)
 * - Multiple currency support (EUR, GBP, etc)
 * - Trial period configuration
 * - Lifetime VIP tier option
 */
