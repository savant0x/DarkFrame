/**
 * @file lib/index.ts
 * @created 2025-10-16
 * @updated 2025-01-XX (Phase 2: Added missing service exports)
 * @overview Barrel export file for library modules
 * 
 * OVERVIEW:
 * Central export point for all library services and utilities.
 * Enables cleaner imports: `import { authService, battleService } from '@/lib';`
 * instead of multiple individual imports.
 */

// ============================================================================
// CORE INFRASTRUCTURE
// ============================================================================

// Re-export MongoDB utilities
export { createServiceClient } from './supabase/server';

// Re-export authentication service
export * from './authService';

// Re-export authentication middleware (API route helpers - selective export to avoid collisions)
export { 
  authenticateRequest, 
  requireAuth, 
  requireAdmin, 
  requireClanMembership
} from './authMiddleware';
export type { AuthResult } from './authMiddleware';

// Re-export logging (both basic and production loggers)
export * from './logger';
export { 
  createLogger, 
  createRequestLogger, 
  generateRequestId,
  getRequestContext,
  setRequestContext,
  getRequestIdFromHeaders,
  LogLevel
} from './logger/productionLogger';
export type { Logger } from './logger/productionLogger';

// Re-export request logging middleware
export { withRequestLogging, createRouteLogger } from './middleware/requestLogger';

// Re-export rate limiting middleware
export { 
  createRateLimiter, 
  withRateLimit, 
  getRateLimitStats,
  RATE_LIMIT_PRESETS
} from './middleware/rateLimiter';
export type { RateLimitConfig } from './middleware/rateLimiter';

// Re-export rate limiting configuration
export { ENDPOINT_RATE_LIMITS, getRateLimitConfig } from './middleware/rateLimitConfig';

// Re-export validation schemas
export * from './validation';

// Re-export error handling
export * from './errors';

// ============================================================================
// GAME SERVICES
// ============================================================================

// Re-export battle service
export * from './battleService';

// Re-export battle tracking service
export * from './battleTrackingService';

// Re-export harvest service
export * from './harvestService';

// Re-export beer base service
export * from './beerBaseService';

// Re-export map generation utilities
export * from './mapGeneration';

// Re-export map service
export * from './mapService';

// Re-export player service
export * from './playerService';

// Re-export movement service
export * from './movementService';

// Re-export balance service
export * from './balanceService';

// Re-export factory service
export * from './factoryService';

// Re-export factory upgrade service
export * from './factoryUpgradeService';

// Re-export ranking service
export * from './rankingService';

// Re-export XP service
export * from './xpService';

// Re-export tier unlock service
export * from './tierUnlockService';

// Re-export research point service
export * from './researchPointService';

// Re-export daily login service
export * from './dailyLoginService';

// Re-export image service
export * from './imageService';

// Re-export discovery service
export * from './discoveryService';

// Re-export combat power service
export * from './combatPowerService';

// Re-export flag service (excluding formatDistance to avoid collision with mapService)
export { 
  calculateDistance,
  getCompassDirection,
  isInChallengeRange,
  buildTrackerData,
  getCompassArrow,
  formatHoldDuration,
  getTimeRemaining,
  isFlagExpiringSoon
} from './flagService';

// Re-export fast travel service
export * from './fastTravelService';

// ============================================================================
// BOT SERVICES
// ============================================================================

// Re-export bot scanner service
export * from './botScannerService';

// Re-export bot magnet service
export * from './botMagnetService';

// Re-export bot combat service
export * from './botCombatService';

// Re-export bot growth engine
export * from './botGrowthEngine';

// Re-export flag bot service
export * from './flagBotService';

// ============================================================================
// CLAN SERVICES
// ============================================================================

// Re-export clan alliance service
export * from './clanAllianceService';

// Re-export clan chat service
export * from './clanChatService';

// Re-export clan distribution service
export * from './clanDistributionService';

// Re-export clan main service
export * from './clanService';

// Re-export clan bank service
export * from './clanBankService';

// Re-export clan activity service
export * from './clanActivityService';

// Re-export clan level service
export * from './clanLevelService';

// Re-export clan perk service
export * from './clanPerkService';

// Re-export clan research service
export * from './clanResearchService';

// Re-export clan warfare service
export * from './clanWarfareService';

