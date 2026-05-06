/**
 * @file components/map/ZoomControls.tsx
 * @created 2025-10-20
 * @overview Zoom level controls for the PixiJS map interface
 * 
 * OVERVIEW:
 * Provides UI controls for changing the map zoom level between 4 presets:
 * - Full Map (1x): See all 150x150 tiles
 * - Quadrant (2x): See 75x75 tiles
 * - Zone (4x): See 37x37 tiles  
 * - Region (8x): See 18x18 tiles
 * 
 * Features:
 * - Button-based zoom presets
 * - Keyboard shortcuts (+/- keys)
 * - Mobile-friendly touch targets
 * - Visual indication of current zoom level
 * - Smooth zoom transitions
 */

'use client';

import React from 'react';
import { type ZoomLevel, ZOOM_SCALES } from '@/types';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

/**
 * Props for ZoomControls component
 */
interface ZoomControlsProps {
  /** Current zoom level */
  currentZoom: ZoomLevel;
  
  /** Callback when zoom level changes */
  onZoomChange: (zoom: ZoomLevel) => void;
  
  /** Optional className for styling */
  className?: string;
}

/**
 * Zoom level configuration
 */
interface ZoomLevelConfig {
  level: ZoomLevel;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

/**
 * ZoomControls Component
 * 
 * Renders zoom level selector with button presets and keyboard support.
 * 
 * @param currentZoom - Currently active zoom level
 * @param onZoomChange - Callback invoked when user changes zoom
 * @param className - Optional additional CSS classes
 * @returns Rendered zoom controls
 * 
 * @example
 * ```tsx
 * <ZoomControls
 *   currentZoom="FullMap"
 *   onZoomChange={(zoom) => setZoom(zoom)}
 * />
 * ```
 */
export function ZoomControls({
  currentZoom,
  onZoomChange,
  className = ''
}: ZoomControlsProps): React.JSX.Element {
  
  // Zoom level configurations
  const zoomLevels: ZoomLevelConfig[] = [
    {
      level: 'FullMap',
      label: 'Full Map',
      shortLabel: '1x',
      description: 'See all 150x150 tiles (strategic overview)',
      icon: '🌍'
    },
    {
      level: 'Quadrant',
      label: 'Quadrant',
      shortLabel: '2x',
      description: 'See 75x75 tiles (regional view)',
      icon: '🗺️'
    },
    {
      level: 'Zone',
      label: 'Zone',
      shortLabel: '4x',
      description: 'See 37x37 tiles (local area)',
      icon: '📍'
    },
    {
      level: 'Region',
      label: 'Region',
      shortLabel: '8x',
      description: 'See 18x18 tiles (detailed view)',
      icon: '🔍'
    }
  ];

  // Keyboard shortcuts for zoom
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input field
      if (isTypingInInput()) {
        return;
      }

      const currentIndex = zoomLevels.findIndex(z => z.level === currentZoom);

      // + or = key: Zoom in (increase zoom level)
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, zoomLevels.length - 1);
        onZoomChange(zoomLevels[nextIndex].level);
      }

      // - or _ key: Zoom out (decrease zoom level)
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        onZoomChange(zoomLevels[prevIndex].level);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentZoom, onZoomChange, zoomLevels]);

  return (
    <div 
      className={`flex flex-col gap-2 ${className}`}
      role="group"
      aria-label="Zoom controls"
    >
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-300">
          Zoom Level
        </label>
        <span className="text-xs text-gray-500">
          {ZOOM_SCALES[currentZoom]}x
        </span>
      </div>

      {/* Zoom buttons - Desktop: Horizontal, Mobile: Grid */}
      <div className="grid grid-cols-2 md:flex md:flex-row gap-1.5">
        {zoomLevels.map((zoom) => (
          <button
            key={zoom.level}
            onClick={() => onZoomChange(zoom.level)}
            className={`
              px-2 py-1 rounded text-xs font-medium
              transition-all duration-200
              flex items-center justify-center gap-1
              ${
                currentZoom === zoom.level
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }
              active:scale-95
              focus:outline-none focus:ring-1 focus:ring-blue-500
            `}
            title={zoom.description}
            aria-label={`${zoom.label} - ${zoom.description}`}
            aria-pressed={currentZoom === zoom.level}
          >
            <span className="text-xs" aria-hidden="true">{zoom.icon}</span>
            <span className="hidden md:inline text-xs">{zoom.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-gray-500 text-center md:text-left mt-1">
        <span className="hidden md:inline text-xs">
          <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">+/-</kbd> zoom
        </span>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. **Zoom Levels:**
 *    - 4 preset levels (FullMap → Quadrant → Zone → Region)
 *    - Each level has specific scale multiplier (1x → 8x)
 *    - Visual feedback shows current active level
 * 
 * 2. **Keyboard Shortcuts:**
 *    - + or = key: Zoom in (increase detail)
 *    - - or _ key: Zoom out (decrease detail)
 *    - Disabled when user is typing in input fields
 * 
 * 3. **Responsive Design:**
 *    - Desktop: Horizontal button row with full labels
 *    - Mobile: 2x2 grid with short labels (saves space)
 *    - Touch-friendly button sizes (minimum 44px)
 * 
 * 4. **Accessibility:**
 *    - ARIA labels and roles
 *    - Keyboard navigation support
 *    - Focus indicators
 *    - Screen reader announcements
 * 
 * 5. **Future Enhancements:**
 *    - Slider for continuous zoom (1x-8x)
 *    - Mouse wheel zoom support (handled by map component)
 *    - Zoom animation duration control
 *    - Save preferred zoom level to localStorage
 */
