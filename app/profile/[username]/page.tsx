'use client';

/**
 * @file app/profile/[username]/page.tsx
 * @created 2026-09-06
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
  battleStats: unknown;
  achievements: unknown;
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
      <div className="min-h-screen bg-glass-dark flex items-center justify-center">
        <p className="text-white text-lg">Loading profile…</p>
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="min-h-screen bg-glass-dark flex items-center justify-center">
        <div className="text-center bg-glass-light rounded-lg p-10 border border-glass-border max-w-md">
          <p className="text-4xl mb-4">🛰️</p>
          <h1 className="text-2xl font-bold text-white mb-2">Signal lost</h1>
          <p className="text-text-secondary mb-6">
            No operator profile found for <span className="text-white font-semibold">{username}</span>.
          </p>
          <button
            onClick={() => router.push('/game')}
            className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors"
          >
            Back to Game
          </button>
        </div>
      </div>
    );
  }

  const { profile } = state;
  const isSelf = false; // Session identity is not linked client-side yet; self-view uses the nav Profile button.

  return (
    <div className="min-h-screen bg-glass-dark py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-glass-light rounded-lg p-6 border border-glass-border">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white">{profile.username}</h1>
                {profile.vip && (
                  <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                    VIP
                  </span>
                )}
              </div>
              <p className="text-text-secondary mt-1">
                Level {profile.level} · Rank {profile.rank}
                {profile.clanName ? ` · ${profile.clanName}` : ''}
              </p>
            </div>
            <button
              onClick={() => router.push('/game')}
              className="px-4 py-2 rounded-lg bg-glass-dark border border-glass-border text-text-secondary hover:text-white text-sm transition-colors"
            >
              ← Back to Game
            </button>
          </div>

          {/* Bot identity banner — in-game fiction: bots are rogue machines, not players. */}
          {profile.isBot && (
            <div className="mt-4 bg-orange-900/30 border border-orange-500/40 rounded-lg p-3 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-orange-300 font-semibold text-sm">
                  Autonomous rogue unit — not a player
                </p>
                <p className="text-orange-400/70 text-xs">
                  This entity is an AI-controlled war machine tracked by the Bot Scanner.
                </p>
              </div>
            </div>
          )}

          {!profile.isBot && isSelf && (
            <p className="mt-3 text-cyan-400 text-sm">This is you — manage your profile from the nav.</p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Level" value={profile.level} />
          <StatCard label="XP" value={profile.xp.toLocaleString()} />
          <StatCard label="Total STR" value={profile.totalStrength.toLocaleString()} />
          <StatCard label="Total DEF" value={profile.totalDefense.toLocaleString()} />
        </div>

        {/* Location */}
        <Section title="Last Known Position">
          {profile.currentPosition ? (
            <p className="text-white">
              Sector ({profile.currentPosition.x}, {profile.currentPosition.y})
              {profile.base && (
                <span className="text-text-secondary">
                  {' '}
                  · Base at ({profile.base.x}, {profile.base.y})
                </span>
              )}
            </p>
          ) : (
            <p className="text-text-secondary">Position data unavailable.</p>
          )}
        </Section>

        {/* Combat record */}
        {profile.battleStats ? (
          <Section title="Combat Record">
            <pre className="text-xs text-text-secondary whitespace-pre-wrap">
              {JSON.stringify(profile.battleStats, null, 2)}
            </pre>
          </Section>
        ) : null}

        {/* Achievements */}
        <Section title="Achievements">
          <p className="text-white">{Array.isArray(profile.achievements) ? profile.achievements.length : 0} unlocked</p>
        </Section>

        {/* Enlisted */}
        {profile.createdAt && (
          <p className="text-text-tertiary text-xs text-center">
            Enlisted {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-glass-light rounded-lg p-4 border border-glass-border">
      <div className="text-xs text-text-secondary mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-glass-light rounded-lg p-6 border border-glass-border">
      <h2 className="text-sm font-semibold text-cyan-400 mb-3">{title}</h2>
      {children}
    </div>
  );
}
