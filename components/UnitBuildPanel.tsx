/**
 * @file components/UnitBuildPanel.tsx
 * @created 2025-10-17
 * @deprecated Use UnitBuildPanelEnhanced.tsx instead (supports 40 units across 5 tiers)
 * @overview Unit building interface for factories (OLD VERSION - 4 units only)
 * 
 * OVERVIEW:
 * **DEPRECATED** - This component only supports 4 legacy units (Rifleman, Scout, Bunker, Barrier).
 * The new system has 40 units across 5 tiers. Use UnitBuildPanelEnhanced.tsx for full functionality.
 * 
 * Modal panel that displays when player is at a factory they own. Shows 4 unit types
 * with costs, stats, and build buttons. Tracks slot availability and displays real-time
 * regeneration countdown.
 * 
 * UNIT TYPES (LEGACY):
 * - Rifleman: 200M/100E, STR 5 (Offensive) → Now T1_Rifleman
 * - Scout: 150M/150E, STR 3 (Offensive) → Now T1_Scout
 * - Bunker: 200M/100E, DEF 5 (Defensive) → Now T1_Bunker
 * - Barrier: 150M/150E, DEF 3 (Defensive) → Now T1_Barrier
 */

'use client';

import { useState } from 'react';
import { Resources, UnitType, UNIT_CONFIGS } from '@/types';

interface UnitBuildPanelProps {
  isOpen: boolean;
  onClose: () => void;
  factoryX: number;
  factoryY: number;
  playerResources: Resources;
  availableSlots: number;
  maxSlots: number;
  usedSlots: number;
  onBuildComplete: () => void;
}

