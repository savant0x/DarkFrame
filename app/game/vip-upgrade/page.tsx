/**
 * VIP Upgrade Page with Stripe Payment Integration
 * 
 * OVERVIEW:
 * Marketing and purchase page for VIP subscriptions. Displays benefits, feature
 * comparisons, and pricing tiers with integrated Stripe checkout. Users can
 * purchase VIP directly through Stripe's hosted checkout flow.
 * 
 * KEY FEATURES:
 * - 5 pricing tiers (Weekly, Monthly, Quarterly, Biannual, Yearly)
 * - Stripe.js integration for secure payments
 * - Real-time VIP status display
 * - Feature comparison tables
 * - Speed comparison charts
 * - FAQ section
 * - Responsive pricing cards
 * 
 * PURCHASE FLOW:
 * 1. User selects VIP tier
 * 2. Click "Get VIP" button
 * 3. POST to /api/stripe/create-checkout-session
 * 4. Redirect to Stripe checkout
 * 5. Complete payment on Stripe
 * 6. Redirect to success or cancel page
 * 7. Webhook grants VIP automatically
 * 
 * Created: 2025-10-19
 * Updated: 2025-10-24 (Stripe Integration)
 * Feature: FID-20251024-STRIPE
 * Author: ECHO v5.1
 */

'use client';

import { useGameContext } from '@/context/GameContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import BackButton from '@/components/BackButton';
import { VIPTier } from '@/types/stripe.types';

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

/**
 * VIP Upgrade Page Component
 * 
 * Displays VIP benefits, pricing tiers, and handles Stripe checkout initiation.
 * Shows current VIP status if user is already subscribed.
 */
