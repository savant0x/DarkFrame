/**
 * @file components/StatsPanel.tsx
 * @created 2025-10-16
 * @updated 2026-09-06 - NEON NOIR reskin (FID-20260906-012 Phase 1)
 * @overview Left panel displaying player statistics as a command instrument
 *
 * OVERVIEW:
 * Player statistics dashboard with real-time shrine boost timers,
 * military power calculations, and resource tracking.
 *
 * UPDATES:
 * - 2025-10-17: Added shrine boost display with real-time timers
 * - 2025-10-18: Refactored with StatCard grid, useCountUp animations
 * - 2026-09-06: NEON NOIR reskin — glass-over-void HUD panels with
 *   corner-bracket framing, per-panel semantic accents (glow = meaning),
 *   Orbitron tabular numerals, segmented STR/DEF power meter, and scanline
 *   module headers. Logic/handlers unchanged. `xpProgress` cast removed via
 *   the type now declared on Player.
 */

'use client';

import React, { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';

import { useCountUp, useIsMobile } from '@/hooks';

import XPProgressBar from './XPProgressBar';
import {
  User, MapPin, Swords, Shield as ShieldIcon,
  Users, Trophy, Zap, Wrench,
  Clock, TrendingUp, Star, Sparkles, Package, Mountain,
  Gift, Crown, Flag
} from 'lucide-react';

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

/** NEON NOIR HUD module: glass panel with corner brackets + scanline header.
 *  `accent` assigns the panel's semantic signal color (§3.3: glow = meaning). */
function HudPanel({ accent, icon, title, children }: {
  accent: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="nn-panel" style={{ '--nn-accent': accent } as CSSProperties}>
      <div className="nn-panel__header">
        <span className="nn-panel__icon">{icon}</span>
        <h3 className="nn-panel__title">{title}</h3>
      </div>
      <div className="nn-panel__body">{children}</div>
    </section>
  );
}

/** Labeled data row with an Orbitron tabular value. */
function Row({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="nn-row">
      <span className="nn-row__label">{icon}{label}</span>
      <span className="nn-row__value nn-num">{value}</span>
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
        <HudPanel accent="var(--nn-cyan)" icon={<User />} title="Loading">
          <p className="nn-text-dim">Loading player data...</p>
        </HudPanel>
      </div>
    );
  }

  // Calculate total shrine boost
  const activeBoosts = player.shrineBoosts?.filter(boost =>
    new Date(boost.expiresAt) > new Date()
  ) || [];
  const totalShrineBonus = activeBoosts.reduce((sum, boost) => sum + boost.yieldBonus, 0);
  const hasVIP = !!(player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date());

  // Military balance: percentage splits + safety for the zero-army case
  const totalPower = (player.totalStrength ?? 0) + (player.totalDefense ?? 0);
  const strPct = totalPower > 0 ? ((player.totalStrength / totalPower) * 100).toFixed(0) : null;
  const defPct = totalPower > 0 ? ((player.totalDefense / totalPower) * 100).toFixed(0) : null;
  const meterStrWidth = strPct ? `${strPct}%` : '50%';
  const meterDefWidth = defPct ? `${defPct}%` : '50%';

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
      <HudPanel accent="var(--nn-cyan)" icon={<User />} title="Player Info">
        <div className="space-y-1.5">
          <Row label="Commander" value={player.username} />
          <Row
            label="Factories"
            value={
              <button
                onClick={onFactoryManagementClick}
                className="nn-link"
                title="Click to manage factories"
              >
                {player.factoryCount ?? 0}
              </button>
            }
          />
          <Row label="Level" value={player.level ?? 1} />
          <Row label="Rank" value={player.rank ?? 1} />
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
                  className="nn-chip nn-chip--violet"
                  title="Manage your VIP subscription"
                >
                  <Crown className="!h-3 !w-3" /> Active
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
                  {clanTag && <span className="nn-text-violet">[{clanTag}]</span>}
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
        </div>
      </HudPanel>

      {/* XP Progress */}
      {player.xpProgress && (
        <HudPanel accent="var(--nn-violet)" icon={<Star />} title="Experience">
          <XPProgressBar
            level={player.level || 1}
            currentLevelXP={player.xpProgress.currentLevelXP}
            xpForNextLevel={player.xpProgress.xpForNextLevel}
            totalXP={player.xp || 0}
          />
          {player.researchPoints !== undefined && player.researchPoints > 0 && (
            <div className="mt-3">
              <div className="nn-divider" />
              <Row
                icon={<TrendingUp />}
                label="Research"
                value={<span className="nn-text-violet">{player.researchPoints.toLocaleString()} RP</span>}
              />
            </div>
          )}
        </HudPanel>
      )}

      {/* Resources */}
      <HudPanel accent="var(--nn-amber)" icon={<Wrench />} title="Resources">
        <div className="space-y-3">
          <div>
            <Row
              icon={<Wrench />}
              label="Metal"
              value={Math.round(metalCount).toLocaleString()}
            />
            <div className="nn-well mt-1.5">
              <span className="nn-row__label">Banked</span>
              <span className="nn-num text-xs nn-text-dim">
                {(player.bank?.metal ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div>
            <Row
              icon={<Zap />}
              label="Energy"
              value={Math.round(energyCount).toLocaleString()}
            />
            <div className="nn-well mt-1.5">
              <span className="nn-row__label">Banked</span>
              <span className="nn-num text-xs nn-text-dim">
                {(player.bank?.energy ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </HudPanel>

      {/* Military Power */}
      <HudPanel accent="var(--nn-cyan)" icon={<Swords />} title="Military Power">
        <div className="space-y-2">
          {/* Segmented STR/DEF meter — cyan = offense, magenta = defense */}
          <div className="nn-meter" role="img" aria-label={`Strength ${strPct ?? 0} percent, defense ${defPct ?? 0} percent`}>
            <div className="nn-meter__seg nn-meter__seg--str" style={{ width: meterStrWidth }} />
            <div className="nn-meter__seg nn-meter__seg--def" style={{ width: meterDefWidth }} />
            <div className="nn-meter__ticks" />
          </div>
          <div className="flex items-center justify-between">
            <span className="nn-row__label">
              <Swords /> STR {strPct ? `${strPct}%` : ''}
            </span>
            <span className="nn-num nn-text-cyan text-sm font-semibold">
              {Math.round(strengthCount).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="nn-row__label">
              <ShieldIcon /> DEF {defPct ? `${defPct}%` : ''}
            </span>
            <span className="nn-num nn-text-magenta text-sm font-semibold">
              {Math.round(defenseCount).toLocaleString()}
            </span>
          </div>

          <hr className="nn-divider" />

          <Row label="Total Power" value={Math.round(effectivePower).toLocaleString()} />

          {player.balanceEffects && player.balanceEffects.status !== 'BALANCED' && player.balanceEffects.status !== 'OPTIMAL' && (
            <div className="nn-note">
              <span aria-hidden>⚠</span>
              <span>{player.balanceEffects.recommendation || 'Imbalanced army'}</span>
            </div>
          )}

          <button
            onClick={() => router.push('/game/unit-factory')}
            className="nn-btn nn-btn--primary"
          >
            <Users />
            Build Units
          </button>
        </div>
      </HudPanel>

      {/* Harvest Calculator */}
      <HudPanel accent="var(--nn-green)" icon={<TrendingUp />} title="Harvest Calculator">
        <div className="space-y-3">
          {/* VIP Status Indicator */}
          {hasVIP ? (
            <div className="nn-well" style={{ '--nn-accent': 'var(--nn-violet)' } as CSSProperties}>
              <span className="nn-row__label"><Zap /> VIP ×2</span>
              <span className="nn-text-violet text-[10px]">All harvests doubled</span>
            </div>
          ) : (
            <div className="nn-well">
              <span className="nn-row__label">VIP Not Active</span>
              <button
                onClick={() => router.push('/game/vip-upgrade')}
                className="nn-link"
              >
                Get VIP
              </button>
            </div>
          )}

          {/* Metal Breakdown */}
          <div>
            <span className="nn-row__label mb-1.5"><Wrench /> Metal Node</span>
            <div className="ml-4 space-y-1">
              <Row label="Base" value="1,000" />
              <Row
                label="Gathering"
                value={<span className="nn-text-green">+{player.gatheringBonus?.metalBonus ?? 0}%</span>}
              />
              {activeBoosts.length > 0 && (
                <Row
                  icon={<Sparkles />}
                  label="Shrine"
                  value={<span className="nn-text-cyan">+{(totalShrineBonus * 100).toFixed(0)}%</span>}
                />
              )}
              {hasVIP && (
                <Row
                  icon={<Zap />}
                  label="VIP"
                  value={<span className="nn-text-violet font-bold">×2</span>}
                />
              )}
              {isPlayerFlagBearer && (
                <Row
                  icon={<Flag />}
                  label="Bearer"
                  value={<span className="nn-text-amber font-bold">+100%</span>}
                />
              )}
              <hr className="nn-divider" />
              <Row
                label="Expected"
                value={<span className="nn-text-green font-bold">{(() => {
                  let amount = 1000 * (1 + ((player.gatheringBonus?.metalBonus || 0) / 100)) * (1 + totalShrineBonus);
                  if (hasVIP) amount *= 2;
                  if (isPlayerFlagBearer) amount *= 2; // Flag bearer +100% = 2x multiplier
                  return Math.round(amount).toLocaleString();
                })()}</span>}
              />
            </div>
          </div>

          <hr className="nn-divider" />

          {/* Energy Breakdown */}
          <div>
            <span className="nn-row__label mb-1.5"><Zap /> Energy Node</span>
            <div className="ml-4 space-y-1">
              <Row label="Base" value="1,000" />
              <Row
                label="Gathering"
                value={<span className="nn-text-green">+{player.gatheringBonus?.energyBonus ?? 0}%</span>}
              />
              {activeBoosts.length > 0 && (
                <Row
                  icon={<Sparkles />}
                  label="Shrine"
                  value={<span className="nn-text-cyan">+{(totalShrineBonus * 100).toFixed(0)}%</span>}
                />
              )}
              {hasVIP && (
                <Row
                  icon={<Zap />}
                  label="VIP"
                  value={<span className="nn-text-violet font-bold">×2</span>}
                />
              )}
              {isPlayerFlagBearer && (
                <Row
                  icon={<Flag />}
                  label="Bearer"
                  value={<span className="nn-text-amber font-bold">+100%</span>}
                />
              )}
              <hr className="nn-divider" />
              <Row
                label="Expected"
                value={<span className="nn-text-green font-bold">{(() => {
                  let amount = 1000 * (1 + ((player.gatheringBonus?.energyBonus || 0) / 100)) * (1 + totalShrineBonus);
                  if (hasVIP) amount *= 2;
                  if (isPlayerFlagBearer) amount *= 2; // Flag bearer +100% = 2x multiplier
                  return Math.round(amount).toLocaleString();
                })()}</span>}
              />
            </div>
          </div>

          <hr className="nn-divider" />

          {/* Cave/Forest Breakdown */}
          <div>
            <span className="nn-row__label mb-1.5"><Mountain /> Cave / Forest</span>
            <div className="ml-4 space-y-1">
              <Row label="Base" value="500–1,500" />
              <Row
                label="Gathering"
                value={<span className="nn-text-green">+{player.gatheringBonus?.metalBonus ?? 0}% / +{player.gatheringBonus?.energyBonus ?? 0}%</span>}
              />
              {activeBoosts.length > 0 && (
                <Row
                  icon={<Sparkles />}
                  label="Shrine"
                  value={<span className="nn-text-cyan">+{(totalShrineBonus * 100).toFixed(0)}%</span>}
                />
              )}
              {hasVIP && (
                <Row
                  icon={<Zap />}
                  label="VIP"
                  value={<span className="nn-text-violet font-bold">×2</span>}
                />
              )}
              {isPlayerFlagBearer && (
                <Row
                  icon={<Flag />}
                  label="Bearer"
                  value={<span className="nn-text-amber font-bold">+100%</span>}
                />
              )}
              <hr className="nn-divider" />
              <Row
                label="Expected"
                value={<span className="nn-text-green font-bold">{(() => {
                  let minAmount = 500 * (1 + ((player.gatheringBonus?.metalBonus || 0) / 100)) * (1 + totalShrineBonus);
                  let maxAmount = 1500 * (1 + ((player.gatheringBonus?.metalBonus || 0) / 100)) * (1 + totalShrineBonus);
                  if (hasVIP) {
                    minAmount *= 2;
                    maxAmount *= 2;
                  }
                  if (isPlayerFlagBearer) {
                    minAmount *= 2; // Flag bearer +100% = 2x multiplier
                    maxAmount *= 2;
                  }
                  return `${Math.round(minAmount).toLocaleString()}–${Math.round(maxAmount).toLocaleString()}`;
                })()}</span>}
              />
            </div>
          </div>

          {/* Harvest Cooldown Info */}
          <div className="nn-note">
            <Clock />
            <span>5-minute cooldown per tile after harvesting</span>
          </div>
        </div>
      </HudPanel>

      {/* Clan Info */}
      {player.clanId && (
        <HudPanel accent="var(--nn-violet)" icon={<Users />} title="Clan">
          <div className="space-y-1.5">
            <Row label="Name" value={<span className="nn-text-violet max-w-[150px] truncate">{player.clanName || 'Unknown'}</span>} />
            <Row label="Level" value={player.clanLevel ?? 1} />
            <Row
              label="Role"
              value={<span className="nn-text-cyan text-[10px] uppercase tracking-wider">{player.clanRole || 'MEMBER'}</span>}
            />
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
              }}
              className="nn-btn nn-btn--ghost mt-2"
            >
              <Users />
              View Clan (C)
            </button>
          </div>
        </HudPanel>
      )}

      {/* Shrine Boosts */}
      {player.shrineBoosts && player.shrineBoosts.length > 0 && (
        <HudPanel accent="var(--nn-violet)" icon={<Sparkles />} title="Shrine Buffs">
          {activeBoosts.length > 0 ? (
            <div className="space-y-1.5">
              {activeBoosts.map(boost => (
                <div key={boost.tier} className="nn-well" style={{ '--nn-accent': 'var(--nn-violet)' } as CSSProperties}>
                  <span className="nn-row__value text-xs">
                    <span aria-hidden className="mr-1.5">{getBoostIcon(boost.tier)}</span>
                    {boost.tier.charAt(0).toUpperCase() + boost.tier.slice(1)}
                  </span>
                  <span className="nn-row__label">
                    <Clock />
                    <span className="nn-num">{boostTimers[boost.tier] || '…'}</span>
                  </span>
                </div>
              ))}
              <hr className="nn-divider" />
              <Row
                label="Total Bonus"
                value={<span className="nn-text-violet">+{(totalShrineBonus * 100).toFixed(0)}%</span>}
              />
            </div>
          ) : (
            <p className="nn-text-dim text-xs">No active buffs</p>
          )}
        </HudPanel>
      )}

      {/* Action Menu */}
      <HudPanel accent="var(--nn-cyan)" icon={<Trophy />} title="Actions">
        <div className="space-y-2">
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
