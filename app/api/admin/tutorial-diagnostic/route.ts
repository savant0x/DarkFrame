/**
 * @file app/api/admin/tutorial-diagnostic/route.ts
 * @created 2026-09-13
 * @overview FID-20260912-091 — the admin tutorial diagnostic API.
 *
 * GET  → wiring map for every defined step + per-player progress/tracking.
 * POST → admin override: force-complete one step for one player via
 *        completeStep (the same service the gameplay hooks use), so a stuck
 *        player can be unstuck in seconds. Overriding a step whose validator
 *        would refuse the empty payload is an explicit admin decision — the
 *        response carries both the validator's own refusal and the override
 *        outcome, never a silent fake success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players, tutorialProgress, tutorialActionTracking } from '@/lib/db/schema';
import { TUTORIAL_QUESTS, completeStep, getTutorialProgress } from '@/lib/tutorialService';
import {
  buildPlayerDiagnostics,
  describeStepWiring,
  type StepWiring,
  type TrackingRow,
} from '@/lib/tutorialDiagnostic';

export const dynamic = 'force-dynamic';

interface PlayerSummary {
  username: string;
  level: number;
  isBot: boolean;
  hasProgress: boolean;
  tutorialComplete: boolean;
  tutorialSkipped: boolean;
  tutorialDeclined: boolean;
  currentQuestId: string | null;
  currentStepIndex: number;
  currentStepTitle: string | null;
  totalStepsCompleted: number;
  startedAt: Date | null;
  lastUpdated: Date | null;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const usernameParam = request.nextUrl.searchParams.get('username');

    // ---- Wiring map (static, definition-level) -----------------------------
    const wiringMap = TUTORIAL_QUESTS.map(quest => ({
      questId: quest._id!,
      title: quest.title,
      order: quest.order,
      steps: quest.steps.map(step => {
        const wiring = describeStepWiring(step);
        return {
          stepId: step.id,
          title: step.title,
          action: step.action,
          requirementType: step.action === 'CUSTOM' ? (step.validationData?.requirementType ?? null) : null,
          ...wiring,
        };
      }),
    }));

    const unwiredCount = wiringMap.flatMap(q => q.steps).filter(s => s.kind === 'unwired').length;

    // ---- Player selection ---------------------------------------------------
    const baseColumns = {
      username: players.username,
      level: players.level,
      isBot: players.isBot,
    };

    if (usernameParam) {
      // Full report for one player.
      const rows = await db
        .select(baseColumns)
        .from(players)
        .where(eq(players.username, usernameParam))
        .limit(1);
      if (rows.length === 0) {
        return NextResponse.json({ success: false, error: `Player not found: ${usernameParam}` }, { status: 404 });
      }
      const report = await buildReportForPlayer(usernameParam, rows[0]);
      return NextResponse.json({ success: true, wiringMap, unwiredCount, player: report });
    }

    // Roster: every human player with a summary of their tutorial state.
    const roster = await db
      .select({
        username: players.username,
        level: players.level,
        isBot: players.isBot,
        // Tutorial state denormalized onto the player row (FID-20260912-078
        // moved AutoFarm state there too) — tutorial fields live in
        // tutorial_progress; join-free read of the common case via a lateral
        // would be nicer, but a second targeted query keeps the shim happy.
      })
      .from(players)
      .orderBy(players.level);

    const progressRows = await db.select().from(tutorialProgress);
    const progressByPlayer = new Map(progressRows.map(r => [r.playerId, r]));

    const summaries: PlayerSummary[] = roster
      .filter(r => !r.isBot)
      .map(r => {
        const p = progressByPlayer.get(r.username);
        const quest = p?.currentQuestId
          ? TUTORIAL_QUESTS.find(q => q._id === p.currentQuestId)
          : undefined;
        const step = quest?.steps[p?.currentStepIndex ?? 0];
        const terminal = (p?.tutorialComplete ?? 0) === 1
          || (p?.tutorialSkipped ?? 0) === 1
          || (p?.tutorialDeclined ?? 0) === 1;
        return {
          username: r.username,
          level: r.level ?? 0,
          isBot: (r.isBot ?? 0) === 1,
          hasProgress: !!p,
          tutorialComplete: (p?.tutorialComplete ?? 0) === 1,
          tutorialSkipped: (p?.tutorialSkipped ?? 0) === 1,
          tutorialDeclined: (p?.tutorialDeclined ?? 0) === 1,
          currentQuestId: terminal ? null : (p?.currentQuestId ?? null),
          currentStepIndex: p?.currentStepIndex ?? 0,
          currentStepTitle: terminal ? null : (step?.title ?? null),
          totalStepsCompleted: p?.totalStepsCompleted ?? 0,
          startedAt: p?.startedAt ?? null,
          lastUpdated: p?.lastUpdated ?? null,
          isActive: !!p && !terminal,
        };
      });

    const activeCount = summaries.filter(s => s.isActive).length;

    return NextResponse.json({
      success: true,
      wiringMap,
      unwiredCount,
      players: summaries,
      totals: {
        active: activeCount,
        complete: summaries.filter(s => s.tutorialComplete).length,
        skipped: summaries.filter(s => s.tutorialSkipped).length,
        declined: summaries.filter(s => s.tutorialDeclined).length,
        noProgress: summaries.filter(s => !s.hasProgress).length,
        // "Stuck" is knowable only with the player's current step id + the
        // wiring map — the modal derives it client-side from these payloads.
      },
    });
  } catch (error) {
    console.error('[AdminTutorialDiagnostic] GET failed:', error);
    return NextResponse.json({ success: false, error: 'Diagnostic query failed' }, { status: 500 });
  }
}

/** Full per-player report: progress + tracking rows joined with wiring. */
async function buildReportForPlayer(
  username: string,
  summary: { username: string; level: number | null; isBot: number | null }
): Promise<Record<string, unknown>> {
  let progress: Awaited<ReturnType<typeof getTutorialProgress>> | null = null;
  try {
    progress = await getTutorialProgress(username);
  } catch {
    progress = null;
  }

  const trackingRows = await db
    .select()
    .from(tutorialActionTracking)
    .where(eqTracking(username));

  const decoded: TrackingRow[] = trackingRows.map(r => {
    let data: Record<string, unknown> = {};
    try {
      const parsed: unknown = r.actionType ? JSON.parse(r.actionType) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
    } catch {
      data = {};
    }
    const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    return {
      stepId: r.stepId,
      currentCount: num(data.currentCount) ?? 0,
      targetCount: num(data.targetCount) ?? 0,
      targetX: num(data.targetX),
      targetY: num(data.targetY),
      lastUpdated: r.lastUpdated,
    };
  });

  const diag = buildPlayerDiagnostics(TUTORIAL_QUESTS, progress, decoded);

  const quest = progress?.currentQuestId
    ? TUTORIAL_QUESTS.find(q => q._id === progress!.currentQuestId)
    : undefined;
  const step = quest?.steps[progress?.currentStepIndex ?? 0];
  const terminal = progress
    ? progress.tutorialComplete || progress.tutorialSkipped || (progress.tutorialDeclined ?? false)
    : false;

  return {
    summary: {
      username: summary.username,
      level: summary.level ?? 0,
      isBot: (summary.isBot ?? 0) === 1,
      hasProgress: !!progress,
      tutorialComplete: progress?.tutorialComplete ?? false,
      tutorialSkipped: progress?.tutorialSkipped ?? false,
      tutorialDeclined: progress?.tutorialDeclined ?? false,
      currentQuestId: terminal ? null : (progress?.currentQuestId ?? null),
      currentStepIndex: progress?.currentStepIndex ?? 0,
      currentStepTitle: step?.title ?? null,
      totalStepsCompleted: progress?.totalStepsCompleted ?? 0,
      startedAt: progress?.startedAt ?? null,
      lastUpdated: progress?.lastUpdated ?? null,
      isActive: !!progress && !terminal,
    },
    quests: diag.quests,
    holes: diag.holes,
    currentWiring: diag.currentWiring,
    stuckUnwired: diag.stuckUnwired,
    trackingRows: decoded,
  };
}

