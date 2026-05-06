/**
 * @file app/referrals/page.tsx
 * @created 2025-10-24
 * @overview Main referral system page with tabbed interface
 * 
 * OVERVIEW:
 * Central hub for the referral system featuring:
 * - Dashboard tab: Manage referral code, track stats, view rewards
 * - Leaderboard tab: See top recruiters and your rank
 * - How It Works tab: Tutorial and FAQ
 * 
 * Protected route - requires authentication
 * 
 * Dependencies: ReferralDashboard, ReferralLeaderboard components
 */

'use client';

import { useState } from 'react';
import { useGameContext } from '@/context/GameContext';
import ReferralDashboard from '@/components/ReferralDashboard';
import ReferralLeaderboard from '@/components/ReferralLeaderboard';
import { useRouter } from 'next/navigation';

type Tab = 'dashboard' | 'leaderboard' | 'guide';

export default function ReferralsPage() {
  const { player } = useGameContext();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Redirect if not authenticated
  if (!player) {
    router.push('/login');
    return null;
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'leaderboard', label: 'Leaderboard', icon: '🏆' },
    { id: 'guide', label: 'How It Works', icon: '📖' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-500 bg-clip-text text-transparent mb-3">
            Referral System
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Invite friends to DarkFrame and earn exclusive rewards! Build your empire by growing the community.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg mb-6 p-2 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[150px] px-4 py-3 rounded-lg font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="transition-opacity duration-200">
          {activeTab === 'dashboard' && <ReferralDashboard />}
          {activeTab === 'leaderboard' && <ReferralLeaderboard />}
          {activeTab === 'guide' && <GuideTab />}
        </div>
      </div>
    </div>
  );
}

/**
 * How It Works / Guide Tab
 * Comprehensive tutorial and FAQ section
 */
