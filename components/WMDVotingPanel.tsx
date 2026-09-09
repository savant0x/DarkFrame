/**
 * @file components/WMDVotingPanel.tsx
 * @created 2025-10-22
 * @updated 2026-09-08 (FID-20260908-009: NEON NOIR redesign — nn-panel/nn-chip/
 * nn-meter/nn-abtn token structure; voting flow logic byte-preserved)
 * @overview WMD Clan Voting System Panel
 *
 * OVERVIEW:
 * Clan voting interface for WMD launches and critical decisions.
 * Shows active votes, allows voting, and displays results.
 *
 * Dependencies: /api/wmd/voting, /types/wmd
 */

'use client';

import { useState, useEffect } from 'react';
import { Vote } from 'lucide-react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { showSuccess, showError, showInfo } from '@/lib/toastService';
import type { WMDVoteUpdatePayload } from '@/types/websocket';

interface ClanVote {
  voteId: string;
  clanId: string;
  voteType: string;
  proposerUsername: string;
  status: string;
  votesFor: string[];
  votesAgainst: string[];
  requiredVotes: number;
  targetUsername?: string;
  warheadType?: string;
  createdAt: Date;
  expiresAt: Date;
}

export default function WMDVotingPanel() {
  const [votes, setVotes] = useState<ClanVote[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket, isConnected } = useWebSocketContext();

  useEffect(() => {
    fetchVotes();
    const interval = setInterval(fetchVotes, 10000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket event subscriptions
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleVoteUpdate = (payload: WMDVoteUpdatePayload) => {
      if (payload.status === 'PASSED') {
        showSuccess(`Vote passed: ${payload.voteType}`);
      } else if (payload.status === 'FAILED') {
        showError(`Vote failed: ${payload.voteType}`);
      } else if (payload.status === 'VETOED') {
        showInfo(`Vote vetoed by clan leader`);
      } else {
        showInfo(`Vote updated: ${payload.voteType}`);
      }
      fetchVotes();
    };

    socket.on('wmd:vote_update', handleVoteUpdate);

    return () => {
      socket.off('wmd:vote_update', handleVoteUpdate);
    };
  }, [socket, isConnected]);

  const fetchVotes = async () => {
    try {
      const res = await fetch('/api/wmd/voting?action=list');
      const data = await res.json();
      if (data.success) {
        setVotes(data.votes);
      }
    } catch (error) {
      console.error('Failed to fetch votes:', error);
    } finally {
      setLoading(false);
    }
  };

  const castVote = async (voteId: string, vote: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/voting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cast', voteId, vote }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(vote ? 'Voted YES' : 'Voted NO');
        await fetchVotes();
      } else {
        showError(data.error || 'Failed to cast vote');
      }
    } catch (error) {
      showError('Error casting vote');
      console.error('Error casting vote:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'nn-chip nn-chip--cyan';
      case 'PASSED': return 'nn-chip nn-chip--green';
      case 'FAILED': return 'nn-chip nn-chip--magenta';
      case 'EXPIRED': return 'nn-chip';
      default: return 'nn-chip';
    }
  };

  const getTimeRemaining = (expiresAt: Date) => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const remaining = Math.max(0, expires - now);
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    return `${hours}h remaining`;
  };

  if (loading) {
    return (
      <div style={{ background: 'color-mix(in oklab, var(--nn-void) 65%, transparent)' }} className="p-6 rounded-none">
        <p className="nn-lab">Loading clan votes…</p>
      </div>
    );
  }

  const activeVotes = votes.filter(v => v.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Header — scanline section instrument */}
      <div className="nn-sec">
        <span className="nn-panel__icon"><Vote className="h-4 w-4" /></span>
        <span className="nn-sec__title">Clan Voting</span>
        <span className="nn-sec__note nn-num">{activeVotes.length} active vote{activeVotes.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Active Votes — HUD panels with meters */}
      <div className="space-y-4">
        {votes.map((vote) => {
          const progress = ((vote.votesFor.length / vote.requiredVotes) * 100).toFixed(0);
          const totalVotes = vote.votesFor.length + vote.votesAgainst.length;

          return (
            <div
              key={vote.voteId}
              className="nn-panel"
              style={{ '--nn-accent': vote.status === 'PASSED' ? 'var(--nn-green)' : vote.status === 'FAILED' ? 'var(--nn-magenta)' : 'var(--nn-cyan)' } as React.CSSProperties}
            >
              <div className="nn-panel__header">
                <span className="nn-panel__title">{vote.voteType}</span>
                <span className="nn-panel__meta">Proposed by {vote.proposerUsername}</span>
                <span className={`nn-chip ${getStatusChip(vote.status)} nn-panel__meta`} style={{ marginLeft: 'auto' }}>
                  {vote.status}
                </span>
                {vote.status === 'ACTIVE' && (
                  <span className="nn-panel__meta nn-num">{getTimeRemaining(vote.expiresAt)}</span>
                )}
              </div>

              <div className="nn-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vote.targetUsername && (
                  <div className="flex justify-between">
                    <span className="nn-lab">Target</span>
                    <span className="nn-text-violet" style={{ fontSize: 12 }}>{vote.targetUsername}</span>
                  </div>
                )}
                {vote.warheadType && (
                  <div className="flex justify-between">
                    <span className="nn-lab">Warhead</span>
                    <span className="nn-chip nn-chip--magenta">{vote.warheadType}</span>
                  </div>
                )}

                {/* Progress — HUD meter with green approval fill */}
                <div>
                  <div className="flex justify-between" style={{ marginBottom: 4 }}>
                    <span className="nn-lab">{vote.votesFor.length}/{vote.requiredVotes} votes needed</span>
                    <span className="nn-num" style={{ fontSize: 11 }}>{progress}%</span>
                  </div>
                  <div className="nn-meter" style={{ '--nn-accent': 'var(--nn-green)' } as React.CSSProperties}>
                    <div style={{ width: `${Math.min(100, parseFloat(progress))}%`, height: '100%', background: 'var(--nn-green)' }} />
                  </div>
                </div>

                {/* Tally — semantic ledger */}
                <div className="flex gap-4">
                  <span className="nn-num nn-text-green" style={{ fontSize: 12 }}>✓ {vote.votesFor.length}</span>
                  <span className="nn-num nn-text-magenta" style={{ fontSize: 12 }}>✗ {vote.votesAgainst.length}</span>
                  <span className="nn-lab">Total ▸ {totalVotes}</span>
                </div>

                {/* Voting — approve green / reject magenta (destructive) */}
                {vote.status === 'ACTIVE' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => castVote(vote.voteId, true)}
                      className="nn-abtn nn-abtn--green flex-1"
                    >
                      Vote Yes
                    </button>
                    <button
                      onClick={() => castVote(vote.voteId, false)}
                      className="nn-abtn nn-abtn--magenta flex-1"
                    >
                      Vote No
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {votes.length === 0 && (
        <div className="text-center py-12">
          <p className="nn-lab">No clan votes</p>
          <p className="nn-footnote" style={{ marginTop: 4 }}>Votes will appear here when created</p>
        </div>
      )}
    </div>
  );
}
