import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  getCurrentQuestAndStep,
  logger,
} from '@/lib';

function normalizeDirection(dir: string): string {
  const d = dir.toLowerCase().trim();
  const map: Record<string, string> = {
    north: 'north', n: 'north', up: 'north',
    south: 'south', s: 'south', down: 'south',
    east: 'east', e: 'east', right: 'east',
    west: 'west', w: 'west', left: 'west',
  };
  return map[d] || d;
}

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const POST = rateLimiter(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { action, data } = body;
    const playerId = auth.playerId;

    if (!action) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'action is required');
    }

    const { step } = await getCurrentQuestAndStep(playerId);

    if (!step || !step.validationData) {
      return NextResponse.json({
        tracked: false,
        message: 'No active tutorial step with tracking'
      });
    }

    let tracked = false;
    const supabase = createServiceClient();

    if (action === 'move' && step.action === 'MOVE') {
      const { requiredMoves, anyDirection, direction } = step.validationData;

      if (requiredMoves) {
        let countThis = true;
        if (!anyDirection && direction && data.direction) {
          const normalizedPlayerDirection = normalizeDirection(data.direction);
          const normalizedRequiredDirection = normalizeDirection(direction);
          countThis = normalizedPlayerDirection === normalizedRequiredDirection;
        }

        if (countThis) {
          // Atomic increment — no read-then-write race
          const { data: updated } = await supabase
            .from('tutorial_action_tracking')
            .update({
              current_count: '=current_count+1' as unknown as number,
              last_updated: new Date().toISOString(),
            })
            .eq('player_username', playerId)
            .eq('step_id', step.id)
            .select();

          if (!updated || updated.length === 0) {
            await supabase
              .from('tutorial_action_tracking')
              .upsert({
                player_username: playerId,
                step_id: step.id,
                current_count: 1,
                target_count: requiredMoves,
                last_updated: new Date().toISOString(),
              }, { onConflict: 'player_username,step_id', ignoreDuplicates: false });
          }

          tracked = true;
        }
      }
    } else if (action === 'harvest' && step.action === 'HARVEST') {
      const { requiredHarvests } = step.validationData;

      if (requiredHarvests) {
        // Atomic increment — no read-then-write race
        const { data: updated } = await supabase
          .from('tutorial_action_tracking')
          .update({
            current_count: '=current_count+1' as unknown as number,
            last_updated: new Date().toISOString(),
          })
          .eq('player_username', playerId)
          .eq('step_id', step.id)
          .select();

        if (!updated || updated.length === 0) {
          await supabase
            .from('tutorial_action_tracking')
            .upsert({
              player_username: playerId,
              step_id: step.id,
              current_count: 1,
              target_count: requiredHarvests,
              last_updated: new Date().toISOString(),
            }, { onConflict: 'player_username,step_id', ignoreDuplicates: false });
        }

        tracked = true;
      }
    } else if (action === 'attack' && step.action === 'ATTACK') {
      const { requiredAttacks } = step.validationData;

      if (requiredAttacks) {
        // Atomic increment — no read-then-write race
        const { data: updated } = await supabase
          .from('tutorial_action_tracking')
          .update({
            current_count: '=current_count+1' as unknown as number,
            last_updated: new Date().toISOString(),
          })
          .eq('player_username', playerId)
          .eq('step_id', step.id)
          .select();

        if (!updated || updated.length === 0) {
          await supabase
            .from('tutorial_action_tracking')
            .upsert({
              player_username: playerId,
              step_id: step.id,
              current_count: 1,
              target_count: requiredAttacks,
              last_updated: new Date().toISOString(),
            }, { onConflict: 'player_username,step_id', ignoreDuplicates: false });
        }

        tracked = true;
      }
    }

    return NextResponse.json({
      tracked,
      step: step.id,
      action
    });

  } catch (error) {
    logger.error('Error in POST /api/tutorial/track-action:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
