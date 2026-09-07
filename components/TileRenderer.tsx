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
import { Home, Skull, Flag } from 'lucide-react';
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
      return 'bg-gradient-to-br from-[color:var(--nn-cyan)] to-[color:var(--nn-cyan)]';
    case TerrainType.Cave:
      return 'bg-gradient-to-br from-[color:var(--nn-violet)] to-black';
    case TerrainType.Forest:
      return 'bg-gradient-to-br from-[color:var(--nn-green)] to-[color:var(--nn-green)]';
    case TerrainType.Factory:
      return 'bg-gradient-to-br from-[color:var(--nn-magenta)] to-[color:var(--nn-amber)]';
    case TerrainType.Wasteland:
      return 'bg-gradient-to-br from-[color:var(--nn-amber)] to-[color:var(--nn-amber)]';
    case TerrainType.Bank:
      return 'bg-gradient-to-br from-[color:var(--nn-amber)] to-[color:var(--nn-amber)]';
    case TerrainType.Shrine:
      return 'bg-gradient-to-br from-[color:var(--nn-violet)] to-[color:var(--nn-violet)]';
    case TerrainType.AuctionHouse:
      return 'bg-gradient-to-br from-[color:var(--nn-green)] to-[color:var(--nn-green)]';
    default:
      return 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]';
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
            <div className="text-center text-[color:var(--nn-text-primary)]">
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
                <p className="text-sm mt-2" style={{ color: 'var(--nn-amber)', letterSpacing: '0.1em' }}>
                  {tile.bankType === 'metal' && 'METAL STORAGE'}
                  {tile.bankType === 'energy' && 'ENERGY STORAGE'}
                  {tile.bankType === 'exchange' && 'EXCHANGE'}
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
          <div className="absolute top-4 right-4 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] px-3 py-1 rounded-full text-sm font-bold shadow-lg z-20">
            {tile.bankType === 'metal' && '⚙️ Metal'}
            {tile.bankType === 'energy' && '⚡ Energy'}
            {tile.bankType === 'exchange' && '🔄 Exchange'}
          </div>
        )}

        {/* Shrine Indicator Badge */}
        {tile.terrain === TerrainType.Shrine && (
          <div className="nn-viewport__chip nn-viewport__chip--violet">
            SHRINE
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
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklab, var(--nn-amber) 15%, transparent) 0%, transparent 70%)' }}></div>
                  <div className="absolute inset-0 nn-bearer__edge--soft"></div>
                </>
              ) : (
                <>
                  {/* Full effects when viewing another bearer */}
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklab, var(--nn-amber) 40%, transparent) 0%, color-mix(in oklab, var(--nn-amber) 18%, transparent) 55%, transparent 75%)' }}></div>
                  <div className="absolute inset-0 nn-bearer__edge animate-pulse"></div>
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
                      className="absolute w-1.5 h-1.5 rounded-full animate-float nn-bearer__ember"
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
                      className="absolute w-3 h-3 rounded-full animate-float nn-bearer__ember"
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
                      className="absolute w-2.5 h-2.5 rounded-full animate-float nn-bearer__ember"
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
                      className="absolute w-2 h-2 rounded-full animate-float nn-bearer__ember"
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
                      className="absolute w-1.5 h-1.5 bg-[color:var(--nn-text-primary)] rounded-full animate-float nn-bearer__spark"
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
                      className="absolute w-6 h-6 rounded-full animate-float nn-bearer__orb"
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
                  <div className="absolute inset-4 rounded-full nn-bearer__ring animate-spin" style={{ animationDuration: '8s' }}></div>
                  <div className="absolute inset-8 rounded-full nn-bearer__ring animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }}></div>
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
              <div className="nn-bearer__badge animate-bounce">
                <Flag className="h-4 w-4" /> FLAG BEARER
              </div>
            )}

            {/* Bearer Info */}
            <div className="nn-bearer__info">
              <div className="nn-bearer__name">{flagBearer.username ?? 'Unknown'}</div>
              <div className="nn-bearer__meta">LVL {flagBearer.level ?? '?'}</div>
              {flagBearer.currentHP && flagBearer.maxHP && (
                <div className="nn-bearer__meta">HP {flagBearer.currentHP}/{flagBearer.maxHP}</div>
              )}
              {/* Only show attack button if player is NOT the bearer */}
              {onFlagAttack && !isCurrentPlayerBearer && (
                <button
                  onClick={() => onFlagAttack(flagBearer)}
                  className="nn-btn nn-btn--danger nn-bearer__attack"
                >
                  ATTACK BEARER
                </button>
              )}
              {/* Show status message if player IS the bearer */}
              {isCurrentPlayerBearer && (
                <div className="nn-bearer__held">
                  YOU HOLD THE FLAG
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
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, color-mix(in oklab, var(--nn-amber) 20%, transparent) 0%, transparent 70%)' }}></div>
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
                    className="absolute w-1.5 h-1.5 rounded-full animate-float nn-bearer__ember"
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
              <div className="nn-viewport__range" style={{ opacity: trailOpacity }}>
                {Math.round(distanceToFlagBearer)} TILES AWAY
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
                className="absolute inset-0 nn-trail__edge animate-pulse"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 30)}%, transparent)`,
                  boxShadow: `
                    inset 0 0 60px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 100)}%, transparent),
                    inset 0 0 100px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 80)}%, transparent),
                    0 0 80px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 100)}%, transparent)
                  `
                }}
              ></div>
            </div>

            {/* LAYER 2: INTENSE Background Glow - COVERS ENTIRE TILE */}
            <div 
              className="absolute inset-0 z-24 pointer-events-none"
              style={{ opacity: trailOpacity }}
            >
              <div className="absolute inset-0 nn-trail__glow animate-pulse"></div>
            </div>
            
            {/* LAYER 3: GIGANTIC Animated Particles - FILL THE TILE */}
            <div className="absolute inset-0 z-26 pointer-events-none overflow-hidden">
              {[...Array(Math.ceil(120 * trailOpacity))].map((_, i) => (
                <div
                  key={`trail-${i}`}
                  className="absolute rounded-full animate-float nn-trail__ember"
                  style={{
                    width: `${4 + (i % 5) * 2}px`,
                    height: `${4 + (i % 5) * 2}px`,
                    left: `${(i * 3 + 2) % 98}%`,
                    bottom: `${(i * 5) % 95}%`,
                    animationDelay: `${i * 0.03}s`,
                    animationDuration: `${1.5 + (i % 4) * 0.3}s`,
                    opacity: trailOpacity,
                    backgroundColor: i % 3 === 0 ? 'var(--nn-amber)' : i % 3 === 1 ? 'var(--nn-amber)' : 'var(--nn-green)',
                    boxShadow: `
                      0 0 ${12 * trailOpacity}px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 100)}%, transparent),
                      0 0 ${24 * trailOpacity}px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 80)}%, transparent)
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
                  className="absolute w-16 h-16 rounded-full nn-trail__ring"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: `expand-fade ${1.2 + i * 0.15}s ease-out infinite`,
                    animationDelay: `${i * 0.1}s`,
                    opacity: trailOpacity,
                    boxShadow: `0 0 30px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 100)}%, transparent)`
                  }}
                ></div>
              ))}
            </div>

            {/* LAYER 5: GIGANTIC Corner Sparkles */}
            <div className="nn-trail__spark nn-trail__spark--tl" style={{ opacity: trailOpacity }}></div>
            <div className="nn-trail__spark nn-trail__spark--tr" style={{ opacity: trailOpacity, animationDelay: '0.2s' }}></div>
            <div className="nn-trail__spark nn-trail__spark--bl" style={{ opacity: trailOpacity, animationDelay: '0.4s' }}></div>
            <div className="nn-trail__spark nn-trail__spark--br" style={{ opacity: trailOpacity, animationDelay: '0.6s' }}></div>
            
            {/* LAYER 6: GIGANTIC Trail Age Badge */}
            <div 
              className="nn-trail__age"
              style={{ 
                opacity: trailOpacity,
                boxShadow: `
                  0 0 40px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 100)}%, transparent),
                  0 0 60px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 70)}%, transparent)
                `
              }}
            >
              <span className="nn-trail__age-label">TRAIL</span>
              <span className="nn-trail__age-num">{Math.ceil((1 - trailAge) * 8)}<small>min</small></span>
            </div>

            {/* LAYER 7: GIGANTIC "FLAG TRAIL" Text Overlay */}
            <div 
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-28 pointer-events-none"
              style={{ opacity: trailOpacity }}
            >
              <div 
                className="nn-trail__mark animate-pulse"
                style={{
                  textShadow: `
                    0 0 20px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 100)}%, transparent),
                    0 0 40px color-mix(in oklab, var(--nn-amber) ${Math.round(trailOpacity * 80)}%, transparent),
                    4px 4px 8px rgba(0, 0, 0, 1)
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
              <div className="absolute inset-0 animate-pulse" style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--nn-magenta) 40%, transparent), transparent 70%)' }}></div>
              <div className="absolute inset-0 nn-attack__edge animate-pulse"></div>
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
                    className="absolute w-1 h-6 rounded-full opacity-80 nn-attack__spark"
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
                    className="absolute w-3 h-3 rounded-full opacity-70 nn-attack__impact"
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
                  className="absolute w-20 h-20 bg-[color:var(--nn-void)] rounded-full blur-xl"
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
                <div className="nn-attack__dmg animate-pulse">-{attackResult.damageDealt}</div>
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

      {/* NEON NOIR action deck — §5.1 result/info surface under the viewport.
          Layout: scanline header (title + meta) → body of wells and gains. */}
      <div className="nn-deck animate-fade-in">
        <div className="nn-deck__head">
          <h3 className="nn-deck__title">{isAnyBase ? `Base — ${isPlayerBase ? 'Yours' : tile.baseOwner ?? 'Player'}` : tile.terrain}</h3>
          <span className="nn-deck__meta">SEC {String(tile.x).padStart(3, '0')} · {String(tile.y).padStart(3, '0')} · {tile.terrain.toUpperCase()}</span>
        </div>
        <div className="nn-deck__body">
          <p className="nn-deck__desc">{getTerrainDescription(tile.terrain, tile.x, tile.y, isAnyBase, tile.bankType)}</p>
          
          {/* Base Greeting Display */}
          {isAnyBase && tile.baseGreeting && (
            <div className="nn-well" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <p className="nn-lab">Base message</p>
              <SafeHtmlRenderer 
                html={tile.baseGreeting}
                fallback="Welcome to my base!"
                className="text-sm text-[color:var(--nn-text-primary)]"
              />
            </div>
          )}
        </div>
        
        {/* Tile Interaction Buttons */}
        <div className="nn-actions2" style={{ flexWrap: 'wrap' }}>
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
              className="flex-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] font-semibold px-4 py-2 rounded-none transition-colors"
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

        <div className="nn-deck__body" style={{ paddingTop: 0 }}>
          {/* Bank/Shrine Controls Hint */}
          {tile.terrain === TerrainType.Bank && (
            <p className="nn-deck__foot">
              Press <kbd className="nn-kbd">B</kbd> to open Bank interface
            </p>
          )}
          {tile.terrain === TerrainType.Shrine && (
            <p className="nn-deck__foot">
              Press <kbd className="nn-kbd">S</kbd> to open Shrine interface
            </p>
          )}
        </div>
      </div>

      {/* Factory Info (if factory tile) — §5.1 magenta module */}
      {tile.terrain === TerrainType.Factory && factoryData && (
        <div className="nn-deck animate-fade-in">
          <div className="nn-deck__head">
            <h4 className="nn-deck__title nn-deck__title--magenta">Factory Status</h4>
            {factoryData.owner && (
              <span className="nn-deck__meta" style={{ color: factoryData.owner === player?.username ? 'var(--nn-green)' : 'var(--nn-amber)' }}>
                {factoryData.owner === player?.username ? 'YOURS' : `OWNER ▸ ${factoryData.owner.toUpperCase()}`}
              </span>
            )}
          </div>
          
          <div className="nn-grid2x2">
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

      {/* Harvest Result Display (below tile image) — §5.1 deck */}
      {harvestResult && (
        <div className="nn-deck mt-4 animate-fade-in">
          <div className="nn-deck__head">
            <h4 className={`nn-deck__title ${harvestResult.success ? 'nn-deck__title--green' : 'nn-deck__title--magenta'}`}>
              {harvestResult.success ? 'HARVEST COMPLETE' : 'HARVEST FAILED'}
            </h4>
            <span className="nn-deck__meta">+{((harvestResult.metalGained ?? 0) + (harvestResult.energyGained ?? 0)).toLocaleString()} RES</span>
          </div>

          {/* Resource Results */}
          {harvestResult.success && (harvestResult.metalGained || harvestResult.energyGained) && (
            <div className="nn-deck__body">
              <div className="nn-grid2x2">
                {!!harvestResult.metalGained && harvestResult.metalGained > 0 && (
                  <div className="nn-well p-2" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <span className="nn-lab">Metal</span>
                    <div className="nn-num text-[color:var(--nn-amber)]">+{harvestResult.metalGained.toLocaleString()}</div>
                  </div>
                )}
                {!!harvestResult.energyGained && harvestResult.energyGained > 0 && (
                  <div className="nn-well p-2" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <span className="nn-lab">Energy</span>
                    <div className="nn-num text-[color:var(--nn-cyan)]">+{harvestResult.energyGained.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cave Item Result */}
          {harvestResult.success && harvestResult.item && (
            <div className="nn-deck__body">
              <div className="nn-well" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 4, borderColor: 'color-mix(in oklab, var(--nn-violet) 40%, transparent)' }}>
                <span className="nn-lab">Item recovered</span>
                <div className="text-sm font-bold text-[color:var(--nn-violet)]">{harvestResult.item.name}</div>
                {harvestResult.item.description && (
                  <div className="text-xs text-[color:var(--nn-text-secondary)]">{harvestResult.item.description}</div>
                )}
              </div>
            </div>
          )}

          <div className="nn-deck__body" style={{ paddingTop: harvestResult.bonusApplied && harvestResult.bonusApplied > 0 ? undefined : 0 }}>
            {/* Bonus Applied */}
            {harvestResult.bonusApplied && harvestResult.bonusApplied > 0 && (
              <p className="nn-deck__foot" style={{ color: 'var(--nn-green)' }}>
                +{harvestResult.bonusApplied.toFixed(2)}% BONUS APPLIED
              </p>
            )}
            {/* Result Message (single instance) */}
            {harvestResult.message && (
              <p className="nn-deck__msg" style={{ textAlign: 'left' }}>{harvestResult.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Attack Result Display (below tile image) — §5.1 magenta deck */}
      {attackResult && (
        <div className="nn-deck mt-4 animate-fade-in">
          <div className="nn-deck__head">
            <h4 className={`nn-deck__title ${attackResult.captured ? 'nn-deck__title--green' : attackResult.success ? '' : 'nn-deck__title--magenta'}`}>
              {attackResult.captured ? 'FACTORY CAPTURED' : attackResult.success ? 'ATTACK LANDED' : 'ATTACK FAILED'}
            </h4>
            <span className="nn-deck__meta">DMG ▸ {attackResult.damageDealt ?? 0}</span>
          </div>

          {/* Power Comparison */}
          <div className="nn-deck__body">
            <div className="nn-grid2x2">
              <div className="nn-well p-2" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span className="nn-lab">Your power</span>
                <div className="nn-num text-[color:var(--nn-cyan)]">{attackResult.playerPower.toLocaleString()}</div>
              </div>
              <div className="nn-well p-2" style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span className="nn-lab">Factory defense</span>
                <div className="nn-num text-[color:var(--nn-magenta)]">{attackResult.factoryDefense.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="nn-deck__body" style={{ paddingTop: 0 }}>
            {attackResult.captured && (
              <p className="nn-deck__foot" style={{ color: 'var(--nn-green)' }}>
                FACTORY NOW UNDER YOUR CONTROL
              </p>
            )}
            {attackResult.damageDealt && attackResult.damageDealt > 0 && !attackResult.captured && (
              <p className="nn-deck__foot" style={{ color: 'var(--nn-amber)' }}>
                {attackResult.damageDealt} DAMAGE DEALT
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
