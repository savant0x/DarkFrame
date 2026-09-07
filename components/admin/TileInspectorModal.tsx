/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Tile Inspector Modal Component
 * 
 * Admin tool for inspecting map tiles and their data.
 * Shows coordinates, type, owner, resources, buildings, and special properties.
 * Allows searching by coordinates and filtering by tile type.
 * 
 * Features:
 * - Search by coordinates (x, y)
 * - Filter by tile type (wasteland, metal, energy, etc.)
 * - Pagination for large tile sets
 * - Tile details with owner and resources
 * - Edit tile type (admin action)
 */

'use client';

import { useState, useEffect } from 'react';

interface TileInspectorModalProps {
  onClose: () => void;
}

interface TileData {
  x: number;
  y: number;
  type: string;
  ownedBy?: string;
  structure?: string;
  resources?: {
    metal?: number;
    energy?: number;
  };
  isPlayerBase?: boolean;
  isFactory?: boolean;
  isCave?: boolean;
  discoveredBy?: string[];
}

export default function TileInspectorModal({ onClose }: TileInspectorModalProps) {
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [filteredTiles, setFilteredTiles] = useState<TileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchX, setSearchX] = useState('');
  const [searchY, setSearchY] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterOwned, setFilterOwned] = useState('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const tilesPerPage = 50;

  // Edit (FID-20260905-001 B2: real POST, replaces the "Coming soon!" alert)
  const [editing, setEditing] = useState<TileData | null>(null);
  const [editTerrain, setEditTerrain] = useState('Wasteland');
  const [saving, setSaving] = useState(false);

  // Load tiles
  useEffect(() => {
    const loadTiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/admin/tiles');
        const data = await res.json();

        if (data.success) {
          setTiles(data.tiles || []);
          setFilteredTiles(data.tiles || []);
        } else {
          setError(data.error || 'Failed to load tiles');
        }
      } catch (err) {
        console.error('Tile load error:', err);
        setError('Failed to load tiles');
      } finally {
        setLoading(false);
      }
    };

    loadTiles();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...tiles];

    // Coordinate search
    if (searchX) {
      const x = parseInt(searchX);
      if (!isNaN(x)) {
        filtered = filtered.filter(t => t.x === x);
      }
    }

    if (searchY) {
      const y = parseInt(searchY);
      if (!isNaN(y)) {
        filtered = filtered.filter(t => t.y === y);
      }
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type.toLowerCase() === filterType.toLowerCase());
    }

    // Owned filter
    if (filterOwned === 'owned') {
      filtered = filtered.filter(t => t.ownedBy);
    } else if (filterOwned === 'unowned') {
      filtered = filtered.filter(t => !t.ownedBy);
    }

    setFilteredTiles(filtered);
    setCurrentPage(1); // Reset to first page on filter change
  }, [searchX, searchY, filterType, filterOwned, tiles]);

  // Pagination
  const indexOfLastTile = currentPage * tilesPerPage;
  const indexOfFirstTile = indexOfLastTile - tilesPerPage;
  const currentTiles = filteredTiles.slice(indexOfFirstTile, indexOfLastTile);
  const totalPages = Math.ceil(filteredTiles.length / tilesPerPage);

  // Tile type colors
  const getTileColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'wasteland': return 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]';
      case 'metal': return 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]';
      case 'energy': return 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]';
      case 'cave': return 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]';
      case 'forest': return 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]';
      case 'bank': return 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]';
      case 'shrine': return 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]';
      default: return 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]';
    }
  };

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color:var(--nn-void)] rounded-none border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] p-4 flex justify-between items-center border-b border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
          <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">🗺️ Tile Inspector</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">X Coordinate</label>
              <input
                type="number"
                value={searchX}
                onChange={(e) => setSearchX(e.target.value)}
                placeholder="Any X"
                className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Y Coordinate</label>
              <input
                type="number"
                value={searchY}
                onChange={(e) => setSearchY(e.target.value)}
                placeholder="Any Y"
                className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
              />
            </div>
            <div>
              <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Tile Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
              >
                <option value="all">All Types</option>
                <option value="wasteland">Wasteland</option>
                <option value="metal">Metal</option>
                <option value="energy">Energy</option>
                <option value="cave">Cave</option>
                <option value="forest">Forest</option>
                <option value="bank">Bank</option>
                <option value="shrine">Shrine</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Ownership</label>
              <select
                value={filterOwned}
                onChange={(e) => setFilterOwned(e.target.value)}
                className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
              >
                <option value="all">All Tiles</option>
                <option value="owned">Owned Only</option>
                <option value="unowned">Unowned Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] mx-auto mb-3"></div>
              <p className="text-[color:var(--nn-text-secondary)]">Loading tiles...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-[color:var(--nn-magenta)] font-semibold mb-1">Error loading tiles</p>
              <p className="text-[color:var(--nn-text-secondary)]">{error}</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="mb-4 flex justify-between items-center">
                <p className="text-[color:var(--nn-text-secondary)]">
                  Showing {currentTiles.length} of {filteredTiles.length} tiles
                  {filteredTiles.length !== tiles.length && ` (filtered from ${tiles.length} total)`}
                </p>
                {totalPages > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none disabled:opacity-50"
                    >
                      ← Prev
                    </button>
                    <span className="px-3 py-1 text-[color:var(--nn-text-primary)]">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>

              {/* Tile Grid */}
              <div className="grid grid-cols-1 gap-3">
                {currentTiles.length === 0 ? (
                  <p className="text-[color:var(--nn-text-secondary)] text-center py-8">No tiles match your filters</p>
                ) : (
                  currentTiles.map((tile, _idx) => (
                    <div
                      key={`${tile.x}-${tile.y}`}
                      className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-4 h-4 rounded-none ${getTileColor(tile.type)}`}></div>
                            <p className="text-[color:var(--nn-text-primary)] font-semibold">
                              ({tile.x}, {tile.y})
                            </p>
                            <span className="text-[color:var(--nn-text-secondary)] text-sm">{tile.type}</span>
                            {tile.isPlayerBase && (
                              <span className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-green)] text-xs rounded-none">BASE</span>
                            )}
                            {tile.isFactory && (
                              <span className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-magenta)] text-xs rounded-none">FACTORY</span>
                            )}
                            {tile.isCave && (
                              <span className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-amber)] text-xs rounded-none">CAVE</span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            {tile.ownedBy && (
                              <div>
                                <p className="text-[color:var(--nn-text-secondary)]">Owner</p>
                                <p className="text-[color:var(--nn-text-primary)]">{tile.ownedBy}</p>
                              </div>
                            )}
                            {tile.structure && (
                              <div>
                                <p className="text-[color:var(--nn-text-secondary)]">Structure</p>
                                <p className="text-[color:var(--nn-text-primary)]">{tile.structure}</p>
                              </div>
                            )}
                            {tile.resources && (
                              <div>
                                <p className="text-[color:var(--nn-text-secondary)]">Resources</p>
                                <p className="text-[color:var(--nn-text-primary)]">
                                  {tile.resources.metal && `${tile.resources.metal} M `}
                                  {tile.resources.energy && `${tile.resources.energy} E`}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] text-sm rounded-none transition-colors"
                          onClick={() => { setEditing(tile); setEditTerrain(tile.type); }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Edit drawer (FID-20260905-001 B2) */}
        {editing && (
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
            <div className="flex items-center gap-4">
              <p className="text-[color:var(--nn-text-primary)] font-semibold">
                Edit tile ({editing.x}, {editing.y}) — current: {editing.type}
              </p>
              <select
                value={editTerrain}
                onChange={(e) => setEditTerrain(e.target.value)}
                className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
              >
                {['Metal', 'Energy', 'Cave', 'Forest', 'Factory', 'Wasteland', 'Bank', 'Shrine', 'AuctionHouse'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const res = await fetch('/api/admin/tiles', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ x: editing.x, y: editing.y, terrain: editTerrain }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setTiles((prev) => prev.map((t) => (t.x === editing.x && t.y === editing.y ? { ...t, type: data.tile.type } : t)));
                      setEditing(null);
                    } else {
                      setError(data.error || 'Failed to save tile');
                    }
                  } catch {
                    setError('Failed to save tile');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] disabled:opacity-50 text-[color:var(--nn-text-primary)] rounded-none transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] rounded-none transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Modal overlay with centered content
 * - Coordinate search and type filtering
 * - Pagination for large tile sets (50 per page)
 * - Color-coded tile types
 * - Special indicators for bases, factories, caves
 * - Edit tile terrain via POST /api/admin/tiles (FID-20260905-001 B2)
 * 
 * 🎨 STYLING:
 * - Blue theme for map/tile focus
 * - Dark background with border
 * - Grid layout for filters
 * - Color-coded tile type indicators
 * - Hover effects on tiles
 * 
 * 📊 DATA SOURCE:
 * - /api/admin/tiles - All map tiles
 * 
 * 🔧 FILTERS:
 * - X/Y coordinate search
 * - Tile type filter (wasteland, metal, energy, etc.)
 * - Ownership filter (all, owned, unowned)
 * - Results pagination
 * 
 * ⚡ FUTURE ENHANCEMENTS:
 * - Edit tile type functionality
 * - Bulk tile operations
 * - Export tiles as JSON
 * - Visual map view
 * - Clear tile ownership
 */
