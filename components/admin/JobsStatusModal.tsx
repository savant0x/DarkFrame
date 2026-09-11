/**
 * @file components/admin/JobsStatusModal.tsx
 * @created 2026-09-10 (FID-20260909-035 jobs-status panel)
 * @overview Lightweight scheduler-health viewer for the admin panel.
 *
 * Shows every background job's live runtime stats — last run, cadence,
 * execution/error counts, per-job details — so a silently-dead scheduler is
 * visible in-game instead of hiding behind zero-count UIs. Polls the
 * read-only /api/admin/jobs-status endpoint every 30s while open.
 *
 * Neon-noir conventions: nn-* class vocabulary, CSS-variable colors only,
 * SPADE/HEART/DIAMOND/CLUB glyphs as the sole sanctioned marks.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface JobEntry {
  id?: string;
  name: string;
  interval: number;
  isRunning: boolean;
  stats: {
    lastRun?: string | Date | null;
    lastRespawn?: string | Date | null;
    executionCount?: number;
    errorCount?: number;
    respawnCount?: number;
    cycleCount?: number;
    movementCount?: number;
    resetCount?: number;
    factoriesRegenerated?: number;
    totalSlotsRegenerated?: number;
    lastSummary?: {
      processed: number;
      regenerated: number;
      moved: number;
      unitsBuilt: number;
    } | null;
    isRunning?: boolean;
  };
  details?: { persistedRespawnWeek?: number | null };
}

interface JobsStatusPayload {
  serverModel: string;
  schedulerUptime: number | null;
  jobs: JobEntry[];
  generatedAt: string;
}

/** Human cadence for an interval in ms. */
function formatInterval(ms: number): string {
  if (ms >= 3_600_000) {
    const h = ms / 3_600_000;
    return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
  }
  return `${Math.round(ms / 60_000)}min`;
}

