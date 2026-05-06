/**
 * @file app/admin/referrals/page.tsx
 * @created 2025-10-24
 * @overview Admin panel for referral system management
 * 
 * OVERVIEW:
 * Comprehensive admin interface for managing the referral system:
 * - View all referrals with search/filter
 * - Flag/unflag suspicious referrals
 * - Manual validation override
 * - View detailed referral records
 * - Bulk operations
 * - Abuse detection alerts
 * 
 * Protected route - requires admin role
 * 
 * Dependencies: /api/admin/referrals endpoints
 */

'use client';

import { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { useRouter } from 'next/navigation';
import { showError, showSuccess } from '@/lib/toastService';

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

  // Check admin access
  useEffect(() => {
    if (!player || !player.isAdmin) {
      router.push('/game');
      return;
    }
  }, [player, router]);

  // Fetch referral data
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
        fetchReferrals(); // Refresh data
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
      return <span className="px-2 py-1 bg-red-600 text-white rounded text-xs font-semibold">🚩 FLAGGED</span>;
    }

    switch (status) {
      case 'validated':
        return <span className="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold">✅ VALIDATED</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-yellow-600 text-white rounded text-xs font-semibold">⏳ PENDING</span>;
      case 'invalid':
        return <span className="px-2 py-1 bg-gray-600 text-white rounded text-xs font-semibold">❌ INVALID</span>;
      default:
        return <span className="px-2 py-1 bg-gray-600 text-white rounded text-xs font-semibold">{status}</span>;
    }
  };

  const filteredReferrals = data?.referrals.filter(ref => {
    const matchesSearch = !searchQuery || 
      ref.referrerUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referredUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referredEmail.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-400 via-orange-500 to-yellow-500 bg-clip-text text-transparent mb-2">
            🛡️ Referral System Admin
          </h1>
          <p className="text-gray-300">
            Manage referrals, flag abuse, and manually validate rewards
          </p>
        </div>

        {/* Stats Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-800 border border-cyan-500/30 rounded-lg p-4">
              <div className="text-sm text-gray-400">Total</div>
              <div className="text-2xl font-bold text-cyan-400">{data.stats.totalReferrals}</div>
            </div>
            <div className="bg-gray-800 border border-yellow-500/30 rounded-lg p-4">
              <div className="text-sm text-gray-400">Pending</div>
              <div className="text-2xl font-bold text-yellow-400">{data.stats.pendingReferrals}</div>
            </div>
            <div className="bg-gray-800 border border-green-500/30 rounded-lg p-4">
              <div className="text-sm text-gray-400">Validated</div>
              <div className="text-2xl font-bold text-green-400">{data.stats.validatedReferrals}</div>
            </div>
            <div className="bg-gray-800 border border-gray-500/30 rounded-lg p-4">
              <div className="text-sm text-gray-400">Invalid</div>
              <div className="text-2xl font-bold text-gray-400">{data.stats.invalidReferrals}</div>
            </div>
            <div className="bg-gray-800 border border-red-500/30 rounded-lg p-4">
              <div className="text-sm text-gray-400">Flagged</div>
              <div className="text-2xl font-bold text-red-400">{data.stats.flaggedReferrals}</div>
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="bg-gray-800 border border-cyan-500/30 rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchReferrals()}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
            />

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'validated', 'invalid', 'flagged'] as FilterStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    filterStatus === status
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Referrals Table */}
        <div className="bg-gray-800 border border-cyan-500/30 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-400">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-400">Referrer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-400">Referred</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-400">Logins</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-400">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-cyan-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No referrals found
                    </td>
                  </tr>
                ) : (
                  filteredReferrals.map((ref) => (
                    <tr key={ref._id} className="border-t border-gray-700 hover:bg-gray-700/30">
                      <td className="px-4 py-4">
                        {getStatusBadge(ref.status, ref.flagged)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-white font-semibold">{ref.referrerUsername}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-white">{ref.referredUsername}</div>
                        <div className="text-xs text-gray-400">{ref.referredEmail}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-semibold ${
                          ref.validationDetails.loginCount >= 4 ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                          {ref.validationDetails.loginCount} / 4
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-300">
                          {new Date(ref.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
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
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors"
                          >
                            Details
                          </button>

                          {ref.status === 'pending' && !ref.flagged && (
                            <button
                              onClick={() => handleManualValidation(ref._id)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-semibold transition-colors"
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
                              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold transition-colors"
                            >
                              Flag
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFlagToggle(ref._id, false)}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs font-semibold transition-colors"
                            >
                              Unflag
                            </button>
                          )}

                          {ref.status === 'pending' && (
                            <button
                              onClick={() => handleInvalidate(ref._id)}
                              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs font-semibold transition-colors"
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

      {/* Details Modal */}
      {showDetailsModal && selectedReferral && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-cyan-500 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-cyan-400">Referral Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400">Status</div>
                <div className="mt-1">{getStatusBadge(selectedReferral.status, selectedReferral.flagged)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400">Referrer</div>
                  <div className="text-white font-semibold">{selectedReferral.referrerUsername}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Referred User</div>
                  <div className="text-white font-semibold">{selectedReferral.referredUsername}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Email</div>
                <div className="text-white">{selectedReferral.referredEmail}</div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Referral Code</div>
                <div className="text-white font-mono">{selectedReferral.referralCode}</div>
              </div>

              <div>
                <div className="text-sm text-gray-400">IP Address</div>
                <div className="text-white font-mono">{selectedReferral.ipAddress || 'N/A'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-400">Login Count</div>
                  <div className="text-white font-semibold">{selectedReferral.validationDetails.loginCount} / 4</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Last Login</div>
                  <div className="text-white text-sm">
                    {selectedReferral.validationDetails.lastLogin 
                      ? new Date(selectedReferral.validationDetails.lastLogin).toLocaleString()
                      : 'Never'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400">Created At</div>
                <div className="text-white">{new Date(selectedReferral.createdAt).toLocaleString()}</div>
              </div>

              {selectedReferral.validatedAt && (
                <div>
                  <div className="text-sm text-gray-400">Validated At</div>
                  <div className="text-white">{new Date(selectedReferral.validatedAt).toLocaleString()}</div>
                </div>
              )}

              {selectedReferral.flagged && selectedReferral.flagReason && (
                <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
                  <div className="text-sm text-red-400 font-semibold mb-1">Flag Reason:</div>
                  <div className="text-white">{selectedReferral.flagReason}</div>
                </div>
              )}

              <div>
                <div className="text-sm text-gray-400">Rewards Distributed</div>
                <div className="text-white font-semibold">
                  {selectedReferral.rewardsDistributed ? '✅ Yes' : '❌ No'}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
