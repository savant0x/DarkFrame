/**
 * @file components/ReferralDashboard.tsx
 * @created 2025-10-24
 * @overview Comprehensive referral dashboard component
 * 
 * OVERVIEW:
 * Displays player's referral stats, code/link, progress to milestones,
 * recent referrals list, and total rewards earned. Includes copy-to-clipboard
 * functionality and share buttons for social media.
 * 
 * Features:
 * - Referral code and shareable link display
 * - One-click copy functionality
 * - Total/pending/validated referral counts
 * - Progress bar to next milestone
 * - Recent referrals list with validation status
 * - Total rewards earned breakdown
 * - Badges and titles display
 * - Social share buttons
 * 
 * Dependencies: /api/referral/stats, toastService, GameContext
 */

'use client';

import { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { showSuccess, showError, showInfo } from '@/lib/toastService';

interface ReferralStats {
  code: string;
  link: string;
  totalReferrals: number;
  pendingReferrals: number;
  validatedReferrals: number;
  nextMilestone: {
    count: number;
    name: string;
    progress: number;
    remaining: number;
    rewards: {
      metal: number;
      energy: number;
      rp: number;
      xp: number;
      vipDays: number;
    };
  } | null;
  recentReferrals: Array<{
    username: string;
    signupDate: string;
    validated: boolean;
    loginCount: number;
    daysActive: number;
  }>;
  totalRewardsEarned: {
    metal: number;
    energy: number;
    rp: number;
    xp: number;
    vipDays: number;
  };
  badges: string[];
  titles: string[];
}

export default function ReferralDashboard() {
  const { player } = useGameContext();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/referral/stats');
      const result = await response.json();

      if (result.success && result.data) {
        // Map the API response structure to component state
        const apiData = result.data;
        setStats({
          code: apiData.playerStats.referralCode,
          link: apiData.playerStats.referralLink,
          totalReferrals: apiData.playerStats.totalReferrals,
          pendingReferrals: apiData.playerStats.pendingReferrals,
          validatedReferrals: apiData.validatedReferrals?.length || 0,
          nextMilestone: apiData.nextMilestone,
          recentReferrals: apiData.validatedReferrals?.slice(0, 10).map((ref: any) => ({
            username: ref.newPlayerUsername,
            signupDate: ref.signupDate,
            validated: ref.validated,
            loginCount: ref.loginCount || 0,
            daysActive: ref.daysActive || 0
          })) || [],
          totalRewardsEarned: apiData.totalValueEarned,
          badges: apiData.playerStats.referralBadges,
          titles: apiData.playerStats.referralTitles
        });
      } else {
        showError(result.message || result.error || 'Failed to load referral stats');
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
      showError('Failed to load referral stats');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showSuccess(`${label} copied to clipboard!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showError('Failed to copy to clipboard');
    }
  };

  const shareToX = () => {
    const text = `Join me on DarkFrame! Use my referral code: ${stats?.code}`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(stats?.link || '')}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(stats?.link || '')}`;
    window.open(url, '_blank', 'width=600,height=400');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-8 text-red-400">
        Failed to load referral dashboard. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-cyan-400 mb-2">Referral Program</h2>
        <p className="text-gray-300">
          Invite friends to DarkFrame and earn exclusive rewards, resources, and VIP time!
        </p>
      </div>

      {/* Referral Code & Link */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
          <label className="text-sm text-gray-400 mb-2 block">Your Referral Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={stats.code}
              readOnly
              className="flex-1 bg-gray-900/50 border border-cyan-500/30 rounded px-3 py-2 text-cyan-400 font-mono text-lg"
            />
            <button
              onClick={() => copyToClipboard(stats.code, 'Referral code')}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
          <label className="text-sm text-gray-400 mb-2 block">Referral Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={stats.link}
              readOnly
              className="flex-1 bg-gray-900/50 border border-cyan-500/30 rounded px-3 py-2 text-cyan-400 font-mono text-sm truncate"
            />
            <button
              onClick={() => copyToClipboard(stats.link, 'Referral link')}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={shareToX}
          className="px-6 py-2 bg-black hover:bg-gray-800 text-white rounded transition-colors flex items-center gap-2"
        >
          <span>𝕏</span> Share on X
        </button>
        <button
          onClick={shareToFacebook}
          className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded transition-colors flex items-center gap-2"
        >
          <span>📘</span> Share on Facebook
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{stats.validatedReferrals}</div>
          <div className="text-sm text-gray-400 mt-1">Validated Referrals</div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-400">{stats.pendingReferrals}</div>
          <div className="text-sm text-gray-400 mt-1">Pending Validation</div>
        </div>
        <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-cyan-400">{stats.totalReferrals}</div>
          <div className="text-sm text-gray-400 mt-1">Total Referrals</div>
        </div>
      </div>

      {/* Next Milestone */}
      {stats.nextMilestone && (
        <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-lg p-6">
          <h3 className="text-xl font-bold text-purple-400 mb-3">Next Milestone: {stats.nextMilestone.name}</h3>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-300 mb-2">
              <span>{stats.totalReferrals} / {stats.nextMilestone.count} Referrals</span>
              <span>{stats.nextMilestone.remaining} remaining</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500"
                style={{ width: `${stats.nextMilestone.progress}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-800/50 rounded p-2 text-center">
              <div className="text-lg font-bold text-cyan-400">
                {stats.nextMilestone.rewards.metal.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">Metal</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2 text-center">
              <div className="text-lg font-bold text-yellow-400">
                {stats.nextMilestone.rewards.energy.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">Energy</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2 text-center">
              <div className="text-lg font-bold text-purple-400">
                {stats.nextMilestone.rewards.rp.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">RP</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2 text-center">
              <div className="text-lg font-bold text-green-400">
                {stats.nextMilestone.rewards.xp.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">XP</div>
            </div>
            <div className="bg-gray-800/50 rounded p-2 text-center">
              <div className="text-lg font-bold text-pink-400">
                {stats.nextMilestone.rewards.vipDays}
              </div>
              <div className="text-xs text-gray-400">VIP Days</div>
            </div>
          </div>
        </div>
      )}

      {/* Total Rewards Earned */}
      <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-500/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-green-400 mb-4">Total Rewards Earned</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">
              {stats.totalRewardsEarned.metal.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Metal</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {stats.totalRewardsEarned.energy.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">Energy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {stats.totalRewardsEarned.rp.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">RP</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {stats.totalRewardsEarned.xp.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">XP</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-pink-400">
              {stats.totalRewardsEarned.vipDays}
            </div>
            <div className="text-sm text-gray-400">VIP Days</div>
          </div>
        </div>
      </div>

      {/* Badges & Titles */}
      {(stats.badges.length > 0 || stats.titles.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.badges.length > 0 && (
            <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
              <h3 className="text-lg font-bold text-cyan-400 mb-3">Badges Earned</h3>
              <div className="flex flex-wrap gap-2">
                {stats.badges.map((badge, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-full text-sm font-semibold"
                  >
                    {badge.replace('_', ' ').toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {stats.titles.length > 0 && (
            <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
              <h3 className="text-lg font-bold text-cyan-400 mb-3">Titles Earned</h3>
              <div className="flex flex-wrap gap-2">
                {stats.titles.map((title, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-semibold"
                  >
                    {title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Referrals */}
      <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">Recent Referrals</h3>
        {stats.recentReferrals.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No referrals yet. Share your code to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {stats.recentReferrals.map((referral, index) => (
              <div
                key={index}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-white">{referral.username}</div>
                  <div className="text-sm text-gray-400">
                    Signed up: {new Date(referral.signupDate).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {referral.loginCount} logins • {referral.daysActive} days active
                  </div>
                </div>
                <div>
                  {referral.validated ? (
                    <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-semibold">
                      ✓ Validated
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-sm font-semibold">
                      ⏳ Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
        <h3 className="text-xl font-bold text-blue-400 mb-4">How It Works</h3>
        <ol className="space-y-3 text-gray-300">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              1
            </span>
            <span>Share your referral code or link with friends</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              2
            </span>
            <span>They sign up using your code and receive a welcome package (50k Metal + 50k Energy + Legendary Digger + 3-day VIP)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              3
            </span>
            <span>After 7 days and 4+ logins, the referral is validated</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              4
            </span>
            <span>You receive resources, RP, XP, and VIP time! Rewards increase with each referral (up to 2x)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              5
            </span>
            <span>Reach milestones for massive bonus rewards, badges, titles, and permanent bonuses!</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
