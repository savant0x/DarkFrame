'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import BackButton from '@/components/BackButton';
import { RichTextEditor } from '@/components/ui';
import { SafeHtmlRenderer } from '@/components/SafeHtmlRenderer';
import Link from 'next/link';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

interface ProfilePageProps {
  embedded?: boolean;
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

  useEffect(() => {
    if (!player) return;

    const loadProfile = async () => {
      try {
        const response = await fetch(`/api/player/profile?username=${encodeURIComponent(player.username)}`);
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

  if (!player) {
    return (
      <div className="bg-[--card] rounded-lg shadow-2xl h-full overflow-hidden flex items-center justify-center p-8">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const renderProfileContent = () => (
    <div className="bg-[--card] rounded-lg shadow-2xl h-full overflow-hidden flex flex-col">
      <div className="bg-[--void] border-b border-[--border] p-6 flex-shrink-0">
        <h1 className="text-4xl font-bold text-[--electric]">👤 Your Profile</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="bg-[--neon-red]/10 border border-[--neon-red]/20 rounded-lg p-4 mb-6">
            <p className="text-[--neon-red]">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-[--synth]/10 border border-[--synth]/20 rounded-lg p-4 mb-6">
            <p className="text-[--synth]">{successMessage}</p>
          </div>
        )}

        {profileData && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
              <h2 className="text-2xl font-bold text-[--electric] mb-4">Commander Info</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60">Username</p>
                  <p className="text-xl font-bold text-white">{profileData.username}</p>
                </div>
                <div>
                  <p className="text-white/60">Level</p>
                  <p className="text-xl font-bold text-[--neon-yellow]">{profileData.level}</p>
                </div>
                <div>
                  <p className="text-white/60">Base Location</p>
                  <p className="text-xl font-bold text-[--synth]">({profileData.base.x}, {profileData.base.y})</p>
                </div>
                <div>
                  <p className="text-white/60">Rank</p>
                  <p className="text-xl font-bold text-[--neon-pink]">{profileData.rank}</p>
                </div>
              </div>
            </div>

            {profileData.referralStats && (
              <div className="bg-[--neon-pink]/5 border-2 border-[--neon-pink]/20 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-[--neon-pink]">🎁 Referral Program</h2>
                  <Link
                    href="/referrals"
                    className="bg-[--neon-pink] hover:opacity-80 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                  >
                    View Dashboard →
                  </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/60 text-sm">Total Referrals</p>
                    <p className="text-2xl font-bold text-[--electric]">{profileData.referralStats.totalReferrals}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/60 text-sm">Validated</p>
                    <p className="text-2xl font-bold text-[--synth]">{profileData.referralStats.validatedReferrals}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/60 text-sm">Badges</p>
                    <p className="text-2xl font-bold text-[--neon-yellow]">{profileData.referralStats.badges.length}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/60 text-sm">Next Milestone</p>
                    <p className="text-2xl font-bold text-[--neon-pink]">
                      {profileData.referralStats.nextMilestone ?? '—'}
                    </p>
                  </div>
                </div>

                {(profileData.referralStats.badges.length > 0 || profileData.referralStats.titles.length > 0) && (
                  <div className="bg-[--card] p-4 rounded-lg">
                    {profileData.referralStats.titles.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-white/60 mb-2">Titles:</p>
                        <div className="flex flex-wrap gap-2">
                          {profileData.referralStats.titles.map((title, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-[--neon-pink]/15 text-[--neon-pink] rounded-full text-sm font-semibold"
                            >
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {profileData.referralStats.badges.length > 0 && (
                      <div>
                        <p className="text-sm text-white/60 mb-2">Badges:</p>
                        <div className="flex flex-wrap gap-2">
                          {profileData.referralStats.badges.map((badge, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-[--solar]/15 text-[--solar] rounded-full text-sm font-semibold"
                            >
                              {badge.replace('_recruiter', '').toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {profileData.referralStats.totalReferrals === 0 && (
                  <div className="bg-[--neon-pink]/10 border border-[--neon-pink]/20 rounded-lg p-4 text-center">
                    <p className="text-[--neon-pink] mb-2">
                      Start inviting friends to earn exclusive rewards, resources, and prestige!
                    </p>
                    <Link
                      href="/referrals"
                      className="inline-block bg-[--neon-pink] hover:opacity-80 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Get Started →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
              <h2 className="text-2xl font-bold text-[--electric] mb-4">Resources</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[--void] p-4 rounded-lg">
                  <p className="text-white/60">⚙️ Metal</p>
                  <p className="text-2xl font-bold text-[--electric]">{profileData.resources.metal.toLocaleString()}</p>
                </div>
                <div className="bg-[--void] p-4 rounded-lg">
                  <p className="text-white/60">⚡ Energy</p>
                  <p className="text-2xl font-bold text-[--neon-yellow]">{profileData.resources.energy.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-[--electric]">🏠 Base Greeting</h2>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-[--electric] hover:opacity-80 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>

              <p className="text-sm text-white/60 mb-4">
                This message will be shown to other players when they visit your base.
              </p>

              {isEditing ? (
                <div className="space-y-4">
                  <RichTextEditor
                    value={baseGreeting}
                    onChange={setBaseGreeting}
                    maxLength={500}
                    placeholder="Welcome to my base! Describe your headquarters..."
                    minHeight="200px"
                  />

                  <div className="bg-[--void] border border-[--border] rounded-lg p-4">
                    <p className="text-sm text-white/60 mb-2">Preview:</p>
                    <SafeHtmlRenderer
                      html={baseGreeting}
                      fallback="Your greeting will appear here..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveGreeting}
                      disabled={isSaving}
                      className="bg-[--synth] hover:opacity-80 disabled:bg-[--card] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      {isSaving ? 'Saving...' : '💾 Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setBaseGreeting(profileData.base.greeting || '');
                      }}
                      disabled={isSaving}
                      className="bg-[--card] hover:opacity-80 disabled:bg-[--border] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[--void] border border-[--border] rounded-lg p-4">
                  <SafeHtmlRenderer
                    html={profileData.base.greeting || ''}
                    fallback="No base greeting set. Click Edit to add one!"
                    className="text-white"
                  />
                </div>
              )}
            </div>

            {profileData.battleStats && (
              <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
                <h2 className="text-2xl font-bold text-[--electric] mb-4">⚔️ Battle Statistics</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[--void] p-4 rounded-lg">
                    <p className="text-white/60 text-sm">Infantry Battles</p>
                    <p className="text-lg font-bold text-white">
                      {profileData.battleStats.infantryAttacks.initiated} initiated
                    </p>
                    <p className="text-sm text-[--synth]">
                      {profileData.battleStats.infantryAttacks.won} won
                    </p>
                    <p className="text-sm text-[--neon-red]">
                      {profileData.battleStats.infantryAttacks.lost} lost
                    </p>
                  </div>
                  <div className="bg-[--void] p-4 rounded-lg">
                    <p className="text-white/60 text-sm">Base Attacks</p>
                    <p className="text-lg font-bold text-white">
                      {profileData.battleStats.baseAttacks.initiated} initiated
                    </p>
                    <p className="text-sm text-[--synth]">
                      {profileData.battleStats.baseAttacks.won} won
                    </p>
                    <p className="text-sm text-[--neon-red]">
                      {profileData.battleStats.baseAttacks.lost} lost
                    </p>
                  </div>
                  <div className="bg-[--void] p-4 rounded-lg">
                    <p className="text-white/60 text-sm">Base Defenses</p>
                    <p className="text-lg font-bold text-white">
                      {profileData.battleStats.baseDefenses.total} total
                    </p>
                    <p className="text-sm text-[--synth]">
                      {profileData.battleStats.baseDefenses.won} defended
                    </p>
                    <p className="text-sm text-[--neon-red]">
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

  if (embedded) {
    return renderProfileContent();
  }

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void]">
            {renderProfileContent()}
          </div>
        }
      />
    </>
  );
}
