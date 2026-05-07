'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { AutoFarmStatus } from '@/types/autoFarm.types';
import { CARD, CARD_HEADER, CARD_BODY, ACCENT_PINK, TABLE, TABLE_ROW_EVEN, TABLE_ROW_ODD, TABLE_LABEL, TABLE_VALUE, TABLE_DIM, BTN, BTN_SUCCESS, BTN_DANGER, BTN_WARNING, BTN_GHOST, BTN_DISABLED, DOT_GREEN, DOT_YELLOW, DOT_GRAY, DIVIDER } from '@/components/ui/design';

interface AutoFarmPanelProps {
  status: AutoFarmStatus; tilesCompleted: number; lastAction?: string; isVIP?: boolean;
  onStart: () => void; onPause: () => void; onResume: () => void; onStop: () => void;
}

export default function AutoFarmPanel({ status, tilesCompleted, lastAction = 'Ready', isVIP = false, onStart, onPause, onResume, onStop }: AutoFarmPanelProps) {
  const router = useRouter();
  const isActive = status === AutoFarmStatus.ACTIVE;
  const isPaused = status === AutoFarmStatus.PAUSED;
  const isStopped = status === AutoFarmStatus.STOPPED;

  return (
    <div className={CARD}>
      <div className={`${CARD_HEADER} ${ACCENT_PINK}`}>
        <span className="text-base">🤖</span>
        <span>Auto-Farm</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ml-auto ${isVIP ? 'bg-[--neon-yellow]/10 border-[--neon-yellow]/25 text-[--neon-yellow]' : 'bg-white/[0.04] border-[--border] text-[--text-3]'}`}>
          {isVIP ? '⚡ VIP' : 'BASIC'}
        </span>
      </div>

      <div className={CARD_BODY}>
        {/* Status */}
        <div className="flex items-center justify-between bg-[--row-even] rounded px-2 py-1 mb-1.5">
          <span className="text-xs text-[--text-2]">Status</span>
          <div className="flex items-center gap-1.5">
            <span className={isActive ? DOT_GREEN : isPaused ? DOT_YELLOW : DOT_GRAY} />
            <span className={`text-xs font-bold ${isActive ? 'text-[--synth]' : isPaused ? 'text-[--neon-yellow]' : 'text-[--text-3]'}`}>
              {isActive ? '● Active' : isPaused ? '● Paused' : '○ Stopped'}
            </span>
          </div>
        </div>

        {!isStopped && (
          <>
            <table className={TABLE}>
              <tbody>
                <tr className={TABLE_ROW_EVEN}><td className={TABLE_LABEL}>Tiles</td><td className={`${TABLE_VALUE} text-[--electric] font-mono`}>{tilesCompleted.toLocaleString()} / 22,500</td></tr>
                <tr className={TABLE_ROW_ODD}><td className={TABLE_LABEL}>Progress</td><td className={`${TABLE_VALUE} text-[--electric] font-mono`}>{((tilesCompleted / 22500) * 100).toFixed(2)}%</td></tr>
                <tr className={TABLE_ROW_EVEN}><td className={TABLE_LABEL}>Last</td><td className={`${TABLE_VALUE} ${isActive ? 'text-[--synth]' : 'text-[--neon-yellow]'}`}>{isActive ? lastAction : 'Paused'}</td></tr>
              </tbody>
            </table>

            <div className="w-full bg-white/[0.04] rounded-full h-1.5 overflow-hidden my-1.5">
              <div className="h-full bg-[--electric] transition-all duration-300 rounded-full" style={{ width: `${Math.min((tilesCompleted / 22500) * 100, 100)}%` }} />
            </div>

            <div className={`flex justify-between items-center rounded px-2 py-1 border mb-1.5 ${isVIP ? 'bg-[--neon-yellow]/5 border-[--neon-yellow]/15' : 'bg-[--row-even] border-[--border]'}`}>
              <span className="text-xs text-[--text-3]">Speed</span>
              <span className={`text-xs font-bold ${isVIP ? 'text-[--neon-yellow]' : 'text-[--text-3]'}`}>{isVIP ? '⚡ VIP — 5.6 hrs' : '🐢 Basic — 11.6 hrs'}</span>
            </div>
          </>
        )}

        {/* Controls */}
        <div className="space-y-1 mb-1.5">
          {isStopped && <button onClick={onStart} className={`${BTN} ${BTN_SUCCESS} w-full py-2 text-sm font-bold`}>▶ Start Auto-Farm</button>}
          {isActive && (
            <div className="grid grid-cols-2 gap-1">
              <button onClick={onPause} className={`${BTN} ${BTN_WARNING} font-bold`}>⏸ Pause</button>
              <button onClick={onStop} className={`${BTN} ${BTN_DANGER} font-bold`}>⏹ Stop</button>
            </div>
          )}
          {isPaused && (
            <div className="grid grid-cols-2 gap-1">
              <button onClick={onResume} className={`${BTN} ${BTN_SUCCESS} font-bold`}>▶ Resume</button>
              <button onClick={onStop} className={`${BTN} ${BTN_DANGER} font-bold`}>⏹ Stop</button>
            </div>
          )}
        </div>

        <p className="text-[10px] text-[--text-3] text-center">
          {isStopped && 'Configure settings and start farming'}
          {isActive && 'Auto-farming in progress...'}
          {isPaused && 'Paused — resume anytime'}
        </p>

        {!isVIP && (
          <div className={`mt-1.5 pt-1.5 ${DIVIDER}`}>
            <button onClick={() => router.push('/game/vip-upgrade')} className={`${BTN} ${BTN_GHOST} w-full border-[--neon-yellow]/20 text-[--neon-yellow] hover:bg-[--neon-yellow]/10 font-bold`}>
              ⚡ Get VIP — 2x Speed
            </button>
            <p className="text-[10px] text-[--text-3] text-center mt-1">5.6 hrs instead of 11.6 hrs</p>
          </div>
        )}
      </div>
    </div>
  );
}