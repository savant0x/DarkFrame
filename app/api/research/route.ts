/**
 * @file app/api/research/route.ts
 * @created 2025-01-18
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview API endpoint for researching technologies
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';
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

interface Technology {
  id: string;
  name: string;
  cost: number;
  prerequisites: string[];
}

const TECHNOLOGIES: Record<string, Technology> = {
  'troop-transport': { id: 'troop-transport', name: 'Troop Transport', cost: 10000, prerequisites: [] },
  'advanced-mining': { id: 'advanced-mining', name: 'Advanced Mining', cost: 5000, prerequisites: [] },
  'fortification': { id: 'fortification', name: 'Fortification', cost: 8000, prerequisites: [] },
  'tactical-warfare': { id: 'tactical-warfare', name: 'Tactical Warfare', cost: 12000, prerequisites: ['fortification'] },
  'factory-automation': { id: 'factory-automation', name: 'Factory Automation', cost: 15000, prerequisites: ['advanced-mining'] },
  'reconnaissance': { id: 'reconnaissance', name: 'Reconnaissance', cost: 6000, prerequisites: [] },
};

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ResearchAPI');
  const endTimer = log.time('research');

  try {
    const body = await request.json();
    const validated = ResearchTechSchema.parse(body);

    log.debug('Research request', { username: validated.username, technologyId: validated.technologyId });

    const technology = TECHNOLOGIES[validated.technologyId];
    if (!technology) {
      log.warn('Invalid technology ID', { technologyId: validated.technologyId });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Invalid technology ID' });
    }

    const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('unlocked_techs, research_points')
      .eq('username', validated.username)
      .maybeSingle();

    if (!player) {
      log.warn('Player not found', { username: validated.username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Player not found' });
    }

    const unlockedTechnologies: string[] = player.unlocked_techs || [];

    if (unlockedTechnologies.includes(validated.technologyId)) {
      log.debug('Technology already unlocked', { username: validated.username, technologyId: validated.technologyId });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Technology already unlocked' });
    }

    for (const prereqId of technology.prerequisites) {
      if (!unlockedTechnologies.includes(prereqId)) {
        const prereq = TECHNOLOGIES[prereqId];
        log.debug('Prerequisite not met', { username: validated.username, required: prereqId, name: prereq?.name });
        return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
          message: `Prerequisite not met: ${prereq?.name || prereqId}`
        });
      }
    }

    const playerRP = player.research_points || 0;
    if (playerRP < technology.cost) {
      log.debug('Insufficient RP', { username: validated.username, required: technology.cost, available: playerRP });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: `Insufficient research points. Required: ${technology.cost}, Available: ${playerRP}`
      });
    }

    // Update player: deduct RP and add to unlocked_techs
    const newUnlocked = [...unlockedTechnologies, validated.technologyId];
    const { error: updateError } = await supabase
      .from('players')
      .update({
        research_points: playerRP - technology.cost,
        unlocked_techs: newUnlocked,
      })
      .eq('username', validated.username);

    if (updateError) {
      log.error('Failed to update player', new Error('Database update failed'), {
        username: validated.username, technologyId: validated.technologyId
      });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, { message: 'Failed to update player' });
    }

    log.info('Technology researched successfully', { 
      username: validated.username, technology: technology.name, cost: technology.cost
    });

    return NextResponse.json({
      success: true,
      message: `Successfully researched ${technology.name}`,
      technology: { id: technology.id, name: technology.name },
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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;

    const supabase = createServiceClient();
    const { data: player } = await supabase
      .from('players')
      .select('unlocked_techs')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      unlockedTechnologies: player.unlocked_techs || [],
    });
  } catch (error) {
    console.error('Research GET API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch technologies' }, { status: 500 });
  }
}
