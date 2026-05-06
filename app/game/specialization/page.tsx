/**
 * @file app/game/specialization/page.tsx
 * @created 2025-10-18
 * @overview Specialization page route for player doctrine selection
 * 
 * OVERVIEW:
 * Dedicated page for specialization system, moved from overlay modal.
 * Players level 15+ can select and manage their doctrine specialization.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { SpecializationPanel } from '@/components';
import { ArrowLeft } from 'lucide-react';

export default function SpecializationPage() {
  const router = useRouter();
  const { player } = useGameContext();

  if (!player) {
    return (
      <div className="min-h-screen bg-space-darker flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (player.level < 15) {
    return (
      <div className="min-h-screen bg-space-darker flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-neon-cyan font-display">Level 15 Required</h1>
          <p className="text-text-secondary">
            You must reach level 15 to access the Specialization system.
          </p>
          <button
            onClick={() => router.push('/game')}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all duration-300"
          >
            <ArrowLeft className="inline w-4 h-4 mr-2" />
            Back to Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space-darker p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <button
          onClick={() => router.push('/game')}
          className="flex items-center gap-2 text-neon-cyan hover:text-cyan-300 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold">Back to Game</span>
        </button>
        <h1 className="text-3xl font-bold text-neon-cyan font-display">
          Specialization Doctrine
        </h1>
        <p className="text-text-secondary mt-2">
          Choose your path and master your doctrine to unlock powerful bonuses.
        </p>
      </div>

      {/* Specialization Panel */}
      <div className="max-w-6xl mx-auto">
        <SpecializationPanel />
      </div>
    </div>
  );
}
