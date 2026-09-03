/**
 * @file app/api/cron/flag-bot-movement/route.ts
 * @created 2025-10-23
 * @overview Cron job for flag bot movement and reset
 * 
 * OVERVIEW:
 * Scheduled job that runs every 30 minutes to manage flag bot lifecycle.
 * Handles bot teleportation to random map locations and flag reset logic.
 * Secured with CRON_SECRET environment variable.
 * 
 * Features:
 * - Move flag bot to random location every 30 minutes
 * - Reset flag if unclaimed for > 1 hour
 * - Only runs when flag is held by bot (not player)
 * - Vercel Cron compatible with security verification
 * 
 * Cron Schedule: Every 30 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { moveFlagBot, shouldResetFlag, resetFlagBot } from '@/lib/flagBotService';
import { getDatabase } from '@/lib/mongodb';

/** Shape of the `flags` singleton document as consumed by the flag-bot movement cron. */
interface FlagDoc {
  currentHolder?: {
    playerId?: string;
    botId?: string;
    username?: string;
    position?: { x: number; y: number };
  };
}

/**
 * GET /api/cron/flag-bot-movement
 * 
 * Cron endpoint for flag bot management
 * Called by Vercel Cron every 30 minutes
 * 
 * Actions:
 * 1. Check if flag needs reset (unclaimed > 1 hour) → Reset
 * 2. If flag held by bot → Teleport to random location
 * 3. If flag held by player → No action needed
 * 
 * Security: Requires CRON_SECRET in Authorization header
 * 
 * @returns JSON response with action taken
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.error('⚠️ CRON_SECRET not configured in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️ Unauthorized cron job attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const db = await getDatabase();
    const flagDoc = await db.collection<FlagDoc>('flags').findOne({});
    
    // Check if flag needs reset (unclaimed or held too long)
    const needsReset = await shouldResetFlag();
    
    if (needsReset) {
      const newBot = await resetFlagBot();
      
      console.log(`🔄 Flag reset: New bot spawned at (${newBot.currentPosition.x}, ${newBot.currentPosition.y})`);
      
      return NextResponse.json({
        success: true,
        action: 'reset',
        message: 'Flag bot reset and respawned at new random location',
        newBot: {
          username: newBot.username,
          position: newBot.currentPosition,
        },
        timestamp: new Date(),
      });
    }
    
    // Only move bot if flag is held by bot (not player)
    if (flagDoc?.currentHolder?.botId) {
      const newPosition = await moveFlagBot(flagDoc.currentHolder.botId);
      
      // Update flag position in database
      await db.collection('flags').updateOne(
        {},
        { $set: { currentHolder: { ...(flagDoc?.currentHolder ?? {}), position: newPosition } } }
      );
      
      console.log(`🚁 Flag bot teleported to (${newPosition.x}, ${newPosition.y})`);
      
      return NextResponse.json({
        success: true,
        action: 'moved',
        message: 'Flag bot teleported to new random location',
        oldPosition: flagDoc.currentHolder.position,
        newPosition,
        timestamp: new Date(),
      });
    }
    
    // Flag held by player - no action needed
    if (flagDoc?.currentHolder?.playerId) {
      console.log(`ℹ️ Flag held by player: ${flagDoc.currentHolder.username} - no action needed`);
      
      return NextResponse.json({
        success: true,
        action: 'none',
        message: 'Flag held by player - no bot movement needed',
        holder: {
          username: flagDoc.currentHolder.username,
          position: flagDoc.currentHolder.position,
        },
        timestamp: new Date(),
      });
    }
    
    // No flag holder found - unusual state
    console.warn('⚠️ No flag holder found in database');
    
    return NextResponse.json({
      success: true,
      action: 'none',
      message: 'No flag holder found',
      timestamp: new Date(),
    });
    
  } catch (error) {
    console.error('❌ Flag cron job error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * Vercel Cron Configuration:
 * Add to vercel.json in project root:
 * 
 * {
 *   "crons": [{
 *     "path": "/api/cron/flag-bot-movement",
 *     "schedule": "0,30 * * * *"
 *   }]
 * }
 * 
 * Schedule Format (cron syntax):
 * - "0,30 * * * *" = Every hour at 0 and 30 minutes (twice per hour)
 * - Runs at: 12:00, 12:30, 1:00, 1:30, etc.
 * 
 * Environment Variables Required:
 * - CRON_SECRET: Secret token for cron authentication
 *   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   Add to .env.local: CRON_SECRET=your-generated-secret
 * 
 * Security:
 * - Vercel automatically adds Authorization header with Bearer token
 * - We verify the token matches CRON_SECRET
 * - Prevents unauthorized execution of cron endpoints
 * 
 * Logging:
 * - All actions logged to console for monitoring
 * - Check Vercel deployment logs to verify cron execution
 * - Look for: "🚁 Flag bot teleported" or "🔄 Flag reset"
 * 
 * Error Handling:
 * - Returns 500 if CRON_SECRET not configured
 * - Returns 401 if authorization fails
 * - Returns 500 if database error occurs
 * - Logs all errors for debugging
 * 
 * Testing Locally:
 * - Set CRON_SECRET in .env.local
 * - Call endpoint: curl -H "Authorization: Bearer YOUR_SECRET" http://localhost:3000/api/cron/flag-bot-movement
 * - Check console for action logs
 * 
 * Related Files:
 * - /lib/flagBotService.ts - Flag bot lifecycle functions
 * - /app/api/flag/route.ts - Flag API endpoints
 * - /vercel.json - Cron configuration
 */
