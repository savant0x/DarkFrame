/**
 * @file context/GameContext.tsx
 * @created 2025-10-16
 * @overview Global game state management using React Context
 * 
 * OVERVIEW:
 * Provides centralized state management for player data, current tile,
 * and game session. Makes data available to all components without prop drilling.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Player, Tile, MovementDirection } from '@/types';
import { logger } from '@/lib/logger';

/**
 * Game context state interface
 */
interface GameContextState {
  player: Player | null;
  currentTile: Tile | null;
  isLoading: boolean;
  error: string | null;
  setPlayer: (player: Player | null) => void;
  setCurrentTile: (tile: Tile | null) => void;
  updateTileOnly: (x: number, y: number) => Promise<void>;
  movePlayer: (direction: MovementDirection) => Promise<void>;
  refreshGameState: () => Promise<void>;
  refreshPlayer: () => Promise<void>;
  logout: () => void;
}

/**
 * Create game context with default values
 */
const GameContext = createContext<GameContextState | undefined>(undefined);

/**
 * Game context provider props
 */
interface GameProviderProps {
  children: ReactNode;
}

/**
 * Game Context Provider Component
 * 
 * Wraps the application and provides game state to all children
 * 
 * @example
 * ```tsx
 * <GameProvider>
 *   <App />
 * </GameProvider>
 * ```
 */
export function GameProvider({ children }: GameProviderProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [currentTile, setCurrentTile] = useState<Tile | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true to check auth
  const [error, setError] = useState<string | null>(null);
  
  // Prevent duplicate API calls
  const loadingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);

  /**
   * Check session with server (Supabase Auth)
   * Uses /api/auth/session which validates the Supabase session cookie
   */
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/session');
        const session = await response.json();
        
        if (session.success && session.username) {
          await loadPlayerData(session.username);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        logger.error('Session check failed', error instanceof Error ? error : new Error(String(error)));
        setIsLoading(false);
      }
    }
    
    checkSession();
  }, []);

  /**
   * Save username to localStorage when player changes (for backward compatibility)
   */
  useEffect(() => {
    if (player) {
      localStorage.setItem('darkframe_username', player.username);
    } else {
      localStorage.removeItem('darkframe_username');
    }
  }, [player]);

  /**
   * Load player data from API
   */
  async function loadPlayerData(username: string) {
    console.log('[loadPlayerData] 🚀 Called for username:', username);
    // Prevent duplicate simultaneous calls
    if (loadingRef.current) {
      console.log('[loadPlayerData] ⏸️ Already loading, skipping');
      logger.debug('Player data load already in progress, skipping');
      return;
    }
    
    // Throttle: Don't fetch more than once every 2 seconds
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) {
      console.log('[loadPlayerData] ⏱️ Throttled, skipping (last fetch:', (now - lastFetchRef.current), 'ms ago)');
      logger.debug('Player data fetched recently, skipping');
      return;
    }
    
    loadingRef.current = true;
    lastFetchRef.current = now;
    setIsLoading(true);
    setError(null);

    try {
      console.log('[loadPlayerData] 📡 Fetching /api/player?username=' + username);
      const response = await fetch(`/api/player?username=${encodeURIComponent(username)}`);
      console.log('[loadPlayerData] ✅ Player API responded:', response.status);
      const result = await response.json();
      console.log('[loadPlayerData] 📦 Player data:', result);

      if (!result.success) {
        const apiError = result.error;
        const errorMessage = typeof apiError === 'string'
          ? apiError
          : apiError && (apiError.message || apiError.code)
            ? `${apiError.code ? apiError.code + ': ' : ''}${apiError.message || JSON.stringify(apiError)}`
            : 'Failed to load player data';

        throw new Error(errorMessage);
      }

      console.log('[loadPlayerData] ✅ Setting player state');
      setPlayer(result.data);

      // Load current tile
      if (result.data.currentPosition) {
        console.log('[loadPlayerData] 📍 Loading tile at position:', result.data.currentPosition);
        await loadTileData(result.data.currentPosition.x, result.data.currentPosition.y);
        console.log('[loadPlayerData] ✅ Tile data loaded');
      }
      console.log('[loadPlayerData] ✅ loadPlayerData complete');
    } catch (err) {
      console.error('[loadPlayerData] ❌ Error:', err);
      logger.error('Error loading player data', err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : 'Failed to load player');
      setPlayer(null);
    } finally {
      console.log('[loadPlayerData] 🏁 Setting isLoading = false');
      setIsLoading(false);
      loadingRef.current = false;
    }
  }

  /**
   * Load tile data from API
   */
  async function loadTileData(x: number, y: number) {
    try {
      const response = await fetch(`/api/tile?x=${x}&y=${y}`);
      const tileResult = await response.json();

      if (!tileResult.success) {
        throw new Error(tileResult.error || 'Failed to load tile data');
      }

      setCurrentTile(tileResult.data);
    } catch (err) {
      logger.error('Error loading tile data', err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : 'Failed to load tile');
    }
  }

  /**
   * Move player in specified direction
   */
  async function movePlayer(direction: MovementDirection) {
    if (!player) {
      setError('No player logged in');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: player.username,
          direction,
        }),
      });

      const moveResult = await response.json();

      if (moveResult.success) {
        // Move response doesn't include inventory — preserve existing inventory
        // to avoid wiping items from client-side state
        setPlayer((prev) => ({
          ...moveResult.data.player,
          inventory: prev?.inventory || moveResult.data.player.inventory,
        }));
        setCurrentTile(moveResult.data.currentTile);
      } else {
        throw new Error(moveResult.error || 'Failed to move');
      }

      // Track tutorial movement (fire-and-forget — non-blocking)
      fetch('/api/tutorial/track-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: player.username, action: 'move', data: { direction } }),
      }).catch(() => {});
    } catch (err) {
      logger.error('Error moving player', err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : 'Failed to move');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Refresh current game state
   */
  async function refreshGameState() {
    if (player) {
      await loadPlayerData(player.username);
    }
  }

  /**
   * Refresh only player data (lightweight)
   */
  async function refreshPlayer() {
    if (!player) return;
    
    try {
      await loadPlayerData(player.username);
    } catch (error) {
      logger.error('Failed to refresh player', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update only the current tile without refreshing player data
   * Useful for auto-farm to update tile visuals without destroying timers
   */
  async function updateTileOnly(x: number, y: number) {
    try {
      const response = await fetch(`/api/tile?x=${x}&y=${y}`);
      const refreshResult = await response.json();

      if (refreshResult.success && refreshResult.data) {
        setCurrentTile(refreshResult.data);
      }
    } catch (error) {
      logger.error('Failed to update tile', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Logout and clear session
   */
  function logout() {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setPlayer(null);
    setCurrentTile(null);
    setError(null);
    localStorage.removeItem('darkframe_username');
  }

  const value: GameContextState = {
    player,
    currentTile,
    isLoading,
    error,
    setPlayer,
    setCurrentTile,
    updateTileOnly,
    movePlayer,
    refreshGameState,
    refreshPlayer,
    logout,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

/**
 * Hook to use game context
 * 
 * @returns Game context state
 * @throws Error if used outside GameProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { player, currentTile, movePlayer } = useGameContext();
 *   // Use context values
 * }
 * ```
 */
export function useGameContext() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}

// ============================================================
// END OF FILE
// ============================================================
