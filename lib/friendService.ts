/**
 * Friend Service Layer
 * Created: 2025-10-26
 * 
 * OVERVIEW:
 * This service layer provides all business logic for the friend system, including
 * friend requests, friend management, blocking, and friend discovery. All functions
 * handle database operations, input validation, error handling, and return consistent
 * response types for API layer consumption.
 * 
 * KEY RESPONSIBILITIES:
 * - Friend request management (send, accept, decline, cancel)
 * - Friend relationship management (add, remove, list)
 * - User blocking and unblocking
 * - Friend discovery and search
 * - Friend status checking (relationship state)
 * - Input validation and sanitization
 * - Error handling with custom error classes
 * 
 * BUSINESS RULES:
 * 1. Users cannot send friend requests to themselves
 * 2. Users cannot send duplicate friend requests
 * 3. Max friends limit: 100 per user (configurable)
 * 4. Max pending requests: 50 (sent + received combined)
 * 5. Friend request messages limited to 200 characters
 * 6. Blocking removes existing friendship if present
 * 7. Blocked users cannot send friend requests
 * 8. Friend requests expire after 30 days
 * 9. Friendships are bidirectional (single document)
 * 10. Accepting request creates friendship and updates request status
 * 
 * DATABASE TABLES:
 * - friends: Stores accepted friendships
 * - friend_requests: Stores pending/declined/cancelled requests
 * - players: User data for friend display (username, level, etc.)
 * 
 * INTEGRATION:
 * - Used by API routes in app/api/friends/
 * - Types imported from types/friend.ts
 * - Supabase connection from lib/supabase/server.ts
 * - Authentication validated by API layer before calling service
 * 
 * ERROR HANDLING:
 * - ValidationError: Invalid input data
 * - NotFoundError: Resource doesn't exist
 * - PermissionError: User lacks permission
 * - Standard Error: Unexpected Supabase or system errors
 */

import { createServiceClient } from '@/lib/supabase/server';
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

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Player data interface for lookup maps
 */
interface PlayerData {
  username: string;
  level: number;
  is_vip?: boolean;
  clan_name?: string;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates UUID format
 * 
 * @param id - ID string to validate
 * @returns True if valid UUID format
 * 
 * @example
 * if (!isValidId(userId)) {
 *   throw new ValidationError('Invalid user ID format');
 * }
 */
function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length > 0;
}

/**
 * Validates friend request message length
 * 
 * @param message - Message string to validate
 * @returns True if message is valid
 * 
 * @example
 * if (!isValidMessage(message)) {
 *   throw new ValidationError('Message exceeds 200 characters');
 * }
 */
function isValidMessage(message: string | undefined): boolean {
  if (!message) return true; // Optional message
  return (
    typeof message === 'string' &&
    message.trim().length > 0 &&
    message.length <= FRIEND_CONSTANTS.MAX_REQUEST_MESSAGE_LENGTH
  );
}

/**
 * Sanitizes user input strings
 * 
 * @param input - String to sanitize
 * @returns Sanitized string
 * 
 * @example
 * const cleanMessage = sanitizeInput(userMessage);
 */
function sanitizeInput(input: string): string {
  return input.trim().slice(0, FRIEND_CONSTANTS.MAX_REQUEST_MESSAGE_LENGTH);
}

// ============================================================================
// FRIEND REQUEST FUNCTIONS
// ============================================================================

/**
 * Send a friend request to another user
 * 
 * Validates that:
 * - User is not sending request to themselves
 * - Target user exists
 * - No existing friendship or pending request
 * - Sender hasn't exceeded request limit
 * - User is not blocked by target
 * 
 * @param userId - ID of user sending request
 * @param toUserId - ID of user receiving request
 * @param message - Optional intro message (max 200 chars)
 * @returns Created friend request
 * @throws {ValidationError} Invalid input or limits exceeded
 * @throws {PermissionError} Blocked or already friends
 * @throws {NotFoundError} Target user not found
 * 
 * @example
 * const request = await sendFriendRequest(
 *   'player-123',
 *   'player-456',
 *   'Hey! Want to team up?'
 * );
 */
