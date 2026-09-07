/**
 * @file components/TileRenderer.tsx
 * @created 2025-10-16
 * @updated 2025-10-17
 * @overview Component for rendering current tile with dynamic image loading and base overlays
 * 
 * OVERVIEW:
 * Renders terrain tiles with automatic image discovery and random variation selection.
 * Supports all image formats (.png, .jpg, .jpeg, .gif, .webp) without strict naming.
 * Simply drop images in terrain folders and they'll be automatically loaded and used.
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Home, Skull } from 'lucide-react';
import { Tile, TerrainType, HarvestResult, Factory, AttackResult, Discovery, type FlagBearer } from '@/types';
import { useGameContext } from '@/context/GameContext';
import { getTerrainImage, getBankImage, getBaseImage } from '@/lib/imageService';
import { logger } from '@/lib/logger';
import { getConsistentTileMessage } from '@/lib/tileMessages';
import { SafeHtmlRenderer } from '@/components/SafeHtmlRenderer';

interface TileRendererProps {
  tile: Tile;
  harvestResult?: HarvestResult | null;
  factoryData?: Factory | null;
  attackResult?: AttackResult | null;
  flagBearer?: FlagBearer | null;
  onDiscovery?: (discovery: Discovery, total: number) => void;
  onHarvestClick?: () => void;
  isHarvesting?: boolean;
  onAttackClick?: () => void;
  isAttacking?: boolean;
  onFlagAttack?: (bearer: FlagBearer) => void;
  onBankClick?: () => void;
  onShrineClick?: () => void;
}

/**
 * Get terrain color for fallback display
 */
