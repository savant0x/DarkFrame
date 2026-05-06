/**
 * Stripe Service - Core Payment Processing
 * 
 * OVERVIEW:
 * Core Stripe integration service handling payment processing, checkout sessions,
 * and subscription management. Provides server-side Stripe SDK integration with
 * comprehensive error handling and type safety.
 * 
 * KEY RESPONSIBILITIES:
 * - Initialize Stripe client with API keys
 * - Create checkout sessions for VIP subscriptions
 * - Manage customer records in Stripe
 * - Handle subscription lifecycle (create, update, cancel)
 * - Create customer portal sessions for self-service management
 * - Validate webhook signatures for security
 * 
 * SECURITY:
 * - Uses server-side Stripe SDK only (never expose secret key to client)
 * - Webhook signature verification prevents unauthorized requests
 * - All API calls wrapped in try-catch with structured error handling
 * - Customer metadata includes userId for audit trails
 * 
 * DEPENDENCIES:
 * - stripe (Stripe Node.js SDK)
 * - Environment variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * 
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE
 * Author: ECHO v5.1
 */

import Stripe from 'stripe';
import { 
  VIPTier, 
  VIP_PRICING, 
  CreateCheckoutSessionResponse,
  CustomerPortalResponse,
} from '@/types/stripe.types';

/**
 * Stripe Client Instance
 * 
 * Singleton Stripe client initialized with secret API key from environment.
 * Uses latest API version for compatibility with newest features.
 * 
 * @throws {Error} If STRIPE_SECRET_KEY environment variable not set
 */
const getStripeClient = (): Stripe => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not configured');
  }
  
  return new Stripe(secretKey, {
    apiVersion: '2025-09-30.clover', // Latest stable API version
    typescript: true,
  });
};

// Lazy-load Stripe client (only initialize when needed)
let stripeClient: Stripe | null = null;

/**
 * Get Stripe Client
 * 
 * Returns initialized Stripe client instance. Lazy-loads on first call
 * to avoid initialization errors during build/test.
 * 
 * @returns {Stripe} Initialized Stripe client
 * @throws {Error} If STRIPE_SECRET_KEY not configured
 * 
 * @example
 * const stripe = getStripe();
 * const session = await stripe.checkout.sessions.create({...});
 */
export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = getStripeClient();
  }
  return stripeClient;
}

/**
 * Create Checkout Session
 * 
 * Creates a Stripe Checkout Session for VIP subscription purchase.
 * Redirects user to Stripe-hosted checkout page with payment form.
 * Includes user metadata for webhook processing and VIP grant automation.
 * 
 * @param {object} params - Checkout session parameters
 * @param {string} params.userId - User ID purchasing VIP
 * @param {string} params.username - Username for display and metadata
 * @param {string} params.email - User email for Stripe customer record
 * @param {VIPTier} params.tier - VIP tier being purchased
 * @param {string} [params.successUrl] - Custom success redirect URL
 * @param {string} [params.cancelUrl] - Custom cancel redirect URL
 * @returns {Promise<CreateCheckoutSessionResponse>} Session ID and checkout URL
 * 
 * @throws {Error} If Stripe API call fails
 * 
 * @example
 * const result = await createCheckoutSession({
 *   userId: '507f1f77bcf86cd799439011',
 *   username: 'player123',
 *   email: 'player@example.com',
 *   tier: VIPTier.MONTHLY,
 * });
 * 
 * if (result.success) {
 *   // Redirect to result.url
 * }
 */
