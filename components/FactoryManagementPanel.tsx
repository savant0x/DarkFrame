/**
 * FactoryManagementPanel Component (Refactored)
 * 
 * Modern factory management dashboard
 * 
 * Created: 2025-10-17
 * Refactored: 2025-10-18 (FID-20251018-044 Phase 4)
 * 
 * OVERVIEW:
 * Comprehensive factory management interface with animated grid, stats dashboard,
 * and action controls. Shows all owned factories with upgrade/abandon capabilities.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Factory } from '@/types/game.types';
import { formatFactoryLevel, formatUpgradeCost } from '@/lib/factoryUpgradeService';
import { Panel } from './ui/Panel';
import { StatCard } from './ui/StatCard';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { Divider } from './ui/Divider';
import { ProgressBar } from './ui/ProgressBar';
import { StaggerChildren, StaggerItem } from './transitions/StaggerChildren';
import { LoadingSpinner } from './transitions/LoadingSpinner';
import { toast } from '@/lib/toast';
import { useCountUp } from '@/hooks/useCountUp';
import { Factory as FactoryIcon, TrendingUp, Trash2, AlertTriangle, Info } from 'lucide-react';

interface FactoryData {
  factory: Factory;
  stats: { level: number; maxSlots: number; regenRate: number };
  upgradeCost: { metal: number; energy: number; level: number } | null;
  canUpgrade: boolean;
  upgradeProgress: number;
  availableSlots: number;
  timeUntilNextSlot: { hours: number; minutes: number; seconds: number; totalMs: number };
}

interface FactoryManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

export default function FactoryManagementPanel({ isOpen, onClose, username }: FactoryManagementPanelProps) {
  const [factories, setFactories] = useState<FactoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factoryCount, setFactoryCount] = useState(0);
  const [maxFactories, setMaxFactories] = useState(10);
  const [totalInvestment, setTotalInvestment] = useState({ metal: 0, energy: 0, total: 0 });
  const [playerResources, setPlayerResources] = useState({ metal: 0, energy: 0 });
  const [abandonConfirm, setAbandonConfirm] = useState<{ x: number; y: number } | null>(null);

  const investmentMetal = useCountUp(totalInvestment.metal, { duration: 1000 });
  const investmentEnergy = useCountUp(totalInvestment.energy, { duration: 1000 });

  const fetchFactories = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/factory/list`);
      const data = await response.json();
      if (data.success) {
        setFactories(data.factories);
        setFactoryCount(data.count);
        setMaxFactories(data.maxFactories);
        setTotalInvestment(data.totalInvestment);
        setPlayerResources(data.playerResources);
      } else {
        setError('Failed to load factories');
      }
    } catch (err) {
      setError('Failed to load factories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchFactories();
  }, [isOpen, username]);

  const handleUpgrade = async (x: number, y: number) => {
    try {
      const response = await fetch('/api/factory/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factoryX: x, factoryY: y })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        fetchFactories();
      } else {
        const errMsg = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error));
        toast.error(errMsg);
      }
    } catch {
      toast.error('Failed to upgrade factory');
    }
  };

  const handleReleaseAll = async () => {
    if (!confirm('Release ALL your factories? They will be reset to Level 1 for other players to claim.')) return;

    try {
      const response = await fetch('/api/factory/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'releaseAll', username })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        fetchFactories();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Failed to release factories');
    }
  };

  const handleAbandon = async (x: number, y: number) => {
    try {
      const response = await fetch('/api/factory/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', factoryX: x, factoryY: y, username })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        setAbandonConfirm(null);
        fetchFactories();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error('Failed to release factory');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border-2 border-border-main rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
          <div className="bg-bg-secondary p-4 border-b border-border-main">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <FactoryIcon className="w-6 h-6" />
                Factory Management
              </h2>
              <Button onClick={onClose} variant="secondary" size="sm">×</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard label="Owned Factories" value={`${factoryCount}/${maxFactories}`} icon={<FactoryIcon className="w-5 h-5" />} color="primary" />
              <StatCard label="Total Investment (Metal)" value={Math.round(investmentMetal).toLocaleString()} icon={<TrendingUp className="w-5 h-5" />} color="metal" />
              <StatCard label="Total Investment (Energy)" value={Math.round(investmentEnergy).toLocaleString()} icon={<TrendingUp className="w-5 h-5" />} color="energy" />
            </div>
            <div className="mt-2 text-sm text-text-tertiary flex items-center gap-2">
              <Info className="w-4 h-4" />
              Current Resources: {playerResources.metal.toLocaleString()} M + {playerResources.energy.toLocaleString()} E
            </div>
            
            {/* Release All Controls */}
            {factoryCount > 0 && (
              <div className="mt-3 p-3 bg-bg-primary border border-border-light rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Release All Factories
                  </h3>
                  <Button onClick={handleReleaseAll} variant="danger" size="sm">
                    Release All ({factoryCount})
                  </Button>
                </div>
                <p className="text-xs text-text-tertiary mt-1">Releases all factories. They keep their levels and upgrades for other players to claim.</p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-bg-primary">
            {loading && <div className="text-center py-12"><LoadingSpinner size="lg" /><p className="text-text-secondary mt-4">Loading factories...</p></div>}
            {error && <div className="text-center text-red-400 py-8">{error}</div>}
            {!loading && !error && factoryCount === 0 && (
              <div className="text-center text-text-secondary py-12">
                <FactoryIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="mb-2">You don't own any factories yet.</p>
                <p className="text-sm">Capture factories by moving to factory tiles and attacking them.</p>
              </div>
            )}
            {!loading && !error && factories.length > 0 && (
              <StaggerChildren staggerDelay={0.05} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {factories.map(({ factory, stats, upgradeCost, canUpgrade, upgradeProgress, availableSlots, timeUntilNextSlot }) => (
                  <StaggerItem key={`${factory.x},${factory.y}`}>
                    <Card className="h-full hover:border-accent-primary/50 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-text-primary">Factory ({factory.x}, {factory.y})</h3>
                          <Badge variant="primary">{formatFactoryLevel(factory.level || 1)}</Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-text-tertiary">Progress</div>
                           <Badge variant="warning">{upgradeProgress}%</Badge>
                        </div>
                      </div>
                      <Divider className="my-3" />
                      <div className="space-y-2 text-sm mb-3">
                        <div className="flex justify-between"><span className="text-text-secondary">Max Slots:</span><Badge variant="default">{stats.maxSlots}</Badge></div>
                        <div className="flex justify-between"><span className="text-text-secondary">Available:</span><Badge variant="success">{availableSlots}</Badge></div>
                        <div className="flex justify-between"><span className="text-text-secondary">Regen Rate:</span><Badge variant="info">{stats.regenRate.toFixed(1)}/hour</Badge></div>
                        {timeUntilNextSlot.totalMs > 0 && availableSlots < stats.maxSlots && (
                          <div className="text-xs text-text-tertiary">Next slot: {timeUntilNextSlot.hours}h {timeUntilNextSlot.minutes}m</div>
                        )}
                      </div>
                      {upgradeCost && (
                        <Card className="bg-bg-secondary border-border-light mb-3 p-3">
                          <div className="text-xs text-text-tertiary mb-1">Upgrade to Level {upgradeCost.level}:</div>
                          <div className={`text-sm font-semibold ${canUpgrade ? 'text-green-400' : 'text-red-400'}`}>
                            {upgradeCost.metal.toLocaleString()} M + {upgradeCost.energy.toLocaleString()} E
                          </div>
                          <div className="text-xs text-text-tertiary mt-1">Next: {stats.maxSlots + 500} slots, {(stats.regenRate + 41.67).toFixed(1)}/hr</div>
                        </Card>
                      )}
                      {factory.level === 10 && <div className="mb-3 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded text-center"><Badge variant="warning">⭐ MAX LEVEL ⭐</Badge></div>}
                      <div className="flex gap-2">
                        {upgradeCost && <Button onClick={() => handleUpgrade(factory.x, factory.y)} disabled={!canUpgrade} variant="success" size="sm" className="flex-1"><TrendingUp className="w-4 h-4 mr-1" />Upgrade</Button>}
                        <Button onClick={() => setAbandonConfirm({ x: factory.x, y: factory.y })} variant="danger" size="sm"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerChildren>
            )}
          </div>

          <div className="bg-bg-secondary p-3 border-t border-border-main text-xs text-text-tertiary flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p><strong>Tips:</strong> Upgrade factories to increase production capacity and regeneration rate. Abandoning a factory clears ownership. The factory keeps its level and upgrades for the next player to claim.</p>
          </div>
        </div>
      </div>

      {abandonConfirm && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4">
          <Card className="max-w-md border-red-500/50">
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2"><AlertTriangle className="w-6 h-6" />Abandon Factory?</h3>
            <p className="text-text-secondary mb-2">Are you sure you want to abandon the factory at ({abandonConfirm.x}, {abandonConfirm.y})?</p>
            <p className="text-red-400 text-sm mb-4">This clears your ownership. The factory keeps its current level and upgrades, and becomes claimable by any player.</p>
            <div className="flex gap-3">
              <Button onClick={() => setAbandonConfirm(null)} variant="secondary" className="flex-1">Cancel</Button>
              <Button onClick={() => handleAbandon(abandonConfirm.x, abandonConfirm.y)} variant="danger" className="flex-1">Abandon Factory</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