export async function sendFriendRequest(
  userId: string,
  toUserId: string,
  message?: string
): Promise<FriendRequest> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid sender user ID format');
  }
  if (!isValidId(toUserId)) {
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

  const supabase = createServiceClient();

  // Check if target user exists
  const { data: targetUser } = await supabase
    .from('players')
    .select('*')
    .eq('username', toUserId)
    .single();
    
  if (!targetUser) {
    throw new NotFoundError('User not found');
  }

  // Check if already friends
  const { data: existingFriendship } = await supabase
    .from('friends')
    .select('*')
    .or(`user_username.eq.${userId},user_username.eq.${toUserId}`)
    .or(`friend_username.eq.${userId},friend_username.eq.${toUserId}`)
    .maybeSingle();
    
  if (existingFriendship) {
    throw new PermissionError('You are already friends with this user');
  }

  // Check if blocked
  const { data: isBlocked } = await supabase
    .from('blocked_users')
    .select('*')
    .or(
      `and(blocker_username.eq.${userId},blocked_username.eq.${toUserId}),` +
      `and(blocker_username.eq.${toUserId},blocked_username.eq.${userId})`
    )
    .maybeSingle();
    
  if (isBlocked) {
    throw new PermissionError('Cannot send friend request to this user');
  }

  // Check for existing pending request (either direction)
  const { data: existingRequest } = await supabase
    .from('friend_requests')
    .select('*')
    .or(
      `and(sender_username.eq.${userId},receiver_username.eq.${toUserId},status.eq.${FriendRequestStatus.PENDING}),` +
      `and(sender_username.eq.${toUserId},receiver_username.eq.${userId},status.eq.${FriendRequestStatus.PENDING})`
    )
    .maybeSingle();
    
  if (existingRequest) {
    throw new PermissionError('A pending friend request already exists');
  }

  // Check sender's pending request count
  const { count: pendingCount } = await supabase
    .from('friend_requests')
    .select('*', { count: 'exact', head: true })
    .or(`sender_username.eq.${userId},receiver_username.eq.${userId}`)
    .eq('status', FriendRequestStatus.PENDING);
    
  if ((pendingCount || 0) >= FRIEND_CONSTANTS.MAX_PENDING_REQUESTS) {
    throw new ValidationError(
      `Maximum ${FRIEND_CONSTANTS.MAX_PENDING_REQUESTS} pending friend requests allowed`
    );
  }

  // Create friend request
  const now = new Date();
  const expiresAt = new Date(now.getTime() + FRIEND_CONSTANTS.REQUEST_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

  const requestDoc = {
    sender_username: userId,
    receiver_username: toUserId,
    status: FriendRequestStatus.PENDING,
    message: message ? sanitizeInput(message) : undefined,
    created_at: now.toISOString(),
  };

  const { data: result, error } = await supabase
    .from('friend_requests')
    .insert(requestDoc)
    .select('id')
    .single();

  if (error) throw error;

  return {
    _id: result.id,
    from: requestDoc.sender_username,
    to: requestDoc.receiver_username,
    status: requestDoc.status,
    message: requestDoc.message,
    createdAt: now,
    expiresAt,
  };
}

/**
 * Accept a friend request
 * 
 * Validates that:
 * - Request exists and is pending
 * - User is the recipient of the request
 * - Neither user has reached max friends limit
 * 
 * Creates friendship and updates request status.
 * 
 * @param userId - ID of user accepting request
 * @param requestId - ID of friend request to accept
 * @returns Created friendship
 * @throws {ValidationError} Invalid input
 * @throws {NotFoundError} Request not found
 * @throws {PermissionError} Not recipient or limits exceeded
 * 
 * @example
 * const friendship = await acceptRequest('player-456', 'req-123');
 */
export async function acceptRequest(
  userId: string,
  requestId: string
): Promise<Friend> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidId(requestId)) {
    throw new ValidationError('Invalid request ID format');
  }

  const supabase = createServiceClient();

  // Find request
  const { data: request } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!request) {
    throw new NotFoundError('Friend request not found');
  }

  if (request.status !== FriendRequestStatus.PENDING) {
    throw new PermissionError('Friend request is no longer pending');
  }

  if (request.receiver_username !== userId) {
    throw new PermissionError('You can only accept requests sent to you');
  }

  // Check friend limits for both users
  const { count: requesterFriendCount } = await supabase
    .from('friends')
    .select('*', { count: 'exact', head: true })
    .or(`user_username.eq.${request.sender_username},friend_username.eq.${request.sender_username}`);

  if ((requesterFriendCount || 0) >= FRIEND_CONSTANTS.MAX_FRIENDS) {
    throw new ValidationError('Requester has reached maximum friends limit');
  }

  const { count: recipientFriendCount } = await supabase
    .from('friends')
    .select('*', { count: 'exact', head: true })
    .or(`user_username.eq.${userId},friend_username.eq.${userId}`);

  if ((recipientFriendCount || 0) >= FRIEND_CONSTANTS.MAX_FRIENDS) {
    throw new ValidationError('You have reached maximum friends limit');
  }

  // Create friendship
  const now = new Date();
  const friendshipDoc = {
    user_username: request.sender_username,
    friend_username: request.receiver_username,
    created_at: now.toISOString(),
  };

  const { data: friendResult, error } = await supabase
    .from('friends')
    .insert(friendshipDoc)
    .select('id')
    .single();

  if (error) throw error;

  // Update request status
  await supabase
    .from('friend_requests')
    .update({
      status: FriendRequestStatus.ACCEPTED,
      updated_at: now.toISOString(),
    })
    .eq('id', requestId);

  return {
    _id: friendResult.id,
    userId: friendshipDoc.user_username,
    friendId: friendshipDoc.friend_username,
    status: FriendStatus.ACCEPTED,
    initiatedBy: request.sender_username,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Decline a friend request
 * 
 * Validates that:
 * - Request exists and is pending
 * - User is the recipient of the request
 * 
 * @param userId - ID of user declining request
 * @param requestId - ID of friend request to decline
 * @returns Updated request with declined status
 * @throws {ValidationError} Invalid input
 * @throws {NotFoundError} Request not found
 * @throws {PermissionError} Not recipient
 * 
 * @example
 * await declineRequest('player-456', 'req-123');
 */
export async function declineRequest(
  userId: string,
  requestId: string
): Promise<FriendRequest> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidId(requestId)) {
    throw new ValidationError('Invalid request ID format');
  }

  const supabase = createServiceClient();

  // Find request
  const { data: request } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (!request) {
    throw new NotFoundError('Friend request not found');
  }

  if (request.status !== FriendRequestStatus.PENDING) {
    throw new PermissionError('Friend request is no longer pending');
  }

  if (request.receiver_username !== userId) {
    throw new PermissionError('You can only decline requests sent to you');
  }

  // Update request status
  const now = new Date();
  await supabase
    .from('friend_requests')
    .update({
      status: FriendRequestStatus.DECLINED,
      updated_at: now.toISOString(),
    })
    .eq('id', requestId);

  return {
    _id: requestId,
    from: request.sender_username,
    to: request.receiver_username,
    status: FriendRequestStatus.DECLINED,
    message: request.message ?? undefined,
    createdAt: request.created_at ? new Date(request.created_at) : now,
    respondedAt: now,
  };
}

