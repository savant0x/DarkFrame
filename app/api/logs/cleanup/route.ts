/**
 * Log Cleanup API Route
 * Created: 2025-10-18
 * Updated: 2026-05-15 — Fixed auth bypass: use requireAdminAuth
 * 
 * OVERVIEW:
 * Administrative endpoint for manually triggering log cleanup and archival.
 * Enforces retention policies: 90 days for activity logs, 180 days for battle logs,
 * 365 days for admin action logs. Only accessible by administrators.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { cleanupOldLogs } from '@/lib/activityLogService';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));

    const { searchParams } = req.nextUrl;
    const dryRun = searchParams.get('dryRun') === 'true';
    const cleanupType = searchParams.get('type') || 'all';

    if (!['activity', 'battle', 'all'].includes(cleanupType)) {
      return NextResponse.json({ error: 'Invalid type. Must be "activity", "battle", or "all".' }, { status: 400 });
    }

    const activityRetentionDays = body.activityRetentionDays || 90;
    const battleRetentionDays = body.battleRetentionDays || 180;
    const adminRetentionDays = body.adminRetentionDays || 365;

    if (
      activityRetentionDays < 1 || activityRetentionDays > 3650 ||
      battleRetentionDays < 1 || battleRetentionDays > 3650 ||
      adminRetentionDays < 1 || adminRetentionDays > 3650
    ) {
      return NextResponse.json({ error: 'Retention days must be between 1 and 3650' }, { status: 400 });
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

    // Activity logs cleanup
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

    // Battle logs cleanup
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
    console.error('Error during log cleanup:', error);
    return NextResponse.json({ error: 'Log cleanup failed', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
