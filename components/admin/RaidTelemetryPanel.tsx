/**
 * RaidTelemetryPanel — the admin card for the raid tuning loop
 * (docs/design/PVP_BASE_RAID_DESIGN.md §4.6, FID-20260928-008/009).
 *
 * Self-fetching (modal pattern): one mount line in AdminView, no AdminView
 * state changes. Renders win rate, loot vs the §4.1 attacker-level ceiling,
 * the §4.2 defender-loss floor's observable bite, and top hostility-refusal
 * pairs. Best-effort end to end: the endpoint degrades structurally
 * (outcomes may be null) and this panel renders that as an error row instead
 * of crashing the dashboard.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { extractApiError } from '@/lib/apiClient';

/** Response shape of GET /api/admin/raid-telemetry (FID-20260928-008). */
interface RaidTelemetryResponse {
  success: boolean;
  data?: {
    windowHours: number;
    outcomes: {
      totalRaids: number;
      wins: number;
      losses: number;
      draws: number;
      winRate: number | null;
      lootMetal: number;
      lootEnergy: number;
      avgAttackerLosses: number | null;
      avgDefenderLosses: number | null;
      uniqueAttackers: number | null;
      uniqueDefenders: number | null;
    } | null;
    refusalPairs: Array<{ attacker: string; defender: string; total: number; topReason: string | null }>;
  };
  error?: unknown;
}

const WINDOW_OPTIONS = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
  { label: '90d', hours: 2160 },
];

const fmt = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits });

export default function RaidTelemetryPanel() {
  const [windowHours, setWindowHours] = useState(168);
  const [data, setData] = useState<RaidTelemetryResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (hours: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/raid-telemetry?windowHours=${hours}&limit=10`);
      const json: RaidTelemetryResponse = await res.json();
      if (!json.success || !json.data) {
        setError(extractApiError(json, res.status));
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(windowHours);
  }, [load, windowHours]);

  const outcomes = data?.outcomes ?? null;
  const winRateLabel = outcomes?.winRate != null ? `${Math.round(outcomes.winRate * 100)}%` : '—';

  return (
    <div className="nn-panel nn-panel--x-pad nn-panel--violet">
      <div className="nn-panel__header nn-panel__header--bleed">
        <span className="nn-panel__title">Raid Telemetry</span>
        <span className="nn-panel__meta">
          OPS ▸ PVP RAID TUNING
          <button
            onClick={() => void load(windowHours)}
            disabled={loading}
            className="ml-3 inline-flex items-center gap-1 text-[color:var(--nn-cyan)] hover:underline disabled:opacity-40"
            aria-label="Refresh raid telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'nn-spin-icon' : ''}`} />
            Refresh
          </button>
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-[color:var(--nn-text-secondary)] text-sm">Window:</span>
        {WINDOW_OPTIONS.map((opt) => (
          <button
            key={opt.hours}
            onClick={() => setWindowHours(opt.hours)}
            className={`nn-chip px-2 py-0.5 text-xs ${windowHours === opt.hours ? 'nn-chip--cyan' : ''}`}
            aria-pressed={windowHours === opt.hours}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="nn-spin-icon w-6 h-6 text-[color:var(--nn-violet)]" aria-label="Loading raid telemetry" />
        </div>
      )}

      {error && (
        <div className="border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] p-3 text-sm text-[color:var(--nn-magenta)]">
          {error}
        </div>
      )}

      {data && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <Metric label="Raids" value={fmt(outcomes?.totalRaids)} />
            <Metric label="Win rate" value={winRateLabel} />
            <Metric
              label="Avg defender losses (§4.2 floor)"
              value={outcomes?.avgDefenderLosses == null ? '—' : fmt(outcomes.avgDefenderLosses, 2)}
            />
            <Metric label="Metal looted (§4.1 cap)" value={fmt(outcomes?.lootMetal)} />
            <Metric label="Energy looted (§4.1 cap)" value={fmt(outcomes?.lootEnergy)} />
            <Metric
              label="Unique attackers"
              value={fmt(outcomes?.uniqueAttackers)}
            />
          </div>

          <p className="text-[color:var(--nn-text-secondary)] text-xs mb-2">
            Top hostility refusals per attacker → defender pair — a spammy pair signals harassment;
            zero refusals from a hostile pair signals an unreachable loop (§4.6).
          </p>
          {data.refusalPairs.length === 0 ? (
            <p className="text-[color:var(--nn-text-secondary)] text-sm py-2">No hostility refusals in window.</p>
          ) : (
            <div className="space-y-1">
              {data.refusalPairs.map((p, i) => (
                <div
                  key={`${p.attacker}-${p.defender}-${i}`}
                  className="flex items-center gap-2 text-sm border-b border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)] pb-1"
                >
                  <span className="text-[color:var(--nn-text-primary)] font-semibold">{p.attacker}</span>
                  <span className="text-[color:var(--nn-text-secondary)]">→</span>
                  <span className="text-[color:var(--nn-text-primary)]">{p.defender}</span>
                  <span className="ml-auto text-[color:var(--nn-text-secondary)]">×{p.total}</span>
                  {p.topReason && (
                    <span className="text-[color:var(--nn-text-secondary)] text-xs truncate max-w-[40%]">
                      {p.topReason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <Metric label="Unique defenders" value={fmt(outcomes?.uniqueDefenders)} />
            <Metric label="Draws" value={fmt(outcomes?.draws)} />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] p-2">
      <p className="text-[color:var(--nn-text-secondary)] text-xs">{label}</p>
      <p className="text-[color:var(--nn-text-primary)] text-lg font-semibold">{value}</p>
    </div>
  );
}
