/**
 * Passive Income Display Component
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Displays territory passive income statistics, daily projections, and manual
 * collection interface. Shows income per territory, total territories, and
 * estimated daily earnings from all clan territories.
 * 
 * Features:
 * - Real-time income projection calculation
 * - Territory count and average income display
 * - Manual income collection button
 * - Last collection timestamp
 * - Next automatic collection countdown
 * - Income breakdown (metal/energy)
 * - Territory tier distribution
 * 
 * Props:
 * - clanId: Clan identifier
 * - playerId: Current player ID
 * - role: Player's clan role (LEADER/CO_LEADER can collect)
 * - onIncomeCollected: Callback when income is collected
 * 
 * @module components/PassiveIncomeDisplay
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { extractApiError } from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/errorMessage';

interface IncomeProjection {
  totalTerritories: number;
  projectedDailyMetal: number;
  projectedDailyEnergy: number;
  averageIncomePerTerritory: {
    metal: number;
    energy: number;
  };
  territoryBreakdown: Array<{
    tier: number;
    count: number;
    metalPerTerritory: number;
    energyPerTerritory: number;
  }>;
  lastCollectionTime?: string;
  nextCollectionTime?: string;
}

interface PassiveIncomeDisplayProps {
  clanId: string;
  playerId: string;
  role: string;
  onIncomeCollected?: (metal: number, energy: number) => void;
}

export function PassiveIncomeDisplay({ clanId, role, onIncomeCollected }: PassiveIncomeDisplayProps) {
  const [projection, setProjection] = useState<IncomeProjection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');

  const canCollect = ['LEADER', 'CO_LEADER'].includes(role);

  const loadProjection = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/clan/territory/income?clanId=${clanId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(extractApiError(data, response.status));
      }
      
      setProjection(data.projection);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [clanId]);

  const collectIncome = async () => {
    try {
      setIsCollecting(true);
      setError(null);
      setSuccessMessage(null);
      
      const response = await fetch('/api/clan/territory/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(extractApiError(data, response.status));
      }
      
      const { metalCollected, energyCollected } = data.result;
      setSuccessMessage(`Collected ${metalCollected.toLocaleString()}M and ${energyCollected.toLocaleString()}E!`);
      
      // Callback to parent
      if (onIncomeCollected) {
        onIncomeCollected(metalCollected, energyCollected);
      }
      
      // Reload projection
      await loadProjection();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsCollecting(false);
    }
  };

  const updateCountdown = useCallback(() => {
    if (!projection?.nextCollectionTime) {
      setTimeUntilNext('');
      return;
    }
    
    const next = new Date(projection.nextCollectionTime).getTime();
    const now = Date.now();
    const diff = next - now;
    
    if (diff <= 0) {
      setTimeUntilNext('Available now!');
      return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    setTimeUntilNext(`${hours}h ${minutes}m ${seconds}s`);
  }, [projection]);

  useEffect(() => {
    loadProjection();
    
    // Server poll skipped while the tab is hidden (FID-20260909-023 §3.8);
    // the 1s countdown timer below is client-only and keeps running.
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadProjection();
      updateCountdown();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [clanId, loadProjection, updateCountdown]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [projection, updateCountdown]);

  if (!projection && !isLoading) {
    return (
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_40%,transparent)] rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] p-4">
        <p className="text-[color:var(--nn-text-secondary)]">No territory income data</p>
      </div>
    );
  }

  return (
    <div className="bg-[color-mix(in_oklab,var(--nn-void)_40%,transparent)] rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Territory Passive Income</h3>
        {canCollect && projection && (
          <button
            onClick={collectIncome}
            disabled={isCollecting}
            className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] rounded-none disabled:opacity-50 text-sm"
          >
            {isCollecting ? 'Collecting...' : 'Collect Income'}
          </button>
        )}
      </div>

      {/* Error/Success Display */}
      {error && (
        <div className="mb-3 p-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-3 p-2 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none text-sm">
          {successMessage}
        </div>
      )}

      {projection ? (
        <div className="space-y-4">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_20%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none p-3">
              <p className="text-sm text-[color:var(--nn-text-secondary)]">Total Territories</p>
              <p className="text-2xl font-bold">{projection.totalTerritories}</p>
            </div>
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_20%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none p-3">
              <p className="text-sm text-[color:var(--nn-text-secondary)]">Daily Income</p>
              <p className="text-lg font-bold text-[color:var(--nn-green)]">
                {projection.projectedDailyMetal.toLocaleString()}M
              </p>
              <p className="text-lg font-bold text-[color:var(--nn-cyan)]">
                {projection.projectedDailyEnergy.toLocaleString()}E
              </p>
            </div>
          </div>

          {/* Average Income */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_20%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none p-3">
            <p className="text-sm font-bold mb-2">Average Income Per Territory</p>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--nn-text-secondary)]">Metal:</span>
              <span className="font-bold text-[color:var(--nn-green)]">
                {projection.averageIncomePerTerritory.metal.toLocaleString()}M
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[color:var(--nn-text-secondary)]">Energy:</span>
              <span className="font-bold text-[color:var(--nn-cyan)]">
                {projection.averageIncomePerTerritory.energy.toLocaleString()}E
              </span>
            </div>
          </div>

          {/* Territory Breakdown */}
          {projection.territoryBreakdown && projection.territoryBreakdown.length > 0 && (
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_20%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none p-3">
              <p className="text-sm font-bold mb-2">Territory Distribution by Tier</p>
              <div className="space-y-2">
                {projection.territoryBreakdown.map((tier) => (
                  <div key={tier.tier} className="flex justify-between items-center text-sm">
                    <span className="text-[color:var(--nn-text-secondary)]">
                      Tier {tier.tier}: {tier.count} territories
                    </span>
                    <span className="font-bold">
                      {tier.metalPerTerritory.toLocaleString()}M / {tier.energyPerTerritory.toLocaleString()}E each
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collection Times */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_20%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none p-3">
            {projection.lastCollectionTime && (
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[color:var(--nn-text-secondary)]">Last Collection:</span>
                <span className="font-bold">
                  {new Date(projection.lastCollectionTime).toLocaleString()}
                </span>
              </div>
            )}
            {projection.nextCollectionTime && (
              <div className="flex justify-between text-sm">
                <span className="text-[color:var(--nn-text-secondary)]">Next Collection:</span>
                <span className="font-bold text-[color:var(--nn-amber)]">
                  {timeUntilNext || 'Calculating...'}
                </span>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-3">
            <p className="text-xs text-[color:var(--nn-cyan)]">
              💡 <strong>Passive Income:</strong> Territories generate income automatically every 24 hours at 00:00 UTC.
              Leaders and Co-Leaders can manually collect income at any time, but automatic collection ensures you never miss earnings!
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center text-[color:var(--nn-text-secondary)] py-8">
          Loading income data...
        </div>
      )}
    </div>
  );
}
