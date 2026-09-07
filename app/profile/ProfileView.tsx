/**
 * @file app/profile/page.tsx
 * @created 2025-10-18
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
      <div className="bg-glass-light rounded-none shadow-2xl h-full overflow-hidden flex items-center justify-center p-8">
        <p className="text-[color:var(--nn-text-primary)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-glass-light rounded-none shadow-2xl h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-glass-dark border-b border-glass-border p-6 flex-shrink-0">
        <h1 className="text-4xl font-bold text-[color:var(--nn-cyan)]">👤 Your Profile</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4 mb-6">
            <p className="text-[color:var(--nn-magenta)]">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-4 mb-6">
            <p className="text-[color:var(--nn-green)]">{successMessage}</p>
          </div>
        )}

        {profileData && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Basic Info */}
            <div className="bg-glass-light rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
              <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)] mb-4">Commander Info</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-text-secondary">Username</p>
                  <p className="text-xl font-bold text-[color:var(--nn-text-primary)]">{profileData.username}</p>
                </div>
                <div>
                  <p className="text-text-secondary">Level</p>
                  <p className="text-xl font-bold text-[color:var(--nn-amber)]">{profileData.level}</p>
                </div>
                <div>
                  <p className="text-text-secondary">Base Location</p>
                  <p className="text-xl font-bold text-[color:var(--nn-green)]">({profileData.base.x}, {profileData.base.y})</p>
                </div>
                <div>
                  <p className="text-text-secondary">Rank</p>
                  <p className="text-xl font-bold text-[color:var(--nn-violet)]">{profileData.rank}</p>
                </div>
              </div>
            </div>

            {/* Referral Stats */}
            {profileData.referralStats && (
              <div className="bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-magenta)] border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-[color:var(--nn-violet)]">🎁 Referral Program</h2>
                  <Link 
                    href="/referrals"
                    className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold transition-colors text-sm"
                  >
                    View Dashboard →
                  </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-glass-dark p-4 rounded-none">
                    <p className="text-text-secondary text-sm">Total Referrals</p>
                    <p className="text-2xl font-bold text-[color:var(--nn-cyan)]">{profileData.referralStats.totalReferrals}</p>
                  </div>
                  <div className="bg-glass-dark p-4 rounded-none">
                    <p className="text-text-secondary text-sm">Validated</p>
                    <p className="text-2xl font-bold text-[color:var(--nn-green)]">{profileData.referralStats.validatedReferrals}</p>
                  </div>
                  <div className="bg-glass-dark p-4 rounded-none">
                    <p className="text-text-secondary text-sm">Badges</p>
                    <p className="text-2xl font-bold text-[color:var(--nn-amber)]">{profileData.referralStats.badges.length}</p>
                  </div>
                  <div className="bg-glass-dark p-4 rounded-none">
                    <p className="text-text-secondary text-sm">Next Milestone</p>
                    <p className="text-2xl font-bold text-[color:var(--nn-violet)]">
                      {profileData.referralStats.nextMilestone ?? '—'}
                    </p>
                  </div>
                </div>

                {/* Badges & Titles */}
                {(profileData.referralStats.badges.length > 0 || profileData.referralStats.titles.length > 0) && (
                  <div className="bg-glass-dark p-4 rounded-none">
                    {profileData.referralStats.titles.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-text-secondary mb-2">Titles:</p>
                        <div className="flex flex-wrap gap-2">
                          {profileData.referralStats.titles.map((title, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-gradient-to-r from-[color:var(--nn-violet)] to-[color:var(--nn-magenta)] text-[color:var(--nn-text-primary)] rounded-full text-sm font-semibold"
                            >
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {profileData.referralStats.badges.length > 0 && (
                      <div>
                        <p className="text-sm text-text-secondary mb-2">Badges:</p>
                        <div className="flex flex-wrap gap-2">
                          {profileData.referralStats.badges.map((badge, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-gradient-to-r from-[color:var(--nn-amber)] to-[color:var(--nn-amber)] text-[color:var(--nn-text-primary)] rounded-full text-sm font-semibold"
                            >
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
                  <div className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-4 text-center">
                    <p className="text-[color:var(--nn-violet)] mb-2">
                      Start inviting friends to earn exclusive rewards, resources, and prestige!
                    </p>
                    <Link 
                      href="/referrals"
                      className="inline-block bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] px-6 py-2 rounded-none font-semibold transition-colors"
                    >
                      Get Started →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Resources */}
            <div className="bg-glass-light rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
              <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)] mb-4">Resources</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-glass-dark p-4 rounded-none">
                  <p className="text-text-secondary">⚙️ Metal</p>
                  <p className="text-2xl font-bold text-[color:var(--nn-cyan)]">{profileData.resources.metal.toLocaleString()}</p>
                </div>
                <div className="bg-glass-dark p-4 rounded-none">
                  <p className="text-text-secondary">⚡ Energy</p>
                  <p className="text-2xl font-bold text-[color:var(--nn-amber)]">{profileData.resources.energy.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Base Greeting Editor */}
            <div className="bg-glass-light rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)]">🏠 Base Greeting</h2>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold transition-colors"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>

              <p className="text-sm text-text-secondary mb-4">
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
                  <div className="bg-glass-dark border border-glass-border rounded-none p-4">
                    <p className="text-sm text-text-secondary mb-2">Preview:</p>
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
                      className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] disabled:bg-glass-light text-[color:var(--nn-text-primary)] px-6 py-2 rounded-none font-semibold transition-colors"
                    >
                      {isSaving ? 'Saving...' : '💾 Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setBaseGreeting(profileData.base.greeting || '');
                      }}
                      disabled={isSaving}
                      className="bg-glass-light hover:bg-bg-nebula disabled:bg-glass-light text-[color:var(--nn-text-primary)] px-6 py-2 rounded-none font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-glass-dark border border-glass-border rounded-none p-4">
                  <SafeHtmlRenderer 
                    html={profileData.base.greeting || ''}
                    fallback="No base greeting set. Click Edit to add one!"
                    className="text-[color:var(--nn-text-primary)]"
                  />
                </div>
              )}
            </div>

            {/* Battle Stats */}
            {profileData.battleStats && (
              <div className="bg-glass-light rounded-none p-6 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
                <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)] mb-4">⚔️ Battle Statistics</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-glass-dark p-4 rounded-none">
                    <p className="text-text-secondary text-sm">Infantry Battles</p>
                    <p className="text-lg font-bold text-[color:var(--nn-text-primary)]">
                      {profileData.battleStats.infantryAttacks.initiated} initiated
                    </p>
                    <p className="text-sm text-[color:var(--nn-green)]">
                      {profileData.battleStats.infantryAttacks.won} won
                    </p>
                    <p className="text-sm text-[color:var(--nn-magenta)]">
                      {profileData.battleStats.infantryAttacks.lost} lost
                    </p>
                  </div>
                  <div className="bg-glass-dark p-4 rounded-none">
                    <p className="text-text-secondary text-sm">Base Attacks</p>
                    <p className="text-lg font-bold text-[color:var(--nn-text-primary)]">
                      {profileData.battleStats.baseAttacks.initiated} initiated
                    </p>
                    <p className="text-sm text-[color:var(--nn-green)]">
                      {profileData.battleStats.baseAttacks.won} won
                    </p>
                    <p className="text-sm text-[color:var(--nn-magenta)]">
                      {profileData.battleStats.baseAttacks.lost} lost
                    </p>
                  </div>
                  <div className="bg-glass-dark p-4 rounded-none">
                    <p className="text-text-secondary text-sm">Base Defenses</p>
                    <p className="text-lg font-bold text-[color:var(--nn-text-primary)]">
                      {profileData.battleStats.baseDefenses.total} total
                    </p>
                    <p className="text-sm text-[color:var(--nn-green)]">
                      {profileData.battleStats.baseDefenses.won} defended
                    </p>
                    <p className="text-sm text-[color:var(--nn-magenta)]">
                      {profileData.battleStats.baseDefenses.won} breached
                    </p>
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
