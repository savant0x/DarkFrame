/**
 * @file app/api/wmd/research/route.ts
 * @created 2025-10-22
 * @updated 2025-10-23 - Added /available and /tree query params
 * @overview WMD Research API Endpoints
 * 
 * OVERVIEW:
 * Handles WMD research tech tree operations including fetching research state,
 * starting new research, and spending research points (RP).
 * 
 * Features:
 * - GET /api/wmd/research - Fetch player's research state
 * - GET /api/wmd/research?view=available - List available techs for player
 * - GET /api/wmd/research?view=tree - Get full tech tree with categories
 * - POST: Start research or spend RP on tech
 * 
 * Authentication: JWT tokens via HttpOnly cookies
 * Dependencies: researchService.ts, apiHelpers.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import {
  getPlayerResearch,
  canStartResearch,
  startResearch,
  spendRPOnResearch,
  getAvailableTechs,
} from '@/lib/wmd/researchService';
import { ALL_RESEARCH_TECHS, ResearchCategory } from '@/types/wmd';

/**
 * GET /api/wmd/research
 * Fetch player's research state, available techs, or full tech tree
 * 
 * Query params:
 * - view: 'status' (default) | 'available' | 'tree'
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'status';
    
    // Get full tech tree (no player-specific data needed)
    if (view === 'tree') {
      const techsByCategory = {
        [ResearchCategory.MISSILE]: ALL_RESEARCH_TECHS.filter(t => t.category === ResearchCategory.MISSILE),
        [ResearchCategory.DEFENSE]: ALL_RESEARCH_TECHS.filter(t => t.category === ResearchCategory.DEFENSE),
        [ResearchCategory.INTELLIGENCE]: ALL_RESEARCH_TECHS.filter(t => t.category === ResearchCategory.INTELLIGENCE),
      };
      
      return NextResponse.json({
        success: true,
        tree: techsByCategory,
        totalTechs: ALL_RESEARCH_TECHS.length,
      });
    }
    
    // Get player's research status
    const research = await getPlayerResearch(auth.playerId);
    
    // Get available techs for player
    if (view === 'available') {
      const available = await getAvailableTechs(auth.playerId);
      
      return NextResponse.json({
        success: true,
        available,
        completedCount: research?.completedTechs.length || 0,
        currentResearch: research?.currentResearch || null,
      });
    }
    
    // Default: return player research status
    return NextResponse.json({
      success: true,
      research,
    });
  } catch (error) {
    console.error('Error fetching research:', error);
    return NextResponse.json(
      { error: 'Failed to fetch research data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wmd/research
 * Start new research or spend RP
 * 
 * Body:
 * - action: 'start' | 'spendRP'
 * - techId: string (for both actions)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { action, techId } = body;
    
    if (!action || !techId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, techId' },
        { status: 400 }
      );
    }
    
    // Start research
    if (action === 'start') {
      const canStart = await canStartResearch(auth.playerId, techId);
      
      if (!canStart.canStart) {
        return NextResponse.json(
          { error: canStart.reason || 'Cannot start research' },
          { status: 400 }
        );
      }
      
      const result = await startResearch(auth.playerId, techId);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    }
    
    // Spend RP on instant research
    if (action === 'spendRP') {
      const result = await spendRPOnResearch(auth.playerId, techId);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        completed: result.completed,
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use "start" or "spendRP"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in research API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
