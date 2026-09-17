/**
 * @file utils/index.ts
 * @created 2025-10-16
 * @updated 2025-10-23 (Phase 2: Added formatting utilities)
 * @overview Barrel export file for utility functions
 */

// Re-export coordinate utilities
export * from './coordinates';

// Re-export formatting utilities (Phase 2 Task 2.3)
export * from './formatting';

// Re-export auto-farm engine utilities
export * from './autoFarmEngine';

// Re-export shrine helpers (durations, rarity) — completes the barrel so
// '@/utils' offers every utils module (formatting.ts already documents
// '@/utils' as an import path). Explicit list: shrineHelpers' formatDuration
// would collide with formatting's (TS2308) — the formatting one wins the
// barrel; shrine callers import '@/utils/shrineHelpers' directly (as today).
export {
  RARITY_DURATION_MINUTES,
  MAX_BUFF_DURATION_HOURS,
  calculateDuration,
  estimateDuration,
  itemsForMaxDuration,
  getRarityColor,
} from './shrineHelpers';
