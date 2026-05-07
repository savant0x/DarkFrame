'use client';

import React, { useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { MovementDirection, KeyToDirection } from '@/types';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

interface MovementControlsProps { onBeforeMove?: () => void; }

export default function MovementControls({ onBeforeMove }: MovementControlsProps) {
  const { movePlayer, isLoading } = useGameContext();

  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      if (isTypingInInput()) return;
      const direction = KeyToDirection[event.key];
      if (direction && !isLoading) { event.preventDefault(); onBeforeMove?.(); movePlayer(direction); }
    }
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [movePlayer, isLoading, onBeforeMove]);

  function handleMove(direction: MovementDirection) { if (!isLoading) { onBeforeMove?.(); movePlayer(direction); } }

  return (
    <div>
      <div className="bg-gradient-to-r from-[--electric]/10 to-transparent border-b border-white/10 px-3 py-1.5 mb-2">
        <h3 className="text-xs font-bold text-white">🎮 MOVEMENT</h3>
      </div>
      <div className="grid grid-cols-3 gap-1 mb-2">
        <button onClick={() => handleMove(MovementDirection.Northwest)} disabled={isLoading} className="aspect-square bg-white/5 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-150 border border-white/10 hover:border-[--electric]/25 hover:shadow-[0_0_8px_rgba(0,127,255,0.15)] active:scale-95 flex flex-col items-center justify-center gap-0.5"><span className="text-base">↖</span><span className="text-[10px] text-white/50">Q</span></button>
        <button onClick={() => handleMove(MovementDirection.North)} disabled={isLoading} className="aspect-square bg-white/5 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-150 border border-white/10 hover:border-[--electric]/25 hover:shadow-[0_0_8px_rgba(0,127,255,0.15)] active:scale-95 flex flex-col items-center justify-center gap-0.5"><span className="text-base">↑</span><span className="text-[10px] text-white/50">W</span></button>
        <button onClick={() => handleMove(MovementDirection.Northeast)} disabled={isLoading} className="aspect-square bg-white/5 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-150 border border-white/10 hover:border-[--electric]/25 hover:shadow-[0_0_8px_rgba(0,127,255,0.15)] active:scale-95 flex flex-col items-center justify-center gap-0.5"><span className="text-base">↗</span><span className="text-[10px] text-white/50">E</span></button>
        <button onClick={() => handleMove(MovementDirection.West)} disabled={isLoading} className="aspect-square bg-white/5 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-150 border border-white/10 hover:border-[--electric]/25 hover:shadow-[0_0_8px_rgba(0,127,255,0.15)] active:scale-95 flex flex-col items-center justify-center gap-0.5"><span className="text-base">←</span><span className="text-[10px] text-white/50">A</span></button>
        <button onClick={() => handleMove(MovementDirection.Refresh)} disabled={isLoading} className="aspect-square bg-white/5 hover:bg-[--synth]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-150 border border-white/10 hover:border-[--synth]/25 hover:shadow-[0_0_8px_rgba(0,255,0,0.15)] active:scale-95 flex flex-col items-center justify-center gap-0.5"><span className="text-base">⟳</span><span className="text-[10px] text-white/50">S</span></button>
        <button onClick={() => handleMove(MovementDirection.East)} disabled={isLoading} className="aspect-square bg-white/5 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-150 border border-white/10 hover:border-[--electric]/25 hover:shadow-[0_0_8px_rgba(0,127,255,0.15)] active:scale-95 flex flex-col items-center justify-center gap-0.5"><span className="text-base">→</span><span className="text-[10px] text-white/50">D</span></button>
        <button onClick={() => handleMove(MovementDirection.Southwest)} disabled={isLoading} className="aspect-square bg-white/5 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-150 border border-white/10 hover:border-[--electric]/25 hover:shadow-[0_0_8px_rgba(0,127,255,0.15)] active:scale-95 flex flex-col items-center justify-center gap-0.5"><span className="text-base">↙</span><span className="text-[10px] text-white/50">Z</span></button>
        <button onClick={() => handleMove(MovementDirection.South)} disabled={isLoading} className="aspect-square bg-white/5 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-150 border border-white/10 hover:border-[--electric]/25 hover:shadow-[0_0_8px_rgba(0,127,255,0.15)] active:scale-95 flex flex-col items-center justify-center gap-0.5"><span className="text-base">↓</span><span className="text-[10px] text-white/50">X</span></button>
        <button onClick={() => handleMove(MovementDirection.Southeast)} disabled={isLoading} className="aspect-square bg-white/5 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-150 border border-white/10 hover:border-[--electric]/25 hover:shadow-[0_0_8px_rgba(0,127,255,0.15)] active:scale-95 flex flex-col items-center justify-center gap-0.5"><span className="text-base">↘</span><span className="text-[10px] text-white/50">C</span></button>
      </div>
      <p className="text-center text-xs text-white/40">Keys: QWEASDZXC · Numpad 1-9 · Arrows</p>
    </div>
  );
}