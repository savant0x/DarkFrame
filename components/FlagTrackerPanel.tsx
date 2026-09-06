/**
 * @file components/FlagTrackerPanel.tsx
 * @created 2025-10-22
 * @overview Flag Tracker Panel — rewritten per FID-20260906-001 §5.8 (Option A).
 *
 * Two views, driven by the extended GET /api/flag payload:
 *  - **Bearer self-view** (viewer IS the holder): the flag's details — the full
 *    while-holding bonus stack, GROSS session earnings, flee counter, challenge
 *    grace, and the 12-hour permanent-milestone progress. This is the "panel
 *    updates and shows the details of the flag" surface from the original design.
 *  - **Tracker view** (viewer is not the holder): bearer info, location/distance,
 *    compass, and the Steal action (channel start) — the HP "Attack" battle UI is
 *    gone by design (the doc forbids flag battles).
 *
 * During an active channel: both sides see the countdown; the bearer additionally
 * sees the Flee action with its live escalating cost (or the block reason —
 * 5s lock, 60s cooldown, flee budget exhausted = auto-lose warning); the
 * challenger sees the Claim action once the channel ends.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  type FlagBearer,
  type FlagDetailPayload,
  type FlagTrackerData,
  CompassDirection,
  FLAG_CONFIG
} from '@/types/flag.types';
import {
  buildTrackerData,
  formatDistance,
  getCompassArrow,
  formatHoldDuration,
  getTimeRemaining,
  isFlagExpiringSoon
} from '@/lib/flagService';

/**
 * FlagTrackerPanel Props
 */
interface FlagTrackerPanelProps {
  /** Current player position for distance/direction calculations */
  playerPosition: { x: number; y: number };

  /** Current Flag Bearer data (from API or WebSocket) */
  flagBearer: FlagBearer | null;

  /** Extended payload (challenge/bonuses/viewer actions) — FID-20260906-001 §5.8 */
  flagDetail?: FlagDetailPayload | null;

  /** Callback when user clicks Track button */
  onTrack?: (bearer: FlagBearer) => void;

  /** Callback when viewer (non-bearer) starts a steal challenge */
  onChallenge?: () => void;

  /** Callback when viewer (bearer) flees the active channel */
  onFlee?: () => void;

  /** Callback when viewer (challenger) claims at channel end */
  onClaim?: () => void;

  /** Compact mode for mobile */
  compact?: boolean;
}

