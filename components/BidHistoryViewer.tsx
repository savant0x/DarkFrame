/**
 * @file components/BidHistoryViewer.tsx
 * @created 2025-01-17
 * @overview Auction bid history timeline display
 * 
 * OVERVIEW:
 * Displays chronological list of all bids placed on an auction. Shows bidder
 * username, bid amount, timestamp, and winning status. Most recent bids shown
 * first. Highlights current winning bid with green indicator.
 */

'use client';

import React from 'react';
import { AuctionBid } from '@/types/auction.types';

interface BidHistoryViewerProps {
  bids: AuctionBid[];
}

export function BidHistoryViewer({ bids }: BidHistoryViewerProps) {
  // Sort bids by time (most recent first)
  const sortedBids = [...bids].sort((a, b) => 
    new Date(b.bidTime).getTime() - new Date(a.bidTime).getTime()
  );

  /**
   * Format timestamp for display
   */
  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // More than 24 hours
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  };

  if (bids.length === 0) {
    return (
      <div className="text-center text-[color:var(--nn-text-secondary)] text-sm py-4">
        No bids yet
      </div>
    );
  }

  return (
    <div className="bg-[color:var(--nn-void)] rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] max-h-64 overflow-y-auto">
      <div className="p-3 border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]">
        <h4 className="text-sm font-semibold text-[color:var(--nn-text-secondary)]">Bid History</h4>
      </div>
      
      <div className="divide-y divide-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        {sortedBids.map((bid) => (
          <div
            key={bid.bidId}
            className={`p-3 ${
              bid.isWinning ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] bg-opacity-20 border-l-4 border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[color:var(--nn-text-primary)] font-semibold text-sm">
                  {bid.bidderUsername}
                </span>
                {bid.isWinning && (
                  <span className="text-xs bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)] px-2 py-0.5 rounded-none font-semibold">
                    WINNING
                  </span>
                )}
              </div>
              <span className="text-[color:var(--nn-amber)] font-bold text-sm">
                {bid.bidAmount.toLocaleString()} 💰
              </span>
            </div>
            
            <div className="text-xs text-[color:var(--nn-text-secondary)]">
              {formatTime(bid.bidTime)}
            </div>
          </div>
        ))}
      </div>

      {/* Bid Statistics */}
      <div className="p-3 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-xs text-[color:var(--nn-text-secondary)]">
        <div className="flex justify-between">
          <span>Total Bids:</span>
          <span className="text-[color:var(--nn-text-primary)] font-semibold">{bids.length}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Unique Bidders:</span>
          <span className="text-[color:var(--nn-text-primary)] font-semibold">
            {new Set(bids.map(b => b.bidderUsername)).size}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Sorted chronologically (most recent first)
// - Winning bid highlighted with green indicator
// - Relative timestamps (Xm ago, Xh ago, Xd ago)
// - Scrollable container with max height 256px
// - Shows bid statistics (total bids, unique bidders)
// - Compact layout for embedding in auction cards
// ============================================================
// END OF FILE
// ============================================================
