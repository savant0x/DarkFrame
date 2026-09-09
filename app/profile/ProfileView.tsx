/**
 * @file app/profile/ProfileView.tsx
 * @created 2025-10-18
 * @updated 2026-09-08 (FID-20260908-015: NEON NOIR redesign — nn-surface shell + nn-panel
 *   scanline sections, nn-stat instruments, nn-well cells, nn-chip pills, nn-btn actions,
 *   nn-note status banners; gradient slabs + pills removed; chrome emoji dropped from headers.
 *   SUBSTANTIVE FIX: Base Defenses "breached" rendered baseDefenses.won — now reads .lost,
 *   matching the BattleStatistics contract. Profile/greeting fetch+save logic byte-preserved.)
 * @overview Private player profile page with stats, base greeting editor, and achievements
 *
 * OVERVIEW:
 * Personal profile page (not public) for viewing own stats and editing base description.
 * Includes WYSIWYG-style editor for base greeting with formatting but no raw HTML.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { RichTextEditor } from '@/components/ui';
import { SafeHtmlRenderer } from '@/components/SafeHtmlRenderer';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ProfilePageProps {
  embedded?: boolean; // When true, renders without standalone page wrapper
}

interface ProfileData {
  username: string;
  level: number;
  rank: number;
  resources: {
    metal: number;
    energy: number;
  };
  base: {
    x: number;
    y: number;
    greeting?: string;
  };
  battleStats?: {
    infantryAttacks: { initiated: number; won: number; lost: number };
    baseAttacks: { initiated: number; won: number; lost: number };
    baseDefenses: { total: number; won: number; lost: number };
  };
  achievements?: Array<{
    id: string;
    name: string;
    description: string;
    unlockedAt: string;
  }>;
  referralStats?: {
    totalReferrals: number;
    validatedReferrals: number;
    badges: string[];
    titles: string[];
    nextMilestone: number | null;
  };
  joinedAt: string;
}

export default function ProfilePage({ embedded = false }: ProfilePageProps) {
  void embedded; // Rendered as a tab inside app/game; standalone wrapper intentionally identical.
  const { player } = useGameContext();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [baseGreeting, setBaseGreeting] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load profile data
  useEffect(() => {
    if (!player) return;

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/player/profile');
        const data = await response.json();

        if (data.success) {
          setProfileData(data.data);
          setBaseGreeting(data.data.base.greeting || '');
        } else {
          setError(data.error || 'Failed to load profile');
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile data');
      }
    };

    loadProfile();
  }, [player]);

  // Save base greeting
  const handleSaveGreeting = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/player/greeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ greeting: baseGreeting })
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Base greeting updated!');
        setIsEditing(false);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(data.error || 'Failed to save greeting');
      }
    } catch (err) {
      console.error('Error saving greeting:', err);
      setError('Failed to save greeting');
    } finally {
      setIsSaving(false);
    }
  };

  // No formatting helpers needed - RichTextEditor handles it all

  if (!player) {
    return (
      <div className="nn-surface h-full overflow-hidden flex items-center justify-center p-8">
        <Loader2 className="nn-spin-icon w-7 h-7 text-[color:var(--nn-cyan)]" aria-label="Loading profile" />
        <p className="nn-text-secondary ml-3">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="nn-surface h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="nn-panel__header flex-shrink-0">
        <span className="nn-panel__title">Your Profile</span>
        <span className="nn-panel__meta">Commander Record</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="nn-note mb-6" role="alert">
            <p className="nn-text-magenta">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="nn-note mb-6" role="status">
            <p className="nn-text-green">{successMessage}</p>
          </div>
        )}

        {profileData && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Basic Info */}
            <div className="nn-panel">
              <div className="nn-panel__header">
                <span className="nn-panel__title">Commander Info</span>
                <span className="nn-panel__meta">{profileData.username}</span>
              </div>
              <div className="nn-panel__body nn-panel__body--padded">
                <div className="grid grid-cols-2 gap-4">
                  <div className="nn-stat">
                    <div className="nn-stat__lab">Username</div>
                    <div className="nn-stat__num">{profileData.username}</div>
                  </div>
                  <div className="nn-stat">
                    <div className="nn-stat__lab">Level</div>
                    <div className="nn-stat__num nn-stat__num--glow-amber">{profileData.level}</div>
                  </div>
                  <div className="nn-stat">
                    <div className="nn-stat__lab">Base Location</div>
                    <div className="nn-stat__num nn-stat__num--glow-green">
                      ({profileData.base.x}, {profileData.base.y})
                    </div>
                  </div>
                  <div className="nn-stat">
                    <div className="nn-stat__lab">Rank</div>
                    <div className="nn-stat__num nn-stat__num--glow-violet">{profileData.rank}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Referral Stats */}
            {profileData.referralStats && (
              <div className="nn-panel nn-panel--violet">
                <div className="nn-panel__header">
                  <span className="nn-panel__title">Referral Program</span>
                  <Link href="/referrals" className="nn-btn nn-btn--primary ml-auto text-sm">
                    View Dashboard →
                  </Link>
                </div>
                <div className="nn-panel__body nn-panel__body--padded">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="nn-well flex-col">
                      <div className="nn-num nn-stat__num--glow-cyan text-2xl font-bold">
                        {profileData.referralStats.totalReferrals}
                      </div>
                      <div className="nn-stat__lab mt-1">Total Referrals</div>
                    </div>
                    <div className="nn-well flex-col">
                      <div className="nn-num nn-stat__num--glow-green text-2xl font-bold">
                        {profileData.referralStats.validatedReferrals}
                      </div>
                      <div className="nn-stat__lab mt-1">Validated</div>
                    </div>
                    <div className="nn-well flex-col">
                      <div className="nn-num nn-stat__num--glow-amber text-2xl font-bold">
                        {profileData.referralStats.badges.length}
                      </div>
                      <div className="nn-stat__lab mt-1">Badges</div>
                    </div>
                    <div className="nn-well flex-col">
                      <div className="nn-num nn-stat__num--glow-violet text-2xl font-bold">
                        {profileData.referralStats.nextMilestone ?? '—'}
                      </div>
                      <div className="nn-stat__lab mt-1">Next Milestone</div>
                    </div>
                  </div>

                  {/* Badges & Titles */}
                  {(profileData.referralStats.badges.length > 0 || profileData.referralStats.titles.length > 0) && (
                    <div className="nn-well flex-col items-stretch mb-4">
                      {profileData.referralStats.titles.length > 0 && (
                        <div className="mb-3">
                          <p className="nn-footnote mb-2">Titles:</p>
                          <div className="flex flex-wrap gap-2">
                            {profileData.referralStats.titles.map((title, index) => (
                              <span key={index} className="nn-chip nn-chip--violet">
                                {title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {profileData.referralStats.badges.length > 0 && (
                        <div>
                          <p className="nn-footnote mb-2">Badges:</p>
                          <div className="flex flex-wrap gap-2">
                            {profileData.referralStats.badges.map((badge, index) => (
                              <span key={index} className="nn-chip nn-chip--amber">
                                {badge.replace('_recruiter', '').toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CTA if no referrals yet */}
                  {profileData.referralStats.totalReferrals === 0 && (
                    <div className="nn-brief nn-brief--violet text-center">
                      <div className="flex-1">
                        <p className="nn-text-violet mb-2">
                          Start inviting friends to earn exclusive rewards, resources, and prestige!
                        </p>
                        <Link href="/referrals" className="nn-btn nn-btn--primary px-6">
                          Get Started →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resources */}
            <div className="nn-panel">
              <div className="nn-panel__header">
                <span className="nn-panel__title">Resources</span>
                <span className="nn-panel__meta">Current Stockpile</span>
              </div>
              <div className="nn-panel__body nn-panel__body--padded">
                <div className="grid grid-cols-2 gap-4">
                  <div className="nn-well flex-col">
                    <div className="nn-footnote">⚙️ Metal</div>
                    <div className="nn-num nn-stat__num--glow-cyan text-2xl font-bold">
                      {profileData.resources.metal.toLocaleString()}
                    </div>
                  </div>
                  <div className="nn-well flex-col">
                    <div className="nn-footnote">⚡ Energy</div>
                    <div className="nn-num nn-stat__num--glow-amber text-2xl font-bold">
                      {profileData.resources.energy.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Base Greeting Editor */}
            <div className="nn-panel">
              <div className="nn-panel__header">
                <span className="nn-panel__title">Base Greeting</span>
                {!isEditing && (
                  <button onClick={() => setIsEditing(true)} className="nn-btn ml-auto text-sm">
                    Edit
                  </button>
                )}
              </div>
              <div className="nn-panel__body nn-panel__body--padded">
                <p className="nn-footnote mb-4">
                  This message will be shown to other players when they visit your base.
                </p>

                {isEditing ? (
                  <div className="space-y-4">
                    {/* Rich Text Editor */}
                    <RichTextEditor
                      value={baseGreeting}
                      onChange={setBaseGreeting}
                      maxLength={500}
                      placeholder="Welcome to my base! Describe your headquarters..."
                      minHeight="200px"
                    />

                    {/* Preview */}
                    <div className="nn-well flex-col items-stretch">
                      <p className="nn-footnote mb-2">Preview:</p>
                      <SafeHtmlRenderer
                        html={baseGreeting}
                        fallback="Your greeting will appear here..."
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveGreeting}
                        disabled={isSaving}
                        className="nn-btn nn-btn--primary"
                      >
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setBaseGreeting(profileData.base.greeting || '');
                        }}
                        disabled={isSaving}
                        className="nn-btn nn-btn--ghost"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="nn-well flex-col items-stretch">
                    <SafeHtmlRenderer
                      html={profileData.base.greeting || ''}
                      fallback="No base greeting set. Click Edit to add one!"
                      className="text-[color:var(--nn-text-primary)]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Battle Stats */}
            {profileData.battleStats && (
              <div className="nn-panel">
                <div className="nn-panel__header">
                  <span className="nn-panel__title">Battle Statistics</span>
                  <span className="nn-panel__meta">Lifetime Combat Record</span>
                </div>
                <div className="nn-panel__body nn-panel__body--padded">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="nn-well flex-col items-stretch">
                      <div className="nn-stat__lab mb-2">Infantry Battles</div>
                      <p className="nn-num font-bold text-[color:var(--nn-text-primary)]">
                        {profileData.battleStats.infantryAttacks.initiated} initiated
                      </p>
                      <p className="nn-footnote nn-text-green">
                        {profileData.battleStats.infantryAttacks.won} won
                      </p>
                      <p className="nn-footnote nn-text-magenta">
                        {profileData.battleStats.infantryAttacks.lost} lost
                      </p>
                    </div>
                    <div className="nn-well flex-col items-stretch">
                      <div className="nn-stat__lab mb-2">Base Attacks</div>
                      <p className="nn-num font-bold text-[color:var(--nn-text-primary)]">
                        {profileData.battleStats.baseAttacks.initiated} initiated
                      </p>
                      <p className="nn-footnote nn-text-green">
                        {profileData.battleStats.baseAttacks.won} won
                      </p>
                      <p className="nn-footnote nn-text-magenta">
                        {profileData.battleStats.baseAttacks.lost} lost
                      </p>
                    </div>
                    <div className="nn-well flex-col items-stretch">
                      <div className="nn-stat__lab mb-2">Base Defenses</div>
                      <p className="nn-num font-bold text-[color:var(--nn-text-primary)]">
                        {profileData.battleStats.baseDefenses.total} total
                      </p>
                      <p className="nn-footnote nn-text-green">
                        {profileData.battleStats.baseDefenses.won} defended
                      </p>
                      {/* FID-20260908-015 FIX: was .won (both rows identical) — breached is .lost */}
                      <p className="nn-footnote nn-text-magenta">
                        {profileData.battleStats.baseDefenses.lost} breached
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Private profile page (not public, no [username] route)
// - WYSIWYG-style editor with markdown-like formatting
// - **text** for bold, *text* for italic, __text__ for underline
// - 500 character limit on base greeting
// - Real-time preview of formatted text
// - Backend API needed: /api/player/profile (GET) and /api/player/greeting (POST)
// ============================================================
