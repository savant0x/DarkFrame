/**
 * @file components/map/index.ts
 * @created 2025-10-20
 * @overview Barrel export file for map components
 */

export { MapLegend } from './MapLegend';
export { ZoomControls } from './ZoomControls';
export { default as MapContainer } from './MapContainer';
export {
  createGridRenderer,
  updateGridRenderer,
  updateTile,
  highlightTile,
  clearHighlights,
  generateMockMapData
} from './GridRenderer';
export {
  createPlayerMarker,
  updatePlayerMarkerPosition,
  animatePlayerMarker,
  removePlayerMarker
} from './PlayerMarker';
