/**
 * Battle Logs Dynamic Route Page
 * Full-page battle log viewer with type filtering
 * 
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Dynamic route for viewing battle logs filtered by type:
 * - /game/battle-logs/attack - Attack logs
 * - /game/battle-logs/defense - Defense logs
 * - /game/battle-logs/infantry - Infantry battle logs
 * - /game/battle-logs/land-mines - Land mine logs
 * 
 * Features:
 * - Pagination (20 logs per page)
 * - Color-coded results (victory green, defeat red)
 * - Detailed battle information
 * - Resources gained/lost display
 * - Location and timestamp information
 * - Back button navigation to /game
 * 
 * Battle Log Entry Format:
 * - Opponent username and coordinates
 * - Battle result (Victory/Defeat)
 * - Resources gained or lost
 * - Battle location (x, y)
 * - Timestamp with relative time display
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { BackButton } from '@/components';

interface BattleLog {
  _id: string;
  attackerUsername: string;
  defenderUsername: string;
  result: 'victory' | 'defeat';
  type: 'attack' | 'defense' | 'infantry' | 'land-mines';
  metalGained?: number;
  metalLost?: number;
  energyGained?: number;
  energyLost?: number;
  location: {
    x: number;
    y: number;
  };
  timestamp: string;
  attackerStrength?: number;
  defenderStrength?: number;
  attackerLosses?: number;
  defenderLosses?: number;
}

interface BattleLogsResponse {
  logs: BattleLog[];
  total: number;
  page: number;
  totalPages: number;
}

const TYPE_LABELS: Record<string, string> = {
  attack: 'Attack Logs',
  defense: 'Defense Logs',
  infantry: 'Infantry Battle Logs',
  'land-mines': 'Land Mine Logs',
};

export default function BattleLogsPage() {
  const router = useRouter();
  const params = useParams();
  const { player } = useGameContext();
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const logType = params?.type as string;

  useEffect(() => {
    if (!player) {
      router.push('/login');
      return;
    }

    if (!logType || !['attack', 'defense', 'infantry', 'land-mines'].includes(logType)) {
      router.push('/game');
      return;
    }

    const username = player.username;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/battle-logs?username=${username}&type=${logType}&page=${page}&limit=20`
        );

        if (response.ok) {
          const data: BattleLogsResponse = await response.json();
          setLogs(data.logs);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      } catch (error) {
        console.error('Failed to fetch battle logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [player, router, logType, page]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  if (loading && page === 1) {
    return (
      <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] flex items-center justify-center">
        <p className="text-xl">Loading battle logs...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <BackButton />
          <h1 className="text-4xl font-bold mt-4">
            {TYPE_LABELS[logType] || 'Battle Logs'}
          </h1>
          <p className="text-[color:var(--nn-text-secondary)] mt-2">
            Showing {logs.length} of {total.toLocaleString()} logs
          </p>
        </div>

        {/* Pagination Controls - Top */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mb-4 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-secondary)] disabled:cursor-not-allowed rounded-none font-semibold transition-colors"
            >
              ← Previous
            </button>
            <span className="text-[color:var(--nn-text-secondary)]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-secondary)] disabled:cursor-not-allowed rounded-none font-semibold transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {/* Battle Logs List */}
        <div className="space-y-3">
          {logs.map((log) => {
            const isVictory = log.result === 'victory';
            const isAttacker = log.attackerUsername === player?.username;
            const opponent = isAttacker ? log.defenderUsername : log.attackerUsername;
            
            const metalChange = (log.metalGained || 0) - (log.metalLost || 0);
            const energyChange = (log.energyGained || 0) - (log.energyLost || 0);

            return (
              <div
                key={log._id}
                className={`p-4 rounded-none border-2 ${
                  isVictory
                    ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]'
                    : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]'
                }`}
              >
                <div className="flex flex-wrap justify-between items-start gap-4">
                  {/* Battle Info */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-3 py-1 rounded-none font-bold text-sm ${
                          isVictory
                            ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                            : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                        }`}
                      >
                        {isVictory ? 'VICTORY' : 'DEFEAT'}
                      </span>
                      <span className="text-lg font-semibold">
                        vs {opponent}
                      </span>
                    </div>

                    <div className="text-sm text-[color:var(--nn-text-secondary)] space-y-1">
                      <p>
                        Location: ({log.location.x}, {log.location.y})
                      </p>
                      <p>{formatTimestamp(log.timestamp)}</p>
                    </div>
                  </div>

                  {/* Battle Stats */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm space-y-1">
                      {log.attackerStrength !== undefined && log.defenderStrength !== undefined && (
                        <p className="text-[color:var(--nn-text-secondary)]">
                          <span className="text-[color:var(--nn-text-secondary)]">Forces:</span>{' '}
                          {log.attackerStrength.toLocaleString()} vs{' '}
                          {log.defenderStrength.toLocaleString()}
                        </p>
                      )}
                      {log.attackerLosses !== undefined && log.defenderLosses !== undefined && (
                        <p className="text-[color:var(--nn-text-secondary)]">
                          <span className="text-[color:var(--nn-text-secondary)]">Casualties:</span>{' '}
                          {isAttacker ? log.attackerLosses : log.defenderLosses} units
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Resources */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm space-y-1">
                      {metalChange !== 0 && (
                        <p
                          className={`font-semibold ${
                            metalChange > 0 ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'
                          }`}
                        >
                          <span className="text-[color:var(--nn-amber)]">Metal:</span>{' '}
                          {metalChange > 0 ? '+' : ''}
                          {metalChange.toLocaleString()}
                        </p>
                      )}
                      {energyChange !== 0 && (
                        <p
                          className={`font-semibold ${
                            energyChange > 0 ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'
                          }`}
                        >
                          <span className="text-[color:var(--nn-cyan)]">Energy:</span>{' '}
                          {energyChange > 0 ? '+' : ''}
                          {energyChange.toLocaleString()}
                        </p>
                      )}
                      {metalChange === 0 && energyChange === 0 && (
                        <p className="text-[color:var(--nn-text-secondary)] italic">No resources gained/lost</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* No Logs Message */}
        {logs.length === 0 && !loading && (
          <div className="text-center py-12 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <p className="text-xl text-[color:var(--nn-text-secondary)]">No battle logs found</p>
            <p className="text-sm text-[color:var(--nn-text-secondary)] mt-2">
              {logType === 'attack' && "You haven't attacked anyone yet"}
              {logType === 'defense' && "You haven't been attacked yet"}
              {logType === 'infantry' && "No infantry battle encounters yet"}
              {logType === 'land-mines' && "No land mine encounters yet"}
            </p>
          </div>
        )}

        {/* Pagination Controls - Bottom */}
        {totalPages > 1 && logs.length > 0 && (
          <div className="flex justify-between items-center mt-4 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-secondary)] disabled:cursor-not-allowed rounded-none font-semibold transition-colors"
            >
              ← Previous
            </button>
            <div className="flex gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`px-3 py-2 rounded-none font-semibold transition-colors ${
                      page === pageNum
                        ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                        : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-secondary)]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-secondary)] disabled:cursor-not-allowed rounded-none font-semibold transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {/* Loading Indicator for Page Changes */}
        {loading && page > 1 && (
          <div className="text-center py-8">
            <p className="text-[color:var(--nn-text-secondary)]">Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}
