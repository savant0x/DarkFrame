/**
 * @file components/FlagTrackerPanel.tsx
 * @created 2025-10-22
 * @updated 2026-09-06 — FID-20260906-012 Phase 2-R1: rebuilt to approved
 *   sample §04 Flag Tracker markup (amber module, flat wells, compass rose)
 *   with full parity. Fixes the colliding-wells defect: wells are flat
 *   siblings per the sample, never nested containers.
 * @overview Flag Tracker Panel — bearer self-view + tracker view (FID-20260906-001 §5.8).
 *
 * Two views, driven by the extended GET /api/flag payload:
 *  - **Bearer self-view** (viewer IS the holder): the flag's details — the full
 *    while-holding bonus stack, GROSS session earnings, flee counter, challenge
 *    grace, and the 12-hour permanent-milestone progress.
 *  - **Tracker view** (viewer is not the holder): bearer info, location/distance,
 *    compass, and the Steal action (channel start).
 *
 * NEON NOIR: amber = flag signal identity (§3.2); challenge banners go magenta
 * (danger/combat). All logic, handlers, and conditions unchanged from FID-001.
 */

import { useState, useEffect } from 'react';
import { Crown, Flag, MapPin, User, Compass, Search, Shield } from 'lucide-react';
import {
  type FlagBearer,
  type FlagDetailPayload,
  type FlagTrackerData,
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

  /** FID-20260910-038 D2: viewer's username — client-side bearer-self fallback
   * when flagDetail's actions are stale (poll lag). */
  playerUsername?: string;
}

/**
 * Format a resource count compactly (12,500 -> 12.5k, 1,200,000 -> 1.2M).
 */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

/** Collapsible section toggle row — quiet lab + chevron (sample footnote scale). */
function SectionToggle({
  icon,
  label,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--nn-cyan)_6%,transparent)]"
    >
      <span className="nn-lab flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span style={{ fontSize: 9, color: 'var(--nn-text-tertiary)' }}>{open ? '▼' : '▶'}</span>
    </button>
  );
}

/** Container well (holds a collapsible section) — column layout override. */
function SectionWell({ children }: { children: React.ReactNode }) {
  return (
    <div className="nn-well" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      {children}
    </div>
  );
}