// ============================================================================
// MESSAGING & SOCIAL SERVICES
// ============================================================================

// Re-export friend service (friend requests, friend list)
export * from './friendService';

// Re-export DM service (direct messages)
export * from './dmService';

// Re-export chat service (global chat - selective export to avoid ChatMessage conflict with clanChatService)
export {
  sendGlobalChatMessage,
  getGlobalChatMessages,
  editGlobalChatMessage,
  deleteGlobalChatMessage,
  checkGlobalChatRateLimit,
  reloadChatBlacklist
} from './chatService';

// Re-export channel service (chat channels)
export * from './channelService';

// Re-export messaging service (general messaging - selective export to avoid conflicts with dmService)
export {
  deleteDirectMessage,
  checkDirectMessageRateLimit
} from './messagingService';

// Re-export moderation service (content moderation)
export * from './moderationService';

// ============================================================================
// TUTORIAL & PROGRESSION SERVICES
// ============================================================================

// Re-export tutorial service
export * from './tutorialService';

// Re-export achievement service
export * from './achievementService';

// ============================================================================
// AUCTION & ECONOMY SERVICES
// ============================================================================

// Re-export auction service
export * from './auctionService';

// Re-export referral service
export * from './referralService';

// Re-export territory service
export * from './territoryService';

// ============================================================================
// ADDITIONAL GAME SERVICES
// ============================================================================

// Re-export cave item service
export * from './caveItemService';

// Re-export bot nest service
export * from './botNestService';

// Re-export bot migration service
export * from './botMigrationService';

// Re-export bot service (general bot operations)
export * from './botService';

// Re-export bot summoning service
export * from './botSummoningService';

// Re-export bounty board service
export * from './bountyBoardService';

// Re-export slot regen service
export * from './slotRegenService';

// Re-export stat tracking service
export * from './statTrackingService';

// Re-export player history service
export * from './playerHistoryService';

// Re-export battle log service
export * from './battleLogService';

// Re-export activity log service
export * from './activityLogService';

// Re-export cache service
export * from './cacheService';

// Re-export warfare config service
export * from './warfareConfigService';

// ============================================================================
// UTILITY & HELPER SERVICES
// ============================================================================

// Re-export toast service (client-side notifications)
export * from './toastService';

// Re-export cache keys utilities
export * from './cacheKeys';

// Re-export cache warming utilities
export * from './cacheWarming';

// Re-export harvest messages utilities
export * from './harvestMessages';

// Re-export micro-interactions utilities
export * from './microInteractions';

// Re-export query optimization utilities
export * from './queryOptimization';

// Re-export Redis utilities
export * from './redis';

// Re-export HTML sanitizer
export * from './sanitizeHtml';

// Re-export session tracker
export * from './sessionTracker';

// Re-export tile messages utilities
export * from './tileMessages';

// Re-export client-side logger
export * from './clientLogger';

// Re-export beer base analytics
export * from './beerBaseAnalytics';

// Note: Following exports skipped due to naming conflicts - need selective exports:
// - activityLogger (conflicts with activityLogService, clanActivityService)
// - animations (conflicts with transitions)
// - antiCheatDetector (check for conflicts)
// - autoFarmPersistence (check for conflicts)
// - designTokens (conflicts with animations)
// - utils (conflicts with botSummoningService)

// ============================================================================
// WEBSOCKET SYSTEM
// ============================================================================

// Re-export WebSocket system
export * from './websocket';

// ============================================================================
// BACKGROUND JOBS
// ============================================================================

// Re-export background job processors
export * from './jobs';

// ============================================================================
// SPECIALIZED SYSTEMS
// ============================================================================

// Re-export concentration zone service
export * from './concentrationZoneService';

// Re-export specialization service
export * from './specializationService';

// ============================================================================
// UTILITIES
// ============================================================================

// Re-export logger (when implementing Winston in Phase 3)
// export * from './logger';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
// 
// Export Strategy:
// - Use `export *` for services with multiple exports
// - Services are grouped by category for maintainability
// - Test files are NOT exported (*.test.ts)
// - Utility files can be imported directly or added here
// 
// Future Enhancements (Phase 4):
// - Add type-only exports when needed
// - Consider creating sub-barrels for large categories
// - Add JSDoc comments for key exports
// 
// ============================================================================
