'use client';

import { useState } from 'react';
import { useGameContext } from '@/context/GameContext';
import ReferralDashboard from '@/components/ReferralDashboard';
import ReferralLeaderboard from '@/components/ReferralLeaderboard';
import { useRouter } from 'next/navigation';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

type Tab = 'dashboard' | 'leaderboard' | 'guide';

export default function ReferralsPage() {
  const { player } = useGameContext();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

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
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold text-[--neon-pink] mb-3">
                  Referral System
                </h1>
                <p className="text-lg text-white/60 max-w-2xl mx-auto">
                  Invite friends to DarkFrame and earn exclusive rewards! Build your empire by growing the community.
                </p>
              </div>

              <div className="bg-[--card] border border-[--electric]/20 rounded-lg mb-6 p-2 flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 min-w-[150px] px-4 py-3 rounded-lg font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-[--neon-pink]/15 border border-[--neon-pink]/25 text-[--neon-pink]'
                        : 'bg-[--card] text-white/60 hover:bg-[--card] hover:text-white'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="transition-opacity duration-200">
                {activeTab === 'dashboard' && <ReferralDashboard />}
                {activeTab === 'leaderboard' && <ReferralLeaderboard />}
                {activeTab === 'guide' && <GuideTab />}
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}

function GuideTab() {
  return (
    <div className="space-y-6">
      <div className="bg-[--neon-pink]/5 border border-[--neon-pink]/20 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-[--neon-pink] mb-4">How It Works</h2>
        <p className="text-white/60 text-lg leading-relaxed">
          The DarkFrame referral system rewards you for bringing new players into the game.
          Share your unique referral code, and when new players sign up using your code,
          you'll earn progressive rewards including resources, RP, VIP time, and exclusive titles!
        </p>
      </div>

      <div className="bg-[--card] border border-[--electric]/20 rounded-lg p-6">
        <h3 className="text-xl font-bold text-[--electric] mb-4">Getting Started</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-[--neon-pink] rounded-full flex items-center justify-center font-bold text-lg">
              1
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Get Your Code</h4>
              <p className="text-white/60">
                Your unique referral code is generated automatically when you create an account.
                Find it in the Dashboard tab.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-[--neon-pink] rounded-full flex items-center justify-center font-bold text-lg">
              2
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Share Your Code</h4>
              <p className="text-white/60">
                Share your referral link on social media, gaming forums, or directly with friends.
                Use the quick-share buttons for X, Facebook, and more.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-[--neon-pink] rounded-full flex items-center justify-center font-bold text-lg">
              3
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">They Sign Up</h4>
              <p className="text-white/60">
                When a new player registers using your code, they get a Welcome Package (50,000 Metal + 50,000 Energy + Legendary Digger + 3-day VIP trial + 25% XP boost).
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-[--neon-pink] rounded-full flex items-center justify-center font-bold text-lg">
              4
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Validation Period</h4>
              <p className="text-white/60">
                Your referral enters a 7-day validation period. During this time, they must complete 4 logins to prove they're an active player (anti-abuse protection).
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-[--synth] rounded-full flex items-center justify-center font-bold text-lg">
              5
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Earn Rewards</h4>
              <p className="text-white/60">
                Once validated, you receive your referral rewards! Plus, milestone bonuses at 1, 3, 5, 10, 15, 25, 50, and 100 referrals.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[--card] border border-[--electric]/20 rounded-lg p-6">
        <h3 className="text-xl font-bold text-[--electric] mb-4">Reward Structure</h3>

        <div className="mb-6">
          <h4 className="font-semibold text-white mb-2">Base Rewards (Per Validated Referral)</h4>
          <div className="bg-[--void] rounded-lg p-4">
            <ul className="space-y-2 text-white/60">
              <li>⚙️ <span className="text-[--electric] font-semibold">10,000 Metal</span> (increases progressively)</li>
              <li>⚡ <span className="text-[--neon-yellow] font-semibold">10,000 Energy</span> (increases progressively)</li>
              <li>🧬 <span className="text-[--neon-pink] font-semibold">15 RP</span> (Research Points)</li>
              <li>⭐ <span className="text-[--electric] font-semibold">2,000 XP</span></li>
              <li>👑 <span className="text-[--neon-yellow] font-semibold">1 VIP Day</span> (capped at 30 total)</li>
            </ul>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold text-white mb-2">Progressive Scaling</h4>
          <div className="bg-[--void] rounded-lg p-4">
            <p className="text-white/60 mb-2">
              Resource rewards increase by <span className="text-[--electric] font-semibold">5% per referral</span>, up to a maximum of <span className="text-[--electric] font-semibold">2.0x</span> (reached at 15 referrals).
            </p>
            <p className="text-white/40 text-sm">
              Example: Your 15th referral gives 20,000 Metal + 20,000 Energy (2.0x multiplier)
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-2">Milestone Bonuses</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[--void] rounded-lg p-4">
              <div className="text-[--neon-pink] font-bold mb-1">1st Referral 🎖️</div>
              <div className="text-sm text-white/60">25k/25k + "Recruiter" title</div>
            </div>
            <div className="bg-[--void] rounded-lg p-4">
              <div className="text-[--neon-pink] font-bold mb-1">3rd Referral ⚔️</div>
              <div className="text-sm text-white/60">50k/50k + 5 Elite Infantry</div>
            </div>
            <div className="bg-[--void] rounded-lg p-4">
              <div className="text-[--neon-pink] font-bold mb-1">5th Referral 🥉</div>
              <div className="text-sm text-white/60">100k/100k + Bronze Badge + "Talent Scout"</div>
            </div>
            <div className="bg-[--void] rounded-lg p-4">
              <div className="text-[--neon-pink] font-bold mb-1">10th Referral 🎁</div>
              <div className="text-sm text-white/60">250k/250k + Special Unit + 5% resource bonus</div>
            </div>
            <div className="bg-[--void] rounded-lg p-4">
              <div className="text-[--neon-pink] font-bold mb-1">15th Referral 🥈</div>
              <div className="text-sm text-white/60">500k/500k + Silver Badge + 2 Legendary Units + "Elite Recruiter"</div>
            </div>
            <div className="bg-[--void] rounded-lg p-4">
              <div className="text-[--neon-pink] font-bold mb-1">25th Referral 👑</div>
              <div className="text-sm text-white/60">750k/750k + "Ambassador" + Prestige Unit + 10% XP bonus</div>
            </div>
            <div className="bg-[--void] rounded-lg p-4">
              <div className="text-[--neon-pink] font-bold mb-1">50th Referral 🥇</div>
              <div className="text-sm text-white/60">625k/625k + Gold Badge + 10% resource boost + "Legendary Recruiter"</div>
            </div>
            <div className="bg-[--void] rounded-lg p-4">
              <div className="text-[--neon-pink] font-bold mb-1">100th Referral 💎</div>
              <div className="text-sm text-white/60">150k/150k + Diamond Badge + 25% all bonuses + 3,000 RP + "Empire Builder"</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[--card] border border-[--electric]/20 rounded-lg p-6">
        <h3 className="text-xl font-bold text-[--electric] mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-[--neon-yellow] mb-2">❓ Why is there a validation period?</h4>
            <p className="text-white/60">
              To prevent abuse and ensure rewards go to legitimate recruiters who bring active players.
              The 7-day + 4 login requirement filters out fake accounts.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[--neon-yellow] mb-2">❓ What happens if someone uses my code but doesn't complete validation?</h4>
            <p className="text-white/60">
              They'll show as "Pending" in your dashboard. If they don't meet the requirements within 7 days,
              they'll be flagged as invalid and won't count toward your rewards.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[--neon-yellow] mb-2">❓ Is there a limit to how many people I can refer?</h4>
            <p className="text-white/60">
              No! You can refer unlimited players. However, VIP days cap at 30 total, and resource scaling
              caps at 2.0x (reached at 15 referrals).
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[--neon-yellow] mb-2">❓ Can I refer multiple accounts from the same IP?</h4>
            <p className="text-white/60">
              We track IP addresses to prevent abuse. Multiple accounts from the same IP will be flagged
              and may not validate. Each referral should be a unique, active player.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[--neon-yellow] mb-2">❓ How do I track my progress?</h4>
            <p className="text-white/60">
              Use the Dashboard tab to see your referral stats, pending validations, total rewards earned,
              and progress toward the next milestone.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[--neon-yellow] mb-2">❓ What do the badges and titles do?</h4>
            <p className="text-white/60">
              Badges and titles are cosmetic achievements that show your recruiting prowess.
              They're displayed on leaderboards and in-game. Some provide passive bonuses!
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[--synth]/5 border border-[--synth]/20 rounded-lg p-6">
        <h3 className="text-xl font-bold text-[--synth] mb-4">💡 Pro Tips</h3>
        <ul className="space-y-3 text-white/60">
          <li className="flex gap-3">
            <span className="text-[--synth]">✓</span>
            <span>Share your link on social media and gaming communities for maximum reach</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[--synth]">✓</span>
            <span>Help your referrals get started! Active players = validated rewards for you</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[--synth]">✓</span>
            <span>Target milestone numbers (3, 5, 10, 15, etc.) for huge bonus rewards</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[--synth]">✓</span>
            <span>VIP caps at 30 days total, so early referrals maximize VIP rewards</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[--synth]">✓</span>
            <span>The 100-referral milestone gives 3,000 RP - enough for significant WMD tech unlocks!</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
