/**
 * @file app/clan/page.tsx
 * @created 2025-10-19
 * @overview Dedicated clan management page (replaces overlay modal)
 * 
 * OVERVIEW:
 * Full-page clan interface showing all clan management features in a dedicated route.
 * Displays the 8-tab ClanPanel component or prompts user to create/join a clan.
 * 
 * FEATURES:
 * - No overlay/modal - proper page navigation
 * - Back button to return to game
 * - Shows ClanPanel with all 8 tabs if player is in a clan
 * - Shows Create/Join prompts if player has no clan
 * - Level 10+ requirement enforced
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { ClanPanel } from '@/components/clan';

import { ArrowLeft, Users, Crown } from 'lucide-react';

export default function ClanPage() {
  const { player, isLoading } = useGameContext();
  const router = useRouter();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-bg-void via-bg-space to-black text-[color:var(--nn-text-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="rounded-none h-16 w-16 border-t-2 border-b-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] mx-auto mb-4"></div>
          <p className="text-xl text-[color:var(--nn-text-primary)]/70">Loading clan data...</p>
        </div>
      </div>
    );
  }

  // No player - redirect to login
  if (!player) {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return null;
  }

  // Level requirement check
  if (player.level < 10) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-bg-void via-bg-space to-black text-[color:var(--nn-text-primary)]">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Back Button */}
          <div className="mb-6">
            <button 
              onClick={() => router.push('/game')} className="nn-btn nn-btn--ghost gap-2 text-[color:var(--nn-cyan)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Game
            </button>
          </div>

          {/* Level Requirement Message */}
          <div className="nn-surface nn-surface--dark backdrop-blur-sm border-2 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-8 text-center">
            <Crown className="w-16 h-16 text-[color:var(--nn-amber)] mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-[color:var(--nn-text-primary)] mb-3">Level Requirement</h1>
            <p className="nn-text-primary text-lg mb-4">
              You must reach <span className="text-[color:var(--nn-amber)] font-bold">Level 10</span> to access clan features.
            </p>
            <p className="nn-text-secondary mb-6">
              Current Level: <span className="text-[color:var(--nn-cyan)] font-bold">{player.level}</span>
            </p>
            <button onClick={() => router.push('/game')} className="nn-btn bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]">
              Return to Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Player has a clan - show ClanPanel
  if (player.clanId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-bg-void via-bg-space to-black text-[color:var(--nn-text-primary)]">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Back Button */}
          <div className="mb-6">
            <button 
              onClick={() => router.push('/game')} className="nn-btn nn-btn--ghost gap-2 text-[color:var(--nn-cyan)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Game
            </button>
          </div>

          {/* ClanPanel Component - Pass required props */}
          <ClanPanel isOpen={true} onClose={() => router.push('/game')} />
        </div>
      </div>
    );
  }

  // Player has no clan - show create/join options
  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-void via-bg-space to-black text-[color:var(--nn-text-primary)]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <button 
            onClick={() => router.push('/game')} className="nn-btn nn-btn--ghost gap-2 text-[color:var(--nn-cyan)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Game
          </button>
        </div>

        {/* No Clan State */}
        <div className="nn-surface nn-surface--dark backdrop-blur-sm border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-8">
          <div className="text-center mb-8">
            <Users className="w-20 h-20 text-[color:var(--nn-cyan)] mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-[color:var(--nn-text-primary)] mb-3">You{"'"}re Not in a Clan</h1>
            <p className="nn-text-primary text-lg">
              Join forces with other players or create your own clan to unlock exclusive benefits, 
              territory control, and cooperative gameplay features.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 max-w-md mx-auto">
            <button 
              onClick={() => router.push('/clans')}
              className="nn-btn w-full bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] py-4 text-lg font-bold"
            >
              <Users className="w-5 h-5 mr-2" />
              Browse & Join Clans
            </button>
            <button 
              onClick={() => router.push('/clans')} className="nn-btn w-full border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-cyan)] py-4 text-lg font-bold"
            >
              <Crown className="w-5 h-5 mr-2" />
              Create New Clan
            </button>
          </div>

          {/* Clan Benefits */}
          <div className="mt-8 pt-8 border-t border-[color:var(--nn-glass-border)]">
            <h3 className="text-lg font-bold text-[color:var(--nn-cyan)] mb-4">Clan Benefits:</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 nn-text-primary">
              <li className="flex items-start gap-2">
                <span className="text-[color:var(--nn-green)]">✓</span>
                <span>Shared resources and clan bank</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[color:var(--nn-green)]">✓</span>
                <span>Territory control and passive income</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[color:var(--nn-green)]">✓</span>
                <span>Cooperative research and perks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[color:var(--nn-green)]">✓</span>
                <span>Clan warfare and alliances</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[color:var(--nn-green)]">✓</span>
                <span>Exclusive clan chat and coordination</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[color:var(--nn-green)]">✓</span>
                <span>Clan leaderboards and rankings</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
