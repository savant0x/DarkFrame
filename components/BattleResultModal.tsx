/**
 * BattleResultModal.tsx
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Modal displaying battle results after combat. Shows victory/defeat status,
 * detailed statistics, units lost/captured, resources stolen, XP earned,
 * and level-up notifications.
 * 
 * Features:
 * - Victory/Defeat banner with animations
 * - Battle statistics (rounds, damage dealt/received)
 * - Units lost and captured breakdown
 * - Resources stolen display (base attacks only)
 * - XP earned by both participants
 * - Level-up notification if triggered
 * - Link to detailed battle log
 * - Close button to return to game
 * 
 * Integration:
 * - Receives BattleResult from combat APIs
 * - Displays round-by-round summary
 * - Shows XP and level changes
 * - Links to full battle log viewer
 * 
 * Dependencies: BattleResult, BattleOutcome, useGameContext
 */

'use client';

import React from 'react';
import { BattleResult, BattleOutcome, BattleType } from '@/types/game.types';

interface BattleResultModalProps {
  isOpen: boolean;
  result: BattleResult;
  onClose: () => void;
}

/**
 * Battle result display modal
 * Shows comprehensive combat outcome information
 */
export default function BattleResultModal({ isOpen, result, onClose }: BattleResultModalProps) {
  if (!isOpen) return null;

  const isVictory = result.outcome === BattleOutcome.AttackerWin;
  const isDraw = result.outcome === BattleOutcome.Draw;

  // Units lost/captured are already numbers (counts), not arrays
  const totalUnitsLost = result.attacker.unitsLost;
  const totalUnitsCaptured = result.attacker.unitsCaptured;
  const defenderUnitsLost = result.defender.unitsLost;
  const defenderUnitsCaptured = result.defender.unitsCaptured;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header - Victory/Defeat Banner */}
        <div className={`p-6 text-center ${
          isVictory 
            ? 'bg-gradient-to-r from-green-600 to-green-700'
            : isDraw
            ? 'bg-gradient-to-r from-yellow-600 to-yellow-700'
            : 'bg-gradient-to-r from-red-600 to-red-700'
        }`}>
          <div className="text-6xl mb-2 animate-bounce">
            {isVictory ? '🎉' : isDraw ? '⚔️' : '💀'}
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">
            {isVictory ? 'VICTORY!' : isDraw ? 'DRAW!' : 'DEFEAT!'}
          </h2>
          <p className="text-white text-lg">
            {result.message}
          </p>
        </div>

        <div className="p-6">
          {/* Battle Statistics */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">📊 Battle Statistics</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Combat Rounds</p>
                <p className="text-2xl font-bold text-white">{result.rounds}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Battle Type</p>
                <p className="text-2xl font-bold text-white">
                  {result.battleType === BattleType.Infantry ? '⚔️ Infantry' : '🏠 Base'}
                </p>
              </div>
            </div>

            {/* Participants */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-3">
                <p className="font-bold text-red-400 mb-2">⚔️ Attacker</p>
                <p className="text-white font-bold text-lg">{result.attacker.username}</p>
                <div className="text-sm text-gray-300 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Starting HP:</span>
                    <span className="font-bold">{result.attacker.startingHP}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ending HP:</span>
                    <span className={`font-bold ${result.attacker.endingHP > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {result.attacker.endingHP}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Damage Dealt:</span>
                    <span className="font-bold text-red-400">{result.attacker.damageDealt}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-3">
                <p className="font-bold text-blue-400 mb-2">🛡️ Defender</p>
                <p className="text-white font-bold text-lg">{result.defender.username}</p>
                <div className="text-sm text-gray-300 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Starting HP:</span>
                    <span className="font-bold">{result.defender.startingHP}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ending HP:</span>
                    <span className={`font-bold ${result.defender.endingHP > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {result.defender.endingHP}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Damage Dealt:</span>
                    <span className="font-bold text-blue-400">{result.defender.damageDealt}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Units Lost & Captured */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Attacker's Losses */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-bold text-red-400 mb-3">💀 Your Losses</h4>
              {totalUnitsLost === 0 ? (
                <p className="text-green-400 text-sm">No units lost! 🎉</p>
              ) : (
                <div className="text-center">
                  <div className="text-4xl font-bold text-red-400 mb-2">{totalUnitsLost}</div>
                  <p className="text-gray-400 text-sm">Total Units Lost</p>
                </div>
              )}
            </div>

            {/* Units Captured */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="font-bold text-green-400 mb-3">🎖️ Units Captured</h4>
              {totalUnitsCaptured === 0 ? (
                <p className="text-gray-400 text-sm">No units captured</p>
              ) : (
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-400 mb-2">{totalUnitsCaptured}</div>
                  <p className="text-gray-400 text-sm">Total Units Captured</p>
                </div>
              )}
            </div>
          </div>

          {/* Defender's Losses (for reference) */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h4 className="font-bold text-blue-400 mb-3">🛡️ Defender's Casualties</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-2">Units Lost</p>
                {defenderUnitsLost === 0 ? (
                  <p className="text-green-400 text-sm">None</p>
                ) : (
                  <div className="text-2xl font-bold text-red-400">{defenderUnitsLost}</div>
                )}
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-2">Units Captured</p>
                {defenderUnitsCaptured === 0 ? (
                  <p className="text-gray-400 text-sm">None</p>
                ) : (
                  <div className="text-2xl font-bold text-green-400">{defenderUnitsCaptured}</div>
                )}
              </div>
            </div>
          </div>

          {/* Resources Stolen (Base Attacks Only) */}
          {result.resourcesStolen && result.resourcesStolen.amount > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4 mb-6">
              <h4 className="font-bold text-yellow-400 mb-2">💰 Resources Plundered</h4>
              <p className="text-white text-lg">
                {isVictory ? 'You stole' : 'You lost'}{' '}
                <span className="font-bold text-yellow-400">
                  {result.resourcesStolen.amount.toLocaleString()}
                </span>{' '}
                <span className="text-yellow-300">{result.resourcesStolen.resourceType.toUpperCase()}</span>
                {' '}
                {result.battleType === BattleType.Base ? '(20% of defender\'s reserves)' : ''}
              </p>
            </div>
          )}

          {/* XP Earned */}
          <div className="bg-purple-900/30 border border-purple-500 rounded-lg p-4 mb-6">
            <h4 className="font-bold text-purple-400 mb-3">✨ Experience Gained</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Your XP</p>
                <p className="text-2xl font-bold text-purple-400">+{result.attacker.xpEarned}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Defender XP</p>
                <p className="text-2xl font-bold text-purple-400">+{result.defender.xpEarned}</p>
              </div>
            </div>
          </div>

          {/* Level Up Notification */}
          {(result.attackerLevelUp || result.defenderLevelUp) && (
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg p-4 mb-6 text-center">
              <div className="text-4xl mb-2">🎉</div>
              <h4 className="font-bold text-white text-xl mb-2">LEVEL UP!</h4>
              {result.attackerLevelUp && (
                <p className="text-white">
                  You reached <span className="font-bold">Level {result.attackerNewLevel}!</span>
                  <span className="block text-sm mt-1">
                    Earned {result.attacker.xpEarned} XP! ✨
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                // Navigate to battle log viewer (implement later)
                onClose();
              }}
              className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors"
            >
              📜 View Detailed Log
            </button>
          </div>

          {/* Info Footer */}
          <div className="mt-6 bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-400 text-center">
              {isVictory 
                ? '🎉 Great job! Your strategy paid off. Keep building your army for future battles!'
                : isDraw
                ? '⚔️ A close battle! Both sides fought well. Train more units and try again!'
                : '💪 Don\'t give up! Analyze the battle, upgrade your army, and come back stronger!'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. VICTORY/DEFEAT DISPLAY:
 *    - Color-coded banner (green=victory, red=defeat, yellow=draw)
 *    - Animated emoji icon
 *    - Battle message from API
 * 
 * 2. BATTLE STATISTICS:
 *    - Combat rounds
 *    - Battle type (Infantry/Base)
 *    - Starting/Ending HP for both sides
 *    - Damage dealt by each participant
 * 
 * 3. UNIT CASUALTIES:
 *    - Attacker's units lost (player's losses)
 *    - Units captured by attacker
 *    - Defender's units lost (for reference)
 *    - Defender's captures (for reference)
 *    - Total counts for quick overview
 * 
 * 4. RESOURCE THEFT:
 *    - Display only for base attacks
 *    - Show amount stolen (20% of reserves)
 *    - Different message for victory vs defeat
 * 
 * 5. XP AND PROGRESSION:
 *    - XP earned by both participants
 *    - Level-up notification if triggered
 *    - RP earned display (for level-ups)
 *    - Visual celebration for level-up
 * 
 * 6. USER ACTIONS:
 *    - Close button to return to game
 *    - "View Detailed Log" button (future: navigate to battle log page)
 *    - Encouraging message based on outcome
 * 
 * FUTURE ENHANCEMENTS:
 * - Round-by-round damage breakdown
 * - Battle replay animation
 * - Share battle results (social features)
 * - Rematch button (quick re-attack)
 * - Strategy tips based on outcome
 */