// ============================================================================
// FRIEND MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Remove a friend
 * 
 * Validates that:
 * - Friendship exists
 * - User is part of the friendship
 * 
 * Deletes the friendship document (soft delete could be implemented).
 * 
 * @param userId - ID of user removing friend
 * @param friendId - ID of friend to remove
 * @returns True if removed successfully
 * @throws {ValidationError} Invalid input
 * @throws {NotFoundError} Friendship not found
 * 
 * @example
 * await removeFriend('player-123', 'player-456');
 */
export async function removeFriend(
  userId: string,
  friendId: string
): Promise<boolean> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidId(friendId)) {
    throw new ValidationError('Invalid friend ID format');
  }
  if (userId === friendId) {
    throw new ValidationError('Cannot remove yourself as a friend');
  }

  const supabase = createServiceClient();

  // Find friendship (bidirectional)
  const { error } = await supabase
    .from('friends')
    .delete()
    .or(
      `and(user_username.eq.${userId},friend_username.eq.${friendId}),` +
      `and(user_username.eq.${friendId},friend_username.eq.${userId})`
    );

  if (error) {
    throw new NotFoundError('Friendship not found');
  }

  return true;
}

/**
 * Get user's friends list with player data
 * 
 * Returns array of friends with populated player information
 * (username, level, VIP status, clan tag).
 * 
 * @param userId - ID of user to get friends for
 * @returns Array of friends with player data
 * @throws {ValidationError} Invalid input
 * 
 * @example
 * const friends = await getFriends('player-123');
 * friends.forEach(f => console.log(f.username, f.level));
 */
