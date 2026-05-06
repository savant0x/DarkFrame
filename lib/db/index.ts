/**
 * @file lib/db/index.ts
 * @created 2025-10-26
 * @updated 2025-10-26 (FID-20251026-001: Full ECHO Architecture Compliance)
 * @overview Database Utilities - Barrel Export
 * 
 * OVERVIEW:
 * Central export point for database schemas, seed data, and MongoDB utilities.
 * Provides clean imports for database operations across the application.
 * 
 * Organization:
 * - Schemas: MongoDB collection schemas (re-exported from ./schemas)
 * - Seeds: Database seeding utilities (re-exported from ./seeds)
 * 
 * Usage:
 * ```typescript
 * import { UserSchema, seedDatabase } from '@/lib/db';
 * ```
 */

// ============================================================================
// DATABASE SCHEMAS
// ============================================================================

// Re-export all MongoDB schemas
export * from './schemas';

// ============================================================================
// DATABASE SEEDING
// ============================================================================

// Re-export seed utilities
export * from './seeds';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * Schema Organization:
 * - Each collection has its own schema file in ./schemas/
 * - Schemas define MongoDB collection structure and validation
 * - Use Mongoose or native MongoDB validation
 * 
 * Seeding Strategy:
 * - Seed files in ./seeds/ provide initial data for development
 * - Seeds should be idempotent (safe to run multiple times)
 * - Production seeding should be controlled and versioned
 * 
 * Usage Examples:
 * ```typescript
 * // Import schemas
 * import { PlayerSchema, ClanSchema } from '@/lib/db';
 * 
 * // Import seed utilities
 * import { seedPlayers, seedClans } from '@/lib/db';
 * 
 * // Run seeds (development only)
 * await seedPlayers();
 * await seedClans();
 * ```
 * 
 * Best Practices:
 * - Keep schemas in sync with TypeScript types
 * - Use schema validation for data integrity
 * - Version seed data for reproducible development environments
 * - Never run seeds in production without explicit approval
 */

// ============================================================================
// END OF FILE
// ============================================================================
