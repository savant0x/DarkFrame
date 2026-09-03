/**
 * @file lib/wmd/index.ts
 * @created 2025-10-26
 * @updated 2025-10-26 (FID-20251026-001: Full ECHO Architecture Compliance)
 * @overview WMD System Services - Barrel Export
 * 
 * OVERVIEW:
 * Central export point for all WMD (Weapons of Mass Destruction) system services.
 * Provides clean imports for missile operations, defense systems, intelligence,
 * research progression, damage calculations, targeting validation, and notifications.
 * 
 * Organization:
 * - Core Services: missile, defense, spy, research
 * - Utility Services: damage calculator, targeting validator, sabotage engine
 * - Integration: WebSocket, notifications
 * - Admin Services: re-exported from ./admin
 * - Background Jobs: re-exported from ./jobs
 * 
 * Usage:
 * ```typescript
 * import { 
 *   missileService, 
 *   defenseService, 
 *   spyService 
 * } from '@/lib/wmd';
 * ```
 */

// ============================================================================
// CORE WMD SERVICES
// ============================================================================

// Missile system operations
export * from './missileService';

// Defense system operations (batteries, radar, interception)
export * from './defenseService';

// Intelligence & spy operations
export * from './spyService';

// Research tree progression
export * from './researchService';

// ============================================================================
// UTILITY SERVICES
// ============================================================================

// Damage calculation engine (missile impact, sabotage damage)
export * from './damageCalculator';

// Targeting validation (range, ownership, clan rules)
export * from './targetingValidator';

// Sabotage engine (intel missions, resource destruction)
// Note: sabotageEngine exports overlap with spyService, so we skip it here
// Import directly from './sabotageEngine' if needed, or use spyService exports

// ============================================================================
// INTEGRATION SERVICES
// ============================================================================

// WMD notification system (broadcasts, alerts)
export * from './notificationService';

// API helper utilities
export * from './apiHelpers';

// ============================================================================
// CLAN WMD SERVICES
// ============================================================================

// Clan voting system (missile launches, defense deployments)
export * from './clanVotingService';

// Clan consequences (vote outcomes, member penalties)
export * from './clanConsequencesService';

// Clan treasury WMD spending
export * from './clanTreasuryWMDService';

// ============================================================================
// SUB-MODULES
// ============================================================================

// Re-export admin services
export * from './admin';

// Re-export background job utilities
export * from './jobs';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * Export Strategy:
 * - Use `export *` for services with multiple exports
 * - Group services by functional area (core, utility, integration, clan)
 * - Sub-modules (admin, jobs) re-exported for convenience
 * - WebSocket integration example NOT exported (reference implementation only)
 * 
 * Import Examples:
 * ```typescript
 * // Import specific service functions
 * import { launchMissile, calculateMissileDamage } from '@/lib/wmd';
 * 
 * // Import from sub-modules
 * import { analyzeWMDActivity } from '@/lib/wmd'; // from admin/wmdAnalyticsService
 * import { scheduleMissileTracking } from '@/lib/wmd'; // from jobs/missileTracker
 * 
 * // Or import directly from sub-module
 * import { analyzeWMDActivity } from '@/lib/wmd/admin';
 * ```
 * 
 * Service Dependencies:
 * - missileService → defenseService (interception checks)
 * - spyService → sabotageEngine (sabotage damage)
 * - All services → notificationService (event broadcasts)
 * - clanVotingService → clanConsequencesService (vote resolution)
 * 
 * Performance Considerations:
 * - Tree-shakable: Only import what you use
 * - Lazy loading: Consider dynamic imports for admin dashboard
 * - Background jobs: Run via scheduled tasks, not direct imports in client code
 */

// ============================================================================
// END OF FILE
// ============================================================================
