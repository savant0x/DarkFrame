/**
 * AuctionHousePanel Component (Refactored)
 * 
 * Modern auction marketplace with animated listings
 * 
 * Created: 2025-01-17
 * Refactored: 2025-10-18 (FID-20251018-044 Phase 4)
 * 
 * OVERVIEW:
 * Comprehensive auction marketplace interface featuring:
 * - Three view modes (Marketplace, My Listings, My Bids)
 * - Animated listing grid with StaggerChildren
 * - Advanced filters (category, price, sort, seller)
 * - Pagination with page controls
 * - Real-time loading and error states
 * - Create listing modal integration
 * - Responsive grid layout (1/2/3/4 columns)
 * 
 * Design System Integration:
 * - Panel component for filter sections
 * - Button component for tabs and actions
 * - Badge component for auction counts and status
 * - Card component for individual listings (via AuctionListingCard)
 * - StaggerChildren for grid animations
 * - Input component for filters
 * - useIsMobile hook for responsive layout
 * - LoadingSpinner for loading states
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AuctionListing, AuctionItemType, AuctionSearchFilters } from '@/types/auction.types';
import { UnitType } from '@/types';
import { AuctionListingCard } from './AuctionListingCard';
import { CreateListingModal } from './CreateListingModal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Panel } from './ui/Panel';
import { Input } from './ui/Input';
import { StaggerChildren, StaggerItem } from './transitions/StaggerChildren';
import { LoadingSpinner } from './transitions/LoadingSpinner';
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
  Users
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
  const [auctions, setAuctions] = useState<AuctionListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('marketplace');
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  /**
   * Fetch auctions from marketplace with current filters
   */
  const fetchAuctions = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // Category filter
      if (activeTab === 'units') params.append('itemType', 'unit');
      if (activeTab === 'resources') params.append('itemType', 'resource');
      if (activeTab === 'items') params.append('itemType', 'tradeable');

      // Price filters
      if (priceMin) params.append('minPrice', priceMin);
      if (priceMax) params.append('maxPrice', priceMax);

      // Buyout filter
      if (hasBuyout !== undefined) params.append('hasBuyout', hasBuyout.toString());

      // Seller filter
      if (sellerFilter.trim()) params.append('seller', sellerFilter.trim());

      // Sorting
      params.append('sortBy', sortBy);

      // Pagination
      params.append('page', currentPage.toString());
      params.append('limit', '12');

      const response = await fetch(`/api/auction/list?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setAuctions(data.auctions || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setError(data.message || 'Failed to load auctions');
      }
    } catch (err) {
      setError('Network error loading auctions');
      console.error('Error fetching auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch user's active listings
   */
  const fetchMyListings = async () => {
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
        setError(data.message || 'Failed to load your listings');
      }
    } catch (err) {
      setError('Network error loading listings');
      console.error('Error fetching my listings:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch user's active bids
   */
  const fetchMyBids = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auction/my-bids?page=${currentPage}&limit=12`);
      const data = await response.json();

      if (data.success) {
        // Transform bid data to include winning status
        const auctionsWithStatus = (data.bids || []).map((bid: any) => ({
          ...bid.auction,
          myBidAmount: bid.myBid.bidAmount,
          isWinning: bid.isWinning
        }));
        setAuctions(auctionsWithStatus);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setError(data.message || 'Failed to load your bids');
      }
    } catch (err) {
      setError('Network error loading bids');
      console.error('Error fetching my bids:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // EFFECTS
  // ============================================================

  /**
   * Fetch data when view mode, filters, or page changes
   */
  useEffect(() => {
    if (viewMode === 'myListings') {
      fetchMyListings();
    } else if (viewMode === 'myBids') {
      fetchMyBids();
    } else {
      fetchAuctions();
    }
  }, [viewMode, activeTab, currentPage, sortBy]);

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
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
        <div className="bg-bg-primary border-2 border-accent-secondary rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-accent-secondary to-yellow-800 p-4 border-b-2 border-accent-secondary">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-yellow-200 flex items-center gap-2">
                <Store className="w-6 h-6" />
                Auction House
              </h2>
              <Button
                onClick={onClose}
                variant="danger"
                size="sm"
              >
                ×
              </Button>
            </div>

            {/* View Mode Tabs */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                onClick={() => handleViewChange('marketplace')}
                variant={viewMode === 'marketplace' ? 'primary' : 'secondary'}
                size="sm"
              >
                <Store className="w-4 h-4 mr-1" />
                {!isMobile && 'Marketplace'}
              </Button>
              <Button
                onClick={() => handleViewChange('myListings')}
                variant={viewMode === 'myListings' ? 'primary' : 'secondary'}
                size="sm"
              >
                <Package className="w-4 h-4 mr-1" />
                {!isMobile && 'My Listings'}
              </Button>
              <Button
                onClick={() => handleViewChange('myBids')}
                variant={viewMode === 'myBids' ? 'primary' : 'secondary'}
                size="sm"
              >
                <Target className="w-4 h-4 mr-1" />
                {!isMobile && 'My Bids'}
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                variant="success"
                size="sm"
                className="ml-auto"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Listing
              </Button>
            </div>
          </div>

          {/* Filters Panel (Marketplace only) */}
          {viewMode === 'marketplace' && (
            <div className="bg-bg-secondary p-4 border-b border-border-main">
              <Panel icon={<Filter className="w-5 h-5" />} title="Filters & Search">
                {/* Category Tabs */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    onClick={() => handleTabChange('all')}
                    variant={activeTab === 'all' ? 'primary' : 'secondary'}
                    size="sm"
                  >
                    All Items
                  </Button>
                  <Button
                    onClick={() => handleTabChange('units')}
                    variant={activeTab === 'units' ? 'primary' : 'secondary'}
                    size="sm"
                  >
                    <Swords className="w-4 h-4 mr-1" />
                    Units
                  </Button>
                  <Button
                    onClick={() => handleTabChange('resources')}
                    variant={activeTab === 'resources' ? 'primary' : 'secondary'}
                    size="sm"
                  >
                    <Wrench className="w-4 h-4 mr-1" />
                    Resources
                  </Button>
                  <Button
                    onClick={() => handleTabChange('items')}
                    variant={activeTab === 'items' ? 'primary' : 'secondary'}
                    size="sm"
                  >
                    <Gift className="w-4 h-4 mr-1" />
                    Items
                  </Button>
                </div>

                {/* Filter Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  {/* Min Price */}
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Min Price</label>
                    <input
                      type="number"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="0"
                      className="w-full bg-bg-tertiary text-text-primary border border-border-main rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    />
                  </div>

                  {/* Max Price */}
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Max Price</label>
                    <input
                      type="number"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="No limit"
                      className="w-full bg-bg-tertiary text-text-primary border border-border-main rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    />
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="text-sm text-text-secondary mb-1 flex items-center gap-1">
                      <ArrowUpDown className="w-4 h-4" />
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="w-full bg-bg-tertiary text-text-primary border border-border-main rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    >
                      <option value="newly_listed">Newly Listed</option>
                      <option value="ending_soon">Ending Soon</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                    </select>
                  </div>

                  {/* Buyout Filter */}
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Buyout Filter</label>
                    <select
                      value={hasBuyout === undefined ? 'all' : hasBuyout.toString()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHasBuyout(val === 'all' ? undefined : val === 'true');
                      }}
                      className="w-full bg-bg-tertiary text-text-primary border border-border-main rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-primary"
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
                    <label className="text-sm text-text-secondary mb-1 flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Seller Username
                    </label>
                    <input
                      type="text"
                      value={sellerFilter}
                      onChange={(e) => setSellerFilter(e.target.value)}
                      placeholder="Filter by seller..."
                      className="w-full bg-bg-tertiary text-text-primary border border-border-main rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={applyFilters}
                      variant="primary"
                    >
                      <Search className="w-4 h-4 mr-1" />
                      Apply
                    </Button>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* Results Info Bar */}
          <div className="bg-bg-secondary px-4 py-2 border-b border-border-main flex items-center justify-between">
            <div className="text-sm text-text-secondary">
              {loading ? (
                <span>Loading...</span>
              ) : (
                <span className="flex items-center gap-2">
                  Showing <Badge variant="primary">{auctions.length}</Badge> of <Badge variant="default">{totalCount}</Badge> auctions
                  {viewMode === 'myListings' && <Badge variant="info">Your Listings</Badge>}
                  {viewMode === 'myBids' && <Badge variant="warning">Your Bids</Badge>}
                </span>
              )}
            </div>
          </div>

          {/* Auction Grid */}
          <div className="flex-1 overflow-y-auto p-4 bg-bg-primary">
            {/* Error State */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 text-red-400 p-4 rounded-lg mb-4">
                {error}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <LoadingSpinner size="lg" variant="spin" />
                <p className="text-text-secondary mt-4">Loading auctions...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && auctions.length === 0 && (
              <div className="text-center text-text-secondary py-12">
                <Store className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-xl mb-2">No auctions found</p>
                <p className="text-sm">Try adjusting your filters or create a new listing</p>
              </div>
            )}

            {/* Auction Listings Grid */}
            {!loading && auctions.length > 0 && (
              <StaggerChildren
                staggerDelay={0.05}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {auctions.map((auction) => (
                  <StaggerItem key={auction.auctionId}>
                    <AuctionListingCard
                      auction={auction}
                      onUpdate={handleAuctionUpdate}
                      showMyBidStatus={viewMode === 'myBids'}
                    />
                  </StaggerItem>
                ))}
              </StaggerChildren>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-bg-secondary p-4 border-t border-border-main flex justify-center items-center gap-4">
              <Button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                variant="secondary"
                size="sm"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              
              <span className="text-text-secondary text-sm">
                Page <Badge variant="primary">{currentPage}</Badge> of <Badge variant="default">{totalPages}</Badge>
              </span>
              
              <Button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                variant="secondary"
                size="sm"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
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
// USAGE EXAMPLE:
// ============================================================
// import { AuctionHousePanel } from '@/components/AuctionHousePanel';
// 
// <AuctionHousePanel onClose={() => setShowAuction(false)} />
// ============================================================

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// DESIGN SYSTEM INTEGRATION:
// - Button: View mode tabs, category filters, pagination with variants
// - Badge: Auction counts, status indicators, page numbers
// - Panel: Filters section with icon and collapsible structure
// - StaggerChildren: Animated auction grid with 50ms stagger
// - LoadingSpinner: Centered loading state with spin variant
// - useIsMobile: Hide text labels on mobile for compact tabs
// 
// ANIMATIONS:
// - Stagger animation on auction grid (0.05s delay per card)
// - Smooth view mode transitions
// - Loading spinner with spin animation
// - Hover effects on cards (via AuctionListingCard)
// 
// FEATURES:
// - Three view modes: Marketplace, My Listings, My Bids
// - Category filtering: All, Units, Resources, Items
// - Advanced filters: price range, sort, buyout, seller
// - Real-time loading and error states
// - Pagination with prev/next controls
// - Responsive grid (1/2/3/4 columns)
// - Create listing modal integration
// - Empty state with helpful message
// - Results count with badges
// 
// PERFORMANCE:
// - Pagination limits to 12 items per page
// - Efficient re-fetching on filter/page changes
// - Debounce could be added to filter inputs
// - React Query would improve caching/state management
// ============================================================
// END OF FILE
// ============================================================
