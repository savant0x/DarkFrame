/**
 * @file components/WMDVotingPanel.tsx
 * @created 2025-10-22
 * @overview WMD Clan Voting System Panel
 * 
 * OVERVIEW:
 * Clan voting interface for WMD launches and critical decisions.
 * Shows active votes, allows voting, and displays results.
 * 
 * Features:
 * - Active clan votes display
 * - Vote creation interface
 * - Ballot casting (Yes/No)
 * - Vote results and progress
 * - Authorization checking
 * 
 * Dependencies: /api/wmd/voting, /types/wmd
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { showSuccess, showError, showInfo } from '@/lib/toastService';

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

    const handleVoteUpdate = (payload: any) => {
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

  const vetoVote = async (voteId: string, reason?: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/voting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'veto', voteId, reason }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess('Vote vetoed successfully');
        await fetchVotes();
      } else {
        showError(data.error || 'Failed to veto vote');
      }
    } catch (error) {
      showError('Error vetoing vote');
      console.error('Error vetoing vote:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-blue-600';
      case 'PASSED': return 'bg-green-600';
      case 'FAILED': return 'bg-red-600';
      case 'EXPIRED': return 'bg-gray-600';
      default: return 'bg-gray-600';
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
      <div className="p-6 bg-gray-800 rounded-lg">
        <p className="text-gray-300">Loading clan votes...</p>
      </div>
    );
  }

  const activeVotes = votes.filter(v => v.status === 'ACTIVE');

  return (
    <div className="p-6 bg-gray-800 rounded-lg space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-yellow-400">Clan Voting</h2>
          <p className="text-sm text-gray-400">
            {activeVotes.length} active vote{activeVotes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Active Votes */}
      <div className="space-y-4">
        {votes.map((vote) => {
          const progress = ((vote.votesFor.length / vote.requiredVotes) * 100).toFixed(0);
          const totalVotes = vote.votesFor.length + vote.votesAgainst.length;

          return (
            <Card key={vote.voteId} className="p-4 bg-gray-700 space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-lg">{vote.voteType}</h3>
                  <p className="text-sm text-gray-400">Proposed by {vote.proposerUsername}</p>
                  {vote.targetUsername && (
                    <p className="text-sm text-purple-400">Target: {vote.targetUsername}</p>
                  )}
                  {vote.warheadType && (
                    <Badge className="bg-red-600 mt-1">{vote.warheadType}</Badge>
                  )}
                </div>
                <div className="text-right">
                  <Badge className={getStatusColor(vote.status)}>
                    {vote.status}
                  </Badge>
                  {vote.status === 'ACTIVE' && (
                    <p className="text-xs text-gray-400 mt-1">
                      {getTimeRemaining(vote.expiresAt)}
                    </p>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">
                    {vote.votesFor.length}/{vote.requiredVotes} votes needed
                  </span>
                  <span className="text-gray-400">{progress}%</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, parseFloat(progress))}%` }}
                  />
                </div>
              </div>

              {/* Vote Stats */}
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-lg">✓</span>
                  <span className="text-gray-300">Yes: {vote.votesFor.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-lg">✗</span>
                  <span className="text-gray-300">No: {vote.votesAgainst.length}</span>
                </div>
                <div className="text-gray-400">
                  Total: {totalVotes}
                </div>
              </div>

              {/* Voting Buttons */}
              {vote.status === 'ACTIVE' && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => castVote(vote.voteId, true)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Vote Yes
                  </Button>
                  <Button
                    onClick={() => castVote(vote.voteId, false)}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    Vote No
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {votes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No clan votes</p>
          <p className="text-gray-500 text-sm">Votes will appear here when created</p>
        </div>
      )}
    </div>
  );
}
