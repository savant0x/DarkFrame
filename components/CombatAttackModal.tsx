/**
 * CombatAttackModal.tsx
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Modal interface for launching PVP attacks (Infantry and Base raids). Allows players to
 * select attack type, target player, units to bring, and resource type to steal.
 * 
 * Features:
 * - Attack type selector (Infantry vs Base)
 * - Target player input with validation
 * - Unit selector with checkboxes (select from player's army)
 * - Army preview (total STR/DEF, unit count)
 * - Resource selection for base attacks (metal/energy)
 * - Real-time validation and error messaging
 * - Launch attack with loading state
 * - Integration with BattleResultModal
 * 
 * Attack Types:
 * - Infantry Battle: Player vs Player direct combat (no resource theft)
 * - Base Attack: Raid player's base (20% resource theft on victory)
 * 
 * Integration:
 * - Calls /api/combat/infantry or /api/combat/base
 * - Receives BattleResult and displays via BattleResultModal
 * - Updates player context on completion
 * 
 * Dependencies: useGameContext, UnitType, BattleResult, BattleResultModal
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { UnitType, UNIT_CONFIGS, BattleResult } from '@/types/game.types';
import BattleResultModal from './BattleResultModal';

interface CombatAttackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AttackType = 'infantry' | 'base';
type ResourceType = 'metal' | 'energy';

interface UnitSelection {
  unitType: UnitType;
  quantity: number;
  selected: boolean;
}

/**
 * Main combat attack modal component
 * Handles attack configuration and launch
 */