/** Exact playerId match helper (kept tiny for readability). */
function eqTracking(playerId: string) {
  return eq(tutorialActionTracking.playerId, playerId);
}

// ---------------------------------------------------------------------------
// POST — admin override
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as {
      username?: string;
      questId?: string;
      stepId?: string;
    };
    const { username, questId, stepId } = body;
    if (!username || !questId || !stepId) {
      return NextResponse.json(
        { success: false, error: 'username, questId and stepId are required' },
        { status: 400 }
      );
    }

    const quest = TUTORIAL_QUESTS.find(q => q._id === questId);
    const step = quest?.steps.find(s => s.id === stepId);
    if (!quest || !step) {
      return NextResponse.json({ success: false, error: 'Unknown questId/stepId' }, { status: 404 });
    }

    const wiring: StepWiring = describeStepWiring(step);

    // Run the REAL completion path first — if the validator would accept a
    // normal completion (e.g. the player already qualifies), do that instead
    // of pretending an override happened.
    const natural = await completeStep({ playerId: username, questId, stepId, validationData: {} });
    if (natural.success) {
      return NextResponse.json({
        success: true,
        outcome: 'completed_naturally',
        message: natural.message,
        wiring,
      });
    }

    // The validator refused. An override writes the fields the validator
    // actually reads (documented per action class) and retries once — so the
    // completion goes through the same replay-guarded service path, not a
    // hand-rolled progress mutation.
    const overridePayload = overrideValidationData(step);
    const overridden = await completeStep({
      playerId: username,
      questId,
      stepId,
      validationData: overridePayload,
    });

    return NextResponse.json({
      success: overridden.success,
      outcome: overridden.success ? 'overridden' : 'refused',
      message: overridden.message,
      naturalRefusal: natural.message,
      wiring,
    });
  } catch (error) {
    console.error('[AdminTutorialDiagnostic] POST failed:', error);
    return NextResponse.json({ success: false, error: 'Override failed' }, { status: 500 });
  }
}

