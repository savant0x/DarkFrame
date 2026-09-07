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
import { showSuccess, showError } from '@/lib/toastService';

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
    } catch {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-8 text-[color:var(--nn-magenta)]">
        Failed to load referral dashboard. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[color:var(--nn-cyan)] to-[color:var(--nn-cyan)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-6">
        <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)] mb-2">Referral Program</h2>
        <p className="text-text-primary">
          Invite friends to DarkFrame and earn exclusive rewards, resources, and VIP time!
        </p>
      </div>

      {/* Referral Code & Link */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-glass-light border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
          <label className="text-sm text-text-secondary mb-2 block">Your Referral Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={stats.code}
              readOnly
              className="flex-1 bg-glass-dark border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-cyan)] font-mono text-lg"
            />
            <button
              onClick={() => copyToClipboard(stats.code, 'Referral code')}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none transition-colors"
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="bg-glass-light border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
          <label className="text-sm text-text-secondary mb-2 block">Referral Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={stats.link}
              readOnly
              className="flex-1 bg-glass-dark border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-cyan)] font-mono text-sm truncate"
            />
            <button
              onClick={() => copyToClipboard(stats.link, 'Referral link')}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none transition-colors"
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
          className="px-6 py-2 bg-[color:var(--nn-void)] hover:bg-glass-light text-[color:var(--nn-text-primary)] rounded-none transition-colors flex items-center gap-2"
        >
          <span>𝕏</span> Share on X
        </button>
        <button
          onClick={shareToFacebook}
          className="px-6 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none transition-colors flex items-center gap-2"
        >
          <span>📘</span> Share on Facebook
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-4 text-center">
          <div className="text-3xl font-bold text-[color:var(--nn-green)]">{stats.validatedReferrals}</div>
          <div className="text-sm text-text-secondary mt-1">Validated Referrals</div>
        </div>
        <div className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-4 text-center">
          <div className="text-3xl font-bold text-[color:var(--nn-amber)]">{stats.pendingReferrals}</div>
          <div className="text-sm text-text-secondary mt-1">Pending Validation</div>
        </div>
        <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4 text-center">
          <div className="text-3xl font-bold text-[color:var(--nn-cyan)]">{stats.totalReferrals}</div>
          <div className="text-sm text-text-secondary mt-1">Total Referrals</div>
        </div>
      </div>

      {/* Next Milestone */}
      {stats.nextMilestone && (
        <div className="bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-magenta)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-6">
          <h3 className="text-xl font-bold text-[color:var(--nn-violet)] mb-3">Next Milestone: {stats.nextMilestone.name}</h3>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-text-primary mb-2">
              <span>{stats.totalReferrals} / {stats.nextMilestone.count} Referrals</span>
              <span>{stats.nextMilestone.remaining} remaining</span>
            </div>
            <div className="w-full bg-glass-light rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-magenta)] h-full transition-all duration-500"
                style={{ width: `${stats.nextMilestone.progress}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-glass-light rounded-none p-2 text-center">
              <div className="text-lg font-bold text-[color:var(--nn-cyan)]">
                {stats.nextMilestone.rewards.metal.toLocaleString()}
              </div>
              <div className="text-xs text-text-secondary">Metal</div>
            </div>
            <div className="bg-glass-light rounded-none p-2 text-center">
              <div className="text-lg font-bold text-[color:var(--nn-amber)]">
                {stats.nextMilestone.rewards.energy.toLocaleString()}
              </div>
              <div className="text-xs text-text-secondary">Energy</div>
            </div>
            <div className="bg-glass-light rounded-none p-2 text-center">
              <div className="text-lg font-bold text-[color:var(--nn-violet)]">
                {stats.nextMilestone.rewards.rp.toLocaleString()}
              </div>
              <div className="text-xs text-text-secondary">RP</div>
            </div>
            <div className="bg-glass-light rounded-none p-2 text-center">
              <div className="text-lg font-bold text-[color:var(--nn-green)]">
                {stats.nextMilestone.rewards.xp.toLocaleString()}
              </div>
              <div className="text-xs text-text-secondary">XP</div>
            </div>
            <div className="bg-glass-light rounded-none p-2 text-center">
              <div className="text-lg font-bold text-[color:var(--nn-magenta)]">
                {stats.nextMilestone.rewards.vipDays}
              </div>
              <div className="text-xs text-text-secondary">VIP Days</div>
            </div>
          </div>
        </div>
      )}

      {/* Total Rewards Earned */}
      <div className="bg-gradient-to-r from-[color:var(--nn-green)] to-[color:var(--nn-green)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-6">
        <h3 className="text-xl font-bold text-[color:var(--nn-green)] mb-4">Total Rewards Earned</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-[color:var(--nn-cyan)]">
              {stats.totalRewardsEarned.metal.toLocaleString()}
            </div>
            <div className="text-sm text-text-secondary">Metal</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[color:var(--nn-amber)]">
              {stats.totalRewardsEarned.energy.toLocaleString()}
            </div>
            <div className="text-sm text-text-secondary">Energy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[color:var(--nn-violet)]">
              {stats.totalRewardsEarned.rp.toLocaleString()}
            </div>
            <div className="text-sm text-text-secondary">RP</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[color:var(--nn-green)]">
              {stats.totalRewardsEarned.xp.toLocaleString()}
            </div>
            <div className="text-sm text-text-secondary">XP</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[color:var(--nn-magenta)]">
              {stats.totalRewardsEarned.vipDays}
            </div>
            <div className="text-sm text-text-secondary">VIP Days</div>
          </div>
        </div>
      </div>

      {/* Badges & Titles */}
      {(stats.badges.length > 0 || stats.titles.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.badges.length > 0 && (
            <div className="bg-glass-light border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
              <h3 className="text-lg font-bold text-[color:var(--nn-cyan)] mb-3">Badges Earned</h3>
              <div className="flex flex-wrap gap-2">
                {stats.badges.map((badge, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gradient-to-r from-[color:var(--nn-amber)] to-[color:var(--nn-amber)] text-[color:var(--nn-text-primary)] rounded-full text-sm font-semibold"
                  >
                    {badge.replace('_', ' ').toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {stats.titles.length > 0 && (
            <div className="bg-glass-light border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
              <h3 className="text-lg font-bold text-[color:var(--nn-cyan)] mb-3">Titles Earned</h3>
              <div className="flex flex-wrap gap-2">
                {stats.titles.map((title, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-magenta)] text-[color:var(--nn-text-primary)] rounded-full text-sm font-semibold"
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
      <div className="bg-glass-light border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-6">
        <h3 className="text-xl font-bold text-[color:var(--nn-cyan)] mb-4">Recent Referrals</h3>
        {stats.recentReferrals.length === 0 ? (
          <p className="text-text-secondary text-center py-8">
            No referrals yet. Share your code to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {stats.recentReferrals.map((referral, index) => (
              <div
                key={index}
                className="bg-glass-dark border border-glass-border rounded-none p-4 flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-[color:var(--nn-text-primary)]">{referral.username}</div>
                  <div className="text-sm text-text-secondary">
                    Signed up: {new Date(referral.signupDate).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    {referral.loginCount} logins • {referral.daysActive} days active
                  </div>
                </div>
                <div>
                  {referral.validated ? (
                    <span className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-full text-sm font-semibold">
                      ✓ Validated
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-full text-sm font-semibold">
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
      <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-6">
        <h3 className="text-xl font-bold text-[color:var(--nn-cyan)] mb-4">How It Works</h3>
        <ol className="space-y-3 text-text-primary">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-full flex items-center justify-center text-sm font-bold">
              1
            </span>
            <span>Share your referral code or link with friends</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-full flex items-center justify-center text-sm font-bold">
              2
            </span>
            <span>They sign up using your code and receive a welcome package (50k Metal + 50k Energy + Legendary Digger + 3-day VIP)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-full flex items-center justify-center text-sm font-bold">
              3
            </span>
            <span>After 7 days and 4+ logins, the referral is validated</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-full flex items-center justify-center text-sm font-bold">
              4
            </span>
            <span>You receive resources, RP, XP, and VIP time! Rewards increase with each referral (up to 2x)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-full flex items-center justify-center text-sm font-bold">
              5
            </span>
            <span>Reach milestones for massive bonus rewards, badges, titles, and permanent bonuses!</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
