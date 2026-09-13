/**
 * @file components/admin/TutorialDiagnosticModal.tsx
 * @created 2026-09-13
 * @overview FID-20260912-091 — the admin tutorial diagnostic modal.
 *
 * Two views:
 *   1. Roster — every human player's tutorial state (active/complete/skipped/
 *      declined/never-started) with a stuck flag derived from the wiring map.
 *   2. Detail — for one player: every quest → step with its validator, the
 *      wiring verdict (who can complete it), tracking-row evidence, and an
 *      admin override button that force-completes a stuck step through the
 *      real completion service.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface WiringEntry {
  stepId: string;
  title: string;
  action: string;
  requirementType: string | null;
  kind: 'auto' | 'server_hook' | 'manual_click' | 'unwired';
  source: string;
}

interface WiringQuest {
  questId: string;
  title: string;
  order: number;
  steps: WiringEntry[];
}

interface PlayerSummary {
  username: string;
  level: number;
  isBot: boolean;
  hasProgress: boolean;
  tutorialComplete: boolean;
  tutorialSkipped: boolean;
  tutorialDeclined: boolean;
  currentQuestId: string | null;
  currentStepIndex: number;
  currentStepTitle: string | null;
  totalStepsCompleted: number;
  startedAt: string | null;
  lastUpdated: string | null;
  isActive: boolean;
}

interface RosterResponse {
  success: boolean;
  wiringMap: WiringQuest[];
  unwiredCount: number;
  players: PlayerSummary[];
  totals: { active: number; complete: number; skipped: number; declined: number; noProgress: number };
  error?: string;
}

interface DiagnosticStepRow {
  stepId: string;
  order: number;
  title: string;
  action: string;
  requirementType: string | null;
  target: string;
  wiring: { kind: WiringEntry['kind']; source: string };
  completed: boolean;
  isCurrent: boolean;
  skipAllowed: boolean;
  tracking: { currentCount: number; targetCount: number; targetX?: number; targetY?: number; lastUpdated: string } | null;
}

interface DiagnosticQuestRow {
  questId: string;
  title: string;
  order: number;
  completed: boolean;
  skipped: boolean;
  isCurrent: boolean;
  steps: DiagnosticStepRow[];
}

interface PlayerReport {
  summary: PlayerSummary;
  quests: DiagnosticQuestRow[];
  holes: string[];
  currentWiring: { kind: WiringEntry['kind']; source: string } | null;
  stuckUnwired: boolean;
  trackingRows: { stepId: string; currentCount: number; targetCount: number; lastUpdated: string }[];
}

interface DetailResponse {
  success: boolean;
  wiringMap: WiringQuest[];
  unwiredCount: number;
  player: PlayerReport;
  error?: string;
}

const KIND_LABEL: Record<WiringEntry['kind'], { label: string; color: string }> = {
  auto: { label: 'AUTO', color: 'var(--nn-cyan)' },
  server_hook: { label: 'SERVER HOOK', color: 'var(--nn-green)' },
  manual_click: { label: 'MANUAL', color: 'var(--nn-amber, #ffb347)' },
  unwired: { label: 'UNWIRED', color: 'var(--nn-red, #ff5470)' },
};

function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function TutorialDiagnosticModal({ onClose }: { onClose: () => void }) {
  const [wiringMap, setWiringMap] = useState<WiringQuest[]>([]);
  const [unwiredCount, setUnwiredCount] = useState(0);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [totals, setTotals] = useState<RosterResponse['totals'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlayerReport | null>(null);
  const [search, setSearch] = useState('');
  const [overrideBusy, setOverrideBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/tutorial-diagnostic');
      const data: RosterResponse = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setWiringMap(data.wiringMap);
      setUnwiredCount(data.unwiredCount);
      setPlayers(data.players);
      setTotals(data.totals);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  const openPlayer = useCallback(async (username: string) => {
    try {
      setError(null);
      setSelected(null);
      const res = await fetch(`/api/admin/tutorial-diagnostic?username=${encodeURIComponent(username)}`);
      const data: DetailResponse = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setWiringMap(data.wiringMap);
      setSelected(data.player);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load player report');
    }
  }, []);

  const overrideStep = useCallback(async (username: string, questId: string, stepId: string) => {
    try {
      setOverrideBusy(stepId);
      setNotice(null);
      const res = await fetch('/api/admin/tutorial-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, questId, stepId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Override failed');
      setNotice(`✅ ${stepId}: ${data.outcome} — ${data.message ?? 'done'}`);
      await openPlayer(username);
    } catch (e) {
      setNotice(`⚠️ ${e instanceof Error ? e.message : 'Override failed'}`);
    } finally {
      setOverrideBusy(null);
    }
  }, [openPlayer]);

  // A roster player is "stuck" if their current step's wiring is unwired
  // (derived client-side from the shared wiring map).
  const wiringByStep = new Map<string, WiringEntry>();
  for (const q of wiringMap) for (const s of q.steps) wiringByStep.set(s.stepId, s);

  const filtered = players.filter(p =>
    search === '' || p.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-violet)]">🎓 Tutorial Diagnostic</h2>
            <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">
              {selected
                ? `Player ▸ ${selected.summary.username}`
                : `${players.length} players · ${totals?.active ?? 0} active · ${unwiredCount} unwired step(s) in quest definitions`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selected && (
              <button onClick={() => setSelected(null)} className="nn-abtn nn-abtn--cyan text-sm">
                ← Roster
              </button>
            )}
            <button onClick={onClose} className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl leading-none">×</button>
          </div>
        </div>

        {notice && (
          <div className="px-6 py-2 text-sm text-[color:var(--nn-cyan)] border-b border-[color-mix(in_oklab,var(--nn-violet)_30%,transparent)]">
            {notice}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-16 text-[color:var(--nn-text-secondary)]">
              <Loader2 className="animate-spin mr-2" size={20} /> Loading diagnostics…
            </div>
          )}

          {!loading && error && (
            <div className="text-[color:var(--nn-red, #ff5470)] py-8 text-center">{error}</div>
          )}

          {/* ------------------------------------------------ Roster view */}
          {!loading && !error && !selected && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                {[
                  { label: 'Active', value: totals?.active ?? 0, color: 'var(--nn-cyan)' },
                  { label: 'Complete', value: totals?.complete ?? 0, color: 'var(--nn-green)' },
                  { label: 'Skipped', value: totals?.skipped ?? 0, color: 'var(--nn-amber, #ffb347)' },
                  { label: 'Declined', value: totals?.declined ?? 0, color: 'var(--nn-red, #ff5470)' },
                  { label: 'Never started', value: totals?.noProgress ?? 0, color: 'var(--nn-text-secondary)' },
                ].map(card => (
                  <div key={card.label} className="border p-3 rounded-none" style={{ borderColor: `color-mix(in_oklab, ${card.color} 50%, transparent)`, background: `color-mix(in oklab, ${card.color} 12%, transparent)` }}>
                    <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                    <div className="text-xs text-[color:var(--nn-text-secondary)]">{card.label}</div>
                  </div>
                ))}
              </div>

              {unwiredCount > 0 && (
                <div className="mb-5 p-3 border border-[color-mix(in_oklab,var(--nn-red, #ff5470)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-red, #ff5470)_10%,transparent)] text-sm" style={{ color: 'var(--nn-red, #ff5470)' }}>
                  ⚠ {unwiredCount} step(s) in the quest definitions have NO completion path — any player who reaches one stalls forever. See the wiring map below.
                </div>
              )}

              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search players…"
                className="w-full mb-4 px-3 py-2 bg-transparent border border-[color-mix(in_oklab,var(--nn-violet)_40%,transparent)] text-[color:var(--nn-text-primary)] text-sm rounded-none"
              />

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[color:var(--nn-text-secondary)] border-b border-[color-mix(in_oklab,var(--nn-violet)_40%,transparent)]">
                    <th className="py-2 pr-3">Player</th>
                    <th className="py-2 pr-3">LV</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Current quest / step</th>
                    <th className="py-2 pr-3">Steps done</th>
                    <th className="py-2 pr-3">Last activity</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const currentWiring = p.currentQuestId && p.isActive
                      ? wiringByStep.get(
                          wiringMap.find(q => q.questId === p.currentQuestId)?.steps[p.currentStepIndex]?.stepId ?? ''
                        )
                      : undefined;
                    const stuck = currentWiring?.kind === 'unwired';
                    const status = p.tutorialComplete ? 'COMPLETE'
                      : p.tutorialSkipped ? 'SKIPPED'
                      : p.tutorialDeclined ? 'DECLINED'
                      : p.isActive ? 'ACTIVE'
                      : '—';
                    const statusColor = p.tutorialComplete ? 'var(--nn-green)'
                      : (p.tutorialSkipped || p.tutorialDeclined) ? 'var(--nn-text-secondary)'
                      : p.isActive ? 'var(--nn-cyan)'
                      : 'var(--nn-text-secondary)';
                    return (
                      <tr key={p.username} className="border-b border-[color-mix(in_oklab,var(--nn-violet)_20%,transparent)] hover:bg-[color-mix(in_oklab,var(--nn-violet)_8%,transparent)]">
                        <td className="py-2 pr-3 text-[color:var(--nn-text-primary)]">{p.username}</td>
                        <td className="py-2 pr-3">{p.level}</td>
                        <td className="py-2 pr-3 font-bold" style={{ color: statusColor }}>
                          {status}{stuck && <span className="ml-2" style={{ color: 'var(--nn-red, #ff5470)' }}>⚠ STUCK</span>}
                        </td>
                        <td className="py-2 pr-3 text-[color:var(--nn-text-secondary)]">
                          {p.isActive ? `${p.currentQuestId ?? '—'} · ${p.currentStepTitle ?? '—'}` : '—'}
                        </td>
                        <td className="py-2 pr-3">{p.totalStepsCompleted}</td>
                        <td className="py-2 pr-3 text-[color:var(--nn-text-secondary)]">{fmtDate(p.lastUpdated)}</td>
                        <td className="py-2">
                          <button onClick={() => openPlayer(p.username)} className="nn-abtn nn-abtn--violet text-xs">Inspect</button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-[color:var(--nn-text-secondary)]">No players match.</td></tr>
                  )}
                </tbody>
              </table>

              {/* Wiring map */}
              <div className="mt-8">
                <h3 className="text-lg font-bold text-[color:var(--nn-violet)] mb-2">Step Wiring Map (all players)</h3>
                <p className="text-xs text-[color:var(--nn-text-secondary)] mb-3">
                  How each step can complete. UNWIRED = no code path anywhere can complete it (the FID-090b failure class).
                </p>
                <div className="space-y-4">
                  {wiringMap.map(q => (
                    <div key={q.questId} className="border border-[color-mix(in_oklab,var(--nn-violet)_30%,transparent)] p-3">
                      <div className="font-bold text-[color:var(--nn-text-primary)] mb-2">{q.title} <span className="text-xs text-[color:var(--nn-text-secondary)]">({q.questId})</span></div>
                      <div className="space-y-1">
                        {q.steps.map(s => {
                          const k = KIND_LABEL[s.kind];
                          return (
                            <div key={s.stepId} className="flex items-start gap-2 text-xs">
                              <span className="font-bold shrink-0 px-1.5 border" style={{ color: k.color, borderColor: `color-mix(in oklab, ${k.color} 50%, transparent)` }}>{k.label}</span>
                              <span className="text-[color:var(--nn-text-primary)] shrink-0 w-56 truncate">{s.title}</span>
                              <span className="text-[color:var(--nn-text-secondary)]">{s.source}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ------------------------------------------------ Detail view */}
          {!loading && !error && selected && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="border p-3" style={{ borderColor: 'color-mix(in oklab, var(--nn-violet) 40%, transparent)' }}>
                  <div className="text-xs text-[color:var(--nn-text-secondary)]">Player</div>
                  <div className="font-bold text-[color:var(--nn-text-primary)]">{selected.summary.username} · LV {selected.summary.level}</div>
                </div>
                <div className="border p-3" style={{ borderColor: 'color-mix(in oklab, var(--nn-violet) 40%, transparent)' }}>
                  <div className="text-xs text-[color:var(--nn-text-secondary)]">Steps completed</div>
                  <div className="font-bold text-[color:var(--nn-text-primary)]">{selected.summary.totalStepsCompleted}</div>
                </div>
                <div className="border p-3" style={{ borderColor: 'color-mix(in oklab, var(--nn-violet) 40%, transparent)' }}>
                  <div className="text-xs text-[color:var(--nn-text-secondary)]">Started</div>
                  <div className="text-[color:var(--nn-text-primary)]">{fmtDate(selected.summary.startedAt)}</div>
                </div>
                <div className="border p-3" style={{ borderColor: selected.stuckUnwired ? 'var(--nn-red, #ff5470)' : 'color-mix(in oklab, var(--nn-violet) 40%, transparent)' }}>
                  <div className="text-xs text-[color:var(--nn-text-secondary)]">Current step</div>
                  <div className="font-bold" style={{ color: selected.stuckUnwired ? 'var(--nn-red, #ff5470)' : 'var(--nn-text-primary)' }}>
                    {selected.summary.isActive ? selected.summary.currentStepTitle : (selected.summary.tutorialComplete ? 'COMPLETE' : selected.summary.tutorialSkipped ? 'SKIPPED' : selected.summary.tutorialDeclined ? 'DECLINED' : '—')}
                  </div>
                </div>
              </div>

              {selected.stuckUnwired && selected.currentWiring && (
                <div className="mb-5 p-3 border border-[color-mix(in_oklab,var(--nn-red, #ff5470)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-red, #ff5470)_10%,transparent)] text-sm" style={{ color: 'var(--nn-red, #ff5470)' }}>
                  ⚠ STUCK: the current step has no completion path. {selected.currentWiring.source}
                </div>
              )}

              {selected.holes.length > 0 && (
                <div className="mb-5 p-3 border text-sm" style={{ borderColor: 'color-mix(in oklab, var(--nn-amber, #ffb347) 50%, transparent)', color: 'var(--nn-amber, #ffb347)' }}>
                  ⚠ {selected.holes.length} earlier step(s) on the current quest are not completed but the index moved past them: {selected.holes.join(', ')}
                </div>
              )}

              <div className="space-y-4">
                {selected.quests.map(q => (
                  <div key={q.questId} className="border p-3" style={{ borderColor: q.isCurrent ? 'color-mix(in oklab, var(--nn-cyan) 60%, transparent)' : 'color-mix(in oklab, var(--nn-violet) 25%, transparent)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-[color:var(--nn-text-primary)]">{q.title}</span>
                      {q.completed && <span className="text-xs font-bold" style={{ color: 'var(--nn-green)' }}>✓ COMPLETE</span>}
                      {q.skipped && <span className="text-xs text-[color:var(--nn-text-secondary)]">SKIPPED</span>}
                      {q.isCurrent && <span className="text-xs font-bold" style={{ color: 'var(--nn-cyan)' }}>◀ CURRENT</span>}
                    </div>
                    <div className="space-y-2">
                      {q.steps.map(s => {
                        const k = KIND_LABEL[s.wiring.kind];
                        const canOverride = !s.completed && (s.isCurrent || q.isCurrent);
                        return (
                          <div key={s.stepId} className="text-xs border-l-2 pl-3 py-1" style={{ borderColor: s.isCurrent ? 'var(--nn-cyan)' : 'color-mix(in oklab, var(--nn-violet) 30%, transparent)' }}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span style={{ color: s.completed ? 'var(--nn-green)' : 'var(--nn-text-primary)' }}>
                                {s.completed ? '✓' : s.isCurrent ? '▶' : '·'} [{s.order}] {s.title}
                              </span>
                              <span className="text-[color:var(--nn-text-secondary)]">({s.action}{s.requirementType ? ` · ${s.requirementType}` : ''}{s.target !== '—' ? ` · ${s.target}` : ''})</span>
                              <span className="font-bold px-1.5 border shrink-0" style={{ color: k.color, borderColor: `color-mix(in oklab, ${k.color} 50%, transparent)` }}>{k.label}</span>
                              {s.skipAllowed && <span className="text-[color:var(--nn-text-secondary)]">skippable</span>}
                              {!s.completed && canOverride && (
                                <button
                                  onClick={() => overrideStep(selected.summary.username, q.questId, s.stepId)}
                                  disabled={overrideBusy === s.stepId}
                                  className="nn-abtn nn-abtn--amber text-xs ml-auto"
                                >
                                  {overrideBusy === s.stepId ? '…' : 'Override → complete'}
                                </button>
                              )}
                            </div>
                            <div className="text-[color:var(--nn-text-secondary)] mt-0.5">
                              {s.wiring.source}
                              {s.tracking && ` · tracked ${s.tracking.currentCount}/${s.tracking.targetCount || '—'}${s.tracking.targetX !== undefined ? ` → (${s.tracking.targetX},${s.tracking.targetY})` : ''} @ ${fmtDate(s.tracking.lastUpdated)}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
