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

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { SanitizedPlayer, Tile, MovementDirection } from '@/types';
import { logger } from '@/lib/logger';
import { toast } from '@/lib/toast';

/**
 * Game context state interface
 */
export interface GameContextState {
  /** The client NEVER holds private fields (password/email/etc.) — the context
   *  carries the honest sanitized shape served by the APIs. */
  player: SanitizedPlayer | null;
  currentTile: Tile | null;
  isLoading: boolean;
  error: string | null;
  /** Direct set (replaces). Accepts an updater for delta merges — used by the
   *  move handler since FID-20260911-043: move returns a SLIM player whose
   *  absent blob fields must not wipe client state. */
  setPlayer: (player: SanitizedPlayer | null | ((prev: SanitizedPlayer | null) => SanitizedPlayer | null)) => void;
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
  const [player, setPlayer] = useState<SanitizedPlayer | null>(null);
  const [currentTile, setCurrentTile] = useState<Tile | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true to check auth
  const [error, setError] = useState<string | null>(null);
  
  // Prevent duplicate API calls
  const loadingRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  // FID-20260909-024 §: stable-identity optimization — handlers read the live
  // player through this ref so their useCallback identities never change when
  // player state changes, keeping the provider's memoized value stable.
  const playerRef = useRef<SanitizedPlayer | null>(null);
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

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

  // Stable loader identities (FID-20260909-024): both loaders are useCallback
  // consts (loadTileData first — loadPlayerData depends on it), so every
  // handler below keeps one identity for the provider's whole lifetime.
  const loadTileData = useCallback(async function loadTileData(x: number, y: number) {
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
  }, []);

  /**
   * Load player data from API
   */
  const loadPlayerData = useCallback(async function loadPlayerData(username: string) {
    logger.debug('loadPlayerData called', { username });
    // Prevent duplicate simultaneous calls
    if (loadingRef.current) {
      logger.debug('Player data load already in progress, skipping');
      return;
    }
    
    // Throttle: Don't fetch more than once every 2 seconds
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) {
      logger.debug('Player data fetched recently, skipping', { elapsedMs: now - lastFetchRef.current });
      return;
    }
    
    loadingRef.current = true;
    lastFetchRef.current = now;
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Fetching player data', { username });
      const response = await fetch(`/api/player?username=${encodeURIComponent(username)}`);
      logger.debug('Player API responded', { status: response.status });
      const data = await response.json();

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

      logger.debug('Setting player state');
      setPlayer(data.data);

      // Load current tile
      if (data.data.currentPosition) {
        logger.debug('Loading tile at position', data.data.currentPosition);
        await loadTileData(data.data.currentPosition.x, data.data.currentPosition.y);
      }
      logger.debug('loadPlayerData complete');
    } catch (err) {
      console.error('[loadPlayerData] ❌ Error:', err);
      logger.error('Error loading player data', err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : 'Failed to load player');
      setPlayer(null);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [loadTileData]);

  /**
   * Check session with server (works with HttpOnly cookies)
   * Server-side endpoint can read HttpOnly cookies that JavaScript cannot access
   */
  useEffect(() => {
    async function checkSession() {
      try {
        logger.debug('Checking session');
        const response = await fetch('/api/auth/session');
        const data = await response.json();
        
        logger.debug('Session response received', { success: data.success, hasUsername: !!data.username });
        
        if (data.success && data.username) {
          // Valid session found - load player data
          logger.info('Valid session found', { username: data.username });
          await loadPlayerData(data.username);
          logger.debug('loadPlayerData completed');
          // FID-20260911-044: daily login reward now flows from the session
          // endpoint (the dead dailyLoginService source is wired server-side).
          const reward = (data as { dailyReward?: { claimed: boolean; amount?: number; streak?: number } }).dailyReward;
          if (reward?.claimed) {
            toast.success(`🎁 Daily login reward: +${reward.amount ?? 0} RP (${reward.streak ?? 1}-day streak)`);
          }
        } else {
          // No valid session - user needs to login
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
  }, [loadPlayerData]);

  /**
   * Move player in specified direction
   */
  // Stable handler identities (FID-20260909-024): live player read via ref.
  const movePlayer = useCallback(async function movePlayer(direction: MovementDirection) {
    if (!playerRef.current) {
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
          username: playerRef.current.username,
          direction,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(extractApiErrorMessage(data, 'Failed to move'));
      }

      // FID-20260911-043: the move endpoint now returns a SLIM player (blob
      // fields absent — the 30 KB units blob was shipping every tile under
      // AutoFarm). Delta-merge over the existing player so client state keeps
      // its units/inventory/achievements; only the slim scalars refresh.
      setPlayer((prev) => (prev ? { ...prev, ...data.data.player } : data.data.player));
      setCurrentTile(data.data.currentTile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to move';
      logger.error('Error moving player', err instanceof Error ? err : new Error(String(err)));
      setError(msg);
      // FID-20260911-041: the context `error` state is consumed by no route —
      // without this toast every move rejection (rate limits, locked tiles,
      // combat zones) vanished silently.
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh current game state
   */
  const refreshGameState = useCallback(async function refreshGameState() {
    if (playerRef.current) {
      await loadPlayerData(playerRef.current.username);
    }
  }, [loadPlayerData]);

  /**
   * Refresh only player data (lightweight)
   */
  const refreshPlayer = useCallback(async function refreshPlayer() {
    if (!playerRef.current) return;
    
    try {
      await loadPlayerData(playerRef.current.username);
    } catch (error) {
      logger.error('Failed to refresh player', error instanceof Error ? error : new Error(String(error)));
    }
  }, [loadPlayerData]);

  /**
   * Update only the current tile without refreshing player data
   * Useful for auto-farm to update tile visuals without destroying timers
   */
  const updateTileOnly = useCallback(async function updateTileOnly(x: number, y: number) {
    try {
      const response = await fetch(`/api/tile?x=${x}&y=${y}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setCurrentTile(data.data);
      }
    } catch (error) {
      logger.error('Failed to update tile', error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  /**
   * Logout and clear session
   */
  const logout = useCallback(function logout() {
    setPlayer(null);
    setCurrentTile(null);
    setError(null);
    localStorage.removeItem('darkframe_username');
  }, []);

  // FID-20260909-024: stable-identity provider value — re-created only when the
  // actual data (player/tile/loading/error) changes, not on every unrelated
  // render of the provider. Handler identities are stable via useCallback +
  // playerRef, so consumers re-render only on real state transitions.
  const value: GameContextState = useMemo(() => ({
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
  }), [player, currentTile, isLoading, error, updateTileOnly, movePlayer, refreshGameState, refreshPlayer, logout]);

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
