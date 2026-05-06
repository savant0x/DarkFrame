/**
 * @file components/BotSummoningPanel.tsx
 * @created 2025-01-18
 * 
 * OVERVIEW:
 * UI panel for Bot Summoning Circle functionality.
 * 
 * FEATURES:
 * - Tech requirement display (bot-summoning-circle)
 * - Specialization selection (Hoarder, Fortress, Raider, Balanced, Ghost)
 * - Cooldown timer display
 * - Summon confirmation
 * - Success feedback with bot spawn locations
 * 
 * INTEGRATION:
 * - Checks player.unlockedTechs for 'bot-summoning-circle'
 * - Calls /api/bot-summoning endpoints
 * - Displays 7-day cooldown countdown
 * - Shows specialization stats and descriptions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { BotSpecialization } from '@/types/game.types';

interface SummoningStatus {
  canSummon: boolean;
  hoursRemaining?: number;
  lastSummon?: string;
  nextSummonTime?: string;
}

interface BotInfo {
  username: string;
  position: { x: number; y: number };
}

const SPECIALIZATION_INFO = {
  [BotSpecialization.Hoarder]: {
    name: 'Hoarder',
    icon: '💰',
    description: '2x resources, weak army, stays at base',
    color: 'text-yellow-400',
  },
  [BotSpecialization.Fortress]: {
    name: 'Fortress',
    icon: '🏰',
    description: 'Strong defense, stationary, 1.5x resources',
    color: 'text-blue-400',
  },
  [BotSpecialization.Raider]: {
    name: 'Raider',
    icon: '⚔️',
    description: 'Aggressive, high attack rate, roaming',
    color: 'text-red-400',
  },
  [BotSpecialization.Balanced]: {
    name: 'Balanced',
    icon: '⚖️',
    description: 'Equal STR/DEF, moderate resources',
    color: 'text-green-400',
  },
  [BotSpecialization.Ghost]: {
    name: 'Ghost',
    icon: '👻',
    description: 'Teleports randomly, unpredictable',
    color: 'text-purple-400',
  },
  // Boss specialization exists in game but cannot be summoned by players.
  // Included here for exhaustive typing to prevent TS index errors.
  [BotSpecialization.Boss]: {
    name: 'Boss',
    icon: '👑',
    description: 'Elite world boss. Cannot be summoned (admin/spawn only).',
    color: 'text-amber-400',
  },
};

export default function BotSummoningPanel() {
  const { player } = useGameContext();
  const [status, setStatus] = useState<SummoningStatus | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<BotSpecialization>(BotSpecialization.Balanced);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [summonedBots, setSummonedBots] = useState<BotInfo[]>([]);

  const hasTech = player?.unlockedTechs?.includes('bot-summoning-circle') || false;

  useEffect(() => {
    if (hasTech) {
      fetchStatus();
    }
  }, [hasTech]);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/bot-summoning');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching summoning status:', error);
    }
  };

  const handleSummon = async () => {
    // Prevent attempting to summon Boss specialization from UI
    if (selectedSpec === BotSpecialization.Boss) {
      setMessage({ type: 'error', text: 'Bosses are elite world spawns and cannot be summoned.' });
      return;
    }
    if (!confirm(`Summon 5 ${SPECIALIZATION_INFO[selectedSpec].name} bots at your location?`)) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setSummonedBots([]);

    try {
      const response = await fetch('/api/bot-summoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialization: selectedSpec }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setSummonedBots(data.bots || []);
        await fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to summon bots' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (hours: number): string => {
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return days > 0 ? `${days}d ${remainingHours}h` : `${remainingHours}h`;
  };

  if (!hasTech) {
    return (
      <div className="bg-slate-800/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-purple-400 mb-4">⭕ Bot Summoning Circle</h2>
        <p className="text-gray-400">
          Research <span className="text-purple-400 font-semibold">Bot Summoning Circle</span> technology to unlock this feature.
        </p>
        <div className="mt-4 text-sm text-gray-500">
          <p>• Summon 5 bots of chosen specialization</p>
          <p>• Bots spawn within 20-tile radius of your position</p>
          <p>• Summoned bots have 1.5x base resources</p>
          <p>• 7-day cooldown between summons</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-purple-400 mb-4">⭕ Bot Summoning Circle</h2>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'success'
              ? 'bg-green-500/20 border border-green-500/50 text-green-400'
              : 'bg-red-500/20 border border-red-500/50 text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Summoned Bots Display */}
      {summonedBots.length > 0 && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded">
          <h3 className="text-lg font-semibold text-green-300 mb-2">Successfully Summoned!</h3>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {summonedBots.map((bot, idx) => (
              <div key={idx} className="flex justify-between text-gray-300">
                <span>{bot.username}</span>
                <span className="text-cyan-400">
                  ({bot.position.x}, {bot.position.y})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cooldown Display */}
      {status && !status.canSummon && (
        <div className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded">
          <h3 className="text-lg font-semibold text-orange-300 mb-2">Cooldown Active</h3>
          <p className="text-gray-400">
            Next summon available in:{' '}
            <span className="text-orange-400 font-semibold">
              {formatTimeRemaining(status.hoursRemaining || 0)}
            </span>
          </p>
        </div>
      )}

      {/* Specialization Selection */}
      {status?.canSummon && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-purple-300 mb-3">Choose Specialization</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(SPECIALIZATION_INFO).map(([spec, info]) => (
              <button
                key={spec}
                onClick={() => setSelectedSpec(spec as BotSpecialization)}
                className={`p-4 rounded border-2 transition text-left ${
                  selectedSpec === spec
                    ? 'bg-purple-500/30 border-purple-500'
                    : 'bg-slate-700/30 border-slate-600/30 hover:border-purple-500/50'
                }`}
                disabled={spec === BotSpecialization.Boss}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{info.icon}</span>
                  <span className={`font-semibold ${info.color}`}>{info.name}</span>
                </div>
                <p className="text-sm text-gray-400">{info.description}</p>
              </button>
            ))}
          </div>

          <button
            onClick={handleSummon}
            disabled={loading}
            className="mt-4 w-full px-4 py-3 bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded hover:bg-purple-500/30 disabled:opacity-50 transition font-semibold"
          >
            {loading ? 'Summoning...' : `⭕ Summon 5 ${SPECIALIZATION_INFO[selectedSpec].name} Bots`}
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-6 p-4 bg-slate-700/30 rounded border border-slate-600/30">
        <h4 className="text-sm font-semibold text-purple-300 mb-2">Summoning Details</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Spawns 5 bots of chosen specialization</li>
          <li>• Bots appear within 20-tile radius of your position</li>
          <li>• Each bot has 1.5x base resources (Metal & Energy)</li>
          <li>• 7-day (168 hour) cooldown per summon</li>
          <li>• Choose specialization wisely for strategic advantage</li>
          <li>• Summoned bots behave like normal bots (can be defeated)</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * - Requires 'bot-summoning-circle' technology unlocked
 * - Displays specialization selection with icons and descriptions
 * - Real-time countdown for 7-day cooldown
 * - Shows summoned bot usernames and positions after successful summon
 * - Confirmation dialog prevents accidental summons
 * - Glassmorphism design matching game aesthetic
 * - Error handling with user-friendly messages
 * - Grid layout for specialization buttons (responsive)
 */