/** Relative age of a timestamp — "4m ago", "never". */
function formatAgo(ts: string | Date | null | undefined): string {
  if (!ts) return 'never';
  const then = typeof ts === 'string' ? new Date(ts) : ts;
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

/** Is the job overdue? No run in 2.5× its cadence (or never ran while running). */
function isOverdue(job: JobEntry): boolean {
  const last = job.stats.lastRun ?? job.stats.lastRespawn ?? null;
  if (!job.isRunning) return false; // not running is its own, clearer signal
  if (!last) return true;
  const then = typeof last === 'string' ? new Date(last) : last;
  return Date.now() - then.getTime() > job.interval * 2.5;
}

/** Extract a compact per-job progress line for the secondary row. */
function jobDetailLine(job: JobEntry): string {
  const s = job.stats;
  if (s.lastSummary) {
    return `last cycle: ${s.lastSummary.processed} bots · ${s.lastSummary.regenerated} regen · ${s.lastSummary.unitsBuilt} units`;
  }
  if (s.respawnCount !== undefined) {
    const week = job.details?.persistedRespawnWeek;
    return `respawns: ${s.respawnCount}${week ? ` · last in ISO week ${week}` : ''}`;
  }
  if (s.movementCount !== undefined) return `moves: ${s.movementCount} · resets: ${s.resetCount ?? 0}`;
  if (s.factoriesRegenerated !== undefined) {
    return `factories: ${s.factoriesRegenerated} · slots: ${s.totalSlotsRegenerated ?? 0}`;
  }
  return '';
}

export default function JobsStatusModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<JobsStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/jobs-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load job status');
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 30_000);
    return () => clearInterval(poll);
  }, [load]);

  /**
   * FID-20260909-036: fire a scheduler mutation (start/stop/restart/run-now)
   * and refresh immediately so the panel reflects the new live state.
   */
  const mutate = useCallback(
    async (jobId: string, action: 'start' | 'stop' | 'restart' | 'run-now') => {
      setBusyJob(jobId);
      setActionError(null);
      try {
        const res = await fetch('/api/admin/jobs-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job: jobId, action }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message ?? `Action failed (HTTP ${res.status})`);
        }
        await load();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setBusyJob(null);
      }
    },
    [load]
  );

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-violet)]">Scheduler Health</h2>
            <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">
              {data
                ? `${data.jobs.filter((j) => j.isRunning).length}/${data.jobs.length} jobs running${data.schedulerUptime ? ` · scheduler up ${formatInterval(data.schedulerUptime)}` : ''}`
                : 'background jobs'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {loading && !data && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[color:var(--nn-cyan)]" />
            </div>
          )}

          {error && (
            <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4">
              <p className="text-sm text-[color:var(--nn-magenta)]">{error}</p>
              <button onClick={() => void load()} className="nn-abtn nn-abtn--cyan mt-3">Retry</button>
            </div>
          )}

          {data && (
            <div className="space-y-3">
              {actionError && (
                <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-[color:var(--nn-magenta)]">{actionError}</p>
                  <button onClick={() => setActionError(null)} className="text-xs text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)]">
                    dismiss
                  </button>
                </div>
              )}
              {data.jobs.map((job) => {
                const overdue = isOverdue(job);
                const dead = !job.isRunning;
                const statusColor = dead
                  ? 'var(--nn-magenta)'
                  : overdue
                    ? 'var(--nn-amber)'
                    : 'var(--nn-green)';
                const statusLabel = dead ? 'CLUB NOT RUNNING' : overdue ? 'HEART OVERDUE' : 'SPADE RUNNING';
                const detail = jobDetailLine(job);
                return (
                  <div
                    key={job.name}
                    className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-[color:var(--nn-text-primary)] truncate">{job.name}</p>
                        <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                          every {formatInterval(job.interval)} · last run {formatAgo(job.stats.lastRun ?? job.stats.lastRespawn)}
                        </p>
                        {detail && (
                          <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">{detail}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`nn-num text-lg font-bold ${dead || overdue ? '' : 'text-[color:var(--nn-green)]'}`}
                          style={{ color: statusColor }}
                        >
                          {job.stats.executionCount ?? 0}
                          <span className="text-xs text-[color:var(--nn-text-secondary)] font-normal"> runs</span>
                        </p>
                        <p
                          className={`text-xs mt-1 ${job.stats.errorCount ? 'text-[color:var(--nn-magenta)]' : 'text-[color:var(--nn-text-secondary)]'}`}
                        >
                          {statusLabel} · {job.stats.errorCount ?? 0} errors
                        </p>
                      </div>
                    </div>

                    {/* Lifecycle controls (FID-20260909-036) — stop/start/restart + immediate fire */}
                    {job.id && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)]">
                        {job.isRunning ? (
                          <>
                            <button
                              onClick={() => void mutate(job.id!, 'stop')}
                              disabled={busyJob !== null}
                              className="nn-abtn nn-abtn--magenta text-xs px-3 py-1.5"
                            >
                              STOP
                            </button>
                            <button
                              onClick={() => void mutate(job.id!, 'restart')}
                              disabled={busyJob !== null}
                              className="nn-abtn nn-abtn--cyan text-xs px-3 py-1.5"
                            >
                              RESTART
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => void mutate(job.id!, 'start')}
                            disabled={busyJob !== null}
                            className="nn-abtn nn-abtn--green text-xs px-3 py-1.5"
                          >
                            START
                          </button>
                        )}
                        {!job.id.startsWith('wmd:') && (
                          <button
                            onClick={() => void mutate(job.id!, 'run-now')}
                            disabled={busyJob !== null}
                            className="nn-abtn nn-abtn--violet text-xs px-3 py-1.5"
                          >
                            RUN NOW
                          </button>
                        )}
                        {busyJob === job.id && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[color:var(--nn-cyan)]" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="text-xs text-[color:var(--nn-text-secondary)] pt-2 text-center">
                {data.serverModel === 'custom-server'
                  ? 'Stats live in the server process that runs the jobs (npm start / tsx server.ts).'
                  : 'Serving instance stats — under serverless, each instance reports its own jobs.'}
                {' '}Refreshes every 30s · generated {new Date(data.generatedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
