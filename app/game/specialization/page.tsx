'use client';

import React from 'react';
import { useGameContext } from '@/context/GameContext';
import { SpecializationPanel } from '@/components';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

export default function SpecializationPage() {
  const { player } = useGameContext();

  if (!player) return null;

  if (player.level < 15) {
    return (
      <>
        <TopNavBar />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] flex items-center justify-center p-6">
              <div className="max-w-md text-center space-y-4">
                <h1 className="text-2xl font-bold text-[--neon-pink]">Level 15 Required</h1>
                <p className="text-white/60">
                  You must reach level 15 to access the Specialization system.
                </p>
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
          <div className="h-full w-full overflow-auto bg-[--void] p-6">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-bold text-[--neon-pink] mb-2">
                Specialization Doctrine
              </h1>
              <p className="text-white/60 mb-6">
                Choose your path and master your doctrine to unlock powerful bonuses.
              </p>
              <SpecializationPanel />
            </div>
          </div>
        }
      />
    </>
  );
}
