import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { cleanupOldLogs } from '@/lib/activityLogService';
import { createErrorResponse, createErrorFromException, ErrorCode, createRateLimiter, ENDPOINT_RATE_LIMITS, logger } from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

export const POST = rateLimiter(async (req: NextRequest) => {
  try {
    const auth = await requireAdminAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));

    const { searchParams } = req.nextUrl;
    const dryRun = searchParams.get('dryRun') === 'true';
    const cleanupType = searchParams.get('type') || 'all';

    if (!['activity', 'battle', 'all'].includes(cleanupType)) {
      return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid type. Must be "activity", "battle", or "all".');
    }

    const activityRetentionDays = body.activityRetentionDays || 90;
    const battleRetentionDays = body.battleRetentionDays || 180;
    const adminRetentionDays = body.adminRetentionDays || 365;

    if (
      activityRetentionDays < 1 || activityRetentionDays > 3650 ||
      battleRetentionDays < 1 || battleRetentionDays > 3650 ||
      adminRetentionDays < 1 || adminRetentionDays > 3650
    ) {
      return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, 'Retention days must be between 1 and 3650');
    }

    const activityCutoffDate = new Date();
    activityCutoffDate.setDate(activityCutoffDate.getDate() - activityRetentionDays);

    const battleCutoffDate = new Date();
    battleCutoffDate.setDate(battleCutoffDate.getDate() - battleRetentionDays);

    const results: Record<string, unknown> = {
      dryRun,
      retentionPolicies: { activity: activityRetentionDays, battle: battleRetentionDays, admin: adminRetentionDays },
      errors: [] as string[],
    };

    const supabase = createServiceClient();

    if (cleanupType === 'activity' || cleanupType === 'all') {
      try {
        const adminCutoffDate = new Date();
        adminCutoffDate.setDate(adminCutoffDate.getDate() - adminRetentionDays);

        if (dryRun) {
          const { count } = await supabase
            .from('admin_logs')
            .select('*', { count: 'exact', head: true })
            .lt('created_at', activityCutoffDate.toISOString());
          results.activityLogsToDelete = count || 0;
        } else {
          const deletedCount = await cleanupOldLogs({
            activityLogDays: activityRetentionDays,
            battleLogDays: battleRetentionDays,
            adminLogDays: adminRetentionDays,
            archiveEnabled: false
          });
          results.activityLogsDeleted = deletedCount;
        }
      } catch (error) {
        (results.errors as string[]).push(`Activity log cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (cleanupType === 'battle' || cleanupType === 'all') {
      try {
        if (dryRun) {
          const { count } = await supabase
            .from('battle_logs')
            .select('*', { count: 'exact', head: true })
            .lt('created_at', battleCutoffDate.toISOString());
          results.battleLogsToDelete = count || 0;
        } else {
          const { error } = await supabase
            .from('battle_logs')
            .delete()
            .lt('created_at', battleCutoffDate.toISOString());
          results.battleLogsDeleted = error ? 0 : (results.battleLogsToDelete || 0);
        }
      } catch (error) {
        (results.errors as string[]).push(`Battle log cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (dryRun) {
      results.totalToDelete = (Number(results.activityLogsToDelete) || 0) + (Number(results.battleLogsToDelete) || 0);
    } else {
      results.totalDeleted = (Number(results.activityLogsDeleted) || 0) + (Number(results.battleLogsDeleted) || 0);
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    logger.error('Error during log cleanup:', error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
});
