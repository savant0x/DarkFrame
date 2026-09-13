/**
 * @file lib/mapElevation.ts
 * @created 2026-09-12
 * @overview FID-20260912-088 — procedural elevation + hillshading for /map.
 *
 * Terrain depth without art assets: a two-octave value-noise height field over
 * the 150×150 grid, shaded with a fixed NW sun (classic cartographic relief).
 * Pure + deterministic — every tile's shade is a pure function of (x, y), so
 * the cached terrain layer and the culled direct-draw path can never disagree.
 *
 * Contract honored from the spec: specials (Bank/Shrine/AuctionHouse) render
 * their glyph read at fixed brightness — landmarks must not lurk in shade.
 */

/** Map extent in tiles (mirrors MAP_CONFIG; kept local to stay UI-free). */
export const ELEV_MAP_W = 150;
export const ELEV_MAP_H = 150;

/** Noise lattice size in tiles — the base "landform" wavelength. */
const CELL = 22;
/** Second octave (2× the frequency) for medium detail. */
const CELL_2 = 11;
/** Octave 2's contribution to the final height. */
const OCTAVE_2 = 0.25;
/** Light direction: sun from the northwest (cartographic convention). */
const SUN = { x: -0.7, y: -0.7 } as const;
/** Height gradient normalization: ~the max |gradient| the field produces
 *  (probed ≈ 0.027 at CELL 22/11). Slopes then span the full shade ramp. */
const RELIEF = 0.03;
/** Hillshade in/out clamp range (multiplicative lightness factors). */
const SHADE_MIN = 0.86;
const SHADE_MAX = 1.18;
/** Blend weight of the shade onto the flat color (0 = flat, 1 = full). */
const SHADE_STRENGTH = 0.8;
/** Wasteland-only flattening: dead ground reads calmer than resource land. */
const WASTELAND_TAME = 0.6;

/** Deterministic pseudo-random lattice value for lattice cell (ix, iy). */
function lattice(ix: number, iy: number): number {
  let h = (ix * 374761393 + iy * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h >>> 0) / 4294967296;
}

/** Smooth-hermite blend curve (6t⁵−15t⁴+10t³) for noise interpolation. */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Bilinear value noise at a point in tile space, for a lattice of `cell`
 * tiles. Deterministic in (x, y, cell).
 */
function valueNoise(x: number, y: number, cell: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const v00 = lattice(x0, y0);
  const v10 = lattice(x0 + 1, y0);
  const v01 = lattice(x0, y0 + 1);
  const v11 = lattice(x0 + 1, y0 + 1);
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) +
         (v01 * (1 - tx) + v11 * tx) * ty;
}

/**
 * The terrain height field — two octaves of value noise, normalized to [0, 1].
 * Pure: same (x, y) → same height on every call, every process.
 */
export function elevationAt(x: number, y: number): number {
  const h1 = valueNoise(x, y, CELL);
  const h2 = valueNoise(x, y, CELL_2);
  const h = h1 * (1 - OCTAVE_2) + h2 * OCTAVE_2;
  return Math.min(1, Math.max(0, h));
}

/**
 * Cartographic hillshade at tile (x, y): 0 = in shadow, 1 = full sun,
 * 0.5 = flat ground. NW-lit, sampled one tile away along each axis.
 */
export function hillshadeAt(x: number, y: number): number {
  // Central differences at the SAME point — both axes of the surface normal.
  const gx = (elevationAt(x + 1, y) - elevationAt(x - 1, y)) / 2;
  const gy = (elevationAt(x, y + 1) - elevationAt(x, y - 1)) / 2;
  const slopeDot = -(gx * SUN.x + gy * SUN.y);
  // Map slope·(−sun) from [−RELIEF, +RELIEF] → [0, 1], then fold around 0.5
  // so flat ground is exactly mid-gray regardless of extremes.
  const mag = slopeDot / RELIEF;
  const t = Math.min(1, Math.max(-1, mag));
  return 0.5 + t * 0.5;
}

/** Terrains whose glyphs must stay landmark-bright (never shaded dark). */
const SHADE_EXEMPT = new Set(['Bank', 'Shrine', 'AuctionHouse']);

/**
 * The single shading decision for one tile — consumed by BOTH renderer paths.
 *
 * @param x Tile x (1-based)
 * @param y Tile y (1-based)
 * @param terrain Terrain key (palette key), used for exempt + tame rules
 * @returns Multiplicative lightness factor to apply to the base color.
 */
export function tileShade(x: number, y: number, terrain: string): number {
  if (SHADE_EXEMPT.has(terrain)) return 1;
  const shade = hillshadeAt(x, y);
  // Pull toward flat (0.5) by SHADE_STRENGTH, then map the 0..1 shade range
  // linearly across the tuned lightness band [SHADE_MIN, SHADE_MAX].
  const soft = 0.5 + (shade - 0.5) * SHADE_STRENGTH;
  let f = SHADE_MIN + Math.min(1, Math.max(0, soft)) * (SHADE_MAX - SHADE_MIN);
  if (terrain === 'Wasteland') {
    f = 1 + (f - 1) * WASTELAND_TAME;
  }
  return f;
}
