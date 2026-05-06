/**
 * @file components/ControlsPanel.tsx
 * @created 2025-10-16
 * @overview Right panel with movement controls, position info, and logout
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import MovementControls from './MovementControls';

export default function ControlsPanel() {
  const { player, currentTile, isLoading, error, setPlayer, setCurrentTile } = useGameContext();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Logged out successfully');
        // Clear context
        setPlayer(null);
        setCurrentTile(null);
        // Redirect to login
        router.push('/login');
      } else {
        console.error('❌ Logout failed:', data.error);
      }
    } catch (err) {
      console.error('❌ Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Position Info */}
      {player && (
        <div className="bg-gray-700 rounded-lg p-4">
          <h2 className="text-xl font-bold text-blue-400 mb-3">Position</h2>
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-green-400">
              ({player.currentPosition.x}, {player.currentPosition.y})
            </div>
            {currentTile && (
              <div className="mt-2 text-sm text-gray-400">
                Terrain: <span className="text-white font-semibold">{currentTile.terrain}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="bg-blue-900 rounded-lg p-3 text-center">
          <p className="text-blue-300">⏳ Processing...</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-900 rounded-lg p-3 text-center">
          <p className="text-red-300">❌ {error}</p>
        </div>
      )}

      {/* Movement Controls */}
      <MovementControls />

      {/* Instructions */}
      <div className="bg-gray-700 rounded-lg p-4 text-sm text-gray-300">
        <h3 className="font-bold text-white mb-2">How to Play:</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li>Use QWEASDZXC keys to move</li>
          <li>Press S to refresh current tile</li>
          <li>Press G to gather resources (Metal/Energy)</li>
          <li>Press F to explore caves</li>
          <li>Press R for factory operations</li>
          <li>Press U to build units (anywhere)</li>
          <li>Press M for factory management</li>
          <li>Press T for tier unlocks & research</li>
          <li>Press B for banking (at Bank tiles)</li>
          <li>Map wraps at edges (150→1)</li>
        </ul>
      </div>

      {/* Logout Button */}
      {player && (
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
            isLoggingOut
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/50'
          }`}
        >
          {isLoggingOut ? 'Logging out...' : 'LOGOUT'}
        </button>
      )}
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
