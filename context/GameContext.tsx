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
/**
 * Extract a human-readable message from an API error payload.
 * Structured responses carry `error: { code, message, details }`; older paths
 * may carry a plain string. Prevents `[object Object]` leaking to the UI.
 */
function extractApiErrorMessage(data: unknown, fallback: string): string {
  const err = (data as { error?: unknown } | null)?.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { code?: string; message?: string };
    const msg = [e.code, e.message].filter(Boolean).join(': ');
    if (msg) return msg;
  }
  return fallback;
}

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
   * Check session with server (works with HttpOnly cookies)
   * Server-side endpoint can read HttpOnly cookies that JavaScript cannot access
   */
  useEffect(() => {
    async function checkSession() {
      try {
        console.log('[GameContext] 🔍 Starting session check...');
        logger.debug('Checking session');
        const response = await fetch('/api/auth/session');
        console.log('[GameContext] ✅ Session response received:', response.status);
        const data = await response.json();
        console.log('[GameContext] 📦 Session data:', data);
        
        logger.debug('Session response received', { success: data.success, hasUsername: !!data.username });
        
        if (data.success && data.username) {
          // Valid session found - load player data
          console.log('[GameContext] ✅ Valid session, loading player data for:', data.username);
          logger.info('Valid session found', { username: data.username });
          await loadPlayerData(data.username);
          console.log('[GameContext] ✅ loadPlayerData completed');
        } else {
          // No valid session - user needs to login
          console.log('[GameContext] ⚠️ No valid session, stopping');
          logger.debug('No valid session, user needs to login');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[GameContext] ❌ Session check failed:', error);
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
      const data = await response.json();
      console.log('[loadPlayerData] 📦 Player data:', data);

      if (!data.success) {
        // API returns a structured error object: { code, message, details }
        // Avoid throwing the object directly which results in `[object Object]`.
        const apiError = data.error;
        const errorMessage = typeof apiError === 'string'
          ? apiError
          : apiError && (apiError.message || apiError.code)
            ? `${apiError.code ? apiError.code + ': ' : ''}${apiError.message || JSON.stringify(apiError)}`
            : 'Failed to load player data';

        throw new Error(errorMessage);
      }

      console.log('[loadPlayerData] ✅ Setting player state');
      setPlayer(data.data);

      // Load current tile
      if (data.data.currentPosition) {
        console.log('[loadPlayerData] 📍 Loading tile at position:', data.data.currentPosition);
        await loadTileData(data.data.currentPosition.x, data.data.currentPosition.y);
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
    // Retry with backoff: under load (or during a transient blip) the first fetch
    // can fail — previously a single failure left `currentTile` null forever and
    // the game view stuck on "Loading tile..." with no self-heal.
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(`/api/tile?x=${x}&y=${y}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(extractApiErrorMessage(data, 'Failed to load tile data'));
        }

        setCurrentTile(data.data);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load tile';
        if (attempt < MAX_ATTEMPTS) {
          const delayMs = 1000 * attempt;
          logger.warn(`Tile load attempt ${attempt} failed, retrying in ${delayMs}ms`, { x, y, error: msg });
          await new Promise((r) => setTimeout(r, delayMs));
        } else {
          logger.error('Error loading tile data (all retries exhausted)', err instanceof Error ? err : new Error(msg));
          setError(msg);
        }
      }
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

      const data = await response.json();

      if (!data.success) {
        throw new Error(extractApiErrorMessage(data, 'Failed to move'));
      }

      setPlayer(data.data.player);
      setCurrentTile(data.data.currentTile);
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
      const data = await response.json();
      
      if (data.success && data.data) {
        setCurrentTile(data.data);
      }
    } catch (error) {
      logger.error('Failed to update tile', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Logout and clear session
   */
  function logout() {
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