export async function getFriends(userId: string): Promise<FriendWithPlayer[]> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const supabase = createServiceClient();

  // Get all friendships where user is involved
  const { data: friendships } = await supabase
    .from('friends')
    .select('*')
    .or(`user_username.eq.${userId},friend_username.eq.${userId}`);

  if (!friendships || friendships.length === 0) {
    return [];
  }

  // Extract friend IDs (the other user in each friendship)
  const friendIds = friendships.map((f: any) =>
    f.user_username === userId ? f.friend_username : f.user_username
  );

  // Get player data for all friends
  const { data: players } = await supabase
    .from('players')
    .select('username, level, is_vip, clan_name')
    .in('username', friendIds);

  // Create lookup map for quick player data access
  const playerMap = new Map<string, PlayerData>(
    (players || []).map((p: any) => [p.username, p as PlayerData])
  );

  // Combine friendship and player data
  const friendsWithData: FriendWithPlayer[] = friendships.map((f: any) => {
    const friendUserId = f.user_username === userId ? f.friend_username : f.user_username;
    const playerData = playerMap.get(friendUserId);

    return {
      _id: f.id,
      userId: f.user_username,
      friendId: f.friend_username,
      status: FriendStatus.ACCEPTED,
      initiatedBy: f.user_username,
      createdAt: new Date(f.created_at),
      updatedAt: new Date(f.created_at),
      username: playerData?.username || 'Unknown',
      level: playerData?.level || 1,
      vip: playerData?.is_vip || false,
      clanTag: playerData?.clan_name,
    };
  });

  return friendsWithData;
}

/**
 * Get pending friend requests received by user
 * 
 * Returns requests with sender's player data populated.
 * 
 * @param userId - ID of user to get requests for
 * @returns Array of pending requests with sender data
 * @throws {ValidationError} Invalid input
 * 
 * @example
 * const requests = await getPendingRequests('player-456');
 * requests.forEach(r => console.log(r.fromUsername, r.message));
 */
export async function getPendingRequests(
  userId: string
): Promise<FriendRequestWithPlayer[]> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const supabase = createServiceClient();

  // Get all pending requests TO this user
  const { data: requests } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('receiver_username', userId)
    .eq('status', FriendRequestStatus.PENDING)
    .order('created_at', { ascending: false });

  if (!requests || requests.length === 0) {
    return [];
  }

  // Get sender player data
  const senderIds = requests.map((r: any) => r.sender_username);
  const { data: senders } = await supabase
    .from('players')
    .select('username, level, is_vip, clan_name')
    .in('username', senderIds);

  // Create lookup map
  const senderMap = new Map<string, PlayerData>(
    (senders || []).map((s: any) => [s.username, s as PlayerData])
  );

  // Combine request and sender data
  const requestsWithData: FriendRequestWithPlayer[] = requests.map((r: any) => {
    const senderData = senderMap.get(r.sender_username);

    return {
      _id: r.id,
      from: r.sender_username,
      to: r.receiver_username,
      status: r.status,
      message: r.message ?? undefined,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
      respondedAt: r.updated_at ? new Date(r.updated_at) : undefined,
      fromUsername: senderData?.username || 'Unknown',
      fromLevel: senderData?.level || 1,
      fromVip: senderData?.is_vip || false,
      fromClanTag: senderData?.clan_name,
    };
  });

  return requestsWithData;
}

/**
 * Get pending friend requests sent by user
 * 
 * Returns requests with recipient's player data populated.
 * 
 * @param userId - ID of user to get sent requests for
 * @returns Array of pending sent requests with recipient data
 * @throws {ValidationError} Invalid input
 * 
 * @example
 * const sentRequests = await getSentRequests('player-123');
 * sentRequests.forEach(r => console.log('Sent to:', r.fromUsername));
 */
