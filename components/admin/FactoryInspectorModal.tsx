/**
 * Factory Inspector Modal - Admin Panel
 * Created: 2025-01-18
 * 
 * OVERVIEW:
 * Comprehensive factory inspection tool for administrators. Displays all factories
 * in the game with detailed information including location, owner, output rate,
 * and production status. Provides filtering by owner and factory tier, pagination,
 * and export functionality.
 * 
 * Features:
 * - View all factories in database
 * - Filter by owner username
 * - Filter by factory tier (tier1, tier2, tier3)
 * - Search by coordinates (X, Y)
 * - Pagination (30 factories per page)
 * - Color-coded by tier
 * - Production rate display
 * - Owner quick view link
 * 
 * Admin Actions (future):
 * - Delete selected factories
 * - Reset production timers
 * - Modify output rates
 */

'use client';

import React, { useState, useEffect } from 'react';

/**
 * Factory data structure
 */
interface FactoryData {
  _id: string;
  x: number;
  y: number;
  ownerUsername: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  productionRate: number; // units per hour
  lastProduction: string; // ISO timestamp
  currentProduction: number; // current resources waiting for collection
  resourceType: 'metal' | 'energy';
  isActive: boolean;
}

/**
 * Component props
 */
interface FactoryInspectorModalProps {
  onClose: () => void;
}

/**
 * Factory Inspector Modal Component
 * 
 * Provides comprehensive factory database inspection for admins.
 * Fetches all factories, applies filters, and displays in paginated grid.
 */
