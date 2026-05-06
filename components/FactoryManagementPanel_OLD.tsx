/**
 * Factory Management Panel Component
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Full-screen modal for managing all player-owned factories. Displays factory
 * grid with upgrade, abandon, and navigation controls. Accessed via M key.
 * Shows factory levels, stats, upgrade costs, and investment tracking.
 * 
 * KEY FEATURES:
 * - Grid display of all owned factories (max 10)
 * - Factory cards showing level, location, slots, regen rate
 * - Upgrade buttons with cost display and affordability check
 * - Abandon buttons with confirmation dialog
 * - "Jump To" navigation to factory coordinates
 * - Total investment tracker (cumulative costs)
 * - Factory count display (X/10 Factories Owned)
 * - Sort options: by level, by location
 * 
 * PROPS:
 * - isOpen: boolean - Panel visibility
 * - onClose: () => void - Close handler
 * - username: string - Current player username
 * - onNavigate: (x: number, y: number) => void - Navigate to factory
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Factory } from '@/types/game.types';
import { formatFactoryLevel, formatUpgradeCost } from '@/lib/factoryUpgradeService';

interface FactoryData {
  factory: Factory;
  stats: {
    level: number;
    maxSlots: number;
    regenRate: number;
  };
  upgradeCost: {
    metal: number;
    energy: number;
    level: number;
  } | null;
  canUpgrade: boolean;
  upgradeProgress: number;
  availableSlots: number;
  timeUntilNextSlot: {
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
  };
}

interface FactoryListResponse {
  success: boolean;
  factories: FactoryData[];
  count: number;
  maxFactories: number;
  canClaimMore: boolean;
  totalInvestment: {
    metal: number;
    energy: number;
    total: number;
  };
  playerResources: {
    metal: number;
    energy: number;
  };
}

interface FactoryManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  onNavigate: (x: number, y: number) => void;
}

export default function FactoryManagementPanel({
  isOpen,
  onClose,
  username,
  onNavigate
}: FactoryManagementPanelProps) {
  const [factories, setFactories] = useState<FactoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factoryCount, setFactoryCount] = useState(0);
  const [maxFactories, setMaxFactories] = useState(10);
  const [totalInvestment, setTotalInvestment] = useState({ metal: 0, energy: 0, total: 0 });
  const [playerResources, setPlayerResources] = useState({ metal: 0, energy: 0 });
  const [abandonConfirm, setAbandonConfirm] = useState<{ x: number; y: number } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Fetch factory list
  const fetchFactories = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/factory/list?username=${username}`);
      const data: FactoryListResponse = await response.json();

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
      console.error('Error fetching factories:', err);
      setError('Failed to load factories');
    } finally {
      setLoading(false);
    }
  };

  // Load factories when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchFactories();
      setActionMessage(null);
    }
  }, [isOpen, username]);

  // Handle upgrade
  const handleUpgrade = async (factoryX: number, factoryY: number) => {
    try {
      const response = await fetch('/api/factory/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factoryX, factoryY })
      });

      const data = await response.json();

      if (data.success) {
        setActionMessage(`✅ ${data.message}`);
        fetchFactories(); // Refresh list
      } else {
        setActionMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error('Error upgrading factory:', err);
      setActionMessage('❌ Failed to upgrade factory');
    }
  };

  // Handle abandon
  const handleAbandon = async (factoryX: number, factoryY: number) => {
    try {
      const response = await fetch('/api/factory/abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factoryX, factoryY })
      });

      const data = await response.json();

      if (data.success) {
        setActionMessage(`✅ ${data.message}`);
        setAbandonConfirm(null);
        fetchFactories(); // Refresh list
      } else {
        setActionMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error('Error abandoning factory:', err);
      setActionMessage('❌ Failed to abandon factory');
    }
  };

  // Handle jump to factory
  const handleJumpTo = (x: number, y: number) => {
    onNavigate(x, y);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-gray-700 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-800 p-4 border-b border-gray-700 sticky top-0 z-10">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-2xl font-bold text-white">🏭 Factory Management</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl px-3"
            >
              ×
            </button>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <div className="text-gray-300">
              <span className="font-semibold">{factoryCount}/{maxFactories}</span> Factories Owned
              {factoryCount < maxFactories && (
                <span className="text-green-400 ml-2">({maxFactories - factoryCount} slots available)</span>
              )}
            </div>
            
            <div className="text-gray-300">
              <span className="text-yellow-400">💰 Total Investment:</span>{' '}
              <span className="font-semibold">{totalInvestment.metal.toLocaleString()} M</span>{' + '}
              <span className="font-semibold">{totalInvestment.energy.toLocaleString()} E</span>
            </div>
          </div>

          {/* Player Resources */}
          <div className="mt-2 text-sm text-gray-400">
            <span className="text-blue-400">📦 Current Resources:</span>{' '}
            <span>{playerResources.metal.toLocaleString()} M</span>{' + '}
            <span>{playerResources.energy.toLocaleString()} E</span>
          </div>

          {/* Action Message */}
          {actionMessage && (
            <div className="mt-2 p-2 bg-gray-800 border border-gray-600 rounded text-sm">
              {actionMessage}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="text-center text-gray-400 py-8">Loading factories...</div>
          )}

          {error && (
            <div className="text-center text-red-400 py-8">{error}</div>
          )}

          {!loading && !error && factoryCount === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p className="mb-2">You don't own any factories yet.</p>
              <p className="text-sm">Capture factories by moving to factory tiles and attacking them.</p>
            </div>
          )}

          {!loading && !error && factories.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {factories.map(({ factory, stats, upgradeCost, canUpgrade, upgradeProgress, availableSlots, timeUntilNextSlot }) => (
                <div
                  key={`${factory.x},${factory.y}`}
                  className="bg-gray-800 border-2 border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  {/* Factory Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Factory ({factory.x}, {factory.y})
                      </h3>
                      <p className="text-sm text-gray-400">
                        {formatFactoryLevel(factory.level || 1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Progress</div>
                      <div className="text-sm font-semibold text-yellow-400">
                        {upgradeProgress}%
                      </div>
                    </div>
                  </div>

                  {/* Factory Stats */}
                  <div className="mb-3 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">Max Slots:</span>
                      <span className="text-white font-semibold">{stats.maxSlots}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">Available:</span>
                      <span className="text-green-400 font-semibold">{availableSlots}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">Regen Rate:</span>
                      <span className="text-blue-400 font-semibold">
                        {stats.regenRate.toFixed(1)}/hour
                      </span>
                    </div>
                    {timeUntilNextSlot.totalMs > 0 && availableSlots < stats.maxSlots && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Next Slot:</span>
                        <span className="text-gray-500">
                          {timeUntilNextSlot.hours}h {timeUntilNextSlot.minutes}m
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Upgrade Section */}
                  {upgradeCost && (
                    <div className="mb-3 p-2 bg-gray-900 border border-gray-700 rounded">
                      <div className="text-xs text-gray-400 mb-1">Upgrade to Level {upgradeCost.level}:</div>
                      <div className={`text-sm font-semibold ${canUpgrade ? 'text-green-400' : 'text-red-400'}`}>
                        {upgradeCost.metal.toLocaleString()} M + {upgradeCost.energy.toLocaleString()} E
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Next: {stats.maxSlots + 2} slots, {(stats.regenRate + 0.1).toFixed(1)}/hour
                      </div>
                    </div>
                  )}

                  {factory.level === 10 && (
                    <div className="mb-3 p-2 bg-yellow-900 border border-yellow-700 rounded text-center">
                      <span className="text-yellow-400 font-semibold text-sm">⭐ MAX LEVEL ⭐</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleJumpTo(factory.x, factory.y)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded transition-colors"
                    >
                      📍 Jump To
                    </button>
                    
                    {upgradeCost && (
                      <button
                        onClick={() => handleUpgrade(factory.x, factory.y)}
                        disabled={!canUpgrade}
                        className={`flex-1 text-sm py-2 px-3 rounded transition-colors ${
                          canUpgrade
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        ⬆️ Upgrade
                      </button>
                    )}
                    
                    <button
                      onClick={() => setAbandonConfirm({ x: factory.x, y: factory.y })}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded transition-colors"
                      title="Abandon this factory"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Footer */}
        <div className="bg-gray-800 p-3 border-t border-gray-700 text-xs text-gray-400">
          <p>💡 <strong>Tips:</strong> Upgrade factories to increase production capacity and regeneration rate. 
          Abandoning a factory resets it to Level 1 and deletes all units produced there.</p>
        </div>
      </div>

      {/* Abandon Confirmation Modal */}
      {abandonConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60]">
          <div className="bg-gray-900 border-2 border-red-600 rounded-lg p-6 max-w-md">
            <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Abandon Factory?</h3>
            <p className="text-gray-300 mb-2">
              Are you sure you want to abandon the factory at ({abandonConfirm.x}, {abandonConfirm.y})?
            </p>
            <p className="text-red-400 text-sm mb-4">
              This will reset the factory to Level 1, make it unclaimed, and <strong>DELETE ALL UNITS</strong> produced there.
              This action cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setAbandonConfirm(null)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAbandon(abandonConfirm.x, abandonConfirm.y)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors"
              >
                Abandon Factory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Data Fetching:
 *    - Loads factory list on panel open
 *    - Refreshes after upgrade/abandon actions
 *    - Shows loading states and error messages
 * 
 * 2. Factory Cards:
 *    - Grid layout (responsive: 1/2/3 columns)
 *    - Shows level, stats, upgrade cost, progress
 *    - Color-coded affordability (green/red)
 *    - Max level factories show gold badge
 * 
 * 3. Actions:
 *    - Jump To: Navigates to factory and closes panel
 *    - Upgrade: Disabled if can't afford, shows cost
 *    - Abandon: Requires confirmation modal
 * 
 * 4. Investment Tracking:
 *    - Header shows total resources spent
 *    - Helps players understand empire value
 *    - Separate from current resources
 * 
 * 5. Future Enhancements:
 *    - Add sort/filter options (level, location, slots)
 *    - Add search by coordinates
 *    - Add "Upgrade All Affordable" bulk action
 *    - Add factory comparison mode
 */
