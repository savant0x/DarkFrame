/**
 * autoFarmEngine.ts
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Core auto-farm engine that orchestrates automated map traversal in a snake pattern.
 * Handles movement, harvesting, combat, and statistics tracking for the premium
 * monetization feature.
 * 
 * Snake Pattern:
 * - Row 1: (1,1) → (150,1) [left to right]
 * - Row 2: (150,2) → (1,2) [right to left]
 * - Row 3: (1,3) → (150,3) [left to right]
 * - Continues alternating until entire 150x150 map is covered
 * 
 * Features:
 * - Automatic movement with ~800ms-1s delays (human-like speed)
 * - Auto-harvest all resource types (metal, energy, caves, forests)
 * - Optional combat with configurable rank filters
 * - Pause/Resume/Stop controls
 * - Real-time statistics tracking
 * - Error handling and tile skipping
 */

import { GAME_CONSTANTS } from '@/types/game.types';
import type { Tile, SanitizedPlayer } from '@/types/game.types';
import {
  AutoFarmConfig,
  AutoFarmState,
  AutoFarmStatus,
  AutoFarmSessionStats,
  AutoFarmEvent,
  TileProcessResult,
  HarvestAttemptResult,
  CombatAttemptResult,
  CombatUnit,
  DEFAULT_SESSION_STATS,
  RankFilter,
  ResourceTarget
} from '@/types/autoFarm.types';

/**
 * Callback function types for engine events
 */
type EventCallback = (event: AutoFarmEvent) => void;
type StatsCallback = (stats: AutoFarmSessionStats) => void;
type StateCallback = (state: AutoFarmState) => void;
/** Optional resource deltas from a verified server action (FID-20260911-047:
 *  the UI applies server-reported gains locally instead of refetching /api/player). */
type RefreshCallback = (deltas?: { metal?: number; energy?: number }) => Promise<void>;

/**
 * FID-20260912-063: extract the post-move position from a /api/move envelope.
 * Exported pure (unit-testable). The canonical shape is
 * `data.data.player.currentPosition`; every fallback validates finite numbers
 * so truthy-but-empty objects (serialization drift, the live `{}` incident)
 * fall through instead of short-circuiting.
 */
export function extractMovePosition(payload: unknown): { x: number; y: number } | null {
  if (!payload || typeof payload !== 'object') return null;
  const d = payload as Record<string, unknown>;
  const candidates: unknown[] = [
    (d.data as Record<string, unknown> | undefined)?.player &&
      ((d.data as Record<string, unknown>).player as Record<string, unknown>).currentPosition,
    d.player && (d.player as Record<string, unknown>).currentPosition,
    d.data && (d.data as Record<string, unknown>).newPosition,
    d.newPosition,
  ];
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const p = c as { x?: unknown; y?: unknown };
    if (
      typeof p.x === 'number' && Number.isFinite(p.x) &&
      typeof p.y === 'number' && Number.isFinite(p.y)
    ) {
      return { x: p.x, y: p.y };
    }
  }
  const dataObj = d.data as { player?: { currentPositionX?: unknown; currentPositionY?: unknown } } | undefined;
  const fx = dataObj?.player?.currentPositionX;
  const fy = dataObj?.player?.currentPositionY;
  if (typeof fx === 'number' && Number.isFinite(fx) && typeof fy === 'number' && Number.isFinite(fy)) {
    return { x: fx, y: fy };
  }
  return null;
}

/**
 * Auto-Farm Engine
 * 
 * Manages automated map traversal, resource collection, and combat.
 * Operates client-side with API integration for actions.
 */
export class AutoFarmEngine {
  private config: AutoFarmConfig;
  private state: AutoFarmState;
  private stats: AutoFarmSessionStats;
  
  private timerId: NodeJS.Timeout | null = null;
  private statsTimerId: NodeJS.Timeout | null = null;
  
  // Callbacks for event handling
  private onEventCallback: EventCallback | null = null;
  private onStatsCallback: StatsCallback | null = null;
  private onStateCallback: StateCallback | null = null;
  private onRefreshCallback: RefreshCallback | null = null;
  
  // Constants
  private readonly MAP_WIDTH = GAME_CONSTANTS.MAP_WIDTH;
  private readonly MAP_HEIGHT = GAME_CONSTANTS.MAP_HEIGHT;
  private readonly STATS_UPDATE_INTERVAL = 1000; // Update stats every second
  
  // VIP-Tiered Timing (calculated in constructor based on config.isVIP)
  private readonly MOVEMENT_DELAY: number; // Delay between tiles
  private readonly MOVEMENT_WAIT: number; // Wait for movement to process
  private readonly HARVEST_WAIT: number; // Wait for harvest to process
  private readonly HARVEST_DELAY_EXTRA: number; // Extra delay after harvest (for cooldown)

