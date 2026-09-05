import { db } from '@/lib/db';
import { mutes, bans, modLog, warnings, wordBlacklist, players } from '@/lib/db/schema';
import { eq, gt, lte, desc, and, isNull, isNotNull } from 'drizzle-orm';
import { Filter } from 'bad-words';
import { generateId } from '@/lib/utils';

export enum MuteDuration {
  ONE_HOUR = '1h',
  TWENTY_FOUR_HOURS = '24h',
  SEVEN_DAYS = '7d',
  PERMANENT = 'permanent',
}

export enum ModActionType {
  DELETE_MESSAGE = 'delete_message',
  MUTE_USER = 'mute_user',
  UNMUTE_USER = 'unmute_user',
  BAN_FROM_CHANNEL = 'ban_from_channel',
  UNBAN_FROM_CHANNEL = 'unban_from_channel',
  ADD_TO_BLACKLIST = 'add_to_blacklist',
  REMOVE_FROM_BLACKLIST = 'remove_from_blacklist',
}

export interface UserMute {
  id: string;
  playerId: string;
  moderatorId: string;
  reason: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ChannelBan {
  id: string;
  playerId: string;
  moderatorId: string;
  reason: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface BlacklistWord {
  id: string;
  word: string;
}

export interface ModActionLogEntry {
  id: string;
  moderatorId: string;
  action: string;
  targetId: string;
  reason: string | null;
  details: string | null;
  createdAt: Date;
}

export interface UserWarning {
  id: string;
  playerId: string;
  moderatorId: string;
  reason: string;
  expired: number;
  createdAt: Date;
}

interface RateTracker {
  userId: string;
  messages: Date[];
  lastMessage: string;
  duplicateCount: number;
}

export interface MuteStatus {
  isMuted: boolean;
  muteRecord?: UserMute;
  expiresIn?: number;
}

export interface BanStatus {
  isBanned: boolean;
  banRecord?: ChannelBan;
}

const SPAM_RATE_LIMIT = 5;
const SPAM_WINDOW_MS = 10000;
const SPAM_DUPLICATE_THRESHOLD = 3;
const SPAM_CAPS_THRESHOLD = 0.7;
const WARNING_EXPIRY_MS = 24 * 60 * 60 * 1000;
const AUTO_BAN_THRESHOLD = 3;
const AUTO_MUTE_DURATION_MS = 5 * 60 * 1000;

const MUTE_DURATIONS: Record<MuteDuration, number | null> = {
  [MuteDuration.ONE_HOUR]: 60 * 60 * 1000,
  [MuteDuration.TWENTY_FOUR_HOURS]: 24 * 60 * 60 * 1000,
  [MuteDuration.SEVEN_DAYS]: 7 * 24 * 60 * 60 * 1000,
  [MuteDuration.PERMANENT]: null,
};

const profanityFilter = new Filter();
const rateTrackers = new Map<string, RateTracker>();
let customBlacklist: string[] = [];

export async function reloadModerationBlacklist(): Promise<void> {
  try {
    const words = await getBlacklist();
    customBlacklist = words.map(w => w.word);

    if (customBlacklist.length > 0) {
      profanityFilter.addWords(...customBlacklist);
    }

    console.log(`[ModerationService] Loaded ${customBlacklist.length} custom blacklisted words`);
  } catch (error) {
    console.error('[ModerationService] Reload blacklist error:', error);
  }
}

export function detectProfanity(message: string): boolean {
  return profanityFilter.isProfane(message);
}

export async function filterMessage(
  message: string,
  userId: string
): Promise<{
  success: boolean;
  filtered: string;
  hadProfanity: boolean;
  error?: string;
}> {
  try {
    const isAdminUser = await isAdmin(userId);
    if (isAdminUser) {
      return { success: true, filtered: message, hadProfanity: false };
    }

    const hasProfanity = detectProfanity(message);

    if (hasProfanity) {
      const filtered = profanityFilter.clean(message);
      await recordWarning(userId, 'Profanity detected');

      return {
        success: true,
        filtered,
        hadProfanity: true,
      };
    }

    return { success: true, filtered: message, hadProfanity: false };
  } catch (error) {
    console.error('[ModerationService] Filter message error:', error);
    return {
      success: false,
      filtered: message,
      hadProfanity: false,
      error: 'Failed to filter message',
    };
  }
}

export async function detectSpam(
  userId: string,
  username: string,
  message: string
): Promise<{
  isSpam: boolean;
  reason?: string;
  shouldMute?: boolean;
}> {
  try {
    const isAdminUser = await isAdmin(userId);
    if (isAdminUser) {
      return { isSpam: false };
    }

    const now = new Date();

    let tracker = rateTrackers.get(userId);
    if (!tracker) {
      tracker = {
        userId,
        messages: [],
        lastMessage: '',
        duplicateCount: 0,
      };
      rateTrackers.set(userId, tracker);
    }

    tracker.messages = tracker.messages.filter(
      timestamp => now.getTime() - timestamp.getTime() < SPAM_WINDOW_MS
    );
    tracker.messages.push(now);

    if (tracker.messages.length > SPAM_RATE_LIMIT) {
      await recordWarning(userId, 'Spam: Rate limit exceeded');
      return {
        isSpam: true,
        reason: 'Too many messages. Please slow down.',
        shouldMute: true,
      };
    }

    const normalized = message.toLowerCase().trim();
    if (normalized === tracker.lastMessage.toLowerCase().trim()) {
      tracker.duplicateCount++;

      if (tracker.duplicateCount >= SPAM_DUPLICATE_THRESHOLD) {
        await recordWarning(userId, 'Spam: Duplicate messages');
        tracker.duplicateCount = 0;
        return {
          isSpam: true,
          reason: 'Please do not repeat the same message.',
          shouldMute: true,
        };
      }
    } else {
      tracker.duplicateCount = 0;
      tracker.lastMessage = normalized;
    }

    if (message.length >= 10) {
      const letters = message.replace(/[^a-zA-Z]/g, '');
      if (letters.length > 0) {
        const capsRatio = letters.replace(/[^A-Z]/g, '').length / letters.length;

        if (capsRatio >= SPAM_CAPS_THRESHOLD) {
          await recordWarning(userId, 'Spam: Excessive caps');
          return {
            isSpam: true,
            reason: 'Please do not use excessive caps.',
            shouldMute: false,
          };
        }
      }
    }

    return { isSpam: false };
  } catch (error) {
    console.error('[ModerationService] Detect spam error:', error);
    return { isSpam: false };
  }
}

export async function muteUserForSpam(
  userId: string,
  username: string,
  reason: string
): Promise<void> {
  try {
    const existing = await db.select().from(mutes).where(eq(mutes.playerId, userId)).limit(1);

    if (existing.length > 0) {
      return;
    }

    const startTime = new Date();
    const expiryTime = new Date(startTime.getTime() + AUTO_MUTE_DURATION_MS);

    await db.insert(mutes).values({
      id: generateId(), // pg: varchar(24) — `${userId}-${Date.now()}` overflows for real usernames
      playerId: userId,
      moderatorId: 'SYSTEM',
      reason,
      expiresAt: expiryTime,
      createdAt: startTime,
    });

    console.log(`[ModerationService] Auto-muted ${username} for spam: ${reason}`);
  } catch (error) {
    console.error('[ModerationService] Mute user for spam error:', error);
  }
}

export async function recordWarning(
  userId: string,
  reason: string
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + WARNING_EXPIRY_MS);

    const playerResult = await db.select().from(players).where(eq(players.username, userId)).limit(1);
    const username = playerResult[0]?.username || userId;

    await db.insert(warnings).values({
      id: generateId(), // pg: varchar(24)
      playerId: userId,
      moderatorId: 'SYSTEM',
      reason,
      expired: 0,
      createdAt: now,
    });

    const activeWarnings = await db.select().from(warnings).where(
      and(
        eq(warnings.playerId, userId),
        eq(warnings.expired, 0)
      )
    );

    console.log(`[ModerationService] Warning recorded for ${username}: ${reason} (${activeWarnings.length}/3)`);

    if (activeWarnings.length >= AUTO_BAN_THRESHOLD) {
      const existing = await db.select().from(mutes).where(eq(mutes.playerId, userId)).limit(1);

      if (existing.length === 0) {
        const startTime = new Date();
        const expiryTime = new Date(startTime.getTime() + MUTE_DURATIONS[MuteDuration.TWENTY_FOUR_HOURS]!);

        await db.insert(mutes).values({
          id: generateId(), // pg: varchar(24)
          playerId: userId,
          moderatorId: 'SYSTEM',
          reason: `Auto-ban: ${AUTO_BAN_THRESHOLD} warnings in 24 hours`,
          expiresAt: expiryTime,
          createdAt: startTime,
        });

        console.log(`[ModerationService] Auto-banned ${username} for 24 hours (3 warnings)`);

        await db.delete(warnings).where(eq(warnings.playerId, userId));
      }
    }
  } catch (error) {
    console.error('[ModerationService] Record warning error:', error);
  }
}

