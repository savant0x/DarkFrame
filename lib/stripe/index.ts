/**
 * Stripe Services - Barrel Export
 * 
 * OVERVIEW:
 * Centralized export point for all Stripe-related services. Provides clean
 * import paths and consolidates payment processing, subscription management,
 * and VIP lifecycle operations.
 * 
 * USAGE:
 * ```typescript
 * import { 
 *   createCheckoutSession, 
 *   grantVIP, 
 *   verifyWebhookSignature 
 * } from '@/lib/stripe';
 * ```
 * 
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE
 * Author: ECHO v5.1
 */

// Stripe client and payment processing
export {
  getStripe,
  createCheckoutSession,
  createCustomerPortalSession,
  verifyWebhookSignature,
  getSubscription,
  cancelSubscription,
  createOrRetrieveCustomer,
} from './stripeService';

// VIP lifecycle and subscription management
export {
  grantVIP,
  revokeVIP,
  extendVIP,
  recordPaymentTransaction,
  getUserPaymentHistory,
  getUserByStripeCustomerId,
  checkVIPStatus,
} from './subscriptionService';

/* ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * This barrel export simplifies imports throughout the codebase. Instead of:
 *   import { grantVIP } from '@/lib/stripe/subscriptionService';
 *   import { createCheckoutSession } from '@/lib/stripe/stripeService';
 * 
 * Use:
 *   import { grantVIP, createCheckoutSession } from '@/lib/stripe';
 * 
 * All exports are re-exported from their respective service files.
 */
