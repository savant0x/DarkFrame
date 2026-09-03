/**
 * @file lib/jobs/index.ts
 * @created 2025-11-04
 * @updated 2025-11-04 (FID-20251026-001: Full ECHO Architecture Compliance Refactor)
 * @overview Background Jobs - Barrel Export
 *
 * OVERVIEW:
 * Central export point for background job processors and scheduled tasks.
 * Handles automated systems that run independently of user requests.
 *
 * Organization:
 * - Bot Management: Automated bot behavior and maintenance
 * - Factory Operations: Background factory slot regeneration
 *
 * Usage:
 * ```typescript
 * import { processFlagBotManager, regenerateFactorySlots } from '@/lib/jobs';
 * ```
 */

// ============================================================================
// BOT MANAGEMENT JOBS
// ============================================================================

// Re-export flag bot manager (automated flag bot behavior)
export * from './flagBotManager';

// ============================================================================
// FACTORY OPERATIONS
// ============================================================================

// Re-export factory slot regeneration (automated slot recovery)
export * from './factorySlotRegeneration';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * Job Processing Architecture:
 * - Jobs run on scheduled intervals or triggered by events
 * - Designed to be idempotent (safe to run multiple times)
 * - Error handling prevents job failures from affecting main systems
 * - Logging provides visibility into automated operations
 *
 * Current Jobs:
 * - Flag Bot Manager: Maintains automated flag defense/offense bots
 * - Factory Slot Regeneration: Recovers factory slots over time
 *
 * Future Enhancements:
 * - Add job scheduling system (cron-like)
 * - Implement job queues for high-volume processing
 * - Add monitoring and alerting for job failures
 *
 * Usage Examples:
 * ```typescript
 * import { processFlagBotManager } from '@/lib/jobs';
 *
 * // Run bot management job
 * await processFlagBotManager();
 * ```
 *
 * ============================================================================
 */