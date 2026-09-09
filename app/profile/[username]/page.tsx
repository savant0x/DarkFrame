'use client';

/**
 * @file app/profile/[username]/page.tsx
 * @created 2026-09-06
 * @updated 2026-09-08 (FID-20260908-015: NEON NOIR redesign — var(--nn-void) shell, nn-panel
 *   scanline sections, nn-stat quartet, nn-brief--amber bot banner, nn-chip--amber VIP pill,
 *   nn-btn actions; glass slabs removed. Fetch/routing logic byte-preserved.)
 * @overview Public player profile page (FID-20260906-008 R2).
 *
 * Destination for the Flag Tracker's Track action ("view Flag Bearer's
 * profile") and any future profile-link surface. Renders the PublicProfile
 * contract served by GET /api/profile/:username.
 *
 * States: loading / not-found (404) / self-view shortcut / bot-identity
 * banner ("Autonomous rogue unit — not a player").
 */

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AchievementRecord, BattleStatistics } from '@/types/game.types';

interface PublicProfile {
  username: string;
  level: number;
  xp: number;
  rank: number;
  isBot: boolean;
  isAdmin: boolean;
  vip: boolean;
  clanId: string | null;
  clanName: string | null;
  base: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
  totalStrength: number;
  totalDefense: number;
  battleStats: BattleStatistics | null;
  achievements: AchievementRecord[];
  createdAt: string | null;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'ready'; profile: PublicProfile };

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = typeof params?.username === 'string' ? params.username : '';
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (!username) {
      setState({ status: 'not-found' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });

    fetch(`/api/profile/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setState({ status: 'not-found' });
          return null;
        }
        return res.json();
      })
      .then((data: { success: boolean; profile?: PublicProfile } | null) => {
        if (cancelled || !data) return;
        if (data.success && data.profile) {
          setState({ status: 'ready', profile: data.profile });
        } else {
          setState({ status: 'not-found' });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'not-found' });
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (state.status === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--nn-void)' }}
      >
        <Loader2
          className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]"
          aria-label="Loading profile"
        />
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--nn-void)' }}
      >
        <div className="nn-panel nn-panel--magenta text-center max-w-md">
          <div className="nn-panel__header">
            <span className="nn-panel__title">Signal Lost</span>
            <span className="nn-panel__meta">404 ▸ No Record</span>
          </div>
          <div className="nn-panel__body nn-panel__body--padded">
            <p className="text-4xl mb-4">🛰️</p>
            <p className="nn-text-secondary mb-6">
              No operator profile found for{' '}
              <span className="text-[color:var(--nn-text-primary)] font-semibold">{username}</span>.
            </p>
            <button onClick={() => router.push('/game')} className="nn-btn nn-btn--primary px-5 py-2">
              Back to Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { profile } = state;
  const isSelf = false; // Session identity is not linked client-side yet; self-view uses the nav Profile button.

  return (
    <div
      className="min-h-screen py-10 px-4 text-[color:var(--nn-text-primary)]"
      style={{ background: 'var(--nn-void)' }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="nn-panel">
          <div className="nn-panel__header">
            <span className="nn-panel__title">Operator Dossier</span>
            <span className="nn-panel__meta">Public Record</span>
          </div>
          <div className="nn-panel__body nn-panel__body--padded">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="nn-num text-3xl font-bold text-[color:var(--nn-text-primary)]">
                    {profile.username}
                  </h1>
                  {profile.vip && <span className="nn-chip nn-chip--amber">VIP</span>}
                </div>
                <p className="nn-text-secondary mt-1">
                  Level {profile.level} · Rank {profile.rank}
                  {profile.clanName ? ` · ${profile.clanName}` : ''}
                </p>
              </div>
              <button onClick={() => router.push('/game')} className="nn-btn nn-btn--ghost text-sm">
                ← Back to Game
              </button>
            </div>

            {/* Bot identity banner — in-game fiction: bots are rogue machines, not players. */}
            {profile.isBot && (
              <div className="nn-brief nn-brief--amber mt-4">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="nn-text-amber font-semibold text-sm">
                    Autonomous rogue unit — not a player
                  </p>
                  <p className="nn-text-amber text-xs">
                    This entity is an AI-controlled war machine tracked by the Bot Scanner.
                  </p>
                </div>
              </div>
            )}

            {!profile.isBot && isSelf && (
              <p className="mt-3 nn-text-cyan text-sm">
                This is you — manage your profile from the nav.
              </p>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Level" value={profile.level} glow="amber" />
          <StatCard label="XP" value={profile.xp.toLocaleString()} glow="cyan" />
          <StatCard label="Total STR" value={profile.totalStrength.toLocaleString()} glow="green" />
          <StatCard label="Total DEF" value={profile.totalDefense.toLocaleString()} glow="violet" />
        </div>

        {/* Location */}
        <Section title="Last Known Position" meta="Sector Telemetry">
          {profile.currentPosition ? (
            <p className="nn-num text-[color:var(--nn-text-primary)]">
              Sector ({profile.currentPosition.x}, {profile.currentPosition.y})
              {profile.base && (
                <span className="nn-text-secondary">
                  {' '}
                  · Base at ({profile.base.x}, {profile.base.y})
                </span>
              )}
            </p>
          ) : (
            <p className="nn-text-secondary">Position data unavailable.</p>
          )}
        </Section>

        {/* Combat record */}
        {profile.battleStats ? (
          <Section title="Combat Record" meta="Raw Ledger">
            <div className="nn-well flex-col items-stretch">
              <pre className="text-xs nn-text-secondary whitespace-pre-wrap font-mono">
                {JSON.stringify(profile.battleStats, null, 2)}
              </pre>
            </div>
          </Section>
        ) : null}

        {/* Achievements */}
        <Section title="Achievements" meta="Service Record">
          <p className="nn-num text-[color:var(--nn-text-primary)]">
            {Array.isArray(profile.achievements) ? profile.achievements.length : 0} unlocked
          </p>
        </Section>

        {/* Enlisted */}
        {profile.createdAt && (
          <p className="nn-footnote text-center">
            Enlisted {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  glow,
}: {
  label: string;
  value: string | number;
  glow: 'cyan' | 'amber' | 'green' | 'violet';
}) {
  return (
    <div className="nn-stat">
      <div className="nn-stat__lab">{label}</div>
      <div className={`nn-stat__num nn-stat__num--glow-${glow}`}>{value}</div>
    </div>
  );
}

function Section({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div className="nn-panel">
      <div className="nn-panel__header">
        <span className="nn-panel__title">{title}</span>
        <span className="nn-panel__meta">{meta}</span>
      </div>
      <div className="nn-panel__body nn-panel__body--padded">{children}</div>
    </div>
  );
}
