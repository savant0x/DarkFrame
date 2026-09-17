/**
 * PlayerLogPanel Component
 *
 * FID-20260917-004: first client consumer of GET /api/logs/player/[id]
 * (the combined activity + battle log endpoint that previously had zero callers).
 *
 * OVERVIEW:
 * Self-scoped commander log for the profile page. Tabs for all / activity /
 * battle. Renders activity entries (action, outcome, error code) and battle
 * entries (attacker vs defender, outcome, location, winner). Combat stats are
 * surfaced as wells when the route includes them.
 *
 * CONTRACT NOTES (route: app/api/logs/player/[id]/route.ts):
 * - Auth: cookie token; self-or-admin. Fetched same-origin (cookies flow).
 * - Response is PLAIN JSON (no createSuccessResponse envelope):
 *   { playerId, activityLogs?, activityCount?, battleLogs?, battleCount?,
 *     combatStats?, pagination: { limit, offset } }
 * - Dates arrive as ISO strings (JSON transport).
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { extractApiError } from '@/lib/apiClient';
import { Activity, Swords, Loader2 } from 'lucide-react';

/** Shape consumed from GET /api/logs/player/[id] (plain JSON, optional halves). */
interface PlayerLogsResponse {
  playerId: string;
  activityLogs?: ActivityEntry[];
  activityCount?: number;
  battleLogs?: BattleEntry[];
  battleCount?: number;
  combatStats?: CombatStats | null;
  pagination: { limit: number; offset: number };
}

/** Route contract detail: [id] is the player's USERNAME, not a DB id. */
interface PlayerLogPanelProps {
  username: string;
}

