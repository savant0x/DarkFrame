/**
 * Common Utilities Barrel Export
 * Created: 2025-10-26
 * Feature: FID-20251026-001 (ECHO Compliance Refactor)
 * 
 * OVERVIEW:
 * Central export point for common utilities shared across multiple services.
 * Provides error classes and other shared utilities to prevent code duplication.
 * 
 * EXPORTED MODULES:
 * - errors: Custom error classes (ValidationError, NotFoundError, PermissionError)
 * 
 * USAGE:
 * @example
 * // Import specific errors
 * import { ValidationError, NotFoundError } from '@/lib/common';
 * 
 * // Or import all
 * import * as CommonErrors from '@/lib/common';
 * throw new CommonErrors.ValidationError('Invalid input');
 */

// Error classes
export * from './errors';

// Future common utilities can be added here:
// export * from './validators';
// export * from './formatters';
// export * from './constants';
