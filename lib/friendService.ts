import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { friends, friendRequests, players } from '@/lib/db/schema';
import { eq, or, and, inArray, desc, like, count, sql, lt, gt, ne } from 'drizzle-orm';
import {
  Friend,
  FriendRequest,
  FriendStatus,
  FriendRequestStatus,
  FriendWithPlayer,
  FriendRequestWithPlayer,
  FriendshipStatus,
  PlayerSearchResult,
  FRIEND_CONSTANTS,
} from '@/types/friend';
import { ValidationError, NotFoundError, PermissionError } from '@/lib/common/errors';

interface PlayerData {
  username: string;
  level: number;
  vip?: boolean;
  clanTag?: string;
}

function isValidUserId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 20;
}

function isValidMessage(message: string | undefined): boolean {
  if (!message) return true;
  return (
    typeof message === 'string' &&
    message.trim().length > 0 &&
    message.length <= FRIEND_CONSTANTS.MAX_REQUEST_MESSAGE_LENGTH
  );
}

function sanitizeInput(input: string): string {
  return input.trim().slice(0, FRIEND_CONSTANTS.MAX_REQUEST_MESSAGE_LENGTH);
}

export async function sendFriendRequest(
  userId: string,
  toUserId: string,
  message?: string
): Promise<FriendRequest> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid sender user ID format');
  }
  if (!isValidUserId(toUserId)) {
    throw new ValidationError('Invalid recipient user ID format');
  }
  if (userId === toUserId) {
    throw new ValidationError('Cannot send friend request to yourself');
  }
  if (message && !isValidMessage(message)) {
    throw new ValidationError(
      `Message must be ${FRIEND_CONSTANTS.MAX_REQUEST_MESSAGE_LENGTH} characters or less`
    );
  }

  const targetUser = await db.select().from(players).where(eq(players.username, toUserId)).limit(1);
  if (targetUser.length === 0) {
    throw new NotFoundError('User not found');
  }

  const existingFriendship = await db.select().from(friends).where(
    or(
      and(eq(friends.userId, userId), eq(friends.friendId, toUserId), eq(friends.status, FriendStatus.ACCEPTED)),
      and(eq(friends.userId, toUserId), eq(friends.friendId, userId), eq(friends.status, FriendStatus.ACCEPTED))
    )
  ).limit(1);
  if (existingFriendship.length > 0) {
    throw new PermissionError('You are already friends with this user');
  }

  const isBlocked = await db.select().from(friends).where(
    or(
      and(eq(friends.userId, userId), eq(friends.friendId, toUserId), eq(friends.status, FriendStatus.BLOCKED)),
      and(eq(friends.userId, toUserId), eq(friends.friendId, userId), eq(friends.status, FriendStatus.BLOCKED))
    )
  ).limit(1);
  if (isBlocked.length > 0) {
    throw new PermissionError('Cannot send friend request to this user');
  }

  const existingRequest = await db.select().from(friendRequests).where(
    or(
      and(eq(friendRequests.from, userId), eq(friendRequests.to, toUserId), eq(friendRequests.status, FriendRequestStatus.PENDING)),
      and(eq(friendRequests.from, toUserId), eq(friendRequests.to, userId), eq(friendRequests.status, FriendRequestStatus.PENDING))
    )
  ).limit(1);
  if (existingRequest.length > 0) {
    throw new PermissionError('A pending friend request already exists');
  }

  const pendingCountResult = await db.select({ count: count() }).from(friendRequests).where(
    and(
      or(eq(friendRequests.from, userId), eq(friendRequests.to, userId)),
      eq(friendRequests.status, FriendRequestStatus.PENDING)
    )
  );
  const pendingCount = pendingCountResult[0]?.count || 0;
  if (pendingCount >= FRIEND_CONSTANTS.MAX_PENDING_REQUESTS) {
    throw new ValidationError(
      `Maximum ${FRIEND_CONSTANTS.MAX_PENDING_REQUESTS} pending friend requests allowed`
    );
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + FRIEND_CONSTANTS.REQUEST_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
  );

  // pg: ids must fit varchar(24) — randomUUID() is 36 chars and overflows the column
  const requestId = generateId();
  await db.insert(friendRequests).values({
    id: requestId,
    from: userId,
    to: toUserId,
    status: FriendRequestStatus.PENDING,
    message: message ? sanitizeInput(message) : undefined,
    createdAt: now,
    expiresAt,
  });

  return {
    _id: requestId as any,
    from: userId,
    to: toUserId,
    status: FriendRequestStatus.PENDING,
    message: message ? sanitizeInput(message) : undefined,
    createdAt: now,
    expiresAt,
  };
}

