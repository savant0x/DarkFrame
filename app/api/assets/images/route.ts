/**
 * @file app/api/assets/images/route.ts
 * @created 2025-10-17
 * @overview API endpoint to scan and return available images for terrain types
 * 
 * OVERVIEW:
 * Automatically scans public/assets/tiles/* directories and returns all available
 * images regardless of naming or format. Supports .png, .jpg, .jpeg, .gif, .webp.
 * Enables dynamic image loading without hardcoded paths or strict naming conventions.
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Supported image formats
 */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

/**
 * Cache for image manifest (cleared on server restart)
 */
let imageCache: Record<string, string[]> | null = null;

/**
 * Scan a directory and return all image files
 */
function scanDirectory(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const files = fs.readdirSync(dirPath);
    const images = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return IMAGE_EXTENSIONS.includes(ext);
    });

    return images;
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Build image manifest for all terrain types
 */
function buildImageManifest(): Record<string, string[]> {
  const publicDir = path.join(process.cwd(), 'public', 'assets', 'tiles');
  
  const terrainDirs = [
    'metal',
    'energy',
    'cave',
    'forest',
    'factory',
    'wasteland',
    'banks',    // Bank tiles
    'shrine',
    'auction',
    'bases'     // Base overlays
  ];

  const manifest: Record<string, string[]> = {};

  for (const terrainDir of terrainDirs) {
    const dirPath = path.join(publicDir, terrainDir);
    const images = scanDirectory(dirPath);
    
    if (images.length > 0) {
      // Store relative paths from /assets/tiles/
      manifest[terrainDir] = images.map(img => `/assets/tiles/${terrainDir}/${img}`);
      console.log(`📁 Found ${images.length} image(s) in ${terrainDir}:`, images);
    } else {
      manifest[terrainDir] = [];
      console.log(`📁 No images found in ${terrainDir}`);
    }
  }

  return manifest;
}

/**
 * GET /api/assets/images
 * Returns manifest of all available images organized by terrain type
 * 
 * @returns {
 *   metal: ['/assets/tiles/metal/metal.png', '/assets/tiles/metal/metal-2.jpg'],
 *   energy: ['/assets/tiles/energy/energy.png'],
 *   banks: ['/assets/tiles/banks/metal-bank.jpg', '/assets/tiles/banks/energy-bank.jpg'],
 *   ...
 * }
 */
export async function GET() {
  try {
    // Use cached manifest if available
    if (!imageCache) {
      console.log('🔄 Building image manifest...');
      imageCache = buildImageManifest();
      console.log('✅ Image manifest built:', Object.keys(imageCache).length, 'terrain types');
    }

    return NextResponse.json({
      success: true,
      manifest: imageCache,
      supportedFormats: IMAGE_EXTENSIONS,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error building image manifest:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to scan image directories',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assets/images?action=refresh
 * Clears cache and rebuilds image manifest (for development)
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'refresh') {
      console.log('🔄 Refreshing image manifest...');
      imageCache = null;
      imageCache = buildImageManifest();
      
      return NextResponse.json({
        success: true,
        message: 'Image manifest refreshed',
        manifest: imageCache
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ Error refreshing manifest:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh manifest' },
      { status: 500 }
    );
  }
}