export default function FactoryInspectorModal({ onClose }: FactoryInspectorModalProps) {
  // Data state
  const [factories, setFactories] = useState<FactoryData[]>([]);
  const [filteredFactories, setFilteredFactories] = useState<FactoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchOwner, setSearchOwner] = useState('');
  const [searchX, setSearchX] = useState('');
  const [searchY, setSearchY] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // all, active, inactive

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  /**
   * Fetch all factories on mount
   */
  useEffect(() => {
    async function fetchFactories() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/admin/factories');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setFactories(data.factories || []);
        setFilteredFactories(data.factories || []);
      } catch (err) {
        console.error('[FactoryInspector] Failed to fetch factories:', err);
        setError(err instanceof Error ? err.message : 'Failed to load factories');
      } finally {
        setLoading(false);
      }
    }

    fetchFactories();
  }, []);

  /**
   * Apply filters when filter state changes
   */
  useEffect(() => {
    let filtered = [...factories];

    // Filter by owner (case insensitive partial match)
    if (searchOwner.trim()) {
      filtered = filtered.filter(f =>
        f.ownerUsername.toLowerCase().includes(searchOwner.toLowerCase())
      );
    }

    // Filter by coordinates
    if (searchX.trim()) {
      const x = parseInt(searchX);
      if (!isNaN(x)) {
        filtered = filtered.filter(f => f.x === x);
      }
    }
    if (searchY.trim()) {
      const y = parseInt(searchY);
      if (!isNaN(y)) {
        filtered = filtered.filter(f => f.y === y);
      }
    }

    // Filter by tier
    if (filterTier !== 'all') {
      filtered = filtered.filter(f => f.tier === filterTier);
    }

    // Filter by status
    if (filterStatus === 'active') {
      filtered = filtered.filter(f => f.isActive);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(f => !f.isActive);
    }

    setFilteredFactories(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchOwner, searchX, searchY, filterTier, filterStatus, factories]);

  /**
   * Pagination calculations
   */
  const totalPages = Math.ceil(filteredFactories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFactories = filteredFactories.slice(startIndex, endIndex);

  /**
   * Navigate to previous page
   */
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  /**
   * Navigate to next page
   */
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  /**
   * Get color class for factory tier
   */
  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'tier1': return 'text-[color:var(--nn-green)]';
      case 'tier2': return 'text-[color:var(--nn-cyan)]';
      case 'tier3': return 'text-[color:var(--nn-violet)]';
      default: return 'text-[color:var(--nn-text-secondary)]';
    }
  };

  /**
   * Get background color for factory tier
   */
  const getTierBgColor = (tier: string): string => {
    switch (tier) {
      case 'tier1': return 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]';
      case 'tier2': return 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]';
      case 'tier3': return 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]';
      default: return 'bg-[color:var(--nn-void)] border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]';
    }
  };

  /**
   * Format time since last production
   */
  const formatTimeSince = (isoString: string): string => {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diff = now - then;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50">
        <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-8 max-w-md w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] mx-auto mb-4"></div>
            <p className="text-[color:var(--nn-text-secondary)]">Loading factories...</p>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50">
        <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-8 max-w-md w-full">
          <h3 className="text-xl font-bold text-[color:var(--nn-magenta)] mb-4">Error Loading Factories</h3>
          <p className="text-[color:var(--nn-text-secondary)] mb-6">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  /**
   * Render main modal
   */
  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-violet)]">🏭 Factory Inspector</h2>
            <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">
              {filteredFactories.length} of {factories.length} factories
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Owner search */}
            <div>
              <label className="block text-sm text-[color:var(--nn-text-secondary)] mb-1">Owner</label>
              <input
                type="text"
                value={searchOwner}
                onChange={(e) => setSearchOwner(e.target.value)}
                placeholder="Username..."
                className="w-full px-3 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm focus:border-purple-500 outline-none"
              />
            </div>

            {/* X coordinate */}
            <div>
              <label className="block text-sm text-[color:var(--nn-text-secondary)] mb-1">X Coordinate</label>
              <input
                type="number"
                value={searchX}
                onChange={(e) => setSearchX(e.target.value)}
                placeholder="X..."
                className="w-full px-3 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm focus:border-purple-500 outline-none"
              />
            </div>

            {/* Y coordinate */}
            <div>
              <label className="block text-sm text-[color:var(--nn-text-secondary)] mb-1">Y Coordinate</label>
              <input
                type="number"
                value={searchY}
                onChange={(e) => setSearchY(e.target.value)}
                placeholder="Y..."
                className="w-full px-3 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm focus:border-purple-500 outline-none"
              />
            </div>

            {/* Tier filter */}
            <div>
              <label className="block text-sm text-[color:var(--nn-text-secondary)] mb-1">Tier</label>
              <select
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="w-full px-3 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm focus:border-purple-500 outline-none"
              >
                <option value="all">All Tiers</option>
                <option value="tier1">Tier 1</option>
                <option value="tier2">Tier 2</option>
                <option value="tier3">Tier 3</option>
              </select>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-sm text-[color:var(--nn-text-secondary)] mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm focus:border-purple-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Clear filters */}
          {(searchOwner || searchX || searchY || filterTier !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchOwner('');
                setSearchX('');
                setSearchY('');
                setFilterTier('all');
                setFilterStatus('all');
              }}
              className="mt-3 px-4 py-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] text-sm rounded-none transition"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Factory Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentFactories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[color:var(--nn-text-secondary)] text-lg">No factories match your filters</p>
              <p className="text-[color:var(--nn-text-secondary)] text-sm mt-2">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentFactories.map((factory) => (
                <div
                  key={factory._id}
                  className={`border rounded-none p-4 ${getTierBgColor(factory.tier)} border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] transition`}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className={`font-bold ${getTierColor(factory.tier)}`}>
                        {factory.tier.toUpperCase()}
                      </span>
                      <p className="text-sm text-[color:var(--nn-text-secondary)]">
                        ({factory.x}, {factory.y})
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-none text-xs ${
                      factory.isActive 
                        ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-green)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]' 
                        : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-magenta)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]'
                    }`}>
                      {factory.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  {/* Owner */}
                  <div className="mb-2">
                    <p className="text-xs text-[color:var(--nn-text-secondary)]">Owner</p>
                    <p className="text-[color:var(--nn-text-primary)] font-medium">{factory.ownerUsername}</p>
                  </div>

                  {/* Production */}
                  <div className="mb-2">
                    <p className="text-xs text-[color:var(--nn-text-secondary)]">Production Rate</p>
                    <p className="text-[color:var(--nn-text-primary)]">
                      {factory.productionRate}/hr{' '}
                      <span className={factory.resourceType === 'metal' ? 'text-[color:var(--nn-cyan)]' : 'text-[color:var(--nn-amber)]'}>
                        {factory.resourceType === 'metal' ? '⚙️' : '⚡'}
                      </span>
                    </p>
                  </div>

                  {/* Current production */}
                  <div className="mb-2">
                    <p className="text-xs text-[color:var(--nn-text-secondary)]">Waiting Collection</p>
                    <p className="text-[color:var(--nn-green)] font-medium">
                      {factory.currentProduction.toLocaleString()}{' '}
                      {factory.resourceType === 'metal' ? 'metal' : 'energy'}
                    </p>
                  </div>

                  {/* Last production */}
                  <div className="mb-3">
                    <p className="text-xs text-[color:var(--nn-text-secondary)]">Last Production</p>
                    <p className="text-[color:var(--nn-text-secondary)] text-sm">
                      {formatTimeSince(factory.lastProduction)}
                    </p>
                  </div>

                  {/* Actions (future) */}
                  <div className="flex gap-2">
                    <button
                      className="flex-1 px-3 py-1 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] text-sm rounded-none transition"
                      disabled
                    >
                      View Owner
                    </button>
                    <button
                      className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] text-sm rounded-none transition"
                      disabled
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] flex justify-between items-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] rounded-none transition"
            >
              Previous
            </button>
            <span className="text-[color:var(--nn-text-secondary)]">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] rounded-none transition"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * Features Implemented:
 * - Full factory database viewing
 * - Multi-criteria filtering (owner, coordinates, tier, status)
 * - Pagination (30 factories per page)
 * - Color-coded by tier (tier1=green, tier2=blue, tier3=purple)
 * - Production rate and current production display
 * - Last production timestamp with relative time
 * - Active/inactive status badges
 * 
 * Future Enhancements:
 * - Bulk delete selected factories
 * - Reset production timers
 * - Modify output rates
 * - View owner details (link to PlayerDetailModal)
 * - Export factory data to CSV/JSON
 * - Factory production history chart
 * 
 * Dependencies:
 * - /api/admin/factories endpoint (must return factories array)
 * - Admin authentication in parent component
 * 
 * Performance Considerations:
 * - Client-side filtering for instant feedback
 * - Pagination prevents DOM overload with 1000+ factories
 * - Memo or virtualization for very large datasets (future optimization)
 */
