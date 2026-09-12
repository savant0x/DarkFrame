// ============================================================
// FILE: app/api/research/route.ts
// CREATED: 2025-01-18
// LAST MODIFIED: 2026-09-09 (FID-20260909-029 §2.2: Mongo-zombie migration —
//   the route previously ran through the Mongo compat seam spending a phantom
//   `gold` field and writing a phantom `unlockedTechnologies` array, so every
//   unlock failed "Insufficient gold" and no unlock ever persisted. Now:
//   Drizzle/Postgres, RP via the audited spendResearchPoints (the same
//   currency WMD research spends, per docs/CHANGELOG_RP_OVERHAUL.md), and the
//   real players.unlockedTechs jsonb column. Session identity enforced on GET
//   (query username no longer trusted). logTechUnlock telemetry wired.)
// ============================================================
// OVERVIEW:
// API endpoint for researching technologies. Handles starting research,
// checking prerequisites, deducting RP costs, and updating player's
// unlocked technologies.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { spendResearchPoints } from '@/lib/xpService';
import { logTechUnlock } from '@/lib/activityLogger';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  ResearchTechSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';
// FID-20260912-058 T1: the route previously hard-coded a 6-entry map of
// effectless techs while the UI advertised six functional bot techs this
// route rejected. Both sides now consume the single shared catalog.
import { TECH_CATALOG, TECH_CATALOG_BY_ID } from '@/lib/research/techCatalog';

// ============================================================
// TECHNOLOGY DEFINITIONS
// (T2 repricing per FID-20260912-058; every entry has a real effect
//  consumer — see lib/research/techCatalog.ts for the consumer map.)
// ============================================================

// ============================================================
// POST HANDLER
// ============================================================

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * POST /api/research
 *
 * Research (unlock) a technology for the authenticated player.
 *
 * The route also exposes the shared catalog on GET so the Tech Tree UI can
 * render exactly what the server will sell (T1 — no more mock divergence).
 * GET response additionally carries `catalog` and `catalogTotalRp`.
 *
 * Request Body:
 * - technologyId: string - ID of technology to research
 *
 * Response:
 * - success: boolean
 * - message: string
 * - researchPoints: number - RP balance after the spend (if successful)
 * - technology: { id, name }
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ResearchAPI');
  const endTimer = log.time('research');

  try {
    // FID-20260904-005 §5.1: session identity — body username ignored.
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }
    const username = authUser.username;

    const body = await request.json();
    const validated = ResearchTechSchema.parse(body);

    log.debug('Research request', {
      username,
      technologyId: validated.technologyId
    });

    // Validate technology exists
    const technology = TECH_CATALOG_BY_ID.get(validated.technologyId);
    if (!technology) {
      log.warn('Invalid technology ID', { technologyId: validated.technologyId });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Invalid technology ID'
      });
    }

    // Fetch the player's unlock state (Postgres)
    const playerRows = await db
      .select({ unlockedTechs: players.unlockedTechs })
      .from(players)
      .where(eq(players.username, username))
      .limit(1);

    if (playerRows.length === 0) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Player not found'
      });
    }

    const unlockedTechnologies = playerRows[0].unlockedTechs ?? [];

    // Check if already unlocked
    if (unlockedTechnologies.includes(validated.technologyId)) {
      log.debug('Technology already unlocked', {
        username,
        technologyId: validated.technologyId
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Technology already unlocked'
      });
    }

    // Check prerequisites
    for (const prereqId of technology.prerequisites) {
      if (!unlockedTechnologies.includes(prereqId)) {
        const prereq = TECH_CATALOG_BY_ID.get(prereqId);
        log.debug('Prerequisite not met', {
          username,
          required: prereqId,
          name: prereq?.name
        });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: `Prerequisite not met: ${prereq?.name || prereqId}`
        });
      }
    }

    // Spend RP via the audited economy service (same currency and path as
    // WMD research). Refuses with a message when the balance is short.
    const spend = await spendResearchPoints(
      username,
      technology.cost,
      `Technology research: ${technology.name}`
    );

    if (!spend.success) {
      log.debug('Insufficient RP', {
        username,
        required: technology.cost,
        message: spend.message
      });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: spend.message
      });
    }

    // Persist the unlock onto the real column
    const updatedTechs = [...unlockedTechnologies, validated.technologyId];
    await db
      .update(players)
      .set({ unlockedTechs: updatedTechs })
      .where(eq(players.username, username));

    // Anti-cheat telemetry (FID-20260909-029 §2.4): this logger previously
    // had zero call sites. Logging failures are swallowed by the logger.
    const sessionId = request.cookies.get('sessionId')?.value || 'unknown';
    await logTechUnlock(username, sessionId, technology.id, {
      metal: 0,
      energy: 0
    });

    log.info('Technology researched successfully', {
      username,
      technology: technology.name,
      cost: technology.cost,
      newBalance: spend.newBalance
    });

    return NextResponse.json({
      success: true,
      message: `Successfully researched ${technology.name}`,
      researchPoints: spend.newBalance,
      technology: {
        id: technology.id,
        name: technology.name,
      },
    });

  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Research validation failed', { issues: error.issues });
      return createValidationErrorResponse(error);
    }

    log.error('Research error', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// GET HANDLER
// ============================================================

/**
 * GET /api/research
 *
 * Get the authenticated player's unlocked technologies.
 *
 * Response:
 * - success: boolean
 * - unlockedTechnologies: string[] - Array of unlocked technology IDs
 *   (wire key kept for consumer compatibility)
 */
export async function GET() {
  try {
    // Session identity — the query-string username is no longer trusted
    // (FID-20260904-005 §5.1 pattern).
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rows = await db
      .select({ unlockedTechs: players.unlockedTechs })
      .from(players)
      .where(eq(players.username, authUser.username))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      unlockedTechnologies: rows[0].unlockedTechs ?? [],
      // FID-20260912-058 T1: the server is the single source of truth for the
      // tree — the UI renders this catalog instead of its own mock.
      catalog: TECH_CATALOG,
      catalogTotalRp: TECH_CATALOG.reduce((sum, tech) => sum + tech.cost, 0),
    });
  } catch (error) {
    console.error('Research GET API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch technologies' },
      { status: 500 }
    );
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - POST: Research a technology (check prerequisites, spend RP, unlock)
// - GET: Retrieve the authenticated player's unlocked technologies
// - RP is the research currency (docs/CHANGELOG_RP_OVERHAUL.md); the WMD
//   research system shares it via the same spendResearchPoints service
// - Technologies persist on players.unlockedTechs (jsonb, migration-free)
// - Troop Transport enables fast travel (5 spaces movement)
// - Future: Add research time/queue system
// ============================================================
// END OF FILE
// ============================================================
