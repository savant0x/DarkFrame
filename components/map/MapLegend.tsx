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
import { TERRAIN_PALETTE } from '@/lib/mapPalette';

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
 * @param compact - 2-column layout for narrow sidebars (FID-20260906-005 R5:
 *   the desktop sidebar is w-64; the old 7-col grid rendered its labels as a
 *   run-on "MetalEnergyCaveForestFactoryWastelandYou").
 * @returns Rendered legend component
 * 
 * @example
 * ```tsx
 * <MapLegend compact />   // sidebar mount
 * <MapLegend />           // wide mounts (mobile bottom sheet)
 * ```
 */
export function MapLegend({ compact = false }: { compact?: boolean }): React.JSX.Element {
  // FID-20260912-087: colors come from the shared map palette — the exact
  // values the canvas renderer paints, so legend and map can never drift.
  const getLegendItems = (): LegendItem[] => {
    return [
      {
        label: 'Metal',
        color: TERRAIN_PALETTE.Metal.base,
        icon: TERRAIN_PALETTE.Metal.icon,
        description: TERRAIN_PALETTE.Metal.description,
      },
      {
        label: 'Energy',
        color: TERRAIN_PALETTE.Energy.base,
        icon: TERRAIN_PALETTE.Energy.icon,
        description: TERRAIN_PALETTE.Energy.description,
      },
      {
        label: 'Cave',
        color: TERRAIN_PALETTE.Cave.base,
        icon: TERRAIN_PALETTE.Cave.icon,
        description: TERRAIN_PALETTE.Cave.description,
      },
      {
        label: 'Forest',
        color: TERRAIN_PALETTE.Forest.base,
        icon: TERRAIN_PALETTE.Forest.icon,
        description: TERRAIN_PALETTE.Forest.description,
      },
      {
        label: 'Factory',
        color: TERRAIN_PALETTE.Factory.base,
        icon: TERRAIN_PALETTE.Factory.icon,
        description: TERRAIN_PALETTE.Factory.description,
      },
      {
        label: 'Wasteland',
        color: TERRAIN_PALETTE.Wasteland.base,
        icon: TERRAIN_PALETTE.Wasteland.icon,
        description: TERRAIN_PALETTE.Wasteland.description,
      },
      {
        label: 'You',
        color: '#37d6f5',
        icon: '🔵',
        description: 'Your current position',
      },
    ];
  };

  const legendItems = getLegendItems();

  return (
    <div 
      className="nn-panel rounded-none p-4"
      role="region"
      aria-label="Map legend"
    >
      <h3 className="nn-panel__title text-lg mb-3 flex items-center gap-2">
        <span>Map Legend</span>
      </h3>

      {/* Desktop: Horizontal grid (2-col in compact/sidebar mode) */}
      <div className={compact ? 'grid grid-cols-2 gap-3' : 'hidden md:grid md:grid-cols-4 lg:grid-cols-7 gap-3'}>
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
      <div className="mt-4 pt-4 border-t border-[color-mix(in_oklab,var(--nn-cyan)_18%,transparent)] text-xs text-[color:var(--nn-text-secondary)]">
        <p>Tip: Click any tile to view its coordinates and terrain type</p>
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
        ${mobile ? 'p-2 bg-[color-mix(in_oklab,var(--nn-void)_55%,transparent)] rounded-none' : 'flex-col text-center'}
      `}
      title={item.description}
    >
      {/* Color indicator */}
      <div
        className={`
          rounded-none
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
      <span className={`${mobile ? 'text-sm flex-1' : 'text-xs'} text-[color:var(--nn-text-primary)]`}>
        {item.label}
      </span>

      {/* Description (mobile only) */}
      {mobile && (
        <span className="text-xs text-[color:var(--nn-text-secondary)] hidden sm:block">
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
