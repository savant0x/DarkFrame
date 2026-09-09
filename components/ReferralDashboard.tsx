/**
 * @file components/ReferralDashboard.tsx
 * @created 2025-10-24
 * @updated 2026-09-08 (FID-20260908-014: NEON NOIR redesign — nn-panel/nn-stat/nn-meter/
 *   nn-chip/nn-input/nn-btn primitives; gradient slabs (incl. same-color cyan→cyan and
 *   green→green no-ops) removed; doubled background class on share row fixed; gated
 *   nn-spin-icon loader; data-fetch + clipboard + share logic byte-preserved)
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
 * - Progress meter to next milestone
 * - Recent referrals list with validation status
 * - Total rewards earned breakdown
 * - Badges and titles display
 * - Social share buttons
 *
 * Dependencies: /api/referral/stats, toastService, GameContext
 */

'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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

/**
 * Wire shape of a validated referral row in the GET /api/referral/stats payload
 * (subset of types/referral.types ReferralRecord; signupDate arrives as an ISO string over JSON).
 */
interface ValidatedReferralPayload {
  newPlayerUsername: string;
  signupDate: string;
  validated: boolean;
  loginCount?: number;
  daysActive?: number;
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
          recentReferrals: apiData.validatedReferrals?.slice(0, 10).map((ref: ValidatedReferralPayload) => ({
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
        <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" aria-label="Loading referral dashboard" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="nn-note" role="alert">
        <p className="nn-text-magenta text-sm font-semibold">
          Failed to load referral dashboard. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Referral Program</span>
          <span className="nn-panel__meta">Recruit ▸ Validate ▸ Earn</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded">
          <p className="nn-text-secondary">
            Invite friends to DarkFrame and earn exclusive rewards, resources, and VIP time!
          </p>
        </div>
      </div>

      {/* Referral Code & Link */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="nn-panel">
          <div className="nn-panel__header">
            <span className="nn-panel__title">Your Referral Code</span>
          </div>
          <div className="nn-panel__body nn-panel__body--padded">
            <div className="flex gap-2">
              <input
                type="text"
                value={stats.code}
                readOnly
                className="nn-input flex-1 nn-num"
              />
              <button
                onClick={() => copyToClipboard(stats.code, 'Referral code')}
                className="nn-btn nn-btn--primary"
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        <div className="nn-panel">
          <div className="nn-panel__header">
            <span className="nn-panel__title">Referral Link</span>
          </div>
          <div className="nn-panel__body nn-panel__body--padded">
            <div className="flex gap-2">
              <input
                type="text"
                value={stats.link}
                readOnly
                className="nn-input flex-1 nn-num text-sm truncate"
              />
              <button
                onClick={() => copyToClipboard(stats.link, 'Referral link')}
                className="nn-btn nn-btn--primary"
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="flex gap-3 justify-center">
        <button onClick={shareToX} className="nn-btn px-6">
          <span className="mr-2">𝕏</span> Share on X
        </button>
        <button onClick={shareToFacebook} className="nn-btn nn-btn--primary px-6">
          <span className="mr-2">📘</span> Share on Facebook
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="nn-stat text-center">
          <div className="nn-stat__lab">Validated Referrals</div>
          <div className="nn-stat__num nn-stat__num--glow-green">{stats.validatedReferrals}</div>
          <div className="nn-stat__sub">counted toward rewards</div>
        </div>
        <div className="nn-stat text-center">
          <div className="nn-stat__lab">Pending Validation</div>
          <div className="nn-stat__num nn-stat__num--glow-amber">{stats.pendingReferrals}</div>
          <div className="nn-stat__sub">in 7-day window</div>
        </div>
        <div className="nn-stat text-center">
          <div className="nn-stat__lab">Total Referrals</div>
          <div className="nn-stat__num nn-stat__num--glow-cyan">{stats.totalReferrals}</div>
          <div className="nn-stat__sub">all-time signups</div>
        </div>
      </div>

      {/* Next Milestone */}
      {stats.nextMilestone && (
        <div className="nn-panel nn-panel--violet">
          <div className="nn-panel__header">
            <span className="nn-panel__title">Next Milestone</span>
            <span className="nn-panel__meta">{stats.nextMilestone.name}</span>
          </div>
          <div className="nn-panel__body nn-panel__body--padded">
            <div className="nn-meter mb-3" role="progressbar" aria-valuenow={stats.nextMilestone.progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="nn-meter__seg nn-meter__seg--vio" style={{ width: `${stats.nextMilestone.progress}%` }} />
            </div>
            <div className="nn-row nn-num text-sm mb-4">
              <span>{stats.totalReferrals} / {stats.nextMilestone.count} Referrals</span>
              <span className="nn-text-secondary">{stats.nextMilestone.remaining} remaining</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="nn-well flex-col">
                <div className="nn-num nn-text-cyan font-bold">{stats.nextMilestone.rewards.metal.toLocaleString()}</div>
                <div className="nn-stat__lab mt-1">Metal</div>
              </div>
              <div className="nn-well flex-col">
                <div className="nn-num nn-text-amber font-bold">{stats.nextMilestone.rewards.energy.toLocaleString()}</div>
                <div className="nn-stat__lab mt-1">Energy</div>
              </div>
              <div className="nn-well flex-col">
                <div className="nn-num nn-text-violet font-bold">{stats.nextMilestone.rewards.rp.toLocaleString()}</div>
                <div className="nn-stat__lab mt-1">RP</div>
              </div>
              <div className="nn-well flex-col">
                <div className="nn-num nn-text-green font-bold">{stats.nextMilestone.rewards.xp.toLocaleString()}</div>
                <div className="nn-stat__lab mt-1">XP</div>
              </div>
              <div className="nn-well flex-col">
                <div className="nn-num nn-text-magenta font-bold">{stats.nextMilestone.rewards.vipDays}</div>
                <div className="nn-stat__lab mt-1">VIP Days</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Total Rewards Earned */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Total Rewards Earned</span>
          <span className="nn-panel__meta">Lifetime Payout</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="nn-num nn-stat__num--glow-cyan text-2xl font-bold">{stats.totalRewardsEarned.metal.toLocaleString()}</div>
              <div className="nn-stat__lab mt-1">Metal</div>
            </div>
            <div className="text-center">
              <div className="nn-num nn-stat__num--glow-amber text-2xl font-bold">{stats.totalRewardsEarned.energy.toLocaleString()}</div>
              <div className="nn-stat__lab mt-1">Energy</div>
            </div>
            <div className="text-center">
              <div className="nn-num nn-stat__num--glow-violet text-2xl font-bold">{stats.totalRewardsEarned.rp.toLocaleString()}</div>
              <div className="nn-stat__lab mt-1">RP</div>
            </div>
            <div className="text-center">
              <div className="nn-num nn-stat__num--glow-green text-2xl font-bold">{stats.totalRewardsEarned.xp.toLocaleString()}</div>
              <div className="nn-stat__lab mt-1">XP</div>
            </div>
            <div className="text-center">
              <div className="nn-num nn-stat__num--glow-magenta text-2xl font-bold">{stats.totalRewardsEarned.vipDays}</div>
              <div className="nn-stat__lab mt-1">VIP Days</div>
            </div>
          </div>
        </div>
      </div>

      {/* Badges & Titles */}
      {(stats.badges.length > 0 || stats.titles.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.badges.length > 0 && (
            <div className="nn-panel">
              <div className="nn-panel__header">
                <span className="nn-panel__title">Badges Earned</span>
                <span className="nn-panel__meta">{stats.badges.length}</span>
              </div>
              <div className="nn-panel__body nn-panel__body--padded">
                <div className="flex flex-wrap gap-2">
                  {stats.badges.map((badge, index) => (
                    <span key={index} className="nn-chip nn-chip--amber">
                      {badge.replace('_', ' ').toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stats.titles.length > 0 && (
            <div className="nn-panel">
              <div className="nn-panel__header">
                <span className="nn-panel__title">Titles Earned</span>
                <span className="nn-panel__meta">{stats.titles.length}</span>
              </div>
              <div className="nn-panel__body nn-panel__body--padded">
                <div className="flex flex-wrap gap-2">
                  {stats.titles.map((title, index) => (
                    <span key={index} className="nn-chip nn-chip--violet">
                      {title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Referrals */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Recent Referrals</span>
          <span className="nn-panel__meta">Latest 10</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded">
          {stats.recentReferrals.length === 0 ? (
            <p className="nn-text-secondary text-center py-8">
              No referrals yet. Share your code to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentReferrals.map((referral, index) => (
                <div
                  key={index}
                  className="nn-surface nn-surface--dark p-4 flex justify-between items-center"
                >
                  <div>
                    <div className="font-semibold text-[color:var(--nn-text-primary)]">{referral.username}</div>
                    <div className="nn-footnote">
                      Signed up: {new Date(referral.signupDate).toLocaleDateString()}
                    </div>
                    <div className="nn-footnote mt-1">
                      {referral.loginCount} logins • {referral.daysActive} days active
                    </div>
                  </div>
                  <div>
                    {referral.validated ? (
                      <span className="nn-chip nn-chip--green">✓ Validated</span>
                    ) : (
                      <span className="nn-chip nn-chip--amber">⏳ Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How It Works */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">How It Works</span>
          <span className="nn-panel__meta">Five Steps</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="nn-chip nn-chip--cyan flex-shrink-0">1</span>
              <span className="nn-text-secondary">Share your referral code or link with friends</span>
            </li>
            <li className="flex gap-3">
              <span className="nn-chip nn-chip--cyan flex-shrink-0">2</span>
              <span className="nn-text-secondary">
                They sign up using your code and receive a welcome package (50k Metal + 50k Energy +
                Legendary Digger + 3-day VIP)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="nn-chip nn-chip--cyan flex-shrink-0">3</span>
              <span className="nn-text-secondary">After 7 days and 4+ logins, the referral is validated</span>
            </li>
            <li className="flex gap-3">
              <span className="nn-chip nn-chip--cyan flex-shrink-0">4</span>
              <span className="nn-text-secondary">
                You receive resources, RP, XP, and VIP time! Rewards increase with each referral
                (up to 2x)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="nn-chip nn-chip--cyan flex-shrink-0">5</span>
              <span className="nn-text-secondary">
                Reach milestones for massive bonus rewards, badges, titles, and permanent bonuses!
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
