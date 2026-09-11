/**
 * @file components/MovementControls.tsx
 * @created 2025-10-16
 * @overview 9-direction movement compass with keyboard support
 */

'use client';

import React, { useEffect } from 'react';
import { logger } from '@/lib/logger';
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

      // Modifier-held presses belong to hotkey combos (Shift+E = Beer Bases,
      // etc.) — movement claims the BARE keys only. KeyToDirection matches
      // uppercase letters too ('D'), which would otherwise double-fire.
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      const direction = KeyToDirection[event.key];
      if (direction && !isLoading) {
        logger.debug(`[MovementControls] Received '${event.key}' keypress - moving ${direction}`);
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

  // NEON NOIR §5.1: D-pad as HUD cluster — pressed-state glow via .nn-dpad__btn
  const buttonClass = 'nn-dpad__btn';

  // center refresh key keeps its green (success) signal identity
  const refreshButtonClass = 'nn-dpad__btn nn-dpad__btn--refresh';

  return (
    <div>
      {/* Compass Grid — sample `.dpad`: arrow glyph + letter sub-label */}
      <div className="nn-dpad mb-2">
        {/* Row 1 */}
        <button
          onClick={() => handleMove(MovementDirection.Northwest)}
          disabled={isLoading}
          className={buttonClass}
          title="Northwest (Q / 7)"
        >
          ↖<small>Q</small>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.North)}
          disabled={isLoading}
          className={buttonClass}
          title="North (W / 8 / ↑)"
        >
          ↑<small>W</small>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.Northeast)}
          disabled={isLoading}
          className={buttonClass}
          title="Northeast (E / 9)"
        >
          ↗<small>E</small>
        </button>

        {/* Row 2 */}
        <button
          onClick={() => handleMove(MovementDirection.West)}
          disabled={isLoading}
          className={buttonClass}
          title="West (A / 4 / ←)"
        >
          ←<small>A</small>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.Refresh)}
          disabled={isLoading}
          className={refreshButtonClass}
          title="Refresh (S / 5)"
        >
          ⟳<small>S</small>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.East)}
          disabled={isLoading}
          className={buttonClass}
          title="East (D / 6 / →)"
        >
          →<small>D</small>
        </button>

        {/* Row 3 */}
        <button
          onClick={() => handleMove(MovementDirection.Southwest)}
          disabled={isLoading}
          className={buttonClass}
          title="Southwest (Z / 1)"
        >
          ↙<small>Z</small>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.South)}
          disabled={isLoading}
          className={buttonClass}
          title="South (X / 2 / ↓)"
        >
          ↓<small>X</small>
        </button>
        <button
          onClick={() => handleMove(MovementDirection.Southeast)}
          disabled={isLoading}
          className={buttonClass}
          title="Southeast (C / 3)"
        >
          ↘<small>C</small>
        </button>
      </div>

      <p className="nn-footnote" style={{ letterSpacing: '0.1em', paddingBottom: 14 }}>
        PRESS A KEY OR CLICK A DIRECTION
      </p>
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
