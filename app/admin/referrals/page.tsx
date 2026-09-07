
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

import { useState, useEffect, useCallback } from 'react';
import { useGameContext } from '@/context/GameContext';
import { useRouter } from 'next/navigation';
import { showError, showSuccess } from '@/lib/toastService';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

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
  const fetchReferrals = useCallback(async () => {
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
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

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
    if (!(await confirmDialog('Manually validate this referral and distribute rewards?'))) return;

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
    if (!(await confirmDialog('Mark this referral as invalid? This cannot be undone.'))) return;

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
      return <span className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold">🚩 FLAGGED</span>;
    }

    switch (status) {
      case 'validated':
        return <span className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold">✅ VALIDATED</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold">⏳ PENDING</span>;
      case 'invalid':
        return <span className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold">❌ INVALID</span>;
      default:
        return <span className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold">{status}</span>;
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
      <div className="min-h-screen bg-[color:var(--nn-void)] text-[color:var(--nn-text-primary)] flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[color:var(--nn-violet)] to-gray-900 text-[color:var(--nn-text-primary)] p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[color:var(--nn-magenta)] via-[color:var(--nn-amber)] to-[color:var(--nn-amber)] bg-clip-text text-transparent mb-2">
            🛡️ Referral System Admin
          </h1>
          <p className="text-[color:var(--nn-text-secondary)]">
            Manage referrals, flag abuse, and manually validate rewards
          </p>
        </div>

        {/* Stats Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
              <div className="text-sm text-[color:var(--nn-text-secondary)]">Total</div>
              <div className="text-2xl font-bold text-[color:var(--nn-cyan)]">{data.stats.totalReferrals}</div>
            </div>
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-4">
              <div className="text-sm text-[color:var(--nn-text-secondary)]">Pending</div>
              <div className="text-2xl font-bold text-[color:var(--nn-amber)]">{data.stats.pendingReferrals}</div>
            </div>
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-4">
              <div className="text-sm text-[color:var(--nn-text-secondary)]">Validated</div>
              <div className="text-2xl font-bold text-[color:var(--nn-green)]">{data.stats.validatedReferrals}</div>
            </div>
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none p-4">
              <div className="text-sm text-[color:var(--nn-text-secondary)]">Invalid</div>
              <div className="text-2xl font-bold text-[color:var(--nn-text-secondary)]">{data.stats.invalidReferrals}</div>
            </div>
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4">
              <div className="text-sm text-[color:var(--nn-text-secondary)]">Flagged</div>
              <div className="text-2xl font-bold text-[color:var(--nn-magenta)]">{data.stats.flaggedReferrals}</div>
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchReferrals()}
              className="flex-1 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none px-4 py-2 text-[color:var(--nn-text-primary)] focus:outline-none focus:border-cyan-500"
            />

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'validated', 'invalid', 'flagged'] as FilterStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-none font-semibold transition-colors ${
                    filterStatus === status
                      ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)]'
                      : 'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Referrals Table */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[color:var(--nn-void)]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Referrer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Referred</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Logins</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[color:var(--nn-cyan)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[color:var(--nn-text-secondary)]">
                      No referrals found
                    </td>
                  </tr>
                ) : (
                  filteredReferrals.map((ref) => (
                    <tr key={ref._id} className="border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)]">
                      <td className="px-4 py-4">
                        {getStatusBadge(ref.status, ref.flagged)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-[color:var(--nn-text-primary)] font-semibold">{ref.referrerUsername}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-[color:var(--nn-text-primary)]">{ref.referredUsername}</div>
                        <div className="text-xs text-[color:var(--nn-text-secondary)]">{ref.referredEmail}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-semibold ${
                          ref.validationDetails.loginCount >= 4 ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-amber)]'
                        }`}>
                          {ref.validationDetails.loginCount} / 4
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-[color:var(--nn-text-secondary)]">
                          {new Date(ref.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-[color:var(--nn-text-secondary)]">
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
                            className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold transition-colors"
                          >
                            Details
                          </button>

                          {ref.status === 'pending' && !ref.flagged && (
                            <button
                              onClick={() => handleManualValidation(ref._id)}
                              className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold transition-colors"
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
                              className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold transition-colors"
                            >
                              Flag
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFlagToggle(ref._id, false)}
                              className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold transition-colors"
                            >
                              Unflag
                            </button>
                          )}

                          {ref.status === 'pending' && (
                            <button
                              onClick={() => handleInvalidate(ref._id)}
                              className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold transition-colors"
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
        <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] flex items-center justify-center p-4 z-50">
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-[color:var(--nn-cyan)]">Referral Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-[color:var(--nn-text-secondary)]">Status</div>
                <div className="mt-1">{getStatusBadge(selectedReferral.status, selectedReferral.flagged)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-[color:var(--nn-text-secondary)]">Referrer</div>
                  <div className="text-[color:var(--nn-text-primary)] font-semibold">{selectedReferral.referrerUsername}</div>
                </div>
                <div>
                  <div className="text-sm text-[color:var(--nn-text-secondary)]">Referred User</div>
                  <div className="text-[color:var(--nn-text-primary)] font-semibold">{selectedReferral.referredUsername}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-[color:var(--nn-text-secondary)]">Email</div>
                <div className="text-[color:var(--nn-text-primary)]">{selectedReferral.referredEmail}</div>
              </div>

              <div>
                <div className="text-sm text-[color:var(--nn-text-secondary)]">Referral Code</div>
                <div className="text-[color:var(--nn-text-primary)] font-mono">{selectedReferral.referralCode}</div>
              </div>

              <div>
                <div className="text-sm text-[color:var(--nn-text-secondary)]">IP Address</div>
                <div className="text-[color:var(--nn-text-primary)] font-mono">{selectedReferral.ipAddress || 'N/A'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-[color:var(--nn-text-secondary)]">Login Count</div>
                  <div className="text-[color:var(--nn-text-primary)] font-semibold">{selectedReferral.validationDetails.loginCount} / 4</div>
                </div>
                <div>
                  <div className="text-sm text-[color:var(--nn-text-secondary)]">Last Login</div>
                  <div className="text-[color:var(--nn-text-primary)] text-sm">
                    {selectedReferral.validationDetails.lastLogin 
                      ? new Date(selectedReferral.validationDetails.lastLogin).toLocaleString()
                      : 'Never'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-[color:var(--nn-text-secondary)]">Created At</div>
                <div className="text-[color:var(--nn-text-primary)]">{new Date(selectedReferral.createdAt).toLocaleString()}</div>
              </div>

              {selectedReferral.validatedAt && (
                <div>
                  <div className="text-sm text-[color:var(--nn-text-secondary)]">Validated At</div>
                  <div className="text-[color:var(--nn-text-primary)]">{new Date(selectedReferral.validatedAt).toLocaleString()}</div>
                </div>
              )}

              {selectedReferral.flagged && selectedReferral.flagReason && (
                <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4">
                  <div className="text-sm text-[color:var(--nn-magenta)] font-semibold mb-1">Flag Reason:</div>
                  <div className="text-[color:var(--nn-text-primary)]">{selectedReferral.flagReason}</div>
                </div>
              )}

              <div>
                <div className="text-sm text-[color:var(--nn-text-secondary)]">Rewards Distributed</div>
                <div className="text-[color:var(--nn-text-primary)] font-semibold">
                  {selectedReferral.rewardsDistributed ? '✅ Yes' : '❌ No'}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-semibold transition-colors"
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
