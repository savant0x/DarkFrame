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
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
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
    
    const supabase = createServiceClient();
    const { data: flagDoc, error: flagError } = await supabase
      .from('flags')
      .select('*')
      .limit(1)
      .single();
    
    if (flagError && flagError?.code !== 'PGRST116') {
      throw flagError;
    }
    
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
    if (flagDoc?.bearer_id && flagDoc?.is_bot) {
      const currentPos = { x: flagDoc.position_x, y: flagDoc.position_y };
      const newPosition = await moveFlagBot(flagDoc.bearer_id as string);
      
      await supabase
        .from('flags')
        .update({
          position_x: newPosition.x,
          position_y: newPosition.y,
        })
        .eq('id', flagDoc.id);
      
      console.log(`🚁 Flag bot teleported to (${newPosition.x}, ${newPosition.y})`);
      
      return NextResponse.json({
        success: true,
        action: 'moved',
        message: 'Flag bot teleported to new random location',
        oldPosition: currentPos,
        newPosition,
        timestamp: new Date(),
      });
    }
    
    // Flag held by player - no action needed
    if (flagDoc?.bearer_username && !flagDoc?.is_bot) {
      console.log(`ℹ️ Flag held by player: ${flagDoc.bearer_username} - no action needed`);
      
      return NextResponse.json({
        success: true,
        action: 'none',
        message: 'Flag held by player - no bot movement needed',
        holder: {
          username: flagDoc.bearer_username,
          position: { x: flagDoc.position_x, y: flagDoc.position_y },
        },
        timestamp: new Date(),
      });
    }
    
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
 * Environment Variables Required:
 * - CRON_SECRET: Secret token for cron authentication
 */
