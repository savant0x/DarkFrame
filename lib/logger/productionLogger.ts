/**
 * @file lib/logger/productionLogger.ts
 * @created 2025-01-23 (FID-20251023-003: Phase 3.1 Structured Logging)
 * @overview Production-grade structured logging with request tracking
 * 
 * OVERVIEW:
 * Enhanced logging system for production environments with:
 * - Structured JSON output
 * - Request correlation IDs
 * - Log levels with filtering
 * - Performance metrics
 * - File rotation support (when configured)
 * 
 * FEATURES:
 * - Automatic request ID generation from headers
 * - Context preservation across async operations
 * - Performance timing utilities
 * - Error serialization with stack traces
 * - Configurable output formats
 * 
 * USAGE:
 * import { createLogger } from '@/lib/logger/productionLogger';
 * const logger = createLogger({ context: 'AuthService' });
 * logger.info('User authenticated', { userId, duration: 45 });
 */

import { AsyncLocalStorage } from 'async_hooks';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Request context stored in async local storage
 */
interface RequestContext {
  requestId: string;
  userId?: string;
  timestamp: number;
}

/**
 * Structured log entry
 */
interface LogEntry {
  level: string;
  timestamp: string;
  message: string;
  context?: string;
  requestId?: string;
  userId?: string;
  data?: unknown;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number;
    operation: string;
  };
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  context?: string;
  minLevel?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  prettyPrint?: boolean;
}

/**
 * Async local storage for request context
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get current log level from environment
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
  return LogLevel[level as keyof typeof LogLevel] ?? LogLevel.INFO;
}

/**
 * Format log entry as JSON or pretty-printed
 */
function formatLogEntry(entry: LogEntry, prettyPrint: boolean): string {
  if (prettyPrint) {
    const { level, timestamp, message, context, requestId, data } = entry;
    const contextStr = context ? `[${context}]` : '';
    const reqIdStr = requestId ? `(${requestId.slice(0, 8)})` : '';
    return `${timestamp} ${level.padEnd(5)} ${contextStr}${reqIdStr} ${message} ${data ? JSON.stringify(data) : ''}`;
  }
  return JSON.stringify(entry);
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Set request context for async operations
 */
export function setRequestContext(context: RequestContext): void {
  asyncLocalStorage.enterWith(context);
}

/**
 * Get current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Extract request ID from Next.js request headers
 */
export function getRequestIdFromHeaders(headers: Headers): string {
  return headers.get('x-request-id') || generateRequestId();
}

/**
 * Logger instance type
 */
export interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, error?: Error, data?: unknown) => void;
  fatal: (message: string, error?: Error, data?: unknown) => void;
  time: (operation: string) => () => void;
  child: (additionalContext: string) => Logger;
}

/**
 * Create logger instance with configuration
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  const {
    context,
    minLevel = getLogLevel(),
    enableConsole = true,
    enableFile = false,
    prettyPrint = process.env.NODE_ENV === 'development',
  } = config;

  /**
   * Internal log function
   */
  function log(level: LogLevel, message: string, data?: unknown, error?: Error) {
    // Skip if below minimum level
    if (level < minLevel) return;

    const ctx = getRequestContext();
    const entry: LogEntry = {
      level: LogLevel[level],
      timestamp: new Date().toISOString(),
      message,
      context,
      requestId: ctx?.requestId,
      userId: ctx?.userId,
    };

    if (data !== undefined) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    const formatted = formatLogEntry(entry, prettyPrint);

    // Console output
    if (enableConsole) {
      const logFn = level >= LogLevel.ERROR ? console.error : console.log;
      logFn(formatted);
    }

    // File output would be added here
    // if (enableFile) {
    //   writeToFile(formatted);
    // }
  }

  return {
    /**
     * Debug level logging - detailed information for debugging
     */
    debug: (message: string, data?: unknown) => {
      log(LogLevel.DEBUG, message, data);
    },

    /**
     * Info level logging - general informational messages
     */
    info: (message: string, data?: unknown) => {
      log(LogLevel.INFO, message, data);
    },

    /**
     * Warning level logging - potentially harmful situations
     */
    warn: (message: string, data?: unknown) => {
      log(LogLevel.WARN, message, data);
    },

    /**
     * Error level logging - error events that allow the application to continue
     */
    error: (message: string, error?: Error, data?: unknown) => {
      log(LogLevel.ERROR, message, data, error);
    },

    /**
     * Fatal level logging - severe errors that cause application to abort
     */
    fatal: (message: string, error?: Error, data?: unknown) => {
      log(LogLevel.FATAL, message, data, error);
    },

    /**
     * Performance timing helper
     */
    time: (operation: string): (() => void) => {
      const start = performance.now();
      return () => {
        const duration = performance.now() - start;
        log(LogLevel.DEBUG, `Performance: ${operation}`, { duration: Math.round(duration) });
      };
    },

    /**
     * Create child logger with additional context
     */
    child: (additionalContext: string): Logger => {
      return createLogger({
        ...config,
        context: context ? `${context}.${additionalContext}` : additionalContext,
      });
    },
  };
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Request logging middleware helper
 */
export function createRequestLogger(method: string, path: string) {
  const requestId = generateRequestId();
  setRequestContext({ requestId, timestamp: Date.now() });
  
  const log = createLogger({ context: 'API' });
  log.info(`${method} ${path}`, { requestId });

  return {
    requestId,
    end: (statusCode: number, duration?: number) => {
      log.info(`${method} ${path} ${statusCode}`, {
        requestId,
        statusCode,
        duration: duration ?? Date.now() - getRequestContext()!.timestamp,
      });
    },
    error: (error: Error, statusCode = 500) => {
      log.error(`${method} ${path} ${statusCode}`, error, { requestId, statusCode });
    },
  };
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
//
// Usage in API Routes:
// ```typescript
// import { createRequestLogger, getRequestIdFromHeaders } from '@/lib/logger/productionLogger';
//
// export async function GET(request: NextRequest) {
//   const reqLog = createRequestLogger('GET', '/api/player/stats');
//   try {
//     const data = await getPlayerStats();
//     reqLog.end(200);
//     return NextResponse.json(data);
//   } catch (error) {
//     reqLog.error(error as Error);
//     return NextResponse.json({ error: 'Failed' }, { status: 500 });
//   }
// }
// ```
//
// Usage in Services:
// ```typescript
// import { createLogger } from '@/lib/logger/productionLogger';
//
// const logger = createLogger({ context: 'PlayerService' });
//
// export async function updatePlayer(id: string, updates: Partial<Player>) {
//   const endTimer = logger.time('updatePlayer');
//   try {
//     logger.debug('Updating player', { id, updates });
//     const result = await db.update(id, updates);
//     logger.info('Player updated', { id });
//     return result;
//   } catch (error) {
//     logger.error('Failed to update player', error as Error, { id });
//     throw error;
//   } finally {
//     endTimer();
//   }
// }
// ```
//
// Environment Variables:
// - LOG_LEVEL: DEBUG | INFO | WARN | ERROR | FATAL (default: INFO)
// - NODE_ENV: development | production (affects pretty printing)
//
// Future Enhancements:
// - File rotation with winston-daily-rotate-file
// - Remote logging (Datadog, CloudWatch, etc.)
// - Log aggregation and search
// - Performance metrics export
// - Structured error codes
//
// ============================================================================
