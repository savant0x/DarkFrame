/**
 * Tutorial Decline API Endpoint
 * Created: 2025-10-26
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * Feature: FID-20251026-001 - Tutorial Permanent Decline System
 * 
 * OVERVIEW:
 * API endpoint for permanently declining the tutorial with 2-click confirmation.
 * Forfeits ALL rewards and prevents restart.
 * 
 * SECURITY:
 * - Validates confirmation parameter
 * - Tracks decline analytics for improvement
 * 
 * WORKFLOW:
 * 1. Client shows confirmation modal
 * 2. User confirms understanding of consequences
 * 3. POST request with confirmed: true and playerId
 * 4. Server validates and sets decline flags
 * 5. Return success with farewell message
 */

import { NextRequest, NextResponse } from 'next/server';
import { declineTutorial } from '@/lib/tutorialService';
import { z } from 'zod';
import { logger } from '@/lib/logger';

/**
 * Validation schema for decline request
 */
const DeclineSchema = z.object({
  playerId: z.string().min(1, 'Player ID required'),
  confirmed: z.boolean(),
});

/**
 * POST /api/tutorial/decline
 * Permanently decline tutorial with confirmation
 * 
 * @param request - Contains { playerId: string, confirmed: boolean }
 * @returns Success/error response
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = DeclineSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid tutorial decline request', { 
        errors: validation.error.issues 
      });
      return NextResponse.json(
        { error: 'Invalid request. Player ID and confirmation required.' },
        { status: 400 }
      );
    }

    const { playerId, confirmed } = validation.data;

    // Execute decline
    const result = await declineTutorial(playerId, confirmed);

    if (!result.success) {
      logger.info('Tutorial decline failed', { playerId, message: result.message });
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    logger.info('Tutorial permanently declined', { playerId });

    return NextResponse.json({ 
      success: true, 
      message: result.message 
    });

  } catch (error) {
    logger.error('Tutorial decline error', error as Error);
    return NextResponse.json(
      { error: 'Failed to decline tutorial. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Handle unsupported methods
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}
