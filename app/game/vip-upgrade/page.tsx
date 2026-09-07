/**
 * VIP Upgrade Page — NEON NOIR (FID-20260906-012 P3)
 *
 * Sample contract: void background, nn-panels with corner brackets,
 * violet = VIP signal, Orbitron display numerals, Inter prose,
 * outline buttons with semantic accents — zero decorative gradients.
 *
 * PRICING TIERS: 5 tiers synced with types/stripe.types.ts.
 * All handlers and copy preserved from the previous implementation.
 */

'use client';

import { useGameContext } from '@/context/GameContext';
import { useState, type CSSProperties, type ReactNode } from 'react';
import BackButton from '@/components/BackButton';
import { VIPTier } from '@/types/stripe.types';
import { showInfo } from '@/lib/toastService';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

/**
 * Pricing Tier Configuration
 *
 * Defines all 5 VIP tiers with pricing, savings, and features.
 * Synced with types/stripe.types.ts configuration.
 */
interface PricingTier {
  id: VIPTier;
  name: string;
  price: string;
  priceValue: number;
  interval: string;
  savings: string | null;
  badge: string | null;
  features: string[];
  highlighted: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    id: VIPTier.WEEKLY,
    name: 'Weekly',
    price: '$9.99',
    priceValue: 9.99,
    interval: '7 days',
    savings: null,
    badge: null,
    features: [
      '2x resource multiplier',
      'Automated farming',
      'VIP chat badge',
      'Priority support',
      '7 days of premium access'
    ],
    highlighted: false
  },
  {
    id: VIPTier.MONTHLY,
    name: 'Monthly',
    price: '$24.99',
    priceValue: 24.99,
    interval: '30 days',
    savings: 'Save 17%',
    badge: 'POPULAR',
    features: [
      'All Weekly features',
      '30 days of premium access',
      'Better value per day',
      'Advanced analytics',
      'Exclusive items access'
    ],
    highlighted: true
  },
  {
    id: VIPTier.QUARTERLY,
    name: '3-Month',
    price: '$64.99',
    priceValue: 64.99,
    interval: '90 days',
    savings: 'Save 22%',
    badge: 'BEST VALUE',
    features: [
      'All Monthly features',
      '90 days of premium access',
      'Lowest cost per day',
      'Extended benefits',
      'Quarterly exclusive rewards'
    ],
    highlighted: true
  },
  {
    id: VIPTier.BIANNUAL,
    name: '6-Month',
    price: '$119.99',
    priceValue: 119.99,
    interval: '180 days',
    savings: 'Save 28%',
    badge: null,
    features: [
      'All 3-Month features',
      '180 days of premium access',
      'Maximum value',
      'Bi-annual exclusive items',
      'Dedicated support priority'
    ],
    highlighted: false
  },
  {
    id: VIPTier.YEARLY,
    name: 'Yearly',
    price: '$199.99',
    priceValue: 199.99,
    interval: '365 days',
    savings: 'Save 33%',
    badge: 'ULTIMATE',
    features: [
      'All 6-Month features',
      'Full year of premium access',
      'Ultimate savings (33% off)',
      'Annual exclusive rewards',
      'VIP elite status'
    ],
    highlighted: false
  }
];

/** NEON NOIR HUD module: brackets + scanline header + right meta tag. */
function VipPanel({ title, meta, children, className = '' }: {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`nn-panel ${className}`}>
      <div className="nn-panel__header">
        <h3 className="nn-panel__title">{title}</h3>
        {meta && <span className="nn-panel__meta">{meta}</span>}
      </div>
      <div className="nn-panel__body nn-panel__body--padded">{children}</div>
    </section>
  );
}

/** Page display heading: Orbitron, wide-tracked, no glow. */
function PageH({ children }: { children: ReactNode }) {
  return (
    <h1
      className="nn-chat__title text-center"
      style={{ fontSize: 'clamp(1.25rem, 1rem + 1.5vw, 2rem)', letterSpacing: '0.22em' }}
    >
      {children}
    </h1>
  );
}

/**
 * VIP Upgrade Page Component
 *
 * Displays VIP benefits, pricing tiers, and handles Stripe checkout initiation.
 * Shows current VIP status if user is already subscribed.
 */
