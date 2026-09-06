/**
 * @file app/api/move/route.ts
 * @created 2025-10-16
 * @updated 2025-10-24 (Phase 2: Production infrastructure - validation, errors, rate limiting)
 * @overview Player movement API endpoint
 * 
 * OVERVIEW:
 * POST endpoint for player movement in 9 directions with wrap-around.
 * Returns updated player data and new tile information.
 */

import { NextRequest, NextResponse } from 'next/server';
import { movePlayer } from '@/lib/movementService';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { ApiResponse, MoveResponse, MovementDirection } from '@/types';

/** Tutorial move-tracking doc as read/written by this route. */
interface TutorialMoveTracking {
  playerId: string;
  stepId: string;
  actionType?: string;
  currentCount?: number;
  targetX?: number;
  targetY?: number;
}
import { logMovement } from '@/lib/activityLogger';
import { updateSession } from '@/lib/sessionTracker';
import { getCollection } from '@/lib/mongodb';
import { detectSpeedHack } from '@/lib/antiCheatDetector';
import {  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  MoveSchema,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';
import clientPromise from '@/lib/mongodb';
import {
  
  getCurrentQuestAndStep,
  updateActionTracking,
} from '@/lib/tutorialService';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.movement);

/**
 * POST /api/move
 * 
 * Move player in specified direction
 * 
 * Request body:
 * ```json
 * {
 *   "username": "Commander42",
 *   "direction": "N"
 * }
 * ```
 * 
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "player": { ... },
 *     "currentTile": { ... }
 *   }
 * }
 * ```
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('MovementAPI');
  const endTimer = log.time('playerMovement');
  
  try {
    // FID-20260904-005 §5.1: identity comes from the SESSION, never the body. The
    // Mongo-era route moved whatever `username` the caller supplied (live-exploited).
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body (direction only — body username is ignored)
    const body = await request.json();
    const validated = MoveSchema.parse(body);
    const username = authUser.username;
    const direction = validated.direction;
    
    log.debug('Movement initiated', { username, direction });
    
    // Get player's current position before moving
    // NOTE: the Mongo→pg compat shim returns RAW rows — flat currentPositionX/Y, no nested
    // currentPosition object. Read the flat columns (row is null only if the player is missing).
    const playersCollection = await getCollection<{
      currentPositionX: number;
      currentPositionY: number;
    }>('players');
    const playerBefore = await playersCollection.findOne({ username });
    const oldPosition = playerBefore
      ? { x: playerBefore.currentPositionX, y: playerBefore.currentPositionY }
      : null;
    
    // Move player
    const { player, tile } = await movePlayer(username, direction as MovementDirection);

    // FID-20260906-010 R1: guarantee the documented domain shape on the way out.
    // Clients (AutoFarm engine, GameContext) read nested `currentPosition: Position`.
    // When the mapper produced no nested alias, compose it from the row's flat
    // columns (typed via the row shape, not the Player interface, which does not
    // declare flat position fields). Preserve-don't-overwrite: a freshly moved,
    // server-confirmed nested position is never clobbered by the stale flat row.
    const rawPos = player as unknown as Record<string, unknown>;
    if ((!player.currentPosition || typeof player.currentPosition.x !== 'number' || typeof player.currentPosition.y !== 'number')
      && typeof rawPos.currentPositionX === 'number' && typeof rawPos.currentPositionY === 'number') {
      player.currentPosition = { x: rawPos.currentPositionX as number, y: rawPos.currentPositionY as number };
    }

    // Defensive: Ensure player.currentPosition is always present and valid
    if (!player.currentPosition || typeof player.currentPosition.x !== 'number' || typeof player.currentPosition.y !== 'number') {
      // Fallback: Use tile position if available, else oldPosition, else (1,1)
      const fallbackPosition = tile && typeof tile.x === 'number' && typeof tile.y === 'number'
        ? { x: tile.x, y: tile.y }
        : (oldPosition || { x: 1, y: 1 });
      log.error('[MoveAPI] player.currentPosition missing or invalid. Applying fallback. Details: ' +
        JSON.stringify({ username, original: player.currentPosition, fallback: fallbackPosition })
      );
      player.currentPosition = fallbackPosition;
    }

    // Enhanced logging: Log outgoing response structure for diagnostics
    const responseData: MoveResponse = {
      player,
      currentTile: tile
    };
    const successResponse: ApiResponse<MoveResponse> = {
      success: true,
      data: responseData
    };
    log.info('[MoveAPI] Outgoing response', {
      username,
      response: successResponse,
      playerCurrentPosition: player.currentPosition,
      tilePosition: tile ? { x: tile.x, y: tile.y } : null
    });

    // (Rest of function continues as before)
    log.debug('Player moved', {
      username,
      from: oldPosition,
      to: { x: player.currentPosition.x, y: player.currentPosition.y },
      tileData: tile.terrain
    });
    
    // Track tutorial progress (if in tutorial) - Direct function call
    try {
      log.info('🎓 Tutorial tracking START', { username: player.username, direction });
      
      const mongoClient = await clientPromise;
      const db = mongoClient.db('darkframe');
      
      const { step, progress } = await getCurrentQuestAndStep(player.username);
      log.info('🎓 Tutorial step retrieved', { 
        hasStep: !!step, 
        stepId: step?.id,
        stepAction: step?.action,
        hasValidationData: !!step?.validationData 
      });
      
      if (step && step.action === 'MOVE' && step.validationData) {
        const { requiredMoves, anyDirection, direction: requiredDirection } = step.validationData;
        
        log.info('🎓 Tutorial MOVE step detected', { 
          requiredMoves, 
          anyDirection, 
          requiredDirection,
          playerDirection: direction
        });
        
        if (requiredMoves) {
          // Get current tracking
          const trackingCollection = db.collection<TutorialMoveTracking>('tutorial_action_tracking');
          const tracking = await trackingCollection.findOne({ 
            playerId: player.username, 
            stepId: step.id 
          });
          
          const currentCount = (tracking?.currentCount ?? 0) + 1;
          
          log.info('🎓 Current tracking state', { 
            hadTracking: !!tracking,
            previousCount: tracking?.currentCount || 0,
            newCount: currentCount,
            target: requiredMoves
          });
          
          // Check direction if specified (with normalization)
          let countThis = true;
          if (!anyDirection && requiredDirection) {
            const normalizeDirection = (dir: string) => {
              const dirMap: Record<string, string> = {
                // Cardinal directions
                'n': 'north', 'north': 'north',
                's': 'south', 'south': 'south',
                'e': 'east', 'east': 'east',
                'w': 'west', 'west': 'west',
                // Diagonal directions
                'ne': 'northeast', 'northeast': 'northeast',
                'nw': 'northwest', 'northwest': 'northwest',
                'se': 'southeast', 'southeast': 'southeast',
                'sw': 'southwest', 'southwest': 'southwest',
              };
              return dirMap[dir.toLowerCase()] || dir.toLowerCase();
            };
            
            const normalizedPlayerDirection = normalizeDirection(direction);
            const normalizedRequiredDirection = normalizeDirection(requiredDirection);
            countThis = normalizedPlayerDirection === normalizedRequiredDirection;
            
            log.info('🎓 Direction check', {
              rawPlayerDir: direction,
              normalizedPlayerDir: normalizedPlayerDirection,
              rawRequiredDir: requiredDirection,
              normalizedRequiredDir: normalizedRequiredDirection,
              matches: countThis
            });
          }
          
          if (countThis) {
            await updateActionTracking(player.username, step.id, currentCount, requiredMoves);
            log.info('✅ Tutorial move TRACKED!', { 
              stepId: step.id, 
              progress: `${currentCount}/${requiredMoves}`,
              completed: currentCount >= requiredMoves
            });
            
            // Auto-complete step when target reached
            if (currentCount >= requiredMoves) {
              const tutorialService = await import('@/lib/tutorialService');
              const result = await tutorialService.completeStep({
                playerId: player.username,
                questId: progress.currentQuestId!,
                stepId: step.id,
                validationData: { moveCount: currentCount }
              });
              
              log.info('🎉 Tutorial MOVE step AUTO-COMPLETED!', {
                stepId: step.id,
                success: result.success,
                nextStep: result.nextStep,
                questComplete: result.questComplete
              });
            }
          } else {
            log.warn('⚠️ Tutorial move NOT counted (wrong direction)', {
              stepId: step.id,
              required: requiredDirection,
              actual: direction
            });
          }
        } else {
          log.debug('🎓 No requiredMoves in validation data');
        }
      } else {
        log.debug('🎓 Not a tutorial MOVE step or no validation data');
      }

      // Handle MOVE_TO_COORDS tutorial action (coordinate-based navigation)
      if (step && step.action === 'MOVE_TO_COORDS' && step.validationData) {
        const { dynamicTarget, minDistance, maxDistance, requireDiagonalPath, targetX: staticTargetX, targetY: staticTargetY, locationName } = step.validationData;
        const currentX = player.currentPosition.x;
        const currentY = player.currentPosition.y;
        
        log.info('🎓 Tutorial MOVE_TO_COORDS step detected', { 
          stepId: step.id,
          dynamicTarget,
          staticTarget: staticTargetX !== undefined ? { x: staticTargetX, y: staticTargetY } : null,
          locationName,
          currentPos: { x: currentX, y: currentY },
          hasValidationData: !!step.validationData
        });
        
        let targetX: number;
        let targetY: number;
        
        // Check if this is a static target (predefined coordinates) or dynamic
        if (staticTargetX !== undefined && staticTargetY !== undefined) {
          // Static target - use predefined coordinates
          targetX = staticTargetX;
          targetY = staticTargetY;
          
          log.info('🎯 Using STATIC target coordinates', {
            stepId: step.id,
            locationName,
            target: { x: targetX, y: targetY },
            current: { x: currentX, y: currentY },
            distance: Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2)).toFixed(1)
          });
        } else {
          // Dynamic target - generate on first move
          const trackingCollection = db.collection<TutorialMoveTracking>('tutorial_action_tracking');
          const tracking = await trackingCollection.findOne({ 
            playerId: player.username, 
            stepId: step.id 
          });
          
          if (!tracking || !tracking.targetX || !tracking.targetY) {
            // Generate target coordinates on first move
            const offsetX = Math.floor(Math.random() * ((maxDistance || 15) - (minDistance || 8)) + (minDistance || 8));
            const offsetY = Math.floor(Math.random() * ((maxDistance || 15) - (minDistance || 8)) + (minDistance || 8));
            
            // Randomize direction (positive or negative)
            targetX = currentX + (Math.random() > 0.5 ? offsetX : -offsetX);
            targetY = currentY + (Math.random() > 0.5 ? offsetY : -offsetY);
            
            // If requireDiagonalPath, ensure both X and Y offsets are significant
            if (requireDiagonalPath) {
              const minDiag = Math.floor((minDistance || 8) * 0.7); // At least 70% offset in each direction
              if (Math.abs(targetX - currentX) < minDiag) {
                targetX = currentX + (targetX > currentX ? minDiag : -minDiag);
              }
              if (Math.abs(targetY - currentY) < minDiag) {
                targetY = currentY + (targetY > currentY ? minDiag : -minDiag);
              }
            }
            
            // Enforce map boundaries (1-150 for both X and Y)
            targetX = Math.max(1, Math.min(150, targetX));
            targetY = Math.max(1, Math.min(150, targetY));
            
            // If boundary clamping reduced the distance too much, try opposite direction
            const finalDistance = Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2));
            if (finalDistance < (minDistance || 8)) {
              // Try flipping the direction if we hit a boundary
              const altTargetX = currentX + (targetX < currentX ? offsetX : -offsetX);
              const altTargetY = currentY + (targetY < currentY ? offsetY : -offsetY);
              const clampedAltX = Math.max(1, Math.min(150, altTargetX));
              const clampedAltY = Math.max(1, Math.min(150, altTargetY));
              const altDistance = Math.sqrt(Math.pow(clampedAltX - currentX, 2) + Math.pow(clampedAltY - currentY, 2));
              
              if (altDistance > finalDistance) {
                targetX = clampedAltX;
                targetY = clampedAltY;
              }
            }
          
            // Store target in tracking
            await trackingCollection.updateOne(
              { playerId: player.username, stepId: step.id },
              { 
                $set: { 
                  targetX, 
                  targetY,
                  startX: currentX,
                  startY: currentY,
                  moveCount: 0,
                  createdAt: new Date()
                } 
              },
              { upsert: true }
            );
            
            log.info('🎯 Target coordinates GENERATED', {
              stepId: step.id,
              start: { x: currentX, y: currentY },
              target: { x: targetX, y: targetY },
              distance: Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2))
            });
          } else {
            targetX = tracking.targetX;
            targetY = tracking.targetY;
            
            // Increment move count
            await trackingCollection.updateOne(
              { playerId: player.username, stepId: step.id },
              { $inc: { moveCount: 1 } }
            );
          }
        }
        
        // Check if player reached target
        const reachedTarget = currentX === targetX && currentY === targetY;
        
        log.info('🎯 Position check', {
          stepId: step.id,
          locationName,
          currentX,
          currentY,
          targetX,
          targetY,
          reachedTarget,
          exactMatch: `(${currentX},${currentY}) === (${targetX},${targetY})`
        });
        
        if (reachedTarget) {
          const tutorialService = await import('@/lib/tutorialService');
          const result = await tutorialService.completeStep({
            playerId: player.username,
            questId: progress.currentQuestId!,
            stepId: step.id,
            validationData: { 
              targetX, 
              targetY,
              finalX: currentX,
              finalY: currentY,
              locationName
            }
          });
          
          log.info('🎉 Tutorial MOVE_TO_COORDS step AUTO-COMPLETED!', {
            stepId: step.id,
            locationName,
            target: { x: targetX, y: targetY },
            success: result.success,
            nextStep: result.nextStep,
            questComplete: result.questComplete
          });
        } else {
          const distance = Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2));
          log.info('🎯 Moving toward target', {
            stepId: step.id,
            locationName,
            current: { x: currentX, y: currentY },
            target: { x: targetX, y: targetY },
            distance: distance.toFixed(1)
          });
        }
      }
    } catch (error) {
      // Tutorial tracking is non-critical, log and continue
      log.error('❌ Tutorial tracking ERROR', error as Error);
    }
    
    // If player holds the flag, record a trail step (the holder's map position
    // is derived from their players row by readers — no flags-write needed).
    // Postgres-native via lib/flagState (FID-20260905-001 §7.2); no-op when the
    // mover is not the current bearer.
    try {
      const { recordTrailStep } = await import('@/lib/flagState');
      await recordTrailStep(player.username, {
        x: player.currentPosition.x,
        y: player.currentPosition.y,
      });
    } catch (trailError) {
      // Trail recording is non-critical — never fail the move over it
      log.error('Trail recording failed', trailError instanceof Error ? trailError : new Error(String(trailError)));
    }
    
    // Log movement activity
    const sessionId = request.cookies.get('sessionId')?.value;
    if (sessionId && oldPosition) {
      await logMovement(
        username,
        sessionId,
        oldPosition,
        { x: player.currentPosition.x, y: player.currentPosition.y }
      );
      await updateSession(sessionId); // Increment action count
      
      // Anti-cheat: Check for speed hacking
      const speedCheck = await detectSpeedHack(
        username,
        oldPosition,
        { x: player.currentPosition.x, y: player.currentPosition.y },
        Date.now()
      );
      
      if (speedCheck.suspicious) {
        log.warn('Speed hack detected', { 
          username, 
          evidence: speedCheck.evidence 
        });
      }
    }
    
    log.info('Movement completed', { 
      username, 
      direction,
      position: { x: player.currentPosition.x, y: player.currentPosition.y }
    });
    
    // Build response
    return NextResponse.json(successResponse);
    
  } catch (error) {
    log.error('Movement error', error as Error);
    // Enhanced logging: Log error response for diagnostics
    log.error('[MoveAPI] Error response: ' + (error instanceof Error ? error.message : String(error)));
    // Handle validation errors
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    // Handle all other errors
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
