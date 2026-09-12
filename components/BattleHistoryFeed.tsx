/**
 * @file components/BattleHistoryFeed.tsx
 * @overview FID-20260911-045 — compact battle-history feed for the HUD's
 * bottom-left battle-logs slot (alongside BattleLogLinks).
 *
 * Consumes the slim summaries from GET /api/player/battle-history (headline +
 * meta parsed server-side; no message bodies on the wire). Outcome-tinted rows
 * in the NEON NOIR idiom: green VICTORY, magenta DEFEAT, amber DRAW.
 *
 * Egress/poll contract: 60s interval, paused while the tab is hidden, silent
 * on failure (an advisory background poll — same contract as TopNavBar's).
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';

interface BattleSummary {
  messageId: string;
  conversationId: string;
  battleId: string | null;
  battleType: string | null;
  location: { x: number; y: number } | null;
  outcome: 'VICTORY' | 'DEFEAT' | 'DRAW' | null;
  totalRounds: number | null;
  timestamp: string | null;
  reportedAt: string;
}

const OUTCOME_STYLE: Record<string, { color: string; glyph: string }> = {
  VICTORY: { color: 'var(--nn-green)', glyph: '🏆' },
  DEFEAT: { color: 'var(--nn-magenta)', glyph: '☠️' },
  DRAW: { color: 'var(--nn-amber)', glyph: '🤝' },
};

function shortAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function BattleHistoryFeed() {
  const { player } = useGameContext();
  const router = useRouter();
  const [battles, setBattles] = useState<BattleSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const visibleRef = useRef(true);

  useEffect(() => {
    const onVis = () => { visibleRef.current = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!player) return;

    let cancelled = false;
    const fetchFeed = async () => {
      if (!visibleRef.current) return; // pause polling while tab is hidden
      try {
        const res = await fetch('/api/player/battle-history?limit=8');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.data?.battles) {
          setBattles(data.data.battles);
          setLoaded(true);
        }
      } catch {
        // Advisory background poll — silent by design.
      }
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [player]);

  if (!player || (!loaded && battles.length === 0)) return null;
  if (battles.length === 0) return null;

  return (
    <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}>
      <div className="nn-panel__header">
        <h3 className="nn-panel__title">Recent Raids</h3>
      </div>
      <div className="nn-battlefeed" role="list" aria-label="Recent battle outcomes">
        {battles.map((b) => {
          const style = OUTCOME_STYLE[b.outcome ?? ''] ?? OUTCOME_STYLE.DRAW;          // battleIds have been observed to repeat across separate battles —
          // the message timestamp is the unique sort key.
          return (
            <button
              key={`${b.reportedAt}-${b.battleId ?? ''}`}
              type="button"
              className="nn-battlefeed__row nn-battlefeed__row--link"
              role="listitem"
              title="Open full battle report"
              aria-label={`Open battle report: ${b.outcome ?? 'Unknown'} ${b.battleType ?? 'battle'}${b.location ? ` at (${b.location.x}, ${b.location.y})` : ''}`}
              onClick={() =>
                router.push(
                  `/messages?open=${encodeURIComponent(b.messageId)}&conv=${encodeURIComponent(b.conversationId)}`,
                )
              }
            >
              <span className="nn-battlefeed__glyph" style={{ color: style.color }}>{style.glyph}</span>
              <span className="nn-battlefeed__where">
                {b.battleType ?? 'Battle'}
                {b.location ? ` (${b.location.x}, ${b.location.y})` : ''}
              </span>
              <span className="nn-battlefeed__result" style={{ color: style.color }}>
                {b.outcome ?? '—'}
              </span>
              <span className="nn-battlefeed__when">{shortAgo(b.reportedAt)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
