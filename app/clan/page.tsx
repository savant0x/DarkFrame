'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { ClanPanel } from '@/components/clan';
import { Button } from '@/components/ui';
import { ArrowLeft, Users, Crown } from 'lucide-react';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

export default function ClanPage() {
  const { player, isLoading } = useGameContext();
  const router = useRouter();

  if (isLoading) {
    return (
      <>
        <TopNavBar />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] text-white flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[--electric] mx-auto mb-4"></div>
                <p className="text-xl text-white/70">Loading clan data...</p>
              </div>
            </div>
          }
        />
      </>
    );
  }

  if (!player) {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return null;
  }

  if (player.level < 10) {
    return (
      <>
        <TopNavBar />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] text-white">
              <div className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="bg-[--card] border-2 border-[--neon-yellow]/20 rounded-lg p-8 text-center">
                  <Crown className="w-16 h-16 text-[--neon-yellow] mx-auto mb-4" />
                  <h1 className="text-3xl font-bold text-white mb-3">Level Requirement</h1>
                  <p className="text-white/60 text-lg mb-4">
                    You must reach <span className="text-[--neon-yellow] font-bold">Level 10</span> to access clan features.
                  </p>
                  <p className="text-white/60 mb-6">
                    Current Level: <span className="text-[--electric] font-bold">{player.level}</span>
                  </p>
                  <Button onClick={() => router.push('/game')} className="bg-[--electric] hover:opacity-80">
                    Return to Game
                  </Button>
                </div>
              </div>
            </div>
          }
        />
      </>
    );
  }

  if (player.clanId) {
    return (
      <>
        <TopNavBar />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] text-white">
              <div className="container mx-auto px-4 py-6 max-w-7xl">
                <ClanPanel isOpen={true} onClose={() => router.push('/game')} />
              </div>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] text-white">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
              <div className="bg-[--card] border-2 border-[--electric]/20 rounded-lg p-8">
                <div className="text-center mb-8">
                  <Users className="w-20 h-20 text-[--electric] mx-auto mb-4" />
                  <h1 className="text-4xl font-bold text-white mb-3">You're Not in a Clan</h1>
                  <p className="text-white/60 text-lg">
                    Join forces with other players or create your own clan to unlock exclusive benefits,
                    territory control, and cooperative gameplay features.
                  </p>
                </div>

                <div className="flex flex-col gap-4 max-w-md mx-auto">
                  <Button
                    onClick={() => router.push('/clans')}
                    className="w-full bg-[--neon-pink] hover:opacity-80 text-white py-4 text-lg font-bold"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    Browse & Join Clans
                  </Button>
                  <Button
                    onClick={() => router.push('/clans')}
                    variant="secondary"
                    className="w-full border-[--electric]/20 hover:bg-[--electric]/10 text-[--electric] py-4 text-lg font-bold"
                  >
                    <Crown className="w-5 h-5 mr-2" />
                    Create New Clan
                  </Button>
                </div>

                <div className="mt-8 pt-8 border-t border-[--border]">
                  <h3 className="text-lg font-bold text-[--electric] mb-4">Clan Benefits:</h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-white/60">
                    <li className="flex items-start gap-2">
                      <span className="text-[--synth]">✓</span>
                      <span>Shared resources and clan bank</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[--synth]">✓</span>
                      <span>Territory control and passive income</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[--synth]">✓</span>
                      <span>Cooperative research and perks</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[--synth]">✓</span>
                      <span>Clan warfare and alliances</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[--synth]">✓</span>
                      <span>Exclusive clan chat and coordination</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[--synth]">✓</span>
                      <span>Clan leaderboards and rankings</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        }
      />
    </>
  );
}
