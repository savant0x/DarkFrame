/**
 * @file lib/mapPalette.ts
 * @created 2026-09-12
 * @overview FID-20260912-087 — the single source of truth for map colors.
 *
 * The old canvas hardcoded Material-design hexes (0x4CAF50 green, 0xF44336 red,
 * #00ff00 rulers) while every panel around it spoke neon-noir. This module
 * re-derives the terrain ramp inside the nn-* language (deep desaturated bases,
 * glow accents reserved for specials and markers) and is consumed by BOTH the
 * canvas renderer and the MapLegend — the two can never drift again.
 */
import { TerrainType } from '../types/game.types';

export interface TerrainPaletteEntry {
  /** Base fill (CSS color — canvas and DOM both accept this form). */
  readonly base: string;
  /** Optional glyph/emphasis color (specials only). */
  readonly accent?: string;
  /** Legend icon (shared so legend and any canvas glyphs match). */
  readonly icon: string;
  /** Legend description. */
  readonly description: string;
}

export const TERRAIN_PALETTE: Record<TerrainType, TerrainPaletteEntry> = {
  [TerrainType.Wasteland]: {
    base: '#171821',
    icon: '💀',
    description: 'Dead ground (no resources)',
  },
  [TerrainType.Metal]: {
    base: '#0e3a41',
    icon: '⛏️',
    description: 'Metal resource tile (+800–1,500 Metal)',
  },
  [TerrainType.Energy]: {
    base: '#3d2a12',
    icon: '⚡',
    description: 'Energy resource tile (+800–1,500 Energy)',
  },
  [TerrainType.Cave]: {
    base: '#221733',
    icon: '🗿',
    description: 'Cave exploration tile (30% item drop chance)',
  },
  [TerrainType.Forest]: {
    base: '#0f2d1d',
    icon: '🌲',
    description: 'Forest tile (better loot than caves)',
  },
  [TerrainType.Factory]: {
    base: '#252d3d',
    icon: '🏭',
    description: 'Factory location (capturable for unit production)',
  },
  [TerrainType.Bank]: {
    base: '#3a2f10',
    accent: '#f5c542',
    icon: '🏦',
    description: 'Bank (deposit/withdraw resources)',
  },
  [TerrainType.Shrine]: {
    base: '#2a1740',
    accent: '#b46bf2',
    icon: '⛩️',
    description: 'Shrine (buffs)',
  },
  [TerrainType.AuctionHouse]: {
    base: '#3a1224',
    accent: '#ff4fa3',
    icon: '📻',
    description: 'Auction House (trade items)',
  },
};

/** Marker + chrome colors (canvas overlay). */
export const MAP_MARKERS = {
  player: '#37d6f5',
  playerCore: '#ffffff',
  flag: '#f5c542',
  flagTrail: '255, 215, 0',
  beerBase: '#ff4fa3',
  botBase: '#ff4d4d',
  hover: 'rgba(55, 214, 245, 0.35)',
  selection: '#f5c542',
  gridLine: 'rgba(148, 163, 216, 0.07)',
  gridLineMajor: 'rgba(148, 163, 216, 0.16)',
  ruler: '#8fa3d8',
  sectorLabel: 'rgba(143, 163, 216, 0.5)',
  minimapViewport: 'rgba(55, 214, 245, 0.9)',
} as const;

/** Label chip background used for marker labels on canvas. */
export const LABEL_BG = 'rgba(8, 9, 16, 0.78)';

/** FID-086 tier ramp — shared with the admin TierChip semantics (1..7). */
export function tierColor(tier: number): string {
  const ramp = [
    '#35d07f', // T1 green
    '#37d6f5', // T2 cyan
    '#8f7bf2', // T3 violet
    '#f5c542', // T4 amber
    '#ff9f43', // T5 orange
    '#ff4fa3', // T6 magenta
    '#ff4d4d', // T7 red
  ];
  return ramp[Math.min(7, Math.max(1, tier)) - 1];
}

/**
 * Deterministic per-tile lightness jitter (±6%) from tile coords — gives the
 * map an organic patchwork instead of Excel cells. Pure + stable: the same
 * (x, y) always yields the same factor on every render.
 */
export function tileJitter(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return 0.97 + ((h >>> 0) % 1000) / 1000 * 0.06; // 0.97 .. 1.03
}

/** Multiply a #rrggbb color's lightness by `factor` (clamped). */
export function shadeHex(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
