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
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] p-4 border-b border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] flex justify-between items-center">
          <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)]">{getLogTitle()}</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-[color:var(--nn-text-secondary)]">Loading logs...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-[color:var(--nn-text-secondary)]">No logs found</div>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedLogs.map((log, index) => (
                <div
                  key={log._id || index}
                  className={`p-4 rounded-none border ${
                    log.outcome === 'victory'
                      ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]'
                  }`}
                >
                  {/* Timestamp */}
                  <div className="text-xs text-[color:var(--nn-text-secondary)] mb-2">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>

                  {/* Battle Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-[color:var(--nn-text-secondary)]">Attacker</div>
                      <div className="font-bold text-[color:var(--nn-magenta)]">{log.attacker}</div>
                      <div className="text-sm text-[color:var(--nn-text-secondary)]">
                        ⚔️ {log.attackerStrength.toLocaleString()} STR
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-[color:var(--nn-text-secondary)]">Defender</div>
                      <div className="font-bold text-[color:var(--nn-cyan)]">{log.defender}</div>
                      <div className="text-sm text-[color:var(--nn-text-secondary)]">
                        🛡️ {log.defenderDefense.toLocaleString()} DEF
                      </div>
                    </div>
                  </div>

                  {/* Outcome */}
                  <div className="mt-3 pt-3 border-t border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]">
                    <div className={`font-bold ${log.outcome === 'victory' ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                      {log.outcome === 'victory' ? '✅ VICTORY' : '❌ DEFEAT'}
                    </div>
                    
                    {log.resourcesStolen && (log.resourcesStolen.metal > 0 || log.resourcesStolen.energy > 0) && (
                      <div className="text-sm text-[color:var(--nn-amber)] mt-1">
                        💰 Resources: {log.resourcesStolen.metal.toLocaleString()} metal, {log.resourcesStolen.energy.toLocaleString()} energy
                      </div>
                    )}
                    
                    {log.factoryCaptured && (
                      <div className="text-sm text-[color:var(--nn-violet)] mt-1">
                        🏭 Factory Captured!
                      </div>
                    )}
                    
                    {log.location && (
                      <div className="text-sm text-[color:var(--nn-text-secondary)] mt-1">
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
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] p-4 border-t border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] flex justify-between items-center">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none"
            >
              Previous
            </button>
            <div className="text-[color:var(--nn-text-secondary)]">
              Page {page} of {totalPages} ({logs.length} total logs)
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