function GuideTab() {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-purple-400 mb-4">How It Works</h2>
        <p className="text-gray-300 text-lg leading-relaxed">
          The DarkFrame referral system rewards you for bringing new players into the game.
          Share your unique referral code, and when new players sign up using your code,
          you'll earn progressive rewards including resources, RP, VIP time, and exclusive titles!
        </p>
      </div>

      {/* Step-by-Step */}
      <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Getting Started</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-lg">
              1
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Get Your Code</h4>
              <p className="text-gray-300">
                Your unique referral code is generated automatically when you create an account.
                Find it in the Dashboard tab.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-lg">
              2
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Share Your Code</h4>
              <p className="text-gray-300">
                Share your referral link on social media, gaming forums, or directly with friends.
                Use the quick-share buttons for X, Facebook, and more.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-lg">
              3
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">They Sign Up</h4>
              <p className="text-gray-300">
                When a new player registers using your code, they get a Welcome Package (50,000 Metal + 50,000 Energy + Legendary Digger + 3-day VIP trial + 25% XP boost).
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-bold text-lg">
              4
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Validation Period</h4>
              <p className="text-gray-300">
                Your referral enters a 7-day validation period. During this time, they must complete 4 logins to prove they're an active player (anti-abuse protection).
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-green-600 rounded-full flex items-center justify-center font-bold text-lg">
              5
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Earn Rewards</h4>
              <p className="text-gray-300">
                Once validated, you receive your referral rewards! Plus, milestone bonuses at 1, 3, 5, 10, 15, 25, 50, and 100 referrals.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reward Structure */}
      <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Reward Structure</h3>
        
        <div className="mb-6">
          <h4 className="font-semibold text-white mb-2">Base Rewards (Per Validated Referral)</h4>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <ul className="space-y-2 text-gray-300">
              <li>⚙️ <span className="text-cyan-400 font-semibold">10,000 Metal</span> (increases progressively)</li>
              <li>⚡ <span className="text-yellow-400 font-semibold">10,000 Energy</span> (increases progressively)</li>
              <li>🧬 <span className="text-purple-400 font-semibold">15 RP</span> (Research Points)</li>
              <li>⭐ <span className="text-blue-400 font-semibold">2,000 XP</span></li>
              <li>👑 <span className="text-yellow-300 font-semibold">1 VIP Day</span> (capped at 30 total)</li>
            </ul>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold text-white mb-2">Progressive Scaling</h4>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <p className="text-gray-300 mb-2">
              Resource rewards increase by <span className="text-cyan-400 font-semibold">5% per referral</span>, up to a maximum of <span className="text-cyan-400 font-semibold">2.0x</span> (reached at 15 referrals).
            </p>
            <p className="text-gray-400 text-sm">
              Example: Your 15th referral gives 20,000 Metal + 20,000 Energy (2.0x multiplier)
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-2">Milestone Bonuses</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-purple-400 font-bold mb-1">1st Referral 🎖️</div>
              <div className="text-sm text-gray-300">25k/25k + "Recruiter" title</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-purple-400 font-bold mb-1">3rd Referral ⚔️</div>
              <div className="text-sm text-gray-300">50k/50k + 5 Elite Infantry</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-purple-400 font-bold mb-1">5th Referral 🥉</div>
              <div className="text-sm text-gray-300">100k/100k + Bronze Badge + "Talent Scout"</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-purple-400 font-bold mb-1">10th Referral 🎁</div>
              <div className="text-sm text-gray-300">250k/250k + Special Unit + 5% resource bonus</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-purple-400 font-bold mb-1">15th Referral 🥈</div>
              <div className="text-sm text-gray-300">500k/500k + Silver Badge + 2 Legendary Units + "Elite Recruiter"</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-purple-400 font-bold mb-1">25th Referral 👑</div>
              <div className="text-sm text-gray-300">750k/750k + "Ambassador" + Prestige Unit + 10% XP bonus</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-purple-400 font-bold mb-1">50th Referral 🥇</div>
              <div className="text-sm text-gray-300">625k/625k + Gold Badge + 10% resource boost + "Legendary Recruiter"</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="text-purple-400 font-bold mb-1">100th Referral 💎</div>
              <div className="text-sm text-gray-300">150k/150k + Diamond Badge + 25% all bonuses + 3,000 RP + "Empire Builder"</div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-white mb-2">❓ Why is there a validation period?</h4>
            <p className="text-gray-300">
              To prevent abuse and ensure rewards go to legitimate recruiters who bring active players.
              The 7-day + 4 login requirement filters out fake accounts.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">❓ What happens if someone uses my code but doesn't complete validation?</h4>
            <p className="text-gray-300">
              They'll show as "Pending" in your dashboard. If they don't meet the requirements within 7 days,
              they'll be flagged as invalid and won't count toward your rewards.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">❓ Is there a limit to how many people I can refer?</h4>
            <p className="text-gray-300">
              No! You can refer unlimited players. However, VIP days cap at 30 total, and resource scaling
              caps at 2.0x (reached at 15 referrals).
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">❓ Can I refer multiple accounts from the same IP?</h4>
            <p className="text-gray-300">
              We track IP addresses to prevent abuse. Multiple accounts from the same IP will be flagged
              and may not validate. Each referral should be a unique, active player.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">❓ How do I track my progress?</h4>
            <p className="text-gray-300">
              Use the Dashboard tab to see your referral stats, pending validations, total rewards earned,
              and progress toward the next milestone.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">❓ What do the badges and titles do?</h4>
            <p className="text-gray-300">
              Badges and titles are cosmetic achievements that show your recruiting prowess.
              They're displayed on leaderboards and in-game. Some provide passive bonuses!
            </p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-green-900/30 to-cyan-900/30 border border-green-500/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-green-400 mb-4">💡 Pro Tips</h3>
        <ul className="space-y-3 text-gray-300">
          <li className="flex gap-3">
            <span className="text-green-400">✓</span>
            <span>Share your link on social media and gaming communities for maximum reach</span>
          </li>
          <li className="flex gap-3">
            <span className="text-green-400">✓</span>
            <span>Help your referrals get started! Active players = validated rewards for you</span>
          </li>
          <li className="flex gap-3">
            <span className="text-green-400">✓</span>
            <span>Target milestone numbers (3, 5, 10, 15, etc.) for huge bonus rewards</span>
          </li>
          <li className="flex gap-3">
            <span className="text-green-400">✓</span>
            <span>VIP caps at 30 days total, so early referrals maximize VIP rewards</span>
          </li>
          <li className="flex gap-3">
            <span className="text-green-400">✓</span>
            <span>The 100-referral milestone gives 3,000 RP - enough for significant WMD tech unlocks!</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
