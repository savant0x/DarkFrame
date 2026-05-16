/**
 * Chat Item Link API
 * Validates if an item exists in the game for chat item linking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { UNIT_CONFIGS } from '@/types';

const rateLimiter = createRateLimiter({ maxRequests: 50, windowMs: 60 * 1000, message: 'Too many item lookups. Please wait.' });

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ChatItemLinkAPI');
  try {
    const { searchParams } = request.nextUrl;
    const itemName = searchParams.get('itemName');

    if (!itemName) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'itemName is required' });
    }

    const unitConfig = UNIT_CONFIGS[itemName as keyof typeof UNIT_CONFIGS];
    if (unitConfig) {
      return NextResponse.json({
        exists: true,
        item: {
          id: itemName,
          name: itemName,
          type: 'unit',
          rarity: 'common',
          description: `${unitConfig.strength} STR / ${unitConfig.defense} DEF`,
        },
      });
    }

    return NextResponse.json({ exists: false, itemName });
  } catch (error) {
    log.error('Error validating item', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
