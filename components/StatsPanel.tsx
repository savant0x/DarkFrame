'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Button } from '@/components/ui';
import { useCountUp } from '@/hooks';
import BalanceIndicator from './BalanceIndicator';
import XPProgressBar from './XPProgressBar';
import { User, Swords, Users, Trophy, Zap, Wrench, Clock, Star, Sparkles, Package, TrendingUp } from 'lucide-react';
import { GAME_CONSTANTS } from '@/types';
import { getXPProgress } from '@/lib/xpUtils';

interface StatsPanelProps {
  onClanClick?: () => void;
  onReferralsClick?: () => void;
  onFactoryManagementClick?: () => void;
  flagBearer?: { playerId: string; username: string; level: number; position: { x: number; y: number }; currentHP?: number; maxHP?: number } | null;
}

export default function StatsPanel({ onClanClick, onReferralsClick, onFactoryManagementClick, flagBearer }: StatsPanelProps = {}) {
  const { player } = useGameContext();
  const router = useRouter();
  const [boostTimers, setBoostTimers] = useState<Record<string, string>>({});
  const [clanTag, setClanTag] = useState<string | null>(null);
  const [harvestPreview, setHarvestPreview] = useState<{ minExpected: number; maxExpected: number } | null>(null);

  const metalCount = useCountUp(player?.resources?.metal || 0, { duration: 1000 });
  const energyCount = useCountUp(player?.resources?.energy || 0, { duration: 1000 });
  const strengthCount = useCountUp(player?.totalStrength || 0, { duration: 1200 });
  const defenseCount = useCountUp(player?.totalDefense || 0, { duration: 1200 });
  const effectivePower = useCountUp(player?.balanceEffects?.effectivePower ?? ((player?.totalStrength || 0) + (player?.totalDefense || 0)), { duration: 1500 });

  const xpProgress = useMemo(() => {
    if (!player) return null;
    const xp = typeof player.xp === 'string' ? parseFloat(player.xp) : (player.xp || 0);
    return getXPProgress(xp);
  }, [player?.xp]);

  const isVIPActive = player?.is_vip && player?.vip_expiration && new Date(player.vip_expiration) > new Date();

  useEffect(() => {
    if (!player?.clanId) { setClanTag(null); return; }
    fetch(`/api/clan?clanId=${player.clanId}`).then(r => r.json()).then(d => setClanTag(d.tag || null)).catch(() => {});
  }, [player?.clanId]);

  useEffect(() => {
    if (!player?.shrineBoosts) return;
    const update = () => {
      const now = new Date();
      const timers: Record<string, string> = {};
      player.shrineBoosts.forEach(b => {
        const ms = new Date(b.expiresAt).getTime() - now.getTime();
        if (ms > 0) timers[b.tier] = `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
      });
      setBoostTimers(timers);
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [player?.shrineBoosts]);

  // Fetch harvest preview from server — single source of truth
  useEffect(() => {
    if (!player) return;
    const fetchPreview = async () => {
      try {
        const res = await fetch(`/api/harvest/preview?username=${player.username}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setHarvestPreview({ minExpected: data.data.minExpected, maxExpected: data.data.maxExpected });
          } else {
            setHarvestPreview(null);
          }
        }
      } catch {
        setHarvestPreview(null);
      }
    };
    fetchPreview();
    const interval = setInterval(fetchPreview, 10000);
    return () => clearInterval(interval);
  }, [player?.username]);

  const activeBoosts = player?.shrineBoosts?.filter(b => new Date(b.expiresAt) > new Date()) || [];
  const totalShrineBonus = activeBoosts.reduce((s, b) => s + b.yieldBonus, 0);
  const isPlayerFlagBearer = !!(flagBearer && player && flagBearer.username === player?.username);

  const metalCalc = harvestPreview ? `${harvestPreview.minExpected.toLocaleString()}–${harvestPreview.maxExpected.toLocaleString()}` : '—';
  const energyCalc = metalCalc; // Same range for both terrain types

  if (!player) return <div className="p-3"><p className="text-xs text-[--text-3]">Loading…</p></div>;

  return (
    <div className="space-y-2 p-2">
      {/* Player Info */}
      <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gradient-to-r from-[--electric]/8 to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-[--electric]" /> PLAYER INFO
        </div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">Commander</td><td className="px-2 py-1 text-right text-[--text-1] font-bold">{player.username}</td></tr>
            <tr className="bg-[--row-odd]"><td className="px-2 py-1 text-[--text-2]">Base</td><td className="px-2 py-1 text-right text-[--text-1] font-mono font-bold">({player.base?.x || 75}, {player.base?.y || 75})</td></tr>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">Factories</td><td className="px-2 py-1 text-right text-[--text-1] font-bold"><button onClick={onFactoryManagementClick} className="hover:text-[--electric] cursor-pointer">{player.factoryCount || 0}</button></td></tr>
            <tr className="bg-[--row-odd]"><td className="px-2 py-1 text-[--text-2]">Level</td><td className="px-2 py-1 text-right text-[--text-1] font-bold">{player.level || 1}</td></tr>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">Rank</td><td className="px-2 py-1 text-right text-[--text-1] font-bold">{player.rank || 1}</td></tr>
            <tr className="bg-[--row-odd]"><td className="px-2 py-1 text-[--text-2]">RP</td><td className="px-2 py-1 text-right text-[--text-1] font-mono font-bold">{(player.researchPoints || 0).toLocaleString()}</td></tr>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">VIP</td><td className="px-2 py-1 text-right font-bold">{isVIPActive ? <span className="text-[--neon-yellow]">👑 ACTIVE</span> : <button onClick={() => router.push('/game/vip-upgrade')} className="text-[--neon-pink] hover:underline">Get VIP</button>}</td></tr>
            <tr className="bg-[--row-odd]"><td className="px-2 py-1 text-[--text-2]">Clan</td><td className="px-2 py-1 text-right font-bold">{player.clanId ? <button onClick={onClanClick || (() => router.push('/clan'))} className="text-[--neon-pink] hover:underline">{clanTag && <span className="font-bold">[{clanTag}]</span>}{(player.clanName || 'View Clan').substring(0, 12)}</button> : <button onClick={onClanClick || (() => router.push('/clan'))} className="text-[--electric] hover:underline">Join/Create</button>}</td></tr>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">🎁 Referrals</td><td className="px-2 py-1 text-right font-bold"><button onClick={onReferralsClick || (() => router.push('/referrals'))} className="text-[--neon-pink] hover:underline">Invite Friends</button></td></tr>
          </tbody>
        </table>
      </div>

      {/* XP Progress */}
      <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gradient-to-r from-[--solar]/8 to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-[--solar]" /> EXPERIENCE
        </div>
        <div className="p-2.5">
          {xpProgress ? (
            <XPProgressBar level={player.level || 1} currentLevelXP={xpProgress.currentLevelXP} xpForNextLevel={xpProgress.xpForNextLevel} totalXP={player.xp || 0} />
          ) : (
            <div className="text-center py-2">
              <p className="text-xs text-[--text-3]">Loading XP data…</p>
              <p className="text-xs text-[--text-2] mt-1">Level {player.level || 1} · {(player.xp || 0).toLocaleString()} XP</p>
            </div>
          )}
        </div>
      </div>

      {/* Resources */}
      <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gradient-to-r from-[--synth]/8 to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-[--synth]" /> RESOURCES
        </div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">⚙ Metal</td><td className="px-2 py-1 text-right text-[--text-1] font-mono font-bold">{Math.round(metalCount).toLocaleString()}</td></tr>
            <tr className="bg-[--row-odd]"><td className="px-2 py-1 text-[--text-3]">Banked</td><td className="px-2 py-1 text-right text-[--text-2] font-mono">{(player.bank?.metal || 0).toLocaleString()}</td></tr>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]"><Zap className="w-3.5 h-3.5 inline mr-1" />Energy</td><td className="px-2 py-1 text-right text-[--text-1] font-mono font-bold">{Math.round(energyCount).toLocaleString()}</td></tr>
            <tr className="bg-[--row-odd]"><td className="px-2 py-1 text-[--text-3]">Banked</td><td className="px-2 py-1 text-right text-[--text-2] font-mono">{(player.bank?.energy || 0).toLocaleString()}</td></tr>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">📊 Operational Data</td><td className="px-2 py-1 text-right text-[--electric] font-mono font-bold">{((player as unknown as Record<string, unknown>).operational_data as number) || 0}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Harvest Calculator */}
      <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gradient-to-r from-[--synth]/8 to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-[--synth]" /> HARVEST CALCULATOR
        </div>
        <div className="p-2.5 space-y-2 text-xs">
          {isVIPActive ? (
            <div className="bg-[--neon-yellow]/8 border border-[--neon-yellow]/20 rounded px-2 py-1">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[--neon-yellow]" />
                <div>
                  <p className="text-[--neon-yellow] font-bold text-[11px]">⚡ VIP ACTIVE — +50% Additive</p>
                  <p className="text-[--neon-yellow]/60 text-[10px]">All harvests receive bonus rewards</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-[--border] rounded px-2 py-1 flex items-center justify-between">
              <p className="text-[--text-2] text-[11px]">VIP Not Active</p>
              <button onClick={() => router.push('/game/vip-upgrade')} className="text-[--neon-pink] hover:underline text-[10px] font-semibold">Get VIP</button>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Wrench className="w-3.5 h-3.5 text-[--text-2]" />
              <span className="text-[--text-2] font-semibold text-[11px]">METAL NODE</span>
            </div>
            <div className="space-y-1 ml-4">
              <div className="flex items-center justify-between"><span className="text-[--text-2]">Base Amount</span><span className="text-[--text-1] font-mono">{GAME_CONSTANTS.HARVEST.MIN_AMOUNT}–{GAME_CONSTANTS.HARVEST.MAX_AMOUNT}</span></div>
              <div className="flex items-center justify-between"><span className="text-[--text-2]">Gathering Bonus</span><span className="text-[--synth] font-mono">+{(player.gatheringBonus?.metalBonus || 0).toFixed(2)}%</span></div>
              {activeBoosts.length > 0 && (<div className="flex items-center justify-between"><span className="text-[--text-2] flex items-center gap-1"><Sparkles className="w-3 h-3 text-[--electric]" />Shrine Buffs</span><span className="text-[--electric] font-mono">+{(totalShrineBonus * 100).toFixed(0)}%</span></div>)}
              {isVIPActive && (<div className="flex items-center justify-between"><span className="text-[--text-2] flex items-center gap-1"><Zap className="w-3 h-3 text-[--neon-yellow]" />VIP Bonus</span><span className="text-[--neon-yellow] font-mono font-bold">+50%</span></div>)}
              {isPlayerFlagBearer && (<div className="flex items-center justify-between"><span className="text-[--text-2] flex items-center gap-1">🚩 Flag Bearer</span><span className="text-[--neon-yellow] font-mono font-bold">+50%</span></div>)}
              <div className="h-px bg-gradient-to-r from-transparent via-[--synth]/20 to-transparent my-1" />
              <div className="flex items-center justify-between"><span className="text-[--text-1] font-semibold">Expected Amount</span><span className="text-[--synth] font-bold font-mono">{metalCalc}</span></div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-[--synth]/20 to-transparent" />

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-[--neon-yellow]" />
              <span className="text-[--text-2] font-semibold text-[11px]">ENERGY NODE</span>
            </div>
            <div className="space-y-1 ml-4">
              <div className="flex items-center justify-between"><span className="text-[--text-2]">Base Amount</span><span className="text-[--text-1] font-mono">{GAME_CONSTANTS.HARVEST.MIN_AMOUNT}–{GAME_CONSTANTS.HARVEST.MAX_AMOUNT}</span></div>
              <div className="flex items-center justify-between"><span className="text-[--text-2]">Gathering Bonus</span><span className="text-[--synth] font-mono">+{(player.gatheringBonus?.energyBonus || 0).toFixed(2)}%</span></div>
              {activeBoosts.length > 0 && (<div className="flex items-center justify-between"><span className="text-[--text-2] flex items-center gap-1"><Sparkles className="w-3 h-3 text-[--electric]" />Shrine Buffs</span><span className="text-[--electric] font-mono">+{(totalShrineBonus * 100).toFixed(0)}%</span></div>)}
              {isVIPActive && (<div className="flex items-center justify-between"><span className="text-[--text-2] flex items-center gap-1"><Zap className="w-3 h-3 text-[--neon-yellow]" />VIP Bonus</span><span className="text-[--neon-yellow] font-mono font-bold">+50%</span></div>)}
              {isPlayerFlagBearer && (<div className="flex items-center justify-between"><span className="text-[--text-2] flex items-center gap-1">🚩 Flag Bearer</span><span className="text-[--neon-yellow] font-mono font-bold">+50%</span></div>)}
              <div className="h-px bg-gradient-to-r from-transparent via-[--synth]/20 to-transparent my-1" />
              <div className="flex items-center justify-between"><span className="text-[--text-1] font-semibold">Expected Amount</span><span className="text-[--synth] font-bold font-mono">{energyCalc}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Military Power */}
      <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gradient-to-r from-[--neon-red]/8 to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5 text-[--neon-red]" /> MILITARY POWER
        </div>
        <table className="w-full text-xs">
          <tbody>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">Strength</td><td className="px-2 py-1 text-right text-[--text-1] font-mono font-bold">{Math.round(strengthCount).toLocaleString()}</td></tr>
            <tr className="bg-[--row-odd]"><td className="px-2 py-1 text-[--text-2]">Defense</td><td className="px-2 py-1 text-right text-[--text-1] font-mono font-bold">{Math.round(defenseCount).toLocaleString()}</td></tr>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-1] font-medium">Total Power</td><td className="px-2 py-1 text-right text-[--electric] font-mono font-bold">{Math.round(effectivePower).toLocaleString()}</td></tr>
          </tbody>
        </table>
        {player.balanceEffects && ((player.totalStrength || 0) + (player.totalDefense || 0) > 0) && (
          <div className="px-2.5 pb-2.5 space-y-2">
            <BalanceIndicator balanceEffects={player.balanceEffects} str={player.totalStrength || 0} def={player.totalDefense || 0} />
            {player.balanceEffects.warnings.length > 0 && (
              <table className="w-full text-xs"><thead><tr className="bg-[--neon-red]/8"><th className="text-left px-2 py-1 text-[--neon-red] font-bold">Penalty</th><th className="text-right px-2 py-1 text-[--neon-red]/70 font-medium">Effect</th></tr></thead><tbody>{player.balanceEffects.warnings.map((w, i) => (<tr key={i} className={i % 2 === 0 ? 'bg-[--row-even]' : 'bg-[--row-odd]'}><td className="px-2 py-1 text-[--neon-red] font-medium">⚠ {w.split(':')[0]}</td><td className="px-2 py-1 text-right text-[--text-2]">{w.split(':')[1] || w}</td></tr>))}</tbody></table>
            )}
            {player.balanceEffects.bonuses.length > 0 && player.balanceEffects.status !== 'BALANCED' && (
              <table className="w-full text-xs"><thead><tr className="bg-[--synth]/8"><th className="text-left px-2 py-1 text-[--synth] font-bold">Bonus</th><th className="text-right px-2 py-1 text-[--synth]/70 font-medium">Effect</th></tr></thead><tbody>{player.balanceEffects.bonuses.map((b, i) => (<tr key={i} className={i % 2 === 0 ? 'bg-[--row-even]' : 'bg-[--row-odd]'}><td className="px-2 py-1 text-[--synth] font-medium">★ {b.split(':')[0]}</td><td className="px-2 py-1 text-right text-[--text-2]">{b.split(':')[1] || b}</td></tr>))}</tbody></table>
            )}
          </div>
        )}
        {/* Army Composition by Archetype */}
        {player.units && player.units.length > 0 && (() => {
          const archetypeCounts: Record<string, number> = { STRIKER: 0, BULWARK: 0, ARTILLERY: 0, SUPPORT: 0 };
          player.units.forEach((u) => {
            const unit = u as unknown as Record<string, unknown>;
            const arch = (unit.archetype as string) || (unit.category === 'STR' ? 'STRIKER' : 'BULWARK');
            if (archetypeCounts[arch] !== undefined) archetypeCounts[arch] += (unit.quantity as number) || 0;
          });
          const total = Object.values(archetypeCounts).reduce((a, b) => a + b, 0);
          if (total === 0) return null;
          return (
            <div className="px-2.5 pb-2">
              <table className="w-full text-xs">
                <thead><tr className="bg-white/[0.03]"><th className="text-left px-2 py-1 text-[--text-3] font-bold" colSpan={3}>ARMY COMPOSITION</th></tr></thead>
                <tbody>
                  <tr className="bg-[--row-even]"><td className="px-2 py-0.5 text-[--neon-red]">⚔ Striker</td><td className="px-2 py-0.5 text-right text-[--text-1] font-mono">{archetypeCounts.STRIKER.toLocaleString()}</td><td className="px-2 py-0.5 text-right text-[--text-3] font-mono">{total > 0 ? ((archetypeCounts.STRIKER / total) * 100).toFixed(0) : 0}%</td></tr>
                  <tr className="bg-[--row-odd]"><td className="px-2 py-0.5 text-[--neon-cyan]">🛡 Bulwark</td><td className="px-2 py-0.5 text-right text-[--text-1] font-mono">{archetypeCounts.BULWARK.toLocaleString()}</td><td className="px-2 py-0.5 text-right text-[--text-3] font-mono">{total > 0 ? ((archetypeCounts.BULWARK / total) * 100).toFixed(0) : 0}%</td></tr>
                  <tr className="bg-[--row-even]"><td className="px-2 py-0.5 text-[--neon-orange]">💥 Artillery</td><td className="px-2 py-0.5 text-right text-[--text-1] font-mono">{archetypeCounts.ARTILLERY.toLocaleString()}</td><td className="px-2 py-0.5 text-right text-[--text-3] font-mono">{total > 0 ? ((archetypeCounts.ARTILLERY / total) * 100).toFixed(0) : 0}%</td></tr>
                  <tr className="bg-[--row-odd]"><td className="px-2 py-0.5 text-[--neon-green]">📡 Support</td><td className="px-2 py-0.5 text-right text-[--text-1] font-mono">{archetypeCounts.SUPPORT.toLocaleString()}</td><td className="px-2 py-0.5 text-right text-[--text-3] font-mono">{total > 0 ? ((archetypeCounts.SUPPORT / total) * 100).toFixed(0) : 0}%</td></tr>
                </tbody>
              </table>
            </div>
          );
        })()}
        <div className="px-2.5 pb-2.5"><Button onClick={() => router.push('/game/unit-factory')} variant="primary" size="sm" fullWidth className="mt-2"><Users className="w-3 h-3" /> Build Units</Button></div>
      </div>

      {/* Clan */}
      {player.clanId && (
        <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-gradient-to-r from-[--neon-pink]/8 to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[--neon-pink]" /> CLAN</div>
          <table className="w-full text-xs"><tbody>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">Name</td><td className="px-2 py-1 text-right text-[--neon-pink] font-bold truncate max-w-[140px]">{player.clanName || 'Unknown'}</td></tr>
            <tr className="bg-[--row-odd]"><td className="px-2 py-1 text-[--text-2]">Level</td><td className="px-2 py-1 text-right text-[--text-1] font-bold">{player.clanLevel || 1}</td></tr>
            <tr className="bg-[--row-even]"><td className="px-2 py-1 text-[--text-2]">Role</td><td className="px-2 py-1 text-right text-[--electric] font-bold uppercase">{player.clanRole || 'MEMBER'}</td></tr>
          </tbody></table>
          <div className="p-2.5 pt-0"><Button onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }))} variant="secondary" size="sm" fullWidth><Users className="w-3.5 h-3.5" /> View Clan (C)</Button></div>
        </div>
      )}

      {/* Shrine Buffs */}
      {player.shrineBoosts && player.shrineBoosts.length > 0 && (
        <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-gradient-to-r from-[--neon-yellow]/8 to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[--neon-yellow]" /> SHRINE BUFFS</div>
          <div className="p-2.5">{activeBoosts.length > 0 ? (<table className="w-full text-xs"><tbody>{activeBoosts.map((b, i) => (<tr key={b.tier} className={i % 2 === 0 ? 'bg-[--row-even]' : 'bg-[--row-odd]'}><td className="px-2 py-1 text-[--text-1] font-medium">{getSuitIcon(b.tier)} {b.tier.charAt(0).toUpperCase() + b.tier.slice(1)}</td><td className="px-2 py-1 text-right text-[--text-3] font-mono"><Clock className="w-3 h-3 inline mr-1" />{boostTimers[b.tier] || '…'}</td></tr>))}<tr className="bg-[--row-even] border-t border-[--border]"><td className="px-2 py-1 text-[--text-3]">Total</td><td className="px-2 py-1 text-right text-[--neon-yellow] font-bold font-mono">+{(totalShrineBonus * 100).toFixed(0)}%</td></tr></tbody></table>) : <p className="text-[--text-3] text-xs">No active buffs</p>}</div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gradient-to-r from-white/[0.03] to-transparent border-b border-[--border] text-[13px] font-bold text-[--text-1] flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-[--text-3]" /> ACTIONS</div>
        <div className="p-2.5 space-y-1">
          <Button onClick={() => { window.dispatchEvent(new CustomEvent('openInventory')); }} variant="secondary" size="sm" fullWidth><Package className="w-3.5 h-3.5" /> Inventory</Button>
          {player.level >= 15 && <Button onClick={() => router.push('/game/specialization')} variant="secondary" size="sm" fullWidth><Star className="w-3.5 h-3.5" /> Specialization</Button>}
        </div>
      </div>
    </div>
  );
}

function getSuitIcon(tier: string): string {
  switch (tier) { case 'speed': return '♠'; case 'heart': return '♥'; case 'diamond': return '♦'; case 'club': return '♣'; default: return '✦'; }
}