export async function acceptRequest(
  userId: string,
  requestId: string
): Promise<Friend> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!requestId) {
    throw new ValidationError('Invalid request ID format');
  }

  const requestResult = await db.select().from(friendRequests).where(eq(friendRequests.id, requestId)).limit(1);
  if (requestResult.length === 0) {
    throw new NotFoundError('Friend request not found');
  }
  const request = requestResult[0];

  if (request.status !== FriendRequestStatus.PENDING) {
    throw new PermissionError('Friend request is no longer pending');
  }

  if (request.to !== userId) {
    throw new PermissionError('You can only accept requests sent to you');
  }

  const requesterFriendCountResult = await db.select({ count: count() }).from(friends).where(
    and(
      or(eq(friends.userId, request.from), eq(friends.friendId, request.from)),
      eq(friends.status, FriendStatus.ACCEPTED)
    )
  );
  const requesterFriendCount = requesterFriendCountResult[0]?.count || 0;
  if (requesterFriendCount >= FRIEND_CONSTANTS.MAX_FRIENDS) {
    throw new ValidationError('Requester has reached maximum friends limit');
  }

  const recipientFriendCountResult = await db.select({ count: count() }).from(friends).where(
    and(
      or(eq(friends.userId, userId), eq(friends.friendId, userId)),
      eq(friends.status, FriendStatus.ACCEPTED)
    )
  );
  const recipientFriendCount = recipientFriendCountResult[0]?.count || 0;
  if (recipientFriendCount >= FRIEND_CONSTANTS.MAX_FRIENDS) {
    throw new ValidationError('You have reached maximum friends limit');
  }

  const now = new Date();
  const friendshipId = generateId(); // pg: varchar(24)
  await db.insert(friends).values({
    id: friendshipId,
    userId: request.from,
    friendId: request.to,
    status: FriendStatus.ACCEPTED,
    initiatedBy: request.from,
    createdAt: now,
    updatedAt: now,
  });

  await db.update(friendRequests).set({
    status: FriendRequestStatus.ACCEPTED,
    respondedAt: now,
  }).where(eq(friendRequests.id, requestId));

  return {
    _id: friendshipId as any,
    userId: request.from,
    friendId: request.to,
    status: FriendStatus.ACCEPTED,
    initiatedBy: request.from,
    createdAt: now,
    updatedAt: now,
  };
}

export async function declineRequest(
  userId: string,
  requestId: string
): Promise<FriendRequest> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!requestId) {
    throw new ValidationError('Invalid request ID format');
  }

  const requestResult = await db.select().from(friendRequests).where(eq(friendRequests.id, requestId)).limit(1);
  if (requestResult.length === 0) {
    throw new NotFoundError('Friend request not found');
  }
  const request = requestResult[0];

  if (request.status !== FriendRequestStatus.PENDING) {
    throw new PermissionError('Friend request is no longer pending');
  }

  if (request.to !== userId) {
    throw new PermissionError('You can only decline requests sent to you');
  }

  const now = new Date();
  await db.update(friendRequests).set({
    status: FriendRequestStatus.DECLINED,
    respondedAt: now,
  }).where(eq(friendRequests.id, requestId));

  return {
    _id: requestId as any,
    from: request.from,
    to: request.to,
    status: FriendRequestStatus.DECLINED,
    message: request.message || undefined,
    createdAt: request.createdAt,
    respondedAt: now,
    expiresAt: request.expiresAt || undefined,
  };
}