export async function getActiveWarnings(userId: string): Promise<UserWarning[]> {
  try {
    const warningResults = await db.select().from(warnings).where(
      and(
        eq(warnings.playerId, userId),
        eq(warnings.expired, 0)
      )
    ).orderBy(desc(warnings.createdAt));

    return warningResults.map(w => ({
      id: w.id,
      playerId: w.playerId,
      moderatorId: w.moderatorId,
      reason: w.reason,
      expired: w.expired,
      createdAt: w.createdAt,
    }));
  } catch (error) {
    console.error('[ModerationService] Get active warnings error:', error);
    return [];
  }
}

export async function cleanupExpiredWarnings(): Promise<number> {
  try {
    // pg: RETURNING ... length is the portable affected-row count (mysql2 affectedRows does not exist)
    const result = await db.delete(warnings).where(eq(warnings.expired, 1)).returning({ id: warnings.id });
    const affected = result.length;

    if (affected > 0) {
      console.log(`[ModerationService] Cleaned up ${affected} expired warnings`);
    }

    return affected;
  } catch (error) {
    console.error('[ModerationService] Cleanup expired warnings error:', error);
    return 0;
  }
}

export function cleanupRateTrackers(): number {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  let cleaned = 0;

  for (const [userId, tracker] of rateTrackers.entries()) {
    if (tracker.messages.length === 0 || tracker.messages[tracker.messages.length - 1] < oneHourAgo) {
      rateTrackers.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[ModerationService] Cleaned up ${cleaned} inactive rate trackers`);
  }

  return cleaned;
}

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const playerResult = await db.select().from(players).where(eq(players.username, userId)).limit(1);
    const player = playerResult[0];

    return player?.isAdmin === 1;
  } catch (error) {
    console.error('[ModerationService] Admin check error:', error);
    return false;
  }
}

export async function muteUser(
  userId: string,
  username: string,
  duration: MuteDuration,
  moderatorId: string,
  moderatorUsername: string,
  reason: string
): Promise<{ success: boolean; error?: string; mute?: UserMute }> {
  try {
    const hasPermission = await isAdmin(moderatorId);
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const existing = await db.select().from(mutes).where(eq(mutes.playerId, userId)).limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'User is already muted' };
    }

    const startTime = new Date();
    const durationMs = MUTE_DURATIONS[duration];
    const expiryTime = durationMs ? new Date(startTime.getTime() + durationMs) : null;
    const muteId = generateId(); // pg: varchar(24)

    await db.insert(mutes).values({
      id: muteId,
      playerId: userId,
      moderatorId,
      reason,
      expiresAt: expiryTime,
      createdAt: startTime,
    });

    const savedMute: UserMute = {
      id: muteId,
      playerId: userId,
      moderatorId,
      reason,
      expiresAt: expiryTime,
      createdAt: startTime,
    };

    await logAction({
      actionType: ModActionType.MUTE_USER,
      moderatorId,
      moderatorUsername,
      targetUserId: userId,
      targetUsername: username,
      reason,
      metadata: { duration, expiryTime },
    });

    return { success: true, mute: savedMute };
  } catch (error) {
    console.error('[ModerationService] Mute user error:', error);
    return { success: false, error: 'Failed to mute user' };
  }
}

export async function unmuteUser(
  userId: string,
  moderatorId: string,
  moderatorUsername: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const hasPermission = await isAdmin(moderatorId);
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const muteResult = await db.select().from(mutes).where(eq(mutes.playerId, userId)).limit(1);

    if (muteResult.length === 0) {
      return { success: false, error: 'User is not muted' };
    }

    const result = await db.delete(mutes).where(eq(mutes.id, muteResult[0].id)).returning({ id: mutes.id });

    if (result.length === 0) {
      return { success: false, error: 'Failed to unmute user' };
    }

    await logAction({
      actionType: ModActionType.UNMUTE_USER,
      moderatorId,
      moderatorUsername,
      targetUserId: userId,
      targetUsername: userId,
      reason: 'Manual unmute',
    });

    return { success: true };
  } catch (error) {
    console.error('[ModerationService] Unmute user error:', error);
    return { success: false, error: 'Failed to unmute user' };
  }
}

export async function checkMuteStatus(userId: string): Promise<MuteStatus> {
  try {
    const muteResult = await db.select().from(mutes).where(eq(mutes.playerId, userId)).limit(1);

    if (muteResult.length === 0) {
      return { isMuted: false };
    }

    const mute = muteResult[0];

    if (mute.expiresAt) {
      const now = new Date();
      if (now >= mute.expiresAt) {
        await db.delete(mutes).where(eq(mutes.id, mute.id));
        return { isMuted: false };
      }

      const expiresIn = Math.floor((mute.expiresAt.getTime() - now.getTime()) / 1000);
      return {
        isMuted: true,
        muteRecord: {
          id: mute.id,
          playerId: mute.playerId,
          moderatorId: mute.moderatorId,
          reason: mute.reason,
          expiresAt: mute.expiresAt,
          createdAt: mute.createdAt,
        },
        expiresIn,
      };
    }

    return {
      isMuted: true,
      muteRecord: {
        id: mute.id,
        playerId: mute.playerId,
        moderatorId: mute.moderatorId,
        reason: mute.reason,
        expiresAt: mute.expiresAt,
        createdAt: mute.createdAt,
      },
    };
  } catch (error) {
    console.error('[ModerationService] Check mute status error:', error);
    return { isMuted: false };
  }
}

export async function getActiveMutes(): Promise<UserMute[]> {
  try {
    const mutesResult = await db.select().from(mutes).orderBy(desc(mutes.createdAt));

    return mutesResult.map(m => ({
      id: m.id,
      playerId: m.playerId,
      moderatorId: m.moderatorId,
      reason: m.reason,
      expiresAt: m.expiresAt,
      createdAt: m.createdAt,
    }));
  } catch (error) {
    console.error('[ModerationService] Get active mutes error:', error);
    return [];
  }
}

export async function banFromChannel(
  userId: string,
  username: string,
  channelId: string,
  moderatorId: string,
  moderatorUsername: string,
  reason: string
): Promise<{ success: boolean; error?: string; ban?: ChannelBan }> {
  try {
    const hasPermission = await isAdmin(moderatorId);
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const existing = await db.select().from(bans).where(
      and(
        eq(bans.playerId, userId),
        eq(bans.moderatorId, channelId)
      )
    ).limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'User is already banned from this channel' };
    }

    // pg: id must fit varchar(24) — the old `${userId}-${channelId}-${Date.now()}` template
    // overflowed for any real username and made every channel-ban insert fail
    const banId = generateId();

    await db.insert(bans).values({
      id: banId,
      playerId: userId,
      moderatorId: channelId,
      reason,
      expiresAt: null,
      createdAt: new Date(),
    });

    const savedBan: ChannelBan = {
      id: banId,
      playerId: userId,
      moderatorId: channelId,
      reason,
      expiresAt: null,
      createdAt: new Date(),
    };

    await logAction({
      actionType: ModActionType.BAN_FROM_CHANNEL,
      moderatorId,
      moderatorUsername,
      targetUserId: userId,
      targetUsername: username,
      reason,
      metadata: { channelId },
    });

    return { success: true, ban: savedBan };
  } catch (error) {
    console.error('[ModerationService] Ban from channel error:', error);
    return { success: false, error: 'Failed to ban user' };
  }
}

export async function unbanFromChannel(
  userId: string,
  channelId: string,
  moderatorId: string,
  moderatorUsername: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const hasPermission = await isAdmin(moderatorId);
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const banResult = await db.select().from(bans).where(
      and(
        eq(bans.playerId, userId),
        eq(bans.moderatorId, channelId)
      )
    ).limit(1);

    if (banResult.length === 0) {
      return { success: false, error: 'User is not banned from this channel' };
    }

    const result = await db.delete(bans).where(eq(bans.id, banResult[0].id)).returning({ id: bans.id });

    if (result.length === 0) {
      return { success: false, error: 'Failed to unban user' };
    }

    await logAction({
      actionType: ModActionType.UNBAN_FROM_CHANNEL,
      moderatorId,
      moderatorUsername,
      targetUserId: userId,
      targetUsername: userId,
      reason: 'Manual unban',
    });

    return { success: true };
  } catch (error) {
    console.error('[ModerationService] Unban from channel error:', error);
    return { success: false, error: 'Failed to unban user' };
  }
}

export async function checkChannelBan(
  userId: string,
  channelId: string
): Promise<BanStatus> {
  try {
    const banResult = await db.select().from(bans).where(
      and(
        eq(bans.playerId, userId),
        eq(bans.moderatorId, channelId)
      )
    ).limit(1);

    if (banResult.length === 0) {
      return { isBanned: false };
    }

    const ban = banResult[0];
    return {
      isBanned: true,
      banRecord: {
        id: ban.id,
        playerId: ban.playerId,
        moderatorId: ban.moderatorId,
        reason: ban.reason,
        expiresAt: ban.expiresAt,
        createdAt: ban.createdAt,
      },
    };
  } catch (error) {
    console.error('[ModerationService] Check channel ban error:', error);
    return { isBanned: false };
  }
}

export async function getUserChannelBans(userId: string): Promise<string[]> {
  try {
    const bansResult = await db.select().from(bans).where(eq(bans.playerId, userId));

    return bansResult.map(b => b.moderatorId);
  } catch (error) {
    console.error('[ModerationService] Get user channel bans error:', error);
    return [];
  }
}

export async function getActiveChannelBans(): Promise<ChannelBan[]> {
  try {
    const bansResult = await db.select().from(bans).orderBy(desc(bans.createdAt));

    return bansResult.map(b => ({
      id: b.id,
      playerId: b.playerId,
      moderatorId: b.moderatorId,
      reason: b.reason,
      expiresAt: b.expiresAt,
      createdAt: b.createdAt,
    }));
  } catch (error) {
    console.error('[ModerationService] Get active channel bans error:', error);
    return [];
  }
}

export async function addToBlacklist(
  word: string,
  category: string,
  moderatorId: string,
  moderatorUsername: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const hasPermission = await isAdmin(moderatorId);
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const normalized = word.toLowerCase().trim();
    const existing = await db.select().from(wordBlacklist).where(eq(wordBlacklist.word, normalized)).limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'Word is already blacklisted' };
    }

    await db.insert(wordBlacklist).values({
      id: `wl-${Date.now()}`,
      word: normalized,
    });

    await logAction({
      actionType: ModActionType.ADD_TO_BLACKLIST,
      moderatorId,
      moderatorUsername,
      reason: `Added to ${category} category`,
      metadata: { category },
    });

    return { success: true };
  } catch (error) {
    console.error('[ModerationService] Add to blacklist error:', error);
    return { success: false, error: 'Failed to add word to blacklist' };
  }
}

export async function removeFromBlacklist(
  word: string,
  moderatorId: string,
  moderatorUsername: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const hasPermission = await isAdmin(moderatorId);
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const normalized = word.toLowerCase().trim();

    const result = await db.delete(wordBlacklist).where(eq(wordBlacklist.word, normalized)).returning({ id: wordBlacklist.id });

    if (result.length === 0) {
      return { success: false, error: 'Word not found in blacklist' };
    }

    await logAction({
      actionType: ModActionType.REMOVE_FROM_BLACKLIST,
      moderatorId,
      moderatorUsername,
      reason: 'Removed from blacklist',
    });

    return { success: true };
  } catch (error) {
    console.error('[ModerationService] Remove from blacklist error:', error);
    return { success: false, error: 'Failed to remove word from blacklist' };
  }
}

export async function getBlacklist(): Promise<BlacklistWord[]> {
  try {
    const wordsResult = await db.select().from(wordBlacklist);

    return wordsResult.map(w => ({
      id: w.id,
      word: w.word,
    }));
  } catch (error) {
    console.error('[ModerationService] Get blacklist error:', error);
    return [];
  }
}

async function logAction(
  action: {
    actionType: ModActionType;
    moderatorId: string;
    moderatorUsername: string;
    targetUserId?: string;
    targetUsername?: string;
    channelId?: string;
    messageId?: string;
    word?: string;
    reason: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await db.insert(modLog).values({
      id: `ml-${Date.now()}`,
      moderatorId: action.moderatorId,
      action: action.actionType as any,
      targetId: action.targetUserId || '',
      reason: action.reason,
      details: action.metadata ? JSON.stringify(action.metadata) : null,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[ModerationService] Log action error:', error);
  }
}

export async function getModerationHistory(filters?: {
  moderatorId?: string;
  targetUserId?: string;
  actionType?: ModActionType;
  limit?: number;
}): Promise<ModActionLogEntry[]> {
  try {
    let query: any = db.select().from(modLog);

    if (filters?.moderatorId) {
      query = query.where(eq(modLog.moderatorId, filters.moderatorId));
    } else if (filters?.targetUserId) {
      query = query.where(eq(modLog.targetId, filters.targetUserId));
    }

    const logs = await query
      .orderBy(desc(modLog.createdAt))
      .limit(filters?.limit || 100);

    return logs.map((l: any) => ({
      id: l.id,
      moderatorId: l.moderatorId,
      action: l.action,
      targetId: l.targetId,
      reason: l.reason,
      details: l.details,
      createdAt: l.createdAt,
    }));
  } catch (error) {
    console.error('[ModerationService] Get moderation history error:', error);
    return [];
  }
}

export async function expireTemporaryMutes(): Promise<number> {
  try {
    const now = new Date();

    const expiredMutes = await db.select().from(mutes).where(
      and(
        isNotNull(mutes.expiresAt),
        lte(mutes.expiresAt, now)
      )
    );

    if (expiredMutes.length > 0) {
      const result = await db.delete(mutes).where(
        and(
          isNotNull(mutes.expiresAt),
          lte(mutes.expiresAt, now)
        )
      ).returning({ id: mutes.id });

      console.log(`[ModerationService] Expired ${result.length} temporary mutes`);
      return result.length;
    }

    return 0;
  } catch (error) {
    console.error('[ModerationService] Expire temporary mutes error:', error);
    return 0;
  }
}