function getTerrainColor(terrain: TerrainType): string {
  switch (terrain) {
    case TerrainType.Metal:
      return 'bg-gradient-to-br from-gray-400 to-gray-600';
    case TerrainType.Energy:
      return 'bg-gradient-to-br from-cyan-400 to-blue-600';
    case TerrainType.Cave:
      return 'bg-gradient-to-br from-purple-900 to-black';
    case TerrainType.Forest:
      return 'bg-gradient-to-br from-green-700 to-green-900';
    case TerrainType.Factory:
      return 'bg-gradient-to-br from-red-600 to-orange-700';
    case TerrainType.Wasteland:
      return 'bg-gradient-to-br from-amber-900 to-yellow-800';
    case TerrainType.Bank:
      return 'bg-gradient-to-br from-yellow-500 to-yellow-700';
    case TerrainType.Shrine:
      return 'bg-gradient-to-br from-purple-500 to-purple-900';
    case TerrainType.AuctionHouse:
      return 'bg-gradient-to-br from-emerald-500 to-teal-700';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Get terrain description with base awareness
 * Now uses consistent randomized messages based on coordinates
 */
function getTerrainDescription(
  terrain: TerrainType, 
  x: number, 
  y: number, 
  isBase: boolean = false, 
  bankType?: 'metal' | 'energy' | 'exchange'
): string {
  if (isBase) {
    return '🏠 Your command base - This is your starting location and safe haven';
  }
  
  // Use coordinate-based consistent message system
  return getConsistentTileMessage(terrain, x, y, bankType);
}

export default function TileRenderer({ tile, harvestResult, factoryData, attackResult, flagBearer, onHarvestClick, isHarvesting, onAttackClick, isAttacking, onFlagAttack, onBankClick, onShrineClick }: TileRendererProps) {
  const { player } = useGameContext();
  const _router = useRouter();
  
  // Dynamic image state
  const [imagePath, setImagePath] = React.useState<string | null>(null);
  const [imageError, setImageError] = React.useState(false);
  const [baseImagePath, setBaseImagePath] = React.useState<string | null>(null);
  const [baseImageError, setBaseImageError] = React.useState(false);
  const [factoryImageError, setFactoryImageError] = React.useState(false);
  // FID extension-negotiation cache: remembers which factory image extensions
  // 404'd this session so the loader skips straight to an existing format.
  const [factoryImagesChecked, setFactoryImagesChecked] = React.useState<Record<string, boolean>>({});
  const [_isLoading, setIsLoading] = React.useState(true);
  
  // Check if current player is the flag bearer
  const isCurrentPlayerBearer = flagBearer && player && (
    flagBearer.username === player.username
  );
  
  // Check if flag bearer is at this tile (from tile data or flagBearer prop)
  const isFlagBearerHere = tile.hasFlagBearer || (flagBearer?.position &&
    tile.x === flagBearer.position.x && 
    tile.y === flagBearer.position.y);
  
  // Check if this tile has the flag bearer's trail (from tile data)
  const isInTrail = tile.hasTrail && !isFlagBearerHere;
  
  // Calculate trail age (for fade effect)
  const trailAge = tile.trailTimestamp ? 
    (Date.now() - new Date(tile.trailTimestamp).getTime()) / (8 * 60 * 1000) : 0; // 0-1 (0=fresh, 1=expired)
  
  // CRITICAL VISIBILITY: Fresh trails = 100% opacity, fades to 40% over 8 minutes
  // This is the PRIMARY tracking method for flag bearer (Tier 0 - FREE)
  const trailOpacity = isInTrail ? Math.max(0.4, 1 - trailAge * 0.6) : 0;
  
  // Farmability helpers
  const isTileFarmable = (terrain: TerrainType): boolean => {
    return terrain === TerrainType.Metal || 
           terrain === TerrainType.Energy || 
           terrain === TerrainType.Cave || 
           terrain === TerrainType.Forest;
  };
  
  const isPlayerOnCooldown = (): boolean => {
    if (!player || !tile.lastHarvestedBy) return false;
    return tile.lastHarvestedBy.some(record => record.playerId === player.username);
  };
  
  const getCooldownTimeRemaining = (): string => {
    if (!isPlayerOnCooldown()) return '';
    
    // Calculate time until reset based on tile X coordinate
    // Tiles 1-75 reset at midnight, 76-150 reset at noon
    const now = new Date();
    const nextReset = new Date(now);
    
    if (tile.x >= 1 && tile.x <= 75) {
      // Reset at midnight
      nextReset.setHours(24, 0, 0, 0);
    } else {
      // Reset at noon
      nextReset.setHours(12, 0, 0, 0);
      if (nextReset <= now) {
        nextReset.setDate(nextReset.getDate() + 1);
      }
    }
    
    const msRemaining = nextReset.getTime() - now.getTime();
    const hours = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m until reset`;
    } else {
      return `${minutes}m until reset`;
    }
  };
  
  // Calculate distance to flag bearer for proximity effects
  const distanceToFlagBearer = flagBearer?.position ? 
    Math.sqrt(
      Math.pow(tile.x - flagBearer.position.x, 2) + 
      Math.pow(tile.y - flagBearer.position.y, 2)
    ) : null;
  
  // Show proximity indicator for nearby tiles (within 10 tiles)
  const showProximityIndicator = distanceToFlagBearer !== null && 
    distanceToFlagBearer > 0 && 
    distanceToFlagBearer <= 10;
  
  // Load appropriate image when tile changes
  React.useEffect(() => {
    let cancelled = false;
    
    const loadImage = async () => {
      setIsLoading(true);
      setImageError(false);
      
      try {
        logger.debug('TileRenderer: Loading tile image', { 
          terrain: tile.terrain, 
          x: tile.x, 
          y: tile.y 
        });
        
        // Handle Bank tiles
        if (tile.terrain === TerrainType.Bank) {
          const bankType = tile.bankType || 'metal'; // Default to metal bank
          const imgPath = await getBankImage(bankType, tile.x, tile.y);
          
          if (!cancelled) {
            setImagePath(imgPath);
            setImageError(!imgPath);
            logger.debug('Bank tile image loaded', { bankType, path: imgPath || 'fallback' });
          }
        }
        // Handle Auction House (use auction directory)
        else if (tile.terrain === TerrainType.AuctionHouse) {
          const imgPath = await getBankImage('auction', tile.x, tile.y);
          
          if (!cancelled) {
            setImagePath(imgPath);
            setImageError(!imgPath);
            logger.debug('Auction House tile image loaded', { path: imgPath || 'fallback' });
          }
        }
        // Handle Shrine (use shrine directory)
        else if (tile.terrain === TerrainType.Shrine) {
          const imgPath = await getTerrainImage('shrine', tile.x, tile.y);
          
          if (!cancelled) {
            setImagePath(imgPath);
            setImageError(!imgPath);
            logger.debug('Shrine tile image loaded', { path: imgPath || 'fallback' });
          }
        }
        // Handle regular terrain tiles
        else {
          const terrainDir = tile.terrain.toLowerCase();
          const imgPath = await getTerrainImage(terrainDir, tile.x, tile.y);
          
          if (!cancelled) {
            setImagePath(imgPath);
            setImageError(!imgPath);
            logger.debug('Terrain tile image loaded', { terrain: tile.terrain, path: imgPath || 'fallback' });
          }
        }
      } catch (error) {
        console.error('Error loading tile image:', error);
        if (!cancelled) {
          setImagePath(null);
          setImageError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    
    loadImage();
    
    return () => {
      cancelled = true;
    };
  }, [tile.terrain, tile.x, tile.y, tile.bankType]);
  
  // Load base overlay image when player base changes
  React.useEffect(() => {
    let cancelled = false;
    
    const loadBaseImage = async () => {
      if (!player) return;
      
      try {
        const rank = player.rank || 1;
        const imgPath = await getBaseImage(rank);
        
        if (!cancelled) {
          setBaseImagePath(imgPath);
          setBaseImageError(!imgPath);
          logger.debug('Base image loaded', { rank, path: imgPath || 'fallback' });
        }
      } catch (error) {
        console.error('Error loading base image:', error);
        if (!cancelled) {
          setBaseImagePath(null);
          setBaseImageError(true);
        }
      }
    };
    
    loadBaseImage();
    
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);
  
  // Determine if this tile is the player's base (YOUR base)
  // base is guarded: the GameContext player can hydrate before its base map loads.
  const isPlayerBase = tile.occupiedByBase && player?.base && 
    tile.x === player.base.x && tile.y === player.base.y;
  
  // Any base should show as a base (visible to all players)
  const isAnyBase = tile.occupiedByBase === true;
  
  // Get player rank for display (or rank 1 if not your base)
  const playerRank = player?.rank || 1;

  // Factory level-based image path (keep existing factory system for now).
  // Accepts BOTH .webp/.jpg and .png sources: prefers the optimized .webp
  // when present, else the first extension that exists, else falls back to
  // .png so operator-supplied assets in either format always resolve.
  const FACTORY_IMAGE_EXTS = ['.webp', '.jpg', '.png'] as const;
  const getFactoryImagePath = (): string => {
    if (tile.terrain === TerrainType.Factory && factoryData) {
      const factoryLevel = factoryData.level || 1;
      const basePath = `/assets/factories/level${factoryLevel}/factory`;
      if (typeof window !== 'undefined') {
        const available = FACTORY_IMAGE_EXTS
          .find(ext => factoryImagesChecked[`${basePath}${ext}`] !== false);
        return available ? `${basePath}${available}` : `${basePath}.png`;
      }
      return `${basePath}.png`;
    }
    return '';
  };

  const [factoryImagePath, setFactoryImagePath] = React.useState<string | null>(null);
  // Keep the negotiated path in sync with factory level / extension availability.
  React.useEffect(() => {
    setFactoryImagePath(getFactoryImagePath());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile.terrain, factoryData?.level, factoryImagesChecked]);

  // NEON NOIR status strip state chip (§5.1): farmability = green ready / magenta cooldown.
  const isFarmable = isTileFarmable(tile.terrain);
  const onCooldown = isFarmable && isPlayerOnCooldown();
  const stateChip = isFarmable ? (
    <span className={`nn-chip nn-viewport__chip ${onCooldown ? 'nn-chip--magenta' : 'nn-chip--green'}`}>
      {onCooldown ? getCooldownTimeRemaining() : 'ready'}
    </span>
  ) : null;

  return (
    <div className="nn-viewport-wrap">
      {/* Tile Display — HUD viewport: uniform square sized by the shell, never content.
          F2 uniformity fix: width = min(100%, calc(100dvh - 56px - 4rem)) on .nn-viewport-wrap,
          identical px on every terrain. Corner brackets + scanlines + status strip. */}
      <div className="nn-viewport">
        <div className="nn-viewport__corner nn-viewport__corner--tl" />
        <div className="nn-viewport__corner nn-viewport__corner--tr" />
        <div className="nn-viewport__corner nn-viewport__corner--bl" />
        <div className="nn-viewport__corner nn-viewport__corner--br" />
        <div className="nn-viewport__scanlines" />
        {/* Terrain Layer (Background) */}
        {!imageError && imagePath ? (
          <Image
            src={imagePath}
            alt={`${tile.terrain} tile`}
            fill
            sizes="(min-width: 0px) 42rem"
            className="object-cover"
            onError={() => {
              logger.warn('Failed to load tile image', { path: imagePath });
              setImageError(true);
            }}
            priority
          />
        ) : (
          <div className={`w-full h-full ${getTerrainColor(tile.terrain)} flex items-center justify-center`}>
            <div className="text-center text-white">
              <div className="text-6xl mb-4">
                {tile.terrain === TerrainType.Metal && '⚙️'}
                {tile.terrain === TerrainType.Energy && '⚡'}
                {tile.terrain === TerrainType.Cave && '🕳️'}
                {tile.terrain === TerrainType.Forest && '🌲'}
                {tile.terrain === TerrainType.Factory && '🏭'}
                {tile.terrain === TerrainType.Wasteland && '🏜️'}
                {tile.terrain === TerrainType.Bank && '🏦'}
                {tile.terrain === TerrainType.Shrine && '⛩️'}
                {tile.terrain === TerrainType.AuctionHouse && '🏛️'}
              </div>
              <p className="text-2xl font-bold">{tile.terrain}</p>
              {tile.terrain === TerrainType.Bank && tile.bankType && (
                <p className="text-sm text-yellow-200 mt-2">
                  {tile.bankType === 'metal' && '⚙️ Metal Storage'}
                  {tile.bankType === 'energy' && '⚡ Energy Storage'}
                  {tile.bankType === 'exchange' && '🔄 Exchange'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Base Overlay Layer (if player's base) */}
        {isPlayerBase && !baseImageError && baseImagePath && (
          <Image
            src={baseImagePath}
            alt={`Rank ${playerRank} base`}
            fill
            sizes="(min-width: 0px) 42rem"
            className="object-cover z-10"
            onError={() => setBaseImageError(true)}
            priority
          />
        )}

        {/* Factory Overlay Layer (level-based) */}
        {tile.terrain === TerrainType.Factory && factoryData && factoryImagePath && !factoryImageError && (
          <Image
            src={factoryImagePath}
            alt={`Level ${factoryData.level} factory`}
            fill
            sizes="(min-width: 0px) 42rem"
            className="object-cover z-10"
            onError={() => {
              // Mark this exact path missing, then try the next extension
              // (webp → jpg → png). All exhausted = real render fallback.
              setFactoryImagesChecked(prev => ({ ...prev, [factoryImagePath]: false }));
              const basePath = factoryImagePath.replace(/\.(webp|jpg|png)$/, '');
              const tried = factoryImagesChecked;
              const next = FACTORY_IMAGE_EXTS.find(ext => tried[`${basePath}${ext}`] !== false && `${basePath}${ext}` !== factoryImagePath);
              if (next) {
                setFactoryImagePath(`${basePath}${next}`);
              } else {
                setFactoryImageError(true);
              }
            }}
            priority
          />
        )}

        {/* Farmability moved to the viewport status strip (NEON NOIR §5.1) */}

        {/* Base Indicator Badge */}
        {tile.occupiedByBase && (
          <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--nn-green)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_14%,transparent)] px-3 py-1 font-orbitron text-xs font-bold uppercase tracking-wider text-[color:var(--nn-green)] shadow-[0_0_14px_color-mix(in_oklab,var(--nn-green)_25%,transparent)]">
            <Home className="h-3.5 w-3.5" /> Base {isPlayerBase && playerRank > 1 ? `(Rank ${playerRank})` : !isPlayerBase && tile.baseOwner ? `(${tile.baseOwner})` : ''}
          </div>
        )}

        {/* Bank Type Indicator Badge */}
        {tile.terrain === TerrainType.Bank && tile.bankType && (
          <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-sm font-bold shadow-lg z-20">
            {tile.bankType === 'metal' && '⚙️ Metal'}
            {tile.bankType === 'energy' && '⚡ Energy'}
            {tile.bankType === 'exchange' && '🔄 Exchange'}
          </div>
        )}

        {/* Shrine Indicator Badge */}
        {tile.terrain === TerrainType.Shrine && (
          <div className="absolute top-4 right-4 bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg z-20">
            ⛩️ Shrine
          </div>
        )}

        {/* Flag Bearer Indicator with Animated Effects - Reduced for bearer */}
        {isFlagBearerHere && flagBearer && (
          <>
            {/* Pulsing Glow Effect - Subtle for bearer, full for others */}
            <div className="absolute inset-0 z-30 pointer-events-none">
              {isCurrentPlayerBearer ? (
                <>
                  {/* Minimal effects when you're the bearer */}
                  <div className="absolute inset-0 bg-gradient-radial from-yellow-400/15 via-orange-400/8 to-transparent"></div>
                  <div className="absolute inset-0 border-2 border-yellow-400/40 shadow-[0_0_20px_rgba(250,204,21,0.3)]"></div>
                </>
              ) : (
                <>
                  {/* Full effects when viewing another bearer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/50 via-orange-500/50 to-red-500/50 animate-pulse"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/40 via-transparent to-orange-400/40 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute inset-0 bg-gradient-radial from-yellow-500/60 via-orange-500/40 to-transparent animate-pulse" style={{ animationDelay: '0.25s' }}></div>
                  <div className="absolute inset-0 border-8 border-yellow-400 animate-pulse shadow-[0_0_80px_rgba(250,204,21,1),0_0_120px_rgba(251,191,36,0.8),0_0_160px_rgba(234,179,8,0.6),inset_0_0_60px_rgba(250,204,21,0.4)]"></div>
                  <div className="absolute inset-0 border-4 border-orange-500 animate-pulse shadow-[0_0_60px_rgba(249,115,22,0.9)]" style={{ animationDelay: '0.3s' }}></div>
                </>
              )}
            </div>
            
            {/* Floating Particles - Minimal for bearer, full for others */}
            <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
              {isCurrentPlayerBearer ? (
                <>
                  {/* Just a few subtle particles when you're the bearer */}
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={`subtle-${i}`}
                      className="absolute w-1.5 h-1.5 bg-yellow-400/40 rounded-full animate-float shadow-[0_0_6px_rgba(250,204,21,0.3)]"
                      style={{
                        left: `${(i * 10) % 100}%`,
                        bottom: `${(i * 10) % 100}%`,
                        animationDelay: `${i * 0.2}s`,
                        animationDuration: '4s'
                      }}
                    ></div>
                  ))}
                </>
              ) : (
                <>
                  {/* Full particle layers when viewing another bearer */}
                  {[...Array(40)].map((_, i) => (
                    <div
                      key={`bottom-${i}`}
                      className="absolute w-3 h-3 bg-yellow-400 rounded-full animate-float opacity-80 shadow-[0_0_10px_rgba(250,204,21,0.8)]"
                      style={{
                        left: `${(i * 2.5) % 100}%`,
                        bottom: `${(i % 4) * 8}%`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '3s'
                      }}
                    ></div>
                  ))}
                  
                  {[...Array(40)].map((_, i) => (
                    <div
                      key={`middle-${i}`}
                      className="absolute w-2.5 h-2.5 bg-orange-400 rounded-full animate-float opacity-75 shadow-[0_0_8px_rgba(251,146,60,0.8)]"
                      style={{
                        left: `${((i * 2.5) + 1.25) % 100}%`,
                        bottom: `${((i % 4) * 8) + 35}%`,
                        animationDelay: `${i * 0.12}s`,
                        animationDuration: '3.5s'
                      }}
                    ></div>
                  ))}
                  
                  {[...Array(40)].map((_, i) => (
                    <div
                      key={`top-${i}`}
                      className="absolute w-2 h-2 bg-red-400 rounded-full animate-float opacity-70 shadow-[0_0_6px_rgba(248,113,113,0.8)]"
                      style={{
                        left: `${((i * 2.5) + 0.5) % 100}%`,
                        bottom: `${((i % 4) * 8) + 70}%`,
                        animationDelay: `${i * 0.15}s`,
                        animationDuration: '4s'
                      }}
                    ></div>
                  ))}
                </>
              )}
            </div>

            {/* Rotating Rings and Large Flag - Only for non-bearers */}
            {!isCurrentPlayerBearer && (
              <>
                {/* Scattered sparkles */}
                <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                  {[...Array(30)].map((_, i) => (
                    <div
                      key={`sparkle-${i}`}
                      className="absolute w-1.5 h-1.5 bg-white rounded-full animate-float opacity-90 shadow-[0_0_12px_rgba(255,255,255,1)]"
                      style={{
                        left: `${Math.random() * 100}%`,
                        bottom: `${Math.random() * 100}%`,
                        animationDelay: `${i * 0.08}s`,
                        animationDuration: `${2.5 + Math.random()}s`
                      }}
                    ></div>
                  ))}
                  
                  {/* Large glowing orbs */}
                  {[...Array(15)].map((_, i) => (
                    <div
                      key={`orb-${i}`}
                      className="absolute w-6 h-6 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full animate-float opacity-60 blur-sm shadow-[0_0_20px_rgba(250,204,21,1)]"
                      style={{
                        left: `${(i * 7) % 100}%`,
                        bottom: `${(i * 11) % 100}%`,
                        animationDelay: `${i * 0.2}s`,
                        animationDuration: '5s'
                      }}
                    ></div>
                  ))}
                </div>

                {/* Rotating Ring Effect */}
                <div className="absolute inset-0 z-30 pointer-events-none">
                  <div className="absolute inset-4 border-4 border-yellow-300/50 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
                  <div className="absolute inset-8 border-4 border-orange-300/50 rounded-full animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}></div>
                </div>
              </>
            )}

            {/* Giant Flag Overlay - Smaller for bearer, huge for others */}
            <div className="absolute inset-0 z-35 pointer-events-none flex items-center justify-center">
              <div 
                className={`animate-pulse drop-shadow-[0_0_40px_rgba(250,204,21,1)] ${
                  isCurrentPlayerBearer 
                    ? 'text-[4rem] opacity-25' 
                    : 'text-[20rem] opacity-60'
                }`}
                style={{
                  animation: 'pulse 2s ease-in-out infinite, float 4s ease-in-out infinite',
                  filter: isCurrentPlayerBearer
                    ? 'drop-shadow(0 0 10px rgba(250,204,21,0.3))'
                    : 'drop-shadow(0 0 40px rgba(250,204,21,1)) drop-shadow(0 0 80px rgba(251,191,36,0.8))'
                }}
              >
                🚩
              </div>
            </div>

            {/* Flag Bearer Badge - Only show for non-bearers */}
            {!isCurrentPlayerBearer && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2 rounded-full text-lg font-bold shadow-2xl z-40 border-2 border-yellow-300 animate-bounce">
                🚩 FLAG BEARER
              </div>
            )}

            {/* Bearer Info */}
            <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm z-40 border border-yellow-400">
              <div className="font-bold text-yellow-300">{flagBearer.username ?? 'Unknown'}</div>
              <div className="text-xs">Level: {flagBearer.level ?? '?'}</div>
              {flagBearer.currentHP && flagBearer.maxHP && (
                <div className="text-xs">HP: {flagBearer.currentHP}/{flagBearer.maxHP}</div>
              )}
              {/* Only show attack button if player is NOT the bearer */}
              {onFlagAttack && !isCurrentPlayerBearer && (
                <button
                  onClick={() => onFlagAttack(flagBearer)}
                  className="mt-2 w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-3 py-1 rounded-md text-xs font-semibold transition-all hover:scale-105 active:scale-95 border border-red-400 shadow-lg"
                >
                  ⚔️ Attack Bearer
                </button>
              )}
              {/* Show status message if player IS the bearer */}
              {isCurrentPlayerBearer && (
                <div className="mt-2 w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 py-2 rounded-md text-xs font-semibold text-center border border-green-400 shadow-lg">
                  ✓ You hold the flag!
                </div>
              )}
            </div>
          </>
        )}

        {/* Flag Bearer Proximity Indicator for Nearby Tiles */}
        {showProximityIndicator && flagBearer && distanceToFlagBearer && (
          <>
            {/* Subtle Glow Effect - Intensity decreases with distance */}
            <div 
              className="absolute inset-0 z-20 pointer-events-none"
              style={{
                opacity: Math.max(0.1, 1 - (distanceToFlagBearer / 10))
              }}
            >
              <div className="absolute inset-0 bg-gradient-radial from-yellow-500/20 via-orange-500/10 to-transparent animate-pulse"></div>
            </div>
            
            {/* Directional Particles - Fewer particles further away */}
            <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
              {[...Array(Math.max(2, Math.floor(8 - distanceToFlagBearer)))].map((_, i) => {
                // Calculate angle toward flag bearer
                const dx = (flagBearer.position?.x ?? tile.x) - tile.x;
                const dy = (flagBearer.position?.y ?? tile.y) - tile.y;
                const angle = Math.atan2(dy, dx);
                
                // Position particles along the direction
                const particleX = 50 + Math.cos(angle) * (20 + i * 10);
                const particleY = 50 + Math.sin(angle) * (20 + i * 10);
                
                return (
                  <div
                    key={i}
                    className="absolute w-1.5 h-1.5 bg-yellow-400/60 rounded-full animate-float"
                    style={{
                      left: `${particleX}%`,
                      top: `${particleY}%`,
                      animationDelay: `${i * 0.3}s`,
                      animationDuration: '4s',
                      opacity: Math.max(0.3, 1 - (distanceToFlagBearer / 10))
                    }}
                  ></div>
                );
              })}
            </div>

            {/* Distance Badge - Only show if within attack range (5 tiles) */}
            {distanceToFlagBearer <= 5 && (
              <div className="absolute top-2 right-2 bg-orange-600/80 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-bold z-30 border border-yellow-400/50 shadow-lg animate-pulse">
                🚩 {Math.round(distanceToFlagBearer)} tiles away
              </div>
            )}
          </>
        )}

        {/* Flag Bearer Trail Particles (8-minute lingering effect) - EXTREME VISIBILITY */}
        {/* CRITICAL: This is the PRIMARY tracking method for flag bearer (Tier 0 - FREE) */}
        {isInTrail && flagBearer && (
          <>
            {/* LAYER 1: MASSIVE Animated Border Pulse - COVERING ENTIRE TILE */}
            <div 
              className="absolute inset-0 z-25 pointer-events-none"
              style={{ opacity: trailOpacity }}
            >
              <div 
                className="absolute inset-0 border-[10px] border-yellow-300 animate-pulse"
                style={{
                  backgroundColor: `rgba(250, 204, 21, ${trailOpacity * 0.3})`,
                  boxShadow: `
                    inset 0 0 60px rgba(250, 204, 21, ${trailOpacity}),
                    inset 0 0 100px rgba(251, 146, 60, ${trailOpacity * 0.8}),
                    0 0 80px rgba(250, 204, 21, ${trailOpacity}),
                    0 0 120px rgba(251, 146, 60, ${trailOpacity}),
                    0 0 160px rgba(252, 211, 77, ${trailOpacity * 0.7})
                  `
                }}
              ></div>
            </div>

            {/* LAYER 2: INTENSE Background Glow - COVERS ENTIRE TILE */}
            <div 
              className="absolute inset-0 z-24 pointer-events-none"
              style={{ opacity: trailOpacity }}
            >
              <div className="absolute inset-0 bg-gradient-radial from-yellow-200 via-orange-300/90 to-yellow-300/70 animate-pulse"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-300/80 via-orange-300/80 to-red-400/60"></div>
              <div className="absolute inset-0 bg-yellow-200/40"></div>
            </div>
            
            {/* LAYER 3: GIGANTIC Animated Particles - FILL THE TILE */}
            <div className="absolute inset-0 z-26 pointer-events-none overflow-hidden">
              {[...Array(Math.ceil(120 * trailOpacity))].map((_, i) => (
                <div
                  key={`trail-${i}`}
                  className="absolute bg-yellow-200 rounded-full animate-float"
                  style={{
                    width: `${10 + (i % 5) * 3}px`,
                    height: `${10 + (i % 5) * 3}px`,
                    left: `${(i * 3 + 2) % 98}%`,
                    bottom: `${(i * 5) % 95}%`,
                    animationDelay: `${i * 0.03}s`,
                    animationDuration: `${1.5 + (i % 4) * 0.3}s`,
                    opacity: trailOpacity,
                    backgroundColor: i % 3 === 0 ? 'rgb(250, 204, 21)' : i % 3 === 1 ? 'rgb(251, 146, 60)' : 'rgb(252, 211, 77)',
                    boxShadow: `
                      0 0 ${30 * trailOpacity}px rgba(250, 204, 21, ${trailOpacity}),
                      0 0 ${50 * trailOpacity}px rgba(251, 146, 60, ${trailOpacity}),
                      0 0 ${70 * trailOpacity}px rgba(252, 211, 77, ${trailOpacity * 0.8})
                    `
                  }}
                ></div>
              ))}
            </div>

            {/* LAYER 4: Massive Swirling Expansion Rings */}
            <div className="absolute inset-0 z-25 pointer-events-none overflow-hidden">
              {[...Array(16)].map((_, i) => (
                <div
                  key={`swirl-${i}`}
                  className="absolute w-16 h-16 rounded-full border-[4px] border-yellow-300"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: `expand-fade ${1.2 + i * 0.15}s ease-out infinite`,
                    animationDelay: `${i * 0.1}s`,
                    opacity: trailOpacity,
                    boxShadow: `0 0 30px rgba(250, 204, 21, ${trailOpacity})`
                  }}
                ></div>
              ))}
            </div>

            {/* LAYER 5: GIGANTIC Corner Sparkles */}
            <div className="absolute top-0 left-0 w-12 h-12 bg-yellow-200 rounded-full z-27 animate-ping shadow-[0_0_40px_rgba(250,204,21,1)]" style={{ opacity: trailOpacity }}></div>
            <div className="absolute top-0 right-0 w-12 h-12 bg-yellow-200 rounded-full z-27 animate-ping shadow-[0_0_40px_rgba(250,204,21,1)]" style={{ opacity: trailOpacity, animationDelay: '0.2s' }}></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 bg-yellow-200 rounded-full z-27 animate-ping shadow-[0_0_40px_rgba(250,204,21,1)]" style={{ opacity: trailOpacity, animationDelay: '0.4s' }}></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 bg-yellow-200 rounded-full z-27 animate-ping shadow-[0_0_40px_rgba(250,204,21,1)]" style={{ opacity: trailOpacity, animationDelay: '0.6s' }}></div>
            
            {/* LAYER 6: GIGANTIC Trail Age Badge */}
            <div 
              className="absolute bottom-1 right-1 bg-gradient-to-br from-yellow-300 to-orange-500 backdrop-blur-sm text-black px-6 py-3 rounded-2xl text-xl font-black z-30 border-[4px] border-yellow-100 shadow-2xl"
              style={{ 
                opacity: trailOpacity,
                boxShadow: `
                  0 0 40px rgba(250, 204, 21, ${trailOpacity}),
                  0 0 60px rgba(251, 146, 60, ${trailOpacity}),
                  inset 0 0 30px rgba(255, 255, 255, 0.5)
                `
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-4xl animate-pulse">🚩</span>
                <span className="drop-shadow-[0_2px_6px_rgba(0,0,0,1)]">{Math.ceil((1 - trailAge) * 8)}min</span>
              </div>
            </div>

            {/* LAYER 7: GIGANTIC "FLAG TRAIL" Text Overlay */}
            <div 
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-28 pointer-events-none"
              style={{ opacity: trailOpacity }}
            >
              <div 
                className="text-yellow-100 font-black text-3xl tracking-widest animate-pulse"
                style={{
                  textShadow: `
                    0 0 20px rgba(250, 204, 21, ${trailOpacity}),
                    0 0 40px rgba(251, 146, 60, ${trailOpacity}),
                    0 0 60px rgba(252, 211, 77, ${trailOpacity}),
                    4px 4px 8px rgba(0, 0, 0, 1),
                    -2px -2px 4px rgba(255, 255, 255, 0.5)
                  `
                }}
              >
                FLAG TRAIL
              </div>
            </div>
          </>
        )}

        {/* Infantry Attack Particle Effects */}
        {(isAttacking || attackResult) && (
          <>
            {/* Explosive Flash Effect */}
            <div className="absolute inset-0 z-35 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/40 via-orange-500/40 to-yellow-500/30 animate-pulse"></div>
              <div className="absolute inset-0 border-4 border-red-500 animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.9)]"></div>
            </div>

            {/* Combat Sparks - Radiating Outward */}
            <div className="absolute inset-0 z-35 pointer-events-none overflow-hidden">
              {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * 2 * Math.PI;
                const distance = 40;
                const startX = 50;
                const startY = 50;
                const _endX = 50 + Math.cos(angle) * distance;
                const _endY = 50 + Math.sin(angle) * distance;
                
                return (
                  <div
                    key={i}
                    className="absolute w-1 h-6 bg-gradient-to-b from-red-500 via-orange-400 to-transparent rounded-full opacity-80"
                    style={{
                      left: `${startX}%`,
                      top: `${startY}%`,
                      transform: `translate(-50%, -50%) rotate(${(angle * 180 / Math.PI) + 90}deg)`,
                      animation: `sparkFly 0.8s ease-out ${i * 0.05}s forwards`
                    }}
                  ></div>
                );
              })}
            </div>

            {/* Impact Particles - Expanding Ring */}
            <div className="absolute inset-0 z-35 pointer-events-none overflow-hidden">
              {[...Array(16)].map((_, i) => {
                const angle = (i / 16) * 2 * Math.PI;
                
                return (
                  <div
                    key={i}
                    className="absolute w-3 h-3 bg-orange-500 rounded-full opacity-70"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      animation: `impactExpand 1s ease-out ${i * 0.03}s forwards`,
                      '--angle': `${angle}rad`
                    } as React.CSSProperties}
                  ></div>
                );
              })}
            </div>

            {/* Smoke Clouds */}
            <div className="absolute inset-0 z-34 pointer-events-none overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-20 h-20 bg-gray-900/40 rounded-full blur-xl"
                  style={{
                    left: `${30 + (i * 10)}%`,
                    top: `${40 + (i % 2) * 20}%`,
                    animation: `smokeRise 2s ease-out ${i * 0.2}s forwards`
                  }}
                ></div>
              ))}
            </div>

            {/* Attack Impact Badge */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
              <div className="text-6xl animate-bounce">
                {attackResult?.success ? '⚔️' : isAttacking ? '💥' : ''}
              </div>
              {attackResult?.damageDealt && (
                <div className="text-red-500 font-bold text-2xl text-center animate-pulse mt-2 drop-shadow-[0_0_10px_rgba(239,68,68,1)]">
                  -{attackResult.damageDealt}
                </div>
              )}
            </div>
          </>
        )}

        {/* Viewport status strip — terrain · coordinates · state (NEON NOIR §5.1).
            Must live INSIDE .nn-viewport (its absolute anchor). */}
        <div className="nn-viewport__status">
          <strong>{tile.terrain}</strong>
          <span className="nn-viewport__coords">{`[${tile.x} · ${tile.y}]`}</span>
          {tile.occupiedByBase && tile.baseOwner && !isPlayerBase && (
            <span className="nn-viewport__coords flex items-center gap-1">
              <Skull className="h-3 w-3" /> {tile.baseOwner}
            </span>
          )}
          {stateChip}
        </div>
      </div>

      {/* Tile Info */}
      <div className="nn-panel mt-4 space-y-2 p-4">
        <div className="flex justify-between items-center">
          <h3 className="font-orbitron text-base font-bold uppercase tracking-[0.12em] text-[color:var(--nn-cyan)]">
            {isAnyBase ? (
              <>
                <span className="text-[color:var(--nn-green)]">Base — {isPlayerBase ? 'Yours' : tile.baseOwner ?? 'Player'}</span>
                <span className="ml-2 text-[10px] tracking-[0.2em] text-[color:var(--nn-text-tertiary)]">{tile.terrain}</span>
              </>
            ) : (
              tile.terrain
            )}
          </h3>
          <span className="font-orbitron text-sm tabular-nums text-[color:var(--nn-text-tertiary)]">
            ({tile.x}, {tile.y})
          </span>
        </div>
        <p className="text-sm text-[color:var(--nn-text-secondary)]">{getTerrainDescription(tile.terrain, tile.x, tile.y, isAnyBase, tile.bankType)}</p>
        
        {/* Base Greeting Display */}
        {isAnyBase && tile.baseGreeting && (
          <div className="nn-well mt-3 p-3" style={{ margin: '0.75rem 12px 8px', width: 'auto', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <p className="nn-lab">Base message</p>
            <SafeHtmlRenderer 
              html={tile.baseGreeting}
              fallback="Welcome to my base!"
              className="text-sm text-[color:var(--nn-text-primary)]"
            />
          </div>
        )}
        
        {/* Tile Interaction Buttons */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Bank Button */}
          {tile.terrain === TerrainType.Bank && onBankClick && (
            <button
              onClick={onBankClick}
              className="nn-btn nn-btn--primary flex-1 px-4 py-2"
            >
              Open Bank (B)
            </button>
          )}

          {/* Shrine Button */}
          {tile.terrain === TerrainType.Shrine && onShrineClick && (
            <button
              onClick={onShrineClick}
              className="nn-btn nn-btn--primary flex-1 px-4 py-2"
            >
              Visit Shrine (S)
            </button>
          )}

          {/* Factory Management Button - TODO: Create factory management page */}
          {/* {tile.terrain === TerrainType.Factory && factoryData?.owner === player?.username && (
            <button
              onClick={() => router.push('/game/factory-management')}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold px-4 py-2 rounded transition-colors"
            >
              🏭 Manage Factory
            </button>
          )} */}          {/* Harvest Button - Shows on harvestable tiles */}
          {onHarvestClick && (tile.terrain === TerrainType.Metal || tile.terrain === TerrainType.Energy || tile.terrain === TerrainType.Cave || tile.terrain === TerrainType.Forest) && (
            <button
              onClick={onHarvestClick}
              disabled={isHarvesting}
              className={`nn-btn ${isHarvesting ? 'nn-btn--ghost' : 'nn-btn--primary nn-btn--harvest'} w-full py-3 text-base`}
            >
              {isHarvesting ? 'HARVESTING…' : `HARVEST (${tile.terrain === TerrainType.Cave || tile.terrain === TerrainType.Forest ? 'F' : 'G'})`}
            </button>
          )}
        </div>

        {/* Bank/Shrine Controls Hint */}
        {tile.terrain === TerrainType.Bank && (
          <p className="nn-footnote mt-2" style={{ marginTop: 8 }}>
            Press <kbd className="nn-kbd">B</kbd> to open Bank interface
          </p>
        )}
        {tile.terrain === TerrainType.Shrine && (
          <p className="nn-footnote mt-2" style={{ marginTop: 8 }}>
            Press <kbd className="nn-kbd">S</kbd> to open Shrine interface
          </p>
        )}
      </div>

      {/* Factory Info (if factory tile) */}
      {tile.terrain === TerrainType.Factory && factoryData && (
        <div className="nn-panel nn-panel--danger mt-4 space-y-3 p-4">
          <div className="flex justify-between items-center">
            <h4 className="font-orbitron text-sm font-bold uppercase tracking-[0.14em] text-[color:var(--nn-magenta)]">Factory Status</h4>
            {factoryData.owner && (
              <span className={`text-xs font-semibold ${factoryData.owner === player?.username ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-amber)]'}`}>
                {factoryData.owner === player?.username ? 'Yours' : `Owned by ${factoryData.owner}`}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="nn-well p-2" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span className="nn-lab">Defense</span>
              <div className="nn-num text-[color:var(--nn-text-primary)]">{factoryData.defense.toLocaleString()}</div>
            </div>
            <div className="nn-well p-2" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span className="nn-lab">Production</span>
              <div className="nn-num text-[color:var(--nn-text-primary)]">{factoryData.productionRate}/hr</div>
            </div>
            <div className="nn-well col-span-2 p-2" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span className="nn-lab">Unit Slots</span>
              <div className="flex items-center justify-between">
                <div className="nn-num text-[color:var(--nn-text-primary)]">{factoryData.usedSlots} / {factoryData.slots}</div>
                <div className="nn-meter h-2 w-32">
                  <div 
                    className="nn-meter__fill"
                    style={{ width: `${Math.min(100, (factoryData.usedSlots / factoryData.slots) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Attack Factory Button */}
          {onAttackClick && (
            <button
              onClick={onAttackClick}
              disabled={isAttacking}
              className={`nn-btn w-full py-3 text-base ${
                isAttacking 
                  ? 'nn-btn--ghost' 
                  : factoryData.owner === player?.username
                    ? 'nn-btn--primary'
                    : 'nn-btn--danger'
              }`}
            >
              {isAttacking ? 'ATTACKING…' : factoryData.owner === player?.username ? 'MANAGE FACTORY (R)' : 'ATTACK FACTORY (R)'}
            </button>
          )}
        </div>
      )}

      {/* Harvest Result Display (below tile image) */}
      {harvestResult && (
        <div className="nn-panel mt-4 animate-fade-in p-4">
          {/* Success/Failure Message */}
          <div className={`nn-panel__header mb-3 justify-center text-center text-base ${harvestResult.success ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
            {harvestResult.message || (harvestResult.success ? 'Harvest complete' : 'Harvest failed')}
          </div>
          
          {/* Resource Results */}
          {harvestResult.success && (harvestResult.metalGained || harvestResult.energyGained) && (
            <div className="mb-3 flex justify-center gap-6">
              {harvestResult.metalGained && harvestResult.metalGained > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="nn-num text-xl text-[color:var(--nn-amber)]">
                    +{harvestResult.metalGained.toLocaleString()}
                  </span>
                  <span className="nn-lab">metal</span>
                </div>
              )}
              {harvestResult.energyGained && harvestResult.energyGained > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="nn-num text-xl text-[color:var(--nn-cyan)]">
                    +{harvestResult.energyGained.toLocaleString()}
                  </span>
                  <span className="nn-lab">energy</span>
                </div>
              )}
            </div>
          )}

          {/* Cave Item Result */}
          {harvestResult.success && harvestResult.item && (
            <div className="mb-3 flex items-center justify-center gap-3 rounded p-3" style={{ background: 'color-mix(in oklab, var(--nn-violet) 10%, transparent)' }}>
              <div>
                <div className="font-bold text-[color:var(--nn-violet)]">{harvestResult.item.name}</div>
                {harvestResult.item.description && (
                  <div className="text-sm text-[color:var(--nn-text-secondary)]">{harvestResult.item.description}</div>
                )}
              </div>
            </div>
          )}

          {/* Bonus Applied */}
          {harvestResult.bonusApplied && harvestResult.bonusApplied > 0 && (
            <p className="nn-footnote mb-2" style={{ color: 'var(--nn-green)', fontSize: 11 }}>
              +{harvestResult.bonusApplied.toFixed(2)}% bonus applied
            </p>
          )}

          {/* Result Message */}
          <div className="mt-2 whitespace-pre-line border-t border-[color-mix(in_oklab,var(--nn-cyan)_12%,transparent)] pt-3 text-center text-sm text-[color:var(--nn-text-secondary)]">
            {harvestResult.message}
          </div>
        </div>
      )}

      {/* Attack Result Display (below tile image) */}
      {attackResult && (
        <div className="nn-panel nn-panel--danger mt-4 animate-fade-in p-4">
          <div className={`nn-panel__header mb-2 justify-center text-center text-base ${attackResult.success ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
            {attackResult.captured ? 'FACTORY CAPTURED' : attackResult.success ? 'Attack successful' : 'Attack failed'}
          </div>
          
          {/* Power Comparison */}
          <div className="mb-3 flex justify-center gap-6 rounded p-3" style={{ background: 'color-mix(in oklab, var(--nn-void) 50%, transparent)' }}>
            <div className="text-center">
              <div className="nn-lab mb-1">Your power</div>
              <div className="nn-num text-xl text-[color:var(--nn-cyan)]">
                {attackResult.playerPower.toLocaleString()}
              </div>
            </div>
            <div className="nn-lab flex items-center" style={{ fontSize: 12 }}>VS</div>
            <div className="text-center">
              <div className="nn-lab mb-1">Factory defense</div>
              <div className="nn-num text-xl text-[color:var(--nn-magenta)]">
                {attackResult.factoryDefense.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Capture Status */}
          {attackResult.captured && (
            <div className="mb-3 flex items-center justify-center gap-3 rounded p-3" style={{ background: 'color-mix(in oklab, var(--nn-green) 10%, transparent)' }}>
              <div className="font-bold text-[color:var(--nn-green)]">Factory now under your control</div>
            </div>
          )}

          {/* Damage Dealt */}
          {attackResult.damageDealt && attackResult.damageDealt > 0 && (
            <p className="nn-footnote mb-2" style={{ color: 'var(--nn-amber)', fontSize: 11 }}>
              {attackResult.damageDealt} damage dealt
            </p>
          )}

          {/* Result Message */}
          <div className="mt-2 whitespace-pre-line border-t border-[color-mix(in_oklab,var(--nn-magenta)_12%,transparent)] pt-3 text-center text-sm text-[color:var(--nn-text-secondary)]">
            {attackResult.message}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