export async function removeFriend(
  userId: string,
  friendId: string
): Promise<boolean> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidUserId(friendId)) {
    throw new ValidationError('Invalid friend ID format');
  }
  if (userId === friendId) {
    throw new ValidationError('Cannot remove yourself as a friend');
  }

  const result = await db.delete(friends).where(
    or(
      and(eq(friends.userId, userId), eq(friends.friendId, friendId), eq(friends.status, FriendStatus.ACCEPTED)),
      and(eq(friends.userId, friendId), eq(friends.friendId, userId), eq(friends.status, FriendStatus.ACCEPTED))
    )
  ).returning({ id: friends.id }); // pg: RETURNING length replaces mysql2 affectedRows

  if (result.length === 0) {
    throw new NotFoundError('Friendship not found');
  }

  return true;
}

export async function getFriends(userId: string): Promise<FriendWithPlayer[]> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const friendships = await db.select().from(friends).where(
    and(
      or(eq(friends.userId, userId), eq(friends.friendId, userId)),
      eq(friends.status, FriendStatus.ACCEPTED)
    )
  );

  if (friendships.length === 0) {
    return [];
  }

  const friendIds = friendships.map((f) =>
    f.userId === userId ? f.friendId : f.userId
  );

  const playerData = await db.select({
    username: players.username,
    level: players.level,
    vip: players.vip,
    clanName: players.clanName,
  }).from(players).where(inArray(players.username, friendIds));

  const playerMap = new Map<string, PlayerData>(
    playerData.map((p) => [p.username, {
      username: p.username,
      level: p.level || 1,
      vip: !!p.vip,
      clanTag: p.clanName || undefined,
    }])
  );

  const friendsWithData: FriendWithPlayer[] = friendships.map((f) => {
    const friendUserId = f.userId === userId ? f.friendId : f.userId;
    const playerData = playerMap.get(friendUserId);

    return {
      _id: f.id as any,
      userId: f.userId,
      friendId: f.friendId,
      status: f.status as FriendStatus,
      initiatedBy: f.initiatedBy,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      username: playerData?.username || 'Unknown',
      level: playerData?.level || 1,
      vip: playerData?.vip || false,
      clanTag: playerData?.clanTag,
    };
  });

  return friendsWithData;
}

export async function getPendingRequests(
  userId: string
): Promise<FriendRequestWithPlayer[]> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const requests = await db.select().from(friendRequests).where(
    and(
      eq(friendRequests.to, userId),
      eq(friendRequests.status, FriendRequestStatus.PENDING)
    )
  ).orderBy(desc(friendRequests.createdAt));

  if (requests.length === 0) {
    return [];
  }

  const senderIds = requests.map((r) => r.from);
  const senders = await db.select({
    username: players.username,
    level: players.level,
    vip: players.vip,
    clanName: players.clanName,
  }).from(players).where(inArray(players.username, senderIds));

  const senderMap = new Map<string, PlayerData>(
    senders.map((s) => [s.username, {
      username: s.username,
      level: s.level || 1,
      vip: !!s.vip,
      clanTag: s.clanName || undefined,
    }])
  );

  const requestsWithData: FriendRequestWithPlayer[] = requests.map((r) => {
    const senderData = senderMap.get(r.from);

    return {
      _id: r.id as any,
      from: r.from,
      to: r.to,
      status: r.status as FriendRequestStatus,
      message: r.message || undefined,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt || undefined,
      expiresAt: r.expiresAt || undefined,
      fromUsername: senderData?.username || 'Unknown',
      fromLevel: senderData?.level || 1,
      fromVip: senderData?.vip || false,
      fromClanTag: senderData?.clanTag,
    };
  });

  return requestsWithData;
}

