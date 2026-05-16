/**
 * @file lib/logger.ts
 * @created 2025-10-17
 * @overview Standardized logging service for development and production
 * 
 * OVERVIEW:
 * Centralized logging utility that respects environment context.
 * Debug logs only appear in development mode, while errors and
 * warnings are logged in all environments.
 * 
 * Features:
 * - Environment-aware logging (dev vs production)
 * - Consistent formatting with icons
 * - Type-safe log methods
 * - No console.log clutter in production
 */

/**
 * Determine if running in development mode
 */
const isDev = process.env.NODE_ENV === 'development';

/**
 * Fields that may contain PII and should be redacted in production logs
 */
const PII_FIELDS = ['email', 'password', 'token', 'session_id', 'stripe_customer_id', 'ip_address', 'phone'];

/**
 * Redact PII fields from an object for production-safe logging
 */
function redactPII(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(redactPII);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (PII_FIELDS.some(field => lowerKey.includes(field))) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      result[key] = redactPII(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Standardized logger service
 * 
 * Methods:
 * - debug: Development-only logs for debugging
 * - info: Informational logs (dev only)
 * - warn: Warnings (all environments)
 * - error: Errors (all environments)
 * 
 * @example
 * import { logger } from '@/lib/logger';
 * 
 * logger.debug('TileRenderer: Loading tile', { terrain, coords });
 * logger.error('Failed to build unit', error);
 */
export const logger = {
  /**
   * Debug logging (development only)
   * Use for detailed debugging information
   * 
   * @param message - Log message
   * @param data - Optional additional data to log
   * 
   * @example
   * logger.debug('Player data loaded', { username, level });
   */
  debug: (message: string, data?: unknown): void => {
    if (isDev) {
      console.log(`🔍 ${message}`, data !== undefined ? data : '');
    }
  },

  /**
   * Info logging (suppressed — use debug for dev, warn/error for all)
   */
  info: (_message: string, _data?: unknown): void => {
    // Info logs suppressed to keep terminal output clean.
    // Only warnings and errors are printed.
  },

  /**
   * Warning logging (all environments)
   * Use for recoverable errors or unexpected states
   * 
   * @param message - Warning message
   * @param data - Optional additional data to log
   * 
   * @example
   * logger.warn('Harvest cooldown active', { timeRemaining });
   */
  warn: (message: string, data?: unknown): void => {
    console.warn(`⚠️  ${message}`, isDev ? data : redactPII(data));
  },

  /**
   * Error logging (all environments)
   * Use for exceptions and failures
   * PII is redacted in production logs
   */
  error: (message: string, error?: unknown): void => {
    if (error instanceof Error) {
      console.error(`❌ ${message}`, {
        message: error.message,
        stack: isDev ? error.stack : '[HIDDEN]',
        name: error.name
      });
    } else if (error !== undefined) {
      console.error(`❌ ${message}`, isDev ? error : redactPII(error));
    } else {
      console.error(`❌ ${message}`);
    }
  },

  /**
   * Success logging (development only)
   * Use for completed operations
   * 
   * @param message - Success message
   * @param data - Optional additional data to log
   * 
   * @example
   * logger.success('Unit built successfully', { unitType, quantity });
   */
  success: (message: string, data?: unknown): void => {
    if (isDev) {
      console.log(`✅ ${message}`, data !== undefined ? data : '');
    }
  },
};

// ============================================================
// END OF FILE
// Implementation Notes:
// - isDev check prevents debug/info logs in production
// - Error/warn always logged for monitoring
// - Consistent icon prefix for easy scanning
// - Type-safe with TypeScript
// - Zero runtime cost in production (tree-shaken)
// - Replace all console.log with logger.debug
// - Replace all console.error with logger.error
// ============================================================
