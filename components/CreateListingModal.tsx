/**
 * @file components/CreateListingModal.tsx
 * @created 2025-01-17
 * @rewritten 2026-09-19 (FID-20260919-001: unit listings require a REAL owned
 *              unit — picker over the seller's army; the client no longer
 *              supplies unit stats at all, the server derives them from the
 *              escrowed unit)
 * @overview Modal for creating new auction listings
 * 
 * OVERVIEW:
 * Form modal for creating auction listings. Allows player to select item type
 * (unit, resource, tradeable), choose specific item, set pricing (starting bid,
 * buyout, reserve), select duration (12/24/48h), and preview listing fees.
 * Validates all inputs and displays upfront listing fee before confirmation.
 */

'use client';

import React, { useState } from 'react';
import { extractApiError } from '@/lib/apiClient';
import { useGameContext } from '@/context/GameContext';
import { AuctionItemType, ResourceType, AUCTION_CONFIG, CreateAuctionRequest, AuctionItem } from '@/types/auction.types';
import { ItemType, type InventoryItem } from '@/types/game.types';

interface CreateListingModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateListingModal({ onClose, onSuccess }: CreateListingModalProps) {
  const { player } = useGameContext();
  // FID-20260919-001: only REAL owned units can be listed — the escrow contract
  // (FID-20260914-003) freezes the seller's unit object into the listing, so a
  // unitType-only synthetic listing could never escrow (and must never exist).
  const ownedUnits = player?.units ?? [];
  // FID-20260919-009: real tradeable instances from the seller's inventory —
  // the item picker lists what can actually be escrowed (whole instances, D2b).
  const ownedTradeables = (player?.inventory?.items ?? [])
    .filter((it): it is InventoryItem => 'foundAt' in it)
    .filter((it) => it.type === ItemType.TradeableItem);
  const [tradeableIds, setTradeableIds] = useState<string[]>([]);

  // Form state
  const [itemType, setItemType] = useState<AuctionItemType>(AuctionItemType.Resource);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Resource listing state
  const [resourceType, setResourceType] = useState<ResourceType>(ResourceType.Metal);
  const [resourceAmount, setResourceAmount] = useState('1000');
  
  // Unit listing state: value is the unitId of a real owned unit
  const [unitId, setUnitId] = useState<string>('');
  
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
    
    if (itemType === AuctionItemType.Unit && !unitId) {
      return 'Select a unit to list';
    }
    
    if (itemType === AuctionItemType.TradeableItem && tradeableIds.length === 0) {
      return 'Select at least one item to list';
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
      // FID-20260919-001: unitId only — stat fields are server-derived from the
      // escrowed unit; nothing client-supplied is stored or displayed.
      return {
        itemType: AuctionItemType.Unit,
        unitId,
        unitType: ownedUnits.find((u) => u.unitId === unitId)?.unitType,
      };
    } else {
      // FID-20260919-009: instance ids + quantity — the snapshot is server-derived.
      return {
        itemType: AuctionItemType.TradeableItem,
        tradeableItemIds: tradeableIds,
        tradeableItemQuantity: tradeableIds.length,
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
        setError(extractApiError(data, response.status));
      }
    } catch (err) {
      setError('Network error creating auction');
      console.error('Error creating auction:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[color:var(--nn-void)] bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] border-2 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[color:var(--nn-amber)] to-[color:var(--nn-amber)] p-4 border-b-2 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] sticky top-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-[color:var(--nn-amber)]">➕ Create Auction Listing</h2>
            <button
              onClick={onClose}
              className="text-[color:var(--nn-amber)] hover:text-[color:var(--nn-text-primary)] text-2xl font-bold px-3 py-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] rounded-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] text-[color:var(--nn-magenta)] p-3 rounded-none">
              {error}
            </div>
          )}