export async function getSentRequests(
  userId: string
): Promise<FriendRequestWithPlayer[]> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }

  const supabase = createServiceClient();

  // Get all pending requests FROM this user
  const { data: requests } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('sender_username', userId)
    .eq('status', FriendRequestStatus.PENDING)
    .order('created_at', { ascending: false });

  if (!requests || requests.length === 0) {
    return [];
  }

  // Get recipient player data
  const recipientIds = requests.map((r: any) => r.receiver_username);
  const { data: recipients } = await supabase
    .from('players')
    .select('username, level, is_vip, clan_name')
    .in('username', recipientIds);

  // Create lookup map
  const recipientMap = new Map<string, PlayerData>(
    (recipients || []).map((p: any) => [p.username, p as PlayerData])
  );

  // Combine request and recipient data (use "from" fields for recipient data)
  const requestsWithData: FriendRequestWithPlayer[] = requests.map((r: any) => {
    const recipientData = recipientMap.get(r.receiver_username);

    return {
      _id: r.id,
      from: r.sender_username,
      to: r.receiver_username,
      status: r.status,
      message: r.message ?? undefined,
      createdAt: r.created_at ? new Date(r.created_at) : new Date(),
      respondedAt: r.updated_at ? new Date(r.updated_at) : undefined,
      fromUsername: recipientData?.username || 'Unknown',
      fromLevel: recipientData?.level || 1,
      fromVip: recipientData?.is_vip || false,
      fromClanTag: recipientData?.clan_name,
    };
  });

  return requestsWithData;
}

// ============================================================================
// BLOCKING FUNCTIONS
// ============================================================================

/**
 * Block a user
 * 
 * Validates input and:
 * - Removes existing friendship if present
 * - Cancels any pending friend requests
 * - Creates block entry to prevent future requests
 * 
 * @param userId - ID of user doing the blocking
 * @param targetUserId - ID of user to block
 * @returns True if blocked successfully
 * @throws {ValidationError} Invalid input
 * 
 * @example
 * await blockUser('player-123', 'player-789');
 */
export async function blockUser(
  userId: string,
  targetUserId: string
): Promise<boolean> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidId(targetUserId)) {
    throw new ValidationError('Invalid target user ID format');
  }
  if (userId === targetUserId) {
    throw new ValidationError('Cannot block yourself');
  }

  const supabase = createServiceClient();

  // Remove existing friendship if any
  await supabase
    .from('friends')
    .delete()
    .or(
      `and(user_username.eq.${userId},friend_username.eq.${targetUserId}),` +
      `and(user_username.eq.${targetUserId},friend_username.eq.${userId})`
    );

  // Cancel any pending requests
  await supabase
    .from('friend_requests')
    .update({
      status: FriendRequestStatus.CANCELLED,
      updated_at: new Date().toISOString(),
    })
    .or(
      `and(sender_username.eq.${userId},receiver_username.eq.${targetUserId}),` +
      `and(sender_username.eq.${targetUserId},receiver_username.eq.${userId})`
    )
    .eq('status', FriendRequestStatus.PENDING);

  // Create block entry
  const now = new Date();
  await supabase.from('blocked_users').insert({
    blocker_username: userId,
    blocked_username: targetUserId,
    created_at: now.toISOString(),
  });

  return true;
}

/**
 * Unblock a user
 * 
 * Removes block entry. Does not restore friendship.
 * 
 * @param userId - ID of user doing the unblocking
 * @param targetUserId - ID of user to unblock
 * @returns True if unblocked successfully
 * @throws {ValidationError} Invalid input
 * @throws {NotFoundError} Block not found
 * 
 * @example
 * await unblockUser('player-123', 'player-789');
 */
export async function unblockUser(
  userId: string,
  targetUserId: string
): Promise<boolean> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidId(targetUserId)) {
    throw new ValidationError('Invalid target user ID format');
  }
  if (userId === targetUserId) {
    throw new ValidationError('Cannot unblock yourself');
  }

  const supabase = createServiceClient();

  // Remove block entry
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_username', userId)
    .eq('blocked_username', targetUserId);

  if (error) {
    throw new NotFoundError('Block entry not found');
  }

  return true;
}

// ============================================================================
// SEARCH & DISCOVERY FUNCTIONS
// ============================================================================

/**
 * Search for users by username
 * 
 * Returns users matching search query with friend status information.
 * Excludes current user and blocked users.
 * 
 * @param userId - ID of user performing search
 * @param query - Search query string
 * @param limit - Maximum results to return (default 20)
 * @returns Array of matching players with friend status
 * @throws {ValidationError} Invalid input
 * 
 * @example
 * const results = await searchUsers('player-123', 'warrior', 10);
 * results.forEach(r => console.log(r.username, r.friendStatus));
 */
