/**
 * @file app/api/clan/check-name/route.ts
 * @created 2025-10-19
 * @overview API endpoint for checking clan name availability
 * 
 * OVERVIEW:
 * Quick validation endpoint to check if a clan name is already taken.
 * Used by CreateClanModal for real-time feedback during name entry.
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 1.2 - Clan Creation & Join Modals
 * - Case-insensitive name checking
 * - Returns { available: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan-check-name');
  const endTimer = log.time('check-name');
  try {
    // Extract name from query parameters
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: 'Clan name is required' },
        { status: 400 }
      );
    }

    // Validate name format
    if (name.length < 3 || name.length > 30) {
      return NextResponse.json(
        { available: false, error: 'Name must be 3-30 characters' },
        { status: 200 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db('darkframe');
    const clansCollection = db.collection('clans');

    // Check if clan exists (case-insensitive)
    const existingClan = await clansCollection.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    log.info('Clan name checked', { name, available: !existingClan });
    return NextResponse.json({
      available: !existingClan,
      name
    });

  } catch (error: any) {
    log.error('Failed to check clan name', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * IMPLEMENTATION NOTES:
 * - Returns 200 OK even when name is taken (not an error condition)
 * - Case-insensitive regex matching prevents duplicates with different casing
 * - Called multiple times during typing, so kept lightweight
 * - No authentication required (public information)
 * 
 * USAGE EXAMPLE:
 * GET /api/clan/check-name?name=DarkForce
 * Response: { "available": true, "name": "DarkForce" }
 * 
 * FUTURE ENHANCEMENTS:
 * - Rate limiting to prevent abuse
 * - Profanity filter integration
 * - Reserved name checking (admin clans, etc.)
 */
