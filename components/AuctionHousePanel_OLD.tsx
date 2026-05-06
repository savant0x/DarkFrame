/**
 * @file components/AuctionHousePanel.tsx
 * @created 2025-01-17
 * @overview Auction house marketplace panel with search, filters, and bidding
 * 
 * OVERVIEW:
 * Main auction marketplace interface. Displays active auctions with search and
 * filter controls. Supports item type filtering (units, resources, tradeable),
 * price range filtering, sorting options, and pagination. Shows auction cards
 * with current bids, time remaining, and action buttons.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AuctionListing, AuctionItemType, AuctionSearchFilters } from '@/types/auction.types';
import { UnitType } from '@/types';
import { AuctionListingCard } from './AuctionListingCard';
import { CreateListingModal } from './CreateListingModal';

interface AuctionHousePanelProps {
  onClose: () => void;
}

export function AuctionHousePanel({ onClose }: AuctionHousePanelProps) {
  // State management
  const [auctions, setAuctions] = useState<AuctionListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter state
  const [activeTab, setActiveTab] = useState<'all' | 'units' | 'resources' | 'items'>('all');
  const [searchFilters, setSearchFilters] = useState<AuctionSearchFilters>({
    page: 1,
    limit: 12
  });
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'ending_soon' | 'newly_listed'>('newly_listed');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [hasBuyout, setHasBuyout] = useState<boolean | undefined>(undefined);
  const [sellerFilter, setSellerFilter] = useState('');
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMyListings, setShowMyListings] = useState(false);
  const [showMyBids, setShowMyBids] = useState(false);

  /**
   * Fetch auctions from API with current filters
   */
  const fetchAuctions = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      // Tab-based item type filter
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
   * Fetch my listings
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
   * Fetch my bids
   */
  const fetchMyBids = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auction/my-bids?page=${currentPage}&limit=12`);
      const data = await response.json();

      if (data.success) {
        // Transform bid data to auction listings with winning status
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

  // Fetch auctions when filters change
  useEffect(() => {
    if (showMyListings) {
      fetchMyListings();
    } else if (showMyBids) {
      fetchMyBids();
    } else {
      fetchAuctions();
    }
  }, [activeTab, currentPage, sortBy, showMyListings, showMyBids]);

  /**
   * Handle filter application
   */
  const applyFilters = () => {
    setCurrentPage(1); // Reset to first page
    fetchAuctions();
  };

  /**
   * Handle successful bid/buyout/listing
   */
  const handleAuctionUpdate = () => {
    // Refresh current view
    if (showMyListings) {
      fetchMyListings();
    } else if (showMyBids) {
      fetchMyBids();
    } else {
      fetchAuctions();
    }
  };

  /**
   * Handle tab change
   */
  const handleTabChange = (tab: 'all' | 'units' | 'resources' | 'items') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  /**
   * Handle view mode change
   */
  const handleViewChange = (view: 'marketplace' | 'myListings' | 'myBids') => {
    setCurrentPage(1);
    setShowMyListings(view === 'myListings');
    setShowMyBids(view === 'myBids');
    if (view === 'marketplace') {
      setActiveTab('all');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-yellow-600 rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-900 to-yellow-800 p-4 border-b-2 border-yellow-600">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-yellow-200">🏛️ Auction House</h2>
            <button
              onClick={onClose}
              className="text-yellow-200 hover:text-white text-2xl font-bold px-3 py-1 hover:bg-red-900 rounded"
            >
              ×
            </button>
          </div>
          
          {/* View Mode Tabs */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleViewChange('marketplace')}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                !showMyListings && !showMyBids
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🏪 Marketplace
            </button>
            <button
              onClick={() => handleViewChange('myListings')}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                showMyListings
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📋 My Listings
            </button>
            <button
              onClick={() => handleViewChange('myBids')}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                showMyBids
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🎯 My Bids
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="ml-auto px-4 py-2 rounded font-semibold bg-green-700 text-white hover:bg-green-600 transition-colors"
            >
              ➕ Create Listing
            </button>
          </div>
        </div>

        {/* Filters (only show in marketplace view) */}
        {!showMyListings && !showMyBids && (
          <div className="bg-gray-800 p-4 border-b border-gray-700">
            {/* Category Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => handleTabChange('all')}
                className={`px-4 py-2 rounded ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All Items
              </button>
              <button
                onClick={() => handleTabChange('units')}
                className={`px-4 py-2 rounded ${
                  activeTab === 'units'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                ⚔️ Units
              </button>
              <button
                onClick={() => handleTabChange('resources')}
                className={`px-4 py-2 rounded ${
                  activeTab === 'resources'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                💎 Resources
              </button>
              <button
                onClick={() => handleTabChange('items')}
                className={`px-4 py-2 rounded ${
                  activeTab === 'items'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🎁 Items
              </button>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Price Range */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Min Price</label>
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="0"
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Max Price</label>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="No limit"
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
                />
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
                >
                  <option value="newly_listed">Newly Listed</option>
                  <option value="ending_soon">Ending Soon</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>

              {/* Buyout Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Buyout Only</label>
                <select
                  value={hasBuyout === undefined ? 'all' : hasBuyout.toString()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHasBuyout(val === 'all' ? undefined : val === 'true');
                  }}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
                >
                  <option value="all">All Auctions</option>
                  <option value="true">Buyout Available</option>
                  <option value="false">Bid Only</option>
                </select>
              </div>
            </div>

            {/* Seller Filter */}
            <div className="mt-3">
              <label className="block text-sm text-gray-400 mb-1">Seller Username</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(e.target.value)}
                  placeholder="Filter by seller..."
                  className="flex-1 bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
                />
                <button
                  onClick={applyFilters}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 font-semibold"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Info */}
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 text-sm text-gray-400">
          {loading ? (
            <span>Loading...</span>
          ) : (
            <span>
              Showing {auctions.length} of {totalCount} auctions 
              {showMyListings && ' (Your Listings)'}
              {showMyBids && ' (Your Bids)'}
            </span>
          )}
        </div>

        {/* Auction Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 p-4 rounded mb-4">
              {error}
            </div>
          )}

          {!loading && auctions.length === 0 && (
            <div className="text-center text-gray-400 py-12">
              <p className="text-xl">No auctions found</p>
              <p className="text-sm mt-2">Try adjusting your filters or create a new listing</p>
            </div>
          )}

          {loading && (
            <div className="text-center text-gray-400 py-12">
              <p className="text-xl">Loading auctions...</p>
            </div>
          )}

          {!loading && auctions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {auctions.map((auction) => (
                <AuctionListingCard
                  key={auction.auctionId}
                  auction={auction}
                  onUpdate={handleAuctionUpdate}
                  showMyBidStatus={showMyBids}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-800 p-4 border-t border-gray-700 flex justify-center items-center gap-4">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded ${
                currentPage === 1
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              ← Previous
            </button>
            <span className="text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded ${
                currentPage === totalPages
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              Next →
            </button>
          </div>
        )}
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
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Three view modes: Marketplace, My Listings, My Bids
// - Category tabs for filtering (All, Units, Resources, Items)
// - Comprehensive filters: price range, sort, buyout, seller
// - Grid layout with 4 columns on XL screens
// - Pagination controls with prev/next buttons
// - Real-time loading states and error handling
// - Create listing button opens modal
// - Refresh data after successful actions
// ============================================================
// END OF FILE
// ============================================================