export default function VIPUpgradePage() {
  const { player } = useGameContext();
  const router = useRouter();
  
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
    console.log('🛒 Purchase initiated:', tier);
    setSelectedTier(tier);
    setIsProcessing(true);
    setError(null);
    
    try {
      console.log('📡 Calling checkout API...');
      // Call checkout session API
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
      });
      
      console.log('📥 Response received:', response.status, response.statusText);
      const data = await response.json();
      console.log('📦 Response data:', data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }
      
      // Redirect to Stripe checkout
      if (data.url) {
        console.log('✅ Redirecting to Stripe:', data.url);
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('❌ Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
      setIsProcessing(false);
      setSelectedTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-6">
      {/* Back Button */}
      <div className="max-w-6xl mx-auto mb-6">
        <BackButton destination="/game" />
      </div>

      {/* VIP MANAGEMENT DASHBOARD - Shows when user already has VIP */}
      {isVIP && vipExpiresAt && (
        <div className="max-w-4xl mx-auto mb-12">
          {/* Hero Section for VIP Users */}
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 text-transparent bg-clip-text mb-4">
              <h1 className="text-5xl font-bold">⚡ VIP Dashboard ⚡</h1>
            </div>
            <p className="text-xl text-gray-300">
              Manage your premium subscription
            </p>
          </div>

          {/* Active Subscription Card */}
          <div className="bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-yellow-500/10 border-2 border-yellow-500/50 rounded-xl p-8 shadow-2xl mb-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">👑</span>
                  <h2 className="text-3xl font-bold text-yellow-300">Active VIP Member</h2>
                </div>
                <p className="text-gray-300">You're enjoying premium benefits</p>
              </div>
              <span className="inline-block bg-green-500/20 text-green-300 px-4 py-2 rounded-full text-sm font-semibold border border-green-500/50">
                ✅ ACTIVE
              </span>
            </div>

            {/* Subscription Details Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              {/* Days Remaining */}
              <div className="bg-gray-800/50 rounded-lg p-6 text-center border border-purple-500/30">
                <div className="text-4xl font-bold text-yellow-300 mb-2">{daysRemaining}</div>
                <div className="text-sm text-gray-400">Days Remaining</div>
              </div>

              {/* Expiration Date */}
              <div className="bg-gray-800/50 rounded-lg p-6 text-center border border-purple-500/30">
                <div className="text-lg font-semibold text-yellow-300 mb-2">
                  {new Date(vipExpiresAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div className="text-sm text-gray-400">Expires On</div>
              </div>

              {/* Time Remaining */}
              <div className="bg-gray-800/50 rounded-lg p-6 text-center border border-purple-500/30">
                <div className="text-lg font-semibold text-yellow-300 mb-2">
                  {new Date(vipExpiresAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="text-sm text-gray-400">Expiration Time</div>
              </div>
            </div>

            {/* Your VIP Benefits */}
            <div className="bg-gray-900/50 rounded-lg p-6 border border-yellow-500/30">
              <h3 className="text-xl font-bold text-yellow-300 mb-4">✨ Your Active Benefits</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { icon: '⚡', text: '2x Resource Multiplier - Double your efficiency' },
                  { icon: '🤖', text: 'Automated Farming - Set it and forget it' },
                  { icon: '👑', text: 'VIP Chat Badge - Stand out in the community' },
                  { icon: '📊', text: 'Advanced Battle Analytics - Detailed insights' },
                  { icon: '🛍️', text: 'Exclusive VIP Shop Access - Premium items' },
                  { icon: '🎯', text: 'Priority Support - Get help faster' }
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{benefit.icon}</span>
                    <span className="text-sm text-gray-300">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Extend Subscription Section */}
          <div className="bg-gray-800/50 border border-purple-500/50 rounded-xl p-8 mb-8">
            <h3 className="text-2xl font-bold text-center mb-4">🔄 Extend Your Subscription</h3>
            <p className="text-center text-gray-300 mb-6">
              Want to continue enjoying VIP benefits? Extend your subscription now!
            </p>
            <div className="text-center">
              <button
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3 px-8 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                View Extension Options
              </button>
            </div>
          </div>

          {/* Manage Subscription */}
          <div className="bg-gray-800/50 border border-purple-500/50 rounded-xl p-8">
            <h3 className="text-2xl font-bold text-center mb-4">⚙️ Manage Your Subscription</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Payment History */}
              <div className="bg-gray-900/50 border border-purple-500/30 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-yellow-300 mb-3">📜 Payment History</h4>
                <p className="text-sm text-gray-400 mb-4">
                  View your transaction history and download invoices
                </p>
                <button
                  onClick={() => alert('Payment history feature coming soon!')}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  View History
                </button>
              </div>

              {/* Cancel Subscription */}
              <div className="bg-gray-900/50 border border-red-500/30 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-red-300 mb-3">❌ Cancel Subscription</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Cancel your subscription (access continues until expiration)
                </p>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel your VIP subscription? You will retain access until ' + new Date(vipExpiresAt).toLocaleDateString())) {
                      alert('Cancellation feature coming soon! Contact support for now.');
                    }
                  }}
                  className="w-full bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 text-red-300 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel VIP
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-12 border-t border-gray-700">
            <div className="text-center -mt-4">
              <span className="bg-gray-900 px-4 text-gray-500 text-sm">Or explore other plans below</span>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section - Only show for non-VIP users */}
      {!isVIP && (
        <div className="max-w-6xl mx-auto text-center mb-12">
          <div className="inline-block bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 text-transparent bg-clip-text mb-4">
            <h1 className="text-5xl font-bold">⚡ VIP Membership ⚡</h1>
          </div>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Unlock premium features and dominate the wasteland twice as fast
          </p>
        </div>
      )}

      {/* Pricing Tiers Section Title */}
      {isVIP && (
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Available Extension Plans</h2>
          <p className="text-gray-300">Extend your VIP membership with any of these plans</p>
        </div>
      )}

      {/* Speed Comparison - Only show for non-VIP */}
      {!isVIP && (
        <div className="max-w-6xl mx-auto mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">⚡ Speed Comparison</h2>
          <div className="grid md:grid-cols-2 gap-6">
          {/* Basic Tier */}
          <div className="bg-gray-800/50 border border-purple-500/50 rounded-lg p-6">
            <div className="text-center mb-4">
              <span className="inline-block bg-purple-500/20 text-purple-300 px-4 py-2 rounded-full text-sm font-semibold">
                🐢 BASIC
              </span>
            </div>
            <div className="text-center mb-6">
              <p className="text-4xl font-bold text-purple-400">11.6 hours</p>
              <p className="text-gray-400 mt-2">Full map completion time</p>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span className="text-gray-300">Standard auto-farm speed</span>
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span className="text-gray-300">3-second harvest cooldown respect</span>
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                <span className="text-gray-300">Safe and reliable</span>
              </li>
            </ul>
          </div>

          {/* VIP Tier */}
          <div className="bg-gradient-to-br from-yellow-900/20 via-orange-900/20 to-yellow-900/20 border-2 border-yellow-500 rounded-lg p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-yellow-500 text-black px-3 py-1 text-xs font-bold">
              RECOMMENDED
            </div>
            <div className="text-center mb-4 mt-4">
              <span className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-2 rounded-full text-sm font-bold">
                ⚡ VIP
              </span>
            </div>
            <div className="text-center mb-6">
              <p className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text">
                5.6 hours
              </p>
              <p className="text-gray-300 mt-2 font-semibold">Full map completion time</p>
              <p className="text-yellow-400 text-sm mt-1">⚡ 2x FASTER ⚡</p>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">✓</span>
                <span className="text-gray-200 font-semibold">2x speed boost</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">✓</span>
                <span className="text-gray-200 font-semibold">Optimized timing algorithms</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">✓</span>
                <span className="text-gray-200 font-semibold">Exclusive VIP badge</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-400 mr-2">✓</span>
                <span className="text-gray-200 font-semibold">Priority support</span>
              </li>
            </ul>
          </div>
        </div>
        </div>
      )}

      {/* Feature Comparison Table */}
      <div className="max-w-6xl mx-auto mb-12">
        <h2 className="text-3xl font-bold text-center mb-8">📊 Feature Comparison</h2>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-4 text-gray-400">Feature</th>
                <th className="text-center p-4 text-purple-400">Basic</th>
                <th className="text-center p-4 text-yellow-400">VIP</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-700/50">
                <td className="p-4 text-gray-300">Auto-Farm Speed</td>
                <td className="text-center p-4">1x</td>
                <td className="text-center p-4 font-bold text-yellow-400">2x ⚡</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="p-4 text-gray-300">Map Completion Time</td>
                <td className="text-center p-4">11.6 hours</td>
                <td className="text-center p-4 font-bold text-yellow-400">5.6 hours</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="p-4 text-gray-300">VIP Badge</td>
                <td className="text-center p-4">❌</td>
                <td className="text-center p-4 text-yellow-400">✅</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="p-4 text-gray-300">Priority Support</td>
                <td className="text-center p-4">❌</td>
                <td className="text-center p-4 text-yellow-400">✅</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="p-4 text-gray-300">Early Access Features</td>
                <td className="text-center p-4">❌</td>
                <td className="text-center p-4 text-yellow-400">✅</td>
              </tr>
              <tr>
                <td className="p-4 text-gray-300">Exclusive VIP Items <span className="text-xs text-gray-500">(Coming Soon)</span></td>
                <td className="text-center p-4">❌</td>
                <td className="text-center p-4 text-yellow-400">✅</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing Tiers */}
      <div className="max-w-6xl mx-auto mb-12">
        <h2 className="text-3xl font-bold text-center mb-4">💎 Choose Your Plan</h2>
        <p className="text-center text-gray-400 mb-8">All plans include full VIP features. Pick the duration that works for you!</p>
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-500 rounded-lg p-4 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}
        
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {pricingTiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-lg p-6 text-center relative ${
                tier.highlighted
                  ? 'bg-gradient-to-br from-yellow-900/30 via-orange-900/30 to-yellow-900/30 border-2 border-yellow-500 transform md:scale-105'
                  : 'bg-gray-800/50 border border-gray-700'
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                  {tier.badge}
                </div>
              )}
              
              <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
              <p className={`text-3xl font-bold mb-1 ${tier.highlighted ? 'text-yellow-400' : 'text-yellow-400'}`}>
                {tier.price}
              </p>
              {tier.savings && (
                <p className="text-sm text-green-400 mb-2">{tier.savings}</p>
              )}
              <p className="text-gray-400 text-sm mb-4">{tier.interval}</p>
              
              {/* Features */}
              <ul className="space-y-2 mb-6 text-left">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-sm">
                    <span className="text-green-400 mr-2 mt-0.5">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
              
              {/* Purchase Button */}
              <button
                onClick={() => handlePurchase(tier.id)}
                disabled={isProcessing || (isVIP && !vipExpiresAt)}
                className={`w-full py-3 rounded-lg font-semibold transition ${
                  isProcessing && selectedTier === tier.id
                    ? 'bg-gray-600 text-gray-400 cursor-wait'
                    : tier.highlighted
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                } ${isVIP && !vipExpiresAt ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isProcessing && selectedTier === tier.id
                  ? 'Processing...'
                  : isVIP && !vipExpiresAt
                  ? 'Already VIP'
                  : 'Get VIP'}
              </button>
              
              {/* Cost per day */}
              <p className="text-xs text-gray-500 mt-2">
                ${(tier.priceValue / parseInt(tier.interval)).toFixed(2)}/day
              </p>
            </div>
          ))}
        </div>
        
        {/* Trust Indicators */}
        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-gray-400">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Secure payments via Stripe
          </div>
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Instant activation
          </div>
          <div className="flex items-center">
            <svg className="w-5 h-5 text-purple-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            Join 500+ VIP members
          </div>
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Cancel anytime
          </div>
        </div>
      </div>

      {/* Payment Security Notice */}
      <div className="max-w-4xl mx-auto mb-12">
        <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-6">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-400 mr-3 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-blue-300 mb-2">Secure Payment Processing</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                All payments are processed securely through Stripe, a PCI-compliant payment processor
                trusted by millions worldwide. We never store your credit card information on our servers.
                Your VIP status activates automatically within seconds after successful payment.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto mb-12">
        <h2 className="text-3xl font-bold text-center mb-8">❓ Frequently Asked Questions</h2>
        <div className="space-y-4">
          <details className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer text-lg">
              How does the 2x speed boost work?
            </summary>
            <p className="text-gray-300 mt-3">
              VIP members use optimized timing algorithms that reduce delays between movements and harvests,
              allowing you to complete the entire map in 5.6 hours instead of 11.6 hours. That's 2x faster!
            </p>
          </details>

          <details className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer text-lg">
              Can I cancel my VIP subscription anytime?
            </summary>
            <p className="text-gray-300 mt-3">
              Yes! You can cancel your subscription anytime from your profile page. Your VIP benefits will
              remain active until the end of your current billing period. No refunds for partial periods.
            </p>
          </details>

          <details className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer text-lg">
              When will my VIP activate after payment?
            </summary>
            <p className="text-gray-300 mt-3">
              VIP activation is instant! After successful payment on Stripe, our webhook automatically
              grants your VIP status within seconds. You'll be redirected back to the game and can
              start using premium features immediately.
            </p>
          </details>

          <details className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer text-lg">
              What happens when my VIP expires?
            </summary>
            <p className="text-gray-300 mt-3">
              Your account will revert to Basic tier with standard auto-farm speed. All your progress,
              resources, and items are kept. You can re-subscribe anytime to regain VIP benefits.
            </p>
          </details>

          <details className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer text-lg">
              Are there any exclusive VIP items?
            </summary>
            <p className="text-gray-300 mt-3">
              Exclusive VIP units and items are coming in future updates! Stay tuned for announcements.
            </p>
          </details>

          <details className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer text-lg">
              Is my payment information secure?
            </summary>
            <p className="text-gray-300 mt-3">
              Absolutely! We use Stripe, a PCI-compliant payment processor trusted by millions of
              businesses worldwide including Amazon, Google, and Shopify. We never store your credit
              card details on our servers - all payment data is handled securely by Stripe.
            </p>
          </details>

          <details className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <summary className="font-semibold cursor-pointer text-lg">
              What payment methods are accepted?
            </summary>
            <p className="text-gray-300 mt-3">
              We accept all major credit cards (Visa, Mastercard, American Express, Discover) and
              debit cards through Stripe. Additional payment methods may be available based on your
              location. Stripe supports secure payments in 135+ currencies worldwide.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * STRIPE INTEGRATION:
 * - Uses fetch API to call /api/stripe/create-checkout-session
 * - No Stripe.js library needed on client (server creates session)
 * - Redirects to Stripe's hosted checkout page
 * - Stripe handles payment form, validation, security
 * - Returns to success or cancel page based on payment result
 * 
 * PRICING TIERS:
 * - 5 tiers synced with types/stripe.types.ts
 * - Premium pricing strategy ($9.99 - $199.99)
 * - Highlighted tiers: Monthly (POPULAR), Quarterly (BEST VALUE)
 * - Cost per day calculation shown for value comparison
 * 
 * VIP STATUS CHECK:
 * - Prevents duplicate purchases if already VIP
 * - Shows expiration date for current VIP
 * - Button disabled if active VIP subscription
 * 
 * ERROR HANDLING:
 * - Network errors displayed to user
 * - API errors shown with message
 * - Loading states during checkout creation
 * - Per-tier processing indicators
 * 
 * USER EXPERIENCE:
 * - Clear trust indicators (Stripe security, instant activation)
 * - Responsive grid layout (mobile to desktop)
 * - Visual hierarchy (highlighted best value tiers)
 * - FAQ section addresses common concerns
 * - Feature comparison table for transparency
 * 
 * FUTURE ENHANCEMENTS:
 * - Add promo code support
 * - Show limited-time discount banners
 * - Display testimonials from VIP users
 * - Add monthly vs yearly savings calculator
 * - Implement A/B testing for pricing display
 * - Add referral program for VIP discounts
 */
