/**
 * Ask Veterans API Route
 * Created: 2025-01-25
 * Feature: FID-20251025-103
 * 
 * OVERVIEW:
 * Allows new players (levels 1-10) to request help from veteran players.
 * Sends notification to all online veterans (level 50+) via WebSocket.
 * Creates a "help request" that veterans can respond to in Help channel.
 * 
 * ENDPOINTS:
 * - POST /api/chat/ask-veterans - Send help request to veterans
 * 
 * SECURITY:
 * - Only players levels 1-10 can send help requests
 * - Rate limited to 1 request per 5 minutes per player
 * - Must include valid question text (10-200 characters)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { createRateLimiter } from '@/lib/redis';
import { sendVeteranNotification } from '@/lib/chatService';
import type { PlayerContext } from '@/lib/channelService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * POST request body
 */
interface AskVeteransBody {
  question: string;
  category?: 'combat' | 'economy' | 'progression' | 'general';
}

// ============================================================================
// RATE LIMITING
// ============================================================================

// Create Redis-based rate limiter for veteran help requests
// Falls back to in-memory Map if Redis unavailable
const veteranRequestLimiter = createRateLimiter({
  keyPrefix: 'veteran_help',
  maxRequests: 1,
  windowSeconds: 5 * 60, // 5 minutes
  fallbackToMemory: true,
});

/**
 * Check if player can send veteran help request
 * 
 * @param username - Player username
 * @returns True if allowed, false if rate limited
 */
async function canSendVeteranRequest(username: string): Promise<boolean> {
  return await veteranRequestLimiter.check(username);
}

/**
 * Get remaining cooldown time in seconds
 * 
 * @param username - Player username
 * @returns Seconds remaining, or 0 if no cooldown
 */
async function getRemainingCooldown(username: string): Promise<number> {
  return await veteranRequestLimiter.getRemainingTime(username);
}

// ============================================================================
// POST /api/chat/ask-veterans - Send Help Request
// ============================================================================

/**
 * POST /api/chat/ask-veterans
 * Send help request to veteran players (level 50+)
 * 
 * Request Body:
 * - question (required): Help question (10-200 characters)
 * - category (optional): Question category (combat, economy, progression, general)
 * 
 * Restrictions:
 * - Only players levels 1-10 can use this feature
 * - Rate limited to 1 request per 5 minutes
 * - Question must be 10-200 characters
 * 
 * @example
 * POST /api/chat/ask-veterans
 * {
 *   "question": "How do I get better equipment at level 5?",
 *   "category": "progression"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('username', tokenPayload.username)
      .single();

    if (playerError || !player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const username = player.username;

    // Check level requirement (only new players can ask for help)
    const playerLevel = player.level || 1;
    if (playerLevel > 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'This feature is only available to players level 10 and below',
        },
        { status: 403 }
      );
    }

    // Check rate limit
    const canRequest = await canSendVeteranRequest(username);
    if (!canRequest) {
      const remainingSeconds = await getRemainingCooldown(username);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);

      return NextResponse.json(
        {
          success: false,
          error: `Please wait ${remainingMinutes} more minute${remainingMinutes !== 1 ? 's' : ''} before asking for help again`,
          cooldownSeconds: remainingSeconds,
        },
        { status: 429 }
      );
    }

    // Parse request body
    let body: AskVeteransBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { question, category = 'general' } = body;

    // Validate question
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { success: false, error: 'question is required' },
        { status: 400 }
      );
    }

    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Question must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (trimmedQuestion.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Question cannot exceed 200 characters' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['combat', 'economy', 'progression', 'general'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Send notification to veterans
    // This will broadcast via WebSocket to all online veterans (level 50+)
    // Note: WebSocket broadcasting happens in websocket/chatHandlers.ts
    const notification = await sendVeteranNotification(
      username, // playerId (using username as ID for now)
      username,
      playerLevel,
      trimmedQuestion
    );

    // Rate limit is automatically recorded by veteranRequestLimiter.check()
    // No need to manually record the request

    // TODO: Actual WebSocket broadcasting happens in Task 3
    // For now, we just create the notification object
    // WebSocket handler will broadcast to online veterans

    return NextResponse.json(
      {
        success: true,
        message: 'Help request sent to veteran players',
        notification,
        cooldownSeconds: 5 * 60, // 5 minutes
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /chat/ask-veterans POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred while sending help request',
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Veteran Definition:
 *    - Players level 50+ are considered veterans
 *    - isVeteran() function in chatService checks this
 *    - WebSocket handler filters online veterans for notification
 * 
 * 2. Rate Limiting:
 *    - 1 request per 5 minutes per player
 *    - In-memory Map (will reset on server restart)
 *    - TODO: Move to Redis for persistent rate limiting
 *    - Prevents spam and encourages thoughtful questions
 * 
 * 3. Level Restriction:
 *    - Only players level 1-10 can send help requests
 *    - Prevents abuse by high-level players
 *    - Encourages veterans to help genuinely new players
 * 
 * 4. Question Validation:
 *    - Minimum 10 characters (prevents "help" spam)
 *    - Maximum 200 characters (keeps questions focused)
 *    - Trimmed before validation
 * 
 * 5. Categories:
 *    - combat: Fighting, PvP, battle strategies
 *    - economy: Trading, money-making, resources
 *    - progression: Leveling, equipment, skill trees
 *    - general: Anything else
 *    - Used for filtering/prioritization in UI
 * 
 * 6. WebSocket Integration:
 *    - sendVeteranNotification() broadcasts to WebSocket server
 *    - WebSocket handler filters online veterans
 *    - Sends notification with player name, level, question
 *    - Veterans can click to respond in Help channel
 * 
 * 7. Response Format:
 *    - success: true
 *    - message: Confirmation message
 *    - veteransNotified: Number of online veterans notified
 *    - cooldownSeconds: Time until next request allowed
 * 
 * 8. Error Responses:
 *    - 401: Not authenticated
 *    - 403: Level too high (> 10)
 *    - 429: Rate limited (cooldown active)
 *    - 400: Invalid question/category
 *    - 500: Server error
 * 
 * 9. Future Enhancements:
 *    - Veteran response tracking (who helped)
 *    - Reputation system for helpful veterans
 *    - Question history and analytics
 *    - Auto-suggest similar previous questions
 *    - Category-based veteran filtering (combat experts, etc.)
 */