/**
 * Format a resource count compactly (12,500 -> 12.5k, 1,200,000 -> 1.2M).
 */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function FlagTrackerPanel({
  playerPosition,
  flagBearer,
  flagDetail,
  onTrack,
  onChallenge,
  onFlee,
  onClaim,
  compact = false
}: FlagTrackerPanelProps) {
  const router = useRouter();
  const [trackerData, setTrackerData] = useState<FlagTrackerData | null>(null);

  // Main panel collapse state
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Collapsible section state (individual sections)
  const [showBearerInfo, setShowBearerInfo] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showCompass, setShowCompass] = useState(true);

  // Calculate tracker data whenever bearer or player position changes
  useEffect(() => {
    const data = buildTrackerData(flagBearer, playerPosition);
    setTrackerData(data);
  }, [flagBearer, playerPosition]);

  // No bearer - show empty state
  if (!flagBearer || !trackerData) {
    return (
      <div className="bg-gray-900 border-2 border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🏳️</div>
          <div>
            <h3 className="text-lg font-bold text-gray-400">No Flag Bearer</h3>
            <p className="text-sm text-gray-500">The flag is currently unclaimed</p>
          </div>
        </div>
      </div>
    );
  }

  const { bearer, distance, direction, inAttackRange } = trackerData;

  // TypeScript safety: bearer is guaranteed non-null here due to early return above
  if (!bearer) return null;

  const isBearerViewer = flagDetail?.actions.isBearer ?? false;
  const isChallengerViewer = flagDetail?.actions.isChallenger ?? false;
  const challenge = flagDetail?.challenge ?? null;
  const bonuses = flagDetail?.bonuses ?? null;
  const actions = flagDetail?.actions;

  const compassArrow = getCompassArrow(direction);
  const timeRemaining = getTimeRemaining(bearer.holdDuration);
  const isExpiringSoon = isFlagExpiringSoon(bearer.holdDuration);

  // ============================================================
  // BEARER SELF-VIEW — the holder sees the flag's details
  // ============================================================
  if (isBearerViewer) {
    const fleeCount = challenge?.fleeCount ?? 0;
    const maxFlees = challenge?.maxFlees ?? 5;
    // 12-hour milestone progress (doc: hold 12h = permanent +2% harvest).
    const milestonePct = Math.min(100, (bearer.holdDuration / (12 * 3600)) * 100);

    return (
      <div className="bg-gray-900 border-2 border-yellow-500 rounded-lg overflow-hidden transition-all duration-300">
        {/* Header */}
        <div
          className="bg-gray-800 border-b border-yellow-700 cursor-pointer hover:bg-gray-750 transition-colors"
          onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl animate-pulse">👑</div>
              <div>
                <h3 className="text-lg font-bold text-yellow-300">You hold the Flag!</h3>
                <p className="text-xs text-yellow-200/70">Ultimate bonuses active — you are a glowing target</p>
              </div>
            </div>
            <span className="text-gray-400 text-xl">{isPanelCollapsed ? '▶' : '▼'}</span>
          </div>
        </div>

        {!isPanelCollapsed && (
          <div className="p-4 space-y-3">
            {/* Active challenge warning (bearer side) */}
            {challenge && (
              <div className="bg-red-950/60 border-2 border-red-500 rounded-lg p-3 animate-pulse">
                <div className="text-sm font-bold text-red-300 mb-1">
                  🚨 FLAG CHALLENGE — {challenge.challenger} is stealing your Flag!
                </div>
                <div className="text-xs text-red-200/80">
                  Channel ends in <span className="font-bold">{challenge.secondsRemaining}s</span>
                  {!challenge.canFlee && challenge.fleeBlockReason && (
                    <> — ⚠️ {challenge.fleeBlockReason}</>
                  )}
                  {challenge.fleeCount >= (challenge.maxFlees ?? 5) - 0 && challenge.fleeCount >= 5 && (
                    <> — AUTO-LOSS: the Flag transfers when the channel ends.</>
                  )}
                </div>
                <button
                  onClick={() => onFlee && onFlee()}
                  disabled={!challenge.canFlee}
                  className={`mt-2 w-full font-bold py-2 px-3 rounded-lg transition-colors text-sm ${
                    challenge.canFlee
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                  title={
                    challenge.canFlee
                      ? `Cost: ${challenge.fleeCostMetal.toLocaleString()} Metal + ${challenge.fleeCostEnergy.toLocaleString()} Energy (paid to the challenger), then a 5-tile dash`
                      : challenge.fleeBlockReason ?? 'Cannot flee right now'
                  }
                >
                  🏃 Flee — costs {formatCompact(challenge.fleeCostMetal)}⚙️ / {formatCompact(challenge.fleeCostEnergy)}⚡
                </button>
              </div>
            )}

            {/* Bonus stack */}
            {bonuses && (
              <div className="bg-gray-800 rounded-lg overflow-hidden border border-yellow-700/50">
                <div className="px-3 py-2 bg-yellow-900/30 border-b border-yellow-700/50">
                  <span className="text-xs font-bold text-yellow-300">⚡ ACTIVE BONUSES (while holding)</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 px-3 py-3 text-xs">
                  <div className="flex justify-between"><span className="text-gray-400">Harvest</span><span className="text-green-400 font-bold">+{Math.round((bonuses.harvestMultiplier - 1) * 100)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">XP / RP</span><span className="text-green-400 font-bold">+{Math.round((bonuses.xpMultiplier - 1) * 100)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Unit STR/DEF</span><span className="text-green-400 font-bold">+{Math.round((bonuses.unitStrengthMultiplier - 1) * 100)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Auto-farm</span><span className="text-green-400 font-bold">+{Math.round((bonuses.autoFarmSpeedMultiplier - 1) * 100)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Bank capacity</span><span className="text-green-400 font-bold">+{Math.round((bonuses.bankCapacityMultiplier - 1) * 100)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Bank fees</span><span className="text-green-400 font-bold">{bonuses.bankFeeMultiplier === 0 ? 'FREE' : `${Math.round((bonuses.bankFeeMultiplier - 1) * 100)}%`}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Clan XP</span><span className="text-green-400 font-bold">+{Math.round((bonuses.clanXpMultiplier - 1) * 100)}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Referrals</span><span className="text-green-400 font-bold">+{Math.round((bonuses.referralMultiplier - 1) * 100)}%</span></div>
                  {bonuses.permanentHarvestBonusPct > 0 && (
                    <div className="col-span-2 flex justify-between border-t border-gray-700 pt-1.5">
                      <span className="text-gray-400">Permanent harvest (12h milestone)</span>
                      <span className="text-cyan-400 font-bold">+{bonuses.permanentHarvestBonusPct}% forever</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Session earnings + flee exposure */}
            {bonuses && (
              <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <div className="px-3 py-2 bg-gray-750 border-b border-gray-700">
                  <span className="text-xs font-bold text-gray-300">💰 SESSION EARNINGS (steal exposure)</span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-900/50 rounded p-2">
                      <div className="text-xs text-gray-400">Metal earned</div>
                      <div className="text-sm font-bold text-orange-300">{formatCompact(bonuses.sessionEarningsMetal)}</div>
                    </div>
                    <div className="bg-gray-900/50 rounded p-2">
                      <div className="text-xs text-gray-400">Energy earned</div>
                      <div className="text-sm font-bold text-cyan-300">{formatCompact(bonuses.sessionEarningsEnergy)}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    A challenger who steals the Flag takes nothing — but each flee pays them
                    10–30% of these earnings. Fled <span className="font-bold text-white">{fleeCount}/{maxFlees}</span>
                    {fleeCount >= maxFlees && <span className="text-red-400 font-bold"> — next challenge cannot be fled!</span>}
                  </div>
                  {/* 12h milestone progress */}
                  <div>
                    <div className="text-xs text-gray-400 mb-1">
                      12-hour milestone — permanent +2% harvest
                    </div>
                    <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className="bg-yellow-500 h-full transition-all duration-300" style={{ width: `${milestonePct}%` }} />
                    </div>
                  </div>
                  {/* Grace indicator */}
                  {actions?.graceUntil && new Date(actions.graceUntil) > new Date() && (
                    <div className="text-xs text-green-400">
                      🛡️ Challenge grace active until {new Date(actions.graceUntil).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Restrictions notice (doc: immediate, prevents exploits) */}
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="text-xs text-gray-400">
                ⛔ While holding: unit building, factory actions, auction house, and banking
                are <span className="text-red-400 font-bold">disabled</span>. Harvesting, movement, and shrine boosts stay enabled.
              </div>
            </div>

            {/* Hold duration */}
            <div className="bg-gray-900 rounded px-2 py-1.5 flex items-center justify-between border border-gray-700">
              <span className="text-xs text-gray-400">Holding Flag</span>
              <span className={`text-xs font-bold ${isExpiringSoon ? 'text-yellow-400' : 'text-green-400'}`}>
                {formatHoldDuration(bearer.holdDuration)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // TRACKER VIEW — non-bearer: track + steal
  // ============================================================
  const compassArrowRot = getRotationForDirectionPublic(direction);

  // Full panel view with main collapsible header
  return (
    <div
      className={`
        bg-gray-900 border-2 rounded-lg overflow-hidden transition-all duration-300
        ${challenge ? 'border-yellow-500 animate-pulse' : inAttackRange ? 'border-green-500' : 'border-red-500'}
      `}
    >
      {/* Main Header - Always Visible, Clickable to Collapse Entire Panel */}
      <div
        className="bg-gray-800 border-b border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl animate-pulse">🏴</div>
            <div>
              <h3 className="text-lg font-bold text-white">Flag Bearer</h3>
              <p className="text-xs text-gray-400">Steal the flag with a 30-second challenge</p>
            </div>
          </div>
          <span className="text-gray-400 text-xl">{isPanelCollapsed ? '▶' : '▼'}</span>
        </div>
      </div>

      {/* Panel Content - Collapsible */}
      {!isPanelCollapsed && (
        <div className="p-4 space-y-3">
          {/* Active channel banner (challenger / observer side) */}
          {challenge && (
            <div className={`rounded-lg p-3 border-2 ${isChallengerViewer ? 'bg-yellow-950/40 border-yellow-500' : 'bg-gray-800 border-yellow-700/50'}`}>
              <div className="text-sm font-bold text-yellow-300">
                🏴 {challenge.challenger} is channeling a steal!
              </div>
              <div className="text-xs text-yellow-200/80 mt-1">
                {challenge.secondsRemaining > 0
                  ? <>Channel ends in <span className="font-bold">{challenge.secondsRemaining}s</span> — bearer can flee after the 5s lock.</>
                  : <>Channel complete — the Flag transfers unless the bearer fled.</>}
              </div>
              {isChallengerViewer && challenge.secondsRemaining <= 0 && (
                <button
                  onClick={() => onClaim && onClaim()}
                  className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  🎉 Claim the Flag
                </button>
              )}
            </div>
          )}

          {/* Bearer Info Section */}
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {/* Header - Clickable to collapse */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBearerInfo(!showBearerInfo);
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-750 transition-colors"
            >
              <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                <span>👤</span>
                <span>Bearer Info</span>
              </span>
              <span className="text-gray-400 text-sm">{showBearerInfo ? '▼' : '▶'}</span>
            </button>

            {/* Collapsible Content */}
            {showBearerInfo && (
              <div className="px-3 py-3 border-t border-gray-700 space-y-2">
                {/* Username and Level */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-400">Player</div>
                    <div className="text-base font-bold text-white">{bearer.username}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Level</div>
                    <div className="text-base font-bold text-cyan-400">{bearer.level}</div>
                  </div>
                </div>

                {/* Hold Duration */}
                <div className="bg-gray-900 rounded px-2 py-1.5 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Holding Flag</span>
                  <span className={`text-xs font-bold ${isExpiringSoon ? 'text-yellow-400' : 'text-green-400'}`}>
                    {formatHoldDuration(bearer.holdDuration)} ({timeRemaining})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Location & Distance Section */}
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {/* Header - Clickable to collapse */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLocation(!showLocation);
              }}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-750 transition-colors"
            >
              <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                <span>📍</span>
                <span>Location & Distance</span>
              </span>
              <span className="text-gray-400 text-sm">{showLocation ? '▼' : '▶'}</span>
            </button>

            {/* Collapsible Content */}
            {showLocation && (
              <div className="grid grid-cols-2 gap-2 px-3 py-3 border-t border-gray-700">
                {/* Location */}
                <div className="bg-gray-900/50 rounded-lg p-2">
                  <div className="text-xs text-gray-400 mb-1">Location</div>
                  <div className="text-sm font-bold text-white">
                    ({bearer.position.x}, {bearer.position.y})
                  </div>
                </div>

                {/* Distance */}
                <div className="bg-gray-900/50 rounded-lg p-2">
                  <div className="text-xs text-gray-400 mb-1">Distance</div>
                  <div className="text-sm font-bold text-cyan-400">
                    {formatDistance(distance)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Steal Range Status */}
          <div
            className={`
              rounded-lg p-2 text-center font-bold text-xs border
              ${inAttackRange
                ? 'bg-green-900/30 border-green-500 text-green-400'
                : 'bg-red-900/30 border-red-500 text-red-400'
              }
            `}
          >
            {inAttackRange ? (
              <div className="flex items-center justify-center gap-2">
                <span>✓</span>
                <span>IN STEAL RANGE</span>
                <span className="opacity-75">(≤{FLAG_CONFIG.ATTACK_RANGE})</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>✗</span>
                <span>OUT OF RANGE</span>
                <span className="opacity-75">(+{distance - FLAG_CONFIG.ATTACK_RANGE} tiles)</span>
              </div>
            )}
          </div>

          {/* Compass Direction Section */}
          {!compact && (
            <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              {/* Header - Clickable to collapse */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCompass(!showCompass);
                }}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-750 transition-colors"
              >
                <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                  <span>🧭</span>
                  <span>Direction</span>
                </span>
                <span className="text-gray-400 text-sm">{showCompass ? '▼' : '▶'}</span>
              </button>

              {/* Collapsible Content */}
              {showCompass && (
                <div className="px-3 py-3 border-t border-gray-700 flex items-center justify-center gap-4">
                  {/* Compass Rose */}
                  <div className="relative w-16 h-16">
                    {/* Background circle */}
                    <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>

                    {/* Cardinal directions */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">N</div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-xs text-gray-500 font-bold">S</div>
                    <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">W</div>
                    <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">E</div>

                    {/* Direction arrow */}
                    <div
                      className="absolute inset-0 flex items-center justify-center text-2xl transition-transform duration-300"
                      style={{ transform: `rotate(${compassArrowRot}deg)` }}
                    >
                      {compassArrow}
                    </div>
                  </div>

                  <div className="text-xs text-gray-400">
                    Bearer is to the <span className="text-white font-bold">{direction}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {/* Track Button */}
            <button
              onClick={() => onTrack && onTrack(bearer)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <span>🔍</span>
              <span>Track</span>
            </button>

            {/* Steal Button (channel start) */}
            <button
              onClick={() => onChallenge && onChallenge()}
              disabled={!inAttackRange || !!challenge || (actions ? !actions.canChallenge && !actions.isChallenger : false)}
              className={`
                font-bold py-2 px-3 rounded-lg transition-colors flex items-center gap-2 text-sm
                ${!inAttackRange || challenge || (actions ? !actions.canChallenge && !actions.isChallenger : false)
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white'
                }
              `}
              title={
                challenge
                  ? 'A steal channel is already running'
                  : !inAttackRange
                  ? 'Move closer to start the steal channel'
                  : actions?.challengeBlockReason ?? 'Start a 30-second steal channel'
              }
            >
              <span>🏴</span>
              <span>{challenge ? `${challenge.secondsRemaining}s` : 'Steal'}</span>
            </button>
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
            💡 Track to view profile • Steal via 30s channel — the bearer can flee, paying you 10–30% of their session earnings
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Public wrapper for the module-private rotation helper (kept module-local).
 */
function getRotationForDirectionPublic(direction: CompassDirection): number {
  const rotations: Record<CompassDirection, number> = {
    [CompassDirection.North]: 0,
    [CompassDirection.NorthEast]: 45,
    [CompassDirection.East]: 90,
    [CompassDirection.SouthEast]: 135,
    [CompassDirection.South]: 180,
    [CompassDirection.SouthWest]: 225,
    [CompassDirection.West]: 270,
    [CompassDirection.NorthWest]: 315
  };
  return rotations[direction];
}
