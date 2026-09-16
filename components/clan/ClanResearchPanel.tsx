/**
 * @file components/clan/ClanResearchPanel.tsx
 * @created 2026-09-16
 * @overview FID-20260916-012 — clan research contribute/unlock panel. Replaces
 *           the ComingSoonTab placeholder for the `research` tab in ClanPanel.
 *
 * DATA FLOW:
 * - GET  /api/clan/research/state  — tree (nodes with unlocked/available),
 *   clanLevel, and the shared researchPoints fund.
 * - POST /api/clan/research/contribute { amount } — personal RP into the fund.
 * - POST /api/clan/research/unlock { researchId } — server re-gates roles;
 *   this UI's role check is presentational only and never substitutes for it.
 *
 * HONESTY (FID-20260912-058 C1): the tree is 4 MILITARY nodes; the panel
 * renders a single list rather than four branch tabs over empty arrays.
 * Server messages are surfaced verbatim; no client-side refusal pre-filtering.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { FlaskConical } from 'lucide-react';
import { showSuccess, showError } from '@/lib/toastService';
import { extractApiError } from '@/lib/apiClient';
import { ClanRole } from '@/types/clan.types';

interface ResearchBonus {
  type: string;
  value: number;
}

interface ResearchNodeView {
  id: string;
  name: string;
  description: string;
  branch: string;
  tier: number;
  cost: number;
  requiredLevel: number;
  prerequisites: string[];
  bonuses: ResearchBonus[];
  unlocked: boolean;
  available: boolean;
}

interface ResearchTree {
  INDUSTRIAL: ResearchNodeView[];
  MILITARY: ResearchNodeView[];
  ECONOMIC: ResearchNodeView[];
  SOCIAL: ResearchNodeView[];
  clanLevel: number;
  researchPoints: number;
}

interface ClanResearchPanelProps {
  clanId: string;
  currentUserRole: ClanRole;
  onRefresh: () => void;
}

/** Server re-gates at unlock time; this is display-only. */
const UNLOCK_ROLES: ClanRole[] = [ClanRole.LEADER, ClanRole.CO_LEADER, ClanRole.OFFICER];

export default function ClanResearchPanel({ currentUserRole, onRefresh }: ClanResearchPanelProps) {
  const [tree, setTree] = useState<ResearchTree | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/clan/research/state');
      const data = await res.json();
      if (data.success) setTree(data.tree);
      else showError(extractApiError(data, res.status));
    } catch (error) {
      console.error('Failed to fetch research state:', error);
      showError('Failed to load research tree');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const contribute = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showError('Enter a positive RP amount');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/clan/research/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsed }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(data.message ?? `Contributed ${parsed} RP`);
        setAmount('');
        await fetchState();
        onRefresh();
      } else {
        showError(extractApiError(data, res.status));
      }
    } catch (error) {
      showError('Error contributing research points');
      console.error('Error contributing RP:', error);
    } finally {
      setBusy(false);
    }
  };

  const unlock = async (researchId: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/clan/research/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchId }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(data.message ?? 'Research unlocked');
        await fetchState();
        onRefresh();
      } else {
        showError(extractApiError(data, res.status));
      }
    } catch (error) {
      showError('Error unlocking research');
      console.error('Error unlocking research:', error);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="nn-surface rounded-none p-4">
        <p className="nn-lab">Loading research tree…</p>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="nn-surface rounded-none p-4">
        <p className="nn-lab">Research tree unavailable</p>
      </div>
    );
  }

  // C1 honesty: single list from every branch array (only MILITARY has nodes
  // after the cut; any future node renders here without UI changes).
  const nodes: ResearchNodeView[] = [
    ...tree.MILITARY,
    ...tree.INDUSTRIAL,
    ...tree.ECONOMIC,
    ...tree.SOCIAL,
  ];

  const canAttemptUnlock = UNLOCK_ROLES.includes(currentUserRole);

  return (
    <div className="space-y-6">
      {/* Fund header */}
      <div className="nn-surface rounded-none p-4 border border-[color:var(--nn-glass-border)]">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="w-5 h-5 text-[color:var(--nn-violet)]" />
          <span className="text-lg font-bold text-[color:var(--nn-text-primary)]">Clan Research</span>
          <span className="ml-auto nn-num text-[color:var(--nn-green)]">
            Fund: {tree.researchPoints} RP
          </span>
        </div>
        <p className="nn-footnote">
          Contribute personal research points to the clan fund. Officers and above unlock
          nodes from the fund when level and prerequisite gates are met.
        </p>
        <div className="flex gap-2 mt-3">
          <input
            type="number"
            min="1"
            placeholder="RP amount…"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="nn-input flex-1"
          />
          <button onClick={contribute} disabled={busy} className="nn-abtn nn-abtn--violet">
            Contribute
          </button>
        </div>
      </div>

      {/* Node cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nodes.map((node) => {
          const state = node.unlocked
            ? 'unlocked'
            : node.available
              ? 'available'
              : 'locked';
          const accent =
            state === 'unlocked'
              ? 'var(--nn-green)'
              : state === 'available'
                ? 'var(--nn-cyan)'
                : 'var(--nn-text-tertiary)';
          return (
            <div
              key={node.id}
              className="nn-surface rounded-none p-4 border border-[color:var(--nn-glass-border)]"
              style={{ '--nn-accent': accent } as React.CSSProperties}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-[color:var(--nn-text-primary)]">{node.name}</span>
                <span
                  className="nn-chip ml-auto"
                  style={{ color: accent, borderColor: accent }}
                >
                  {state.toUpperCase()}
                </span>
              </div>
              <p className="nn-footnote">{node.description}</p>
              <div className="flex flex-col gap-1 mt-2" style={{ fontSize: 12 }}>
                <div className="flex justify-between">
                  <span className="nn-lab">Cost</span>
                  <span className="nn-num">{node.cost} RP</span>
                </div>
                <div className="flex justify-between">
                  <span className="nn-lab">Clan level required</span>
                  <span className="nn-num">{node.requiredLevel}</span>
                </div>
                {node.prerequisites.length > 0 && (
                  <div className="flex justify-between">
                    <span className="nn-lab">Prerequisites</span>
                    <span style={{ fontSize: 12 }}>{node.prerequisites.join(', ')}</span>
                  </div>
                )}
                {node.bonuses.map((b) => (
                  <div key={b.type} className="flex justify-between">
                    <span className="nn-lab">Bonus · {b.type}</span>
                    <span className="nn-num text-[color:var(--nn-green)]">+{b.value}</span>
                  </div>
                ))}
              </div>
              {state === 'available' && (
                <button
                  onClick={() => unlock(node.id)}
                  disabled={busy || !canAttemptUnlock}
                  title={
                    canAttemptUnlock
                      ? 'Unlock from the clan research fund'
                      : 'Only Leaders, Co-Leaders, and Officers can unlock research'
                  }
                  className="nn-abtn nn-abtn--cyan w-full mt-3"
                >
                  {canAttemptUnlock ? 'Unlock' : 'Unlock (officer+)'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {nodes.length === 0 && (
        <div className="text-center py-12">
          <p className="nn-lab">No research nodes defined</p>
        </div>
      )}
    </div>
  );
}
