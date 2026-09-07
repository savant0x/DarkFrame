/**
 * @file app/admin/vip/page.tsx
 * @created 2025-10-22
 * @overview VIP Subscription Package Management Page
 * 
 * OVERVIEW:
 * Admin page for managing VIP subscription packages, pricing, and sales.
 * Includes package configuration, Stripe integration preparation, and subscription analytics.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { showSuccess, showInfo } from '@/lib/toastService';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import BackButton from '@/components/BackButton';

interface SubscriptionPackage {
  id: string;
  name: string;
  duration: number; // days
  price: number; // USD
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
  
  // Package state
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
  
  // Analytics state
  const [mrr, setMrr] = useState(0); // Monthly Recurring Revenue
  const [arr, setArr] = useState(0); // Annual Recurring Revenue
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

    // Load subscription data
    loadSubscriptionData();
  }, [player, router, isAdmin]);

  const loadSubscriptionData = async () => {
    setLoading(true);
    
    try {
      // Real data (FID-20260904-005 §5.3): players VIP rows + paymentTransactions analytics
      const res = await fetch('/api/admin/vip/subscriptions');
      const data = await res.json();
      if (data.success) {
        setActiveSubscriptions(data.subscriptions);
        setMrr(data.analytics.mrr);
        setArr(data.analytics.arr);
        setActiveVipCount(data.analytics.activeCount);
        setChurnRate(data.analytics.churnRate);
        setTotalRevenue(data.analytics.mrr);
      } else {
        console.error('Failed to load subscription data:', data.message);
      }
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
    // TODO: Save to API
  };

  const handlePriceUpdate = (packageId: string, newPrice: number) => {
    setPackages(packages.map(pkg => 
      pkg.id === packageId ? { ...pkg, price: newPrice } : pkg
    ));
    // TODO: Save to API
  };

  const handleStripeConnect = async () => {
    if (!stripePublicKey || !stripeSecretKey) {
      showInfo('Please provide both Stripe public and secret keys');
      return;
    }
    
    // TODO: Implement Stripe connection
    showSuccess('Stripe integration coming soon! Keys would be saved securely.');
    setStripeConnected(true);
  };

  if (!player || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-[color:var(--nn-text-primary)] flex items-center justify-center">
        <p>Access Denied - Admin Only</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-[color:var(--nn-text-primary)] p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton />

        <div className="flex items-center justify-between mb-8 mt-4">
          <div>
            <h1 className="text-4xl font-bold text-[color:var(--nn-violet)]">💎 VIP Subscription Management</h1>
            <p className="text-[color:var(--nn-text-secondary)] mt-2">Manage subscription packages, pricing, and revenue analytics</p>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] px-4 py-2 rounded-none border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
            <p className="text-sm text-[color:var(--nn-violet)]">Admin: {player.username}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-[color:var(--nn-text-secondary)]">Loading subscription data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Revenue Analytics */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
              <h2 className="text-2xl font-bold text-[color:var(--nn-violet)] mb-4">📊 Revenue Analytics</h2>
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-[color:var(--nn-green)] to-[color:var(--nn-green)] rounded-none p-4 text-[color:var(--nn-text-primary)]">
                  <p className="text-xs opacity-80 mb-1">Monthly Recurring Revenue</p>
                  <p className="text-3xl font-bold">${mrr.toFixed(2)}</p>
                  <p className="text-xs opacity-80 mt-1">MRR</p>
                </div>
                <div className="bg-gradient-to-br from-[color:var(--nn-cyan)] to-[color:var(--nn-cyan)] rounded-none p-4 text-[color:var(--nn-text-primary)]">
                  <p className="text-xs opacity-80 mb-1">Annual Recurring Revenue</p>
                  <p className="text-3xl font-bold">${arr.toFixed(2)}</p>
                  <p className="text-xs opacity-80 mt-1">ARR</p>
                </div>
                <div className="bg-gradient-to-br from-[color:var(--nn-violet)] to-[color:var(--nn-magenta)] rounded-none p-4 text-[color:var(--nn-text-primary)]">
                  <p className="text-xs opacity-80 mb-1">Active Subscribers</p>
                  <p className="text-3xl font-bold">{activeVipCount}</p>
                  <p className="text-xs opacity-80 mt-1">Current VIPs</p>
                </div>
                <div className="bg-gradient-to-br from-[color:var(--nn-amber)] to-[color:var(--nn-amber)] rounded-none p-4 text-[color:var(--nn-text-primary)]">
                  <p className="text-xs opacity-80 mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold">${totalRevenue.toFixed(2)}</p>
                  <p className="text-xs opacity-80 mt-1">All Time</p>
                </div>
                <div className="bg-gradient-to-br from-[color:var(--nn-magenta)] to-[color:var(--nn-magenta)] rounded-none p-4 text-[color:var(--nn-text-primary)]">
                  <p className="text-xs opacity-80 mb-1">Churn Rate</p>
                  <p className="text-3xl font-bold">{(churnRate * 100).toFixed(1)}%</p>
                  <p className="text-xs opacity-80 mt-1">Last 30 Days</p>
                </div>
              </div>
            </div>

            {/* Stripe Integration */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
              <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)] mb-4">🔌 Stripe Integration</h2>
              
              {!stripeConnected ? (
                <div className="space-y-4">
                  <div className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-4">
                    <p className="text-[color:var(--nn-amber)] text-sm">
                      ⚠️ Stripe integration not configured. Connect your Stripe account to enable subscription sales.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-[color:var(--nn-text-secondary)]">Stripe Publishable Key</label>
                      <input
                        type="text"
                        value={stripePublicKey}
                        onChange={(e) => setStripePublicKey(e.target.value)}
                        placeholder="pk_test_..."
                        className="w-full px-4 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-[color:var(--nn-text-secondary)]">Stripe Secret Key</label>
                      <input
                        type="password"
                        value={stripeSecretKey}
                        onChange={(e) => setStripeSecretKey(e.target.value)}
                        placeholder="sk_test_..."
                        className="w-full px-4 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)]"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleStripeConnect}
                    className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] px-6 py-3 rounded-none font-semibold transition-colors"
                  >
                    🔗 Connect Stripe Account
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-4">
                    <p className="text-[color:var(--nn-green)] text-sm">
                      ✅ Stripe connected successfully! Subscription sales are enabled.
                    </p>
                  </div>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                      className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold transition-colors"
                    >
                      📊 View Stripe Dashboard
                    </button>
                    <button
                      onClick={() => setStripeConnected(false)}
                      className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold transition-colors"
                    >
                      🔌 Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Subscription Packages */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
              <h2 className="text-2xl font-bold text-[color:var(--nn-violet)] mb-4">📦 Subscription Packages</h2>
              
              <div className="grid grid-cols-3 gap-6">
                {packages.map((pkg) => (
                  <div 
                    key={pkg.id}
                    className={`bg-[color:var(--nn-void)] rounded-none p-6 border-2 transition-all ${
                      pkg.enabled 
                        ? 'border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]' 
                        : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-[color:var(--nn-violet)]">{pkg.name}</h3>
                      <button
                        onClick={() => handlePackageToggle(pkg.id)}
                        className={`px-3 py-1 rounded-none text-xs font-semibold transition-colors ${
                          pkg.enabled
                            ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                            : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-secondary)]'
                        }`}
                      >
                        {pkg.enabled ? '✓ Enabled' : '✗ Disabled'}
                      </button>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-[color:var(--nn-text-primary)]">${pkg.price}</span>
                        <span className="text-[color:var(--nn-text-secondary)]">/ {pkg.duration} days</span>
                      </div>
                      {pkg.savings && (
                        <p className="text-[color:var(--nn-green)] text-sm mt-1">{pkg.savings}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <p className="text-xs text-[color:var(--nn-text-secondary)] font-semibold">Features:</p>
                      {pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-[color:var(--nn-violet)] text-xs mt-0.5">✓</span>
                          <span className="text-sm text-[color:var(--nn-text-secondary)]">{feature}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-2 pt-4 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                      <label className="text-xs text-[color:var(--nn-text-secondary)]">Adjust Price (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pkg.price}
                        onChange={(e) => handlePriceUpdate(pkg.id, parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Subscriptions */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]">
              <h2 className="text-2xl font-bold text-[color:var(--nn-amber)] mb-4">👥 Active Subscriptions</h2>
              
              {activeSubscriptions.length === 0 ? (
                <div className="text-center py-8 text-[color:var(--nn-text-secondary)]">
                  <p>No active subscriptions yet</p>
                  <p className="text-sm mt-2">Subscriptions will appear here once Stripe is connected and customers purchase VIP packages</p>
                </div>
              ) : (
                <div className="bg-[color:var(--nn-void)] rounded-none overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--nn-text-secondary)] uppercase">Username</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--nn-text-secondary)] uppercase">Package</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--nn-text-secondary)] uppercase">Started</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--nn-text-secondary)] uppercase">Expires</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--nn-text-secondary)] uppercase">Auto-Renew</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--nn-text-secondary)] uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                      {activeSubscriptions.map((sub, idx) => (
                        <tr key={idx} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]">
                          <td className="px-4 py-3 text-[color:var(--nn-text-primary)] font-medium">{sub.username}</td>
                          <td className="px-4 py-3 text-[color:var(--nn-violet)]">{sub.packageId}</td>
                          <td className="px-4 py-3 text-[color:var(--nn-text-secondary)] text-sm">
                            {new Date(sub.startDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-[color:var(--nn-text-secondary)] text-sm">
                            {new Date(sub.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {sub.autoRenew ? (
                              <span className="text-[color:var(--nn-green)] text-xs">✓ Yes</span>
                            ) : (
                              <span className="text-[color:var(--nn-text-secondary)] text-xs">✗ No</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-[color:var(--nn-cyan)] text-sm">
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

            {/* Webhook Configuration */}
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
              <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)] mb-4">🔔 Webhook Configuration</h2>
              
              <div className="space-y-4">
                <div className="bg-[color:var(--nn-void)] rounded-none p-4">
                  <p className="text-sm text-[color:var(--nn-text-secondary)] mb-2">Webhook Endpoint URL:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value="https://yourdomain.com/api/webhooks/stripe"
                      readOnly
                      className="flex-1 px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('https://yourdomain.com/api/webhooks/stripe');
                        showInfo('Webhook URL copied to clipboard!');
                      }}
                      className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold transition-colors"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                
                <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
                  <p className="text-[color:var(--nn-cyan)] text-sm font-semibold mb-2">Webhook Setup Instructions:</p>
                  <ol className="text-sm text-[color:var(--nn-text-secondary)] space-y-1 list-decimal list-inside">
                    <li>Go to Stripe Dashboard → Developers → Webhooks</li>
                    <li>Click &quot;Add endpoint&quot; and paste the URL above</li>
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
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Stripe integration is scaffolded but not yet implemented
// - Package pricing can be adjusted but changes are not persisted
// - Revenue analytics are placeholder values
// - Webhook configuration URL needs to be updated with actual domain
// - Future: Implement /api/admin/vip/subscriptions endpoint
// - Future: Add Stripe SDK integration for payment processing
// - Future: Add subscription lifecycle management (pause, cancel, refund)
// ============================================================
