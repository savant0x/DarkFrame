/**
 * Battle Logs Modal - Admin Panel
 * Created: 2025-01-18
 * 
 * OVERVIEW:
 * Comprehensive combat history viewer for administrators. Displays all battle
 * logs with detailed information including attacker, defender, outcome, resources
 * transferred, XP gained, and timestamps. Provides filtering by player, date range,
 * and outcome with pagination and export functionality.
 * 
 * Features:
 * - View all combat encounters in database
 * - Filter by player (attacker or defender)
 * - Filter by outcome (win, loss, draw)
 * - Date range filtering
 * - Pagination (25 logs per page)
 * - Color-coded by outcome
 * - Export logs to JSON
 * - Quick player detail access
 * 
 * Battle Log Data:
 * - Attacker and defender usernames
 * - Battle outcome (win/loss/draw)
 * - Resources transferred (metal, energy)
 * - XP gained by winner
 * - Battle timestamp
 * - Location (coordinates)
 */

'use client';

import { useState, useEffect } from 'react';
import { formatDateTime } from '@/utils/formatting';

/**
 * Battle log data structure
 */
interface BattleLog {
  _id: string;
  timestamp: string; // ISO timestamp
  attackerUsername: string;
  defenderUsername: string;
  outcome: 'attacker_win' | 'defender_win' | 'draw';
  resourcesTransferred: {
    metal: number;
    energy: number;
  };
  xpGained: number;
  location: {
    x: number;
    y: number;
  };
  attackerLosses?: number; // Units lost
  defenderLosses?: number; // Units lost
}

/**
 * Component props
 */
interface BattleLogsModalProps {
  onClose: () => void;
}

/**
 * Battle Logs Modal Component
 * 
 * Provides comprehensive battle history inspection for admins.
 * Fetches all battle logs, applies filters, and displays in paginated table.
 */
