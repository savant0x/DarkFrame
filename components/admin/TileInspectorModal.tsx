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
      case 'wasteland': return 'bg-gray-600';
      case 'metal': return 'bg-blue-600';
      case 'energy': return 'bg-yellow-600';
      case 'cave': return 'bg-orange-600';
      case 'forest': return 'bg-green-600';
      case 'bank': return 'bg-purple-600';
      case 'shrine': return 'bg-pink-600';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border-2 border-blue-500 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-900/50 p-4 flex justify-between items-center border-b border-blue-500">
          <h2 className="text-2xl font-bold text-white">🗺️ Tile Inspector</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 p-4 border-b border-gray-700">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">X Coordinate</label>
              <input
                type="number"
                value={searchX}
                onChange={(e) => setSearchX(e.target.value)}
                placeholder="Any X"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Y Coordinate</label>
              <input
                type="number"
                value={searchY}
                onChange={(e) => setSearchY(e.target.value)}
                placeholder="Any Y"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Tile Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
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
              <label className="text-sm text-gray-400 block mb-1">Ownership</label>
              <select
                value={filterOwned}
                onChange={(e) => setFilterOwned(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
              <p className="text-gray-400">Loading tiles...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 font-semibold mb-1">Error loading tiles</p>
              <p className="text-gray-500">{error}</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="mb-4 flex justify-between items-center">
                <p className="text-gray-400">
                  Showing {currentTiles.length} of {filteredTiles.length} tiles
                  {filteredTiles.length !== tiles.length && ` (filtered from ${tiles.length} total)`}
                </p>
                {totalPages > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      ← Prev
                    </button>
                    <span className="px-3 py-1 text-white">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>

              {/* Tile Grid */}
              <div className="grid grid-cols-1 gap-3">
                {currentTiles.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No tiles match your filters</p>
                ) : (
                  currentTiles.map((tile, idx) => (
                    <div
                      key={`${tile.x}-${tile.y}`}
                      className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-4 h-4 rounded ${getTileColor(tile.type)}`}></div>
                            <p className="text-white font-semibold">
                              ({tile.x}, {tile.y})
                            </p>
                            <span className="text-gray-400 text-sm">{tile.type}</span>
                            {tile.isPlayerBase && (
                              <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded">BASE</span>
                            )}
                            {tile.isFactory && (
                              <span className="px-2 py-1 bg-red-900 text-red-300 text-xs rounded">FACTORY</span>
                            )}
                            {tile.isCave && (
                              <span className="px-2 py-1 bg-orange-900 text-orange-300 text-xs rounded">CAVE</span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            {tile.ownedBy && (
                              <div>
                                <p className="text-gray-500">Owner</p>
                                <p className="text-white">{tile.ownedBy}</p>
                              </div>
                            )}
                            {tile.structure && (
                              <div>
                                <p className="text-gray-500">Structure</p>
                                <p className="text-white">{tile.structure}</p>
                              </div>
                            )}
                            {tile.resources && (
                              <div>
                                <p className="text-gray-500">Resources</p>
                                <p className="text-white">
                                  {tile.resources.metal && `${tile.resources.metal} M `}
                                  {tile.resources.energy && `${tile.resources.energy} E`}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
                          onClick={() => alert(`Edit tile (${tile.x}, ${tile.y}) - Coming soon!`)}
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
 * - Edit button placeholder for future functionality
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
