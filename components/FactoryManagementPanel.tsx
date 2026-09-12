
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

import React, { useState, useEffect, useCallback } from 'react';
import { Factory } from '@/types/game.types';
import { formatFactoryLevel } from '@/lib/factoryUpgradeService';

import { toast } from '@/lib/toast';
import { extractApiError } from '@/lib/apiClient';
import { Factory as FactoryIcon, TrendingUp, Trash2, AlertTriangle, Info, Filter } from 'lucide-react';
import { useBearerStatus } from '@/hooks/useBearerStatus';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface FactoryData {
  factory: Factory;
  stats: { level: number; maxSlots: number; regenRate: number };
  upgradeCost: { metal: number; energy: number; level: number } | null;
  canUpgrade: boolean;
  upgradeProgress: {
    level: number;
    percentage: number;
    slotsUsed: number;
    slotsRequired: number;
  };
  availableSlots: number;
  timeUntilNextSlot: { hours: number; minutes: number; seconds: number; totalMs: number };
  invested: { metal: number; energy: number }; // FID-20260909-032 §H
}

interface FactoryManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

type SortOption = 'level' | 'slots' | 'location';

export default function FactoryManagementPanel({ isOpen, onClose, username }: FactoryManagementPanelProps) {
  const [factories, setFactories] = useState<FactoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factoryCount, setFactoryCount] = useState(0);
  const [maxFactories, setMaxFactories] = useState(10);
  const [totalInvestment, setTotalInvestment] = useState({ metal: 0, energy: 0, total: 0 });
  const [playerResources, setPlayerResources] = useState({ metal: 0, energy: 0 });
  const [abandonConfirm, setAbandonConfirm] = useState<{ x: number; y: number } | null>(null);
  const [batchReleaseMode, setBatchReleaseMode] = useState(false);
  const [slotThreshold, setSlotThreshold] = useState(20);
  const [sortBy, setSortBy] = useState<SortOption>('level');
  // FID-20260912-077: bearer-aware — factory capture/produce (and now build)
  // all 403 while holding; upgrades stay allowed.
  const { isBearer } = useBearerStatus();

  const fetchFactories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/factory/list?username=${username}`);
      const data = await response.json();
      if (data.success) {
        setFactories(data.factories);
        setFactoryCount(data.count);
        setMaxFactories(data.maxFactories);
        setTotalInvestment(data.totalInvestment);
        setPlayerResources(data.playerResources);
      } else {
        // FID-20260911-041: server's reason, not a static string.
        setError(extractApiError(data, response.status));
      }
    } catch {
      setError('Failed to load factories — network error');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (isOpen) fetchFactories();
  }, [isOpen, fetchFactories]);

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
        // FID-20260911-041: data.error may be a structured OBJECT — extract.
        toast.error(extractApiError(data, response.status));
      }
    } catch {
      toast.error('Failed to upgrade factory — network error');
    }
  };

  const handleAbandon = async (x: number, y: number) => {
    try {
      const response = await fetch('/api/factory/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', factoryX: x, factoryY: y })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        setAbandonConfirm(null);
        fetchFactories();
      } else {
        toast.error(extractApiError(data, response.status));
      }
    } catch {
      toast.error('Failed to release factory — network error');
    }
  };

  const handleBatchRelease = async () => {
    const matchingFactories = factories.filter(f => f.stats.maxSlots <= slotThreshold);
    
    if (matchingFactories.length === 0) {
      toast.error(`No factories found with ${slotThreshold} or fewer slots`);
      return;
    }

    if (!(await confirmDialog(`Release ${matchingFactories.length} ${matchingFactories.length === 1 ? 'factory' : 'factories'} with ${slotThreshold} or fewer slots?\n\nThis cannot be undone!`))) {
      return;
    }

    try {
      const response = await fetch('/api/factory/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'batch', slotThreshold })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        setBatchReleaseMode(false);
        fetchFactories();
      } else {
        toast.error(extractApiError(data, response.status));
      }
    } catch {
      toast.error('Failed to batch release factories — network error');
    }
  };

  const getSortedFactories = () => {
    const sorted = [...factories];
    
    switch (sortBy) {
      case 'level':
        sorted.sort((a, b) => {
          const levelDiff = (b.factory.level || 1) - (a.factory.level || 1);
          if (levelDiff !== 0) return levelDiff;
          return a.factory.y - b.factory.y || a.factory.x - b.factory.x;
        });
        break;
      case 'slots':
        sorted.sort((a, b) => b.stats.maxSlots - a.stats.maxSlots);
        break;
      case 'location':
        sorted.sort((a, b) => a.factory.y - b.factory.y || a.factory.x - b.factory.x);
        break;
    }
    
    return sorted;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="nn-overlay" style={{ zIndex: 60 }}>
        <div className="nn-panel w-full max-w-6xl max-h-[90vh] flex flex-col" style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}>
          <div className="nn-panel__header nn-panel__header--bleed" style={{ margin: 0, borderBottomWidth: 1 }}>
            <span className="nn-panel__icon"><FactoryIcon /></span>
            <h2 className="nn-panel__title" style={{ fontSize: 12 }}>Factory Management</h2>
            <span className="nn-panel__meta">{factoryCount}/{maxFactories} Owned</span>
            <button
              onClick={onClose}
              aria-label="Close factory management"
              className="nn-btn"
              style={{
                width: 'auto',
                flex: 'none',
                padding: '4px 12px',
                '--nn-accent': 'var(--nn-magenta)',
                color: 'var(--nn-magenta)',
                borderColor: 'color-mix(in oklab, var(--nn-magenta) 45%, transparent)',
              } as React.CSSProperties}
            >
              ×
            </button>
          </div>
          {/* Bearer restriction banner (FID-20260912-077) */}
          {isBearer && (
            <div className="mx-5 mt-4 p-3 text-sm rounded-none bg-[color-mix(in_oklab,var(--nn-amber)_18%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_45%,transparent)] text-[color:var(--nn-amber)]">
              🚩 Flag Bearer restriction: producing and building units at your factories is locked while you hold the Flag.
              Upgrades and slot management stay available.
            </div>
          )}
          <div className="px-5 py-4" style={{ borderBottom: '1px solid color-mix(in oklab, var(--nn-cyan) 12%, transparent)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="nn-stat" style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}>
                <p className="nn-stat__lab">Owned Factories</p>
                <p className="nn-stat__num">{factoryCount}<span style={{ fontSize: 13, color: 'var(--nn-text-tertiary)' }}> / {maxFactories}</span></p>
              </div>
              <div className="nn-stat" style={{ '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}>
                <p className="nn-stat__lab">Upgrades Invested · Metal</p>
                <p className="nn-stat__num nn-stat__num--glow-amber">{Math.round(totalInvestment.metal).toLocaleString()}</p>
              </div>
              <div className="nn-stat" style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}>
                <p className="nn-stat__lab">Upgrades Invested · Energy</p>
                <p className="nn-stat__num nn-stat__num--glow-cyan">{Math.round(totalInvestment.energy).toLocaleString()}</p>
              </div>
            </div>
            <div className="nn-row !px-0" style={{ marginTop: 8 }}>
              <span className="nn-row__label"><Info />Current resources</span>
              <span className="nn-row__value nn-num">
                <span className="nn-text-amber">{playerResources.metal.toLocaleString()} M</span>
                <span style={{ color: 'var(--nn-text-tertiary)' }}> + </span>
                <span className="nn-text-cyan">{playerResources.energy.toLocaleString()} E</span>
              </span>
            </div>
            
            {/* Batch Release Controls */}
            {factoryCount > 0 && (
              <div className="nn-brief nn-brief--cyan" style={{ marginTop: 10 }}>
                <div className="nn-brief__head">
                  <span className="nn-brief__title"><Filter style={{ display: 'inline', width: 12, height: 12, marginRight: 6 }} />Batch Management</span>
                  <button
                    onClick={() => setBatchReleaseMode(!batchReleaseMode)}
                    className={`nn-ptab ${batchReleaseMode ? 'nn-ptab--def on' : 'nn-ptab--def'}`}
                    style={{ padding: '2px 0', width: 'auto', flex: 'none' }}
                  >
                    {batchReleaseMode ? 'Cancel' : 'Batch Release'}
                  </button>
                </div>
                
                {batchReleaseMode && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label className="nn-lab" style={{ whiteSpace: 'nowrap' }}>Max Slots</label>
                      <input
                        type="range"
                        min="10"
                        max="30"
                        step="2"
                        value={slotThreshold}
                        onChange={(e) => setSlotThreshold(parseInt(e.target.value))}
                        className="nn-slider"
                        aria-label="Slot threshold"
                      />
                      <span className="nn-chip nn-chip--amber nn-num">{slotThreshold}</span>
                    </div>
                    <div className="nn-lab">
                      {factories.filter(f => f.stats.maxSlots <= slotThreshold).length} factories will be released
                    </div>
                    <button
                      onClick={handleBatchRelease}
                      className="nn-btn"
                      style={{ width: 'auto', '--nn-accent': 'var(--nn-magenta)', color: 'var(--nn-magenta)', borderColor: 'color-mix(in oklab, var(--nn-magenta) 55%, transparent)' } as React.CSSProperties}
                      disabled={factories.filter(f => f.stats.maxSlots <= slotThreshold).length === 0}
                    >
                      <Trash2 />
                      Release All ≤ {slotThreshold} Slots
                    </button>
                  </div>
                )}
                
                {!batchReleaseMode && (
                  <div className="nn-row !px-0">
                    <span className="nn-row__label">Sort by</span>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="nn-input"
                      style={{ padding: '4px 8px', width: 'auto' }}
                      aria-label="Sort factories"
                    >
                      <option value="level">Level (High to Low)</option>
                      <option value="slots">Max Slots (High to Low)</option>
                      <option value="location">Location (Y, X)</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {loading && <div className="text-center py-12"><div className="nn-lab">Loading factories…</div></div>}
            {error && <div className="nn-note" style={{ margin: '12px 0' }}>{error}</div>}
            {!loading && !error && factoryCount === 0 && (
              <div className="text-center py-12">
                <FactoryIcon style={{ width: 40, height: 40, margin: '0 auto 12px', color: 'var(--nn-text-tertiary)' }} />
                <p className="nn-lab" style={{ marginBottom: 6 }}>No factories in inventory</p>
                <p style={{ fontSize: 11.5, color: 'var(--nn-text-secondary)' }}>Capture factories by moving to factory tiles and attacking them.</p>
              </div>
            )}
            {!loading && !error && factories.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getSortedFactories().map(({ factory, stats, upgradeCost, canUpgrade, upgradeProgress, availableSlots, timeUntilNextSlot, invested }) => (
                  <div key={`${factory.x},${factory.y}`} className="nn-panel" style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}>
                    <div className="nn-panel__header">
                      <span className="nn-panel__icon"><FactoryIcon /></span>
                      <span className="nn-panel__title">Factory ({factory.x}, {factory.y})</span>
                      <span className="nn-panel__meta">{formatFactoryLevel(factory.level || 1)}</span>
                    </div>
                    <div className="nn-panel__body">
                      <div className="nn-row">
                        <span className="nn-row__label">Upgrade progress</span>
                        <span className="nn-row__value nn-num nn-text-amber">{upgradeProgress.percentage}%<span className="nn-lab" style={{ marginLeft: 5 }}>UPGRADED · MAX 10</span></span>
                      </div>
                      <div className="nn-row">
                        <span className="nn-row__label">Invested (upgrades + units)</span>
                        <span className="nn-row__value nn-num">
                          <span className="nn-text-amber">{Math.round(invested.metal).toLocaleString()} M</span>
                          <span style={{ color: 'var(--nn-text-tertiary)' }}> + </span>
                          <span className="nn-text-cyan">{Math.round(invested.energy).toLocaleString()} E</span>
                        </span>
                      </div>
                      <div className="nn-row">
                        <span className="nn-row__label">Max Slots</span>
                        <span className="nn-row__value nn-num">{stats.maxSlots}</span>
                      </div>
                      <div className="nn-row">
                        <span className="nn-row__label">Available</span>
                        <span className="nn-row__value nn-num nn-text-green">{availableSlots}</span>
                      </div>
                      <div className="nn-row">
                        <span className="nn-row__label">Regen Rate</span>
                        <span className="nn-row__value nn-num nn-text-cyan">{stats.regenRate.toFixed(1)}/hour</span>
                      </div>
                      {timeUntilNextSlot.totalMs > 0 && availableSlots < stats.maxSlots && (
                        <div className="nn-row">
                          <span className="nn-row__label">Next slot in</span>
                          <span className="nn-row__value nn-num">{timeUntilNextSlot.hours}h {timeUntilNextSlot.minutes}m</span>
                        </div>
                      )}
                      {upgradeCost && (
                        <div className="nn-brief nn-brief--cyan" style={{ margin: '8px 12px 4px' }}>
                          <div className="nn-lab" style={{ marginBottom: 4 }}>Upgrade to Level {upgradeCost.level}</div>
                          <div className={`nn-num ${canUpgrade ? 'nn-text-green' : 'nn-text-magenta'}`} style={{ fontSize: 12, fontWeight: 600 }}>
                            {upgradeCost.metal.toLocaleString()} M + {upgradeCost.energy.toLocaleString()} E
                          </div>
                          <div className="nn-lab" style={{ marginTop: 3 }}>Next: {stats.maxSlots + 2} slots · {(stats.regenRate + 0.1).toFixed(1)}/hour</div>
                        </div>
                      )}
                      {factory.level === 10 && (
                        <div className="nn-note nn-note--caution" style={{ margin: '8px 12px 4px', justifyContent: 'center' }}>
                          MAX LEVEL
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, padding: '8px 12px 4px' }}>
                        {upgradeCost && <button onClick={() => handleUpgrade(factory.x, factory.y)} disabled={!canUpgrade} className="nn-btn nn-btn--primary" style={{ flex: 1, '--nn-accent': 'var(--nn-green)', color: 'var(--nn-green)', borderColor: 'color-mix(in oklab, var(--nn-green) 55%, transparent)' } as React.CSSProperties}><TrendingUp />Upgrade</button>}
                        <button onClick={() => setAbandonConfirm({ x: factory.x, y: factory.y })} className="nn-btn" style={{ width: 'auto', flex: upgradeCost ? 'none' : 1, '--nn-accent': 'var(--nn-magenta)', color: 'var(--nn-magenta)', borderColor: 'color-mix(in oklab, var(--nn-magenta) 55%, transparent)' } as React.CSSProperties} aria-label={`Abandon factory at ${factory.x}, ${factory.y}`}><Trash2 /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '10px 20px', borderTop: '1px solid color-mix(in oklab, var(--nn-cyan) 12%, transparent)' }}>
            <div className="nn-lab" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Info style={{ width: 12, height: 12, flex: 'none', marginTop: 1 }} />
              <span>Upgrade factories to increase production capacity and regeneration rate. Abandoning a factory resets it to Level 1 and deletes all units.</span>
            </div>
          </div>
        </div>
      </div>

      {abandonConfirm && (
        <div className="nn-overlay" style={{ zIndex: 70, background: 'color-mix(in oklab, var(--nn-void) 90%, transparent)' }}>
          <div className="nn-panel nn-panel--x-pad w-full max-w-md" style={{ '--nn-accent': 'var(--nn-magenta)' } as React.CSSProperties}>
            <div className="nn-panel__header nn-panel__header--bleed nn-panel__header--magenta">
              <span className="nn-panel__icon"><AlertTriangle /></span>
              <h3 className="nn-panel__title">Abandon Factory?</h3>
            </div>
            <div className="nn-panel__body" style={{ paddingTop: 12 }}>
              <p style={{ fontSize: 12.5, color: 'var(--nn-text-secondary)', marginBottom: 8 }}>
                Are you sure you want to abandon the factory at ({abandonConfirm.x}, {abandonConfirm.y})?
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--nn-magenta)', marginBottom: 14 }}>
                This will reset the factory to Level 1, make it unclaimed, and <strong>DELETE ALL UNITS</strong>. This cannot be undone!
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setAbandonConfirm(null)} className="nn-btn nn-btn--ghost">Cancel</button>
                <button onClick={() => handleAbandon(abandonConfirm.x, abandonConfirm.y)} className="nn-btn" style={{ '--nn-accent': 'var(--nn-magenta)', color: 'var(--nn-magenta)', borderColor: 'color-mix(in oklab, var(--nn-magenta) 55%, transparent)' } as React.CSSProperties}>Abandon Factory</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