export default function FlagTrackerPanel({
  playerPosition,
  flagBearer,
  flagDetail,
  onTrack,
  onChallenge,
  onFlee,
  onClaim,
  compact = false,
  playerUsername
}: FlagTrackerPanelProps) {
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
      <div className="nn-panel nn-panel--amber" style={{ '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}>
        <div className="nn-panel__header nn-panel__header--amber">
          <Flag className="nn-panel__icon" />
          <h3 className="nn-panel__title">Flag Bearer</h3>
          <span className="nn-panel__meta">UNCLAIMED</span>
        </div>
        <div className="nn-panel__body">
          <p className="nn-footnote">The flag is currently unclaimed</p>
        </div>
      </div>
    );
  }

  const { bearer, distance, direction, inAttackRange } = trackerData;

  // TypeScript safety: bearer is guaranteed non-null here due to early return above
  if (!bearer) return null;

  const compassArrow = getCompassArrow(direction);
  const timeRemaining = getTimeRemaining(bearer.holdDuration);
  const isExpiringSoon = isFlagExpiringSoon(bearer.holdDuration);
  // FID-20260910-038 D2: server flag `actions.isBearer` can lag reality (30s
  // poll; capture before the next refetch). The client knows the holder's
  // identity AND the viewer's — OR them in so a new holder never sees the
  // tracker view ("X is holding it") about themselves.
  const isBearerViewer = (flagDetail?.actions.isBearer ?? false) ||
    Boolean(flagDetail && playerUsername && flagDetail.bearer?.username === playerUsername) ||
    Boolean(flagBearer && playerUsername && flagBearer.username === playerUsername);
  const isChallengerViewer = flagDetail?.actions.isChallenger ?? false;
  const challenge = flagDetail?.challenge ?? null;
  const bonuses = flagDetail?.bonuses ?? null;
  const actions = flagDetail?.actions;

  // ============================================================
  // BEARER SELF-VIEW — the holder sees the flag's details
  // ============================================================
  if (isBearerViewer) {
    const fleeCount = challenge?.fleeCount ?? 0;
    const maxFlees = challenge?.maxFlees ?? 5;
    // 12-hour milestone progress (doc: hold 12h = permanent +2% harvest).
    const milestonePct = Math.min(100, (bearer.holdDuration / (12 * 3600)) * 100);

    return (
      <div className="nn-panel nn-panel--amber" style={{ '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}>
        {/* Header — click to collapse */}
        <div
          className="nn-panel__header nn-panel__header--amber cursor-pointer"
          onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
        >
          <Crown className="nn-panel__icon nn-pulse" />
          <h3 className="nn-panel__title">You hold the Flag</h3>
          <span className="nn-panel__meta">
            BEARER · TARGET {isPanelCollapsed ? '▶' : '▼'}
          </span>
        </div>

        {!isPanelCollapsed && (
          <div className="nn-panel__body">
            {/* Active challenge warning (bearer side) — magenta danger banner */}
            {challenge && (
              <div
                className="nn-note nn-pulse"
                style={{ margin: '12px 12px 8px', flexDirection: 'column', alignItems: 'stretch', gap: '0.375rem' }}
              >
                <span style={{ fontWeight: 700, fontSize: 12 }}>
                  FLAG CHALLENGE — {challenge.challenger} is stealing your Flag
                </span>
                <span style={{ color: 'var(--nn-text-secondary)', letterSpacing: 0 }}>
                  Channel ends in <b className="nn-num">{challenge.secondsRemaining}s</b>
                  {!challenge.canFlee && challenge.fleeBlockReason && (
                    <> — {challenge.fleeBlockReason}</>
                  )}
                  {challenge.fleeCount >= (challenge.maxFlees ?? 5) && (
                    <> — AUTO-LOSS: the Flag transfers when the channel ends.</>
                  )}
                </span>
                <button
                  onClick={() => onFlee && onFlee()}
                  disabled={!challenge.canFlee}
                  className={`nn-btn nn-btn--magenta ${!challenge.canFlee ? 'cursor-not-allowed opacity-40' : ''}`}
                  style={{ width: '100%' }}
                  title={
                    challenge.canFlee
                      ? `Cost: ${challenge.fleeCostMetal.toLocaleString()} Metal + ${challenge.fleeCostEnergy.toLocaleString()} Energy (paid to the challenger), then a 5-tile dash`
                      : challenge.fleeBlockReason ?? 'Cannot flee right now'
                  }
                >
                  Flee — costs {formatCompact(challenge.fleeCostMetal)} metal / {formatCompact(challenge.fleeCostEnergy)} energy
                </button>
              </div>
            )}

            {/* Bonus stack — flat container well with 2-col compact rows */}
            {bonuses && (
              <SectionWell>
                <SectionToggle
                  icon={<Crown style={{ width: 12, height: 12 }} />}
                  label="Active bonuses (while holding)"
                  open
                  onToggle={() => undefined}
                />
                <div className="grid grid-cols-2 gap-x-4 px-3.5 pb-2.5">
                  {(
                    [
                      ['Harvest', `+${Math.round((bonuses.harvestMultiplier - 1) * 100)}%`],
                      ['XP / RP', `+${Math.round((bonuses.xpMultiplier - 1) * 100)}%`],
                      ['Unit STR/DEF', `+${Math.round((bonuses.unitStrengthMultiplier - 1) * 100)}%`],
                      ['Auto-farm', `+${Math.round((bonuses.autoFarmSpeedMultiplier - 1) * 100)}%`],
                      ['Bank capacity', `+${Math.round((bonuses.bankCapacityMultiplier - 1) * 100)}%`],
                      ['Bank fees', bonuses.bankFeeMultiplier === 0 ? 'FREE' : `${Math.round((bonuses.bankFeeMultiplier - 1) * 100)}%`],
                      ['Clan XP', `+${Math.round((bonuses.clanXpMultiplier - 1) * 100)}%`],
                      ['Referrals', `+${Math.round((bonuses.referralMultiplier - 1) * 100)}%`],
                    ] as Array<[string, string]>
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between py-0.5">
                      <span className="nn-lab" style={{ margin: 0 }}>{label}</span>
                      <span className="nn-num" style={{ fontSize: 11.5, color: 'var(--nn-green)' }}>{value}</span>
                    </div>
                  ))}
                  {bonuses.permanentHarvestBonusPct > 0 && (
                    <div className="col-span-2 mt-1 flex items-center justify-between border-t pt-1.5" style={{ borderColor: 'color-mix(in oklab, var(--nn-amber) 18%, transparent)' }}>
                      <span className="nn-lab" style={{ margin: 0 }}>Permanent harvest (12h milestone)</span>
                      <span className="nn-num" style={{ fontSize: 11.5, color: 'var(--nn-cyan)' }}>+{bonuses.permanentHarvestBonusPct}% forever</span>
                    </div>
                  )}
                </div>
              </SectionWell>
            )}

            {/* Session earnings + flee exposure */}
            {bonuses && (
              <SectionWell>
                <SectionToggle
                  icon={<User style={{ width: 12, height: 12 }} />}
                  label="Session earnings (steal exposure)"
                  open
                  onToggle={() => undefined}
                />
                <div className="px-3.5 pb-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="nn-well" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      <span className="nn-lab" style={{ margin: 0 }}>Metal earned</span>
                      <b className="nn-num" style={{ fontSize: 13, color: 'var(--nn-amber)' }}>{formatCompact(bonuses.sessionEarningsMetal)}</b>
                    </div>
                    <div className="nn-well" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      <span className="nn-lab" style={{ margin: 0 }}>Energy earned</span>
                      <b className="nn-num" style={{ fontSize: 13, color: 'var(--nn-cyan)' }}>{formatCompact(bonuses.sessionEarningsEnergy)}</b>
                    </div>
                  </div>
                  <p style={{ marginTop: 8, fontSize: 11, lineHeight: 1.55, color: 'var(--nn-text-secondary)' }}>
                    A challenger who steals the Flag takes nothing — but each flee pays them
                    10–30% of these earnings. Fled <b className="nn-num">{fleeCount}/{maxFlees}</b>
                    {fleeCount >= maxFlees && <b style={{ color: 'var(--nn-magenta)' }}> — next challenge cannot be fled!</b>}
                  </p>
                  {/* 12h milestone progress */}
                  <div style={{ marginTop: 8 }}>
                    <div className="nn-meter__lab">
                      <span>12-HOUR MILESTONE · PERMANENT +2% HARVEST</span>
                      <b className="nn-num" style={{ color: 'var(--nn-amber)' }}>{milestonePct.toFixed(0)}%</b>
                    </div>
                    <div className="nn-meter">
                      <div
                        className="nn-meter__seg"
                        style={{ width: `${milestonePct}%`, background: 'var(--nn-amber)', boxShadow: '0 0 10px color-mix(in oklab, var(--nn-amber) 50%, transparent)' }}
                      />
                    </div>
                  </div>
                  {/* Grace indicator */}
                  {actions?.graceUntil && new Date(actions.graceUntil) > new Date() && (
                    <div className="mt-2 flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--nn-green)' }}>
                      <Shield style={{ width: 12, height: 12 }} />
                      Challenge grace active until {new Date(actions.graceUntil).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </SectionWell>
            )}

            {/* Restrictions notice (doc: immediate, prevents exploits) */}
            <div className="nn-note" style={{ margin: '4px 12px 8px' }}>
              <span style={{ fontSize: 11, lineHeight: 1.5 }}>
                While holding: unit building, factory actions, auction house, and banking
                are <b>disabled</b>. Harvesting, movement, and shrine boosts stay enabled.
              </span>
            </div>

            {/* Hold duration */}
            <div className="nn-row">
              <span className="nn-row__label">Holding Flag</span>
              <b className={`nn-num ${isExpiringSoon ? '' : ''}`} style={{ fontSize: 12, color: isExpiringSoon ? 'var(--nn-amber)' : 'var(--nn-green)' }}>
                {formatHoldDuration(bearer.holdDuration)}
              </b>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // TRACKER VIEW — non-bearer: track + steal
  // ============================================================
  // FID-20260910-039 R2: named for what it means — every term here BLOCKS a
  // challenge (out of range / channel running / server says no). The old name
  // `canChallenge` was the negation of this and read as an inverted gate.
  const challengeBlocked = !inAttackRange || !!challenge || (actions ? !actions.canChallenge && !actions.isChallenger : false);

  // Full panel view with main collapsible header
  return (
    <div
      className="nn-panel nn-panel--amber"
      style={{ '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}
    >
      {/* Main Header — click to collapse */}
      <div
        className="nn-panel__header nn-panel__header--amber cursor-pointer"
        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
      >
        <Flag className="nn-panel__icon nn-pulse" />
        <h3 className="nn-panel__title">Flag Bearer</h3>
        <span className="nn-panel__meta">
          STEAL · 30S CHANNEL {isPanelCollapsed ? '▶' : '▼'}
        </span>
      </div>

      {/* Panel Content — collapsible */}
      {!isPanelCollapsed && (
        <div className="nn-panel__body">
          {/* Active channel banner (challenger / observer side) */}
          {challenge && (
            <div
              className="nn-note nn-note--caution"
              style={{ margin: '12px 12px 8px', flexDirection: 'column', alignItems: 'stretch', gap: '0.375rem' }}
            >
              <span style={{ fontWeight: 700, fontSize: 12 }}>
                {challenge.challenger} is channeling a steal
              </span>
              <span style={{ color: 'var(--nn-text-secondary)', letterSpacing: 0 }}>
                {challenge.secondsRemaining > 0
                  ? <>Channel ends in <b className="nn-num">{challenge.secondsRemaining}s</b> — bearer can flee after the 5s lock.</>
                  : <>Channel complete — the Flag transfers unless the bearer fled.</>}
              </span>
              {isChallengerViewer && challenge.secondsRemaining <= 0 && (
                <button
                  onClick={() => onClaim && onClaim()}
                  className="nn-btn nn-btn--amber"
                  style={{ width: '100%' }}
                >
                  Claim the Flag
                </button>
              )}
            </div>
          )}

          {/* Bearer Info Section — sample well 1: Player | Level */}
          <SectionWell>
            <SectionToggle
              icon={<User style={{ width: 12, height: 12 }} />}
              label="Bearer Info"
              open={showBearerInfo}
              onToggle={() => setShowBearerInfo(!showBearerInfo)}
            />
            {showBearerInfo && (
              <div className="px-3.5 pb-2.5">
                <div className="flex items-start justify-between">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="nn-lab">Player</span>
                    <b style={{ fontSize: 14 }}>{bearer.username}</b>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                    <span className="nn-lab">Level</span>
                    <b className="nn-num" style={{ fontSize: 14, color: 'var(--nn-cyan)' }}>{bearer.level}</b>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="nn-lab" style={{ margin: 0 }}>Holding Flag</span>
                  <b className="nn-num" style={{ fontSize: 12, color: isExpiringSoon ? 'var(--nn-amber)' : 'var(--nn-green)' }}>
                    {formatHoldDuration(bearer.holdDuration)} ({timeRemaining})
                  </b>
                </div>
              </div>
            )}
          </SectionWell>

          {/* Location & Distance Section — sample well 2: Location | Distance */}
          <SectionWell>
            <SectionToggle
              icon={<MapPin style={{ width: 12, height: 12 }} />}
              label="Location & Distance"
              open={showLocation}
              onToggle={() => setShowLocation(!showLocation)}
            />
            {showLocation && (
              <div className="nn-well" style={{ margin: '0 12px 10px', width: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="nn-lab">Location</span>
                  <b className="nn-num" style={{ fontSize: 13 }}>({bearer.position.x}, {bearer.position.y})</b>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                  <span className="nn-lab">Distance</span>
                  <b className="nn-num" style={{ fontSize: 13, color: 'var(--nn-cyan)' }}>{formatDistance(distance)}</b>
                </div>
              </div>
            )}
          </SectionWell>

          {/* Steal Range Status — sample `.range` pill */}
          <div className={`nn-range ${inAttackRange ? 'nn-range--ok' : 'nn-range--no'}`}>
            {inAttackRange
              ? `IN STEAL RANGE (≤${FLAG_CONFIG.STEAL_RANGE})`
              : `OUT OF RANGE (+${distance - FLAG_CONFIG.STEAL_RANGE} TILES)`}
          </div>

          {/* Compass Direction Section — sample `.compass` + `.rose`, collapsible */}
          {!compact && (
            <SectionWell>
              <SectionToggle
                icon={<Compass style={{ width: 12, height: 12 }} />}
                label="Direction"
                open={showCompass}
                onToggle={() => setShowCompass(!showCompass)}
              />
              {showCompass && (
                <div className="nn-compass" style={{ padding: '6px 12px 12px' }}>
                  <div className="nn-compass__rose">
                    <i className="n">N</i>
                    <i className="s">S</i>
                    <i className="w">W</i>
                    <i className="e">E</i>
                    <span className="arrow">{compassArrow}</span>
                  </div>
                  <p>
                    Bearer is to the <b>{direction}</b>
                  </p>
                </div>
              )}
            </SectionWell>
          )}

          {/* Action Buttons — sample `.actions2`: Track ghost + Steal amber */}
          <div className="nn-actions2">
            {/* Track Button — cyan navigation action */}
            <button
              onClick={() => onTrack && onTrack(bearer)}
              className="nn-btn nn-btn--ghost"
            >
              <Search />
              Track
            </button>

            {/* Steal Button (channel start) — amber aggression */}
            <button
              onClick={() => onChallenge && onChallenge()}
              disabled={challengeBlocked}
              className={`nn-btn nn-btn--amber nn-btn--flex ${challengeBlocked ? 'cursor-not-allowed opacity-40' : ''}`}
              title={
                challenge
                  ? 'A steal channel is already running'
                  : !inAttackRange
                  ? 'Move closer to start the steal channel'
                  : actions?.challengeBlockReason ?? 'Start a 30-second steal channel'
              }
            >
              <Flag />
              <span>{challenge ? `${challenge.secondsRemaining}s` : 'Steal'}</span>
            </button>
          </div>

          {/* Help Text — sample footnote */}
          <p className="nn-footnote">
            Track to view profile · Steal via 30s channel — the bearer can flee, paying you 10–30% of their session earnings
          </p>
        </div>
      )}
    </div>
  );
}
