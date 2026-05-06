/**
 * @file lib/wmd/admin/index.ts
 * @created 2025-10-26
 * @updated 2025-10-26 (FID-20251026-001: Full ECHO Architecture Compliance)
 * @overview WMD Admin Services - Barrel Export
 * 
 * OVERVIEW:
 * Administrative services for WMD system monitoring, analytics, and alerts.
 * Provides tools for admins to track WMD activity, analyze patterns, and
 * manage system-wide alerts.
 * 
 * Usage:
 * ```typescript
 * import { analyzeWMDActivity, sendWMDAlert } from '@/lib/wmd/admin';
 * ```
 */

// ============================================================================
// ADMIN SERVICES
// ============================================================================

// WMD activity analytics (usage patterns, statistics)
export * from './wmdAnalyticsService';

// Admin operations (moderation, system management)
export * from './wmdAdminService';

// Alert system (critical events, admin notifications)
export * from './alertService';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * Security:
 * - All admin services should be protected by requireAdmin middleware
 * - Analytics data should be sanitized before display
 * - Alert system should have rate limiting
 * 
 * Usage Example:
 * ```typescript
 * // In admin dashboard
 * import { analyzeWMDActivity, sendWMDAlert } from '@/lib/wmd/admin';
 * 
 * const analytics = await analyzeWMDActivity(dateRange);
 * await sendWMDAlert('Critical WMD activity detected', { priority: 'HIGH' });
 * ```
 */

// ============================================================================
// END OF FILE
// ============================================================================
