'use client';

import { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { useRouter } from 'next/navigation';
import { showError, showSuccess } from '@/lib/toastService';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

interface ReferralRecord {
  _id: string;
  referrerUsername: string;
  referredUsername: string;
  referredEmail: string;
  referralCode: string;
  status: 'pending' | 'validated' | 'invalid';
  validationDetails: {
    loginCount: number;
    lastLogin?: string;
  };
  createdAt: string;
  validatedAt?: string;
  ipAddress?: string;
  flagged?: boolean;
  flagReason?: string;
  rewardsDistributed?: boolean;
}

interface AdminReferralsResponse {
  referrals: ReferralRecord[];
  total: number;
  stats: {
    totalReferrals: number;
    pendingReferrals: number;
    validatedReferrals: number;
    invalidReferrals: number;
    flaggedReferrals: number;
  };
}

type FilterStatus = 'all' | 'pending' | 'validated' | 'invalid' | 'flagged';

export default function AdminReferralsPage() {
  const { player } = useGameContext();
  const router = useRouter();

  const [data, setData] = useState<AdminReferralsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedReferral, setSelectedReferral] = useState<ReferralRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (!player || !player.isAdmin) {
      router.push('/game');
      return;
    }
  }, [player, router]);

  useEffect(() => {
    fetchReferrals();
  }, [filterStatus]);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/referrals?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result);
      } else {
        showError(result.message || 'Failed to load referrals');
      }
    } catch (error) {
      console.error('Error fetching referrals:', error);
      showError('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  const handleFlagToggle = async (referralId: string, flagged: boolean, reason?: string) => {
    try {
      const response = await fetch('/api/admin/referrals/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId, flagged, reason }),
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(flagged ? 'Referral flagged' : 'Flag removed');
        fetchReferrals();
      } else {
        showError(result.message || 'Failed to update flag');
      }
    } catch (error) {
      console.error('Error toggling flag:', error);
      showError('Failed to update flag');
    }
  };

  const handleManualValidation = async (referralId: string) => {
    if (!confirm('Manually validate this referral and distribute rewards?')) return;

    try {
      const response = await fetch('/api/admin/referrals/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId }),
      });

      const result = await response.json();

      if (result.success) {
        showSuccess('Referral validated and rewards distributed');
        fetchReferrals();
      } else {
        showError(result.message || 'Failed to validate referral');
      }
    } catch (error) {
      console.error('Error validating referral:', error);
      showError('Failed to validate referral');
    }
  };

  const handleInvalidate = async (referralId: string) => {
    if (!confirm('Mark this referral as invalid? This cannot be undone.')) return;

    try {
      const response = await fetch('/api/admin/referrals/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId }),
      });

      const result = await response.json();

      if (result.success) {
        showSuccess('Referral marked as invalid');
        fetchReferrals();
      } else {
        showError(result.message || 'Failed to invalidate referral');
      }
    } catch (error) {
      console.error('Error invalidating referral:', error);
      showError('Failed to invalidate referral');
    }
  };

  const getStatusBadge = (status: string, flagged?: boolean) => {
    if (flagged) {
      return <span className="px-2 py-1 bg-[--neon-red] text-white rounded text-xs font-semibold">🚩 FLAGGED</span>;
    }

    switch (status) {
      case 'validated':
        return <span className="px-2 py-1 bg-[--synth] text-white rounded text-xs font-semibold">✅ VALIDATED</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-[--neon-yellow] text-white rounded text-xs font-semibold">⏳ PENDING</span>;
      case 'invalid':
        return <span className="px-2 py-1 bg-[--card] text-white/60 rounded text-xs font-semibold">❌ INVALID</span>;
      default:
        return <span className="px-2 py-1 bg-[--card] text-white/60 rounded text-xs font-semibold">{status}</span>;
    }
  };

  const filteredReferrals = data?.referrals.filter(ref => {
    const matchesSearch = !searchQuery ||
      ref.referrerUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referredUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referredEmail.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  }) || [];

  if (!player || !player.isAdmin) {
    return (
      <>
        <TopNavBar />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] text-white flex items-center justify-center">
              <p>Access Denied - Admin Only</p>
            </div>
          }
        />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <TopNavBar />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] text-white flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--electric]"></div>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] text-white p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-4xl font-bold text-[--solar] mb-2">
                  🛡️ Referral System Admin
                </h1>
                <p className="text-white/60">
                  Manage referrals, flag abuse, and manually validate rewards
                </p>
              </div>

              {data && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-[--card] border border-[--electric]/20 rounded-lg p-4">
                    <div className="text-sm text-white/60">Total</div>
                    <div className="text-2xl font-bold text-[--electric]">{data.stats.totalReferrals}</div>
                  </div>
                  <div className="bg-[--card] border border-[--neon-yellow]/20 rounded-lg p-4">
                    <div className="text-sm text-white/60">Pending</div>
                    <div className="text-2xl font-bold text-[--neon-yellow]">{data.stats.pendingReferrals}</div>
                  </div>
                  <div className="bg-[--card] border border-[--synth]/20 rounded-lg p-4">
                    <div className="text-sm text-white/60">Validated</div>
                    <div className="text-2xl font-bold text-[--synth]">{data.stats.validatedReferrals}</div>
                  </div>
                  <div className="bg-[--card] border border-[--border] rounded-lg p-4">
                    <div className="text-sm text-white/60">Invalid</div>
                    <div className="text-2xl font-bold text-white/60">{data.stats.invalidReferrals}</div>
                  </div>
                  <div className="bg-[--card] border border-[--neon-red]/20 rounded-lg p-4">
                    <div className="text-sm text-white/60">Flagged</div>
                    <div className="text-2xl font-bold text-[--neon-red]">{data.stats.flaggedReferrals}</div>
                  </div>
                </div>
              )}

              <div className="bg-[--card] border border-[--electric]/20 rounded-lg p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <input
                    type="text"
                    placeholder="Search by username or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchReferrals()}
                    className="flex-1 bg-[--void] border border-[--border] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[--electric]"
                  />

                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'pending', 'validated', 'invalid', 'flagged'] as FilterStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                          filterStatus === status
                            ? 'bg-[--electric] text-white'
                            : 'bg-[--card] text-white/60 hover:bg-[--border]'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-[--card] border border-[--electric]/20 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[--void]">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[--electric]">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[--electric]">Referrer</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[--electric]">Referred</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[--electric]">Logins</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[--electric]">Created</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[--electric]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReferrals.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-white/60">
                            No referrals found
                          </td>
                        </tr>
                      ) : (
                        filteredReferrals.map((ref) => (
                          <tr key={ref._id} className="border-t border-[--border] hover:bg-[--card]/50">
                            <td className="px-4 py-4">
                              {getStatusBadge(ref.status, ref.flagged)}
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-white font-semibold">{ref.referrerUsername}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-white">{ref.referredUsername}</div>
                              <div className="text-xs text-white/60">{ref.referredEmail}</div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`font-semibold ${
                                ref.validationDetails.loginCount >= 4 ? 'text-[--synth]' : 'text-[--neon-yellow]'
                              }`}>
                                {ref.validationDetails.loginCount} / 4
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-white/60">
                                {new Date(ref.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-white/40">
                                {new Date(ref.createdAt).toLocaleTimeString()}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedReferral(ref);
                                    setShowDetailsModal(true);
                                  }}
                                  className="px-3 py-1 bg-[--electric] hover:opacity-80 text-white rounded text-xs font-semibold transition-colors"
                                >
                                  Details
                                </button>

                                {ref.status === 'pending' && !ref.flagged && (
                                  <button
                                    onClick={() => handleManualValidation(ref._id)}
                                    className="px-3 py-1 bg-[--synth] hover:opacity-80 text-white rounded text-xs font-semibold transition-colors"
                                  >
                                    Validate
                                  </button>
                                )}

                                {!ref.flagged ? (
                                  <button
                                    onClick={() => {
                                      const reason = prompt('Reason for flagging:');
                                      if (reason) handleFlagToggle(ref._id, true, reason);
                                    }}
                                    className="px-3 py-1 bg-[--neon-red] hover:opacity-80 text-white rounded text-xs font-semibold transition-colors"
                                  >
                                    Flag
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleFlagToggle(ref._id, false)}
                                    className="px-3 py-1 bg-[--card] hover:opacity-80 text-white rounded text-xs font-semibold transition-colors"
                                  >
                                    Unflag
                                  </button>
                                )}

                                {ref.status === 'pending' && (
                                  <button
                                    onClick={() => handleInvalidate(ref._id)}
                                    className="px-3 py-1 bg-[--card] hover:opacity-80 text-white rounded text-xs font-semibold transition-colors"
                                  >
                                    Invalidate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {showDetailsModal && selectedReferral && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                <div className="bg-[--card] border border-[--electric] rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-[--electric]">Referral Details</h2>
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="text-white/60 hover:text-white text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-white/60">Status</div>
                      <div className="mt-1">{getStatusBadge(selectedReferral.status, selectedReferral.flagged)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-white/60">Referrer</div>
                        <div className="text-white font-semibold">{selectedReferral.referrerUsername}</div>
                      </div>
                      <div>
                        <div className="text-sm text-white/60">Referred User</div>
                        <div className="text-white font-semibold">{selectedReferral.referredUsername}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-white/60">Email</div>
                      <div className="text-white">{selectedReferral.referredEmail}</div>
                    </div>

                    <div>
                      <div className="text-sm text-white/60">Referral Code</div>
                      <div className="text-white font-mono">{selectedReferral.referralCode}</div>
                    </div>

                    <div>
                      <div className="text-sm text-white/60">IP Address</div>
                      <div className="text-white font-mono">{selectedReferral.ipAddress || 'N/A'}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-white/60">Login Count</div>
                        <div className="text-white font-semibold">{selectedReferral.validationDetails.loginCount} / 4</div>
                      </div>
                      <div>
                        <div className="text-sm text-white/60">Last Login</div>
                        <div className="text-white text-sm">
                          {selectedReferral.validationDetails.lastLogin
                            ? new Date(selectedReferral.validationDetails.lastLogin).toLocaleString()
                            : 'Never'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-white/60">Created At</div>
                      <div className="text-white">{new Date(selectedReferral.createdAt).toLocaleString()}</div>
                    </div>

                    {selectedReferral.validatedAt && (
                      <div>
                        <div className="text-sm text-white/60">Validated At</div>
                        <div className="text-white">{new Date(selectedReferral.validatedAt).toLocaleString()}</div>
                      </div>
                    )}

                    {selectedReferral.flagged && selectedReferral.flagReason && (
                      <div className="bg-[--neon-red]/10 border border-[--neon-red] rounded-lg p-4">
                        <div className="text-sm text-[--neon-red] font-semibold mb-1">Flag Reason:</div>
                        <div className="text-white">{selectedReferral.flagReason}</div>
                      </div>
                    )}

                    <div>
                      <div className="text-sm text-white/60">Rewards Distributed</div>
                      <div className="text-white font-semibold">
                        {selectedReferral.rewardsDistributed ? '✅ Yes' : '❌ No'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="px-6 py-2 bg-[--card] hover:opacity-80 text-white rounded-lg font-semibold transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