export async function getSentRequests(
  userId: string
): Promise<FriendRequestWithPlayer[]> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const requests = await db.select().from(friendRequests).where(
    and(
      eq(friendRequests.from, userId),
      eq(friendRequests.status, FriendRequestStatus.PENDING)
    )
  ).orderBy(desc(friendRequests.createdAt));

  if (requests.length === 0) {
    return [];
  }

  const recipientIds = requests.map((r) => r.to);
  const recipients = await db.select({
    username: players.username,
    level: players.level,
    vip: players.vip,
    clanName: players.clanName,
  }).from(players).where(inArray(players.username, recipientIds));

  const recipientMap = new Map<string, PlayerData>(
    recipients.map((p) => [p.username, {
      username: p.username,
      level: p.level || 1,
      vip: !!p.vip,
      clanTag: p.clanName || undefined,
    }])
  );

  const requestsWithData: FriendRequestWithPlayer[] = requests.map((r) => {
    const recipientData = recipientMap.get(r.to);

    return {
      _id: r.id as any,
      from: r.from,
      to: r.to,
      status: r.status as FriendRequestStatus,
      message: r.message || undefined,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt || undefined,
      expiresAt: r.expiresAt || undefined,
      fromUsername: recipientData?.username || 'Unknown',
      fromLevel: recipientData?.level || 1,
      fromVip: recipientData?.vip || false,
      fromClanTag: recipientData?.clanTag,
    };
  });

  return requestsWithData;
}

export async function blockUser(
  userId: string,
  targetUserId: string
): Promise<boolean> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidUserId(targetUserId)) {
    throw new ValidationError('Invalid target user ID format');
  }
  if (userId === targetUserId) {
    throw new ValidationError('Cannot block yourself');
  }

  await db.delete(friends).where(
    or(
      and(eq(friends.userId, userId), eq(friends.friendId, targetUserId), eq(friends.status, FriendStatus.ACCEPTED)),
      and(eq(friends.userId, targetUserId), eq(friends.friendId, userId), eq(friends.status, FriendStatus.ACCEPTED))
    )
  );

  const now = new Date();
  await db.update(friendRequests).set({
    status: FriendRequestStatus.CANCELLED,
    respondedAt: now,
  }).where(
    and(
      or(
        and(eq(friendRequests.from, userId), eq(friendRequests.to, targetUserId)),
        and(eq(friendRequests.from, targetUserId), eq(friendRequests.to, userId))
      ),
      eq(friendRequests.status, FriendRequestStatus.PENDING)
    )
  );

  const existingBlock = await db.select().from(friends).where(
    and(eq(friends.userId, userId), eq(friends.friendId, targetUserId))
  ).limit(1);

  if (existingBlock.length > 0) {
    await db.update(friends).set({
      status: FriendStatus.BLOCKED,
      initiatedBy: userId,
      isBlocked: 1,
      blockedBy: userId,
      updatedAt: now,
    }).where(eq(friends.id, existingBlock[0].id));
  } else {
    await db.insert(friends).values({
      id: generateId(), // pg: varchar(24)
      userId,
      friendId: targetUserId,
      status: FriendStatus.BLOCKED,
      initiatedBy: userId,
      isBlocked: 1,
      blockedBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return true;
}

export async function unblockUser(
  userId: string,
  targetUserId: string
): Promise<boolean> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidUserId(targetUserId)) {
    throw new ValidationError('Invalid target user ID format');
  }
  if (userId === targetUserId) {
    throw new ValidationError('Cannot unblock yourself');
  }

  const result = await db.delete(friends).where(
    and(
      eq(friends.userId, userId),
      eq(friends.friendId, targetUserId),
      eq(friends.status, FriendStatus.BLOCKED)
    )
  ).returning({ id: friends.id }); // pg: RETURNING length replaces mysql2 affectedRows

  if (result.length === 0) {
    throw new NotFoundError('Block entry not found');
  }

  return true;
}

