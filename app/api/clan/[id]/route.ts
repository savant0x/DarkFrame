/**
 * @file app/api/clan/[id]/route.ts
 * @created 2026-09-17 (FID-20260917-006)
 * @overview GET clan detail by id — the endpoint the clan UI has called since
 *   2025-10-19 but which never existed. Both consumers (ClanManagementView.tsx:72,
 *   the sidebar view; ClanPanel.tsx:87, the modal) fetch `/api/clan/${player.clanId}`
 *   and collapsed the 404 into "Failed to load clan data" — the operator-reported bug.
 *
 * Contract (matched to what the panels consume — see ClanManagementView.tsx:720-796):
 *   { success: true, clan: Clan }
 * where Clan is the full rowToClan shape: members[] (the member gate reads
 * clanData.members.find(m => m.username === ...)), level.currentLevel, settings, stats.
 *
 * Auth: requireAuth. Any signed-in player may view a clan's public detail (join
 * previews need it); Clan carries no privileged fields (members are usernames,
 * roles, join dates).
 *
 * History note: `git log --all -- 'app/api/clan/[id]/route.ts'` is empty — this
 * route NEVER existed in history. The client was written against a planned
 * endpoint that was never built; it survived because the dead-route census swept
 * existing-but-uncalled routes, the inverse of this called-but-missing class.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { getClanById } from '@/lib/clanService';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { id } = await context.params;
    if (!id) {
      return createErrorResponse(ErrorCode.CLAN_NOT_FOUND, {
        message: 'Clan id is required',
      });
    }

    const clan = await getClanById(id);
    if (!clan) {
      return createErrorResponse(ErrorCode.CLAN_NOT_FOUND);
    }

    return NextResponse.json({
      success: true,
      clan,
    });
  } catch (error) {
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}
