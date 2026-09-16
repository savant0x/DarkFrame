/**
 * FID-20260916-012: clan research state endpoint.
 *
 * Read-only, thin: requireClanMembership -> getResearchTree, the exact shape
 * the service already returns (branch arrays with per-node unlocked/available,
 * clanLevel, and the shared researchPoints fund). No role data is exposed —
 * the panel gates unlock buttons presentationally from ClanPanel's playerRole,
 * while the server re-gates at unlock time (single source of authority).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib';
import { getResearchTree } from '@/lib/clanResearchService';

export async function GET(request: NextRequest) {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    const { clanId } = result;

    const tree = await getResearchTree(clanId);

    return NextResponse.json({ success: true, tree });
  } catch (error) {
    console.error('Error fetching clan research state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clan research state' },
      { status: 500 }
    );
  }
}
