'use client';

import { useState } from 'react';
import { type FlagBearer, type FlagTrackerData, CompassDirection, FLAG_CONFIG } from '@/types/flag.types';
import { buildTrackerData, formatDistance, getCompassArrow, formatHoldDuration, getTimeRemaining, isFlagExpiringSoon } from '@/lib/flagService';
import { CARD, CARD_BODY, TABLE, TABLE_ROW_EVEN, TABLE_ROW_ODD, TABLE_LABEL, TABLE_VALUE, TABLE_DIM, BTN, BTN_PRIMARY, BTN_DANGER, BTN_DISABLED } from '@/components/ui/design';

interface FlagTrackerPanelProps {
  playerPosition: { x: number; y: number };
  flagBearer: FlagBearer | null;
  onTrack?: (bearer: FlagBearer) => void;
  onChallenge?: (bearer: FlagBearer) => void;
  challengeOnCooldown?: boolean;
  cooldownRemaining?: number;
  compact?: boolean;
}

export default function FlagTrackerPanel({ playerPosition, flagBearer, onTrack, onChallenge, challengeOnCooldown = false, cooldownRemaining = 0 }: FlagTrackerPanelProps) {
  const tracker = buildTrackerData(flagBearer, playerPosition);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const { bearer, distance, direction, inChallengeRange } = tracker;

  if (!bearer) {
    return (
      <div className={CARD + ' p-2.5'}>
        <div className="flex items-center gap-2">
          <span className="text-base">🏳</span>
          <div>
            <h3 className="text-xs font-bold text-[--text-2]">No Flag Bearer</h3>
            <p className="text-xs text-[--text-3]">The flag is unclaimed</p>
          </div>
        </div>
      </div>
    );
  }
  const compassArrow = getCompassArrow(direction);
  const timeRemaining = getTimeRemaining(bearer.holdDuration);
  const isExpiringSoon = isFlagExpiringSoon(bearer.holdDuration);

  const ok = inChallengeRange;
  // Match the shrine design: use accent border on card, subtle gradient on header
  const accentBorder = ok ? 'border-[--synth]/25' : 'border-[--solar]/25';
  const headerGradient = ok ? 'bg-gradient-to-r from-[--synth]/8 to-transparent' : 'bg-gradient-to-r from-[--solar]/8 to-transparent';
  const badgeClass = ok
    ? 'bg-[--synth]/10 border border-[--synth]/20 text-[--synth]'
    : 'bg-[--solar]/10 border border-[--solar]/20 text-[--solar]';

  return (
    <div className={`${CARD} ${accentBorder}`} style={{ borderWidth: '1px' }}>
      {/* Header — matches shrine style: gradient + bold text + badge */}
      <div className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/[0.03] transition-colors ${headerGradient}`} style={{ borderBottom: '1px solid var(--border)' }} onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}>
        <span className="text-[13px] font-bold text-[--text-1]">🏴 Flag Bearer</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>{ok ? 'IN RANGE' : 'OUT OF RANGE'}</span>
          <span className="text-xs text-[--text-3]">{isPanelCollapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!isPanelCollapsed && (
        <div className={CARD_BODY}>
          {/* Range status badge */}
          <div className={`rounded px-2 py-1.5 text-center text-xs font-bold mb-2 ${badgeClass}`}>
            {ok ? `✓ IN RANGE (≤${FLAG_CONFIG.CHALLENGE_RANGE})` : `✗ OUT OF RANGE (+${distance - FLAG_CONFIG.CHALLENGE_RANGE} tiles)`}
          </div>

          {/* Info table — matches shrine: alternating row-even/row-odd, same cell padding */}
          <table className={TABLE + ' mb-2'}>
            <tbody>
              <tr className={TABLE_ROW_EVEN}>
                <td className={TABLE_LABEL}>Player</td>
                <td className={TABLE_VALUE}>{bearer.username}</td>
                <td className={TABLE_DIM}>Lv.{bearer.level}</td>
              </tr>
              <tr className={TABLE_ROW_ODD}>
                <td className={TABLE_LABEL}>Location</td>
                <td className={TABLE_VALUE + ' font-mono'}>({bearer.position.x}, {bearer.position.y})</td>
                <td className={TABLE_VALUE + ' text-[--electric] font-mono'}>{formatDistance(distance)}</td>
              </tr>
              <tr className={TABLE_ROW_EVEN}>
                <td className={TABLE_LABEL}>Direction</td>
                <td className={TABLE_VALUE}>{compassArrow} {direction}</td>
                <td></td>
              </tr>
              {bearer.currentHP !== undefined && bearer.maxHP !== undefined && (
                <tr className={TABLE_ROW_ODD}>
                  <td className={TABLE_LABEL}>Health</td>
                  <td colSpan={2}>
                    <div className="bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                      <div className="bg-[--neon-red] h-full transition-all rounded-full" style={{ width: `${(bearer.currentHP / bearer.maxHP) * 100}%` }} />
                    </div>
                    <div className="text-[10px] text-[--text-3] mt-0.5 font-mono">{bearer.currentHP.toLocaleString()} / {bearer.maxHP.toLocaleString()}</div>
                  </td>
                </tr>
              )}
              <tr className={TABLE_ROW_EVEN}>
                <td className={TABLE_LABEL}>Holding</td>
                <td className={TABLE_VALUE + ' font-mono'} colSpan={2}>{formatHoldDuration(bearer.holdDuration)} ({timeRemaining})</td>
              </tr>
            </tbody>
          </table>

          {/* Action buttons — full width, equal size */}
          <div className="flex gap-1">
            <button onClick={() => onTrack?.(bearer)} className={`${BTN} ${BTN_PRIMARY} flex-1 font-bold`}>🔍 Track</button>
            <button
              onClick={() => onChallenge?.(bearer)}
              disabled={!ok || challengeOnCooldown}
              className={`flex-1 font-bold py-1.5 px-2 rounded text-xs transition-all ${!ok || challengeOnCooldown ? BTN_DISABLED + ' bg-white/5 border border-[--border]' : `${BTN} ${BTN_DANGER} font-bold`}`}
            >
              ⚔ {challengeOnCooldown ? `Wait ${cooldownRemaining}s` : 'Challenge'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}