export default function CombatAttackModal({ isOpen, onClose, onSuccess }: CombatAttackModalProps) {
  const { player, refreshPlayer } = useGameContext();
  const [attackType, setAttackType] = useState<AttackType>('infantry');
  const [targetUsername, setTargetUsername] = useState('');
  const [resourceToSteal, setResourceToSteal] = useState<ResourceType>('metal');
  const [unitSelections, setUnitSelections] = useState<UnitSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);

  // Initialize unit selections from player's army
  useEffect(() => {
    if (isOpen && player?.units) {
      const selections: UnitSelection[] = player.units
        .filter(u => u.quantity > 0)
        .map(u => ({
          unitType: u.unitType,
          quantity: u.quantity,
          selected: false
        }));
      setUnitSelections(selections);
    }
  }, [isOpen, player?.units]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAttackType('infantry');
      setTargetUsername('');
      setResourceToSteal('metal');
      setError(null);
      setBattleResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnitToggle = (unitType: UnitType) => {
    setUnitSelections(selections =>
      selections.map(s =>
        s.unitType === unitType ? { ...s, selected: !s.selected } : s
      )
    );
  };

  const handleQuantityChange = (unitType: UnitType, value: string) => {
    const quantity = parseInt(value) || 0;
    setUnitSelections(selections =>
      selections.map(s =>
        s.unitType === unitType
          ? { ...s, quantity: Math.min(Math.max(0, quantity), s.quantity) }
          : s
      )
    );
  };

  // Calculate total army stats
  const selectedUnits = unitSelections.filter(s => s.selected && s.quantity > 0);
  const totalSTR = selectedUnits.reduce((sum, s) => {
    const config = UNIT_CONFIGS[s.unitType];
    return sum + (config.strength * s.quantity);
  }, 0);
  const totalDEF = selectedUnits.reduce((sum, s) => {
    const config = UNIT_CONFIGS[s.unitType];
    return sum + (config.defense * s.quantity);
  }, 0);
  const totalUnits = selectedUnits.reduce((sum, s) => sum + s.quantity, 0);

  const handleLaunchAttack = async () => {
    // Validation
    if (!targetUsername.trim()) {
      setError('Please enter a target username');
      return;
    }

    if (selectedUnits.length === 0) {
      setError('Please select at least one unit to attack with');
      return;
    }

    if (targetUsername.toLowerCase() === player?.username.toLowerCase()) {
      setError('You cannot attack yourself!');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Format units for API
      const unitsToSend = selectedUnits.map(s => ({
        unitType: s.unitType,
        quantity: s.quantity
      }));

      const endpoint = attackType === 'infantry' ? '/api/combat/infantry' : '/api/combat/base';
      const body: {
        targetUsername: string;
        units: { unitType: string; quantity: number }[];
        resourceToSteal?: ResourceType;
      } = {
        targetUsername,
        units: unitsToSend
      };

      if (attackType === 'base') {
        body.resourceToSteal = resourceToSteal;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to launch attack');
      }

      // Success! Show battle result
      setBattleResult(data.result);
      await refreshPlayer();
      onSuccess?.();

    } catch (err) {
      console.error('Attack error:', err);
      setError(err instanceof Error ? err.message : 'Failed to launch attack');
    } finally {
      setLoading(false);
    }
  };

  // If battle result exists, show result modal
  if (battleResult) {
    return (
      <BattleResultModal
        isOpen={true}
        result={battleResult}
        onClose={() => {
          setBattleResult(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] border-2 border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] p-4 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">⚔️ Launch Attack</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-primary)] text-[color:var(--nn-text-secondary)] text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* Attack Type Selector */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[color:var(--nn-text-primary)] mb-3">Attack Type</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setAttackType('infantry')}
                className={`p-4 rounded-none border-2 transition-all ${
                  attackType === 'infantry'
                    ? 'border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]'
                    : 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                }`}
              >
                <div className="text-3xl mb-2">⚔️</div>
                <div className="font-bold text-[color:var(--nn-text-primary)]">Infantry Battle</div>
                <div className="text-sm text-[color:var(--nn-text-secondary)] mt-1">
                  Direct player combat. No resource theft.
                </div>
              </button>

              <button
                onClick={() => setAttackType('base')}
                className={`p-4 rounded-none border-2 transition-all ${
                  attackType === 'base'
                    ? 'border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]'
                    : 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                }`}
              >
                <div className="text-3xl mb-2">🏠</div>
                <div className="font-bold text-[color:var(--nn-text-primary)]">Base Raid</div>
                <div className="text-sm text-[color:var(--nn-text-secondary)] mt-1">
                  Attack player{"'"}s base. Steal 20% resources on win.
                </div>
              </button>
            </div>
          </div>

          {/* Target Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[color:var(--nn-text-primary)] mb-3">Target Player</h3>
            <input
              type="text"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder="Enter username..."
              className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-3 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] focus:border-red-500 focus:outline-none"
            />
          </div>

          {/* Resource Selection (Base Attack Only) */}
          {attackType === 'base' && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-[color:var(--nn-text-primary)] mb-3">Resource to Steal</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setResourceToSteal('metal')}
                  className={`p-3 rounded-none border-2 transition-all ${
                    resourceToSteal === 'metal'
                      ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]'
                      : 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                  }`}
                >
                  <div className="text-2xl mb-1">⚙️</div>
                  <div className="font-bold text-[color:var(--nn-amber)]">Metal</div>
                </button>

                <button
                  onClick={() => setResourceToSteal('energy')}
                  className={`p-3 rounded-none border-2 transition-all ${
                    resourceToSteal === 'energy'
                      ? 'border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]'
                      : 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                  }`}
                >
                  <div className="text-2xl mb-1">⚡</div>
                  <div className="font-bold text-[color:var(--nn-cyan)]">Energy</div>
                </button>
              </div>
            </div>
          )}

          {/* Unit Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[color:var(--nn-text-primary)] mb-3">Select Units</h3>
            
            {unitSelections.length === 0 ? (
              <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-6 text-center">
                <p className="text-[color:var(--nn-text-secondary)]">You don{"'"}t have any units to attack with.</p>
                <p className="text-sm text-[color:var(--nn-text-secondary)] mt-2">Build units at your factories first!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unitSelections.map((selection) => {
                  const config = UNIT_CONFIGS[selection.unitType];
                  const maxQuantity = player?.units.find(u => u.unitType === selection.unitType)?.quantity || 0;

                  return (
                    <div
                      key={selection.unitType}
                      className={`border-2 rounded-none p-3 transition-all ${
                        selection.selected
                          ? 'border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]'
                          : 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selection.selected}
                          onChange={() => handleUnitToggle(selection.unitType)}
                          className="w-5 h-5 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-[color:var(--nn-text-primary)]">{config.name}</div>
                          <div className="text-xs text-[color:var(--nn-text-secondary)]">
                            STR: {config.strength} | DEF: {config.defense}
                          </div>
                        </div>
                        <div className="text-right">
                          <input
                            type="number"
                            value={selection.quantity}
                            onChange={(e) => handleQuantityChange(selection.unitType, e.target.value)}
                            disabled={!selection.selected}
                            min="0"
                            max={maxQuantity}
                            className="w-20 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-primary)] px-2 py-1 rounded-none text-sm border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] focus:border-red-500 focus:outline-none disabled:opacity-50"
                          />
                          <div className="text-xs text-[color:var(--nn-text-secondary)] mt-1">/ {maxQuantity}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Army Preview */}
          {selectedUnits.length > 0 && (
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4 mb-6">
              <h3 className="font-bold text-[color:var(--nn-text-primary)] mb-3">⚔️ Army Preview</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[color:var(--nn-text-secondary)] text-sm">Total Units</p>
                  <p className="text-2xl font-bold text-[color:var(--nn-text-primary)]">{totalUnits}</p>
                </div>
                <div>
                  <p className="text-[color:var(--nn-text-secondary)] text-sm">Total STR</p>
                  <p className="text-2xl font-bold text-[color:var(--nn-magenta)]">{totalSTR}</p>
                </div>
                <div>
                  <p className="text-[color:var(--nn-text-secondary)] text-sm">Total DEF</p>
                  <p className="text-2xl font-bold text-[color:var(--nn-cyan)]">{totalDEF}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-3 mb-6">
              <p className="text-[color:var(--nn-magenta)]">❌ {error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-bold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleLaunchAttack}
              disabled={loading || selectedUnits.length === 0}
              className="flex-1 px-6 py-3 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⚔️ Attacking...' : '⚔️ Launch Attack'}
            </button>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
            <p className="font-bold text-[color:var(--nn-magenta)] mb-2">⚠️ Combat Info:</p>
            <ul className="list-disc list-inside space-y-1 text-[color:var(--nn-text-secondary)] text-sm">
              <li><strong>Infantry Battle:</strong> Direct combat. Winner gains XP (+150 attacker, +75 defender).</li>
              <li><strong>Base Raid:</strong> Attack player{"'"}s base. Winner steals 20% of selected resource (+200 XP).</li>
              <li><strong>Units:</strong> Both sides may lose units. Winners capture 10-15% of defeated units.</li>
              <li><strong>Stats:</strong> STR units deal damage, DEF units absorb damage. Balance is key!</li>
              <li><strong>HP System:</strong> STR units have 10 HP, DEF units have 15 HP. Combat continues until one side reaches 0 HP.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. ATTACK TYPE SELECTION:
 *    - Infantry: Player vs Player, no resource theft
 *    - Base: Base raid with 20% resource theft on victory
 *    - Visual selector with descriptions
 * 
 * 2. UNIT SELECTION:
 *    - Checkbox system for each unit type
 *    - Quantity input (0 to max owned)
 *    - Real-time validation against player's army
 *    - Disabled inputs for unselected units
 * 
 * 3. ARMY PREVIEW:
 *    - Total units selected
 *    - Combined STR and DEF stats
 *    - Visual feedback before launch
 * 
 * 4. VALIDATION:
 *    - Target username required
 *    - At least one unit selected
 *    - Cannot attack self
 *    - Quantity limits enforced
 * 
 * 5. BATTLE FLOW:
 *    - API call to /api/combat/infantry or /api/combat/base
 *    - Receive BattleResult
 *    - Display BattleResultModal
 *    - Refresh player data
 *    - Close modal on completion
 * 
 * 6. USER EXPERIENCE:
 *    - Clear attack type descriptions
 *    - Resource selector for base attacks
 *    - Loading state during attack
 *    - Error messaging
 *    - Info box with combat mechanics
 * 
 * FUTURE ENHANCEMENTS:
 * - Target player search/autocomplete
 * - Player power preview (show target's STR/DEF)
 * - Army presets (save common configurations)
 * - Battle predictions (estimated outcome)
 * - Recent targets list (quick re-attack)
 */