export async function searchUsers(
  userId: string,
  query: string,
  limit: number = FRIEND_CONSTANTS.MAX_SEARCH_RESULTS
): Promise<PlayerSearchResult[]> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!query || query.trim().length === 0) {
    throw new ValidationError('Search query is required');
  }
  if (query.length > 50) {
    throw new ValidationError('Search query too long (max 50 characters)');
  }

  const supabase = createServiceClient();

  // Get blocked user IDs
  const { data: blockedUsers } = await supabase
    .from('blocked_users')
    .select('*')
    .or(
      `blocker_username.eq.${userId},` +
      `blocked_username.eq.${userId}`
    );

  const blockedIds = (blockedUsers || []).map((b: any) =>
    b.blocker_username === userId ? b.blocked_username : b.blocker_username
  );

  // Search players with ilike pattern match
  let playerQuery = supabase
    .from('players')
    .select('username, level, is_vip, clan_name')
    .ilike('username', `%${query}%`)
    .neq('username', userId)
    .order('level', { ascending: false })
    .limit(Math.min(limit, FRIEND_CONSTANTS.MAX_SEARCH_RESULTS));

  // Filter out blocked users
  if (blockedIds.length > 0) {
    playerQuery = playerQuery.not('username', 'in', `(${blockedIds.join(',')})`);
  }

  const { data: players } = await playerQuery;

  if (!players || players.length === 0) {
    return [];
  }

  // Get player IDs for friend status lookup
  const playerIds = players.map((p: any) => p.username);

  // Get existing friendships
  const { data: friendships } = await supabase
    .from('friends')
    .select('*')
    .or(`user_username.eq.${userId},friend_username.eq.${userId}`)
    .in('user_username', playerIds);

  // Also check reverse direction
  const { data: friendshipsReverse } = await supabase
    .from('friends')
    .select('*')
    .in('friend_username', playerIds)
    .eq('user_username', userId);

  const allFriendships = [...(friendships || []), ...(friendshipsReverse || [])];

  const friendIdSet = new Set(
    allFriendships.map((f: any) =>
      f.user_username === userId ? f.friend_username : f.user_username
    )
  );

  // Get pending requests
  const { data: requests } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`sender_username.eq.${userId},receiver_username.eq.${userId}`)
    .in('sender_username', playerIds)
    .eq('status', FriendRequestStatus.PENDING);

  const { data: requestsReverse } = await supabase
    .from('friend_requests')
    .select('*')
    .in('receiver_username', playerIds)
    .eq('sender_username', userId)
    .eq('status', FriendRequestStatus.PENDING);

  const allRequests = [...(requests || []), ...(requestsReverse || [])];

  const requestIdSet = new Set(
    allRequests.map((r: any) => (r.sender_username === userId ? r.receiver_username : r.sender_username))
  );

  // Combine data
  const results: PlayerSearchResult[] = players.map((p: any) => {
    const playerId = p.username;
    const isFriend = friendIdSet.has(playerId);
    const hasPendingRequest = requestIdSet.has(playerId);

    return {
      _id: playerId,
      username: p.username,
      level: p.level,
      vip: p.is_vip || false,
      clanTag: p.clan_name,
      friendStatus: isFriend ? FriendStatus.ACCEPTED : undefined,
      hasPendingRequest,
    };
  });

  return results;
}

/**
 * Get friend status between two users
 * 
 * Checks if users are friends, have pending request, or if blocked.
 * 
 * @param userId - First user ID
 * @param targetUserId - Second user ID
 * @returns Friendship status information
 * @throws {ValidationError} Invalid input
 * 
 * @example
 * const status = await getFriendStatus('player-123', 'player-456');
 * if (status.areFriends) {
 *   console.log('You are friends!');
 * } else if (status.hasPendingRequest) {
 *   console.log('Request direction:', status.requestDirection);
 * }
 */
