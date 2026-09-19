/**
 * @file components/FactoryButton.tsx
 * @created 2025-10-17 (Enhanced with upgrade system)
 * @overview Factory attack and upgrade interface with R key handler
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameContext } from '@/context/GameContext';
import { TerrainType, AttackResult, Factory } from '@/types';
import { calculateUpgradeCost, getFactoryStats, formatFactoryLevel } from '@/lib/factoryUpgradeService';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

interface FactoryButtonProps {
  onAttackResult?: (result: AttackResult) => void;
}

export default function FactoryButton({ onAttackResult }: FactoryButtonProps) {
  const { player, currentTile, refreshGameState, isLoading } = useGameContext();
  const [factory, setFactory] = useState<Factory | null>(null);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Fetch factory data when on factory tile
  useEffect(() => {
    if (!currentTile || currentTile.terrain !== TerrainType.Factory) {
      setFactory(null);
      return;
    }

    const fetchFactory = async () => {
      try {
        const response = await fetch(`/api/factory/status?x=${currentTile.x}&y=${currentTile.y}`);
        const data = await response.json();
        if (data.success) {
          setFactory(data.factory);
        }
      } catch (error) {
        console.error('Error fetching factory:', error);
      }
    };

    fetchFactory();
  }, [currentTile]);

  const handleAttack = useCallback(async () => {
    if (!player || !currentTile || isAttacking) return;
    
    setIsAttacking(true);
    
    try {
      const response = await fetch('/api/factory/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: player.username,
          x: currentTile.x,
          y: currentTile.y
        })
      });
      
      const data = await response.json();
      
      // Send result to parent via callback
      if (onAttackResult) {
        onAttackResult(data);
      }
      
      // Refresh game state if successful
      if (data.captured) {
        setTimeout(() => {
          refreshGameState();
        }, 500);
      }
    } catch (error) {
      console.error('Factory attack error:', error);
      if (onAttackResult) {
        onAttackResult({
          success: false,
          message: 'Network error - please try again',
          playerPower: 0,
          factoryDefense: 0,
          captured: false
        });
      }
    } finally {
      setIsAttacking(false);
    }
  }, [player, currentTile, isAttacking, onAttackResult, refreshGameState]);

  /**
   * Keyboard shortcut: R = Attack/Control factory
   */
  useEffect(() => {
    if (!player || !currentTile) return;
    if (currentTile.terrain !== TerrainType.Factory) return;
    
    function handleKeyPress(event: KeyboardEvent) {
      if (isAttacking || isLoading) return;
      
      // Ignore if typing in input field
      if (isTypingInInput()) {
        return;
      }
      
      // Ignore if any modal is open
      if (document.querySelector('[role="dialog"]') || document.querySelector('.modal-open')) {
        return;
      }
      
      // R for factory attack
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        event.stopPropagation();
        handleAttack();
      }
    }
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAttacking, isLoading, player, currentTile, handleAttack]);

  const handleUpgrade = async () => {
    if (!player || !factory || isUpgrading) return;

    setIsUpgrading(true);
    setUpgradeMessage(null);

    try {
      const response = await fetch('/api/factory/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factoryX: factory.x,
          factoryY: factory.y
        })
      });

      const data = await response.json();

      if (data.success) {
        setUpgradeMessage(`✅ ${data.message}`);
        // Refresh factory data and game state
        setTimeout(() => {
          refreshGameState();
          setUpgradeMessage(null);
        }, 2000);
      } else {
        setUpgradeMessage(`❌ ${data.error}`);
        setTimeout(() => setUpgradeMessage(null), 3000);
      }
    } catch (error) {
      console.error('Factory upgrade error:', error);
      setUpgradeMessage('❌ Network error - please try again');
      setTimeout(() => setUpgradeMessage(null), 3000);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Only show on factory tiles
  if (!currentTile || currentTile.terrain !== TerrainType.Factory) {
    return null;
  }

  const isOwned = factory?.owner === player?.username;
  const currentLevel = factory?.level || 1;
  const stats = getFactoryStats(currentLevel);
  const canUpgrade = currentLevel < 10;
  const upgradeCost = canUpgrade ? calculateUpgradeCost(currentLevel) : null;
  const canAfford = upgradeCost 
    ? (player?.resources?.metal || 0) >= upgradeCost.metal && (player?.resources?.energy || 0) >= upgradeCost.energy
    : false;

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center gap-3">
      {/* Attack Button (for non-owned or enemy factories) */}
      {!isOwned && (
        <button
          onClick={handleAttack}
          disabled={isAttacking}
          className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] font-bold py-4 px-8 rounded-none shadow-lg transition-all hover:scale-105 disabled:cursor-not-allowed text-xl"
        >
          {isAttacking ? 'ATTACKING...' : 'ATTACK FACTORY (R)'}
        </button>
      )}

      {/* Upgrade Section (for owned factories) */}
      {isOwned && factory && (
        <div className="bg-[color:var(--nn-void)] border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4 shadow-lg min-w-[300px]">
          <div className="text-center mb-3">
            <h3 className="text-lg font-bold text-[color:var(--nn-text-primary)] mb-1">🏭 Your Factory</h3>
            <p className="text-sm text-[color:var(--nn-text-secondary)]">{formatFactoryLevel(currentLevel)}</p>
          </div>

          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none mb-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-[color:var(--nn-text-secondary)]">Max Slots:</span>
              <span className="text-[color:var(--nn-text-primary)] font-semibold">{stats.maxSlots}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-[color:var(--nn-text-secondary)]">Regen Rate:</span>
              <span className="text-[color:var(--nn-cyan)] font-semibold">{stats.regenRate.toFixed(1)}/hour</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[color:var(--nn-text-secondary)]">Available:</span>
              <span className="text-[color:var(--nn-green)] font-semibold">
                {factory.slots - factory.usedSlots}/{factory.slots}
              </span>
            </div>
          </div>

          {canUpgrade && upgradeCost && (
            <>
              <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none mb-2 text-sm border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                <div className="text-[color:var(--nn-text-secondary)] text-xs mb-1">Upgrade to Level {upgradeCost.level}:</div>
                <div className={`font-semibold ${canAfford ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                  {upgradeCost.metal.toLocaleString()} M + {upgradeCost.energy.toLocaleString()} E
                </div>
                <div className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                  → {stats.maxSlots + 2} slots, {(stats.regenRate + 0.1).toFixed(1)}/hour
                </div>
              </div>

              <button
                onClick={handleUpgrade}
                disabled={!canAfford || isUpgrading}
                className={`w-full py-3 px-4 rounded-none font-bold transition-all ${
                  canAfford && !isUpgrading
                    ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)] hover:scale-105'
                    : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] cursor-not-allowed'
                }`}
              >
                {isUpgrading ? '⏳ UPGRADING...' : canAfford ? '⬆️ UPGRADE FACTORY' : '💰 INSUFFICIENT RESOURCES'}
              </button>
            </>
          )}

          {currentLevel === 10 && (
            <div className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-3 text-center">
              <span className="text-[color:var(--nn-amber)] font-bold">⭐ MAX LEVEL REACHED ⭐</span>
            </div>
          )}

          {upgradeMessage && (
            <div className="mt-2 p-2 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-sm text-center">
              {upgradeMessage}
            </div>
          )}

          <p className="text-xs text-[color:var(--nn-text-secondary)] text-center mt-2">
            Press <kbd className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] px-1 rounded-none">M</kbd> for Factory Management
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Only shows on Factory terrain tiles
// - R key triggers attack action
// - Result passed to parent via callback
// - Refreshes game state on successful capture
// - Displays attack/cooldown feedback via parent
// ============================================================
// END OF FILE
// ============================================================
