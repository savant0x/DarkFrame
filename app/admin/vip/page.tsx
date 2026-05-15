'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

interface SubscriptionPackage {
  id: string;
  name: string;
  duration: number;
  price: number;
  enabled: boolean;
  features: string[];
  savings?: string;
}

interface ActiveSubscription {
  username: string;
  packageId: string;
  startDate: string;
  expiresAt: string;
  autoRenew: boolean;
  paymentMethod: string;
}

export default function VIPSubscriptionPage() {
  const router = useRouter();
  const { player } = useGameContext();
  const [loading, setLoading] = useState(true);

  const [packages, setPackages] = useState<SubscriptionPackage[]>([
    {
      id: 'weekly',
      name: 'Weekly VIP',
      duration: 7,
      price: 4.99,
      enabled: true,
      features: [
        '+50% Research Points from all sources',
        'Priority server access during peak times',
        'Exclusive VIP badge on profile',
        'Early access to new features'
      ]
    },
    {
      id: 'monthly',
      name: 'Monthly VIP',
      duration: 30,
      price: 14.99,
      enabled: true,
      features: [
        '+50% Research Points from all sources',
        'Priority server access during peak times',
        'Exclusive VIP badge on profile',
        'Early access to new features',
        '2 weeks free compared to weekly'
      ],
      savings: '16% savings vs weekly'
    },
    {
      id: 'yearly',
      name: 'Yearly VIP',
      duration: 365,
      price: 99.99,
      enabled: true,
      features: [
        '+50% Research Points from all sources',
        'Priority server access during peak times',
        'Exclusive VIP badge on profile',
        'Early access to new features',
        'Exclusive yearly subscriber perks',
        'Special discord role'
      ],
      savings: '62% savings vs weekly'
    }
  ]);

  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([]);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripePublicKey, setStripePublicKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');

  const [mrr, setMrr] = useState(0);
  const [arr, setArr] = useState(0);
  const [activeVipCount, setActiveVipCount] = useState(0);
  const [churnRate, setChurnRate] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const isAdmin = player?.isAdmin === true;

  useEffect(() => {
    if (!player) return;

    if (!isAdmin) {
      router.push('/game');
      return;
    }

    loadSubscriptionData();
  }, [player, router, isAdmin]);

  const loadSubscriptionData = async () => {
    setLoading(true);

    try {
      setActiveVipCount(0);
      setMrr(0);
      setArr(0);
      setChurnRate(0);
      setTotalRevenue(0);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageToggle = (packageId: string) => {
    setPackages(packages.map(pkg =>
      pkg.id === packageId ? { ...pkg, enabled: !pkg.enabled } : pkg
    ));
  };

  const handlePriceUpdate = (packageId: string, newPrice: number) => {
    setPackages(packages.map(pkg =>
      pkg.id === packageId ? { ...pkg, price: newPrice } : pkg
    ));
  };

  const handleStripeConnect = async () => {
    if (!stripePublicKey || !stripeSecretKey) {
      alert('Please provide both Stripe public and secret keys');
      return;
    }
    alert('Stripe integration coming soon! Keys would be saved securely.');
    setStripeConnected(true);
  };

  if (!player || !isAdmin) {
    return (
      <>
        <TopNavBar />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] text-white flex items-center justify-center">
              <p>Access Denied - Admin Only</p>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] text-white p-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-8 mt-4">
                <div>
                  <h1 className="text-4xl font-bold text-[--neon-pink]">💎 VIP Subscription Management</h1>
                  <p className="text-white/60 mt-2">Manage subscription packages, pricing, and revenue analytics</p>
                </div>
                <div className="bg-[--neon-pink]/10 px-4 py-2 rounded-lg border border-[--neon-pink]/20">
                  <p className="text-sm text-[--neon-pink]">Admin: {player.username}</p>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <p className="text-white/60">Loading subscription data...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-[--card] rounded-lg p-6 border-2 border-[--neon-pink]/20">
                    <h2 className="text-2xl font-bold text-[--neon-pink] mb-4">📊 Revenue Analytics</h2>
                    <div className="grid grid-cols-5 gap-4">
                      <div className="bg-[--synth]/15 border border-[--synth]/25 rounded-lg p-4 text-white">
                        <p className="text-xs opacity-80 mb-1">Monthly Recurring Revenue</p>
                        <p className="text-3xl font-bold">${mrr.toFixed(2)}</p>
                        <p className="text-xs opacity-80 mt-1">MRR</p>
                      </div>
                      <div className="bg-[--electric]/15 border border-[--electric]/25 rounded-lg p-4 text-white">
                        <p className="text-xs opacity-80 mb-1">Annual Recurring Revenue</p>
                        <p className="text-3xl font-bold">${arr.toFixed(2)}</p>
                        <p className="text-xs opacity-80 mt-1">ARR</p>
                      </div>
                      <div className="bg-[--neon-pink]/15 border border-[--neon-pink]/25 rounded-lg p-4 text-white">
                        <p className="text-xs opacity-80 mb-1">Active Subscribers</p>
                        <p className="text-3xl font-bold">{activeVipCount}</p>
                        <p className="text-xs opacity-80 mt-1">Current VIPs</p>
                      </div>
                      <div className="bg-[--neon-yellow]/15 border border-[--neon-yellow]/25 rounded-lg p-4 text-white">
                        <p className="text-xs opacity-80 mb-1">Total Revenue</p>
                        <p className="text-3xl font-bold">${totalRevenue.toFixed(2)}</p>
                        <p className="text-xs opacity-80 mt-1">All Time</p>
                      </div>
                      <div className="bg-[--neon-red]/15 border border-[--neon-red]/25 rounded-lg p-4 text-white">
                        <p className="text-xs opacity-80 mb-1">Churn Rate</p>
                        <p className="text-3xl font-bold">{(churnRate * 100).toFixed(1)}%</p>
                        <p className="text-xs opacity-80 mt-1">Last 30 Days</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
                    <h2 className="text-2xl font-bold text-[--electric] mb-4">🔌 Stripe Integration</h2>

                    {!stripeConnected ? (
                      <div className="space-y-4">
                        <div className="bg-[--neon-yellow]/10 border border-[--neon-yellow]/20 rounded-lg p-4">
                          <p className="text-[--neon-yellow] text-sm">
                            ⚠️ Stripe integration not configured. Connect your Stripe account to enable subscription sales.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm text-white/60">Stripe Publishable Key</label>
                            <input
                              type="text"
                              value={stripePublicKey}
                              onChange={(e) => setStripePublicKey(e.target.value)}
                              placeholder="pk_test_..."
                              className="w-full px-4 py-2 bg-[--void] border border-[--border] rounded text-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm text-white/60">Stripe Secret Key</label>
                            <input
                              type="password"
                              value={stripeSecretKey}
                              onChange={(e) => setStripeSecretKey(e.target.value)}
                              placeholder="sk_test_..."
                              className="w-full px-4 py-2 bg-[--void] border border-[--border] rounded text-white"
                            />
                          </div>
                        </div>

                        <button
                          onClick={handleStripeConnect}
                          className="bg-[--electric] hover:opacity-80 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                        >
                          🔗 Connect Stripe Account
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-[--synth]/10 border border-[--synth]/20 rounded-lg p-4">
                          <p className="text-[--synth] text-sm">
                            ✅ Stripe connected successfully! Subscription sales are enabled.
                          </p>
                        </div>

                        <div className="flex gap-4">
                          <button
                            onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                            className="bg-[--card] hover:opacity-80 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                          >
                            📊 View Stripe Dashboard
                          </button>
                          <button
                            onClick={() => setStripeConnected(false)}
                            className="bg-[--neon-red] hover:opacity-80 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                          >
                            🔌 Disconnect
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-[--card] rounded-lg p-6 border-2 border-[--neon-pink]/20">
                    <h2 className="text-2xl font-bold text-[--neon-pink] mb-4">📦 Subscription Packages</h2>

                    <div className="grid grid-cols-3 gap-6">
                      {packages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className={`bg-[--void] rounded-lg p-6 border-2 transition-all ${
                            pkg.enabled
                              ? 'border-[--neon-pink]/20'
                              : 'border-[--border] opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-[--neon-pink]">{pkg.name}</h3>
                            <button
                              onClick={() => handlePackageToggle(pkg.id)}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                pkg.enabled
                                  ? 'bg-[--synth] hover:opacity-80 text-white'
                                  : 'bg-[--card] hover:opacity-80 text-white/60'
                              }`}
                            >
                              {pkg.enabled ? '✓ Enabled' : '✗ Disabled'}
                            </button>
                          </div>

                          <div className="mb-4">
                            <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-bold text-white">${pkg.price}</span>
                              <span className="text-white/60">/ {pkg.duration} days</span>
                            </div>
                            {pkg.savings && (
                              <p className="text-[--synth] text-sm mt-1">{pkg.savings}</p>
                            )}
                          </div>

                          <div className="space-y-2 mb-4">
                            <p className="text-xs text-white/60 font-semibold">Features:</p>
                            {pkg.features.map((feature, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="text-[--neon-pink] text-xs mt-0.5">✓</span>
                                <span className="text-sm text-white/60">{feature}</span>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-2 pt-4 border-t border-[--border]">
                            <label className="text-xs text-white/60">Adjust Price (USD)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={pkg.price}
                              onChange={(e) => handlePriceUpdate(pkg.id, parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 bg-[--card] border border-[--border] rounded text-white text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[--card] rounded-lg p-6 border-2 border-[--neon-yellow]/20">
                    <h2 className="text-2xl font-bold text-[--neon-yellow] mb-4">👥 Active Subscriptions</h2>

                    {activeSubscriptions.length === 0 ? (
                      <div className="text-center py-8 text-white/60">
                        <p>No active subscriptions yet</p>
                        <p className="text-sm mt-2">Subscriptions will appear here once Stripe is connected and customers purchase VIP packages</p>
                      </div>
                    ) : (
                      <div className="bg-[--void] rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-[--card]">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Username</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Package</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Started</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Expires</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Auto-Renew</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[--border]">
                            {activeSubscriptions.map((sub, idx) => (
                              <tr key={idx} className="hover:bg-[--card]/50">
                                <td className="px-4 py-3 text-white font-medium">{sub.username}</td>
                                <td className="px-4 py-3 text-[--neon-pink]">{sub.packageId}</td>
                                <td className="px-4 py-3 text-white/60 text-sm">
                                  {new Date(sub.startDate).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-white/60 text-sm">
                                  {new Date(sub.expiresAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                  {sub.autoRenew ? (
                                    <span className="text-[--synth] text-xs">✓ Yes</span>
                                  ) : (
                                    <span className="text-white/60 text-xs">✗ No</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <button className="text-[--electric] hover:opacity-80 text-sm">
                                    View Details
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
                    <h2 className="text-2xl font-bold text-[--electric] mb-4">🔔 Webhook Configuration</h2>

                    <div className="space-y-4">
                      <div className="bg-[--void] rounded-lg p-4">
                        <p className="text-sm text-white/60 mb-2">Webhook Endpoint URL:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value="https://yourdomain.com/api/webhooks/stripe"
                            readOnly
                            className="flex-1 px-4 py-2 bg-[--card] border border-[--border] rounded text-white text-sm"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText('https://yourdomain.com/api/webhooks/stripe');
                              alert('Webhook URL copied to clipboard!');
                            }}
                            className="bg-[--card] hover:opacity-80 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>

                      <div className="bg-[--electric]/10 border border-[--electric]/20 rounded-lg p-4">
                        <p className="text-[--electric] text-sm font-semibold mb-2">Webhook Setup Instructions:</p>
                        <ol className="text-sm text-white/60 space-y-1 list-decimal list-inside">
                          <li>Go to Stripe Dashboard → Developers → Webhooks</li>
                          <li>Click "Add endpoint" and paste the URL above</li>
                          <li>Select events: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted</li>
                          <li>Copy the signing secret and add it to your environment variables</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      />
    </>
  );
}
