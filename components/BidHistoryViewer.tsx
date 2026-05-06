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
      <div className="text-center text-gray-500 text-sm py-4">
        No bids yet
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded border border-gray-700 max-h-64 overflow-y-auto">
      <div className="p-3 border-b border-gray-700 bg-gray-800">
        <h4 className="text-sm font-semibold text-gray-300">Bid History</h4>
      </div>
      
      <div className="divide-y divide-gray-800">
        {sortedBids.map((bid) => (
          <div
            key={bid.bidId}
            className={`p-3 ${
              bid.isWinning ? 'bg-green-900 bg-opacity-20 border-l-4 border-green-500' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">
                  {bid.bidderUsername}
                </span>
                {bid.isWinning && (
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-semibold">
                    WINNING
                  </span>
                )}
              </div>
              <span className="text-yellow-400 font-bold text-sm">
                {bid.bidAmount.toLocaleString()} 💰
              </span>
            </div>
            
            <div className="text-xs text-gray-500">
              {formatTime(bid.bidTime)}
            </div>
          </div>
        ))}
      </div>

      {/* Bid Statistics */}
      <div className="p-3 border-t border-gray-700 bg-gray-800 text-xs text-gray-400">
        <div className="flex justify-between">
          <span>Total Bids:</span>
          <span className="text-white font-semibold">{bids.length}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Unique Bidders:</span>
          <span className="text-white font-semibold">
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