          {/* Item Type Selection */}
          <div>
            <label className="block text-[color:var(--nn-text-secondary)] font-semibold mb-2">
              Item Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setItemType(AuctionItemType.Resource)}
                className={`p-4 rounded-none border-2 transition-colors ${
                  itemType === AuctionItemType.Resource
                    ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-opacity-30'
                    : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                }`}
              >
                <div className="text-3xl mb-2">💎</div>
                <div className="text-[color:var(--nn-text-primary)] font-semibold">Resources</div>
                <div className="text-xs text-[color:var(--nn-text-secondary)]">Metal, Energy</div>
              </button>
              
              <button
                onClick={() => setItemType(AuctionItemType.Unit)}
                className={`p-4 rounded-none border-2 transition-colors ${
                  itemType === AuctionItemType.Unit
                    ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-opacity-30'
                    : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                }`}
              >
                <div className="text-3xl mb-2">⚔️</div>
                <div className="text-[color:var(--nn-text-primary)] font-semibold">Units</div>
                <div className="text-xs text-[color:var(--nn-text-secondary)]">Combat units</div>
              </button>
              
              <button
                onClick={() => setItemType(AuctionItemType.TradeableItem)}
                className={`p-4 rounded-none border-2 transition-colors ${
                  itemType === AuctionItemType.TradeableItem
                    ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-opacity-30'
                    : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                }`}
              >
                <div className="text-3xl mb-2">🎁</div>
                <div className="text-[color:var(--nn-text-primary)] font-semibold">Items</div>
                <div className="text-xs text-[color:var(--nn-text-secondary)]">Found items</div>
              </button>
            </div>
          </div>

          {/* Resource Selection */}
          {itemType === AuctionItemType.Resource && (
            <div className="space-y-4">
              <div>
                <label className="block text-[color:var(--nn-text-secondary)] font-semibold mb-2">
                  Resource Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setResourceType(ResourceType.Metal)}
                    className={`p-3 rounded-none border-2 transition-colors ${
                      resourceType === ResourceType.Metal
                        ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-opacity-30'
                        : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                    }`}
                  >
                    ⛏️ Metal
                  </button>
                  <button
                    onClick={() => setResourceType(ResourceType.Energy)}
                    className={`p-3 rounded-none border-2 transition-colors ${
                      resourceType === ResourceType.Energy
                        ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-opacity-30'
                        : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                    }`}
                  >
                    ⚡ Energy
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-[color:var(--nn-text-secondary)] font-semibold mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  value={resourceAmount}
                  onChange={(e) => setResourceAmount(e.target.value)}
                  className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-primary)] border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none px-4 py-3 focus:border-yellow-600 outline-none"
                  placeholder="1000"
                  min="1"
                />
                <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                  Minimum: 1 | Will be deducted from inventory
                </p>
              </div>
            </div>
          )}

          {/* Unit Selection — the seller's REAL units (FID-20260919-001) */}
          {itemType === AuctionItemType.Unit && (
            <div>
              <label className="block text-[color:var(--nn-text-secondary)] font-semibold mb-2">
                Select Unit from Your Army *
              </label>
              {ownedUnits.length === 0 ? (
                <p className="text-sm text-[color:var(--nn-text-secondary)] p-3 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none">
                  You have no units to list. Build units at your factory first.
                </p>
              ) : (
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-primary)] border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none px-4 py-3 focus:border-yellow-600 outline-none"
                >
                  <option value="">— Choose a unit —</option>
                  {ownedUnits.map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      {u.name}{u.quantity > 1 ? ` ×${u.quantity}` : ''} — STR {u.strength} / DEF {u.defense}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                Listing escrows the unit (it leaves your army until sold or the auction ends).
              </p>
            </div>
          )}

          {/* Tradeable Item Selection — the seller's REAL found items (FID-20260919-009) */}
          {itemType === AuctionItemType.TradeableItem && (
            <div>
              <label className="block text-[color:var(--nn-text-secondary)] font-semibold mb-2">
                Select Items from Your Inventory *
              </label>
              {ownedTradeables.length === 0 ? (
                <p className="text-sm text-[color:var(--nn-text-secondary)] p-3 border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none">
                  You have no found items to list. Search caves to find tradeable items first.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-2">
                  {ownedTradeables.map((it) => {
                    const checked = tradeableIds.includes(it.id);
                    return (
                      <label
                        key={it.id}
                        className={`flex items-center gap-3 p-2 cursor-pointer border transition-colors ${
                          checked
                            ? 'border-[color-mix(in_oklab,var(--nn-amber)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_10%,transparent)]'
                            : 'border-transparent hover:bg-[color-mix(in_oklab,var(--nn-cyan)_8%,transparent)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setTradeableIds((prev) =>
                              e.target.checked ? [...prev, it.id] : prev.filter((id) => id !== it.id)
                            )
                          }
                          className="accent-[color:var(--nn-amber)]"
                        />
                        <span className="text-[color:var(--nn-text-primary)] font-medium flex-1">{it.name}</span>
                        <span className="text-xs text-[color:var(--nn-text-secondary)]">{it.rarity}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                Listing escrows the item(s) (they leave your inventory until sold or the auction ends —
                they can't be used at the Shrine while listed).
              </p>
            </div>
          )}

          {/* Pricing Section */}
          <div className="space-y-4 border-t-2 border-[color-mix(in_oklab,var(--nn-cyan)_12%,transparent)] pt-4">
            <h3 className="text-lg font-bold text-[color:var(--nn-amber)]">Pricing</h3>
            
            <div>
              <label className="block text-[color:var(--nn-text-secondary)] font-semibold mb-2">
                Starting Bid * <span className="text-[color:var(--nn-amber)]">💰</span>
              </label>
              <input
                type="number"
                value={startingBid}
                onChange={(e) => setStartingBid(e.target.value)}
                className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-primary)] border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none px-4 py-3 focus:border-yellow-600 outline-none"
                placeholder="1000"
                min={AUCTION_CONFIG.MIN_STARTING_BID}
                max={AUCTION_CONFIG.MAX_STARTING_BID}
              />
              <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                Range: {AUCTION_CONFIG.MIN_STARTING_BID.toLocaleString()} - {AUCTION_CONFIG.MAX_STARTING_BID.toLocaleString()} Metal
              </p>
            </div>
            
            <div>
              <label className="block text-[color:var(--nn-text-secondary)] font-semibold mb-2">
                Buyout Price (Optional) <span className="text-[color:var(--nn-cyan)]">💰</span>
              </label>
              <input
                type="number"
                value={buyoutPrice}
                onChange={(e) => setBuyoutPrice(e.target.value)}
                className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-primary)] border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none px-4 py-3 focus:border-yellow-600 outline-none"
                placeholder="Leave empty for bid-only"
              />
              <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                Instant purchase price (must exceed starting bid)
              </p>
            </div>
            
            <div>
              <label className="block text-[color:var(--nn-text-secondary)] font-semibold mb-2">
                Reserve Price (Optional) <span className="text-[color:var(--nn-magenta)]">💰</span>
              </label>
              <input
                type="number"
                value={reservePrice}
                onChange={(e) => setReservePrice(e.target.value)}
                className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] text-[color:var(--nn-text-primary)] border-2 border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none px-4 py-3 focus:border-yellow-600 outline-none"
                placeholder="Leave empty for no reserve"
              />
              <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                Hidden minimum price (auction fails if not met)
              </p>
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="block text-[color:var(--nn-text-secondary)] font-semibold mb-2">
              Auction Duration *
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setDuration(12)}
                className={`p-3 rounded-none border-2 transition-colors ${
                  duration === 12
                    ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-opacity-30'
                    : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                }`}
              >
                <div className="text-[color:var(--nn-text-primary)] font-semibold">12 Hours</div>
                <div className="text-xs text-[color:var(--nn-text-secondary)]">Fee: {AUCTION_CONFIG.LISTING_FEE_12H} 💰</div>
              </button>
              <button
                onClick={() => setDuration(24)}
                className={`p-3 rounded-none border-2 transition-colors ${
                  duration === 24
                    ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-opacity-30'
                    : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                }`}
              >
                <div className="text-[color:var(--nn-text-primary)] font-semibold">24 Hours</div>
                <div className="text-xs text-[color:var(--nn-text-secondary)]">Fee: {AUCTION_CONFIG.LISTING_FEE_24H} 💰</div>
              </button>
              <button
                onClick={() => setDuration(48)}
                className={`p-3 rounded-none border-2 transition-colors ${
                  duration === 48
                    ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-opacity-30'
                    : 'border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)]'
                }`}
              >
                <div className="text-[color:var(--nn-text-primary)] font-semibold">48 Hours</div>
                <div className="text-xs text-[color:var(--nn-text-secondary)]">Fee: {AUCTION_CONFIG.LISTING_FEE_48H} 💰</div>
              </button>
            </div>
          </div>

          {/* Fee Summary */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-2 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-4">
            <h4 className="font-bold text-[color:var(--nn-amber)] mb-3">💰 Fee Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[color:var(--nn-text-secondary)]">Listing Fee (upfront):</span>
                <span className="text-[color:var(--nn-text-primary)] font-semibold">{getListingFee()} Metal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--nn-text-secondary)]">Sale Fee (if sold):</span>
                <span className="text-[color:var(--nn-text-primary)] font-semibold">{(AUCTION_CONFIG.PUBLIC_SALE_FEE * 100).toFixed(0)}% of final price</span>
              </div>
              <div className="text-xs text-[color:var(--nn-text-secondary)] mt-2 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] pt-2">
                ⚠️ Listing fee is non-refundable, even if you cancel the auction
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-primary)] rounded-none bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-semibold disabled:opacity-50"
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
// - Three item types: Resources (full), Units (real owned units), Items (Phase 5)
// - Resource selection: Metal or Energy with quantity input
// - Unit selection: FID-20260919-001 — picker over the seller's actual army;
//   stat fields are server-derived from the escrowed unit (never client-supplied)
// - Pricing: Starting bid (required), buyout (optional), reserve (optional)
// - Duration: 12/24/48 hours with corresponding listing fees
// - Fee preview: Shows upfront listing fee and future sale fee
// - Validation: All inputs validated before submission
// - Non-refundable fee warning displayed prominently
// ============================================================
// END OF FILE
// ============================================================
