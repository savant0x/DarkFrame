/**
 * @file components/AuctionListingCard.tsx
 * @created 2025-01-17
 * @overview Individual auction listing display card
 * 
 * OVERVIEW:
 * Displays single auction listing with item details, current bid, time remaining,
 * and action buttons. Supports bidding, buyout, and cancellation. Shows winning
 * status for "My Bids" view. Real-time countdown timer for auction expiration.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { extractApiError } from '@/lib/apiClient';
import { AuctionListing, MyBidAuctionView, isMyBidAuctionView, AuctionItemType, AuctionStatus, ResourceType } from '@/types/auction.types';
import { BidHistoryViewer } from './BidHistoryViewer';
import { showSuccess, showInfo } from '@/lib/toastService';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface AuctionListingCardProps {
  auction: AuctionListing | MyBidAuctionView;
  onUpdate: () => void;
  showMyBidStatus?: boolean;
}

export function AuctionListingCard({ auction, onUpdate, showMyBidStatus }: AuctionListingCardProps) {
  const [showBidHistory, setShowBidHistory] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');

  /**
   * Calculate time remaining
   */
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(auction.expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction.expiresAt]);

  /**
   * Handle place bid
   */
  const handlePlaceBid = async () => {
    const amount = parseInt(bidAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    if (amount < auction.currentBid + 100) {
      setError(`Minimum bid: ${(auction.currentBid + 100).toLocaleString()}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: auction.auctionId,
          bidAmount: amount
        })
      });

      const data = await response.json();

      if (data.success) {
        setBidAmount('');
        onUpdate();
      } else {
        setError(extractApiError(data, response.status));
      }
    } catch (err) {
      setError('Network error placing bid');
      console.error('Error placing bid:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle buyout
   */
  const handleBuyout = async () => {
    if (!auction.buyoutPrice) return;

    if (!(await confirmDialog(`Buy now for ${auction.buyoutPrice.toLocaleString()} Metal?`))) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auction/buyout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: auction.auctionId
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('Purchase successful!');
        onUpdate();
      } else {
        setError(extractApiError(data, response.status));
      }
    } catch (err) {
      setError('Network error during buyout');
      console.error('Error buying out:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle cancel auction
   */
  const handleCancel = async () => {
    if (!(await confirmDialog('Cancel this auction? Listing fee is non-refundable.'))) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auction/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auctionId: auction.auctionId
        })
      });

      const data = await response.json();

      if (data.success) {
        showInfo('Auction cancelled');
        onUpdate();
      } else {
        setError(extractApiError(data, response.status));
      }
    } catch (err) {
      setError('Network error cancelling auction');
      console.error('Error cancelling:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get item display info
   */
  const getItemDisplay = () => {
    const item = auction.item;
    
    if (item.itemType === AuctionItemType.Unit) {
      return {
        icon: '⚔️',
        name: `${item.unitType}`,
        details: `Str: ${item.unitStrength || 0} | Def: ${item.unitDefense || 0}`
      };
    } else if (item.itemType === AuctionItemType.Resource) {
      return {
        icon: item.resourceType === ResourceType.Metal ? '⛏️' : '⚡',
        name: `${item.resourceType} (${item.resourceAmount?.toLocaleString() || 0})`,
        details: 'Resource'
      };
    } else {
      return {
        icon: '🎁',
        name: 'Tradeable Item',
        details: `Qty: ${item.tradeableItemQuantity || 1}`
      };
    }
  };

  const itemDisplay = getItemDisplay();
  const minBid = auction.currentBid + 100;
  const isExpired = new Date(auction.expiresAt) < new Date();
  const canCancel = auction.bids.length === 0 && auction.status === AuctionStatus.Active;

  // My Bid status is only present in the "My Bids" view, where the panel
  // supplies MyBidAuctionView — narrowed with the domain type guard, not a cast.
  const myBidInfo = showMyBidStatus && isMyBidAuctionView(auction) ? auction : null;

  return (
    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] transition-colors">
      {/* Item Info */}
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        <span className="text-4xl">{itemDisplay.icon}</span>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-[color:var(--nn-amber)]">{itemDisplay.name}</h3>
          <p className="text-sm text-[color:var(--nn-text-secondary)]">{itemDisplay.details}</p>
        </div>
      </div>

      {/* Seller & Status */}
      <div className="mb-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-[color:var(--nn-text-secondary)]">Seller:</span>
          <span className="text-[color:var(--nn-text-primary)] font-semibold">{auction.sellerUsername}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[color:var(--nn-text-secondary)]">Time Left:</span>
          <span className={`font-semibold ${
            isExpired ? 'text-[color:var(--nn-magenta)]' : 'text-[color:var(--nn-green)]'
          }`}>
            {timeRemaining}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[color:var(--nn-text-secondary)]">Status:</span>
          <span className={`font-semibold ${
            auction.status === AuctionStatus.Active ? 'text-[color:var(--nn-green)]' :
            auction.status === AuctionStatus.Sold ? 'text-[color:var(--nn-cyan)]' :
            'text-[color:var(--nn-magenta)]'
          }`}>
            {auction.status}
          </span>
        </div>
      </div>

      {/* My Bid Status (only in My Bids view) */}
      {myBidInfo && (
        <div className={`mb-3 p-2 rounded-none ${
          myBidInfo.isWinning ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]' : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]'
        }`}>
          <div className="text-sm font-semibold">
            {myBidInfo.isWinning ? '✅ Winning' : '❌ Outbid'}
          </div>
          <div className="text-xs text-[color:var(--nn-text-secondary)]">
            Your bid: {myBidInfo.myBidAmount?.toLocaleString() || 'N/A'} Metal
          </div>
        </div>
      )}

      {/* Pricing */}
      <div className="mb-3 space-y-2">
        <div className="bg-[color:var(--nn-void)] p-3 rounded-none">
          <div className="flex justify-between items-center">
            <span className="text-[color:var(--nn-text-secondary)] text-sm">Current Bid:</span>
            <span className="text-[color:var(--nn-amber)] font-bold text-lg">
              {auction.currentBid.toLocaleString()} 💰
            </span>
          </div>
          {auction.highestBidder && (
            <div className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
              Highest bidder: {auction.highestBidder}
            </div>
          )}
        </div>

        {auction.buyoutPrice && (
          <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] p-2 rounded-none">
            <div className="flex justify-between items-center">
              <span className="text-[color:var(--nn-cyan)] text-sm">Buyout:</span>
              <span className="text-[color:var(--nn-cyan)] font-bold">
                {auction.buyoutPrice.toLocaleString()} 💰
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bid History Link */}
      {auction.bids.length > 0 && (
        <button
          onClick={() => setShowBidHistory(!showBidHistory)}
          className="text-xs text-[color:var(--nn-cyan)] mb-3 underline"
        >
          {showBidHistory ? 'Hide' : 'Show'} Bid History ({auction.bids.length})
        </button>
      )}

      {showBidHistory && (
        <div className="mb-3">
          <BidHistoryViewer bids={auction.bids} />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] text-[color:var(--nn-magenta)] text-xs p-2 rounded-none mb-3">
          {error}
        </div>
      )}

      {/* Actions */}
      {auction.status === AuctionStatus.Active && !isExpired && (
        <div className="space-y-2">
          {/* Bid Input */}
          <div className="flex gap-2">
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder={`Min: ${minBid.toLocaleString()}`}
              className="flex-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-primary)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-sm"
              disabled={loading}
            />
            <button
              onClick={handlePlaceBid}
              disabled={loading}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-semibold text-sm disabled:opacity-50"
            >
              {loading ? '...' : 'Bid'}
            </button>
          </div>

          {/* Buyout Button */}
          {auction.buyoutPrice && (
            <button
              onClick={handleBuyout}
              disabled={loading}
              className="w-full px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : '🛒 Buy Now'}
            </button>
          )}

          {/* Cancel Button (for seller only, shown in My Listings) */}
          {canCancel && !showMyBidStatus && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="w-full px-4 py-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Cancelling...' : 'Cancel Auction'}
            </button>
          )}
        </div>
      )}

      {auction.status !== AuctionStatus.Active && (
        <div className="text-center text-[color:var(--nn-text-secondary)] text-sm py-2">
          {auction.status === AuctionStatus.Sold && '✅ Sold'}
          {auction.status === AuctionStatus.Cancelled && '❌ Cancelled'}
          {auction.status === AuctionStatus.Expired && '⏰ Expired'}
        </div>
      )}
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Real-time countdown timer updates every second
// - Bid validation: minimum increment 100
// - Buyout confirmation dialog before purchase
// - Cancel only available if no bids placed
// - Shows winning/outbid status in My Bids view
// - Expandable bid history with BidHistoryViewer
// - Color-coded status indicators
// - Responsive layout with hover effects
// ============================================================
// END OF FILE
// ============================================================
