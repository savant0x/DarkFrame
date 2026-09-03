/**
 * @file app/api/factory/produce/route.ts
 * @created 2025-01-17
 * @overview API endpoint for producing units at player-owned factories
 */

import { NextRequest, NextResponse } from 'next/server';
import { produceUnit } from '@/lib/factoryService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  FactoryProduceSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.factoryBuild);

/**
 * POST /api/factory/produce
 * Produces a unit at a player-owned factory
 * 
 * @body {string} username - Player producing the unit
 * @body {number} x - Factory X coordinate
 * @body {number} y - Factory Y coordinate
 * @returns {Object} success: boolean, message: string, unit?: Unit
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('FactoryProduceAPI');
  const endTimer = log.time('produceUnit');
  
  try {
    const body = await request.json();
    const validated = FactoryProduceSchema.parse(body);

    log.debug('Factory produce request', { 
      username: validated.username, 
      x: validated.x, 
      y: validated.y 
    });

    // Produce unit
    const result = await produceUnit(validated.username, validated.x, validated.y);
    
    if (!result.success) {
      log.warn('Factory production failed', { 
        username: validated.username, 
        reason: result.message 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { 
        message: result.message 
      });
    }

    log.info('Unit produced successfully', { 
      username: validated.username, 
      factoryLocation: `(${validated.x}, ${validated.y})` 
    });
    
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Factory produce validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Error producing unit', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// Implementation Notes:
// - Validates ownership through produceUnit service
// - Checks resource availability (100 Metal + 50 Energy)
// - Verifies factory has available slots
// - Creates SOLDIER unit with 50 power
// - Increments usedSlots counter
// ============================================================