  constructor(config: AutoFarmConfig, startPosition: { x: number; y: number }) {
    this.config = config;
    this.stats = { ...DEFAULT_SESSION_STATS };
    
    // Set timing based on VIP status
    if (config.isVIP) {
      // VIP TIER: Fast speed (~5.6 hours to complete map)
      // Movement: 200ms | Harvest: 800ms | Delay: 300ms
      // Non-harvestable: 500ms | Harvestable: 1300ms | Avg: 900ms/tile
      this.MOVEMENT_WAIT = 200;
      this.HARVEST_WAIT = 800;
      this.MOVEMENT_DELAY = 300;
      this.HARVEST_DELAY_EXTRA = 0; // No extra delay (server handles cooldown)
      console.log('[AutoFarm] VIP mode enabled - Fast speed (5.6 hour completion)');
    } else {
      // BASIC TIER: Guaranteed cooldown respect (~11.6 hours to complete map)
      // Movement: 200ms | Harvest: 800ms | Delay: 500ms (non-harvest) / 2000ms (harvest)
      // Non-harvestable: 700ms | Harvestable: 3000ms
      this.MOVEMENT_WAIT = 200;
      this.HARVEST_WAIT = 800;
      this.MOVEMENT_DELAY = 500;
      this.HARVEST_DELAY_EXTRA = 2000; // 2s extra after harvest (3s total = cooldown respected)
      console.log('[AutoFarm] Basic mode - Guaranteed cooldown (11.6 hour completion)');
    }
    
    this.state = {
      status: AutoFarmStatus.STOPPED,
      currentPosition: { ...startPosition },
      startPosition: { ...startPosition },
      currentRow: startPosition.y,
      direction: 'forward',
      tilesCompleted: 0,
      startTime: null,
      pausedTime: null,
      lastHarvestTime: null // Server handles cooldown checking
    };
  }

  /**
   * Register event callback
   */
  onEvent(callback: EventCallback): void {
    this.onEventCallback = callback;
  }

  /**
   * Register stats update callback
   */
  onStats(callback: StatsCallback): void {
    this.onStatsCallback = callback;
  }

  /**
   * Register state update callback
   */
  onState(callback: StateCallback): void {
    this.onStateCallback = callback;
  }

  /**
   * Register refresh callback (for updating UI after harvests)
   */
  onRefresh(callback: RefreshCallback): void {
    this.onRefreshCallback = callback;
  }

  /**
   * Emit an event to registered callback
   */
  private emitEvent(event: AutoFarmEvent): void {
    if (this.onEventCallback) {
      this.onEventCallback(event);
    }
  }

  /**
   * Update statistics and notify callback
   */
  private updateStats(updates: Partial<AutoFarmSessionStats>): void {
    this.stats = { ...this.stats, ...updates };
    
    // Calculate elapsed time if running
    if (this.state.startTime && this.state.status === AutoFarmStatus.ACTIVE) {
      this.stats.timeElapsed = Date.now() - this.state.startTime;
    }
    
    if (this.onStatsCallback) {
      this.onStatsCallback(this.stats);
    }
  }

  /**
   * Update state and notify callback
   */
  private updateState(updates: Partial<AutoFarmState>): void {
    this.state = { ...this.state, ...updates };
    
    if (this.onStateCallback) {
      this.onStateCallback(this.state);
    }
  }

  // ---------------------------------------------------------------
  // FID-20260912-078: server-backed run persistence.
  //
  // The run record (status/position/row/direction/tiles/startTime) lives on
  // the player's row, written through /api/autofarm/run with session auth.
  // localStorage is never consulted for RUN state — config and all-time
  // stats stay local, but the position that must never fight the server now
  // IS server data. The page auto-resumes an interrupted run from this record.

  private runSaveTimer: NodeJS.Timeout | null = null;