/**
 * The minimal validationData each validator accepts, used only by the admin
 * override. Mirrors the real validators in tutorialService — kept in lockstep
 * by __tests__/lib/tutorialDiagnosticContract.test.ts.
 */
function overrideValidationData(step: import('@/types/tutorial.types').TutorialStep): Record<string, unknown> {
  const vd = step.validationData ?? {};
  switch (step.action) {
    case 'MOVE':
      if (vd.requiredMoves) return { moveCount: vd.requiredMoves, direction: vd.anyDirection ? undefined : vd.direction };
      return { x: vd.targetCoordinates?.x ?? 0, y: vd.targetCoordinates?.y ?? 0 };
    case 'MOVE_TO_COORDS':
      return { targetX: vd.targetX, targetY: vd.targetY };
    case 'HARVEST':
      if (vd.requiredHarvests) return { harvestCount: vd.requiredHarvests, resourceType: vd.resourceType };
      return { x: 0, y: 0 };
    case 'ATTACK':
      return { attackCount: vd.requiredAttacks ?? 1, targetType: vd.targetType, success: true };
    case 'OPEN_PANEL':
      return { panelName: vd.panelName };
    case 'CUSTOM':
      switch (vd.requirementType) {
        case 'metal_balance':
        case 'energy_balance':
          // Enrichment overwrites these from live game state; balances are
          // never faked by an admin override.
          return { metalBalance: Number.MAX_SAFE_INTEGER, energyBalance: Number.MAX_SAFE_INTEGER };
        case 'factory_capture':
          return { hasFactory: true, factoryTier: vd.tier };
        case 'build_unit':
          return { unitCount: vd.count ?? 1 };
        case 'find_beer_base':
          return { requirementMet: true };
        default:
          return {};
      }
    default:
      return {};
  }
}
