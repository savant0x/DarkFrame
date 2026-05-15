'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

interface RPPackage {
  id: string;
  name: string;
  rp: number;
  price: number;
  popular?: boolean;
  icon: string;
  daysEquivalent: number;
  color: string;
}

const RP_PACKAGES: RPPackage[] = [
  { id: 'starter', name: 'Starter Pack', rp: 1000, price: 2.99, icon: '🌱', daysEquivalent: 0.15, color: 'from-[--synth] to-[--synth-dim]' },
  { id: 'boost', name: 'Progress Boost', rp: 5000, price: 9.99, popular: true, icon: '⚡', daysEquivalent: 0.7, color: 'from-[--electric] to-[--electric]/50' },
  { id: 'power', name: 'Power Pack', rp: 15000, price: 24.99, icon: '💪', daysEquivalent: 2, color: 'from-[--neon-pink] to-[--neon-pink]/50' },
  { id: 'mega', name: 'Mega Bundle', rp: 50000, price: 59.99, icon: '🚀', daysEquivalent: 7, color: 'from-[--solar] to-[--solar]/50' },
  { id: 'legendary', name: 'Legendary Bundle', rp: 100000, price: 99.99, icon: '👑', daysEquivalent: 14, color: 'from-[--neon-yellow] to-[--neon-yellow]/50' },
];