export async function createCheckoutSession(params: {
  userId: string;
  username: string;
  email: string;
  tier: VIPTier;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<CreateCheckoutSessionResponse> {
  try {
    const stripe = getStripe();
    const pricing = VIP_PRICING[params.tier];
    
    // Default URLs if not provided
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = params.successUrl || `${baseUrl}/game/vip-upgrade/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = params.cancelUrl || `${baseUrl}/game/vip-upgrade/cancel`;
    
    // Create checkout session with subscription mode
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: pricing.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: params.email,
      client_reference_id: params.userId, // For webhook processing
      metadata: {
        userId: params.userId,
        username: params.username,
        tier: params.tier,
      },
      subscription_data: {
        metadata: {
          userId: params.userId,
          username: params.username,
          tier: params.tier,
        },
      },
    });
    
    return {
      success: true,
      sessionId: session.id,
      url: session.url || undefined,
    };
  } catch (error) {
    console.error('Stripe checkout session creation failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create checkout session',
    };
  }
}

/**
 * Create Customer Portal Session
 * 
 * Creates a Stripe Customer Portal session for self-service subscription
 * management. Allows users to cancel subscriptions, update payment methods,
 * and view billing history.
 * 
 * @param {string} customerId - Stripe Customer ID
 * @param {string} [returnUrl] - URL to return to after portal session
 * @returns {Promise<CustomerPortalResponse>} Portal session URL
 * 
 * @throws {Error} If Stripe API call fails
 * 
 * @example
 * const result = await createCustomerPortalSession(
 *   'cus_1234abcd',
 *   'https://darkframe.com/game'
 * );
 * 
 * if (result.success) {
 *   // Redirect to result.url
 * }
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl?: string
): Promise<CustomerPortalResponse> {
  try {
    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const finalReturnUrl = returnUrl || `${baseUrl}/game`;
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: finalReturnUrl,
    });
    
    return {
      success: true,
      url: session.url,
    };
  } catch (error) {
    console.error('Stripe customer portal session creation failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create portal session',
    };
  }
}

/**
 * Verify Webhook Signature
 * 
 * Verifies that a webhook request came from Stripe by validating the
 * signature header. Critical for security - prevents unauthorized webhook
 * requests from granting VIP access.
 * 
 * @param {string} payload - Raw request body as string
 * @param {string} signature - Stripe-Signature header value
 * @returns {Stripe.Event | null} Verified Stripe event or null if invalid
 * 
 * @example
 * const event = verifyWebhookSignature(rawBody, sig);
 * if (!event) {
 *   return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
 * }
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): Stripe.Event | null {
  try {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return null;
    }
    
    // Construct event with signature verification
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
    
    return event;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return null;
  }
}

/**
 * Get Subscription Details
 * 
 * Retrieves full subscription details from Stripe including status,
 * billing cycle, and customer information.
 * 
 * @param {string} subscriptionId - Stripe Subscription ID
 * @returns {Promise<Stripe.Subscription | null>} Subscription object or null if not found
 * 
 * @example
 * const sub = await getSubscription('sub_1234abcd');
 * if (sub && sub.status === 'active') {
 *   console.log('Subscription is active');
 * }
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Failed to retrieve subscription:', error);
    return null;
  }
}

/**
 * Cancel Subscription (Admin)
 * 
 * Cancels a subscription immediately (admin action). Different from user
 * cancellation which cancels at period end. Use for refunds or violations.
 * 
 * @param {string} subscriptionId - Stripe Subscription ID to cancel
 * @returns {Promise<boolean>} True if cancellation successful
 * 
 * @example
 * const success = await cancelSubscription('sub_1234abcd');
 * if (success) {
 *   await revokeVIP(userId);
 * }
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<boolean> {
  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(subscriptionId);
    return true;
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    return false;
  }
}

/**
 * Create or Retrieve Customer
 * 
 * Creates a new Stripe customer or retrieves existing one by email.
 * Prevents duplicate customer records for same user.
 * 
 * @param {object} params - Customer parameters
 * @param {string} params.email - Customer email address
 * @param {string} params.userId - Internal user ID for metadata
 * @param {string} params.username - Username for display
 * @returns {Promise<Stripe.Customer | null>} Customer object or null if failed
 * 
 * @example
 * const customer = await createOrRetrieveCustomer({
 *   email: 'player@example.com',
 *   userId: '507f1f77bcf86cd799439011',
 *   username: 'player123'
 * });
 */
export async function createOrRetrieveCustomer(params: {
  email: string;
  userId: string;
  username: string;
}): Promise<Stripe.Customer | null> {
  try {
    const stripe = getStripe();
    
    // Check if customer already exists
    const existingCustomers = await stripe.customers.list({
      email: params.email,
      limit: 1,
    });
    
    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }
    
    // Create new customer
    const customer = await stripe.customers.create({
      email: params.email,
      metadata: {
        userId: params.userId,
        username: params.username,
      },
    });
    
    return customer;
  } catch (error) {
    console.error('Failed to create or retrieve customer:', error);
    return null;
  }
}

/**
 * Retrieve Checkout Session
 * 
 * Retrieves a completed checkout session and its details including payment status.
 * Used to verify successful payments and activate VIP immediately on success page.
 * 
 * @param {string} sessionId - Stripe checkout session ID
 * @returns {Promise<Stripe.Checkout.Session | null>} Session object or null if error
 * 
 * @example
 * const session = await retrieveCheckoutSession('cs_test_...');
 * if (session?.payment_status === 'paid') {
 *   // Grant VIP immediately
 * }
 */
export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    console.error('Failed to retrieve checkout session:', error);
    return null;
  }
}

/* ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * SECURITY:
 * - Secret key stored in environment variable (never expose to client)
 * - Webhook signature verification prevents unauthorized requests
 * - All Stripe API calls wrapped in try-catch for graceful error handling
 * 
 * ERROR HANDLING:
 * - All functions return structured responses with success flags
 * - Errors logged to console for debugging (production: send to Sentry)
 * - No sensitive data exposed in error messages
 * 
 * PERFORMANCE:
 * - Stripe client lazy-loaded on first use
 * - Customer lookup prevents duplicate records
 * - Metadata attached for efficient webhook processing
 * 
 * TESTING:
 * - Use Stripe test mode keys for development
 * - Test webhook events with Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
 * - Test cards: 4242 4242 4242 4242 (success), 4000 0000 0000 9995 (decline)
 * 
 * FUTURE ENHANCEMENTS:
 * - Implement refund processing
 * - Add promotional code support
 * - Support multiple payment methods (ACH, PayPal)
 * - Implement usage-based billing for future features
 * - Add retry logic for failed API calls
 */
