/**
 * AuctionHousePanel Component
 *
 * Created: 2025-01-17
 * Refactored: 2025-10-18 (FID-20251018-044 Phase 4)
 * Neon-noir structural pass: 2026-09-08 (FID-20260908-011)
 *
 * OVERVIEW:
 * Comprehensive auction marketplace interface featuring:
 * - Three view modes (Marketplace, My Listings, My Bids)
 * - Listing grid (AuctionListingCard)
 * - Advanced filters (category, price, sort, seller)
 * - Pagination with page controls
 * - Real-time loading and error states
 * - Create listing modal integration
 * - Responsive grid layout (1/2/3/4 columns)
 *
 * Styling: token primitives only (nn-panel / nn-tab / nn-input / nn-chip /
 * nn-btn); legacy bg-bg, border-border, and text-text utility families and
 * kit imports removed. Listing cards, the create-listing modal, and all
 * fetch/action logic are byte-preserved.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { extractApiError } from '@/lib/apiClient';
import { AuctionListing, MyBidAuctionView, MyBidEntry } from '@/types/auction.types';

import { AuctionListingCard } from './AuctionListingCard';
import { CreateListingModal } from './CreateListingModal';
import { useBearerStatus } from '@/hooks/useBearerStatus';
import { useIsMobile } from '@/hooks/useMediaQuery';
import {
  Store,
  Package,
  Target,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Swords,
  Wrench,
  Gift,
  Users,
  X
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface AuctionHousePanelProps {
  onClose: () => void;
}

type ViewMode = 'marketplace' | 'myListings' | 'myBids';
type CategoryTab = 'all' | 'units' | 'resources' | 'items';
type SortOption = 'price_asc' | 'price_desc' | 'ending_soon' | 'newly_listed';

// ============================================================
// MAIN COMPONENT
// ============================================================

export function AuctionHousePanel({ onClose }: AuctionHousePanelProps) {
  // ============================================================
  // STATE
  // ============================================================
  const [auctions, setAuctions] = useState<AuctionListing[] | MyBidAuctionView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('marketplace');
  const [showCreateModal, setShowCreateModal] = useState(false);
  // FID-20260912-077: bearer-aware — create/bid/buyout all 403 while holding.
  const { isBearer } = useBearerStatus();

  // Filter state
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newly_listed');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [hasBuyout, setHasBuyout] = useState<boolean | undefined>(undefined);
  const [sellerFilter, setSellerFilter] = useState('');

  // ============================================================
  // HOOKS
  // ============================================================
  const isMobile = useIsMobile();

  // ============================================================
  // API FUNCTIONS
  // ============================================================

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (activeTab === 'units') params.append('itemType', 'unit');
      if (activeTab === 'resources') params.append('itemType', 'resource');
      if (activeTab === 'items') params.append('itemType', 'tradeable');

      if (priceMin) params.append('minPrice', priceMin);
      if (priceMax) params.append('maxPrice', priceMax);

      if (hasBuyout !== undefined) params.append('hasBuyout', hasBuyout.toString());

      if (sellerFilter.trim()) params.append('seller', sellerFilter.trim());

      params.append('sortBy', sortBy);

      params.append('page', currentPage.toString());
      params.append('limit', '12');

      const response = await fetch(`/api/auction/list?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setAuctions(data.auctions || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setError(extractApiError(data, response.status));
      }
    } catch (err) {
      setError('Network error loading auctions');
      console.error('Error fetching auctions:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, priceMin, priceMax, hasBuyout, sellerFilter, sortBy, currentPage]);

  const fetchMyListings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auction/my-listings?page=${currentPage}&limit=12`);
      const data = await response.json();

      if (data.success) {
        setAuctions(data.auctions || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setError(extractApiError(data, response.status));
      }
    } catch (err) {
      setError('Network error loading listings');
      console.error('Error fetching my listings:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  const fetchMyBids = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auction/my-bids?page=${currentPage}&limit=12`);
      const data: { success: boolean; bids?: MyBidEntry[]; message?: string; totalCount?: number; totalPages?: number } = await response.json();

      if (data.success) {
        const auctionsWithStatus: MyBidAuctionView[] = (data.bids || []).map((bid) => ({
          ...bid.auction,
          myBidAmount: bid.myBid.bidAmount,
          isWinning: bid.isWinning
        }));
        setAuctions(auctionsWithStatus);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setError(extractApiError(data, response.status));
      }
    } catch (err) {
      setError('Network error loading bids');
      console.error('Error fetching my bids:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    if (viewMode === 'myListings') {
      fetchMyListings();
    } else if (viewMode === 'myBids') {
      fetchMyBids();
    } else {
      fetchAuctions();
    }
  }, [viewMode, activeTab, currentPage, sortBy, fetchAuctions, fetchMyListings, fetchMyBids]);

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  /**
   * Apply filter changes and refresh
   */
  const applyFilters = () => {
    setCurrentPage(1);
    fetchAuctions();
  };

  /**
   * Handle category tab change
   */
  const handleTabChange = (tab: CategoryTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  /**
   * Handle view mode change
   */
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    setCurrentPage(1);
    if (mode === 'marketplace') {
      setActiveTab('all');
    }
  };

  /**
   * Refresh current view after auction action
   */
  const handleAuctionUpdate = () => {
    if (viewMode === 'myListings') {
      fetchMyListings();
    } else if (viewMode === 'myBids') {
      fetchMyBids();
    } else {
      fetchAuctions();
    }
  };

  /**
   * Handle pagination navigation
   */
  const goToPreviousPage = () => {
    setCurrentPage(Math.max(1, currentPage - 1));
  };

  const goToNextPage = () => {
    setCurrentPage(Math.min(totalPages, currentPage + 1));
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
        <div
          className="nn-panel w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col"
          style={{ '--nn-accent': 'var(--nn-amber)' } as React.CSSProperties}
          role="dialog"
          aria-label="Auction house"
        >
          {/* Header — scanline instrument strip */}
          <div className="nn-panel__header nn-panel__header--amber">
            <span className="nn-panel__icon"><Store className="h-4 w-4" /></span>
            <span className="nn-panel__title">Auction House</span>
            <span className="nn-panel__meta">Player marketplace</span>
            <button
              onClick={onClose}
              className="ml-auto nn-abtn nn-abtn--ghost px-3"
              aria-label="Close auction house"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* View Mode Tabs — text-rule navigation */}
          <div className="flex border-b border-[color-mix(in_oklab,var(--nn-glass-border))] flex-wrap">
            <button
              onClick={() => handleViewChange('marketplace')}
              className={`nn-tab px-5 ${viewMode === 'marketplace' ? 'nn-tab--on' : ''}`}
            >
              <Store className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
              {!isMobile && 'Marketplace'}
            </button>
            <button
              onClick={() => handleViewChange('myListings')}
              className={`nn-tab px-5 ${viewMode === 'myListings' ? 'nn-tab--on' : ''}`}
            >
              <Package className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
              {!isMobile && 'My Listings'}
            </button>
            <button
              onClick={() => handleViewChange('myBids')}
              className={`nn-tab px-5 ${viewMode === 'myBids' ? 'nn-tab--on' : ''}`}
            >
              <Target className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
              {!isMobile && 'My Bids'}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              title={isBearer ? 'The Flag Bearer cannot auction while holding' : undefined}
              className="ml-auto nn-btn nn-btn--green self-center mr-3"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Listing
            </button>
          </div>

          {/* Bearer restriction banner (FID-20260912-077) */}
          {isBearer && (
            <div className="mx-4 mb-3 p-3 text-sm rounded-none bg-[color-mix(in_oklab,var(--nn-amber)_18%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_45%,transparent)] text-[color:var(--nn-amber)]">
              🚩 Flag Bearer restriction: listing, bidding, and buyouts are locked while you hold the Flag.
            </div>
          )}

          {/* Filters Panel (Marketplace only) */}
          {viewMode === 'marketplace' && (
            <div className="nn-surface--dark p-4 border-b border-[color-mix(in_oklab,var(--nn-glass-border))]">
              {/* Category Tabs */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="nn-panel__icon"><Filter className="w-4 h-4" /></span>
                <span className="nn-lab uppercase mr-2">Filter</span>
                <button
                  onClick={() => handleTabChange('all')}
                  className={`nn-tabchip px-3 ${activeTab === 'all' ? 'nn-tabchip--on' : ''}`}
                >
                  All Items
                </button>
                <button
                  onClick={() => handleTabChange('units')}
                  className={`nn-tabchip px-3 ${activeTab === 'units' ? 'nn-tabchip--on' : ''}`}
                >
                  <Swords className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
                  Units
                </button>
                <button
                  onClick={() => handleTabChange('resources')}
                  className={`nn-tabchip px-3 ${activeTab === 'resources' ? 'nn-tabchip--on' : ''}`}
                >
                  <Wrench className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
                  Resources
                </button>
                <button
                  onClick={() => handleTabChange('items')}
                  className={`nn-tabchip px-3 ${activeTab === 'items' ? 'nn-tabchip--on' : ''}`}
                >
                  <Gift className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
                  Items
                </button>
              </div>

              {/* Filter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Min Price */}
                <div>
                  <label className="nn-lab block mb-1">Min Price</label>
                  <input
                    type="number"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    placeholder="0"
                    className="nn-input w-full"
                  />
                </div>

                {/* Max Price */}
                <div>
                  <label className="nn-lab block mb-1">Max Price</label>
                  <input
                    type="number"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    placeholder="No limit"
                    className="nn-input w-full"
                  />
                </div>

                {/* Sort By */}
                <div>
                  <label className="nn-lab mb-1 flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="nn-input w-full"
                  >
                    <option value="newly_listed">Newly Listed</option>
                    <option value="ending_soon">Ending Soon</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </div>

                {/* Buyout Filter */}
                <div>
                  <label className="nn-lab block mb-1">Buyout Filter</label>
                  <select
                    value={hasBuyout === undefined ? 'all' : hasBuyout.toString()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setHasBuyout(val === 'all' ? undefined : val === 'true');
                    }}
                    className="nn-input w-full"
                  >
                    <option value="all">All Auctions</option>
                    <option value="true">Buyout Available</option>
                    <option value="false">Bid Only</option>
                  </select>
                </div>
              </div>

              {/* Seller Filter */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="nn-lab mb-1 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Seller Username
                  </label>
                  <input
                    type="text"
                    value={sellerFilter}
                    onChange={(e) => setSellerFilter(e.target.value)}
                    placeholder="Filter by seller…"
                    className="nn-input w-full"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={applyFilters}
                    className="nn-btn nn-btn--primary"
                  >
                    <Search className="w-4 h-4 mr-1" />
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results Info Bar */}
          <div className="nn-surface px-4 py-2 border-b border-[color-mix(in_oklab,var(--nn-glass-border))] flex items-center justify-between">
            <div className="nn-lab">
              {loading ? (
                <span>Loading…</span>
              ) : (
                <span className="flex items-center gap-2">
                  Showing <span className="nn-chip nn-chip--amber nn-num">{auctions.length}</span> of <span className="nn-chip nn-num">{totalCount}</span> auctions
                  {viewMode === 'myListings' && <span className="nn-chip nn-chip--cyan">Your Listings</span>}
                  {viewMode === 'myBids' && <span className="nn-chip nn-chip--violet">Your Bids</span>}
                </span>
              )}
            </div>
          </div>

          {/* Auction Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Error State */}
            {error && (
              <div className="nn-note" role="alert">
                <p className="nn-text-magenta text-sm">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <span className="nn-spin-icon h-7 w-7 mx-auto block" aria-label="Loading auctions" />
                <p className="nn-lab mt-4">Loading auctions…</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && auctions.length === 0 && (
              <div className="text-center py-12">
                <Store className="w-14 h-14 mx-auto mb-4 opacity-40 nn-text-dim" />
                <p className="text-lg nn-text-primary mb-2">No auctions found</p>
                <p className="nn-lab">Try adjusting your filters or create a new listing</p>
              </div>
            )}

            {/* Auction Listings Grid */}
            {!loading && auctions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {auctions.map((auction) => (
                  <div key={auction.auctionId} className="nn-fade">
                    <AuctionListingCard
                      auction={auction}
                      onUpdate={handleAuctionUpdate}
                      showMyBidStatus={viewMode === 'myBids'}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && auctions.length > 0 && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="nn-btn nn-btn--ghost"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>

                <span className="nn-lab">
                  Page <span className="nn-chip nn-chip--amber nn-num">{currentPage}</span> of <span className="nn-chip nn-num">{totalPages}</span>
                </span>

                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="nn-btn nn-btn--ghost"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Listing Modal */}
      {showCreateModal && (
        <CreateListingModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            handleAuctionUpdate();
          }}
        />
      )}
    </>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// STYLING (FID-20260908-011):
// - Token primitives only: nn-panel / nn-tab / nn-tabchip / nn-input /
//   nn-chip / nn-btn / nn-surface / nn-lab / nn-num
// - Gradient header strip replaced with scanline panel header
// - Legacy bg-bg-*/border-border-*/text-text-* classes removed
//
// FEATURES:
// - Three view modes: Marketplace, My Listings, My Bids (text-rule tabs)
// - Category filtering: All, Units, Resources, Items
// - Advanced filters: price range, sort, buyout, seller
// - Real-time loading and error states (gated nn-spin-icon)
// - Pagination with prev/next controls
// - Responsive grid (1/2/3/4 columns)
// - Create listing modal integration (byte-preserved)
// - Listing cards via AuctionListingCard (byte-preserved)
//
// PERFORMANCE:
// - Pagination limits to 12 items per page
// - Efficient re-fetching on filter/page changes
// ============================================================
// END OF FILE
// ============================================================
