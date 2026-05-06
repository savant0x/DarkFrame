/**
 * @file lib/wmd/jobs/index.ts
 * @created 2025-10-26
 * @updated 2025-10-26 (FID-20251026-001: Full ECHO Architecture Compliance)
 * @overview WMD Background Jobs - Barrel Export
 * 
 * OVERVIEW:
 * Background job utilities for WMD system maintenance and scheduled tasks.
 * Includes missile tracking, defense repair completion, spy mission processing,
 * vote expiration cleanup, and beer base respawning.
 * 
 * Usage:
 * ```typescript
 * import { scheduleMissileTracking, processDefenseRepairs } from '@/lib/wmd/jobs';
 * ```
 */

// ============================================================================
// BACKGROUND JOBS
// ============================================================================

// Missile flight tracking (impact detection, status updates)
export * from './missileTracker';

// Defense system repair completion
export * from './defenseRepairCompleter';

// Spy mission completion processing
export * from './spyMissionCompleter';

// Vote expiration cleanup (clan voting system)
export * from './voteExpirationCleaner';

// Job scheduler utilities
export * from './scheduler';

// Beer base respawning (game-wide resource regeneration)
export * from './beerBaseRespawner';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * Execution Strategy:
 * - All jobs should be scheduled via cron or task queue
 * - Jobs should be idempotent (safe to run multiple times)
 * - Jobs should have proper error handling and logging
 * - Jobs should update MongoDB directly (not via API routes)
 * 
 * Scheduling Recommendations:
 * - missileTracker: Every 30 seconds (real-time flight tracking)
 * - defenseRepairCompleter: Every 5 minutes (check completed repairs)
 * - spyMissionCompleter: Every 1 minute (mission resolution)
 * - voteExpirationCleaner: Every 10 minutes (expired vote cleanup)
 * - beerBaseRespawner: Every 1 hour (resource regeneration)
 * 
 * Usage Example:
 * ```typescript
 * // In server startup or cron configuration
 * import { 
 *   scheduleMissileTracking, 
 *   scheduleDefenseRepairs 
 * } from '@/lib/wmd/jobs';
 * 
 * // Schedule jobs
 * setInterval(() => scheduleMissileTracking(), 30000); // 30 seconds
 * setInterval(() => scheduleDefenseRepairs(), 300000); // 5 minutes
 * ```
 * 
 * Performance:
 * - Use database indexes for query optimization
 * - Batch process multiple items when possible
 * - Consider queue-based processing for high volume
 */

// ============================================================================
// END OF FILE
// ============================================================================
