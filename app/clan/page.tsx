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
import { Button } from '@/components/ui';
import { ArrowLeft, Users, Crown } from 'lucide-react';

export default function ClanPage() {
  const { player, isLoading } = useGameContext();
  const router = useRouter();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-xl text-white/70">Loading clan data...</p>
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
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Back Button */}
          <div className="mb-6">
            <Button 
              onClick={() => router.push('/game')} 
              variant="ghost" 
              className="gap-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Game
            </Button>
          </div>

          {/* Level Requirement Message */}
          <div className="bg-gray-900/80 backdrop-blur-sm border-2 border-yellow-500/50 rounded-lg p-8 text-center">
            <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-3">Level Requirement</h1>
            <p className="text-gray-300 text-lg mb-4">
              You must reach <span className="text-yellow-400 font-bold">Level 10</span> to access clan features.
            </p>
            <p className="text-gray-400 mb-6">
              Current Level: <span className="text-cyan-400 font-bold">{player.level}</span>
            </p>
            <Button onClick={() => router.push('/game')} className="bg-cyan-600 hover:bg-cyan-700">
              Return to Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Player has a clan - show ClanPanel
  if (player.clanId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Back Button */}
          <div className="mb-6">
            <Button 
              onClick={() => router.push('/game')} 
              variant="ghost" 
              className="gap-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Game
            </Button>
          </div>

          {/* ClanPanel Component - Pass required props */}
          <ClanPanel isOpen={true} onClose={() => router.push('/game')} />
        </div>
      </div>
    );
  }

  // Player has no clan - show create/join options
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <Button 
            onClick={() => router.push('/game')} 
            variant="ghost" 
            className="gap-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Game
          </Button>
        </div>

        {/* No Clan State */}
        <div className="bg-gray-900/80 backdrop-blur-sm border-2 border-cyan-500/30 rounded-lg p-8">
          <div className="text-center mb-8">
            <Users className="w-20 h-20 text-cyan-400 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white mb-3">You're Not in a Clan</h1>
            <p className="text-gray-300 text-lg">
              Join forces with other players or create your own clan to unlock exclusive benefits, 
              territory control, and cooperative gameplay features.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 max-w-md mx-auto">
            <Button 
              onClick={() => router.push('/clans')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg font-bold"
            >
              <Users className="w-5 h-5 mr-2" />
              Browse & Join Clans
            </Button>
            <Button 
              onClick={() => router.push('/clans')}
              variant="secondary"
              className="w-full border-cyan-500/50 hover:bg-cyan-950/30 text-cyan-400 py-4 text-lg font-bold"
            >
              <Crown className="w-5 h-5 mr-2" />
              Create New Clan
            </Button>
          </div>

          {/* Clan Benefits */}
          <div className="mt-8 pt-8 border-t border-gray-700">
            <h3 className="text-lg font-bold text-cyan-400 mb-4">Clan Benefits:</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Shared resources and clan bank</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Territory control and passive income</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Cooperative research and perks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Clan warfare and alliances</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Exclusive clan chat and coordination</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Clan leaderboards and rankings</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
