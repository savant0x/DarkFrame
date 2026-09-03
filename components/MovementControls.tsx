/**
 * @file components/MovementControls.tsx
 * @created 2025-10-16
 * @overview 9-direction movement compass with keyboard support
 */

'use client';

import React, { useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { MovementDirection, KeyToDirection } from '@/types';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

export default function MovementControls() {
  const { movePlayer, isLoading } = useGameContext();

  /**
   * Handle keyboard input
   */
  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      // Ignore if typing in input field
      if (isTypingInInput()) {
        return;
      }

      const direction = KeyToDirection[event.key];
      if (direction && !isLoading) {
        console.log(`[MovementControls] Received '${event.key}' keypress - moving ${direction}`);
        event.preventDefault();
        movePlayer(direction);
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [movePlayer, isLoading]);

  /**
   * Handle button click
   */
  function handleMove(direction: MovementDirection) {
    if (!isLoading) {
      movePlayer(direction);
    }
  }

  const buttonClass = `
    w-14 h-14 
    bg-gray-800/60 hover:bg-cyan-500/20
    disabled:bg-gray-800/30 disabled:cursor-not-allowed
    text-white font-bold rounded-lg 
    transition-all duration-150 
    border-2 border-cyan-500/30
    shadow-[0_0_10px_rgba(0,240,255,0.2)]
    hover:border-cyan-500/50
    hover:shadow-[0_0_20px_rgba(0,240,255,0.4)]
    active:scale-95
  `;

  const refreshButtonClass = `
    w-14 h-14 
    bg-green-500/20 hover:bg-green-500/30
    disabled:bg-gray-800/30 disabled:cursor-not-allowed
    text-white font-bold rounded-lg 
    transition-all duration-150 
    border-2 border-green-500/40
    shadow-[0_0_10px_rgba(0,255,100,0.2)]
    hover:border-green-500/60
    hover:shadow-[0_0_20px_rgba(0,255,100,0.4)]
    active:scale-95
  `;

  return (
    <div>
      {/* Banner Title */}
      <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-b border-cyan-500/30 px-3 py-2 -mx-3 -mt-3 mb-3">
        <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
          🎮 MOVEMENT CONTROLS
        </h3>
      </div>
      
      {/* Compass Grid */}
      <div className="grid grid-cols-3 gap-2 w-fit mx-auto mb-3">
        {/* Row 1 */}
        <button
          onClick={() => handleMove(MovementDirection.Northwest)}
          disabled={isLoading}
          className={buttonClass}
          title="Northwest (Q / 7)"
        >
          ↖<br />
          <span className="text-xs">Q</span>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.North)}
          disabled={isLoading}
          className={buttonClass}
          title="North (W / 8 / ↑)"
        >
          ↑<br />
          <span className="text-xs">W</span>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.Northeast)}
          disabled={isLoading}
          className={buttonClass}
          title="Northeast (E / 9)"
        >
          ↗<br />
          <span className="text-xs">E</span>
        </button>

        {/* Row 2 */}
        <button
          onClick={() => handleMove(MovementDirection.West)}
          disabled={isLoading}
          className={buttonClass}
          title="West (A / 4 / ←)"
        >
          ←<br />
          <span className="text-xs">A</span>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.Refresh)}
          disabled={isLoading}
          className={refreshButtonClass}
          title="Refresh (S / 5)"
        >
          ⟳<br />
          <span className="text-xs">S</span>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.East)}
          disabled={isLoading}
          className={buttonClass}
          title="East (D / 6 / →)"
        >
          →<br />
          <span className="text-xs">D</span>
        </button>

        {/* Row 3 */}
        <button
          onClick={() => handleMove(MovementDirection.Southwest)}
          disabled={isLoading}
          className={buttonClass}
          title="Southwest (Z / 1)"
        >
          ↙<br />
          <span className="text-xs">Z</span>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.South)}
          disabled={isLoading}
          className={buttonClass}
          title="South (X / 2 / ↓)"
        >
          ↓<br />
          <span className="text-xs">X</span>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.Southeast)}
          disabled={isLoading}
          className={buttonClass}
          title="Southeast (C / 3)"
        >
          ↘<br />
          <span className="text-xs">C</span>
        </button>
      </div>

      <p className="text-center text-[10px] text-white/50">
        Use keyboard: QWEASDZXC · Numpad 1-9 · Arrow keys
      </p>
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