export default function BattleLogsModal({ onClose }: BattleLogsModalProps) {
  // Data state
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<BattleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchPlayer, setSearchPlayer] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  /**
   * Fetch all battle logs on mount
   */
  useEffect(() => {
    async function fetchBattleLogs() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/admin/battle-logs');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setLogs(data.logs || []);
        setFilteredLogs(data.logs || []);
      } catch (err) {
        console.error('[BattleLogs] Failed to fetch logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load battle logs');
      } finally {
        setLoading(false);
      }
    }

    fetchBattleLogs();
  }, []);

  /**
   * Apply filters when filter state changes
   */
  useEffect(() => {
    let filtered = [...logs];

    // Filter by player (attacker or defender, case insensitive)
    if (searchPlayer.trim()) {
      const search = searchPlayer.toLowerCase();
      filtered = filtered.filter(log =>
        log.attackerUsername.toLowerCase().includes(search) ||
        log.defenderUsername.toLowerCase().includes(search)
      );
    }

    // Filter by outcome
    if (filterOutcome !== 'all') {
      filtered = filtered.filter(log => log.outcome === filterOutcome);
    }

    // Filter by date range
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= fromDate);
    }
    if (filterDateTo) {
      const toDate = new Date(filterDateTo).getTime() + 86400000; // Add 1 day to include full day
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= toDate);
    }

    setFilteredLogs(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchPlayer, filterOutcome, filterDateFrom, filterDateTo, logs]);

  /**
   * Pagination calculations
   */
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  /**
   * Navigate to previous page
   */
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  /**
   * Navigate to next page
   */
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  /**
   * Export logs to JSON
   */
  const handleExport = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `battle-logs-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Get color class for outcome
   */
  const getOutcomeColor = (outcome: string): string => {
    switch (outcome) {
      case 'attacker_win': return 'text-[color:var(--nn-green)]';
      case 'defender_win': return 'text-[color:var(--nn-magenta)]';
      case 'draw': return 'text-[color:var(--nn-amber)]';
      default: return 'text-[color:var(--nn-text-secondary)]';
    }
  };

  /**
   * Get background color for outcome
   */
  const getOutcomeBgColor = (outcome: string): string => {
    switch (outcome) {
      case 'attacker_win': return 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]';
      case 'defender_win': return 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]';
      case 'draw': return 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]';
      default: return 'bg-[color:var(--nn-void)]';
    }
  };

  /**
   * Format outcome text
   */
  const formatOutcome = (outcome: string): string => {
    switch (outcome) {
      case 'attacker_win': return 'Attacker Victory';
      case 'defender_win': return 'Defender Victory';
      case 'draw': return 'Draw';
      default: return 'Unknown';
    }
  };

  /**
   * Get outcome color
   */
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50">
        <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-8 max-w-md w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] mx-auto mb-4"></div>
            <p className="text-[color:var(--nn-text-secondary)]">Loading battle logs...</p>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50">
        <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-8 max-w-md w-full">
          <h3 className="text-xl font-bold text-[color:var(--nn-magenta)] mb-4">Error Loading Battle Logs</h3>
          <p className="text-[color:var(--nn-text-secondary)] mb-6">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render main modal
   */
  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-violet)]">⚔️ Battle Logs</h2>
            <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">
              {filteredLogs.length} of {logs.length} battles
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none transition text-sm"
            >
              📥 Export JSON
            </button>
            <button
              onClick={onClose}
              className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Player search */}
            <div>
              <label className="block text-sm text-[color:var(--nn-text-secondary)] mb-1">Player (Attacker or Defender)</label>
              <input
                type="text"
                value={searchPlayer}
                onChange={(e) => setSearchPlayer(e.target.value)}
                placeholder="Username..."
                className="w-full px-3 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm focus:border-purple-500 outline-none"
              />
            </div>

            {/* Outcome filter */}
            <div>
              <label className="block text-sm text-[color:var(--nn-text-secondary)] mb-1">Outcome</label>
              <select
                value={filterOutcome}
                onChange={(e) => setFilterOutcome(e.target.value)}
                className="w-full px-3 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm focus:border-purple-500 outline-none"
              >
                <option value="all">All Outcomes</option>
                <option value="attacker_win">Attacker Victory</option>
                <option value="defender_win">Defender Victory</option>
                <option value="draw">Draw</option>
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-sm text-[color:var(--nn-text-secondary)] mb-1">Date From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-3 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm focus:border-purple-500 outline-none"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-sm text-[color:var(--nn-text-secondary)] mb-1">Date To</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-3 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm focus:border-purple-500 outline-none"
              />
            </div>
          </div>

          {/* Clear filters */}
          {(searchPlayer || filterOutcome !== 'all' || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => {
                setSearchPlayer('');
                setFilterOutcome('all');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="mt-3 px-4 py-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] text-sm rounded-none transition"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Battle Logs Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentLogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[color:var(--nn-text-secondary)] text-lg">No battle logs match your filters</p>
              <p className="text-[color:var(--nn-text-secondary)] text-sm mt-2">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentLogs.map((log) => (
                <div
                  key={log._id}
                  className={`border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4 ${getOutcomeBgColor(log.outcome)} border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] transition`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Timestamp */}
                    <div>
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Timestamp</p>
                      <p className="text-[color:var(--nn-text-primary)] text-sm">{formatDateTime(log.timestamp)}</p>
                      <p className="text-[color:var(--nn-text-secondary)] text-xs mt-1">
                        ({log.location.x}, {log.location.y})
                      </p>
                    </div>

                    {/* Attacker */}
                    <div>
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Attacker</p>
                      <p className="text-[color:var(--nn-text-primary)] font-medium">{log.attackerUsername}</p>
                      {log.attackerLosses !== undefined && (
                        <p className="text-[color:var(--nn-magenta)] text-xs">-{log.attackerLosses} units</p>
                      )}
                    </div>

                    {/* Defender */}
                    <div>
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Defender</p>
                      <p className="text-[color:var(--nn-text-primary)] font-medium">{log.defenderUsername}</p>
                      {log.defenderLosses !== undefined && (
                        <p className="text-[color:var(--nn-magenta)] text-xs">-{log.defenderLosses} units</p>
                      )}
                    </div>

                    {/* Outcome */}
                    <div>
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Outcome</p>
                      <p className={`font-bold ${getOutcomeColor(log.outcome)}`}>
                        {formatOutcome(log.outcome)}
                      </p>
                      <p className="text-[color:var(--nn-cyan)] text-xs">+{log.xpGained} XP</p>
                    </div>

                    {/* Resources */}
                    <div>
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Resources Transferred</p>
                      <div className="flex gap-3">
                        <span className="text-[color:var(--nn-cyan)] text-sm">
                          ⚙️ {log.resourcesTransferred.metal.toLocaleString()}
                        </span>
                        <span className="text-[color:var(--nn-amber)] text-sm">
                          ⚡ {log.resourcesTransferred.energy.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] flex justify-between items-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] rounded-none transition"
            >
              Previous
            </button>
            <span className="text-[color:var(--nn-text-secondary)]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] rounded-none transition"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * Features Implemented:
 * - Full battle log database viewing
 * - Multi-criteria filtering (player, outcome, date range)
 * - Pagination (25 logs per page)
 * - Color-coded by outcome (attacker_win=green, defender_win=red, draw=yellow)
 * - Resource transfers and XP display
 * - Unit losses display (if available)
 * - Export to JSON functionality
 * - Location coordinates display
 * 
 * Future Enhancements:
 * - Link to player detail modals
 * - Battle replay visualization
 * - Statistics aggregation (win/loss ratios)
 * - Advanced filtering (by resource amount, XP range)
 * - CSV export option
 * - Battle detail modal with full combat breakdown
 * 
 * Dependencies:
 * - /api/admin/battle-logs endpoint (must return logs array)
 * - Admin authentication in parent component
 * 
 * Performance Considerations:
 * - Client-side filtering for instant feedback
 * - Pagination prevents DOM overload with 10,000+ logs
 * - Consider server-side pagination for very large datasets
 */
