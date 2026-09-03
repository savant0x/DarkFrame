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
import {
  AutoFarmConfig,
  AutoFarmState,
  AutoFarmStatus,
  AutoFarmSessionStats,
  AutoFarmEvent,
  TileProcessResult,
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
type RefreshCallback = () => Promise<void>;

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
   * Start auto-farming from current position
   */
  async start(): Promise<void> {
    if (this.state.status === AutoFarmStatus.ACTIVE) {
      return; // Already running
    }

    // Initialize start time
    this.state.startTime = Date.now();
    this.updateState({ 
      status: AutoFarmStatus.ACTIVE,
      pausedTime: null
    });

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
      data: finalStats
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
    console.log('[AutoFarm] Current state:', {
      status: this.state.status,
      position: this.state.currentPosition,
      direction: this.state.direction,
      tilesCompleted: this.state.tilesCompleted
    });
    
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
    const { currentPosition, currentRow, direction } = this.state;
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
        const combatResult = await this.attackBase(tileInfo);
        if (combatResult) {
          return {
            success: true,
            position,
            action: 'attacked',
            combatResult
          };
        }
      }

      // Check for harvestable resources
      const harvestResult = await this.attemptHarvest(position, tileInfo);
      if (harvestResult && harvestResult.success) {
        return {
          success: true,
          position,
          action: 'harvested',
          resourcesGained: harvestResult
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
      
      console.log('[AutoFarm] Move API response:', JSON.stringify(data, null, 2));
      
      if (!data.success) {
        console.error(`[AutoFarm] Move failed: ${data.error || 'Unknown error'}`);
        return false;
      }
      
      // Verify we moved to the expected position
      // Try multiple paths to extract position from response
      // IMPORTANT: Move API returns { success: true, data: { player: {...}, currentTile: {...} } }
      // Position is at data.player.currentPosition (NOT data.data.player.currentPosition)
      let newPos;
      if (data.player?.currentPosition) {
        newPos = data.player.currentPosition;
        console.log('[AutoFarm] Extracted position from data.player.currentPosition:', newPos);
      } else if (data.data?.player?.currentPosition) {
        newPos = data.data.player.currentPosition;
        console.log('[AutoFarm] Extracted position from data.data.player.currentPosition (fallback):', newPos);
      } else if (data.data?.newPosition) {
        newPos = data.data.newPosition;
        console.log('[AutoFarm] Extracted position from data.data.newPosition (fallback):', newPos);
      } else if (data.newPosition) {
        newPos = data.newPosition;
        console.log('[AutoFarm] Extracted position from data.newPosition (fallback):', newPos);
      } else {
        console.error('[AutoFarm] Could not extract position from response. Response structure:', {
          hasData: !!data.data,
          hasPlayer: !!data.player,
          hasPlayerCurrentPosition: !!data.player?.currentPosition,
          dataPlayerExists: !!data.data?.player,
          dataPlayerCurrentPosition: !!data.data?.player?.currentPosition,
          dataKeys: data.data ? Object.keys(data.data) : [],
          playerKeys: data.player ? Object.keys(data.player) : [],
          topLevelKeys: Object.keys(data)
        });
      }
      
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
        // Enhanced logging: Log full response and newPos for diagnostics
        console.error(`[AutoFarm] Position mismatch: Expected (${position.x}, ${position.y}), got`, newPos);
        console.error('[AutoFarm] Full move API response:', JSON.stringify(data, null, 2));
        // Log additional diagnostic info
        console.error('[AutoFarm] Diagnostic keys:', {
          hasData: !!data.data,
          hasPlayer: !!data.player,
          hasPlayerCurrentPosition: !!data.player?.currentPosition,
          dataPlayerExists: !!data.data?.player,
          dataPlayerCurrentPosition: !!data.data?.player?.currentPosition,
          dataKeys: data.data ? Object.keys(data.data) : [],
          playerKeys: data.player ? Object.keys(data.player) : [],
          topLevelKeys: Object.keys(data)
        });
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
  private async getTileInfo(position: { x: number; y: number }): Promise<any> {
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
   * Attempt to harvest resources with actual server verification
   * Waits for player resources to update confirming harvest succeeded
   */
  private async attemptHarvest(position: { x: number; y: number }, tileInfo: any): Promise<any> {
    try {
      // Check if tile has harvestable resources
      const harvestableTerrains = ['Metal', 'Energy', 'Cave', 'Forest'];
      if (!tileInfo || !harvestableTerrains.includes(tileInfo.terrain)) {
        return { success: false, reason: 'No harvestable resources' };
      }
      
      // Determine which key to press based on terrain
      // 'g' = Metal/Energy (Gather)
      // 'f' = Cave/Forest (Find/Forage)
      const harvestKey = (tileInfo.terrain === 'Metal' || tileInfo.terrain === 'Energy') ? 'g' : 'f';
      
      console.log(`[AutoFarm] Simulating keypress '${harvestKey}' for ${tileInfo.terrain} harvest at (${position.x}, ${position.y})`);
      
      // Get current resources before harvest for verification
      const username = localStorage.getItem('darkframe_username');
      if (!username) {
        console.error('[AutoFarm] No username found for harvest verification');
        return { success: false, reason: 'No username' };
      }
      
      let initialResources = { metal: 0, energy: 0 };
      
      try {
        const response = await fetch(`/api/player?username=${encodeURIComponent(username)}`);
        const data = await response.json();
        if (data.success && data.data.resources) {
          initialResources = data.data.resources;
          console.log(`[AutoFarm] Pre-harvest resources: Metal=${initialResources.metal}, Energy=${initialResources.energy}`);
        }
      } catch (error) {
        console.warn('[AutoFarm] Failed to get initial resources:', error);
        return { success: false, reason: 'Could not load initial resources' };
      }
      
      // Simulate the keypress - this triggers the harvest API call
      this.simulateKeyPress(harvestKey);
      
      // Wait for the harvest to process and verify resources increased
      // Poll player data until resources update or timeout
      const maxAttempts = 15; // 15 attempts * 200ms = 3 second timeout (harvest cooldown)
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        try {
          const response = await fetch(`/api/player?username=${encodeURIComponent(username)}`);
          const data = await response.json();
          
          if (data.success && data.data.resources) {
            const currentResources = data.data.resources;
            
            // Check if resources increased (either metal or energy)
            const metalGained = currentResources.metal - initialResources.metal;
            const energyGained = currentResources.energy - initialResources.energy;
            
            if (metalGained > 0 || energyGained > 0) {
              console.log(`[AutoFarm] Harvest verified: Gained Metal=${metalGained}, Energy=${energyGained}`);
              
              // Emit harvest event
              this.emitEvent({
                type: 'harvest',
                timestamp: Date.now(),
                position,
                data: {
                  terrain: tileInfo.terrain,
                  method: 'keypress_simulation',
                  key: harvestKey,
                  verified: true,
                  metalGained,
                  energyGained
                },
                message: `Harvested ${tileInfo.terrain}: +${metalGained} Metal, +${energyGained} Energy`
              });
              
              // Add extra delay for VIP/Basic cooldown respect
              if (this.HARVEST_DELAY_EXTRA > 0) {
                await new Promise(resolve => setTimeout(resolve, this.HARVEST_DELAY_EXTRA));
              }
              
              // Trigger UI refresh to update resource display AFTER delays complete
              if (this.onRefreshCallback) {
                try {
                  await this.onRefreshCallback();
                  console.log('[AutoFarm] UI refreshed after harvest');
                } catch (refreshError) {
                  console.warn('[AutoFarm] UI refresh failed:', refreshError);
                }
              }
              
              return { 
                success: true, 
                method: 'keypress_simulation',
                terrain: tileInfo.terrain,
                metalGained,
                energyGained
              };
            }
          }
        } catch (pollError) {
          console.warn(`[AutoFarm] Harvest verification attempt ${attempt + 1} failed:`, pollError);
        }
      }
      
      // Timeout - harvest didn't complete (likely on cooldown or no resources)
      console.warn(`[AutoFarm] Harvest verification timeout: Resources did not increase for ${tileInfo.terrain}`);
      
      // This is not an error - tile might be depleted or on cooldown
      // Still add the extra delay for Basic mode cooldown respect
      if (this.HARVEST_DELAY_EXTRA > 0) {
        await new Promise(resolve => setTimeout(resolve, this.HARVEST_DELAY_EXTRA));
      }
      
      return { success: false, reason: 'Harvest timeout (cooldown or depleted)' };
      
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
  private async attackBase(tileInfo: any): Promise<any> {
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
      const defenderUsername = tileInfo.baseOwner?.username;
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
  private selectUnitsForCombat(units: any[], attackerResources: any, defender: any): any[] {
    if (!units || units.length === 0) return [];
    
    // Apply resource targeting strategy based on what the ATTACKER needs
    switch (this.config.resourceTarget) {
      case ResourceTarget.METAL:
        // We need metal - attack players to gain metal
        // Use strongest units for efficiency
        return [...units].sort((a, b) => (b.str || 0) - (a.str || 0));
        
      case ResourceTarget.ENERGY:
        // We need energy - attack players to gain energy
        // Use strongest units for efficiency
        return [...units].sort((a, b) => (b.str || 0) - (a.str || 0));
        
      case ResourceTarget.LOWEST:
        // We need whatever resource we're lowest on
        // Determine which resource the attacker has less of
        const attackerMetal = attackerResources?.metal || 0;
        const attackerEnergy = attackerResources?.energy || 0;
        const targetResource = attackerMetal <= attackerEnergy ? 'METAL' : 'ENERGY';
        
        // Attack players to gain our lowest resource
        // Use strongest units for efficiency
        return [...units].sort((a, b) => (b.str || 0) - (a.str || 0));
        
      default:
        // Default: use strongest units
        return [...units].sort((a, b) => (b.str || 0) - (a.str || 0));
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
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
