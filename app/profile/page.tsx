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
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import BackButton from '@/components/BackButton';
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

export default function ProfilePage({ embedded = false }: ProfilePageProps = {}) {
  const router = useRouter();
  const { player, refreshGameState } = useGameContext();
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
      <div className="bg-gray-800 rounded-lg shadow-2xl h-full overflow-hidden flex items-center justify-center p-8">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-6 flex-shrink-0">
        <h1 className="text-4xl font-bold text-cyan-400">👤 Your Profile</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-900/50 border border-green-600 rounded-lg p-4 mb-6">
            <p className="text-green-400">{successMessage}</p>
          </div>
        )}

        {profileData && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Basic Info */}
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-cyan-500/30">
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">Commander Info</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400">Username</p>
                  <p className="text-xl font-bold text-white">{profileData.username}</p>
                </div>
                <div>
                  <p className="text-gray-400">Level</p>
                  <p className="text-xl font-bold text-yellow-400">{profileData.level}</p>
                </div>
                <div>
                  <p className="text-gray-400">Base Location</p>
                  <p className="text-xl font-bold text-green-400">({profileData.base.x}, {profileData.base.y})</p>
                </div>
                <div>
                  <p className="text-gray-400">Rank</p>
                  <p className="text-xl font-bold text-purple-400">{profileData.rank}</p>
                </div>
              </div>
            </div>

            {/* Referral Stats */}
            {profileData.referralStats && (
              <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-2 border-purple-500/50 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-purple-400">🎁 Referral Program</h2>
                  <Link 
                    href="/referrals"
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    View Dashboard →
                  </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-900/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Total Referrals</p>
                    <p className="text-2xl font-bold text-cyan-400">{profileData.referralStats.totalReferrals}</p>
                  </div>
                  <div className="bg-gray-900/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Validated</p>
                    <p className="text-2xl font-bold text-green-400">{profileData.referralStats.validatedReferrals}</p>
                  </div>
                  <div className="bg-gray-900/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Badges</p>
                    <p className="text-2xl font-bold text-yellow-400">{profileData.referralStats.badges.length}</p>
                  </div>
                  <div className="bg-gray-900/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Next Milestone</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {profileData.referralStats.nextMilestone ?? '—'}
                    </p>
                  </div>
                </div>

                {/* Badges & Titles */}
                {(profileData.referralStats.badges.length > 0 || profileData.referralStats.titles.length > 0) && (
                  <div className="bg-gray-900/50 p-4 rounded-lg">
                    {profileData.referralStats.titles.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-400 mb-2">Titles:</p>
                        <div className="flex flex-wrap gap-2">
                          {profileData.referralStats.titles.map((title, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-semibold"
                            >
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {profileData.referralStats.badges.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Badges:</p>
                        <div className="flex flex-wrap gap-2">
                          {profileData.referralStats.badges.map((badge, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-full text-sm font-semibold"
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
                  <div className="bg-purple-800/30 border border-purple-500/50 rounded-lg p-4 text-center">
                    <p className="text-purple-300 mb-2">
                      Start inviting friends to earn exclusive rewards, resources, and prestige!
                    </p>
                    <Link 
                      href="/referrals"
                      className="inline-block bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Get Started →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Resources */}
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-cyan-500/30">
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">Resources</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 p-4 rounded-lg">
                  <p className="text-gray-400">⚙️ Metal</p>
                  <p className="text-2xl font-bold text-blue-400">{profileData.resources.metal.toLocaleString()}</p>
                </div>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <p className="text-gray-400">⚡ Energy</p>
                  <p className="text-2xl font-bold text-yellow-400">{profileData.resources.energy.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Base Greeting Editor */}
            <div className="bg-gray-800 rounded-lg p-6 border-2 border-cyan-500/30">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-cyan-400">🏠 Base Greeting</h2>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>

              <p className="text-sm text-gray-400 mb-4">
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
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-2">Preview:</p>
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
                      className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      {isSaving ? 'Saving...' : '💾 Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setBaseGreeting(profileData.base.greeting || '');
                      }}
                      disabled={isSaving}
                      className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <SafeHtmlRenderer 
                    html={profileData.base.greeting || ''}
                    fallback="No base greeting set. Click Edit to add one!"
                    className="text-white"
                  />
                </div>
              )}
            </div>

            {/* Battle Stats */}
            {profileData.battleStats && (
              <div className="bg-gray-800 rounded-lg p-6 border-2 border-cyan-500/30">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4">⚔️ Battle Statistics</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Infantry Battles</p>
                    <p className="text-lg font-bold text-white">
                      {profileData.battleStats.infantryAttacks.initiated} initiated
                    </p>
                    <p className="text-sm text-green-400">
                      {profileData.battleStats.infantryAttacks.won} won
                    </p>
                    <p className="text-sm text-red-400">
                      {profileData.battleStats.infantryAttacks.lost} lost
                    </p>
                  </div>
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Base Attacks</p>
                    <p className="text-lg font-bold text-white">
                      {profileData.battleStats.baseAttacks.initiated} initiated
                    </p>
                    <p className="text-sm text-green-400">
                      {profileData.battleStats.baseAttacks.won} won
                    </p>
                    <p className="text-sm text-red-400">
                      {profileData.battleStats.baseAttacks.lost} lost
                    </p>
                  </div>
                  <div className="bg-gray-900 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Base Defenses</p>
                    <p className="text-lg font-bold text-white">
                      {profileData.battleStats.baseDefenses.total} total
                    </p>
                    <p className="text-sm text-green-400">
                      {profileData.battleStats.baseDefenses.won} defended
                    </p>
                    <p className="text-sm text-red-400">
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
