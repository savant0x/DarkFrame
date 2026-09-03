/**
 * @file lib/imageService.ts
 * @created 2025-10-17
 * @overview Client-side image loading service with automatic scanning and random selection
 * 
 * OVERVIEW:
 * Handles dynamic image loading for all terrain types. Automatically fetches available
 * images from the API, caches them locally, and provides random selection with consistent
 * results per tile. Supports all image formats (.png, .jpg, .jpeg, .gif, .webp).
 * 
 * Features:
 * - Automatic image discovery (no hardcoded paths)
 * - Multi-format support (PNG, JPG, JPEG, GIF, WebP)
 * - Random variation selection for visual variety
 * - Consistent selection per tile (seeded randomness)
 * - Client-side caching for performance
 * - Fallback to emoji/gradient if no images found
 */

/**
 * Image manifest structure from API
 */
interface ImageManifest {
  metal: string[];
  energy: string[];
  cave: string[];
  forest: string[];
  factory: string[];
  wasteland: string[];
  banks: string[];
  shrine: string[];
  auction: string[];
  bases: string[];
}

/**
 * In-memory cache for image manifest
 */
let manifestCache: ImageManifest | null = null;
let manifestPromise: Promise<ImageManifest> | null = null;

/**
 * Simple seeded random number generator for consistent tile images
 * Uses tile coordinates as seed to ensure same tile always gets same image
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate seed from tile coordinates
 */
function getTileSeed(x: number, y: number): number {
  // Combine x and y into unique seed
  return x * 10000 + y;
}

/**
 * Fetch image manifest from API
 * Uses in-memory cache to avoid repeated API calls
 */
export async function fetchImageManifest(): Promise<ImageManifest> {
  // Return cached manifest if available
  if (manifestCache) {
    return manifestCache;
  }

  // Return existing promise if fetch is in progress
  if (manifestPromise) {
    return manifestPromise;
  }

  // Start new fetch
  manifestPromise = (async () => {
    try {
      console.log('🔄 Fetching image manifest from API...');
      const response = await fetch('/api/assets/images');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      manifestCache = data.manifest;
      console.log('✅ Image manifest loaded:', Object.keys(manifestCache || {}).length, 'terrain types');
      
      return manifestCache!;
    } catch (error) {
      console.error('❌ Error fetching image manifest:', error);
      // Return empty manifest on error
      return {
        metal: [],
        energy: [],
        cave: [],
        forest: [],
        factory: [],
        wasteland: [],
        banks: [],
        shrine: [],
        auction: [],
        bases: []
      };
    } finally {
      manifestPromise = null;
    }
  })();

  return manifestPromise;
}

/**
 * Get random image for terrain type with consistent selection per tile
 * 
 * @param terrainType - Terrain directory name (e.g., 'metal', 'banks', 'forest')
 * @param tileX - Tile X coordinate (for seeded randomness)
 * @param tileY - Tile Y coordinate (for seeded randomness)
 * @returns Image path or null if no images available
 * 
 * @example
 * const imagePath = await getTerrainImage('forest', 100, 200);
 * // Returns: '/assets/tiles/forest/forest-2.jpg' (always same for x=100, y=200)
 */
export async function getTerrainImage(
  terrainType: string,
  tileX: number,
  tileY: number
): Promise<string | null> {
  const manifest = await fetchImageManifest();
  
  // Normalize terrain type to match directory names
  const normalizedType = terrainType.toLowerCase();
  
  // Get available images for this terrain
  const availableImages = (manifest as any)[normalizedType] || [];
  
  if (availableImages.length === 0) {
    console.log(`⚠️ No images found for terrain: ${terrainType}`);
    return null;
  }

  // If only one image, return it
  if (availableImages.length === 1) {
    return availableImages[0];
  }

  // Use seeded random to pick consistent image for this tile
  const seed = getTileSeed(tileX, tileY);
  const randomValue = seededRandom(seed);
  const index = Math.floor(randomValue * availableImages.length);
  
  return availableImages[index];
}

/**
 * Get bank-specific image based on bank type
 * 
 * @param bankType - Type of bank ('metal', 'energy', 'exchange', 'auction')
 * @param tileX - Tile X coordinate
 * @param tileY - Tile Y coordinate
 * @returns Image path or null if no images available
 */
export async function getBankImage(
  bankType: 'metal' | 'energy' | 'exchange' | 'auction',
  tileX: number,
  tileY: number
): Promise<string | null> {
  const manifest = await fetchImageManifest();
  
  // Get all bank images
  const bankImages = manifest.banks || [];
  const auctionImages = manifest.auction || [];
  
  // Filter for specific bank type
  let filteredImages: string[] = [];
  
  if (bankType === 'auction') {
    // Use auction directory
    filteredImages = auctionImages;
  } else {
    // Search banks directory for matching type
    filteredImages = bankImages.filter(path => {
      const filename = path.toLowerCase();
      if (bankType === 'metal') return filename.includes('metal');
      if (bankType === 'energy') return filename.includes('energy');
      if (bankType === 'exchange') return filename.includes('exchange');
      return false;
    });
  }
  
  // If no type-specific images, use any bank image
  if (filteredImages.length === 0) {
    filteredImages = bankImages;
  }
  
  if (filteredImages.length === 0) {
    console.log(`⚠️ No images found for bank type: ${bankType}`);
    return null;
  }

  // Use seeded random for consistency
  if (filteredImages.length === 1) {
    return filteredImages[0];
  }

  const seed = getTileSeed(tileX, tileY);
  const randomValue = seededRandom(seed);
  const index = Math.floor(randomValue * filteredImages.length);
  
  return filteredImages[index];
}

/**
 * Get base overlay image for specific rank
 * 
 * @param rank - Player rank (1-10)
 * @returns Image path or null if no images available
 */
export async function getBaseImage(rank: number): Promise<string | null> {
  const manifest = await fetchImageManifest();
  
  // Look for rank-specific base images
  const baseImages = manifest.bases || [];
  
  // Try to find rank-specific image
  const rankSpecific = baseImages.find(path => 
    path.toLowerCase().includes(`rank${rank}`) || path.toLowerCase().includes(`rank-${rank}`)
  );
  
  if (rankSpecific) {
    return rankSpecific;
  }
  
  // Fallback to any base image
  if (baseImages.length > 0) {
    return baseImages[0];
  }
  
  return null;
}

/**
 * Refresh image manifest (useful in development when adding new images)
 * Call this after adding new images to hot-reload them without server restart
 */
export async function refreshImageManifest(): Promise<void> {
  try {
    console.log('🔄 Refreshing image manifest...');
    const response = await fetch('/api/assets/images?action=refresh', {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh manifest');
    }
    
    // Clear local cache
    manifestCache = null;
    
    // Fetch new manifest
    await fetchImageManifest();
    
    console.log('✅ Image manifest refreshed');
  } catch (error) {
    console.error('❌ Error refreshing manifest:', error);
  }
}

/**
 * Preload image manifest on module load (improves first render performance)
 */
if (typeof window !== 'undefined') {
  fetchImageManifest().catch(err => 
    console.error('Failed to preload image manifest:', err)
  );
}