interface ActivityEntry {
  _id?: string;
  actionType: string;
  timestamp: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

interface BattleEntry {
  _id?: string;
  battleId: string;
  timestamp: string;
  attackerUsername: string;
  defenderUsername: string;
  tileX: number;
  tileY: number;
  outcome: string; // BattleOutcome: attacker_win | defender_win | draw
  winner: string;
}

interface CombatStats {
  totalBattles?: number;
  battlesWon?: number;
  battlesLost?: number;
}

type LogType = 'all' | 'activity' | 'battle';

/** Human label for a snake_case ActionType value. */
function formatAction(actionType: string): string {
  return actionType.replaceAll('_', ' ');
}

/** Outcome color + label per BattleOutcome (types/activityLog.types.ts:142). */
function outcomeStyle(outcome: string): { label: string; color: string } {
  switch (outcome) {
    case 'attacker_win':
      return { label: 'attacker won', color: 'var(--nn-green)' };
    case 'defender_win':
      return { label: 'defender won', color: 'var(--nn-magenta)' };
    case 'draw':
      return { label: 'draw', color: 'var(--nn-amber)' };
    default:
      return { label: outcome, color: 'var(--nn-text-secondary)' };
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export default function PlayerLogPanel({ username }: PlayerLogPanelProps) {
  const [logType, setLogType] = useState<LogType>('all');
  const [data, setData] = useState<PlayerLogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (type: LogType) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/logs/player/${encodeURIComponent(username)}?type=${type}&limit=100`);
      const payload = await response.json();
      if (!response.ok) {
        // Route errors are plain { error } objects (no success envelope).
        setError(extractApiError(payload, response.status));
        setData(null);
      } else {
        setData(payload as PlayerLogsResponse);
      }
    } catch {
      setError('Failed to load commander log — network error');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (username) fetchLogs(logType);
  }, [username, logType, fetchLogs]);

  if (!username) return null;

  return (
    <div className="nn-panel">
      <div className="nn-panel__header">
        <span className="nn-panel__title">Commander Log</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {(['all', 'activity', 'battle'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setLogType(t)}
              className={`nn-ptab nn-ptab--def ${logType === t ? 'on' : ''}`}
              style={{ width: 'auto', flex: 'none', padding: '2px 10px' }}
              aria-pressed={logType === t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="nn-panel__body nn-panel__body--padded">
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0' }}>
            <Loader2 className="nn-spin-icon w-4 h-4 text-[color:var(--nn-cyan)]" />
            <span className="nn-lab">Loading log…</span>
          </div>
        )}

        {!loading && error && (
          <div className="nn-note" role="alert">
            <p className="nn-text-magenta">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <div style={{ display: 'grid', gap: 12 }}>
            {/* Combat stats (route includes them when type=battle|all) */}
            {data.combatStats && (data.combatStats.totalBattles ?? 0) > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="nn-well flex-col">
                  <div className="nn-num nn-stat__num--glow-cyan text-xl font-bold">{data.combatStats.totalBattles}</div>
                  <div className="nn-stat__lab mt-1">Battles</div>
                </div>
                <div className="nn-well flex-col">
                  <div className="nn-num nn-stat__num--glow-green text-xl font-bold">{data.combatStats.battlesWon ?? 0}</div>
                  <div className="nn-stat__lab mt-1">Won</div>
                </div>
                <div className="nn-well flex-col">
                  <div className="nn-num nn-stat__num--glow-magenta text-xl font-bold">{data.combatStats.battlesLost ?? 0}</div>
                  <div className="nn-stat__lab mt-1">Lost</div>
                </div>
              </div>
            )}

            {/* Activity entries */}
            {data.activityLogs && data.activityLogs.length > 0 && (
              <div>
                <p className="nn-footnote mb-2">
                  Activity ({data.activityCount ?? data.activityLogs.length})
                </p>
                <div className="nn-well flex-col items-stretch">
                  {data.activityLogs.slice(0, 20).map((entry, i) => (
                    <div key={entry._id ?? i} className="nn-row" style={{ padding: '6px 0', borderBottom: '1px solid color-mix(in oklab, var(--nn-cyan) 8%, transparent)' }}>
                      <span className="nn-row__label" style={{ textTransform: 'capitalize' }}>
                        <Activity style={{ width: 12, height: 12, flex: 'none' }} />
                        {formatAction(entry.actionType)}
                      </span>
                      <span className="nn-row__value" style={{ textAlign: 'right' }}>
                        <span className={entry.success ? 'nn-text-green' : 'nn-text-magenta'} style={{ fontSize: 11 }}>
                          {entry.success ? '✓' : `✗ ${entry.errorCode ?? 'failed'}`}
                        </span>
                        <span className="nn-footnote" style={{ marginLeft: 8 }}>{formatTimestamp(entry.timestamp)}</span>
                      </span>
                    </div>
                  ))}
                  {data.activityLogs.length > 20 && (
                    <p className="nn-footnote" style={{ marginTop: 6 }}>+ {data.activityLogs.length - 20} older entries</p>
                  )}
                </div>
              </div>
            )}

            {/* Battle entries */}
            {data.battleLogs && data.battleLogs.length > 0 && (
              <div>
                <p className="nn-footnote mb-2">
                  Battles ({data.battleCount ?? data.battleLogs.length})
                </p>
                <div className="nn-well flex-col items-stretch">
                  {data.battleLogs.slice(0, 20).map((entry, i) => {
                    const style = outcomeStyle(entry.outcome);
                    return (
                      <div key={entry._id ?? entry.battleId ?? i} className="nn-row" style={{ padding: '6px 0', borderBottom: '1px solid color-mix(in oklab, var(--nn-cyan) 8%, transparent)' }}>
                        <span className="nn-row__label">
                          <Swords style={{ width: 12, height: 12, flex: 'none' }} />
                          {entry.attackerUsername} vs {entry.defenderUsername}
                          <span className="nn-footnote" style={{ marginLeft: 6 }}>({entry.tileX}, {entry.tileY})</span>
                        </span>
                        <span className="nn-row__value" style={{ textAlign: 'right' }}>
                          <span style={{ color: style.color, fontSize: 11 }}>{style.label}</span>
                          <span className="nn-footnote" style={{ marginLeft: 8 }}>{formatTimestamp(entry.timestamp)}</span>
                        </span>
                      </div>
                    );
                  })}
                  {data.battleLogs.length > 20 && (
                    <p className="nn-footnote" style={{ marginTop: 6 }}>+ {data.battleLogs.length - 20} older battles</p>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!data.activityLogs?.length && !data.battleLogs?.length && (
              <div className="nn-brief nn-brief--cyan" style={{ justifyContent: 'center' }}>
                <p className="nn-lab">No log entries recorded yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
