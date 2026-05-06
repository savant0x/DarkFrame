/**
 * @file lib/clientLogger.ts
 * @created 2025-10-24
 * @overview Client-side safe error logging utilities
 * 
 * OVERVIEW:
 * Provides safe logging functions for browser console that properly
 * serialize error objects to avoid "[object Object]" display issues.
 */

/**
 * Safely log an error to the console
 * Handles Error objects, unknown types, and prevents [object Object] display
 */
export function logError(message: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`❌ ${message}:`, {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
  } else if (typeof error === 'object' && error !== null) {
    console.error(`❌ ${message}:`, JSON.stringify(error, null, 2));
  } else {
    console.error(`❌ ${message}:`, String(error));
  }
}

/**
 * Safely log a warning to the console
 */
export function logWarn(message: string, data?: unknown): void {
  if (data !== undefined) {
    if (typeof data === 'object' && data !== null) {
      console.warn(`⚠️ ${message}:`, JSON.stringify(data, null, 2));
    } else {
      console.warn(`⚠️ ${message}:`, data);
    }
  } else {
    console.warn(`⚠️ ${message}`);
  }
}

/**
 * Safely log debug information to the console
 */
export function logDebug(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    if (data !== undefined) {
      if (typeof data === 'object' && data !== null) {
        console.log(`🔍 ${message}:`, data);
      } else {
        console.log(`🔍 ${message}:`, data);
      }
    } else {
      console.log(`🔍 ${message}`);
    }
  }
}