export async function searchUsers(
  userId: string,
  query: string,
  limit: number = FRIEND_CONSTANTS.MAX_SEARCH_RESULTS
): Promise<PlayerSearchResult[]> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!query || query.trim().length === 0) {
    throw new ValidationError('Search query is required');
  }
  if (query.length > 50) {
    throw new ValidationError('Search query too long (max 50 characters)');
  }

  const blockedUsers = await db.select().from(friends).where(
    or(
      and(eq(friends.userId, userId), eq(friends.status, FriendStatus.BLOCKED)),
      and(eq(friends.friendId, userId), eq(friends.status, FriendStatus.BLOCKED))
    )
  );

  const blockedIds = blockedUsers.map((b) =>
    b.userId === userId ? b.friendId : b.userId
  );

  const searchPattern = `%${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}%`;
  const searchConditions = [like(players.username, searchPattern)];

  if (blockedIds.length > 0) {
    const conditions = [ne(players.username, userId), ...blockedIds.map(id => ne(players.username, id))];
    searchConditions.push(
      and(...conditions) as any
    );
  } else {
    searchConditions.push(ne(players.username, userId));
  }

  const playerData = await db.select({
    username: players.username,
    level: players.level,
    vip: players.vip,
    clanName: players.clanName,
  }).from(players)
    .where(and(...searchConditions))
    .orderBy(desc(players.level))
    .limit(Math.min(limit, FRIEND_CONSTANTS.MAX_SEARCH_RESULTS));

  if (playerData.length === 0) {
    return [];
  }

  const playerIds = playerData.map((p) => p.username);

  const friendships = await db.select().from(friends).where(
    and(
      or(
        and(eq(friends.userId, userId), inArray(friends.friendId, playerIds)),
        and(inArray(friends.userId, playerIds), eq(friends.friendId, userId))
      ),
      eq(friends.status, FriendStatus.ACCEPTED)
    )
  );

  const friendIdSet = new Set(
    friendships.map((f) =>
      f.userId === userId ? f.friendId : f.userId
    )
  );

  const requests = await db.select().from(friendRequests).where(
    and(
      or(
        and(eq(friendRequests.from, userId), inArray(friendRequests.to, playerIds)),
        and(inArray(friendRequests.from, playerIds), eq(friendRequests.to, userId))
      ),
      eq(friendRequests.status, FriendRequestStatus.PENDING)
    )
  );

  const requestIdSet = new Set(
    requests.map((r) => (r.from === userId ? r.to : r.from))
  );

  const results: PlayerSearchResult[] = playerData.map((p) => {
    const playerId = p.username;
    const isFriend = friendIdSet.has(playerId);
    const hasPendingRequest = requestIdSet.has(playerId);

    return {
      _id: playerId as any,
      username: p.username,
      level: p.level || 1,
      vip: !!p.vip,
      clanTag: p.clanName || undefined,
      friendStatus: isFriend ? FriendStatus.ACCEPTED : undefined,
      hasPendingRequest,
    };
  });

  return results;
}

export async function getFriendStatus(
  userId: string,
  targetUserId: string
): Promise<FriendshipStatus> {
  if (!isValidUserId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidUserId(targetUserId)) {
    throw new ValidationError('Invalid target user ID format');
  }
  if (userId === targetUserId) {
    return {
      areFriends: false,
      hasPendingRequest: false,
      isBlocked: false,
    };
  }

  const friendship = await db.select().from(friends).where(
    or(
      and(eq(friends.userId, userId), eq(friends.friendId, targetUserId)),
      and(eq(friends.userId, targetUserId), eq(friends.friendId, userId))
    )
  ).limit(1);

  if (friendship.length > 0) {
    if (friendship[0].status === FriendStatus.BLOCKED) {
      return {
        areFriends: false,
        hasPendingRequest: false,
        isBlocked: true,
        status: FriendStatus.BLOCKED,
      };
    }

    if (friendship[0].status === FriendStatus.ACCEPTED) {
      return {
        areFriends: true,
        hasPendingRequest: false,
        isBlocked: false,
        status: FriendStatus.ACCEPTED,
      };
    }
  }

  const request = await db.select().from(friendRequests).where(
    and(
      or(
        and(eq(friendRequests.from, userId), eq(friendRequests.to, targetUserId)),
        and(eq(friendRequests.from, targetUserId), eq(friendRequests.to, userId))
      ),
      eq(friendRequests.status, FriendRequestStatus.PENDING)
    )
  ).limit(1);

  if (request.length > 0) {
    return {
      areFriends: false,
      hasPendingRequest: true,
      isBlocked: false,
      requestDirection: request[0].from === userId ? 'sent' : 'received',
      status: FriendStatus.PENDING,
    };
  }

  return {
    areFriends: false,
    hasPendingRequest: false,
    isBlocked: false,
  };
}