export default function RPPackagesPage() {
  const { player } = useGameContext();
  const [loading, setLoading] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<string>('');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const isVIP = player?.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date();
  const VIP_BONUS = 0.20;

  const handlePurchase = async (pkg: RPPackage) => {
    if (!player) return;
    setLoading(true);
    setPurchaseResult('');
    setSelectedPackage(pkg.id);
    try {
      const finalRP = isVIP ? Math.floor(pkg.rp * (1 + VIP_BONUS)) : pkg.rp;
      setPurchaseResult(`🚧 Stripe integration pending. This would charge $${pkg.price} and award ${finalRP.toLocaleString()} RP.`);
    } catch (error) {
      console.error('Purchase error:', error);
      setPurchaseResult('❌ Purchase failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!player) return null;

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mt-6 text-center mb-8">
                <h1 className="text-5xl font-bold text-[--neon-yellow] mb-4">💎 Research Point Shop</h1>
                <p className="text-xl text-white/60 mb-2">Optional packages to accelerate your progression</p>
                <p className="text-sm text-white/40 mb-6">🌟 <strong className="text-white/60">Free-to-play is fully viable!</strong> Active players earn 6,000-12,000 RP/day through normal play.</p>

                <div className="inline-block bg-[--card] border-2 border-[--neon-yellow]/30 rounded-lg px-8 py-4 mb-8">
                  <div className="text-sm text-white/40 mb-1">Your Current Balance</div>
                  <div className="text-4xl font-bold text-[--neon-yellow]">{player.researchPoints?.toLocaleString() || 0} RP</div>
                  {isVIP && <div className="text-sm text-[--neon-pink] mt-2">👑 VIP: +20% bonus RP on all purchases!</div>}
                </div>
              </div>

              <div className="bg-[--electric]/5 border border-[--electric]/20 rounded-lg p-6 mb-8">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">🎁 Free RP Sources (No Purchase Required)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { icon: '🌾', title: 'Daily Harvesting', amount: '6,000 RP', desc: 'Complete full map (22,500 harvests)' },
                    { icon: '⬆️', title: 'Level Ups', amount: '50-500 RP', desc: 'Per level (scales with level)' },
                    { icon: '⚔️', title: 'PvP Battles', amount: '100-200 RP', desc: 'Per victory (based on opponent)' },
                    { icon: '🏆', title: 'Achievements', amount: '50-250 RP', desc: 'Per achievement unlocked' },
                    { icon: '📅', title: 'Daily Login', amount: '100-170 RP', desc: 'Base + streak bonus (max 7 days)' },
                    { icon: '👑', title: 'VIP Bonus', amount: '+50%', desc: 'All RP sources (VIP subscription)' },
                  ].map((src, i) => (
                    <div key={i} className="bg-[--card] rounded-lg p-4 border border-[--border]">
                      <div className="text-3xl mb-2">{src.icon}</div>
                      <div className="font-bold text-lg mb-1 text-white">{src.title}</div>
                      <div className="text-2xl text-[--neon-yellow] font-bold mb-2">{src.amount}</div>
                      <div className="text-sm text-white/40">{src.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-center mb-6 text-white">Optional RP Packages</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                  {RP_PACKAGES.map((pkg) => {
                    const finalRP = isVIP ? Math.floor(pkg.rp * (1 + VIP_BONUS)) : pkg.rp;
                    const isSelected = selectedPackage === pkg.id;
                    return (
                      <div
                        key={pkg.id}
                        className={`relative bg-[--card] rounded-xl overflow-hidden transition-all duration-300 ${
                          pkg.popular ? 'border-4 border-[--neon-yellow]/50 scale-105' : 'border-2 border-[--border] hover:border-white/20'
                        }`}
                      >
                        {pkg.popular && (
                          <div className="absolute top-0 left-0 right-0 bg-[--neon-yellow] text-black text-center py-1 text-xs font-bold">⭐ MOST POPULAR ⭐</div>
                        )}
                        <div className={`bg-gradient-to-br ${pkg.color} p-6 ${pkg.popular ? 'pt-8' : ''}`}>
                          <div className="text-6xl text-center mb-2">{pkg.icon}</div>
                          <h3 className="text-xl font-bold text-center text-white">{pkg.name}</h3>
                        </div>
                        <div className="p-6">
                          <div className="text-center mb-4">
                            <div className="text-4xl font-bold text-[--neon-yellow] mb-2">{finalRP.toLocaleString()} RP</div>
                            {isVIP && <div className="text-sm text-[--neon-pink] mb-2">(+{(pkg.rp * VIP_BONUS).toLocaleString()} VIP bonus)</div>}
                            <div className="text-2xl font-bold text-white">${pkg.price}</div>
                          </div>
                          <div className="text-center text-sm text-white/40 mb-4">
                            <div className="mb-1">⏱️ Time Saved</div>
                            <div className="text-[--synth] font-semibold">
                              {pkg.daysEquivalent < 1 ? `~${Math.round(pkg.daysEquivalent * 24)} hours` : `~${pkg.daysEquivalent} days`} of farming
                            </div>
                          </div>
                          <button
                            onClick={() => handlePurchase(pkg)}
                            disabled={loading && isSelected}
                            className={`w-full py-3 rounded-lg font-bold transition-all duration-200 ${
                              pkg.popular
                                ? 'bg-[--neon-yellow]/15 border border-[--neon-yellow]/25 text-[--neon-yellow] hover:bg-[--neon-yellow]/25'
                                : 'bg-[--electric]/10 border border-[--electric]/20 text-[--electric] hover:bg-[--electric]/20'
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

              {purchaseResult && (
                <div className={`max-w-2xl mx-auto p-4 rounded-lg text-center mb-8 ${
                  purchaseResult.startsWith('✅') ? 'bg-[--synth]/10 border border-[--synth]/20 text-[--synth]'
                  : purchaseResult.startsWith('🚧') ? 'bg-[--neon-yellow]/10 border border-[--neon-yellow]/20 text-[--neon-yellow]'
                  : 'bg-[--neon-red]/10 border border-[--neon-red]/20 text-[--neon-red]'
                }`}>
                  {purchaseResult}
                </div>
              )}

              <div className="bg-[--card] border border-[--border] rounded-lg p-6 mt-8">
                <h3 className="text-2xl font-bold mb-4 text-white">❓ Frequently Asked Questions</h3>
                <div className="space-y-4">
                  {[
                    { q: 'Is buying RP required to progress?', a: 'NO! Free-to-play players can earn 6,000-12,000 RP per day through normal gameplay. All content is accessible without spending.' },
                    { q: 'How long does it take to earn 100k RP for free?', a: 'Active players (1-2 full maps daily) can earn 100k RP in 8-17 days without spending.' },
                    { q: "What's the best value package?", a: 'The Progress Boost (5k RP, $9.99) is our most popular choice, equivalent to ~17 hours of farming.' },
                    { q: 'Do VIP players get a bonus on purchases?', a: 'Yes! VIP players receive +20% bonus RP on all shop purchases, on top of their existing +50% RP generation from gameplay.' },
                    { q: 'What payment methods are accepted?', a: 'We use Stripe for secure payments, accepting all major credit cards, debit cards, and digital wallets.' },
                  ].map((faq, i) => (
                    <div key={i} className="border-l-4 border-[--electric] pl-4">
                      <div className="font-bold text-lg mb-2 text-white/80">{faq.q}</div>
                      <div className="text-white/60">{faq.a}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[--neon-pink]/5 border-2 border-[--neon-pink]/20 rounded-lg p-8 mt-8 text-center">
                <h3 className="text-3xl font-bold mb-4 text-white">👑 Want Better Long-Term Value?</h3>
                <p className="text-xl text-white/60 mb-6">VIP subscription gives you <strong className="text-white">+50% RP on everything</strong> you earn, plus 2x auto-farm speed!</p>
                <div className="flex justify-center gap-4 mb-6">
                  <div className="bg-[--card] rounded-lg p-4 border border-[--border]">
                    <div className="text-sm text-white/40">VIP Monthly</div>
                    <div className="text-2xl font-bold text-[--neon-pink]">$9.99/mo</div>
                    <div className="text-xs text-[--synth] mt-1">+50% all RP sources</div>
                  </div>
                  <div className="bg-[--card] rounded-lg p-4 border border-[--border]">
                    <div className="text-sm text-white/40">VIP Yearly</div>
                    <div className="text-2xl font-bold text-[--neon-pink]">$99.99/yr</div>
                    <div className="text-xs text-[--synth] mt-1">2 months free!</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}
