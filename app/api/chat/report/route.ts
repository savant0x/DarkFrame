/**
 * POST /api/chat/report (FID-20260917-012)
 *
 * Persists a player report against a chat message. Replaces the orphan
 * ChatMessage stub's toast-only path: the report lands in chat_reports and
 * surfaces to admins via GET /api/admin/moderation?type=reports.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { chatReports } from '@/lib/db/schema';
import { authenticateRequest } from '@/lib/authMiddleware';
import type { PlayerContext } from '@/lib/channelService';

const ALLOWED_REASONS = new Set([
  'spam',
  'harassment',
  'inappropriate_content',
  'cheating_accusation',
  'other',
]);

// Route-local context getter, mirroring app/api/chat/route.ts's private one
// (that module doesn't export it).
async function getChatPlayerContext(request: NextRequest): Promise<PlayerContext | null> {
  const auth = await authenticateRequest(request);
  if (!auth) return null;
  return {
    username: auth.username,
    level: auth.player.level ?? 1,
    isVIP: !!auth.player.vip,
    clanId: auth.player.clanId ?? undefined,
    isMuted: false,
    channelBans: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getChatPlayerContext(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { messageId?: string; channelId?: string; reportedUserId?: string; reason?: string; details?: string }
      | null;

    if (!body?.messageId || !body?.channelId || !body?.reportedUserId || !body?.reason) {
      return NextResponse.json(
        { success: false, error: 'messageId, channelId, reportedUserId and reason are required' },
        { status: 400 }
      );
    }
    if (!ALLOWED_REASONS.has(body.reason)) {
      return NextResponse.json(
        { success: false, error: `reason must be one of: ${[...ALLOWED_REASONS].join(', ')}` },
        { status: 400 }
      );
    }
    if (body.reportedUserId === user.username) {
      return NextResponse.json(
        { success: false, error: 'You cannot report your own message' },
        { status: 400 }
      );
    }

    const id = randomBytes(12).toString('hex');
    await db.insert(chatReports).values({
      id,
      messageId: body.messageId.slice(0, 64),
      channelId: body.channelId.slice(0, 40),
      reporterId: user.username,
      reportedUserId: body.reportedUserId.slice(0, 20),
      reason: body.reason.slice(0, 40),
      details: body.details?.slice(0, 1000) ?? null,
      status: 'open',
      createdAt: new Date(),
    });

    return NextResponse.json(
      { success: true, reportId: id, message: 'Message reported to moderators' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[ChatReport] POST failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to file report' },
      { status: 500 }
    );
  }
}
