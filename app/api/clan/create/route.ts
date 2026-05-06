/**
 * @file app/api/clan/create/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Clan creation endpoint. Allows players to create new clans with unique names and tags.
 * Validates naming rules, checks resource balance, and deducts creation cost.
 * 
 * ROUTES:
 * - POST /api/clan/create - Create new clan
 * 
 * AUTHENTICATION:
 * - Requires valid JWT token in 'token' cookie
 * - Uses requireAuth() middleware
 * 
 * BUSINESS RULES:
 * - Player must not already be in a clan
 * - Clan name: 3-30 characters
 * - Clan tag: 2-4 uppercase alphanumeric characters
 * - Creation cost: 1.5M Metal + 1.5M Energy
 * - Player becomes clan leader automatically
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  requireAuth,
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  CreateClanSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { createClan } from '@/lib/clanService';
import { CLAN_NAMING_RULES } from '@/types/clan.types';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.clanCreate);

/**
 * POST /api/clan/create
 * Create a new clan
 * 
 * @param request - NextRequest with authentication cookie and clan data in body
 * @returns NextResponse with created clan data
 * 
 * @example
 * POST /api/clan/create
 * Body: { name: "Elite Warriors", tag: "EW", description: "Best clan" }
 * Response: { success: true, clan: {...}, message: "Clan EW created successfully!" }
 * 
 * @throws {400} Clan name and tag required
 * @throws {400} Invalid name/tag length or format
 * @throws {400} Already in a clan
 * @throws {400} Insufficient resources
 * @throws {401} Unauthorized
 * @throws {409} Name or tag already exists
 * @throws {500} Failed to create clan
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ClanCreateAPI');
  const endTimer = log.time('clanCreate');
  
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      log.warn('Unauthenticated clan creation attempt');
      return auth;
    }

    const body = await request.json();
    const validated = CreateClanSchema.parse(body);

    const tag = validated.tag
      ? validated.tag.toUpperCase().trim()
      : validated.name
          .replace(/[^a-zA-Z ]/g, '')
          .split(' ')
          .filter(w => w.length > 0)
          .map(w => w[0].toUpperCase())
          .join('')
          .slice(0, 5) || validated.name.substring(0, 5).toUpperCase();

    log.debug('Creating clan', { 
      playerId: auth.playerId, 
      name: validated.name,
      tag,
    });

    const clan = await createClan(
      auth.playerId,
      validated.name.trim(),
      tag,
      validated.description?.trim() || '',
      validated.isPublic ?? false,
      validated.minLevel ?? 1,
    );

    log.info('Clan created successfully', { 
      playerId: auth.playerId,
      clanId: clan.id,
      clanName: clan.name,
      clanTag: clan.tag
    });

    return NextResponse.json({
      success: true,
      clan,
      message: `Clan ${clan.tag} created successfully!`,
    });

  } catch (error: any) {
    if (error instanceof ZodError) {
      log.warn('Clan creation validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Clan creation error', error instanceof Error ? error : new Error(String(error)));

    // Handle specific errors
    if (error.message?.includes('already exists')) {
      return createErrorResponse(ErrorCode.CLAN_NAME_TAKEN, { 
        message: error.message 
      });
    }

    if (error.message?.includes('already in a clan')) {
      return createErrorResponse(ErrorCode.CLAN_ALREADY_MEMBER, {
        message: 'You are already in a clan'
      });
    }

    if (error.message?.includes('Insufficient')) {
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, { 
        message: error.message 
      });
    }

    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
