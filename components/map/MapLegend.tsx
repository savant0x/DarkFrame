/**
 * @file components/map/MapLegend.tsx
 * @created 2025-10-20
 * @overview Map legend component displaying tile type colors and symbols
 * 
 * OVERVIEW:
 * Provides a visual key explaining what each color and icon represents on the map.
 * Helps users understand terrain types, player markers, and special locations at a glance.
 * 
 * Features:
 * - Color-coded terrain type legend
 * - Player marker explanation
 * - Flag Bearer indicator (when implemented)
 * - Responsive layout (horizontal on desktop, vertical on mobile)
 * - Accessible labels with ARIA support
 */

'use client';

import React from 'react';
import { TILE_COLORS, TerrainType } from '@/types';

/**
 * Legend item configuration
 */
interface LegendItem {
  label: string;
  color: string;
  icon?: string;
  description: string;
}

/**
 * MapLegend Component
 * 
 * Displays a visual legend explaining map symbols and colors.
 * 
 * @returns Rendered legend component
 * 
 * @example
 * ```tsx
 * <MapLegend />
 * ```
 */
export function MapLegend(): React.JSX.Element {
  // Convert TILE_COLORS hex numbers to CSS hex strings
  const getLegendItems = (): LegendItem[] => {
    return [
      {
        label: 'Metal',
        color: `#${TILE_COLORS.Metal.toString(16).padStart(6, '0')}`,
        icon: '⛏️',
        description: 'Metal resource tile (+800-1,500 Metal)'
      },
      {
        label: 'Energy',
        color: `#${TILE_COLORS.Energy.toString(16).padStart(6, '0')}`,
        icon: '⚡',
        description: 'Energy resource tile (+800-1,500 Energy)'
      },
      {
        label: 'Cave',
        color: `#${TILE_COLORS.Cave.toString(16).padStart(6, '0')}`,
        icon: '🗿',
        description: 'Cave exploration tile (30% item drop chance)'
      },
      {
        label: 'Forest',
        color: `#${TILE_COLORS.Forest.toString(16).padStart(6, '0')}`,
        icon: '🌲',
        description: 'Forest tile (better loot than caves)'
      },
      {
        label: 'Factory',
        color: `#${TILE_COLORS.Factory.toString(16).padStart(6, '0')}`,
        icon: '🏭',
        description: 'Factory location (capturable for unit production)'
      },
      {
        label: 'Wasteland',
        color: `#${TILE_COLORS.Wasteland.toString(16).padStart(6, '0')}`,
        icon: '💀',
        description: 'Empty wasteland (no resources)'
      },
      {
        label: 'You',
        color: '#2196F3',
        icon: '🔵',
        description: 'Your current position'
      }
    ];
  };

  const legendItems = getLegendItems();

  return (
    <div 
      className="bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700"
      role="region"
      aria-label="Map legend"
    >
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <span>🗺️</span>
        <span>Map Legend</span>
      </h3>

      {/* Desktop: Horizontal grid */}
      <div className="hidden md:grid md:grid-cols-4 lg:grid-cols-7 gap-3">
        {legendItems.map((item) => (
          <LegendItem key={item.label} item={item} />
        ))}
      </div>

      {/* Mobile: Vertical list */}
      <div className="md:hidden space-y-2">
        {legendItems.map((item) => (
          <LegendItem key={item.label} item={item} mobile />
        ))}
      </div>

      {/* Additional info */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400">
        <p>💡 Tip: Click any tile to view its coordinates and terrain type</p>
      </div>
    </div>
  );
}

/**
 * Individual legend item component
 * 
 * @param item - Legend item data
 * @param mobile - Whether to use mobile layout
 */
function LegendItem({ 
  item, 
  mobile = false 
}: { 
  item: LegendItem; 
  mobile?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={`
        flex items-center gap-2
        ${mobile ? 'p-2 bg-gray-750 rounded' : 'flex-col text-center'}
      `}
      title={item.description}
    >
      {/* Color indicator */}
      <div
        className={`
          rounded
          ${mobile ? 'w-6 h-6 flex-shrink-0' : 'w-8 h-8 mb-1'}
        `}
        style={{ backgroundColor: item.color }}
        aria-hidden="true"
      />

      {/* Icon (if present) */}
      {item.icon && (
        <span className={`${mobile ? 'text-lg' : 'text-xl mb-1'}`} aria-hidden="true">
          {item.icon}
        </span>
      )}

      {/* Label */}
      <span className={`${mobile ? 'text-sm flex-1' : 'text-xs'} text-gray-300`}>
        {item.label}
      </span>

      {/* Description (mobile only) */}
      {mobile && (
        <span className="text-xs text-gray-500 hidden sm:block">
          {item.description}
        </span>
      )}
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. **Responsive Design:**
 *    - Desktop: Horizontal grid layout (4-7 columns)
 *    - Mobile: Vertical list with larger touch targets
 *    - Both layouts show same information
 * 
 * 2. **Accessibility:**
 *    - ARIA labels for screen readers
 *    - Tooltips on hover with descriptions
 *    - High contrast colors
 * 
 * 3. **Future Enhancements:**
 *    - Add Flag Bearer indicator (golden marker with crown)
 *    - Add particle trail indicator (golden sparkles)
 *    - Add factory ownership colors
 *    - Add toggleable legend visibility
 * 
 * 4. **Performance:**
 *    - Static legend (no re-renders unless items change)
 *    - Pure component (React.memo could be added if needed)
 */
