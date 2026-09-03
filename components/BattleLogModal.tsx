/**
 * @file components/BattleLogModal.tsx
 * @created 2025-10-17
 * @overview Modal for viewing detailed battle logs
 */

'use client';

import React, { useState, useEffect } from 'react';

interface BattleLog {
  _id: string;
  timestamp: Date;
  attacker: string;
  defender: string;
  attackerStrength: number;
  defenderDefense: number;
  outcome: 'victory' | 'defeat';
  resourcesStolen?: {
    metal: number;
    energy: number;
  };
  factoryCaptured?: boolean;
  location?: {
    x: number;
    y: number;
  };
}

interface BattleLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logType: 'attacks' | 'defenses' | 'tiles' | 'mines';
  username: string;
}

export default function BattleLogModal({ isOpen, onClose, logType, username }: BattleLogModalProps) {
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const logsPerPage = 20;

  useEffect(() => {
    if (!isOpen) return;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/combat/logs?username=${username}&type=${logType}`);
        if (response.ok) {
          const data = await response.json();
          setLogs(data.logs || []);
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [isOpen, logType, username]);

  if (!isOpen) return null;

  const startIndex = (page - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const paginatedLogs = logs.slice(startIndex, endIndex);
  const totalPages = Math.ceil(logs.length / logsPerPage);

  const getLogTitle = () => {
    switch (logType) {
      case 'attacks': return '⚔️ Attack Logs';
      case 'defenses': return '🛡️ Defense Logs';
      case 'tiles': return '🗺️ Tile Logs';
      case 'mines': return '💣 Land Mine Logs';
      default: return 'Battle Logs';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-700 p-4 border-b border-gray-600 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-blue-400">{getLogTitle()}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-400">Loading logs...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400">No logs found</div>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedLogs.map((log, index) => (
                <div
                  key={log._id || index}
                  className={`p-4 rounded-lg border ${
                    log.outcome === 'victory'
                      ? 'bg-green-900/20 border-green-600'
                      : 'bg-red-900/20 border-red-600'
                  }`}
                >
                  {/* Timestamp */}
                  <div className="text-xs text-gray-400 mb-2">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>

                  {/* Battle Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">Attacker</div>
                      <div className="font-bold text-red-400">{log.attacker}</div>
                      <div className="text-sm text-gray-300">
                        ⚔️ {log.attackerStrength.toLocaleString()} STR
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Defender</div>
                      <div className="font-bold text-blue-400">{log.defender}</div>
                      <div className="text-sm text-gray-300">
                        🛡️ {log.defenderDefense.toLocaleString()} DEF
                      </div>
                    </div>
                  </div>

                  {/* Outcome */}
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <div className={`font-bold ${log.outcome === 'victory' ? 'text-green-400' : 'text-red-400'}`}>
                      {log.outcome === 'victory' ? '✅ VICTORY' : '❌ DEFEAT'}
                    </div>
                    
                    {log.resourcesStolen && (log.resourcesStolen.metal > 0 || log.resourcesStolen.energy > 0) && (
                      <div className="text-sm text-yellow-400 mt-1">
                        💰 Resources: {log.resourcesStolen.metal.toLocaleString()} metal, {log.resourcesStolen.energy.toLocaleString()} energy
                      </div>
                    )}
                    
                    {log.factoryCaptured && (
                      <div className="text-sm text-purple-400 mt-1">
                        🏭 Factory Captured!
                      </div>
                    )}
                    
                    {log.location && (
                      <div className="text-sm text-gray-400 mt-1">
                        📍 Location: ({log.location.x}, {log.location.y})
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-700 p-4 border-t border-gray-600 flex justify-between items-center">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded"
            >
              Previous
            </button>
            <div className="text-gray-300">
              Page {page} of {totalPages} ({logs.length} total logs)
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
