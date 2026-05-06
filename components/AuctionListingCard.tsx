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
import { AuctionListing, AuctionItemType, AuctionStatus, ResourceType } from '@/types/auction.types';
import { BidHistoryViewer } from './BidHistoryViewer';

interface AuctionListingCardProps {
  auction: AuctionListing;
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
        setError(data.message || 'Failed to place bid');
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

    if (!confirm(`Buy now for ${auction.buyoutPrice.toLocaleString()} Metal?`)) {
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
        alert('Purchase successful!');
        onUpdate();
      } else {
        setError(data.message || 'Failed to buyout');
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
    if (!confirm('Cancel this auction? Listing fee is non-refundable.')) {
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
        alert('Auction cancelled');
        onUpdate();
      } else {
        setError(data.message || 'Failed to cancel');
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

  // Check if this is "My Bids" view and show winning status
  const myBidInfo = showMyBidStatus ? (auction as any) : null;

  return (
    <div className="bg-gray-800 border-2 border-gray-700 rounded-lg p-4 hover:border-yellow-600 transition-colors">
      {/* Item Info */}
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-700">
        <span className="text-4xl">{itemDisplay.icon}</span>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-yellow-200">{itemDisplay.name}</h3>
          <p className="text-sm text-gray-400">{itemDisplay.details}</p>
        </div>
      </div>

      {/* Seller & Status */}
      <div className="mb-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Seller:</span>
          <span className="text-white font-semibold">{auction.sellerUsername}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Time Left:</span>
          <span className={`font-semibold ${
            isExpired ? 'text-red-400' : 'text-green-400'
          }`}>
            {timeRemaining}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Status:</span>
          <span className={`font-semibold ${
            auction.status === AuctionStatus.Active ? 'text-green-400' :
            auction.status === AuctionStatus.Sold ? 'text-blue-400' :
            'text-red-400'
          }`}>
            {auction.status}
          </span>
        </div>
      </div>

      {/* My Bid Status (only in My Bids view) */}
      {myBidInfo && (
        <div className={`mb-3 p-2 rounded ${
          myBidInfo.isWinning ? 'bg-green-900 border border-green-600' : 'bg-red-900 border border-red-600'
        }`}>
          <div className="text-sm font-semibold">
            {myBidInfo.isWinning ? '✅ Winning' : '❌ Outbid'}
          </div>
          <div className="text-xs text-gray-300">
            Your bid: {myBidInfo.myBidAmount?.toLocaleString() || 'N/A'} Metal
          </div>
        </div>
      )}

      {/* Pricing */}
      <div className="mb-3 space-y-2">
        <div className="bg-gray-900 p-3 rounded">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Current Bid:</span>
            <span className="text-yellow-400 font-bold text-lg">
              {auction.currentBid.toLocaleString()} 💰
            </span>
          </div>
          {auction.highestBidder && (
            <div className="text-xs text-gray-500 mt-1">
              Highest bidder: {auction.highestBidder}
            </div>
          )}
        </div>

        {auction.buyoutPrice && (
          <div className="bg-blue-900 p-2 rounded">
            <div className="flex justify-between items-center">
              <span className="text-blue-200 text-sm">Buyout:</span>
              <span className="text-blue-200 font-bold">
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
          className="text-xs text-blue-400 hover:text-blue-300 mb-3 underline"
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
        <div className="bg-red-900 border border-red-600 text-red-200 text-xs p-2 rounded mb-3">
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
              className="flex-1 bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 text-sm"
              disabled={loading}
            />
            <button
              onClick={handlePlaceBid}
              disabled={loading}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-500 font-semibold text-sm disabled:opacity-50"
            >
              {loading ? '...' : 'Bid'}
            </button>
          </div>

          {/* Buyout Button */}
          {auction.buyoutPrice && (
            <button
              onClick={handleBuyout}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : '🛒 Buy Now'}
            </button>
          )}

          {/* Cancel Button (for seller only, shown in My Listings) */}
          {canCancel && !showMyBidStatus && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Cancelling...' : 'Cancel Auction'}
            </button>
          )}
        </div>
      )}

      {auction.status !== AuctionStatus.Active && (
        <div className="text-center text-gray-500 text-sm py-2">
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