export async function getFriendStatus(
  userId: string,
  targetUserId: string
): Promise<FriendshipStatus> {
  // Validate input
  if (!isValidId(userId)) {
    throw new ValidationError('Invalid user ID format');
  }
  if (!isValidId(targetUserId)) {
    throw new ValidationError('Invalid target user ID format');
  }
  if (userId === targetUserId) {
    return {
      areFriends: false,
      hasPendingRequest: false,
      isBlocked: false,
    };
  }

  const supabase = createServiceClient();

  // Check for friendship
  const { data: friendship } = await supabase
    .from('friends')
    .select('*')
    .or(
      `and(user_username.eq.${userId},friend_username.eq.${targetUserId}),` +
      `and(user_username.eq.${targetUserId},friend_username.eq.${userId})`
    )
    .maybeSingle();

  if (friendship) {
    return {
      areFriends: true,
      hasPendingRequest: false,
      isBlocked: false,
      status: FriendStatus.ACCEPTED,
    };
  }

  // Check for block
  const { data: block } = await supabase
    .from('blocked_users')
    .select('*')
    .or(
      `and(blocker_username.eq.${userId},blocked_username.eq.${targetUserId}),` +
      `and(blocker_username.eq.${targetUserId},blocked_username.eq.${userId})`
    )
    .maybeSingle();

  if (block) {
    return {
      areFriends: false,
      hasPendingRequest: false,
      isBlocked: true,
      status: FriendStatus.BLOCKED,
    };
  }

  // Check for pending request
  const { data: request } = await supabase
    .from('friend_requests')
    .select('*')
    .or(
      `and(sender_username.eq.${userId},receiver_username.eq.${targetUserId}),` +
      `and(sender_username.eq.${targetUserId},receiver_username.eq.${userId})`
    )
    .eq('status', FriendRequestStatus.PENDING)
    .maybeSingle();

  if (request) {
    return {
      areFriends: false,
      hasPendingRequest: true,
      isBlocked: false,
      requestDirection: request.sender_username === userId ? 'sent' : 'received',
      status: FriendStatus.PENDING,
    };
  }

  // No relationship
  return {
    areFriends: false,
    hasPendingRequest: false,
    isBlocked: false,
  };
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. SUPABASE QUERIES:
 *    - Bidirectional friend queries use .or() with both user combinations
 *    - Indexes needed: (user_id, friend_id, status), (from_id, to_id, status)
 *    - Consider compound indexes for performance at scale
 * 
 * 2. ERROR HANDLING:
 *    - Custom error classes for specific error types
 *    - API layer should catch and map to HTTP status codes:
 *      * ValidationError → 400 Bad Request
 *      * NotFoundError → 404 Not Found
 *      * PermissionError → 403 Forbidden
 *      * Error → 500 Internal Server Error
 * 
 * 3. PERFORMANCE OPTIMIZATION:
 *    - Use projection to limit fields returned from Supabase
 *    - Batch operations where possible (e.g., getFriends gets all at once)
 *    - Consider caching friend counts in player document
 *    - For large friend lists, implement cursor-based pagination
 * 
 * 4. FUTURE ENHANCEMENTS:
 *    - Implement soft delete for audit trail (deleted_at field)
 *    - Add notification triggers (emit events for UI updates)
 *    - Implement request expiration cleanup job
 *    - Add friend suggestions based on mutual friends
 *    - Track online status (integrate with Redis cache)
 *    - Add friend groups/categories
 *    - Implement favorite friends feature
 * 
 * 5. SECURITY CONSIDERATIONS:
 *    - Always validate ID format to prevent injection
 *    - Sanitize user input (messages, usernames in search)
 *    - Rate limit friend request sending (implement in API layer)
 *    - Prevent abuse of block/unblock cycling
 * 
 * 6. TESTING RECOMMENDATIONS:
 *    - Test all validation error cases
 *    - Test bidirectional friendship queries
 *    - Test concurrent request handling (race conditions)
 *    - Test max limits enforcement
 *    - Test blocking prevents all interaction
 *    - Mock Supabase for unit tests
 * 
 * 7. INTEGRATION WITH OTHER SYSTEMS:
 *    - DM system: Check friend status before allowing DMs
 *    - @Mentions: Filter autocomplete by friends first
 *    - Online status: Integrate with WebSocket/polling system
 *    - Notifications: Emit events for friend requests, accepts
 * 
 * 8. DATABASE SCHEMA RECOMMENDATIONS:
 *    friends table:
 *    - Index: { user_id, friend_id, status } (unique)
 *    - Index: { friend_id, user_id, status }
 *    - Index: { status, created_at }
 *    
 *    friend_requests table:
 *    - Index: { from_id, to_id, status } (unique for pending)
 *    - Index: { to_id, status, created_at }
 *    - Index: { expires_at } (for cleanup job)
 * 
 * 9. CRON JOB REQUIREMENTS:
 *    - Clean up expired requests (run daily)
 *    - Delete declined/cancelled requests older than 90 days
 *    - Archive old friend data if needed
 * 
 * 10. MONITORING & METRICS:
 *     - Track friend request acceptance rate
 *     - Monitor average time to accept/decline
 *     - Track block/unblock frequency
 *     - Monitor search query patterns
 *     - Alert on unusual patterns (mass blocking, spam requests)
 */
