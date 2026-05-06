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
      // TODO: Implement API endpoints when Stripe integration is ready
      // const res = await fetch('/api/admin/vip/subscriptions');
      // const data = await res.json();
      // if (data.success) {
      //   setActiveSubscriptions(data.subscriptions);
      //   setMrr(data.analytics.mrr);
      //   setArr(data.analytics.arr);
      //   setActiveVipCount(data.analytics.activeCount);
      //   setChurnRate(data.analytics.churnRate);
      // }
      
      // Placeholder data
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
      alert('Please provide both Stripe public and secret keys');
      return;
    }
    
    // TODO: Implement Stripe connection
    alert('Stripe integration coming soon! Keys would be saved securely.');
    setStripeConnected(true);
  };

  if (!player || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
        <p>Access Denied - Admin Only</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <BackButton />

        <div className="flex items-center justify-between mb-8 mt-4">
          <div>
            <h1 className="text-4xl font-bold text-purple-400">💎 VIP Subscription Management</h1>
            <p className="text-gray-400 mt-2">Manage subscription packages, pricing, and revenue analytics</p>
          </div>
          <div className="bg-purple-900/30 px-4 py-2 rounded-lg border border-purple-500">
            <p className="text-sm text-purple-300">Admin: {player.username}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading subscription data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Revenue Analytics */}
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-purple-500/30">
              <h2 className="text-2xl font-bold text-purple-400 mb-4">📊 Revenue Analytics</h2>
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg p-4 text-white">
                  <p className="text-xs opacity-80 mb-1">Monthly Recurring Revenue</p>
                  <p className="text-3xl font-bold">${mrr.toFixed(2)}</p>
                  <p className="text-xs opacity-80 mt-1">MRR</p>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg p-4 text-white">
                  <p className="text-xs opacity-80 mb-1">Annual Recurring Revenue</p>
                  <p className="text-3xl font-bold">${arr.toFixed(2)}</p>
                  <p className="text-xs opacity-80 mt-1">ARR</p>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg p-4 text-white">
                  <p className="text-xs opacity-80 mb-1">Active Subscribers</p>
                  <p className="text-3xl font-bold">{activeVipCount}</p>
                  <p className="text-xs opacity-80 mt-1">Current VIPs</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-lg p-4 text-white">
                  <p className="text-xs opacity-80 mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold">${totalRevenue.toFixed(2)}</p>
                  <p className="text-xs opacity-80 mt-1">All Time</p>
                </div>
                <div className="bg-gradient-to-br from-red-600 to-pink-600 rounded-lg p-4 text-white">
                  <p className="text-xs opacity-80 mb-1">Churn Rate</p>
                  <p className="text-3xl font-bold">{(churnRate * 100).toFixed(1)}%</p>
                  <p className="text-xs opacity-80 mt-1">Last 30 Days</p>
                </div>
              </div>
            </div>

            {/* Stripe Integration */}
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-blue-500/30">
              <h2 className="text-2xl font-bold text-blue-400 mb-4">🔌 Stripe Integration</h2>
              
              {!stripeConnected ? (
                <div className="space-y-4">
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-300 text-sm">
                      ⚠️ Stripe integration not configured. Connect your Stripe account to enable subscription sales.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">Stripe Publishable Key</label>
                      <input
                        type="text"
                        value={stripePublicKey}
                        onChange={(e) => setStripePublicKey(e.target.value)}
                        placeholder="pk_test_..."
                        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">Stripe Secret Key</label>
                      <input
                        type="password"
                        value={stripeSecretKey}
                        onChange={(e) => setStripeSecretKey(e.target.value)}
                        placeholder="sk_test_..."
                        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded text-white"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleStripeConnect}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    🔗 Connect Stripe Account
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-300 text-sm">
                      ✅ Stripe connected successfully! Subscription sales are enabled.
                    </p>
                  </div>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                    >
                      📊 View Stripe Dashboard
                    </button>
                    <button
                      onClick={() => setStripeConnected(false)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                    >
                      🔌 Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Subscription Packages */}
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-purple-500/30">
              <h2 className="text-2xl font-bold text-purple-400 mb-4">📦 Subscription Packages</h2>
              
              <div className="grid grid-cols-3 gap-6">
                {packages.map((pkg) => (
                  <div 
                    key={pkg.id}
                    className={`bg-gray-900 rounded-lg p-6 border-2 transition-all ${
                      pkg.enabled 
                        ? 'border-purple-500/50' 
                        : 'border-gray-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-purple-300">{pkg.name}</h3>
                      <button
                        onClick={() => handlePackageToggle(pkg.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          pkg.enabled
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                      >
                        {pkg.enabled ? '✓ Enabled' : '✗ Disabled'}
                      </button>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-white">${pkg.price}</span>
                        <span className="text-gray-400">/ {pkg.duration} days</span>
                      </div>
                      {pkg.savings && (
                        <p className="text-green-400 text-sm mt-1">{pkg.savings}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <p className="text-xs text-gray-400 font-semibold">Features:</p>
                      {pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-purple-400 text-xs mt-0.5">✓</span>
                          <span className="text-sm text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-2 pt-4 border-t border-gray-700">
                      <label className="text-xs text-gray-400">Adjust Price (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pkg.price}
                        onChange={(e) => handlePriceUpdate(pkg.id, parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Subscriptions */}
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-yellow-500/30">
              <h2 className="text-2xl font-bold text-yellow-400 mb-4">👥 Active Subscriptions</h2>
              
              {activeSubscriptions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No active subscriptions yet</p>
                  <p className="text-sm mt-2">Subscriptions will appear here once Stripe is connected and customers purchase VIP packages</p>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Username</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Package</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Started</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Expires</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Auto-Renew</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {activeSubscriptions.map((sub, idx) => (
                        <tr key={idx} className="hover:bg-gray-800/50">
                          <td className="px-4 py-3 text-white font-medium">{sub.username}</td>
                          <td className="px-4 py-3 text-purple-400">{sub.packageId}</td>
                          <td className="px-4 py-3 text-gray-400 text-sm">
                            {new Date(sub.startDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-sm">
                            {new Date(sub.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {sub.autoRenew ? (
                              <span className="text-green-400 text-xs">✓ Yes</span>
                            ) : (
                              <span className="text-gray-400 text-xs">✗ No</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-blue-400 hover:text-blue-300 text-sm">
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
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-cyan-500/30">
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">🔔 Webhook Configuration</h2>
              
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Webhook Endpoint URL:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value="https://yourdomain.com/api/webhooks/stripe"
                      readOnly
                      className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('https://yourdomain.com/api/webhooks/stripe');
                        alert('Webhook URL copied to clipboard!');
                      }}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-300 text-sm font-semibold mb-2">Webhook Setup Instructions:</p>
                  <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
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
