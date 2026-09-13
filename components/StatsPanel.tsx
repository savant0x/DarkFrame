/**
 * @file components/StatsPanel.tsx
 * @created 2025-10-16
 * @updated 2026-09-06 - FID-20260906-012 Phase 2-R0: rebuilt to the approved
 *   sample markup (§02 HUD Components) with FULL feature parity.
 * @overview Left panel displaying player statistics as a command instrument
 *
 * OVERVIEW:
 * Player statistics dashboard with real-time shrine boost timers,
 * military power calculations, and resource tracking.
 *
 * SAMPLE CONTRACT (public/design/neon-noir-sample.html §02):
 * - Panel = glass over void, corner brackets, scanline header + right meta tag
 * - Rows = quiet Inter label / Orbitron tabular value, 9px/16px rhythm
 * - Meters = 10px track, gradient fill w/ glow, 8-segment divider overlay
 * - Wells = neutral void glass (accent is for panels, not insets)
 * - Buttons = outline style w/ semantic signal colors — never filled slabs
 *
 * FEATURE PARITY: Player Info, Experience, Resources, Military Power,
 * Harvest Calculator, Clan, Shrine Buffs, Actions — all preserved with
 * identical handlers and data flow. Visual layer only.
 */

'use client';

import React, { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { GAME_CONSTANTS } from '@/types';
import { estimateHarvestExpected } from '@/lib/harvestEstimate';

import { useCountUp, useIsMobile } from '@/hooks';

import {
  User, MapPin, Swords, Scale,
  Users, Trophy, Zap, Wrench,
  Clock, TrendingUp, Star, Sparkles, Package, Mountain,
  Gift, Crown, Flag
} from 'lucide-react';

/** `/api/player/stats` payload slice consumed here (FID-20260909-025).
 *  Combat Power = (STR+DEF) × balance × clan × discovery × specialization —
 *  the documented formula in lib/combatPowerService.ts. */
interface CombatPowerPayload {
  success: boolean;
  combatPower?: number;
  powerBreakdown?: {
    balanceStatus: string;
    balanceMultiplier: number;
    totalCombatMultiplier: number;
  };
}

interface StatsPanelProps {
  onClanClick?: () => void;
  onReferralsClick?: () => void;
  onFactoryManagementClick?: () => void;
  flagBearer?: {
    playerId: string;
    username: string;
    level: number;
    position: { x: number; y: number };
    currentHP?: number;
    maxHP?: number;
  } | null;
}

/** NEON NOIR HUD module per sample §02: brackets + scanline header + meta tag.
 *  `accent` assigns the semantic signal; `variant` selects the accent header. */
function HudPanel({ accent, variant, icon, title, meta, padded, children }: {
  accent: string;
  variant?: 'amber' | 'magenta' | 'violet';
  icon: ReactNode;
  title: string;
  meta?: string;
  padded?: boolean;
  children: ReactNode;
}) {
  const headerClass = variant
    ? `nn-panel__header nn-panel__header--${variant}`
    : 'nn-panel__header';
  return (
    <section
      className={variant ? `nn-panel nn-panel--${variant}` : 'nn-panel'}
      style={{ '--nn-accent': accent } as CSSProperties}
    >
      <div className={headerClass}>
        <span className="nn-panel__icon">{icon}</span>
        <h3 className="nn-panel__title">{title}</h3>
        {meta && <span className="nn-panel__meta">{meta}</span>}
      </div>
      <div className={padded ? 'nn-panel__body nn-panel__body--padded' : 'nn-panel__body'}>
        {children}
      </div>
    </section>
  );
}

/** Labeled data row per sample `.row`: quiet Inter label, Orbitron value. */
function Row({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="nn-row">
      <span className="nn-row__label">{icon}{label}</span>
      <span className="nn-row__value nn-num">{value}</span>
    </div>
  );
}

/** Sample §02 power meter: label row + segmented track. `seg` picks the fill. */
function MeterBlock({ seg, label, value, pct, withSegs = true }: {
  seg: 'str' | 'def' | 'vio' | 'green';
  label: string;
  value: ReactNode;
  pct: number;
  withSegs?: boolean;
}) {
  return (
    <div className="nn-meterblock">
      <div className="nn-meter__lab">
        <span>{label}</span>
        <b className="nn-num">{value}</b>
      </div>
      <div className="nn-meter">
        <div className={`nn-meter__seg nn-meter__seg--${seg}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        {withSegs && (
          <div className="nn-meter__ticks" aria-hidden>
            <i /><i /><i /><i /><i /><i /><i /><i />
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatsPanel({ onClanClick, onReferralsClick, onFactoryManagementClick, flagBearer }: StatsPanelProps = {}) {
  const { player } = useGameContext();
  const router = useRouter();
  const [boostTimers, setBoostTimers] = useState<Record<string, string>>({});
  const [clanTag, setClanTag] = useState<string | null>(null);
  const _isMobile = useIsMobile();

  // Check if current player is flag bearer
  const isPlayerFlagBearer = flagBearer && player && flagBearer.username === player.username;

  // Animated counts for key stats
  const metalCount = useCountUp(player?.resources.metal || 0, { duration: 1000 });
  const energyCount = useCountUp(player?.resources.energy || 0, { duration: 1000 });
  const strengthCount = useCountUp(player?.totalStrength || 0, { duration: 1200 });
  const defenseCount = useCountUp(player?.totalDefense || 0, { duration: 1200 });
  const effectivePower = useCountUp((player?.totalStrength || 0) + (player?.totalDefense || 0), { duration: 1500 });

  // Real combat power (server-calculated formula), refetched when the army
  // changes. Debounced 400ms; on failure the panel falls back to the honest
  // Base Power readout instead of inventing a number (FID-20260909-025 §4.1).
  const [powerData, setPowerData] = useState<CombatPowerPayload & { combatPower: number; powerBreakdown: NonNullable<CombatPowerPayload['powerBreakdown']> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/player/stats');
        if (!response.ok) throw new Error(`stats fetch ${response.status}`);
        const data: CombatPowerPayload = await response.json();
        if (!cancelled && data.success && typeof data.combatPower === 'number' && data.powerBreakdown) {
          setPowerData(data as CombatPowerPayload & { combatPower: number; powerBreakdown: NonNullable<CombatPowerPayload['powerBreakdown']> });
        }
      } catch {
        if (!cancelled) setPowerData(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [player?.totalStrength, player?.totalDefense]);
  const combatPowerCount = useCountUp(powerData?.combatPower ?? 0, { duration: 1500 });

  // Fetch clan tag when player has a clan
  useEffect(() => {
    const fetchClanTag = async () => {
      if (!player?.clanId) {
        setClanTag(null);
        return;
      }

      try {
        const response = await fetch(`/api/clan?clanId=${player.clanId}`);
        if (response.ok) {
          const data = await response.json();
          setClanTag(data.tag || null);
        }
      } catch (error) {
        console.error('Failed to fetch clan tag:', error);
      }
    };

    fetchClanTag();
  }, [player?.clanId]);

  // Update shrine boost timers every second
  useEffect(() => {
    if (!player?.shrineBoosts) return;

    const updateTimers = () => {
      const now = new Date();
      const timers: Record<string, string> = {};

      player.shrineBoosts.forEach(boost => {
        const expiresAt = new Date(boost.expiresAt);
        const timeLeft = expiresAt.getTime() - now.getTime();

        if (timeLeft > 0) {
          const hours = Math.floor(timeLeft / (1000 * 60 * 60));
          const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
          timers[boost.tier] = `${hours}h ${minutes}m`;
        }
      });

      setBoostTimers(timers);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [player?.shrineBoosts]);

  if (!player) {
    return (
      <div className="p-3">
        <HudPanel accent="var(--nn-cyan)" icon={<User />} title="Player Info" meta="LOADING">
          <p className="nn-footnote" style={{ textAlign: 'left' }}>Loading player data...</p>
        </HudPanel>
      </div>
    );
  }

  // FID-20260910-040: harvest figures come from the shared estimate module —
  // the exact pipeline `harvestResourceTile` pays through — instead of a
  // hand-rolled copy that had drifted (wrong base range, no balance term).
  // Expected values use the uniform roll's mean (1150) for a stable headline.
  const { HARVEST: { MIN_AMOUNT: HARVEST_MIN, MAX_AMOUNT: HARVEST_MAX } } = GAME_CONSTANTS;
  const estimateInput = {
    gatheringBonusPct: 0, // per-resource below
    temporaryBonusPct: player.activeBoosts?.gatheringBoost || 0,
    shrineBoosts: player.shrineBoosts ?? [],
    vip: !!player.vip,
    vipExpiration: player.vipExpiration ?? null,
    isFlagBearer: Boolean(isPlayerFlagBearer),
    totalStrength: player.totalStrength || 0,
    totalDefense: player.totalDefense || 0,
  } as const;
  const baseInput = { ...estimateInput, base: (HARVEST_MIN + HARVEST_MAX) / 2 };
  const metalEstimate = estimateHarvestExpected({ ...baseInput, gatheringBonusPct: player.gatheringBonus?.metalBonus ?? 0 });
  const energyEstimate = estimateHarvestExpected({ ...baseInput, gatheringBonusPct: player.gatheringBonus?.energyBonus ?? 0 });
  const metalExpected = metalEstimate;
  const energyExpected = energyEstimate;
  const hasVIP = metalEstimate.terms.vip;
  // FID-20260912-083: the Player Info VIP row shows the actual status —
  // remaining time from vipExpiration — not a bare "Active". The crown is
  // inline-flex with the text so the narrow right-aligned cell can never
  // wrap the icon onto its own line above the label.
  const vipRemaining = (() => {
    if (!hasVIP || !player.vipExpiration) return null;
    const ms = new Date(player.vipExpiration).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  })();
  // Shrine Buffs panel terms (display only — the estimate module does its own
  // filtering for yield math).
  const activeBoosts = player.shrineBoosts?.filter(boost =>
    new Date(boost.expiresAt) > new Date()
  ) || [];
  const totalShrineBonus = activeBoosts.reduce((sum, boost) => sum + boost.yieldBonus, 0);

  // Military balance: the meters ARE the STR/DEF share of total army — labeled
  // as such with a per-row percentage (the pre-FID-012 balance pill semantics,
  // restored). Zero army = zero-width fills (a 50% split on 0/0 power read as a
  // phantom half-filled bar).
  const totalPower = (player.totalStrength ?? 0) + (player.totalDefense ?? 0);
  const meterStrWidth = totalPower > 0 ? (player.totalStrength / totalPower) * 100 : 0;
  const meterDefWidth = totalPower > 0 ? (player.totalDefense / totalPower) * 100 : 0;
  const balanceStatus = player.balanceEffects?.status;
  const balanceColor =
    balanceStatus === 'OPTIMAL' ? 'var(--nn-green)' :
    balanceStatus === 'BALANCED' ? 'var(--nn-text-secondary)' :
    'var(--nn-amber)';

  // XP progress for the sample-style meter
  const xp = player.xpProgress;
  const xpPct = xp && xp.xpForNextLevel > 0
    ? Math.min((xp.currentLevelXP / xp.xpForNextLevel) * 100, 100)
    : 0;

  // Get boost icon (shrine tiers keep their card-suit identity)
  const getBoostIcon = (tier: string): string => {
    switch (tier) {
      case 'speed': return '♠';
      case 'heart': return '♥';
      case 'diamond': return '♦';
      case 'club': return '♣';
      default: return '✦';
    }
  };

  return (
    <div className="space-y-3 p-3">
      {/* Player Info */}
      <HudPanel accent="var(--nn-cyan)" icon={<User />} title="Player Info" meta={`ID ▸ ${player.username.toUpperCase().slice(0, 12)}`}>
        <Row icon={<User />} label="Commander" value={player.username} />
        <Row
          icon={<Wrench />}
          label="Factories"
          value={
            <button
              onClick={onFactoryManagementClick}
              className="nn-link"
              style={{ color: 'var(--nn-cyan)' }}
              title="Click to manage factories"
            >
              {player.factoryCount ?? 0}
            </button>
          }
        />
        <Row icon={<Star />} label="Level" value={player.level ?? 1} />
        <Row icon={<Trophy />} label="Rank" value={player.rank ?? 1} />
        <Row
          icon={<MapPin />}
          label="Position"
          value={`(${player.currentPosition?.x ?? 0}, ${player.currentPosition?.y ?? 0})`}
        />
        <Row
          icon={<MapPin />}
          label="Base"
          value={`(${player.base?.x ?? 0}, ${player.base?.y ?? 0})`}
        />

        {/* VIP Status */}
        <Row
          icon={<Zap className={hasVIP ? 'text-[color:var(--nn-violet)]' : ''} />}
          label="VIP"
          value={
            hasVIP ? (
              <button
                onClick={() => router.push('/game/vip-upgrade')}
                className="nn-link"
                style={{
                  color: 'var(--nn-violet)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
                title={
                  player.vipExpiration
                    ? `VIP active until ${new Date(player.vipExpiration).toLocaleString()}`
                    : 'Manage your VIP subscription'
                }
              >
                <Crown style={{ width: 12, height: 12, flex: 'none' }} />
                Active{vipRemaining ? ` · ${vipRemaining}` : ''}
              </button>
            ) : (
              <button
                onClick={() => router.push('/game/vip-upgrade')}
                className="nn-link"
                title="Upgrade to VIP for 2x speed and exclusive benefits"
              >
                Get VIP
              </button>
            )
          }
        />

        {/* Clan Row */}
        <Row
          icon={<Users />}
          label="Clan"
          value={
            player.clanId ? (
              <button
                onClick={onClanClick || (() => router.push('/clan'))}
                className="nn-link inline-flex items-center gap-1"
                title="Click to view Clan page"
              >
                {clanTag && <span style={{ color: 'var(--nn-violet)' }}>[{clanTag}]</span>}
                <span>
                  {player.clanName
                    ? (player.clanName.length > 15 ? player.clanName.slice(0, 15) + '…' : player.clanName)
                    : 'View Clan'}
                </span>
              </button>
            ) : (
              <button
                onClick={onClanClick || (() => router.push('/clan'))}
                className="nn-link"
                title="Create or join a clan"
              >
                Join / Create
              </button>
            )
          }
        />

        {/* Referrals Row */}
        <Row
          icon={<Gift />}
          label="Referrals"
          value={
            <button
              onClick={onReferralsClick || (() => router.push('/referrals'))}
              className="nn-link"
              title="Invite friends and earn rewards"
            >
              Invite Friends
            </button>
          }
        />
      </HudPanel>

      {/* Experience — sample-style violet meter */}
      {xp && (
        <HudPanel accent="var(--nn-violet)" variant="violet" icon={<Star />} title="Experience" meta={`LV ▸ ${player.level || 1}`}>
          <div className="nn-progblock">
            <div className="nn-meter__lab">
              <span>XP · LEVEL {player.level || 1}</span>
              <b className="nn-num">{xp.currentLevelXP.toLocaleString()} / {xp.xpForNextLevel.toLocaleString()}</b>
            </div>
            <div className="nn-meter">
              <div className="nn-meter__seg nn-meter__seg--vio" style={{ width: `${xpPct}%` }} />
            </div>
            <div className="nn-lab" style={{ marginTop: 6 }}>
              Total XP: <span className="nn-num" style={{ color: 'var(--nn-text-secondary)' }}>{(player.xp || 0).toLocaleString()}</span>
            </div>
          </div>
          {player.researchPoints !== undefined && player.researchPoints > 0 && (
            <Row
              icon={<TrendingUp />}
              label="Research"
              value={<span style={{ color: 'var(--nn-violet)' }}>{player.researchPoints.toLocaleString()} RP</span>}
            />
          )}
        </HudPanel>
      )}

      {/* Resources */}
      <HudPanel accent="var(--nn-amber)" icon={<Wrench />} title="Resources" meta="ECONOMY">
        <Row
          icon={<Wrench />}
          label="Metal"
          value={Math.round(metalCount).toLocaleString()}
        />
        <div className="nn-well">
          <span className="nn-lab">Banked</span>
          <span className="nn-num" style={{ fontSize: '0.75rem', color: 'var(--nn-text-tertiary)' }}>
            {(player.bank?.metal ?? 0).toLocaleString()}
          </span>
        </div>
        <Row
          icon={<Zap />}
          label="Energy"
          value={Math.round(energyCount).toLocaleString()}
        />
        <div className="nn-well">
          <span className="nn-lab">Banked</span>
          <span className="nn-num" style={{ fontSize: '0.75rem', color: 'var(--nn-text-tertiary)' }}>
            {(player.bank?.energy ?? 0).toLocaleString()}
          </span>
        </div>
      </HudPanel>

      {/* Military Power — balance-share meters + formula-derived combat power.
          The bars show each stat's share of the total army (balance), labeled
          with its percentage; Combat Power is the server-calculated formula
          result (FID-20260909-025 §4.1). */}
      <HudPanel accent="var(--nn-cyan)" icon={<Swords />} title="Military Power" meta="ORDER OF BATTLE">
        <MeterBlock
          seg="str"
          label={`STRENGTH · ${Math.round(meterStrWidth)}%`}
          value={Math.round(strengthCount).toLocaleString()}
          pct={meterStrWidth}
        />
        <MeterBlock
          seg="def"
          label={`DEFENSE · ${Math.round(meterDefWidth)}%`}
          value={Math.round(defenseCount).toLocaleString()}
          pct={meterDefWidth}
        />
        {balanceStatus && player.balanceEffects && (
          <Row
            icon={<Scale />}
            label="Balance"
            value={
              <span style={{ color: balanceColor }}>
                {balanceStatus} ×{player.balanceEffects.powerMultiplier.toFixed(2)}
              </span>
            }
          />
        )}
        {powerData ? (
          <Row
            label="Combat Power"
            value={
              <span style={{ color: 'var(--nn-cyan)' }} title={`Base ${Math.round(effectivePower).toLocaleString()} × ${powerData.powerBreakdown.totalCombatMultiplier.toFixed(2)} multipliers`}>
                {Math.round(combatPowerCount).toLocaleString()}
              </span>
            }
          />
        ) : (
          <Row label="Base Power" value={Math.round(effectivePower).toLocaleString()} />
        )}

        {player.balanceEffects && player.balanceEffects.status !== 'BALANCED' && player.balanceEffects.status !== 'OPTIMAL' && (
          <div className="nn-note nn-note--caution" style={{ margin: '8px 12px' }}>
            <span aria-hidden>⚠</span>
            <span>{player.balanceEffects.recommendation || 'Imbalanced army'}</span>
          </div>
        )}

        <div className="nn-actions2">
          <button
            onClick={() => router.push('/game/unit-factory')}
            className="nn-btn nn-btn--primary nn-btn--flex"
          >
            <Users />
            Build Units
          </button>
        </div>
      </HudPanel>

      {/* Harvest Calculator */}
      <HudPanel accent="var(--nn-green)" icon={<TrendingUp />} title="Harvest Calculator" meta="YIELD">
        {hasVIP ? (
          <div className="nn-well">
            <span className="nn-lab"><Zap style={{ width: 12, height: 12, marginRight: 4, verticalAlign: -2 }} /> VIP ×2</span>
            <span style={{ fontSize: '10px', color: 'var(--nn-violet)' }}>All harvests doubled</span>
          </div>
        ) : (
          <div className="nn-well">
            <span className="nn-lab">VIP Not Active</span>
            <button
              onClick={() => router.push('/game/vip-upgrade')}
              className="nn-link"
            >
              Get VIP
            </button>
          </div>
        )}

        {/* Metal Breakdown — FID-20260910-040: all figures from the shared
            estimate module (server-identical pipeline), not hand-rolled math. */}
        <div className="nn-progblock" style={{ paddingTop: 4 }}>
          <span className="nn-lab" style={{ marginBottom: 4 }}><Wrench style={{ width: 12, height: 12, marginRight: 4, verticalAlign: -2 }} /> Metal Node</span>
          <Row label="Base" value={`${HARVEST_MIN.toLocaleString()}–${HARVEST_MAX.toLocaleString()}`} />
          <Row
            label="Gathering"
            value={<span style={{ color: 'var(--nn-green)' }}>+{metalEstimate.terms.gatheringBonusPct}%</span>}
          />
          {metalEstimate.terms.shrineBonusPct > 0 && (
            <Row
              icon={<Sparkles />}
              label="Shrine"
              value={<span style={{ color: 'var(--nn-cyan)' }}>+{metalEstimate.terms.shrineBonusPct.toFixed(0)}%</span>}
            />
          )}
          {metalEstimate.terms.vip && (
            <Row
              icon={<Zap />}
              label="VIP"
              value={<span style={{ color: 'var(--nn-violet)', fontWeight: 700 }}>×2</span>}
            />
          )}
          {metalEstimate.terms.flagBearer && (
            <Row
              icon={<Flag />}
              label="Bearer"
              value={<span style={{ color: 'var(--nn-amber)', fontWeight: 700 }}>+100%</span>}
            />
          )}
          {metalEstimate.terms.balanceMultiplier !== 1 && (
            <Row
              icon={<Scale />}
              label={`Balance (${metalEstimate.terms.balanceStatus.toLowerCase()})`}
              value={<span style={{ color: metalEstimate.terms.balanceMultiplier < 1 ? 'var(--nn-magenta)' : 'var(--nn-green)' }}>×{metalEstimate.terms.balanceMultiplier}</span>}
            />
          )}
          <hr className="nn-divider" />
          <Row
            label={`Expected (avg of ${HARVEST_MIN.toLocaleString()}–${HARVEST_MAX.toLocaleString()})`}
            value={<span style={{ color: 'var(--nn-green)', fontWeight: 700 }}>{metalExpected.final.toLocaleString()}</span>}
          />
        </div>

        <hr className="nn-divider" style={{ margin: '0.5rem 16px' }} />

        {/* Energy Breakdown — shared-estimate figures (see Metal block) */}
        <div className="nn-progblock" style={{ paddingTop: 0 }}>
          <span className="nn-lab" style={{ marginBottom: 4 }}><Zap style={{ width: 12, height: 12, marginRight: 4, verticalAlign: -2 }} /> Energy Node</span>
          <Row label="Base" value={`${HARVEST_MIN.toLocaleString()}–${HARVEST_MAX.toLocaleString()}`} />
          <Row
            label="Gathering"
            value={<span style={{ color: 'var(--nn-green)' }}>+{energyEstimate.terms.gatheringBonusPct}%</span>}
          />
          {energyEstimate.terms.shrineBonusPct > 0 && (
            <Row
              icon={<Sparkles />}
              label="Shrine"
              value={<span style={{ color: 'var(--nn-cyan)' }}>+{energyEstimate.terms.shrineBonusPct.toFixed(0)}%</span>}
            />
          )}
          {energyEstimate.terms.vip && (
            <Row
              icon={<Zap />}
              label="VIP"
              value={<span style={{ color: 'var(--nn-violet)', fontWeight: 700 }}>×2</span>}
            />
          )}
          {energyEstimate.terms.flagBearer && (
            <Row
              icon={<Flag />}
              label="Bearer"
              value={<span style={{ color: 'var(--nn-amber)', fontWeight: 700 }}>+100%</span>}
            />
          )}
          {energyEstimate.terms.balanceMultiplier !== 1 && (
            <Row
              icon={<Scale />}
              label={`Balance (${energyEstimate.terms.balanceStatus.toLowerCase()})`}
              value={<span style={{ color: energyEstimate.terms.balanceMultiplier < 1 ? 'var(--nn-magenta)' : 'var(--nn-green)' }}>×{energyEstimate.terms.balanceMultiplier}</span>}
            />
          )}
          <hr className="nn-divider" />
          <Row
            label={`Expected (avg of ${HARVEST_MIN.toLocaleString()}–${HARVEST_MAX.toLocaleString()})`}
            value={<span style={{ color: 'var(--nn-green)', fontWeight: 700 }}>{energyExpected.final.toLocaleString()}</span>}
          />
        </div>

        <hr className="nn-divider" style={{ margin: '0.5rem 16px' }} />

        {/* Cave / Forest — FID-20260910-040: honest terms. These tiles credit
            ZERO resources (the old "500–1,500" block was fabricated); they roll
            digger/tradeable ITEMS instead — 30% cave, 50% forest. */}
        <div className="nn-progblock" style={{ paddingTop: 0 }}>
          <span className="nn-lab" style={{ marginBottom: 4 }}><Mountain style={{ width: 12, height: 12, marginRight: 4, verticalAlign: -2 }} /> Cave / Forest</span>
          <Row label="Resources" value="None — item drops only" />
          <Row label="Cave item chance" value={<span style={{ color: 'var(--nn-cyan)' }}>30%</span>} />
          <Row label="Forest item chance" value={<span style={{ color: 'var(--nn-green)' }}>50%</span>} />
          <div className="nn-note" style={{ margin: '6px 12px 8px' }}>
            <span style={{ fontSize: 10.5, lineHeight: 1.5 }}>
              Drops are diggers (raise the Gathering % above permanently) and
              tradeables — that&apos;s how these tiles feed your yield.
            </span>
          </div>
        </div>

        {/* Harvest Cooldown Info */}
        <div className="nn-note nn-note--caution" style={{ margin: '8px 12px' }}>
          <Clock />
          <span>5-minute cooldown per tile after harvesting</span>
        </div>
      </HudPanel>

      {/* Clan Info */}
      {player.clanId && (
        <HudPanel accent="var(--nn-violet)" variant="violet" icon={<Users />} title="Clan" meta="GUILD">
          <Row label="Name" value={<span style={{ color: 'var(--nn-violet)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.clanName || 'Unknown'}</span>} />
          <Row label="Level" value={player.clanLevel ?? 1} />
          <Row
            label="Role"
            value={<span style={{ color: 'var(--nn-cyan)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{player.clanRole || 'MEMBER'}</span>}
          />
          <div className="nn-actions2">
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
              }}
              className="nn-btn nn-btn--ghost nn-btn--flex"
            >
              <Users />
              View Clan (C)
            </button>
          </div>
        </HudPanel>
      )}

      {/* Shrine Boosts */}
      {player.shrineBoosts && player.shrineBoosts.length > 0 && (
        <HudPanel accent="var(--nn-violet)" variant="violet" icon={<Sparkles />} title="Shrine Buffs" meta="ACTIVE">
          {activeBoosts.length > 0 ? (
            <>
              {activeBoosts.map(boost => (
                <div key={boost.tier} className="nn-well">
                  <span className="nn-row__value" style={{ fontSize: '0.75rem' }}>
                    <span aria-hidden className="mr-1.5">{getBoostIcon(boost.tier)}</span>
                    {boost.tier.charAt(0).toUpperCase() + boost.tier.slice(1)}
                  </span>
                  <span className="nn-row__label">
                    <Clock />
                    <span className="nn-num">{boostTimers[boost.tier] || '…'}</span>
                  </span>
                </div>
              ))}
              <Row
                label="Total Bonus"
                value={<span style={{ color: 'var(--nn-violet)' }}>+{(totalShrineBonus * 100).toFixed(0)}%</span>}
              />
            </>
          ) : (
            <p className="nn-footnote" style={{ textAlign: 'left' }}>No active buffs</p>
          )}
        </HudPanel>
      )}

      {/* Action Menu */}
      <HudPanel accent="var(--nn-cyan)" icon={<Trophy />} title="Actions" meta="COMMAND">
        <div className="nn-actions2" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
            }}
            className="nn-btn nn-btn--ghost"
          >
            <Package />
            Inventory
          </button>
          {player.level >= 15 && (
            <button
              onClick={() => router.push('/game/specialization')}
              className="nn-btn nn-btn--ghost"
            >
              <Star />
              Specialization
            </button>
          )}
        </div>
      </HudPanel>
    </div>
  );
}
