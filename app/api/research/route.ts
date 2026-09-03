// ============================================================
// FILE: app/api/research/route.ts
// CREATED: 2025-01-18
// LAST MODIFIED: 2025-10-18
// ============================================================
// OVERVIEW:
// API endpoint for researching technologies. Handles starting research,
// checking prerequisites, deducting costs, and updating player's
// unlocked technologies.
// Protected by middleware - authentication is handled at the middleware level.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import type { Player } from '@/types/game.types';
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

// ============================================================
// TECHNOLOGY DEFINITIONS
// ============================================================

interface Technology {
  id: string;
  name: string;
  cost: number;
  prerequisites: string[];
}

const TECHNOLOGIES: Record<string, Technology> = {
  'troop-transport': {
    id: 'troop-transport',
    name: 'Troop Transport',
    cost: 10000,
    prerequisites: [],
  },
  'advanced-mining': {
    id: 'advanced-mining',
    name: 'Advanced Mining',
    cost: 5000,
    prerequisites: [],
  },
  'fortification': {
    id: 'fortification',
    name: 'Fortification',
    cost: 8000,
    prerequisites: [],
  },
  'tactical-warfare': {
    id: 'tactical-warfare',
    name: 'Tactical Warfare',
    cost: 12000,
    prerequisites: ['fortification'],
  },
  'factory-automation': {
    id: 'factory-automation',
    name: 'Factory Automation',
    cost: 15000,
    prerequisites: ['advanced-mining'],
  },
  'reconnaissance': {
    id: 'reconnaissance',
    name: 'Reconnaissance',
    cost: 6000,
    prerequisites: [],
  },
};

// ============================================================
// POST HANDLER
// ============================================================

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * POST /api/research
 * 
 * Start researching a technology
 * 
 * Request Body:
 * - technologyId: string - ID of technology to research
 * - username: string - Player username
 * 
 * Response:
 * - success: boolean
 * - message: string
 * - player: updated player object (if successful)
 * 
 * Note: Authentication handled by Next.js middleware
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ResearchAPI');
  const endTimer = log.time('research');

  try {
    const body = await request.json();
    const validated = ResearchTechSchema.parse(body);

    log.debug('Research request', { 
      username: validated.username, 
      technologyId: validated.technologyId 
    });

    // Validate technology exists
    const technology = TECHNOLOGIES[validated.technologyId];
    if (!technology) {
      log.warn('Invalid technology ID', { technologyId: validated.technologyId });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Invalid technology ID'
      });
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db('darkframe');
    const playersCollection = db.collection<Player & { unlockedTechnologies?: string[]; gold?: number }>('players');

    // Fetch player by username
    const player = await playersCollection.findOne({
      username: validated.username,
    });

    if (!player) {
      log.warn('Player not found', { username: validated.username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Player not found'
      });
    }

    // Initialize technologies array if it doesn't exist
    const unlockedTechnologies = player.unlockedTechnologies || [];

    // Check if already unlocked
    if (unlockedTechnologies.includes(validated.technologyId)) {
      log.debug('Technology already unlocked', { 
        username: validated.username, 
        technologyId: validated.technologyId 
      });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Technology already unlocked'
      });
    }

    // Check prerequisites
    for (const prereqId of technology.prerequisites) {
      if (!unlockedTechnologies.includes(prereqId)) {
        const prereq = TECHNOLOGIES[prereqId];
        log.debug('Prerequisite not met', { 
          username: validated.username,
          required: prereqId,
          name: prereq?.name 
        });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: `Prerequisite not met: ${prereq?.name || prereqId}`
        });
      }
    }

    // Check if player has enough gold
    if ((player.gold ?? 0) < technology.cost) {
      log.debug('Insufficient gold', { 
        username: validated.username,
        required: technology.cost,
        available: player.gold 
      });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: `Insufficient gold. Required: ${technology.cost}, Available: ${player.gold ?? 0}`
      });
    }

    // Deduct gold and unlock technology atomically
    const updateResult = await playersCollection.updateOne(
      { username: validated.username },
      {
        $inc: { gold: -technology.cost },
        $push: { unlockedTechnologies: validated.technologyId },
        $set: { lastUpdated: new Date() },
      }
    );

    if (updateResult.modifiedCount === 0) {
      log.error('Failed to update player', new Error('Database update failed'), {
        username: validated.username,
        technologyId: validated.technologyId
      });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to update player'
      });
    }

    // Fetch updated player
    const updatedPlayer = await playersCollection.findOne({
      username: validated.username,
    });

    log.info('Technology researched successfully', { 
      username: validated.username,
      technology: technology.name,
      cost: technology.cost
    });

    return NextResponse.json({
      success: true,
      message: `Successfully researched ${technology.name}`,
      player: updatedPlayer,
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
 * Get player's unlocked technologies
 * 
 * Query Parameters:
 * - username: string - Player username
 * 
 * Response:
 * - success: boolean
 * - unlockedTechnologies: string[] - Array of unlocked technology IDs
 * 
 * Note: Authentication handled by Next.js middleware
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication is handled by middleware - no need to check here

    // Get username from query parameters
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    // Connect to database
    const client = await clientPromise;
    const db = client.db('darkframe');
    const playersCollection = db.collection<Player & { unlockedTechnologies?: string[]; gold?: number }>('players');

    // Fetch player by username
    const player = await playersCollection.findOne(
      { username: username },
      { projection: { unlockedTechnologies: 1 } }
    );

    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      unlockedTechnologies: player.unlockedTechnologies || [],
    });
  } catch (error) {
    console.error('❌ Research GET API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch technologies' },
      { status: 500 }
    );
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - POST: Research a technology (deduct gold, check prerequisites, unlock)
// - GET: Retrieve player's unlocked technologies
// - Validates prerequisites before allowing research
// - Deducts gold cost from player balance
// - Adds technology to unlockedTechnologies array
// - Technologies stored as array of IDs in player document
// - Troop Transport enables fast travel (5 spaces movement)
// - Future: Add research time/queue system
// ============================================================
// END OF FILE
// ============================================================
