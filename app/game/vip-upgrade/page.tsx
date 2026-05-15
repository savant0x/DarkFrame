'use client';

import { useGameContext } from '@/context/GameContext';
import { useState } from 'react';
import BackButton from '@/components/BackButton';
import { VIPTier } from '@/types/stripe.types';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

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
    id: VIPTier.WEEKLY, name: 'Weekly', price: '$9.99', priceValue: 9.99, interval: '7 days',
    savings: null, badge: null,
    features: ['2x resource multiplier', 'Automated farming', 'VIP chat badge', 'Priority support', '7 days of premium access'],
    highlighted: false,
  },
  {
    id: VIPTier.MONTHLY, name: 'Monthly', price: '$24.99', priceValue: 24.99, interval: '30 days',
    savings: 'Save 17%', badge: 'POPULAR',
    features: ['All Weekly features', '30 days of premium access', 'Better value per day', 'Advanced analytics', 'Exclusive items access'],
    highlighted: true,
  },
  {
    id: VIPTier.QUARTERLY, name: '3-Month', price: '$64.99', priceValue: 64.99, interval: '90 days',
    savings: 'Save 22%', badge: 'BEST VALUE',
    features: ['All Monthly features', '90 days of premium access', 'Lowest cost per day', 'Extended benefits', 'Quarterly exclusive rewards'],
    highlighted: true,
  },
  {
    id: VIPTier.BIANNUAL, name: '6-Month', price: '$119.99', priceValue: 119.99, interval: '180 days',
    savings: 'Save 28%', badge: null,
    features: ['All 3-Month features', '180 days of premium access', 'Maximum value', 'Bi-annual exclusive items', 'Dedicated support priority'],
    highlighted: false,
  },
  {
    id: VIPTier.YEARLY, name: 'Yearly', price: '$199.99', priceValue: 199.99, interval: '365 days',
    savings: 'Save 33%', badge: 'ULTIMATE',
    features: ['All 6-Month features', 'Full year of premium access', 'Ultimate savings (33% off)', 'Annual exclusive rewards', 'VIP elite status'],
    highlighted: false,
  },
];

