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

import { ArrowLeft, Crown } from 'lucide-react';

export default function ClanPage() {
  const { player, isLoading } = useGameContext();
  const router = useRouter();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] flex items-center justify-center">
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
      <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)]">
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
      <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)]">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Back Button */}
          <div className="mb-6">
            <button 
              onClick={() => router.push('/game')} className="nn-btn nn-btn--ghost gap-2"
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

  // Player has no clan - mount the real ClanPanel so the inline Create/Join
  // forms are available here (FID-20260909-029 §2.1: the old bespoke duplicate
  // bounced to the leaderboard instead of offering the real flows, drifted
  // from NoClanView content-wise, and carried a legacy gradient wrapper).
  return (
    <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)]">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/game')} className="nn-btn nn-btn--ghost gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Game
          </button>
        </div>

        {/* ClanPanel Component - renders its NoClanView (create/join) */}
        <ClanPanel isOpen={true} onClose={() => router.push('/game')} />
      </div>
    </div>
  );
}
