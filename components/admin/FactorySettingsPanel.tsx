/**
 * @file components/admin/FactorySettingsPanel.tsx
 * @created 2026-09-12
 * @overview FID-20260912-074 — the admin Factory Settings surface.
 *
 * One panel for everything the factory economy can now do (FID-067/072/073):
 *   • Economy job controls (start/stop/run cycle) + live job stats
 *   • The canonical curve table (slots/regen/production/defense/cost per L1-10)
 *   • Level distribution across the map + ownership leaderboard
 *   • Bot raid config + live raid eligibility/cooldown state
 *
 * Data: GET /api/admin/bot-factory-economy (extended in this FID to carry
 * curves + raids + ownership). Actions: POST same route (run cycle) and
 * /api/admin/jobs-status (start/stop via the scheduler family).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface CurveRow {
  level: number;
  slots: number;
  regenPerHour: number;
  productionPerHour: number;
  defense: number;
  upgradeCost: { metal: number; energy: number } | null;
}

interface PanelData {
  job: {
    lastRun: string | Date | null;
    runCount: number;
    lastUpgraded: number;
    totalUpgraded: number;
    totalInvestedMetal: number;
    seeded: boolean;
    errorCount: number;
    running: boolean;
  };
  factories: {
    total: number;
    wild: number;
    playerOwned: number;
    levelDistribution: Record<string, number>;
  };
  curves: {
    maxLevel: number;
    costMultiplier: number;
    table: CurveRow[];
  };
  raids: {
    config: {
      RAID_RADIUS: number;
      RAID_CHANCE: number;
      BOT_MAX_FACTORIES: number;
      MIN_RAID_STRENGTH: number;
      RAID_ELIGIBLE_TIERS: readonly number[];
    };
    stats: {
      eligibleBots: number;
      onCooldown: number;
      botOwnedFactories: number;
    };
  };
  ownership: Array<{ owner: string; count: number }>;
}

export default function FactorySettingsPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bot-factory-economy');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load factory settings');
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load factory settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runCycle = useCallback(async () => {
    setBusy('cycle');
    setActionMsg(null);
    try {
      const res = await fetch('/api/admin/bot-factory-economy', { method: 'POST' });
      const json = await res.json();
      setActionMsg(json?.data?.message ?? (json.success ? 'Cycle executed' : 'Cycle failed'));
      await load();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Cycle failed');
    } finally {
      setBusy(null);
    }
  }, [load]);

  const mutateJob = useCallback(
    async (action: 'start' | 'stop') => {
      setBusy(action);
      setActionMsg(null);
      try {
        const res = await fetch('/api/admin/jobs-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job: 'botFactoryEconomy', action }),
        });
        const json = await res.json();
        setActionMsg(json?.message ?? (json.success ? `Job ${action}ed` : 'Action failed'));
        await load();
      } catch (err) {
        setActionMsg(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const maxDist = data ? Math.max(...Object.values(data.factories.levelDistribution), 1) : 1;

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-magenta)]">Factory Settings</h2>
            <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">
              curves · bot economy · raids — FID-067/072/073 controls
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {loading && !data && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[color:var(--nn-magenta)]" />
            </div>
          )}

          {error && (
            <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4">
              <p className="text-sm text-[color:var(--nn-magenta)]">{error}</p>
              <button onClick={() => void load()} className="nn-abtn nn-abtn--cyan mt-3">Retry</button>
            </div>
          )}

          {data && (
            <>
              {/* Economy job controls */}
              <section className="border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-[color:var(--nn-text-primary)]">Bot Factory Economy Job</h3>
                    <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                      {data.job.running ? 'running (hourly)' : 'STOPPED'} · {data.job.runCount} runs ·{' '}
                      {data.job.errorCount} errors · last {data.job.lastRun ? new Date(data.job.lastRun).toLocaleTimeString() : 'never'}
                    </p>
                    <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                      lifetime: {data.job.totalUpgraded} factories upgraded ·{' '}
                      {data.job.totalInvestedMetal.toLocaleString()} metal invested by bots ·{' '}
                      {data.job.seeded ? 'world seeded' : 'not seeded'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {data.job.running ? (
                      <button onClick={() => void mutateJob('stop')} disabled={busy !== null} className="nn-abtn nn-abtn--magenta text-xs px-3 py-1.5">
                        STOP JOB
                      </button>
                    ) : (
                      <button onClick={() => void mutateJob('start')} disabled={busy !== null} className="nn-abtn nn-abtn--green text-xs px-3 py-1.5">
                        START JOB
                      </button>
                    )}
                    <button onClick={() => void runCycle()} disabled={busy !== null} className="nn-abtn nn-abtn--violet text-xs px-3 py-1.5">
                      {busy === 'cycle' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'RUN CYCLE NOW'}
                    </button>
                  </div>
                </div>
                {actionMsg && <p className="text-xs text-[color:var(--nn-cyan)] mt-2">{actionMsg}</p>}
              </section>

              {/* Map state: level distribution + ownership */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
                  <h3 className="font-semibold text-[color:var(--nn-text-primary)] mb-1">Level Distribution</h3>
                  <p className="text-xs text-[color:var(--nn-text-secondary)] mb-3">
                    {data.factories.total} factories · {data.factories.wild} wild · {data.factories.playerOwned} owned
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(data.factories.levelDistribution).map(([lvl, n]) => (
                      <div key={lvl} className="flex items-center gap-2">
                        <span className="text-xs text-[color:var(--nn-text-secondary)] w-8">L{lvl}</span>
                        <div className="nn-meter h-2 flex-1">
                          <div className="nn-meter__fill" style={{ width: `${(n / maxDist) * 100}%`, background: 'var(--nn-magenta)' }} />
                        </div>
                        <span className="text-xs text-[color:var(--nn-text-primary)] w-10 text-right">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
                  <h3 className="font-semibold text-[color:var(--nn-text-primary)] mb-1">Ownership (top 8)</h3>
                  <p className="text-xs text-[color:var(--nn-text-secondary)] mb-3">
                    bots own {data.raids.stats.botOwnedFactories} — raid them back
                  </p>
                  <div className="space-y-1">
                    {data.ownership.map(({ owner, count }) => (
                      <div key={owner} className="flex justify-between text-sm">
                        <span className="text-[color:var(--nn-text-primary)]">{owner}</span>
                        <span className="text-[color:var(--nn-text-secondary)]">{count}</span>
                      </div>
                    ))}
                    {data.ownership.length === 0 && (
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">No owned factories yet.</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Bot raids */}
              <section className="border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
                <h3 className="font-semibold text-[color:var(--nn-text-primary)] mb-1">Bot Factory Raids (FID-073)</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-2 text-sm">
                  <p className="text-[color:var(--nn-text-secondary)]">Eligible bots: <span className="text-[color:var(--nn-text-primary)]">{data.raids.stats.eligibleBots}</span></p>
                  <p className="text-[color:var(--nn-text-secondary)]">On cooldown: <span className="text-[color:var(--nn-text-primary)]">{data.raids.stats.onCooldown}</span></p>
                  <p className="text-[color:var(--nn-text-secondary)]">Chance/cycle: <span className="text-[color:var(--nn-text-primary)]">{Math.round(data.raids.config.RAID_CHANCE * 100)}%</span></p>
                  <p className="text-[color:var(--nn-text-secondary)]">Min STR: <span className="text-[color:var(--nn-text-primary)]">{data.raids.config.MIN_RAID_STRENGTH.toLocaleString()}</span></p>
                  <p className="text-[color:var(--nn-text-secondary)]">Cap/bot: <span className="text-[color:var(--nn-text-primary)]">{data.raids.config.BOT_MAX_FACTORIES}</span></p>
                  <p className="text-[color:var(--nn-text-secondary)]">Radius: <span className="text-[color:var(--nn-text-primary)]">{data.raids.config.RAID_RADIUS} tiles</span></p>
                </div>
              </section>

              {/* Curve table */}
              <section className="border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
                <h3 className="font-semibold text-[color:var(--nn-text-primary)] mb-1">
                  Canonical Curves (FID-072) — read-only, single source: factoryUpgradeService
                </h3>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[color:var(--nn-text-secondary)] text-xs border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                        <th className="py-2 pr-4">LVL</th>
                        <th className="py-2 pr-4">SLOTS</th>
                        <th className="py-2 pr-4">REGEN/HR</th>
                        <th className="py-2 pr-4">PROD/HR</th>
                        <th className="py-2 pr-4">DEFENSE</th>
                        <th className="py-2">UPGRADE COST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.curves.table.map((row) => (
                        <tr key={row.level} className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_8%,transparent)]">
                          <td className="py-1.5 pr-4 font-bold text-[color:var(--nn-magenta)]">{row.level}</td>
                          <td className="py-1.5 pr-4 text-[color:var(--nn-text-primary)]">{row.slots.toLocaleString()}</td>
                          <td className="py-1.5 pr-4 text-[color:var(--nn-text-primary)]">{row.regenPerHour}</td>
                          <td className="py-1.5 pr-4 text-[color:var(--nn-text-primary)]">{row.productionPerHour}</td>
                          <td className="py-1.5 pr-4 text-[color:var(--nn-text-primary)]">{row.defense.toLocaleString()}</td>
                          <td className="py-1.5 text-[color:var(--nn-text-secondary)]">
                            {row.upgradeCost
                              ? `${row.upgradeCost.metal.toLocaleString()} ⚙ / ${row.upgradeCost.energy.toLocaleString()} ⚡`
                              : '— (max)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
