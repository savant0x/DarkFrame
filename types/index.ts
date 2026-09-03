/**
 * @file types/index.ts
 * @created 2025-10-16
 * @updated 2025-01-23 (FID-20251023-002: Complete barrel exports for Phase 2.6)
 * @overview Barrel export file for all TypeScript type definitions
 * 
 * OVERVIEW:
 * Central export point for all type definitions across the application.
 * Enables cleaner imports: `import { Player, Achievement } from '@/types';`
 * 
 * Organization:
 * - Core game types (player, resources, battles)
 * - Feature types (clans, auctions, WMD)
 * - System types (websocket, bots, activity)
 * - UI types (hotkeys, maps, flags)
 */

// ============================================================================
// CORE GAME TYPES
// ============================================================================

// Re-export all game types (Player, Resources, Battle, etc.)
export * from './game.types';

// Re-export all unit types
export * from './units.types';

// ============================================================================
// FEATURE TYPES
// ============================================================================

// Re-export clan types
export * from './clan.types';

// Note: BankTransactionType naming resolved:
// - game.types.ts: type BankTransactionType = 'deposit' | 'withdrawal' | 'exchange' (general banking)
// - clan.types.ts: ClanBankTransactionType enum (clan-specific banking operations)

// Re-export all auction types
export * from './auction.types';

// Re-export WMD types
export * from './wmd';

// ============================================================================
// SYSTEM TYPES
// ============================================================================

// Re-export all bot configuration types
export * from './botConfig.types';

// Re-export all auto-farm types
export * from './autoFarm.types';

// Re-export activity log types (excluding Battle* conflicts with game.types)
// TODO Phase 3: Reconcile duplicate Battle type definitions
// - game.types.ts has BattleType/BattleOutcome/BattleLog with PascalCase values
// - activityLog.types.ts has same types with snake_case values
// Keep game.types exports as canonical, import activityLog types locally where needed
export {
  ActionCategory,
  ActionType
} from './activityLog.types';
export type {
  ActivityLog,
  ActivityLogQuery,
  BattleLogStats,
  BattleLogQuery
} from './activityLog.types';

// Re-export websocket types
export * from './websocket';

// ============================================================================
// UI & INTERACTION TYPES
// ============================================================================

// Re-export all map types
export * from './map.types';

// Re-export all flag types
export * from './flag.types';

// Re-export all hotkey types
export * from './hotkey.types';

// ============================================================================
// SOCIAL & MESSAGING TYPES
// ============================================================================

// Re-export friend types
export * from './friend';

// Re-export direct message types
export * from './directMessage';

// Re-export messaging types
// Note: messaging.types has conflicts with directMessage (Conversation, MessageStatus, etc.)
// Using directMessage exports
// export * from './messaging.types'; // TODO Phase 4: Consolidate messaging types

// ============================================================================
// PROGRESSION & TUTORIAL TYPES
// ============================================================================

// Re-export tutorial types
export * from './tutorial.types';

// ============================================================================
// ECONOMY & MONETIZATION TYPES
// ============================================================================

// Re-export stripe types
export * from './stripe.types';

// Re-export referral types
export * from './referral.types';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
//
// Type Organization Strategy:
// - Domain-specific types stay in their respective files
// - Shared/common types go in game.types.ts
// - Service-specific types can be co-located in lib/ if not widely used
// - All widely-used types should be exported through this barrel
//
// Usage:
// import { Player, Clan, AutoFarmConfig } from '@/types';
//
// ============================================================================
