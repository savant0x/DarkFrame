/**
 * @file app/api/discoveries/route.ts
 * @created 2026-09-16
 * @overview Discovery log endpoint for DiscoveryLogPanel (FID-20260916-010).
 *
 * OVERVIEW:
 * The panel (components/DiscoveryLogPanel.tsx:139) fetches
 * `/api/discoveries?username=<name>` and reads `{ discoveries, progress }` with
 * a specific shape. The backend (`lib/discoveryService.getDiscoveryProgress`)
 * returns a DIFFERENT shape (server enum casing, Date timestamps, numeric
 * by-category counts, `totalAvailable`/`progressPercent`, `IN_PROGRESS`).
 * This route is the adapter: domain → panel contract, documented field-by-field.
 * The sibling `discovery/status` route stays as-is (admin/API consumers).
 *
 * ENDPOINT:
 * - GET /api/discoveries?username=<name>
 * - 400 missing username · 404 unknown player · 500 typed error
 * - 200 { success: true, discoveries: PanelDiscovery[], progress: PanelProgress }
 *
 * Shape mapping (service → panel):
 * - category 'industrial'|'combat'|'strategic' → 'INDUSTRIAL'|'COMBAT'|'STRATEGIC'
 * - discoveredAt Date → epoch ms (panel renders via new Date(n))
 * - totalAvailable → totalPossible; progressPercent → percentComplete
 * - byCategory numbers → { discovered, total: 5 } (5 per category × 3 = 15, the
 *   service's own ANCIENT_TECHNOLOGIES census)
 * - completionStatus 'IN_PROGRESS' → 'INCOMPLETE'
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDiscoveryProgress, DiscoveryCategory, ANCIENT_TECHNOLOGIES } from '@/lib/discoveryService';
import { withRequestLogging, createRouteLogger, createErrorResponse, createErrorFromException, ErrorCode } from '@/lib';

/** The panel's UPPERCASE category union (components/DiscoveryLogPanel.tsx:36). */
type PanelCategory = 'INDUSTRIAL' | 'COMBAT' | 'STRATEGIC';

/** Per-category total in the panel's progress UI: 15 discoveries across 3 categories. */
const DISCOVERIES_PER_CATEGORY = 5;

const PANEL_CATEGORY: Record<DiscoveryCategory, PanelCategory> = {
  [DiscoveryCategory.Industrial]: 'INDUSTRIAL',
  [DiscoveryCategory.Combat]: 'COMBAT',
  [DiscoveryCategory.Strategic]: 'STRATEGIC',
};

export const GET = withRequestLogging(async (request: NextRequest) => {
  const log = createRouteLogger('discoveries-panel');

  try {
    const username = request.nextUrl.searchParams.get('username');
    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username parameter is required');
    }

    const progress = await getDiscoveryProgress(username);
    if (!progress) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Player not found');
    }

    // Panel shape (DiscoveryLogPanel.tsx:31-48): epoch-ms timestamps, UPPERCASE
    // categories, by-category {discovered, total} cells.
    const discoveries = progress.discoveries.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      bonus: d.bonus,
      category: PANEL_CATEGORY[d.category],
      discoveredAt: new Date(d.discoveredAt).getTime(),
    }));

    const progressPayload = {
      totalDiscovered: progress.totalDiscovered,
      totalPossible: progress.totalAvailable,
      percentComplete: progress.progressPercent,
      byCategory: {
        INDUSTRIAL: {
          discovered: progress.byCategory[DiscoveryCategory.Industrial],
          total: DISCOVERIES_PER_CATEGORY,
        },
        COMBAT: {
          discovered: progress.byCategory[DiscoveryCategory.Combat],
          total: DISCOVERIES_PER_CATEGORY,
        },
        STRATEGIC: {
          discovered: progress.byCategory[DiscoveryCategory.Strategic],
          total: DISCOVERIES_PER_CATEGORY,
        },
      },
      completionStatus: progress.completionStatus === 'COMPLETE' ? 'COMPLETE' : 'INCOMPLETE',
    } as const;

    log.info('Discovery panel payload served', { username, totalDiscovered: progress.totalDiscovered });
    return NextResponse.json({ success: true, discoveries, progress: progressPayload });
  } catch (error) {
    log.error('Failed to load discovery panel payload', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});

// ANCIENT_TECHNOLOGIES is imported to assert (at compile time) the service
// census this adapter's totals rest on; the runtime count below guards drift.
void ANCIENT_TECHNOLOGIES;
