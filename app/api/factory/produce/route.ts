/**
 * @file app/api/factory/produce/route.ts
 * @created 2025-01-17
 * @updated 2026-05-11 — FID-20260511-FACTORY-UNIT-REDESIGN
 * @overview API endpoint for producing units at player-owned factories
 *
 * FID-20260511-FACTORY-UNIT-REDESIGN: Replaced produceUnit with buildUnitsAtFactory.
 * Now uses UNIT_CONFIGS for proper costs, slot consumption, and archetype support.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildUnitsAtFactory } from '@/lib/factoryService';
import { UNIT_CONFIGS, UnitType } from '@/types';
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
 * Produces units at a player-owned factory
 *
 * @body {string} username - Player producing the unit
 * @body {number} x - Factory X coordinate
 * @body {number} y - Factory Y coordinate
 * @body {string} [unitType] - Unit type to build (defaults to first available)
 * @body {number} [quantity] - Number of units to build (defaults to 1)
 * @returns {Object} success: boolean, message: string, units?: Unit[]
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('FactoryProduceAPI');
  const endTimer = log.time('buildUnitsAtFactory');

  try {
    const body = await request.json();
    const validated = FactoryProduceSchema.parse(body);

    log.debug('Factory produce request', {
      username: validated.username,
      x: validated.x,
      y: validated.y,
      unitType: validated.unitType,
      quantity: validated.quantity,
    });

    const unitType = (validated.unitType as UnitType) || Object.keys(UNIT_CONFIGS)[0] as UnitType;
    const quantity = validated.quantity || 1;

    const result = await buildUnitsAtFactory(
      validated.username,
      validated.x,
      validated.y,
      [{ unitType, quantity }]
    );

    if (!result.success) {
      log.warn('Factory production failed', {
        username: validated.username,
        reason: result.message,
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: result.message,
      });
    }

    log.info('Units produced successfully', {
      username: validated.username,
      factoryLocation: `(${validated.x}, ${validated.y})`,
      unitType,
      quantity,
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
