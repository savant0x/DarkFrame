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

import React, { useState, useEffect } from 'react';

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

export function PassiveIncomeDisplay({ clanId, playerId, role, onIncomeCollected }: PassiveIncomeDisplayProps) {
  const [projection, setProjection] = useState<IncomeProjection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');

  const canCollect = ['LEADER', 'CO_LEADER'].includes(role);

  useEffect(() => {
    loadProjection();
    
    const interval = setInterval(() => {
      loadProjection();
      updateCountdown();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [clanId]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [projection]);

  const loadProjection = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/clan/territory/income?clanId=${clanId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load income projection');
      }
      
      setProjection(data.projection);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

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
        throw new Error(data.error || 'Failed to collect income');
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCollecting(false);
    }
  };

  const updateCountdown = () => {
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
  };

  if (!projection && !isLoading) {
    return (
      <div className="bg-black/40 rounded border border-gray-700 p-4">
        <p className="text-gray-500">No territory income data</p>
      </div>
    );
  }

  return (
    <div className="bg-black/40 rounded border border-gray-700 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Territory Passive Income</h3>
        {canCollect && projection && (
          <button
            onClick={collectIncome}
            disabled={isCollecting}
            className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50 text-sm"
          >
            {isCollecting ? 'Collecting...' : 'Collect Income'}
          </button>
        )}
      </div>

      {/* Error/Success Display */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/20 border border-red-500 rounded text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-3 p-2 bg-green-900/20 border border-green-500 rounded text-sm">
          {successMessage}
        </div>
      )}

      {projection ? (
        <div className="space-y-4">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/20 border border-gray-600 rounded p-3">
              <p className="text-sm text-gray-400">Total Territories</p>
              <p className="text-2xl font-bold">{projection.totalTerritories}</p>
            </div>
            <div className="bg-black/20 border border-gray-600 rounded p-3">
              <p className="text-sm text-gray-400">Daily Income</p>
              <p className="text-lg font-bold text-green-400">
                {projection.projectedDailyMetal.toLocaleString()}M
              </p>
              <p className="text-lg font-bold text-blue-400">
                {projection.projectedDailyEnergy.toLocaleString()}E
              </p>
            </div>
          </div>

          {/* Average Income */}
          <div className="bg-black/20 border border-gray-600 rounded p-3">
            <p className="text-sm font-bold mb-2">Average Income Per Territory</p>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Metal:</span>
              <span className="font-bold text-green-400">
                {projection.averageIncomePerTerritory.metal.toLocaleString()}M
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Energy:</span>
              <span className="font-bold text-blue-400">
                {projection.averageIncomePerTerritory.energy.toLocaleString()}E
              </span>
            </div>
          </div>

          {/* Territory Breakdown */}
          {projection.territoryBreakdown && projection.territoryBreakdown.length > 0 && (
            <div className="bg-black/20 border border-gray-600 rounded p-3">
              <p className="text-sm font-bold mb-2">Territory Distribution by Tier</p>
              <div className="space-y-2">
                {projection.territoryBreakdown.map((tier) => (
                  <div key={tier.tier} className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">
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
          <div className="bg-black/20 border border-gray-600 rounded p-3">
            {projection.lastCollectionTime && (
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Last Collection:</span>
                <span className="font-bold">
                  {new Date(projection.lastCollectionTime).toLocaleString()}
                </span>
              </div>
            )}
            {projection.nextCollectionTime && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Next Collection:</span>
                <span className="font-bold text-yellow-400">
                  {timeUntilNext || 'Calculating...'}
                </span>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
            <p className="text-xs text-blue-300">
              💡 <strong>Passive Income:</strong> Territories generate income automatically every 24 hours at 00:00 UTC.
              Leaders and Co-Leaders can manually collect income at any time, but automatic collection ensures you never miss earnings!
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          Loading income data...
        </div>
      )}
    </div>
  );
}