export default function UnitBuildPanel({
  isOpen,
  onClose,
  factoryX,
  factoryY,
  playerResources,
  availableSlots,
  maxSlots,
  usedSlots,
  onBuildComplete
}: UnitBuildPanelProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [quantities, setQuantities] = useState<Record<UnitType, string>>({
    [UnitType.T1_Rifleman]: '1',
    [UnitType.T1_Scout]: '1',
    [UnitType.T1_Bunker]: '1',
    [UnitType.T1_Barrier]: '1'
  } as Record<UnitType, string>);

  if (!isOpen) return null;

  const handleBuild = async (unitType: UnitType) => {
    const quantity = parseInt(quantities[unitType]) || 1;
    
    if (quantity < 1 || quantity > 100) {
      setMessage('❌ Quantity must be between 1 and 100');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/factory/build-unit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factoryX,
          factoryY,
          unitType,
          quantity
        })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ ${data.message}`);
        onBuildComplete();
      } else {
        setMessage(`❌ ${data.message || 'Build failed'}`);
      }
    } catch {
      setMessage('❌ Network error');
    } finally {
      setLoading(false);
    }
  };

  const canAfford = (unitType: UnitType, quantity: number) => {
    const config = UNIT_CONFIGS[unitType];
    const totalMetal = config.metalCost * quantity;
    const totalEnergy = config.energyCost * quantity;
    return playerResources.metal >= totalMetal && playerResources.energy >= totalEnergy;
  };

  const hasSlots = (unitType: UnitType, quantity: number) => {
    const config = UNIT_CONFIGS[unitType];
    return availableSlots >= (config.slotCost * quantity);
  };

  const getUnitIcon = (unitType: UnitType): string => {
    switch (unitType) {
      case UnitType.T1_Rifleman: return '🎯';
      case UnitType.T1_Scout: return '👁️';
      case UnitType.T1_Bunker: return '🏰';
      case UnitType.T1_Barrier: return '🛡️';
      default: return '❓';
    }
  };

  const getUnitColor = (unitType: UnitType): string => {
    const config = UNIT_CONFIGS[unitType];
    return config.strength > 0 ? 'border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]' : 'border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]';
  };

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_50%,transparent)] flex items-center justify-center z-50">
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-2 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-6 w-[800px] max-h-[700px] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-[color:var(--nn-amber)]">
            🏭 Unit Production - Factory ({factoryX}, {factoryY})
          </h2>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl"
          >
            ×
          </button>
        </div>

        {/* Factory Status */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] p-4 rounded-none mb-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[color:var(--nn-text-secondary)] text-sm">Available Slots</p>
              <p className="text-[color:var(--nn-text-primary)] text-xl font-bold">{availableSlots} / {maxSlots}</p>
            </div>
            <div>
              <p className="text-[color:var(--nn-text-secondary)] text-sm">Your Resources</p>
              <p className="text-[color:var(--nn-amber)]">⚙️ {playerResources.metal.toLocaleString()}</p>
              <p className="text-[color:var(--nn-cyan)]">⚡ {playerResources.energy.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[color:var(--nn-text-secondary)] text-sm">Slots Used</p>
              <div className="w-full h-4 bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]"
                  style={{ width: `${(usedSlots / maxSlots) * 100}%` }}
                />
              </div>
              <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">{usedSlots} / {maxSlots}</p>
            </div>
          </div>
        </div>

        {/* Unit Cards Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[UnitType.T1_Rifleman, UnitType.T1_Scout, UnitType.T1_Bunker, UnitType.T1_Barrier].map(unitType => {
            const config = UNIT_CONFIGS[unitType];
            const quantity = parseInt(quantities[unitType]) || 1;
            const totalMetal = config.metalCost * quantity;
            const totalEnergy = config.energyCost * quantity;
            const totalSlots = config.slotCost * quantity;
            const affordable = canAfford(unitType, quantity);
            const enoughSlots = hasSlots(unitType, quantity);
            const canBuild = affordable && enoughSlots && !loading;

            return (
              <div
                key={unitType}
                className={`border-2 ${getUnitColor(unitType)} rounded-none p-4 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)]`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{getUnitIcon(unitType)}</span>
                    <div>
                      <h3 className="text-[color:var(--nn-text-primary)] font-bold">{config.name}</h3>
                      <p className="text-sm text-[color:var(--nn-text-secondary)]">
                        {config.strength > 0 ? `STR: ${config.strength}` : `DEF: ${config.defense}`}
                      </p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-none text-xs font-bold ${
                    config.strength > 0 ? 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-magenta)]' : 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-cyan)]'
                  }`}>
                    {config.strength > 0 ? 'OFFENSE' : 'DEFENSE'}
                  </div>
                </div>

                {/* Costs */}
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[color:var(--nn-text-secondary)]">Metal Cost:</span>
                    <span className={`font-bold ${playerResources.metal >= totalMetal ? 'text-[color:var(--nn-amber)]' : 'text-[color:var(--nn-magenta)]'}`}>
                      {config.metalCost} × {quantity} = {totalMetal}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[color:var(--nn-text-secondary)]">Energy Cost:</span>
                    <span className={`font-bold ${playerResources.energy >= totalEnergy ? 'text-[color:var(--nn-cyan)]' : 'text-[color:var(--nn-magenta)]'}`}>
                      {config.energyCost} × {quantity} = {totalEnergy}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[color:var(--nn-text-secondary)]">Slots Required:</span>
                    <span className={`font-bold ${availableSlots >= totalSlots ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                      {config.slotCost} × {quantity} = {totalSlots}
                    </span>
                  </div>
                </div>

                {/* Quantity Input */}
                <div className="mb-3">
                  <label className="block text-[color:var(--nn-text-secondary)] text-sm mb-1">Quantity:</label>
                  <input
                    type="number"
                    value={quantities[unitType]}
                    onChange={(e) => setQuantities({ ...quantities, [unitType]: e.target.value })}
                    className="w-full bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] px-3 py-2 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] focus:border-orange-500 focus:outline-none"
                    min="1"
                    max="100"
                  />
                </div>

                {/* Build Button */}
                <button
                  onClick={() => handleBuild(unitType)}
                  disabled={!canBuild}
                  className={`w-full py-2 px-4 rounded-none font-bold ${
                    canBuild
                      ? 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-secondary)] cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Building...' : `Build ${config.name}`}
                </button>

                {/* Status Messages */}
                {!affordable && (
                  <p className="text-[color:var(--nn-magenta)] text-xs mt-2">❌ Insufficient resources</p>
                )}
                {!enoughSlots && (
                  <p className="text-[color:var(--nn-magenta)] text-xs mt-2">❌ Not enough slots</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Message */}
        {message && (
          <div className={`p-3 rounded-none mb-4 ${
            message.includes('✅')
              ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-green)]'
              : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-magenta)]'
          }`}>
            {message}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] p-3 rounded-none text-[color:var(--nn-text-secondary)] text-sm">
          <p className="font-bold text-[color:var(--nn-amber)] mb-2">💡 Unit Building Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Factory capacity increases with level (Level 1: 5,000 slots)</li>
            <li>Slots regenerate over time based on factory level</li>
            <li>Offensive units (Rifleman, Scout) increase your STR</li>
            <li>Defensive units (Bunker, Barrier) increase your DEF</li>
            <li>Build quantities between 1-100 units at once</li>
            <li>Balance STR and DEF for maximum power efficiency</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
