/**
 * @file components/CreateListingModal.tsx
 * @created 2025-01-17
 * @overview Modal for creating new auction listings
 * 
 * OVERVIEW:
 * Form modal for creating auction listings. Allows player to select item type
 * (unit, resource, tradeable), choose specific item, set pricing (starting bid,
 * buyout, reserve), select duration (12/24/48h), and preview listing fees.
 * Validates all inputs and displays upfront listing fee before confirmation.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AuctionItemType, ResourceType, AUCTION_CONFIG, CreateAuctionRequest, AuctionItem } from '@/types/auction.types';
import { UnitType } from '@/types';

interface CreateListingModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateListingModal({ onClose, onSuccess }: CreateListingModalProps) {
  // Form state
  const [itemType, setItemType] = useState<AuctionItemType>(AuctionItemType.Resource);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Resource listing state
  const [resourceType, setResourceType] = useState<ResourceType>(ResourceType.Metal);
  const [resourceAmount, setResourceAmount] = useState('1000');
  
  // Unit listing state (Phase 4 - simplified, full implementation needs player's units)
  const [unitType, setUnitType] = useState<UnitType>(UnitType.T1_Rifleman);
  
  // Pricing state
  const [startingBid, setStartingBid] = useState('1000');
  const [buyoutPrice, setBuyoutPrice] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [duration, setDuration] = useState<12 | 24 | 48>(24);
  
  /**
   * Calculate listing fee based on duration
   */
  const getListingFee = () => {
    if (duration === 12) return AUCTION_CONFIG.LISTING_FEE_12H;
    if (duration === 24) return AUCTION_CONFIG.LISTING_FEE_24H;
    if (duration === 48) return AUCTION_CONFIG.LISTING_FEE_48H;
    return 0;
  };

  /**
   * Validate form inputs
   */
  const validateForm = (): string | null => {
    const startBid = parseInt(startingBid, 10);
    
    if (isNaN(startBid) || startBid < AUCTION_CONFIG.MIN_STARTING_BID) {
      return `Starting bid must be at least ${AUCTION_CONFIG.MIN_STARTING_BID}`;
    }
    
    if (startBid > AUCTION_CONFIG.MAX_STARTING_BID) {
      return `Starting bid cannot exceed ${AUCTION_CONFIG.MAX_STARTING_BID.toLocaleString()}`;
    }
    
    if (buyoutPrice) {
      const buyout = parseInt(buyoutPrice, 10);
      if (isNaN(buyout) || buyout <= startBid) {
        return 'Buyout price must be greater than starting bid';
      }
    }
    
    if (reservePrice) {
      const reserve = parseInt(reservePrice, 10);
      if (isNaN(reserve) || reserve < startBid) {
        return 'Reserve price must be at least the starting bid';
      }
    }
    
    if (itemType === AuctionItemType.Resource) {
      const amount = parseInt(resourceAmount, 10);
      if (isNaN(amount) || amount <= 0) {
        return 'Resource amount must be greater than 0';
      }
    }
    
    return null;
  };

  /**
   * Build AuctionItem from form inputs
   */
  const buildAuctionItem = (): AuctionItem => {
    if (itemType === AuctionItemType.Resource) {
      return {
        itemType: AuctionItemType.Resource,
        resourceType,
        resourceAmount: parseInt(resourceAmount, 10)
      };
    } else if (itemType === AuctionItemType.Unit) {
      return {
        itemType: AuctionItemType.Unit,
        unitType,
        unitStrength: 100, // TODO: Get from actual unit data
        unitDefense: 50
      };
    } else {
      // TradeableItem (Phase 5)
      return {
        itemType: AuctionItemType.TradeableItem,
        tradeableItemQuantity: 1
      };
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    // Validate inputs
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const request: CreateAuctionRequest = {
        item: buildAuctionItem(),
        startingBid: parseInt(startingBid, 10),
        buyoutPrice: buyoutPrice ? parseInt(buyoutPrice, 10) : undefined,
        reservePrice: reservePrice ? parseInt(reservePrice, 10) : undefined,
        duration,
        clanOnly: false // Phase 5 feature
      };

      const response = await fetch('/api/auction/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.message || 'Failed to create auction');
      }
    } catch (err) {
      setError('Network error creating auction');
      console.error('Error creating auction:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-yellow-600 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-900 to-yellow-800 p-4 border-b-2 border-yellow-600 sticky top-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-yellow-200">➕ Create Auction Listing</h2>
            <button
              onClick={onClose}
              className="text-yellow-200 hover:text-white text-2xl font-bold px-3 py-1 hover:bg-red-900 rounded"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 p-3 rounded">
              {error}
            </div>
          )}

          {/* Item Type Selection */}
          <div>
            <label className="block text-gray-300 font-semibold mb-2">
              Item Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setItemType(AuctionItemType.Resource)}
                className={`p-4 rounded border-2 transition-colors ${
                  itemType === AuctionItemType.Resource
                    ? 'border-yellow-600 bg-yellow-900 bg-opacity-30'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="text-3xl mb-2">💎</div>
                <div className="text-white font-semibold">Resources</div>
                <div className="text-xs text-gray-400">Metal, Energy</div>
              </button>
              
              <button
                onClick={() => setItemType(AuctionItemType.Unit)}
                className={`p-4 rounded border-2 transition-colors ${
                  itemType === AuctionItemType.Unit
                    ? 'border-yellow-600 bg-yellow-900 bg-opacity-30'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="text-3xl mb-2">⚔️</div>
                <div className="text-white font-semibold">Units</div>
                <div className="text-xs text-gray-400">Combat units</div>
              </button>
              
              <button
                disabled
                className="p-4 rounded border-2 border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed"
              >
                <div className="text-3xl mb-2">🎁</div>
                <div className="text-white font-semibold">Items</div>
                <div className="text-xs text-gray-400">Phase 5</div>
              </button>
            </div>
          </div>

          {/* Resource Selection */}
          {itemType === AuctionItemType.Resource && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 font-semibold mb-2">
                  Resource Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setResourceType(ResourceType.Metal)}
                    className={`p-3 rounded border-2 transition-colors ${
                      resourceType === ResourceType.Metal
                        ? 'border-yellow-600 bg-yellow-900 bg-opacity-30'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    ⛏️ Metal
                  </button>
                  <button
                    onClick={() => setResourceType(ResourceType.Energy)}
                    className={`p-3 rounded border-2 transition-colors ${
                      resourceType === ResourceType.Energy
                        ? 'border-yellow-600 bg-yellow-900 bg-opacity-30'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    ⚡ Energy
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 font-semibold mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  value={resourceAmount}
                  onChange={(e) => setResourceAmount(e.target.value)}
                  className="w-full bg-gray-800 text-white border-2 border-gray-700 rounded px-4 py-3 focus:border-yellow-600 outline-none"
                  placeholder="1000"
                  min="1"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Minimum: 1 | Will be deducted from inventory
                </p>
              </div>
            </div>
          )}

          {/* Unit Selection (Simplified for Phase 4) */}
          {itemType === AuctionItemType.Unit && (
            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Unit Type *
              </label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as UnitType)}
                className="w-full bg-gray-800 text-white border-2 border-gray-700 rounded px-4 py-3 focus:border-yellow-600 outline-none"
              >
                <option value={UnitType.T1_Rifleman}>T1 Rifleman</option>
                <option value={UnitType.T1_Scout}>T1 Scout</option>
                <option value={UnitType.T1_Grenadier}>T1 Grenadier</option>
                <option value={UnitType.T2_Commando}>T2 Commando</option>
                <option value={UnitType.T2_Ranger}>T2 Ranger</option>
                <option value={UnitType.T3_Striker}>T3 Striker</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Full unit selection from inventory coming in Phase 4 enhancement
              </p>
            </div>
          )}

          {/* Pricing Section */}
          <div className="space-y-4 border-t-2 border-gray-800 pt-4">
            <h3 className="text-lg font-bold text-yellow-200">Pricing</h3>
            
            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Starting Bid * <span className="text-yellow-400">💰</span>
              </label>
              <input
                type="number"
                value={startingBid}
                onChange={(e) => setStartingBid(e.target.value)}
                className="w-full bg-gray-800 text-white border-2 border-gray-700 rounded px-4 py-3 focus:border-yellow-600 outline-none"
                placeholder="1000"
                min={AUCTION_CONFIG.MIN_STARTING_BID}
                max={AUCTION_CONFIG.MAX_STARTING_BID}
              />
              <p className="text-xs text-gray-400 mt-1">
                Range: {AUCTION_CONFIG.MIN_STARTING_BID.toLocaleString()} - {AUCTION_CONFIG.MAX_STARTING_BID.toLocaleString()} Metal
              </p>
            </div>
            
            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Buyout Price (Optional) <span className="text-blue-400">💰</span>
              </label>
              <input
                type="number"
                value={buyoutPrice}
                onChange={(e) => setBuyoutPrice(e.target.value)}
                className="w-full bg-gray-800 text-white border-2 border-gray-700 rounded px-4 py-3 focus:border-yellow-600 outline-none"
                placeholder="Leave empty for bid-only"
              />
              <p className="text-xs text-gray-400 mt-1">
                Instant purchase price (must exceed starting bid)
              </p>
            </div>
            
            <div>
              <label className="block text-gray-300 font-semibold mb-2">
                Reserve Price (Optional) <span className="text-red-400">💰</span>
              </label>
              <input
                type="number"
                value={reservePrice}
                onChange={(e) => setReservePrice(e.target.value)}
                className="w-full bg-gray-800 text-white border-2 border-gray-700 rounded px-4 py-3 focus:border-yellow-600 outline-none"
                placeholder="Leave empty for no reserve"
              />
              <p className="text-xs text-gray-400 mt-1">
                Hidden minimum price (auction fails if not met)
              </p>
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="block text-gray-300 font-semibold mb-2">
              Auction Duration *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setDuration(12)}
                className={`p-3 rounded border-2 transition-colors ${
                  duration === 12
                    ? 'border-yellow-600 bg-yellow-900 bg-opacity-30'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="text-white font-semibold">12 Hours</div>
                <div className="text-xs text-gray-400">Fee: {AUCTION_CONFIG.LISTING_FEE_12H} 💰</div>
              </button>
              <button
                onClick={() => setDuration(24)}
                className={`p-3 rounded border-2 transition-colors ${
                  duration === 24
                    ? 'border-yellow-600 bg-yellow-900 bg-opacity-30'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="text-white font-semibold">24 Hours</div>
                <div className="text-xs text-gray-400">Fee: {AUCTION_CONFIG.LISTING_FEE_24H} 💰</div>
              </button>
              <button
                onClick={() => setDuration(48)}
                className={`p-3 rounded border-2 transition-colors ${
                  duration === 48
                    ? 'border-yellow-600 bg-yellow-900 bg-opacity-30'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="text-white font-semibold">48 Hours</div>
                <div className="text-xs text-gray-400">Fee: {AUCTION_CONFIG.LISTING_FEE_48H} 💰</div>
              </button>
            </div>
          </div>

          {/* Fee Summary */}
          <div className="bg-gray-800 border-2 border-yellow-600 rounded p-4">
            <h4 className="font-bold text-yellow-200 mb-3">💰 Fee Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Listing Fee (upfront):</span>
                <span className="text-white font-semibold">{getListingFee()} Metal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sale Fee (if sold):</span>
                <span className="text-white font-semibold">{(AUCTION_CONFIG.PUBLIC_SALE_FEE * 100).toFixed(0)}% of final price</span>
              </div>
              <div className="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">
                ⚠️ Listing fee is non-refundable, even if you cancel the auction
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-700 text-white rounded hover:bg-gray-600 font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded hover:bg-yellow-500 font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating...' : `Create Listing (${getListingFee()} 💰)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Three item types: Resources (full), Units (simplified), Items (Phase 5)
// - Resource selection: Metal or Energy with quantity input
// - Unit selection: Basic unit type picker (full inventory integration Phase 4+)
// - Pricing: Starting bid (required), buyout (optional), reserve (optional)
// - Duration: 12/24/48 hours with corresponding listing fees
// - Fee preview: Shows upfront listing fee and future sale fee
// - Validation: All inputs validated before submission
// - Non-refundable fee warning displayed prominently
// ============================================================
// END OF FILE
// ============================================================