export default function VIPUpgradePage() {
  const { player } = useGameContext();
  const [selectedTier, setSelectedTier] = useState<VIPTier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVIP = player?.is_vip || false;
  const vipExpiresAt = player?.vip_expiration;
  const daysRemaining = vipExpiresAt
    ? Math.ceil((new Date(vipExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const handlePurchase = async (tier: VIPTier) => {
    setSelectedTier(tier);
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create checkout session');
      if (data.url) window.location.href = data.url;
      else throw new Error('No checkout URL returned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  return (
    <>
      <TopNavBar onFriendsClick={() => {}} />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] p-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <BackButton destination="/game" />
              </div>

              {isVIP && vipExpiresAt && (
                <div className="mb-12">
                  <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold text-[--neon-yellow] mb-4">⚡ VIP Dashboard ⚡</h1>
                    <p className="text-xl text-white/60">Manage your premium subscription</p>
                  </div>

                  <div className="bg-[--neon-yellow]/5 border-2 border-[--neon-yellow]/20 rounded-xl p-8 shadow-2xl mb-8">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-3xl">👑</span>
                          <h2 className="text-3xl font-bold text-[--neon-yellow]">Active VIP Member</h2>
                        </div>
                        <p className="text-white/60">You're enjoying premium benefits</p>
                      </div>
                      <span className="inline-block bg-[--synth]/10 text-[--synth] px-4 py-2 rounded-full text-sm font-semibold border border-[--synth]/20">✅ ACTIVE</span>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                      <div className="bg-white/[0.03] rounded-lg p-6 text-center border border-[--border]">
                        <div className="text-4xl font-bold text-[--neon-yellow] mb-2">{daysRemaining}</div>
                        <div className="text-sm text-white/40">Days Remaining</div>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-6 text-center border border-[--border]">
                        <div className="text-lg font-semibold text-[--neon-yellow] mb-2">
                          {new Date(vipExpiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-sm text-white/40">Expires On</div>
                      </div>
                      <div className="bg-white/[0.03] rounded-lg p-6 text-center border border-[--border]">
                        <div className="text-lg font-semibold text-[--neon-yellow] mb-2">
                          {new Date(vipExpiresAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm text-white/40">Expiration Time</div>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] rounded-lg p-6 border border-[--border]">
                      <h3 className="text-xl font-bold text-[--neon-yellow] mb-4">✨ Your Active Benefits</h3>
                      <div className="grid md:grid-cols-2 gap-3">
                        {[
                          { icon: '⚡', text: '2x Resource Multiplier - Double your efficiency' },
                          { icon: '🤖', text: 'Automated Farming - Set it and forget it' },
                          { icon: '👑', text: 'VIP Chat Badge - Stand out in the community' },
                          { icon: '📊', text: 'Advanced Battle Analytics - Detailed insights' },
                          { icon: '🛍️', text: 'Exclusive VIP Shop Access - Premium items' },
                          { icon: '🎯', text: 'Priority Support - Get help faster' },
                        ].map((benefit, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <span className="text-xl flex-shrink-0">{benefit.icon}</span>
                            <span className="text-sm text-white/60">{benefit.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-[--border] rounded-xl p-8 mb-8">
                    <h3 className="text-2xl font-bold text-center mb-4 text-white">🔄 Extend Your Subscription</h3>
                    <p className="text-center text-white/60 mb-6">Want to continue enjoying VIP benefits? Extend your subscription now!</p>
                    <div className="text-center">
                      <button
                        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                        className="bg-[--neon-yellow]/15 border border-[--neon-yellow]/25 text-[--neon-yellow] font-bold py-3 px-8 rounded-lg hover:bg-[--neon-yellow]/25 transition-colors"
                      >
                        View Extension Options
                      </button>
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-[--border] rounded-xl p-8">
                    <h3 className="text-2xl font-bold text-center mb-4 text-white">⚙️ Manage Your Subscription</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-white/[0.02] border border-[--border] rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-[--neon-yellow] mb-3">📜 Payment History</h4>
                        <p className="text-sm text-white/40 mb-4">View your transaction history and download invoices</p>
                        <button
                          onClick={() => alert('Payment history feature coming soon!')}
                          className="w-full bg-[--neon-pink]/15 border border-[--neon-pink]/25 text-[--neon-pink] font-semibold py-2 px-4 rounded-lg hover:bg-[--neon-pink]/25 transition-colors"
                        >
                          View History
                        </button>
                      </div>
                      <div className="bg-white/[0.02] border border-[--neon-red]/20 rounded-lg p-6">
                        <h4 className="text-lg font-semibold text-[--neon-red] mb-3">❌ Cancel Subscription</h4>
                        <p className="text-sm text-white/40 mb-4">Cancel your subscription (access continues until expiration)</p>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to cancel? You will retain access until ${new Date(vipExpiresAt).toLocaleDateString()}`)) {
                              alert('Cancellation feature coming soon! Contact support for now.');
                            }
                          }}
                          className="w-full bg-[--neon-red]/10 border border-[--neon-red]/20 text-[--neon-red] font-semibold py-2 px-4 rounded-lg hover:bg-[--neon-red]/20 transition-colors"
                        >
                          Cancel VIP
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="my-12 border-t border-[--border]">
                    <div className="text-center -mt-4">
                      <span className="bg-[--void] px-4 text-white/40 text-sm">Or explore other plans below</span>
                    </div>
                  </div>
                </div>
              )}

              {!isVIP && (
                <div className="max-w-6xl mx-auto text-center mb-12">
                  <h1 className="text-5xl font-bold text-[--neon-yellow] mb-4">⚡ VIP Membership ⚡</h1>
                  <p className="text-xl text-white/60 max-w-2xl mx-auto">Unlock premium features and dominate the wasteland twice as fast</p>
                </div>
              )}

              {isVIP && (
                <div className="max-w-6xl mx-auto text-center mb-12">
                  <h2 className="text-4xl font-bold mb-4 text-white">Available Extension Plans</h2>
                  <p className="text-white/60">Extend your VIP membership with any of these plans</p>
                </div>
              )}

              {!isVIP && (
                <div className="max-w-6xl mx-auto mb-12">
                  <h2 className="text-3xl font-bold text-center mb-8 text-white">⚡ Speed Comparison</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white/[0.03] border border-[--border] rounded-lg p-6">
                      <div className="text-center mb-4">
                        <span className="inline-block bg-[--neon-pink]/10 text-[--neon-pink] px-4 py-2 rounded-full text-sm font-semibold border border-[--neon-pink]/20">🐢 BASIC</span>
                      </div>
                      <div className="text-center mb-6">
                        <p className="text-4xl font-bold text-[--neon-pink]">11.6 hours</p>
                        <p className="text-white/40 mt-2">Full map completion time</p>
                      </div>
                      <ul className="space-y-3 text-white/60">
                        <li>• Standard auto-farm speed</li>
                        <li>• 3-second harvest cooldown respect</li>
                        <li>• Safe and reliable</li>
                      </ul>
                    </div>

                    <div className="bg-[--neon-yellow]/5 border-2 border-[--neon-yellow]/30 rounded-lg p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-[--neon-yellow] text-black px-3 py-1 text-xs font-bold">RECOMMENDED</div>
                      <div className="text-center mb-4 mt-4">
                        <span className="inline-block bg-[--neon-yellow]/15 text-[--neon-yellow] px-4 py-2 rounded-full text-sm font-bold border border-[--neon-yellow]/25">⚡ VIP</span>
                      </div>
                      <div className="text-center mb-6">
                        <p className="text-4xl font-bold text-[--neon-yellow]">5.6 hours</p>
                        <p className="text-white/60 mt-2 font-semibold">Full map completion time</p>
                        <p className="text-[--neon-yellow] text-sm mt-1">⚡ 2x FASTER ⚡</p>
                      </div>
                      <ul className="space-y-3 text-white/60">
                        <li><span className="text-[--neon-yellow]">✓</span> 2x speed boost</li>
                        <li><span className="text-[--neon-yellow]">✓</span> Optimized timing algorithms</li>
                        <li><span className="text-[--neon-yellow]">✓</span> Exclusive VIP badge</li>
                        <li><span className="text-[--neon-yellow]">✓</span> Priority support</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="max-w-6xl mx-auto mb-12">
                <h2 className="text-3xl font-bold text-center mb-8 text-white">📊 Feature Comparison</h2>
                <div className="bg-white/[0.03] border border-[--border] rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[--border]">
                        <th className="text-left p-4 text-white/40">Feature</th>
                        <th className="text-center p-4 text-[--neon-pink]">Basic</th>
                        <th className="text-center p-4 text-[--neon-yellow]">VIP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Auto-Farm Speed', '1x', '2x ⚡'],
                        ['Map Completion Time', '11.6 hours', '5.6 hours'],
                        ['VIP Badge', '❌', '✅'],
                        ['Priority Support', '❌', '✅'],
                        ['Early Access Features', '❌', '✅'],
                        ['Exclusive VIP Items', '❌', '✅'],
                      ].map(([feature, basic, vip], idx) => (
                        <tr key={idx} className="border-b border-[--border]/50">
                          <td className="p-4 text-white/60">{feature}</td>
                          <td className="text-center p-4 text-white/40">{basic}</td>
                          <td className="text-center p-4 font-bold text-[--neon-yellow]">{vip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="max-w-6xl mx-auto mb-12">
                <h2 className="text-3xl font-bold text-center mb-4 text-white">💎 Choose Your Plan</h2>
                <p className="text-center text-white/40 mb-8">All plans include full VIP features. Pick the duration that works for you!</p>

                {error && (
                  <div className="mb-6 bg-[--neon-red]/10 border border-[--neon-red]/20 rounded-lg p-4 text-center">
                    <p className="text-[--neon-red]">{error}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {pricingTiers.map((tier) => (
                    <div
                      key={tier.id}
                      className={`rounded-lg p-6 text-center relative ${
                        tier.highlighted
                          ? 'bg-[--neon-yellow]/5 border-2 border-[--neon-yellow]/30 scale-105'
                          : 'bg-white/[0.03] border border-[--border]'
                      }`}
                    >
                      {tier.badge && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[--neon-yellow] text-black px-3 py-1 rounded-full text-xs font-bold">
                          {tier.badge}
                        </div>
                      )}
                      <h3 className="text-xl font-bold mb-2 text-white">{tier.name}</h3>
                      <p className="text-3xl font-bold mb-1 text-[--neon-yellow]">{tier.price}</p>
                      {tier.savings && <p className="text-sm text-[--synth] mb-2">{tier.savings}</p>}
                      <p className="text-white/40 text-sm mb-4">{tier.interval}</p>
                      <ul className="space-y-2 mb-6 text-left">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start text-sm">
                            <span className="text-[--synth] mr-2 mt-0.5">✓</span>
                            <span className="text-white/60">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => handlePurchase(tier.id)}
                        disabled={isProcessing || (isVIP && !vipExpiresAt)}
                        className={`w-full py-3 rounded-lg font-semibold transition ${
                          isProcessing && selectedTier === tier.id
                            ? 'bg-white/10 text-white/30 cursor-wait'
                            : tier.highlighted
                            ? 'bg-[--neon-yellow]/15 border border-[--neon-yellow]/25 text-[--neon-yellow] hover:bg-[--neon-yellow]/25'
                            : 'bg-white/5 border border-[--border] text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {isProcessing && selectedTier === tier.id ? 'Processing...' : isVIP && !vipExpiresAt ? 'Already VIP' : 'Get VIP'}
                      </button>
                      <p className="text-xs text-white/30 mt-2">${(tier.priceValue / parseInt(tier.interval)).toFixed(2)}/day</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-white/40">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[--synth]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Secure payments via Stripe
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[--electric]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    Instant activation
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[--neon-pink]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                    Join 500+ VIP members
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[--neon-yellow]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Cancel anytime
                  </div>
                </div>
              </div>

              <div className="max-w-4xl mx-auto mb-12">
                <div className="bg-[--electric]/5 border border-[--electric]/20 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <svg className="w-6 h-6 text-[--electric] mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h3 className="text-lg font-semibold text-[--electric] mb-2">Secure Payment Processing</h3>
                      <p className="text-white/60 text-sm leading-relaxed">
                        All payments are processed securely through Stripe, a PCI-compliant payment processor trusted by millions worldwide. We never store your credit card information on our servers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-w-4xl mx-auto mb-12">
                <h2 className="text-3xl font-bold text-center mb-8 text-white">❓ Frequently Asked Questions</h2>
                <div className="space-y-4">
                  {[
                    { q: 'How does the 2x speed boost work?', a: 'VIP members use optimized timing algorithms that reduce delays between movements and harvests, allowing you to complete the entire map in 5.6 hours instead of 11.6 hours.' },
                    { q: 'Can I cancel my VIP subscription anytime?', a: 'Yes! You can cancel anytime from your profile page. Your VIP benefits will remain active until the end of your current billing period.' },
                    { q: 'When will my VIP activate after payment?', a: 'VIP activation is instant! After successful payment on Stripe, our webhook automatically grants your VIP status within seconds.' },
                    { q: 'What happens when my VIP expires?', a: 'Your account will revert to Basic tier with standard auto-farm speed. All your progress, resources, and items are kept.' },
                    { q: 'Are there any exclusive VIP items?', a: 'Exclusive VIP units and items are coming in future updates! Stay tuned for announcements.' },
                    { q: 'Is my payment information secure?', a: 'Absolutely! We use Stripe, a PCI-compliant payment processor. We never store your credit card details on our servers.' },
                    { q: 'What payment methods are accepted?', a: 'We accept all major credit cards and debit cards through Stripe. Stripe supports secure payments in 135+ currencies worldwide.' },
                  ].map((faq, idx) => (
                    <details key={idx} className="bg-white/[0.03] border border-[--border] rounded-lg p-4">
                      <summary className="font-semibold cursor-pointer text-white/80 text-lg">{faq.q}</summary>
                      <p className="text-white/60 mt-3">{faq.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}