  /** Fire-and-forget write of the current run to the server. */
  private persistRun(): void {
    if (this.state.status === AutoFarmStatus.STOPPED) return;
    void fetch('/api/autofarm/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run: {
          status: this.state.status === AutoFarmStatus.ACTIVE ? 'ACTIVE' : 'PAUSED',
          position: this.state.currentPosition,
          currentRow: this.state.currentRow,
          direction: this.state.direction,
          tilesCompleted: this.state.tilesCompleted,
          startTime: this.state.startTime ?? Date.now(),
        },
      }),
    }).catch(() => undefined); // best-effort — move verification reconciles anyway
  }

  /** Throttled persistence: at most one POST per completed tile batch (2s). */
  private schedulePersist(): void {
    if (this.runSaveTimer) return;
    this.runSaveTimer = setTimeout(() => {
      this.runSaveTimer = null;
      this.persistRun();
    }, 2000);
  }

  /** Clear the persisted run (stop/complete). Fire-and-forget. */
  private clearPersistedRun(): void {
    if (this.runSaveTimer) {
      clearTimeout(this.runSaveTimer);
      this.runSaveTimer = null;
    }
    void fetch('/api/autofarm/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run: null }),
    }).catch(() => undefined);
  }

  /**
   * Adopt a server-persisted run record (page auto-resume). The caller has
   * already decided staleness; here we only reconcile state and continue the
   * sweep from the recorded position. Returns false if the phase is wrong.
   */
  adoptPersistedRun(
    run: {
      status: 'ACTIVE' | 'PAUSED';
      position: { x: number; y: number };
      currentRow: number;
      direction: 'forward' | 'backward';
      tilesCompleted: number;
      startTime: number;
    }
  ): boolean {
    if (this.state.status !== AutoFarmStatus.STOPPED) return false;
    this.state = {
      ...this.state,
      currentPosition: { ...run.position },
      startPosition: { ...run.position },
      currentRow: run.currentRow,
      direction: run.direction,
      tilesCompleted: run.tilesCompleted,
      startTime: run.startTime,
      status: run.status === 'ACTIVE' ? AutoFarmStatus.PAUSED : AutoFarmStatus.PAUSED,
    };
    this.updateState({}); // notify
    return true;
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoFarmConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (only when stopped)
   */
  updateConfig(newConfig: Partial<AutoFarmConfig>): boolean {
    if (this.state.status !== AutoFarmStatus.STOPPED) {
      return false;
    }
    
    this.config = { ...this.config, ...newConfig };
    return true;
  }

  /**
   * Get current state
   */
  getState(): AutoFarmState {
    return { ...this.state };
  }

  /**
   * Get current statistics
   */
  getStats(): AutoFarmSessionStats {
    // Update elapsed time before returning
    if (this.state.startTime && this.state.status === AutoFarmStatus.ACTIVE) {
      return {
        ...this.stats,
        timeElapsed: Date.now() - this.state.startTime
      };
    }
    return { ...this.stats };
  }

  /**
   * Fetch the authoritative position from /api/player and adopt it if the
   * engine's state diverges (FID-20260912-075). Used at start/resume so a
   * stale persisted engine position can never fight the server.
   */
  private async syncPositionFromServer(): Promise<void> {
    try {
      const username = localStorage.getItem('darkframe_username');
      if (!username) return;
      const res = await fetch(`/api/player?username=${encodeURIComponent(username)}`);
      const json = await res.json();
      const serverPos = extractMovePosition(json);
      if (serverPos) {
        const cur = this.state.currentPosition;
        if (serverPos.x !== cur.x || serverPos.y !== cur.y) {
          console.warn(
            `[AutoFarm] Syncing engine position (${cur.x}, ${cur.y}) -> server truth (${serverPos.x}, ${serverPos.y})`
          );
          this.updateState({ currentPosition: serverPos });
        }
      }
    } catch {
      // server unreachable — proceed with current state; move verification
      // will reconcile on the first tile.
    }
  }

  /**
   * Start auto-farming from current position
   */
  async start(): Promise<void> {
    if (this.state.status === AutoFarmStatus.ACTIVE) {
      return; // Already running
    }

    // FID-20260912-075: reconcile with the server before computing a single
    // tile — the engine may hold a stale persisted position after a refresh.
    await this.syncPositionFromServer();

    // Initialize start time
    this.state.startTime = Date.now();
    this.updateState({ 
      status: AutoFarmStatus.ACTIVE,
      pausedTime: null
    });

    // FID-078: record the run server-side immediately, then keep it fresh.
    this.persistRun();

    this.emitEvent({
      type: 'move',
      timestamp: Date.now(),
      position: this.state.currentPosition,
      message: 'Auto-farm started'
    });

    // Start stats update timer
    this.startStatsTimer();

    // Begin processing tiles
    await this.processNextTile();
  }

  /**
   * Pause auto-farming (can be resumed)
   */
  pause(): void {
    if (this.state.status !== AutoFarmStatus.ACTIVE) {
      return;
    }

    this.updateState({ 
      status: AutoFarmStatus.PAUSED,
      pausedTime: Date.now()
    });

    // Clear timers
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    this.stopStatsTimer();

    // FID-078: persist the PAUSED phase so a refresh can restore it.
    this.persistRun();

    this.emitEvent({
      type: 'move',
      timestamp: Date.now(),
      position: this.state.currentPosition,
      message: 'Auto-farm paused'
    });
  }

  /**
   * Resume auto-farming from paused state
   */
  async resume(): Promise<void> {
    if (this.state.status !== AutoFarmStatus.PAUSED) {
      return;
    }

    // FID-20260912-075: same reconciliation as start() — the player may have
    // moved manually while paused.
    await this.syncPositionFromServer();

    // Adjust start time to account for pause duration
    if (this.state.startTime && this.state.pausedTime) {
      const pauseDuration = Date.now() - this.state.pausedTime;
      this.state.startTime += pauseDuration;
    }

    this.updateState({ 
      status: AutoFarmStatus.ACTIVE,
      pausedTime: null
    });

    this.emitEvent({
      type: 'move',
      timestamp: Date.now(),
      position: this.state.currentPosition,
      message: 'Auto-farm resumed'
    });

    // Restart stats timer
    this.startStatsTimer();

    // Continue processing
    await this.processNextTile();
  }

  /**
   * Stop auto-farming and reset to initial state
   */
  stop(): void {
    // Clear all timers
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    
    this.stopStatsTimer();

    // FID-078: a stopped run no longer exists server-side.
    this.clearPersistedRun();

    const finalStats = this.getStats();

    // Reset state
    this.updateState({
      status: AutoFarmStatus.STOPPED,
      tilesCompleted: 0,
      startTime: null,
      pausedTime: null
    });

    this.emitEvent({
      type: 'complete',
      timestamp: Date.now(),
      position: this.state.currentPosition,
      message: 'Auto-farm stopped',
      data: { ...finalStats }
    });

    // Don't reset stats yet - caller should save them first
  }

  /**
   * Reset statistics (call after saving to all-time)
   */
  resetStats(): void {
    this.stats = { ...DEFAULT_SESSION_STATS };
    this.updateStats({});
  }

  /**
   * Start the statistics update timer
   */
  private startStatsTimer(): void {
    this.stopStatsTimer();
    
    this.statsTimerId = setInterval(() => {
      if (this.state.status === AutoFarmStatus.ACTIVE) {
        this.updateStats({}); // Trigger stats callback with updated elapsed time
      }
    }, this.STATS_UPDATE_INTERVAL);
  }

  /**
   * Stop the statistics update timer
   */
  private stopStatsTimer(): void {
    if (this.statsTimerId) {
      clearInterval(this.statsTimerId);
      this.statsTimerId = null;
    }
  }

  /**
   * Process the next tile in snake pattern
   */
  private async processNextTile(): Promise<void> {
    console.log('[AutoFarm] processNextTile called');
    console.log(
      `[AutoFarm] state: pos=(${this.state.currentPosition.x}, ${this.state.currentPosition.y}) dir=${this.state.direction} tiles=${this.state.tilesCompleted}`
    );
    
    if (this.state.status !== AutoFarmStatus.ACTIVE) {
      console.log('[AutoFarm] Not active, stopping');
      return;
    }

    // Get next position in snake pattern
    const nextPos = this.getNextPosition();
    console.log('[AutoFarm] Next position calculated:', nextPos);
    console.log('[AutoFarm] MAP_HEIGHT:', this.MAP_HEIGHT, 'Current Y:', this.state.currentPosition.y);
    
    if (!nextPos) {
      // Completed entire map
      console.log('[AutoFarm] Map completed!');
      this.clearPersistedRun(); // FID-078: a finished run is not resumable
      this.emitEvent({
        type: 'complete',
        timestamp: Date.now(),
        position: this.state.currentPosition,
        message: 'Entire map completed!'
      });
      this.stop();
      return;
    }

    // Process this tile
    console.log('[AutoFarm] Processing tile:', nextPos);
    const result = await this.processTile(nextPos);
    console.log('[AutoFarm] Tile result:', result);
    
    // Update position regardless of action result (we moved there)
    // Only skip position update if movement itself failed
    if (result.success) {
      console.log('[AutoFarm] Updating position to:', nextPos);
      this.updateState({
        currentPosition: nextPos,
        tilesCompleted: this.state.tilesCompleted + 1
      });
      // FID-078: keep the server run record in step with the sweep (throttled).
      this.schedulePersist();
      
      this.updateStats({
        tilesVisited: this.stats.tilesVisited + 1
      });
    } else {
      console.log('[AutoFarm] Tile processing failed, not updating position');
    }

    console.log('[AutoFarm] Scheduling next tile in', this.MOVEMENT_DELAY, 'ms');
    
    // Wait for the movement delay before processing next tile
    // This ensures tiles are processed sequentially with proper spacing
    await new Promise(resolve => setTimeout(resolve, this.MOVEMENT_DELAY));
    
    // Only schedule next tile if still active (could have been stopped during delay)
    if (this.state.status === AutoFarmStatus.ACTIVE) {
      // Use setImmediate-style scheduling to avoid deep recursion
      this.timerId = setTimeout(() => {
        this.processNextTile();
      }, 0);
    }
  }

  /**
   * Get next position in snake pattern
   */
  private getNextPosition(): { x: number; y: number } | null {
    const { currentPosition, direction } = this.state;
    const { x, y } = currentPosition;

    // Check if we've completed the entire map
    if (y > this.MAP_HEIGHT) {
      return null;
    }

    let nextX: number;
    let nextY: number;
    let nextDirection = direction;

    if (direction === 'forward') {
      // Moving left to right
      if (x < this.MAP_WIDTH) {
        nextX = x + 1;
        nextY = y;
      } else {
        // Reached end of row, move to next row (backward)
        nextX = this.MAP_WIDTH;
        nextY = y + 1;
        nextDirection = 'backward';
      }
    } else {
      // Moving right to left
      if (x > 1) {
        nextX = x - 1;
        nextY = y;
      } else {
        // Reached start of row, move to next row (forward)
        nextX = 1;
        nextY = y + 1;
        nextDirection = 'forward';
      }
    }

    // Update direction if changed
    if (nextDirection !== direction) {
      this.updateState({ direction: nextDirection, currentRow: nextY });
    }

    return { x: nextX, y: nextY };
  }

  /**
   * Process a single tile (move, harvest, combat)
   * 
   * Flow:
   * 1. Move to target position
   * 2. Get tile information
   * 3. Check for harvestable resources or player base
   * 4. Execute appropriate action (harvest or combat)
   * 5. Update statistics
   */
  private async processTile(position: { x: number; y: number }): Promise<TileProcessResult> {
    try {
      // Step 1: Move to position
      const moveSuccess = await this.moveToPosition(position);
      if (!moveSuccess) {
        return {
          success: false,
          position,
          action: 'skipped',
          error: 'Failed to move to position after retries'
        };
      }

      // Step 2: Get tile information
      const tileInfo = await this.getTileInfo(position);
      if (!tileInfo) {
        return {
          success: true,
          position,
          action: 'moved' // Moved successfully, but no tile info
        };
      }

      // Step 3: Check for actions to perform
      
      // Check for player base (combat)
      if (tileInfo.occupiedByBase && tileInfo.baseOwner && this.config.attackPlayers) {
        const combatAttempt = await this.attackBase(tileInfo);
        if (combatAttempt.success) {
          return {
            success: true,
            position,
            action: 'attacked',
            combatResult: { won: combatAttempt.won ?? false }
          };
        }
      }

      // Check for harvestable resources
      const harvestAttempt = await this.attemptHarvest(position, tileInfo);
      if (harvestAttempt.success) {
        return {
          success: true,
          position,
          action: 'harvested',
          resourcesGained: {
            metal: harvestAttempt.metalGained,
            energy: harvestAttempt.energyGained
          }
        };
      }

      // Just moved, nothing to harvest/attack
      return {
        success: true,
        position,
        action: 'moved'
      };
      
    } catch (error) {
      console.error('Error processing tile:', error);
      this.updateStats({ errorsEncountered: this.stats.errorsEncountered + 1 });
      
      this.emitEvent({
        type: 'error',
        timestamp: Date.now(),
        position,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        position,
        action: 'skipped',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Move to specified position with direct API call verification
   * Calls /api/game/move directly and verifies response
   */
  private async moveToPosition(position: { x: number; y: number }): Promise<boolean> {
    try {
      const current = this.state.currentPosition;
      
      // Calculate direction vector
      const dx = position.x - current.x;
      const dy = position.y - current.y;
      
      // Map direction to keyboard keys (QWEASDZXC layout)
      let movementKey: string;
      let direction: string;
      if (dy < 0 && dx === 0) {
        movementKey = 'w';
        direction = 'N';
      } else if (dy < 0 && dx > 0) {
        movementKey = 'e';
        direction = 'NE';
      } else if (dy === 0 && dx > 0) {
        movementKey = 'd';
        direction = 'E';
      } else if (dy > 0 && dx > 0) {
        movementKey = 'c';
        direction = 'SE';
      } else if (dy > 0 && dx === 0) {
        movementKey = 'x';
        direction = 'S';
      } else if (dy > 0 && dx < 0) {
        movementKey = 'z';
        direction = 'SW';
      } else if (dy === 0 && dx < 0) {
        movementKey = 'a';
        direction = 'W';
      } else if (dy < 0 && dx < 0) {
        movementKey = 'q';
        direction = 'NW';
      } else {
        // Already at target position
        return true;
      }
      
      console.log(`[AutoFarm] Moving ${movementKey} (${direction}) from (${current.x}, ${current.y}) to (${position.x}, ${position.y})`);
      
      // Get username from localStorage (same as harvest verification)
      const username = localStorage.getItem('darkframe_username');
      if (!username) {
        console.error('[AutoFarm] No username found for movement');
        return false;
      }
      
      const requestBody = { 
        username: username,
        direction: direction  // Use cardinal direction (N, E, S, W, etc.) not keyboard key
      };
      
      console.log('[AutoFarm] Movement request body:', requestBody);
      
      // Call move API directly instead of simulating keypress
      const response = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        console.error(`[AutoFarm] Move API returned ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      
      // FID-20260912-075: response bodies are bulky (~1.5 KB each) and this
      // fires per tile — log a one-line summary instead of the full pretty JSON.
      const loggedPos = extractMovePosition(data);
      console.log(
        `[AutoFarm] Move API success=${data.success} serverPos=${loggedPos ? `(${loggedPos.x}, ${loggedPos.y})` : 'unknown'}`
      );
      
      if (!data.success) {
        console.error(`[AutoFarm] Move failed: ${data.error || 'Unknown error'}`);
        return false;
      }
      
      // Verify we moved to the expected position
      // FID-20260906-010 R2: the move API's documented contract is
      // { success, data: { player, currentTile } } — read data.data.player first.
      // FID-20260912-063: position extraction validates finite numbers — a
      // truthy-but-empty {} (serialization drift) must fall through to the
      // next shape instead of short-circuiting the whole chain.
      const newPos = extractMovePosition(data);

      if (newPos && newPos.x === position.x && newPos.y === position.y) {
        console.log(`[AutoFarm] Move verified: Server confirms position (${newPos.x}, ${newPos.y})`);
        // Update internal position state
        this.updateState({ currentPosition: position });
        // Emit move event
        this.emitEvent({
          type: 'move',
          timestamp: Date.now(),
          position: position,
          message: `Moved to (${position.x}, ${position.y}) via API call`
        });
        return true;
      } else {
        // FID-20260912-075: on verification mismatch, ADOPT the server's
        // position. The old behavior only accepted the move when the server
        // confirmed the exact target, so once engine state diverged from
        // server truth (tab refresh, manual movement, failed tile elsewhere)
        // the engine stalled forever: it kept requesting moves toward a stale
        // target while the player silently walked elsewhere — every request
        // "succeeded" server-side and moved the character one more tile.
        // The server is authoritative: record where it says we are, report
        // the tile as failed, and let processNextTile recalculate from truth.
        console.warn(
          `[AutoFarm] Move verification inconclusive (extracted: ${JSON.stringify(newPos)}); re-syncing position`
        );
        let serverPos: { x: number; y: number } | null = null;
        try {
          const sync = await fetch(`/api/player?username=${encodeURIComponent(username)}`);
          const syncData = await sync.json();
          serverPos = extractMovePosition(syncData);
        } catch {
          // fall through with whatever the move response itself reported
        }
        if (!serverPos && newPos) serverPos = newPos;

        if (serverPos) {
          const diverged =
            serverPos.x !== this.state.currentPosition.x ||
            serverPos.y !== this.state.currentPosition.y;
          this.updateState({ currentPosition: serverPos });
          if (serverPos.x === position.x && serverPos.y === position.y) {
            // Server says we ARE at the intended tile — treat as success.
            this.emitEvent({
              type: 'move',
              timestamp: Date.now(),
              position: position,
              message: `Moved to (${position.x}, ${position.y}) (re-synced)`
            });
            return true;
          }
          if (diverged) {
            console.warn(
              `[AutoFarm] Engine position diverged from server — adopting server position (${serverPos.x}, ${serverPos.y})`
            );
          }
        }
        console.error(`[AutoFarm] Position mismatch: Expected (${position.x}, ${position.y}), got`, newPos);
        return false;
      }
      
    } catch (error) {
      console.error('[AutoFarm] Move error:', error);
      this.emitEvent({
        type: 'error',
        timestamp: Date.now(),
        position: this.state.currentPosition,
        message: `Movement error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return false;
    }
  }

  /**
   * Get tile information from server
   */
  private async getTileInfo(position: { x: number; y: number }): Promise<Tile | null> {
    try {
      const response = await fetch(`/api/tile?x=${position.x}&y=${position.y}`);
      const data = await response.json();
      
      if (!data.success) {
        this.emitEvent({
          type: 'error',
          timestamp: Date.now(),
          position,
          message: `Failed to get tile info: ${data.error || 'Unknown error'}`
        });
        return null;
      }
      
      return data.data; // Returns tile object with terrain, occupiedByBase, baseOwner, etc.
      
    } catch (error) {
      this.emitEvent({
        type: 'error',
        timestamp: Date.now(),
        position,
        message: `Tile info error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return null;
    }
  }

  /**
   * Attempt to harvest resources from current tile
   */
  /**
   * Simulate a keypress to trigger existing harvest UI logic
   * This leverages all existing game mechanics: modals, cooldowns, anti-cheat, etc.
   */
  private simulateKeyPress(key: string): void {
    // Create event with document.body as target to bypass input focus checks
    const event = new KeyboardEvent('keydown', {
      key: key,
      bubbles: true,
      cancelable: true,
      composed: true, // Allow event to cross shadow DOM boundaries
      view: window
    });
    
    // Define target as document.body to provide proper closest() method
    Object.defineProperty(event, 'target', {
      value: document.body,
      enumerable: true
    });
    
    // Dispatch to window to ensure event reaches all listeners
    window.dispatchEvent(event);
  }

  /**
   * Attempt to harvest resources via the /api/harvest API directly.
   *
   * FID-20260911-047 (egress): the previous implementation simulated a 'g'/'f'
   * keypress and then verified the harvest by polling /api/player up to 16×
   * per cycle (pre-read + 15×200ms polls + the UI refresh) — each poll a
   * ~21.5 KB full player payload. The harvest API response already reports
   * metalGained/energyGained/xpAwarded, so the response itself is the
   * verification: one ~1 KB round-trip replaces ~350 KB of polling.
   */
  private async attemptHarvest(position: { x: number; y: number }, tileInfo: Tile): Promise<HarvestAttemptResult> {
    try {
      // Check if tile has harvestable resources
      const harvestableTerrains = ['Metal', 'Energy', 'Cave', 'Forest'];
      if (!tileInfo || !harvestableTerrains.includes(tileInfo.terrain)) {
        return { success: false, reason: 'No harvestable resources' };
      }
      
      const username = localStorage.getItem('darkframe_username');
      if (!username) {
        console.error('[AutoFarm] No username found for harvest');
        return { success: false, reason: 'No username' };
      }
      
      console.log(`[AutoFarm] Direct harvest of ${tileInfo.terrain} at (${position.x}, ${position.y})`);
      
      const response = await fetch('/api/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      const data = await response.json().catch(() => null);
      
      if (!response.ok || !data || data.success === false) {
        // Not an error — cooldown/depleted rejections are expected cycles.
        const reason = (data?.message || data?.error?.message || `HTTP ${response.status}`) as string;
        console.warn(`[AutoFarm] Harvest rejected: ${reason}`);
        
        // Still add the extra delay for Basic mode cooldown respect.
        if (this.HARVEST_DELAY_EXTRA > 0) {
          await new Promise(resolve => setTimeout(resolve, this.HARVEST_DELAY_EXTRA));
        }
        return { success: false, reason };
      }
      
      // Success — the response carries the authoritative gains.
      const metalGained = Number(data.metalGained ?? 0);
      const energyGained = Number(data.energyGained ?? 0);
      console.log(`[AutoFarm] Harvest ok: Metal=${metalGained}, Energy=${energyGained}${data.itemFound ? `, item=${data.itemFound}` : ''}`);
      
      this.emitEvent({
        type: 'harvest',
        timestamp: Date.now(),
        position,
        data: {
          terrain: tileInfo.terrain,
          method: 'direct_api',
          verified: true,
          metalGained,
          energyGained,
          itemFound: data.itemFound
        },
        message: `Harvested ${tileInfo.terrain}: +${metalGained} Metal, +${energyGained} Energy`
      });
      
      // Add extra delay for VIP/Basic cooldown respect
      if (this.HARVEST_DELAY_EXTRA > 0) {
        await new Promise(resolve => setTimeout(resolve, this.HARVEST_DELAY_EXTRA));
      }
      
      // Push the gains into the UI WITHOUT a refetch — the callback applies
      // the server-reported deltas to local state (see game page onRefresh).
      if (this.onRefreshCallback) {
        try {
          await this.onRefreshCallback({ metal: metalGained, energy: energyGained });
        } catch (refreshError) {
          console.warn('[AutoFarm] UI refresh failed:', refreshError);
        }
      }
      
      return {
        success: true,
        method: 'direct_api',
        terrain: tileInfo.terrain,
        metalGained,
        energyGained
      };
    } catch (error) {
      this.emitEvent({
        type: 'error',
        timestamp: Date.now(),
        position,
        message: `Harvest error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      // Increment error counter
      this.updateStats({ errorsEncountered: this.stats.errorsEncountered + 1 });
      
      return { success: false, error };
    }
  }

  /**
   * Attack a player base with rank filtering and resource targeting
   * NOTE: For MVP, we'll track attack attempts but actual combat integration
   * requires unit selection logic which will be implemented in Phase 2
   */
  private async attackBase(tileInfo: Tile): Promise<CombatAttemptResult> {
    try {
      // Get username
      const username = localStorage.getItem('darkframe_username');
      if (!username) {
        return { success: false, reason: 'No username found' };
      }
      
      // Get attacker's player data for rank comparison
      const playerResponse = await fetch(`/api/player?username=${encodeURIComponent(username)}`);
      const playerData = await playerResponse.json();
      
      if (!playerData.success) {
        return { success: false, reason: 'Could not load player data' };
      }
      
      const attackerRank = playerData.data.rank || 1;
      
      // Get defender's data
      // Tile.baseOwner IS the owner's username (varchar column, FID-009-era schema).
      const defenderUsername = tileInfo.baseOwner;
      if (!defenderUsername) {
        return { success: false, reason: 'No base owner found' };
      }
      
      const defenderResponse = await fetch(`/api/player?username=${encodeURIComponent(defenderUsername)}`);
      const defenderData = await defenderResponse.json();
      
      if (!defenderData.success) {
        return { success: false, reason: 'Could not load defender data' };
      }
      
      const defenderRank = defenderData.data.rank || 1;
      
      // Apply rank filter
      if (this.config.rankFilter === RankFilter.LOWER && defenderRank >= attackerRank) {
        return { success: false, reason: 'Rank filter: defender not lower rank', skipped: true };
      }
      
      if (this.config.rankFilter === RankFilter.HIGHER && defenderRank <= attackerRank) {
        return { success: false, reason: 'Rank filter: defender not higher rank', skipped: true };
      }
      
      // Implement unit selection with resource targeting
      const attacker = playerData.data;
      
      // Get attacker's units
      if (!attacker.units || attacker.units.length === 0) {
        return { success: false, reason: 'No units available for combat', skipped: true };
      }
      
      // Select units based on resource targeting strategy
      let selectedUnits = this.selectUnitsForCombat(attacker.units, attacker.resources, defenderData.data);
      
      if (selectedUnits.length === 0) {
        return { success: false, reason: 'No suitable units selected', skipped: true };
      }
      
      // Limit to reasonable number of units (prevent overwhelming API)
      const maxUnits = 10;
      if (selectedUnits.length > maxUnits) {
        selectedUnits = selectedUnits.slice(0, maxUnits);
      }
      
      // Extract unit IDs
      const unitIds = selectedUnits.map(u => u.id);
      
      // Launch infantry attack
      const combatResponse = await fetch('/api/combat/infantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: defenderUsername,
          unitIds
        })
      });
      
      const combatResult = await combatResponse.json();
      
      // Update statistics
      this.updateStats({ attacksLaunched: this.stats.attacksLaunched + 1 });
      
      if (combatResult.success) {
        const battleLog = combatResult.battleLog;
        const won = battleLog.winner === username;
        
        if (won) {
          this.updateStats({ attacksWon: this.stats.attacksWon + 1 });
        } else {
          this.updateStats({ attacksLost: this.stats.attacksLost + 1 });
        }
        
        this.emitEvent({
          type: 'combat',
          timestamp: Date.now(),
          position: this.state.currentPosition,
          data: {
            success: true,
            message: `${won ? '✅ Victory' : '❌ Defeat'} vs ${defenderUsername}`,
            victory: won,
            metalStolen: battleLog.resources?.metal || 0,
            energyStolen: battleLog.resources?.energy || 0,
            xpGained: battleLog.xpGained || 0,
            defenderName: defenderUsername,
            unitsLost: battleLog.unitsLost || 0
          },
          message: `${won ? '✅ Victory' : '❌ Defeat'} vs ${defenderUsername} (${unitIds.length} units)`
        });
        
        return { success: true, won, battleLog: combatResult.battleLog };
      } else {
        // Combat failed (cooldown, invalid target, etc.)
        return { success: false, reason: combatResult.error || 'Combat failed', skipped: true };
      }
      
    } catch (error) {
      this.emitEvent({
        type: 'error',
        timestamp: Date.now(),
        position: this.state.currentPosition,
        message: `Combat error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      this.updateStats({ errorsEncountered: this.stats.errorsEncountered + 1 });
      
      return { success: false, error };
    }
  }

  /**
   * Select units for combat based on resource targeting strategy
   * Targets players based on what resources WE (the attacker) need most
   */
  private selectUnitsForCombat(units: CombatUnit[], attackerResources: { metal?: number; energy?: number } | null | undefined, _defender: SanitizedPlayer | null | undefined): CombatUnit[] {
    if (!units || units.length === 0) return [];
    
    // Apply resource targeting strategy based on what the ATTACKER needs
    switch (this.config.resourceTarget) {
      case ResourceTarget.METAL:
        // We need metal - attack players to gain metal
        // Use strongest units for efficiency
        return [...units].sort((a, b) => b.strength - a.strength);
        
      case ResourceTarget.ENERGY:
        // We need energy - attack players to gain energy
        // Use strongest units for efficiency
        return [...units].sort((a, b) => b.strength - a.strength);
        
      case ResourceTarget.LOWEST:
        // We need whatever resource we're lowest on
        // Determine which resource the attacker has less of
        const attackerMetal = attackerResources?.metal || 0;
        const attackerEnergy = attackerResources?.energy || 0;
        const _targetResource = attackerMetal <= attackerEnergy ? 'METAL' : 'ENERGY';
        
        // Attack players to gain our lowest resource
        // Use strongest units for efficiency
        return [...units].sort((a, b) => b.strength - a.strength);
        
      default:
        // Default: use strongest units
        return [...units].sort((a, b) => b.strength - a.strength);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    if (this.runSaveTimer) {
      clearTimeout(this.runSaveTimer);
      this.runSaveTimer = null;
    }
    this.onEventCallback = null;
    this.onStatsCallback = null;
    this.onStateCallback = null;
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. SNAKE PATTERN ALGORITHM:
 *    - Traverses map row by row, alternating direction
 *    - Odd rows: left to right (1 → 150)
 *    - Even rows: right to left (150 → 1)
 *    - Ensures complete map coverage
 * 
 * 2. TIMING & DELAYS:
 *    - 900ms between tile movements (human-like speed)
 *    - 1 second statistics update interval
 *    - Prevents server overload and rate limiting
 * 
 * 3. STATE MANAGEMENT:
 *    - Tracks current position, direction, and progress
 *    - Maintains session statistics in real-time
 *    - Supports pause/resume with time adjustment
 * 
 * 4. EVENT SYSTEM:
 *    - Callback-based event notifications
 *    - Events: move, harvest, combat, error, complete
 *    - Allows UI to react to engine actions
 * 
 * 5. ERROR HANDLING:
 *    - Tiles that error are skipped
 *    - Engine continues to next tile
 *    - Errors tracked in statistics
 * 
 * 6. INTEGRATION POINTS:
 *    - processTile() will call movement/harvest/combat APIs
 *    - APIs return results that update statistics
 *    - GameContext updated after each action
 * 
 * FUTURE ENHANCEMENTS:
 * - Smart pathing (avoid known obstacles)
 * - Priority targeting (high-value resources first)
 * - Multi-speed options (slow, normal, fast)
 * - Region-based farming (custom boundaries)
 * - Resume from last position on page reload
 */
