/**
 * Block service (FID-20260917-012).
 *
 * GLOBAL block per operator decision: blocking hides a user everywhere the
 * viewer consumes content - global chat messages (chatService filter) and
 * DM conversations (messagingService filter) - enforced server-side so the
 * client cannot forget it. Idempotent by unique(blocker, blocked).
 */
import { randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blockedUsers } from '@/lib/db/schema';

export function makeBlockId(): string {
  return randomBytes(12).toString('hex'); // 24 chars, fits varchar(24)
}

export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  if (blockerId === blockedId) return false;
  try {
    await db
      .insert(blockedUsers)
      .values({ id: makeBlockId(), blockerId, blockedId, createdAt: new Date() })
      .onConflictDoNothing();
    return true;
  } catch (error) {
    console.error('[BlockService] blockUser failed:', error);
    return false;
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const result = await db
      .delete(blockedUsers)
      .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, blockedId)));
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[BlockService] unblockUser failed:', error);
    return false;
  }
}

/** The usernames/ids this viewer has blocked (enforcement reads this). */
export async function getBlockedUsernames(blockerId: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ blockedId: blockedUsers.blockedId })
      .from(blockedUsers)
      .where(eq(blockedUsers.blockerId, blockerId));
    return rows.map((r) => r.blockedId);
  } catch (error) {
    console.error('[BlockService] getBlockedUsernames failed:', error);
    return [];
  }
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: blockedUsers.id })
      .from(blockedUsers)
      .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, blockedId)))
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error('[BlockService] isBlocked failed:', error);
    return false;
  }
}
