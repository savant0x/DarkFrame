/**
 * Chat Delete Message API
 * Allows players to delete their own messages, or admins to delete any message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdminAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60 * 1000, message: 'Too many delete attempts. Please wait.' });

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('ChatDeleteAPI');
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'messageId is required' });
    }

    const supabase = createServiceClient();

    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select('sender_username')
      .eq('id', messageId)
      .single() as { data: { sender_username: string } | null; error: unknown };

    if (fetchError || !message) {
      return createErrorResponse(ErrorCode.NOT_FOUND, { message: 'Message not found' });
    }

    const adminCheck = await requireAdminAuth(request);
    const isAdmin = !(adminCheck instanceof NextResponse);
    const isOwner = message.sender_username === auth.username;

    if (!isOwner && !isAdmin) {
      return createErrorResponse(ErrorCode.AUTH_FORBIDDEN, { message: 'You can only delete your own messages' });
    }

    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) {
      log.error('Failed to delete message', deleteError);
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, { message: 'Failed to delete message' });
    }

    log.info('Message deleted', { deletedBy: auth.username, messageId, isAdmin });
    return NextResponse.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    log.error('Error deleting message', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
