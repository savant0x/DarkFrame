/**
 * @file lib/errors/responses.ts
 * @created 2025-10-24 (FID-20251024-PROD: Production Readiness)
 * @overview Error response utilities for API routes
 * 
 * OVERVIEW:
 * Centralized error response creation with consistent structure, status codes,
 * and sanitization. Prevents information leakage in production while providing
 * detailed errors in development.
 * 
 * FEATURES:
 * - Structured error responses with codes and messages
 * - Automatic status code mapping
 * - Production error sanitization (no stack traces)
 * - Development-friendly error details
 * - Zod validation error formatting
 * - Type-safe error responses
 * 
 * USAGE:
 * import { createErrorResponse, ErrorCode } from '@/lib/errors';
 * 
 * return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
 *   required: 500,
 *   available: 250
 * });
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ErrorCode, ErrorStatusCodes, ErrorMessages } from './codes';

/**
 * Structured error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    stack?: string; // Only in development
    timestamp?: string;
  };
}

/**
 * Creates a standardized error response with appropriate status code
 * 
 * @param code - Error code from ErrorCode enum
 * @param details - Optional additional details (sanitized in production)
 * @param customMessage - Optional custom message (overrides default)
 * @returns NextResponse with error payload
 * 
 * @example
 * return createErrorResponse(ErrorCode.INSUFFICIENT_METAL, {
 *   required: 500,
 *   available: 250
 * });
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: unknown,
  customMessage?: string
): NextResponse<ErrorResponse> {
  const status = ErrorStatusCodes[code] || 500;
  const message = customMessage || ErrorMessages[code] || 'An error occurred';
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
  };

  // Include details only in development or for client errors (4xx)
  if (details && (isDevelopment || status < 500)) {
    response.error.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Creates error response from caught Error object
 * Sanitizes internal errors in production
 * 
 * @param error - Caught error object
 * @param fallbackCode - Error code to use if error is generic
 * @returns NextResponse with error payload
 * 
 * @example
 * try {
 *   await db.collection('players').findOne({ username });
 * } catch (error) {
 *   return createErrorFromException(error, ErrorCode.DATABASE_ERROR);
 * }
 */
export function createErrorFromException(
  error: unknown,
  fallbackCode: ErrorCode = ErrorCode.INTERNAL_ERROR
): NextResponse<ErrorResponse> {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return createValidationErrorResponse(error);
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: fallbackCode,
        message: isDevelopment
          ? error.message
          : ErrorMessages[fallbackCode] || 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
    };

    // Include stack trace only in development
    if (isDevelopment && error.stack) {
      response.error.stack = error.stack;
    }

    const status = ErrorStatusCodes[fallbackCode] || 500;
    return NextResponse.json(response, { status });
  }

  // Handle unknown error types
  return createErrorResponse(
    fallbackCode,
    isDevelopment ? { error: String(error) } : undefined
  );
}

/**
 * Creates error response from Zod validation error
 * Formats validation issues in user-friendly way
 * 
 * @param error - Zod validation error
 * @returns NextResponse with formatted validation errors
 * 
 * @example
 * const result = LoginSchema.safeParse(body);
 * if (!result.success) {
 *   return createValidationErrorResponse(result.error);
 * }
 */
export function createValidationErrorResponse(
  error: ZodError
): NextResponse<ErrorResponse> {
  const formattedErrors = error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

  const response: ErrorResponse = {
    success: false,
    error: {
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Validation failed',
      details: { errors: formattedErrors },
      timestamp: new Date().toISOString(),
    },
  };

  return NextResponse.json(response, { status: 400 });
}

/**
 * Creates unauthorized error response
 * Commonly used in authentication middleware
 * 
 * @param message - Optional custom message
 * @returns NextResponse with 401 status
 * 
 * @example
 * if (!token) {
 *   return createUnauthorizedResponse('Please log in');
 * }
 */
export function createUnauthorizedResponse(
  message?: string
): NextResponse<ErrorResponse> {
  return createErrorResponse(
    ErrorCode.AUTH_UNAUTHORIZED,
    undefined,
    message
  );
}

/**
 * Creates forbidden error response
 * Used when user lacks permissions
 * 
 * @param message - Optional custom message
 * @returns NextResponse with 403 status
 * 
 * @example
 * if (!isAdmin) {
 *   return createForbiddenResponse('Admin access required');
 * }
 */
export function createForbiddenResponse(
  message?: string
): NextResponse<ErrorResponse> {
  return createErrorResponse(
    ErrorCode.AUTH_FORBIDDEN,
    undefined,
    message
  );
}

/**
 * Creates rate limit exceeded error response
 * Used by rate limiting middleware
 * 
 * @param retryAfter - Seconds until next request allowed
 * @returns NextResponse with 429 status
 * 
 * @example
 * if (isRateLimited) {
 *   return createRateLimitResponse(60);
 * }
 */
export function createRateLimitResponse(
  retryAfter?: number
): NextResponse<ErrorResponse> {
  const response = createErrorResponse(
    ErrorCode.RATE_LIMIT_EXCEEDED,
    retryAfter ? { retryAfter } : undefined
  );

  // Add Retry-After header
  if (retryAfter) {
    response.headers.set('Retry-After', String(retryAfter));
  }

  return response;
}

/**
 * Creates not found error response
 * Used when resource doesn't exist
 * 
 * @param resource - Type of resource not found
 * @returns NextResponse with 404 status
 * 
 * @example
 * if (!player) {
 *   return createNotFoundResponse('Player');
 * }
 */
export function createNotFoundResponse(
  resource?: string
): NextResponse<ErrorResponse> {
  return createErrorResponse(
    ErrorCode.NOT_FOUND,
    resource ? { resource } : undefined,
    resource ? `${resource} not found` : undefined
  );
}

/**
 * Type guard to check if response is an error
 * Useful for middleware and error boundary handling
 * 
 * @param response - Response to check
 * @returns True if response is an error response
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'error' in response
  );
}

/**
 * FOOTER:
 * These error response utilities ensure consistent error handling across
 * all API routes. They automatically:
 * - Map error codes to HTTP status codes
 * - Sanitize errors in production (no stack traces, no internal details)
 * - Format validation errors in user-friendly way
 * - Add appropriate headers (Retry-After for rate limits)
 * - Include timestamps for debugging
 * 
 * Always use these utilities instead of manual NextResponse.json() for errors.
 * This ensures consistency and prevents accidental information leakage.
 */
