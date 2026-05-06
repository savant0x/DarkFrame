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

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedPlayer(req);
    
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'status';
    
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
    
    const research = await getPlayerResearch(auth.playerId);
    
    if (view === 'available') {
      const available = await getAvailableTechs(auth.playerId);
      
      return NextResponse.json({
        success: true,
        available,
        completedCount: research?.completedTechs.length || 0,
        currentResearch: research?.currentResearch || null,
      });
    }
    
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
