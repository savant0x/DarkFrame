/**
 * @file app/referrals/page.tsx
 * @created 2025-10-24
 * @updated 2026-09-08 (FID-20260908-014: NEON NOIR redesign — token shell/nn-tab/nn-panel/
 *   nn-well/nn-chip/nn-row primitives; gradient hero + slabs removed; tab labels de-emojified;
 *   GuideTab milestone table re-verified against lib/referralService REFERRAL_MILESTONES —
 *   numbers unchanged, 8/8 match)
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
 * Token primitives only (nn-tab / nn-panel / nn-well / nn-chip / nn-row / nn-num);
 * logic byte-preserved from the pre-FID-014 file.
 *
 * Dependencies: ReferralDashboard, ReferralLeaderboard components
 */

'use client';

import { useEffect, useState } from 'react';
import { useGameContext } from '@/context/GameContext';
import ReferralDashboard from '@/components/ReferralDashboard';
import ReferralLeaderboard from '@/components/ReferralLeaderboard';
import BackButton from '@/components/BackButton';
import { useRouter } from 'next/navigation';

type Tab = 'dashboard' | 'leaderboard' | 'guide';

export default function ReferralsPage() {
  const { player, isLoading } = useGameContext();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Redirect if not authenticated — via effect, never the render body: a
  // render-time router.push throws "ReferenceError: location is not defined"
  // during static prerender (FID-20260909-026 §7) and is a side-effect-in-
  // render violation. The isLoading guard mirrors app/game/page.tsx: player
  // is null until GameContext's async session check finishes, so an
  // unconditional bounce here would trap every hard visit at /login.
  useEffect(() => {
    if (!isLoading && !player) {
      router.push('/login');
    }
  }, [isLoading, player, router]);

  if (!player) {
    return null;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'guide', label: 'How It Works' },
  ];

  return (
    <div
      className="min-h-screen text-[color:var(--nn-text-primary)]"
      style={{ background: 'var(--nn-void)' }}
    >
      <div className="max-w-5xl mx-auto p-8">
        <BackButton />

        {/* Page Header — FID-014: gradient bg-clip-text hero → flat Orbitron title */}
        <h1 className="nn-num nn-text-cyan text-4xl font-bold tracking-wider mt-4 mb-2">
          REFERRAL SYSTEM
        </h1>
        <p className="nn-text-secondary max-w-2xl mb-8">
          Invite friends to DarkFrame and earn exclusive rewards. Build your empire by growing the
          community.
        </p>

        {/* Tab Navigation — FID-014: gradient active slab → nn-tab row */}
        <div className="flex mb-6" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nn-tab px-5 ${activeTab === tab.id ? 'nn-tab--on' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
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
 * FID-014: gradient slabs → nn-panel sections (violet overview, cyan mechanics, green tips);
 * steps → nn-row + nn-chip ordinals; reward/milestone/FAQ blocks → nn-well cells.
 * Milestone figures verified against lib/referralService.ts REFERRAL_MILESTONES (8/8 match).
 */
function GuideTab() {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="nn-panel nn-panel--violet">
        <div className="nn-panel__header">
          <span className="nn-panel__title">How It Works</span>
          <span className="nn-panel__meta">Referral Program ▸ Overview</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded">
          <p className="leading-relaxed text-[color:var(--nn-text-primary)]">
            The DarkFrame referral system rewards you for bringing new players into the game.
            Share your unique referral code, and when new players sign up using your code,
            you{"'"}ll earn progressive rewards including resources, RP, VIP time, and exclusive
            titles!
          </p>
        </div>
      </div>

      {/* Step-by-Step */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Getting Started</span>
          <span className="nn-panel__meta">Five Steps ▸ Validation ▸ Rewards</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded space-y-4">
          <div className="nn-row">
            <div className="flex items-start gap-3">
              <span className="nn-chip nn-chip--violet flex-shrink-0">01</span>
              <div>
                <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-1">
                  Get Your Code
                </h4>
                <p className="nn-text-secondary text-sm">
                  Your unique referral code is generated automatically when you create an account.
                  Find it in the Dashboard tab.
                </p>
              </div>
            </div>
          </div>

          <div className="nn-row">
            <div className="flex items-start gap-3">
              <span className="nn-chip nn-chip--violet flex-shrink-0">02</span>
              <div>
                <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-1">
                  Share Your Code
                </h4>
                <p className="nn-text-secondary text-sm">
                  Share your referral link on social media, gaming forums, or directly with friends.
                  Use the quick-share buttons for X, Facebook, and more.
                </p>
              </div>
            </div>
          </div>

          <div className="nn-row">
            <div className="flex items-start gap-3">
              <span className="nn-chip nn-chip--violet flex-shrink-0">03</span>
              <div>
                <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-1">
                  They Sign Up
                </h4>
                <p className="nn-text-secondary text-sm">
                  When a new player registers using your code, they get a Welcome Package (50,000
                  Metal + 50,000 Energy + Legendary Digger + 3-day VIP trial + 25% XP boost).
                </p>
              </div>
            </div>
          </div>

          <div className="nn-row">
            <div className="flex items-start gap-3">
              <span className="nn-chip nn-chip--violet flex-shrink-0">04</span>
              <div>
                <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-1">
                  Validation Period
                </h4>
                <p className="nn-text-secondary text-sm">
                  Your referral enters a 7-day validation period. During this time, they must
                  complete 4 logins to prove they{"'"}re an active player (anti-abuse protection).
                </p>
              </div>
            </div>
          </div>

          <div className="nn-row">
            <div className="flex items-start gap-3">
              <span className="nn-chip nn-chip--green flex-shrink-0">05</span>
              <div>
                <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-1">
                  Earn Rewards
                </h4>
                <p className="nn-text-secondary text-sm">
                  Once validated, you receive your referral rewards! Plus, milestone bonuses at 1,
                  3, 5, 10, 15, 25, 50, and 100 referrals.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reward Structure */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Reward Structure</span>
          <span className="nn-panel__meta">Base ▸ Scaling ▸ Milestones</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded space-y-6">
          <div>
            <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-2">
              Base Rewards (Per Validated Referral)
            </h4>
            <div className="nn-well flex-col items-stretch space-y-2 py-3">
              <div className="nn-row">
                <span className="nn-text-secondary">⚙️ Metal</span>
                <span className="nn-num nn-text-cyan font-semibold">10,000</span>
              </div>
              <div className="nn-row">
                <span className="nn-text-secondary">⚡ Energy</span>
                <span className="nn-num nn-text-amber font-semibold">10,000</span>
              </div>
              <div className="nn-row">
                <span className="nn-text-secondary">🧬 RP</span>
                <span className="nn-num nn-text-violet font-semibold">15</span>
              </div>
              <div className="nn-row">
                <span className="nn-text-secondary">⭐ XP</span>
                <span className="nn-num nn-text-cyan font-semibold">2,000</span>
              </div>
              <div className="nn-row">
                <span className="nn-text-secondary">👑 VIP Day</span>
                <span className="nn-num nn-text-amber font-semibold">1</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-2">
              Progressive Scaling
            </h4>
            <div className="nn-well flex-col items-stretch py-3">
              <p className="nn-text-secondary text-sm mb-2">
                Resource rewards increase by{' '}
                <span className="nn-num nn-text-cyan font-semibold">5% per referral</span>, up to a
                maximum of <span className="nn-num nn-text-cyan font-semibold">2.0x</span> (reached
                at 15 referrals).
              </p>
              <p className="nn-footnote">
                Example: Your 15th referral gives 20,000 Metal + 20,000 Energy (2.0x multiplier)
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-2">
              Milestone Bonuses
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="nn-well flex-col items-stretch">
                <div className="nn-num nn-text-violet font-bold mb-1">1st Referral 🎖️</div>
                <div className="nn-footnote">25k/25k + &quot;Recruiter&quot; title</div>
              </div>
              <div className="nn-well flex-col items-stretch">
                <div className="nn-num nn-text-violet font-bold mb-1">3rd Referral ⚔️</div>
                <div className="nn-footnote">50k/50k + 5 Elite Infantry</div>
              </div>
              <div className="nn-well flex-col items-stretch">
                <div className="nn-num nn-text-violet font-bold mb-1">5th Referral 🥉</div>
                <div className="nn-footnote">
                  100k/100k + Bronze Badge + &quot;Talent Scout&quot;
                </div>
              </div>
              <div className="nn-well flex-col items-stretch">
                <div className="nn-num nn-text-violet font-bold mb-1">10th Referral 🎁</div>
                <div className="nn-footnote">250k/250k + Special Unit + 5% resource bonus</div>
              </div>
              <div className="nn-well flex-col items-stretch">
                <div className="nn-num nn-text-violet font-bold mb-1">15th Referral 🥈</div>
                <div className="nn-footnote">
                  500k/500k + Silver Badge + 2 Legendary Units + &quot;Elite Recruiter&quot;
                </div>
              </div>
              <div className="nn-well flex-col items-stretch">
                <div className="nn-num nn-text-violet font-bold mb-1">25th Referral 👑</div>
                <div className="nn-footnote">
                  750k/750k + &quot;Ambassador&quot; + Prestige Unit + 10% XP bonus
                </div>
              </div>
              <div className="nn-well flex-col items-stretch">
                <div className="nn-num nn-text-violet font-bold mb-1">50th Referral 🥇</div>
                <div className="nn-footnote">
                  625k/625k + Gold Badge + 10% resource boost + &quot;Legendary Recruiter&quot;
                </div>
              </div>
              <div className="nn-well flex-col items-stretch">
                <div className="nn-num nn-text-violet font-bold mb-1">100th Referral 💎</div>
                <div className="nn-footnote">
                  150k/150k + Diamond Badge + 25% all bonuses + 3,000 RP + &quot;Empire Builder&quot;
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Frequently Asked Questions</span>
          <span className="nn-panel__meta">Six Entries</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded space-y-4">
          <div>
            <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-2">
              Why is there a validation period?
            </h4>
            <p className="nn-text-secondary text-sm">
              To prevent abuse and ensure rewards go to legitimate recruiters who bring active
              players. The 7-day + 4 login requirement filters out fake accounts.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-2">
              What happens if someone uses my code but doesn{"'"}t complete validation?
            </h4>
            <p className="nn-text-secondary text-sm">
              They{"'"}ll show as &quot;Pending&quot; in your dashboard. If they don{"'"}t meet the
              requirements within 7 days, they{"'"}ll be flagged as invalid and won{"'"}t count
              toward your rewards.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-2">
              Is there a limit to how many people I can refer?
            </h4>
            <p className="nn-text-secondary text-sm">
              No! You can refer unlimited players. However, VIP days cap at 30 total, and resource
              scaling caps at 2.0x (reached at 15 referrals).
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-2">
              Can I refer multiple accounts from the same IP?
            </h4>
            <p className="nn-text-secondary text-sm">
              We track IP addresses to prevent abuse. Multiple accounts from the same IP will be
              flagged and may not validate. Each referral should be a unique, active player.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-2">
              How do I track my progress?
            </h4>
            <p className="nn-text-secondary text-sm">
              Use the Dashboard tab to see your referral stats, pending validations, total rewards
              earned, and progress toward the next milestone.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[color:var(--nn-text-primary)] mb-2">
              What do the badges and titles do?
            </h4>
            <p className="nn-text-secondary text-sm">
              Badges and titles are cosmetic achievements that show your recruiting prowess.
              They{"'"}re displayed on leaderboards and in-game. Some provide passive bonuses!
            </p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="nn-panel nn-panel--amber">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Pro Tips</span>
          <span className="nn-panel__meta">Field Manual</span>
        </div>
        <div className="nn-panel__body nn-panel__body--padded">
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="nn-text-green">▸</span>
              <span className="nn-text-secondary">
                Share your link on social media and gaming communities for maximum reach
              </span>
            </li>
            <li className="flex gap-3">
              <span className="nn-text-green">▸</span>
              <span className="nn-text-secondary">
                Help your referrals get started! Active players = validated rewards for you
              </span>
            </li>
            <li className="flex gap-3">
              <span className="nn-text-green">▸</span>
              <span className="nn-text-secondary">
                Target milestone numbers (3, 5, 10, 15, etc.) for huge bonus rewards
              </span>
            </li>
            <li className="flex gap-3">
              <span className="nn-text-green">▸</span>
              <span className="nn-text-secondary">
                VIP caps at 30 days total, so early referrals maximize VIP rewards
              </span>
            </li>
            <li className="flex gap-3">
              <span className="nn-text-green">▸</span>
              <span className="nn-text-secondary">
                The 100-referral milestone gives 3,000 RP — enough for significant WMD tech unlocks!
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
