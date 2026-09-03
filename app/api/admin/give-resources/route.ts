/**
 * Give Resources Admin Endpoint
 * 
 * Created: 2025-01-18
 * 
 * Allows admins to give metal/energy to any player.
 * NOTE: adminLogs table does not exist in Drizzle schema - audit logging skipped.
 * 
 * POST /api/admin/give-resources
 * Body: { username, metal, energy }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authService';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  GiveResourcesSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminGiveResourcesAPI');
  const endTimer = log.time('giveResources');

  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser || !adminUser.rank || adminUser.rank < 5) {
      log.warn('Unauthorized admin access attempt', { username: adminUser?.username });
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Admin access required (rank 5+)'
      });
    }

    const body = await request.json();
    const validated = GiveResourcesSchema.parse(body);

    log.debug('Give resources request', { 
      username: validated.username, 
      metal: validated.metal, 
      energy: validated.energy,
      adminUsername: adminUser.username
    });

    const playerRecord = await db.select().from(players).where(eq(players.username, validated.username)).limit(1);
    if (!playerRecord || playerRecord.length === 0) {
      log.warn('Player not found for resource grant', { username: validated.username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Player not found'
      });
    }

    const player = playerRecord[0];
    const previousMetal = Number(player.resourcesMetal || 0n);
    const previousEnergy = Number(player.resourcesEnergy || 0n);

    await db.update(players)
      .set({
        resourcesMetal: Number(BigInt(previousMetal + validated.metal)),
        resourcesEnergy: Number(BigInt(previousEnergy + validated.energy))
      })
      .where(eq(players.username, validated.username));

    // NOTE: adminLogs table does not exist in Drizzle schema
    // Audit logging skipped - consider adding an adminLogs table if needed
    // await db.insert(adminLogs).values({ ... });

    const newResources = {
      metal: previousMetal + validated.metal,
      energy: previousEnergy + validated.energy
    };

    log.info('Resources granted successfully', { 
      username: validated.username,
      granted: { metal: validated.metal, energy: validated.energy },
      newTotals: newResources,
      adminUsername: adminUser.username
    });

    return NextResponse.json({
      success: true,
      message: `Gave ${validated.metal} metal and ${validated.energy} energy to ${validated.username}`,
      newResources
    });

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Give resources validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Error giving resources', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
