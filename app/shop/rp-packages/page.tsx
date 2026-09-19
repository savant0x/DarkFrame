/**
 * @file app/shop/rp-packages/page.tsx
 * @created 2025-10-20
 * @overview Optional RP shop for players who want to speed up progression
 * 
 * OVERVIEW:
 * Optional (NOT required) RP purchase packages for players who want to
 * accelerate progression. Clearly shows time equivalent to emphasize that
 * free-to-play path is viable. VIP players get bonus RP on all packages.
 * 
 * MONETIZATION PHILOSOPHY:
 * - Free-to-play is fully viable (6,000-12,000 RP/day)
 * - 100k RP achievable in 8-17 days without spending
 * - Shop accelerates progress but doesn't gate content
 * - Clear "time saved" messaging (e.g., "Skip 2 days of farming")
 * - VIP gets +20% bonus RP on all purchases
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import BackButton from '@/components/BackButton';
import { RP_PACKAGES as SERVER_PACKAGES, type RPPackage as ServerRPPackage } from '@/lib/stripe/rpPackages';

// ============================================================================
// INTERFACES
// ============================================================================

interface RPPackage {
  id: string;
  name: string;
  rp: number;
  price: number;
  popular?: boolean;
  icon: string;
  daysEquivalent: number; // How many days of active play this equals
  color: string; // accent CSS color (var(--nn-*)) for the card header band
}

// ============================================================================
// RP PACKAGES
// ============================================================================

// Display-only metadata (icon, time-saved copy, accent color) — never sent to
// the server; charging uses the server map exclusively.
const ICONS_BY_PACKAGE: Record<string, string> = {
  starter: '🌱',
  boost: '⚡',
  power: '💪',
  mega: '🚀',
  legendary: '👑',
};
const DAYS_BY_PACKAGE: Record<string, number> = {
  starter: 0.15,
  boost: 0.7,
  power: 2,
  mega: 7,
  legendary: 14,
};
const COLOR_BY_PACKAGE: Record<string, string> = {
  starter: 'var(--nn-green)',
  boost: 'var(--nn-cyan)',
  power: 'var(--nn-violet)',
  mega: 'var(--nn-magenta)',
  legendary: 'var(--nn-amber)',
};

// FID-20260919-010: the shop's display list is a compile-time mirror of the
// SERVER's package map (lib/stripe/rpPackages) — the same ids, RP amounts, and
// prices the checkout session will actually charge. The client sends only a
// packageId; the server owns every number.
const RP_PACKAGES: RPPackage[] = SERVER_PACKAGES.map((p: ServerRPPackage) => ({
  id: p.id,
  name: p.name,
  rp: p.rp,
  price: p.priceCents / 100,
  icon: ICONS_BY_PACKAGE[p.id] ?? '💠',
  daysEquivalent: DAYS_BY_PACKAGE[p.id] ?? 1,
  color: COLOR_BY_PACKAGE[p.id] ?? 'var(--nn-cyan)',
}));

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RPPackagesPage() {
  const router = useRouter();
  const { player } = useGameContext();
  
  const [loading, setLoading] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<string>('');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  // Check if player is VIP for bonus display
  const isVIP = player?.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date();
  const VIP_BONUS = 0.20; // 20% bonus RP for VIP

  // ============================================================================
  // PURCHASE HANDLER (PLACEHOLDER - STRIPE INTEGRATION NEEDED)
  // ============================================================================

  const handlePurchase = async (pkg: RPPackage) => {
    if (!player) return;
    
    setLoading(true);
    setPurchaseResult('');
    setSelectedPackage(pkg.id);

    try {
      // FID-20260919-010: real Stripe one-time checkout. The client sends only
      // the packageId — price and RP live server-side. On success the browser
      // redirects to Stripe's hosted page; the webhook grants the RP.
      const res = await fetch('/api/stripe/rp-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success && data.url) {
        window.location.href = data.url;
        return; // redirecting away — no state reset
      }

      // Honest failure: surface the server's message (auth, validation, Stripe).
      setPurchaseResult(`❌ ${data?.message || 'Purchase failed. Please try again.'}`);
    } catch (error) {
      console.error('Purchase error:', error);
      setPurchaseResult('❌ Purchase failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!player) {
    return (
      <div className="min-h-screen bg-[color:var(--nn-void)] flex items-center justify-center">
        <div className="text-[color:var(--nn-text-primary)] text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <BackButton destination="/game" />
        
        <div className="mt-6 text-center">
          <h1 className="text-5xl font-bold text-[color:var(--nn-text-primary)] mb-4" style={{ fontFamily: 'var(--nn-font-display)' }}>
            Research Point Shop
          </h1>
          <p className="text-xl text-[color:var(--nn-text-primary)] mb-2">
            Optional packages to accelerate your progression
          </p>
          <p className="text-sm text-[color:var(--nn-text-secondary)] mb-6">
            <strong>Free-to-play is fully viable!</strong> Active players earn 6,000-12,000 RP/day through normal play.
          </p>
          
          {/* Current RP Balance */}
          <div className="inline-block nn-panel rounded-none px-8 py-4 mb-8" style={{ ['--nn-accent' as string]: 'var(--nn-amber)' }}>
            <div className="text-sm text-[color:var(--nn-text-secondary)] mb-1">Your Current Balance</div>
            <div className="text-4xl font-bold text-[color:var(--nn-amber)]">
              {player.researchPoints?.toLocaleString() || 0} RP
            </div>
            {isVIP && (
              <div className="text-sm text-[color:var(--nn-violet)] mt-2">
                👑 VIP: +20% bonus RP on all purchases!
              </div>
            )}
          </div>
        </div>

        {/* Free RP Sources Info */}
        <div className="nn-panel rounded-none p-6 mb-8">
          <h3 className="nn-panel__title text-2xl mb-4 flex items-center gap-2">
            <span>Free RP Sources (No Purchase Required)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FreeSourceCard
              icon="🌾"
              title="Daily Harvesting"
              amount="6,000 RP"
              description="Complete full map (22,500 harvests)"
            />
            <FreeSourceCard
              icon="⬆️"
              title="Level Ups"
              amount="50-500 RP"
              description="Per level (scales with level)"
            />
            <FreeSourceCard
              icon="⚔️"
              title="PvP Battles"
              amount="100-200 RP"
              description="Per victory (based on opponent)"
            />
            <FreeSourceCard
              icon="🏆"
              title="Achievements"
              amount="50-250 RP"
              description="Per achievement unlocked"
            />
            <FreeSourceCard
              icon="📅"
              title="Daily Login"
              amount="100-170 RP"
              description="Base + streak bonus (max 7 days)"
            />
            <FreeSourceCard
              icon="👑"
              title="VIP Bonus"
              amount="+50%"
              description="All RP sources (VIP subscription)"
            />
          </div>
        </div>

        {/* RP Packages */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-center mb-6">
            Optional RP Packages
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {RP_PACKAGES.map((pkg) => {
              const finalRP = isVIP ? Math.floor(pkg.rp * (1 + VIP_BONUS)) : pkg.rp;
              const isSelected = selectedPackage === pkg.id;
              
              return (
                <div
                  key={pkg.id}
                  className={`relative nn-surface--dark rounded-none overflow-hidden transition-all duration-300 ${
                    pkg.popular 
                      ? 'border-4 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] shadow-[0_0_24px_color-mix(in_oklab,var(--nn-amber)_28%,transparent)] scale-105' 
                      : 'border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] hover:border-[color-mix(in_oklab,var(--nn-cyan)_32%,transparent)]'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-[color:var(--nn-amber)] text-[color:var(--nn-void)] text-center py-1 text-xs font-bold" style={{ fontFamily: 'var(--nn-font-display)' }}>
                      MOST POPULAR
                    </div>
                  )}
                  
                  <div
                    className="p-6 border-b border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)]"
                    style={{ background: `color-mix(in oklab, ${pkg.color} 16%, transparent)` }}
                  >
                    <div className="text-6xl text-center mb-2">{pkg.icon}</div>
                    <h3 className="text-xl font-bold text-center text-[color:var(--nn-text-primary)]">{pkg.name}</h3>
                  </div>

                  <div className="p-6">
                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold text-[color:var(--nn-amber)] mb-2">
                        {finalRP.toLocaleString()} RP
                      </div>
                      {isVIP && (
                        <div className="text-sm text-[color:var(--nn-violet)] mb-2">
                          (+{(pkg.rp * VIP_BONUS).toLocaleString()} VIP bonus)
                        </div>
                      )}
                      <div className="text-2xl font-bold text-[color:var(--nn-text-primary)]">
                        ${pkg.price}
                      </div>
                    </div>

                    <div className="text-center text-sm text-[color:var(--nn-text-secondary)] mb-4">
                      <div className="mb-1">⏱️ Time Saved</div>
                      <div className="text-[color:var(--nn-green)] font-semibold">
                        {pkg.daysEquivalent < 1 
                          ? `~${Math.round(pkg.daysEquivalent * 24)} hours`
                          : `~${pkg.daysEquivalent} days`
                        } of farming
                      </div>
                    </div>

                    <button
                      onClick={() => handlePurchase(pkg)}
                      disabled={loading && isSelected}
                      className={`w-full py-3 rounded-none font-bold transition-all duration-200 ${
                        pkg.popular
                          ? 'nn-btn nn-btn--amber'
                          : 'nn-btn nn-btn--primary'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {loading && isSelected ? '⏳ Processing...' : '💳 Purchase'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Purchase Result */}
        {purchaseResult && (
          <div className={`max-w-2xl mx-auto p-4 rounded-none text-center ${
            purchaseResult.startsWith('✅') 
              ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] text-[color:var(--nn-green)]'
              : purchaseResult.startsWith('🚧')
              ? 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] text-[color:var(--nn-amber)]'
              : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] text-[color:var(--nn-magenta)]'
          }`}>
            {purchaseResult}
          </div>
        )}

        {/* FAQ / Transparency Section */}
        <div className="nn-panel rounded-none p-6 mt-8">
          <h3 className="nn-panel__title text-2xl mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <FAQItem
              question="Is buying RP required to progress?"
              answer="NO! Free-to-play players can earn 6,000-12,000 RP per day through normal gameplay. All content is accessible without spending."
            />
            <FAQItem
              question="How long does it take to earn 100k RP for free?"
              answer="Active players (1-2 full maps daily) can earn 100k RP in 8-17 days without spending. VIP subscription (+50% RP) reduces this to 6-11 days."
            />
            <FAQItem
              question="What's the best value package?"
              answer="The Progress Boost (5k RP, $9.99) is our most popular choice, equivalent to ~17 hours of farming. For long-term players, VIP subscription ($9.99/month) provides better value with +50% RP generation."
            />
            <FAQItem
              question="Do VIP players get a bonus on purchases?"
              answer="Yes! VIP players receive +20% bonus RP on all shop purchases, on top of their existing +50% RP generation from gameplay."
            />
            <FAQItem
              question="What payment methods are accepted?"
              answer="We use Stripe for secure payments, accepting all major credit cards, debit cards, and digital wallets. Your payment information is never stored on our servers."
            />
          </div>
        </div>

        {/* Call to Action - VIP Subscription */}
        <div className="nn-panel nn-panel--violet rounded-none p-8 mt-8 text-center">
          <h3 className="nn-panel__title text-3xl mb-4">
            Want Better Long-Term Value?
          </h3>
          <p className="text-xl text-[color:var(--nn-text-primary)] mb-6">
            VIP subscription gives you <strong>+50% RP on everything</strong> you earn, plus 2x auto-farm speed!
          </p>
          <div className="flex justify-center gap-4">
            <div className="nn-surface--dark rounded-none p-4">
              <div className="text-sm text-[color:var(--nn-text-secondary)]">VIP Monthly</div>
              <div className="text-2xl font-bold text-[color:var(--nn-violet)]">$9.99/mo</div>
              <div className="text-xs text-[color:var(--nn-green)] mt-1">+50% all RP sources</div>
            </div>
            <div className="nn-surface--dark rounded-none p-4">
              <div className="text-sm text-[color:var(--nn-text-secondary)]">VIP Yearly</div>
              <div className="text-2xl font-bold text-[color:var(--nn-violet)]">$99.99/yr</div>
              <div className="text-xs text-[color:var(--nn-green)] mt-1">2 months free!</div>
            </div>
          </div>
          <button
            onClick={() => router.push('/shop/vip')}
            className="nn-btn nn-btn--amber w-auto mt-6 px-8 py-3 font-bold text-lg"
          >
            Learn More About VIP
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface FreeSourceCardProps {
  icon: string;
  title: string;
  amount: string;
  description: string;
}

function FreeSourceCard({ icon, title, amount, description }: FreeSourceCardProps) {
  return (
    <div className="nn-surface--dark rounded-none p-4">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-bold text-lg mb-1">{title}</div>
      <div className="text-2xl text-[color:var(--nn-amber)] font-bold mb-2">{amount}</div>
      <div className="text-sm text-[color:var(--nn-text-secondary)]">{description}</div>
    </div>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <div className="border-l-4 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] pl-4">
      <div className="font-bold text-lg mb-2">{question}</div>
      <div className="text-[color:var(--nn-text-primary)]">{answer}</div>
    </div>
  );
}