export default function VIPUpgradePage() {
  const { player } = useGameContext();

  const [selectedTier, setSelectedTier] = useState<VIPTier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already VIP
  const isVIP = player?.vip || false;
  const vipExpiresAt = player?.vipExpiration;

  // Calculate days remaining
  const daysRemaining = vipExpiresAt
    ? Math.ceil((new Date(vipExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  /**
   * Handle VIP tier purchase
   *
   * Creates Stripe checkout session and redirects to Stripe's hosted checkout.
   *
   * @param tier - Selected VIP tier to purchase
   */
  const handlePurchase = async (tier: VIPTier) => {
    setSelectedTier(tier);
    setIsProcessing(true);
    setError(null);

    try {
      // Call checkout session API
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  return (
    <div className="nn-shell min-h-screen p-6" style={{ background: 'var(--nn-void)' }}>
      {/* Back Button */}
      <div className="mx-auto mb-6 max-w-6xl">
        <BackButton destination="/game" />
      </div>

      {/* VIP MANAGEMENT DASHBOARD - Shows when user already has VIP */}
      {isVIP && vipExpiresAt && (
        <div className="mx-auto mb-12 max-w-4xl space-y-6">
          <div className="text-center">
            <PageH>VIP Dashboard</PageH>
            <p className="mt-2 text-sm text-[color:var(--nn-text-secondary)]">
              Manage your premium subscription
            </p>
          </div>

          {/* Active Subscription Card */}
          <VipPanel title="Active VIP Member" meta="STATUS ▸ ACTIVE" className="nn-panel--violet">
            {/* Subscription Details Grid */}
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="nn-well text-center">
                <div className="nn-num mb-1 text-3xl font-bold text-[color:var(--nn-amber)]">{daysRemaining}</div>
                <div className="nn-lab">Days Remaining</div>
              </div>
              <div className="nn-well text-center">
                <div className="nn-num mb-1 text-lg font-semibold text-[color:var(--nn-amber)]">
                  {new Date(vipExpiresAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div className="nn-lab">Expires On</div>
              </div>
              <div className="nn-well text-center">
                <div className="nn-num mb-1 text-lg font-semibold text-[color:var(--nn-amber)]">
                  {new Date(vipExpiresAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="nn-lab">Expiration Time</div>
              </div>
            </div>

            {/* Your VIP Benefits */}
            <div className="nn-well">
              <h3 className="nn-lab mb-4 !text-[color:var(--nn-violet)]">Your Active Benefits</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { text: '2x Resource Multiplier — Double your efficiency' },
                  { text: 'Automated Farming — Set it and forget it' },
                  { text: 'VIP Chat Badge — Stand out in the community' },
                  { text: 'Advanced Battle Analytics — Detailed insights' },
                  { text: 'Exclusive VIP Shop Access — Premium items' },
                  { text: 'Priority Support — Get help faster' }
                ].map((benefit, idx) => (
                  <div key={idx} className="nn-msg__who">
                    <span className="text-[color:var(--nn-violet)]">▸</span>
                    <span className="nn-msg__text">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </VipPanel>

          {/* Extend Subscription */}
          <VipPanel title="Extend Your Subscription" meta="RENEWAL">
            <p className="mb-4 text-center text-sm text-[color:var(--nn-text-secondary)]">
              Want to continue enjoying VIP benefits? Extend your subscription now!
            </p>
            <div className="text-center">
              <button
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                className="nn-btn nn-btn--primary"
                style={{ width: 'auto', padding: '11px 28px' }}
              >
                View Extension Options
              </button>
            </div>
          </VipPanel>

          {/* Manage Subscription */}
          <VipPanel title="Manage Your Subscription" meta="ACCOUNT">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="nn-well">
                <h4 className="nn-lab mb-3">Payment History</h4>
                <p className="nn-msg__text mb-4">
                  View your transaction history and download invoices
                </p>
                <button
                  onClick={() => showInfo('Payment history feature coming soon!')}
                  className="nn-btn nn-btn--ghost"
                  style={{ padding: '8px 16px' }}
                >
                  View History
                </button>
              </div>

              <div className="nn-well">
                <h4 className="nn-lab mb-3 !text-[color:var(--nn-magenta)]">Cancel Subscription</h4>
                <p className="nn-msg__text mb-4">
                  Cancel your subscription (access continues until expiration)
                </p>
                <button
                  onClick={() => {
                    void (async () => {
                      if (await confirmDialog({ message: 'Are you sure you want to cancel your VIP subscription? You will retain access until ' + new Date(vipExpiresAt).toLocaleDateString(), danger: true, confirmLabel: 'Cancel subscription' })) {
                        showInfo('Cancellation feature coming soon! Contact support for now.');
                      }
                    })();
                  }}
                  className="nn-btn nn-btn--danger"
                  style={{ padding: '8px 16px' }}
                >
                  Cancel VIP
                </button>
              </div>
            </div>
          </VipPanel>

          {/* Divider */}
          <div className="flex items-center gap-4 py-4">
            <div className="h-px flex-1 bg-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)]" />
            <span className="nn-lab">Or explore other plans below</span>
            <div className="h-px flex-1 bg-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)]" />
          </div>
        </div>
      )}

      {/* Hero Section - Only show for non-VIP users */}
      {!isVIP && (
        <div className="mx-auto mb-12 max-w-6xl text-center">
          <PageH>VIP Membership</PageH>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-[color:var(--nn-text-secondary)]">
            Unlock premium features and dominate the wasteland twice as fast
          </p>
        </div>
      )}

      {/* Pricing Tiers Section Title */}
      {isVIP && (
        <div className="mx-auto mb-12 max-w-6xl text-center">
          <PageH>Available Extension Plans</PageH>
          <p className="mt-2 text-sm text-[color:var(--nn-text-secondary)]">Extend your VIP membership with any of these plans</p>
        </div>
      )}

      {/* Speed Comparison - Only show for non-VIP */}
      {!isVIP && (
        <div className="mx-auto mb-12 max-w-6xl">
          <h2 className="nn-chat__title mb-6 text-center" style={{ fontSize: 14 }}>Speed Comparison</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Basic Tier */}
            <VipPanel title="Basic" meta="STANDARD">
              <div className="mb-4 text-center">
                <p className="nn-num text-4xl font-bold text-[color:var(--nn-text-secondary)]">11.6 hours</p>
                <p className="nn-lab mt-2">Full map completion time</p>
              </div>
              <ul className="nn-msg__text space-y-2">
                <li>▸ Standard auto-farm speed</li>
                <li>▸ 3-second harvest cooldown respect</li>
                <li>▸ Safe and reliable</li>
              </ul>
            </VipPanel>

            {/* VIP Tier */}
            <VipPanel title="VIP" meta="RECOMMENDED" className="nn-panel--violet">
              <div className="mb-4 text-center">
                <p className="nn-num text-4xl font-bold text-[color:var(--nn-violet)]">5.6 hours</p>
                <p className="nn-lab mt-2">Full map completion time</p>
                <p className="nn-lab mt-1 !text-[color:var(--nn-violet)]">2x faster</p>
              </div>
              <ul className="nn-msg__text space-y-2">
                <li><span className="text-[color:var(--nn-violet)]">✓</span> 2x speed boost</li>
                <li><span className="text-[color:var(--nn-violet)]">✓</span> Optimized timing algorithms</li>
                <li><span className="text-[color:var(--nn-violet)]">✓</span> Exclusive VIP badge</li>
                <li><span className="text-[color:var(--nn-violet)]">✓</span> Priority support</li>
              </ul>
            </VipPanel>
          </div>
        </div>
      )}

      {/* Feature Comparison Table */}
      <div className="mx-auto mb-12 max-w-6xl">
        <h2 className="nn-chat__title mb-6 text-center" style={{ fontSize: 14 }}>Feature Comparison</h2>
        <VipPanel title="Basic vs VIP" meta="SPEC SHEET">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                <th className="nn-lab p-3 text-left">Feature</th>
                <th className="nn-lab p-3 text-center">Basic</th>
                <th className="nn-lab p-3 text-center !text-[color:var(--nn-violet)]">VIP</th>
              </tr>
            </thead>
            <tbody className="nn-msg__text">
              {(
                [
                  ['Auto-Farm Speed', '1x', '2x'],
                  ['Map Completion Time', '11.6 hours', '5.6 hours'],
                  ['VIP Badge', '—', '✓'],
                  ['Priority Support', '—', '✓'],
                  ['Early Access Features', '—', '✓'],
                  ['Exclusive VIP Items (Coming Soon)', '—', '✓'],
                ] as const
              ).map(([feature, basic, vip]) => (
                <tr key={feature} className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_8%,transparent)] last:border-0">
                  <td className="p-3 text-[color:var(--nn-text-secondary)]">{feature}</td>
                  <td className="p-3 text-center text-[color:var(--nn-text-tertiary)]">{basic}</td>
                  <td className="p-3 text-center font-semibold text-[color:var(--nn-violet)]">{vip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </VipPanel>
      </div>

      {/* Pricing Tiers */}
      <div className="mx-auto mb-12 max-w-6xl">
        <h2 className="nn-chat__title mb-2 text-center" style={{ fontSize: 14 }}>Choose Your Plan</h2>
        <p className="nn-lab mb-8 text-center">All plans include full VIP features</p>

        {/* Error Message */}
        {error && (
          <div className="nn-tut-reward mb-6" style={{ '--nn-accent': 'var(--nn-magenta)' } as CSSProperties}>
            <div className="nn-msg__text">{error}</div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`nn-panel text-center ${tier.highlighted ? 'nn-panel--violet md:-translate-y-1' : ''}`}
              style={{ '--nn-accent': tier.highlighted ? 'var(--nn-violet)' : 'var(--nn-cyan)' } as CSSProperties}
            >
              <div className="nn-panel__header justify-center">
                <h3 className="nn-panel__title">{tier.name}</h3>
              </div>
              <div className="nn-panel__body nn-panel__body--padded">
                {tier.badge && (
                  <span className="nn-chip nn-chip--violet mb-2 inline-block">{tier.badge}</span>
                )}
                <p className="nn-num mb-1 text-2xl font-bold text-[color:var(--nn-amber)]">{tier.price}</p>
                {tier.savings && (
                  <p className="nn-lab mb-1 !text-[color:var(--nn-green)]">{tier.savings}</p>
                )}
                <p className="nn-lab mb-4">{tier.interval}</p>

                {/* Features */}
                <ul className="nn-msg__text mb-5 space-y-1.5 text-left">
                  {tier.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className="text-[color:var(--nn-green)]">✓</span> {feature}
                    </li>
                  ))}
                </ul>

                {/* Purchase Button */}
                <button
                  onClick={() => handlePurchase(tier.id)}
                  disabled={isProcessing || (isVIP && !vipExpiresAt)}
                  className={`nn-btn ${tier.highlighted ? 'nn-btn--primary' : 'nn-btn--ghost'}`}
                  style={{ padding: '9px 12px' }}
                >
                  {isProcessing && selectedTier === tier.id
                    ? 'Processing...'
                    : isVIP && !vipExpiresAt
                    ? 'Already VIP'
                    : 'Get VIP'}
                </button>

                {/* Cost per day */}
                <p className="nn-lab mt-2">
                  ${(tier.priceValue / parseInt(tier.interval)).toFixed(2)}/day
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="nn-lab mt-8 flex flex-wrap justify-center gap-6">
          <span>Secure payments via Stripe</span>
          <span>Instant activation</span>
          <span>Cancel anytime</span>
        </div>
      </div>

      {/* Payment Security Notice */}
      <div className="mx-auto mb-12 max-w-4xl">
        <div className="nn-tut-reward" style={{ '--nn-accent': 'var(--nn-cyan)' } as CSSProperties}>
          <div>
            <div className="nn-tut-reward__lab">Secure Payment Processing</div>
            <p className="nn-msg__text">
              All payments are processed securely through Stripe, a PCI-compliant payment processor
              trusted by millions worldwide. We never store your credit card information on our servers.
              Your VIP status activates automatically within seconds after successful payment.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mx-auto mb-12 max-w-4xl">
        <h2 className="nn-chat__title mb-6 text-center" style={{ fontSize: 14 }}>Frequently Asked Questions</h2>
        <div className="space-y-3">
          {(
            [
              ['How does the 2x speed boost work?',
                'VIP members use optimized timing algorithms that reduce delays between movements and harvests, allowing you to complete the entire map in 5.6 hours instead of 11.6 hours. That\'s 2x faster!'],
              ['Can I cancel my VIP subscription anytime?',
                'Yes! You can cancel your subscription anytime from your profile page. Your VIP benefits will remain active until the end of your current billing period. No refunds for partial periods.'],
              ['When will my VIP activate after payment?',
                'VIP activation is instant! After successful payment on Stripe, our webhook automatically grants your VIP status within seconds. You\'ll be redirected back to the game and can start using premium features immediately.'],
              ['What happens when my VIP expires?',
                'Your account will revert to Basic tier with standard auto-farm speed. All your progress, resources, and items are kept. You can re-subscribe anytime to regain VIP benefits.'],
              ['Are there any exclusive VIP items?',
                'Exclusive VIP units and items are coming in future updates! Stay tuned for announcements.'],
              ['Is my payment information secure?',
                'Absolutely! We use Stripe, a PCI-compliant payment processor trusted by millions of businesses worldwide including Amazon, Google, and Shopify. We never store your credit card details on our servers - all payment data is handled securely by Stripe.'],
              ['What payment methods are accepted?',
                'We accept all major credit cards (Visa, Mastercard, American Express, Discover) and debit cards through Stripe. Additional payment methods may be available based on your location. Stripe supports secure payments in 135+ currencies worldwide.'],
            ] as const
          ).map(([q, a]) => (
            <details key={q} className="nn-panel">
              <summary className="nn-panel__header cursor-pointer list-none">
                <span className="nn-panel__title !text-[11px]">{q}</span>
              </summary>
              <div className="nn-panel__body nn-panel__body--padded">
                <p className="nn-msg__text">{a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
