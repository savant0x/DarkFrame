/**
 * Friend System Type Definitions
 * Created: 2025-10-26
 * 
 * OVERVIEW:
 * This file defines all TypeScript types and interfaces for the friend system,
 * including friend relationships, friend requests, online status tracking, and
 * blocking functionality. The friend system enables players to connect with each
 * other, track online status, and manage social interactions within the game.
 * 
 * KEY FEATURES:
 * - Friend relationships with bidirectional tracking
 * - Friend request workflow (send, accept, decline)
 * - Block/unblock functionality for user safety
 * - Online status tracking with last seen timestamps
 * - Type-safe friend list management
 * - Search and discovery of potential friends
 * 
 * ARCHITECTURE:
 * The friend system uses two MongoDB collections:
 * 1. friends - Stores accepted friend relationships
 * 2. friendRequests - Stores pending friend requests
 * 
 * Friend relationships are bidirectional but stored as single documents to avoid
 * duplication. The system tracks who initiated the friendship for analytics but
 * treats both users equally in the relationship.
 * 
 * DATABASE SCHEMA:
 * 
 * friends collection:
 * {
 *   _id: ObjectId,
 *   userId: string (player ID who initiated),
 *   friendId: string (player ID who accepted),
 *   status: 'accepted' | 'blocked',
 *   initiatedBy: string (userId of requester),
 *   createdAt: Date,
 *   updatedAt: Date
 * }
 * 
 * friendRequests collection:
 * {
 *   _id: ObjectId,
 *   from: string (sender player ID),
 *   to: string (recipient player ID),
 *   status: 'pending' | 'accepted' | 'declined' | 'cancelled',
 *   message: string? (optional intro message),
 *   createdAt: Date,
 *   respondedAt: Date? (when accepted/declined)
 * }
 * 
 * INTEGRATION:
 * - Used by lib/friendService.ts for business logic
 * - Used by API routes in app/api/friends/
 * - Used by UI components in components/friends/
 * - Integrates with DM system for friend-to-message workflow
 * - Integrates with @mention system for friend autocomplete
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Friend relationship status
 * 
 * @enum {string}
 * @property {string} PENDING - Friend request sent but not yet accepted
 * @property {string} ACCEPTED - Friend request accepted, active friendship
 * @property {string} BLOCKED - User has blocked this player
 * @property {string} DECLINED - Friend request was declined
 * @property {string} CANCELLED - Friend request was cancelled by sender
 */
export enum FriendStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  BLOCKED = 'blocked',
  DECLINED = 'declined',
  CANCELLED = 'cancelled'
}

/**
 * Friend request status tracking
 * 
 * @enum {string}
 * @property {string} PENDING - Request sent, awaiting response
 * @property {string} ACCEPTED - Request accepted, friendship created
 * @property {string} DECLINED - Request declined by recipient
 * @property {string} CANCELLED - Request cancelled by sender
 */
export enum FriendRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled'
}

/**
 * Online status for real-time presence tracking
 * 
 * @enum {string}
 * @property {string} ONLINE - User currently active in game
 * @property {string} OFFLINE - User not currently active
 * @property {string} AWAY - User idle for extended period
 * @property {string} INVISIBLE - User online but appearing offline
 */
export enum OnlineStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  INVISIBLE = 'invisible'
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Friend relationship document
 * 
 * Represents an accepted friendship between two players. Stored as a single
 * document with bidirectional relationship (both users are friends).
 * 
 * @interface Friend
 * @property {string} _id - MongoDB ObjectId as string
 * @property {string} userId - ID of user who initiated friendship
 * @property {string} friendId - ID of user who accepted friendship
 * @property {FriendStatus} status - Current status (typically 'accepted')
 * @property {string} initiatedBy - ID of user who sent original request
 * @property {Date} createdAt - When friendship was established
 * @property {Date} updatedAt - When relationship was last modified
 * @property {boolean} [isBlocked] - Optional flag if either user blocked the other
 * @property {string} [blockedBy] - Optional ID of user who blocked (if isBlocked true)
 * 
 * @example
 * const friendship: Friend = {
 *   _id: '507f1f77bcf86cd799439011',
 *   userId: 'player-123',
 *   friendId: 'player-456',
 *   status: FriendStatus.ACCEPTED,
 *   initiatedBy: 'player-123',
 *   createdAt: new Date('2025-10-26T10:00:00Z'),
 *   updatedAt: new Date('2025-10-26T10:00:00Z')
 * };
 */
export interface Friend {
  _id: string;
  userId: string;
  friendId: string;
  status: FriendStatus;
  initiatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  isBlocked?: boolean;
  blockedBy?: string;
}

/**
 * Friend request document
 * 
 * Represents a pending, accepted, declined, or cancelled friend request.
 * Once accepted, a Friend document is created and this request is marked accepted.
 * 
 * @interface FriendRequest
 * @property {string} _id - MongoDB ObjectId as string
 * @property {string} from - ID of player who sent request
 * @property {string} to - ID of player who received request
 * @property {FriendRequestStatus} status - Current request status
 * @property {string} [message] - Optional intro message from sender
 * @property {Date} createdAt - When request was sent
 * @property {Date} [respondedAt] - When request was accepted/declined
 * @property {Date} [expiresAt] - Optional expiration date for request
 * 
 * @example
 * const request: FriendRequest = {
 *   _id: '507f1f77bcf86cd799439012',
 *   from: 'player-123',
 *   to: 'player-456',
 *   status: FriendRequestStatus.PENDING,
 *   message: 'Hey! Want to team up?',
 *   createdAt: new Date('2025-10-26T10:00:00Z')
 * };
 */
export interface FriendRequest {
  _id: string;
  from: string;
  to: string;
  status: FriendRequestStatus;
  message?: string;
  createdAt: Date;
  respondedAt?: Date;
  expiresAt?: Date;
}

/**
 * Online status tracking for a player
 * 
 * Tracks real-time presence information for friends list display.
 * Updated via HTTP polling or WebSocket connections.
 * 
 * @interface PlayerOnlineStatus
 * @property {string} userId - Player ID
 * @property {OnlineStatus} status - Current online status
 * @property {Date} lastSeen - Last activity timestamp
 * @property {Date} [lastStatusChange] - When status last changed
 * @property {string} [currentActivity] - Optional current activity description
 * 
 * @example
 * const status: PlayerOnlineStatus = {
 *   userId: 'player-123',
 *   status: OnlineStatus.ONLINE,
 *   lastSeen: new Date(),
 *   currentActivity: 'Exploring the wasteland'
 * };
 */
export interface PlayerOnlineStatus {
  userId: string;
  status: OnlineStatus;
  lastSeen: Date;
  lastStatusChange?: Date;
  currentActivity?: string;
}

// ============================================================================
// EXTENDED INTERFACES (WITH PLAYER DATA)
// ============================================================================

/**
 * Friend with populated player information
 * 
 * Extends Friend interface with username, level, and other display data.
 * Used in UI components for rendering friend lists.
 * 
 * @interface FriendWithPlayer
 * @extends Friend
 * @property {string} username - Friend's display name
 * @property {number} level - Friend's current level
 * @property {boolean} [vip] - Whether friend has VIP status
 * @property {string} [clanTag] - Friend's clan tag if in clan
 * @property {PlayerOnlineStatus} [onlineStatus] - Current online status
 * 
 * @example
 * const friendWithData: FriendWithPlayer = {
 *   _id: '507f1f77bcf86cd799439011',
 *   userId: 'player-123',
 *   friendId: 'player-456',
 *   status: FriendStatus.ACCEPTED,
 *   initiatedBy: 'player-123',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   username: 'WastelandWarrior',
 *   level: 42,
 *   vip: true,
 *   clanTag: 'APEX',
 *   onlineStatus: {
 *     userId: 'player-456',
 *     status: OnlineStatus.ONLINE,
 *     lastSeen: new Date()
 *   }
 * };
 */
export interface FriendWithPlayer extends Friend {
  username: string;
  level: number;
  vip?: boolean;
  clanTag?: string;
  onlineStatus?: PlayerOnlineStatus;
}

/**
 * Friend request with populated sender information
 * 
 * Extends FriendRequest with sender's display data for UI rendering.
 * 
 * @interface FriendRequestWithPlayer
 * @extends FriendRequest
 * @property {string} fromUsername - Sender's display name
 * @property {number} fromLevel - Sender's current level
 * @property {boolean} [fromVip] - Whether sender has VIP status
 * @property {string} [fromClanTag] - Sender's clan tag if in clan
 * 
 * @example
 * const requestWithData: FriendRequestWithPlayer = {
 *   _id: '507f1f77bcf86cd799439012',
 *   from: 'player-123',
 *   to: 'player-456',
 *   status: FriendRequestStatus.PENDING,
 *   message: 'Want to team up?',
 *   createdAt: new Date(),
 *   fromUsername: 'ScavengerKing',
 *   fromLevel: 35,
 *   fromVip: false
 * };
 */
export interface FriendRequestWithPlayer extends FriendRequest {
  fromUsername: string;
  fromLevel: number;
  fromVip?: boolean;
  fromClanTag?: string;
}

// ============================================================================
// API RESPONSE INTERFACES
// ============================================================================

/**
 * Response for friend list API endpoint
 * 
 * @interface GetFriendsResponse
 * @property {boolean} success - Whether request succeeded
 * @property {FriendWithPlayer[]} friends - Array of friends with player data
 * @property {number} total - Total number of friends
 * @property {string} [error] - Error message if success is false
 * 
 * @example
 * const response: GetFriendsResponse = {
 *   success: true,
 *   friends: [
 *     { ...friendData1 },
 *     { ...friendData2 }
 *   ],
 *   total: 2
 * };
 */
export interface GetFriendsResponse {
  success: boolean;
  friends: FriendWithPlayer[];
  total: number;
  error?: string;
}

/**
 * Response for friend requests API endpoint
 * 
 * @interface GetFriendRequestsResponse
 * @property {boolean} success - Whether request succeeded
 * @property {FriendRequestWithPlayer[]} requests - Array of requests with player data
 * @property {number} total - Total number of pending requests
 * @property {string} [error] - Error message if success is false
 * 
 * @example
 * const response: GetFriendRequestsResponse = {
 *   success: true,
 *   requests: [
 *     { ...requestData1 },
 *     { ...requestData2 }
 *   ],
 *   total: 2
 * };
 */
export interface GetFriendRequestsResponse {
  success: boolean;
  requests: FriendRequestWithPlayer[];
  total: number;
  error?: string;
}

/**
 * Response for send friend request API endpoint
 * 
 * @interface SendFriendRequestResponse
 * @property {boolean} success - Whether request was sent successfully
 * @property {FriendRequest} [request] - The created friend request
 * @property {string} [message] - Success or error message
 * @property {string} [error] - Error message if success is false
 * 
 * @example
 * const response: SendFriendRequestResponse = {
 *   success: true,
 *   request: { ...requestData },
 *   message: 'Friend request sent successfully'
 * };
 */
export interface SendFriendRequestResponse {
  success: boolean;
  request?: FriendRequest;
  message?: string;
  error?: string;
}

/**
 * Response for accept/decline friend request API endpoint
 * 
 * @interface RespondToFriendRequestResponse
 * @property {boolean} success - Whether response was processed
 * @property {Friend} [friendship] - Created friendship if accepted
 * @property {FriendRequest} [request] - Updated request document
 * @property {string} [message] - Success or error message
 * @property {string} [error] - Error message if success is false
 * 
 * @example
 * const response: RespondToFriendRequestResponse = {
 *   success: true,
 *   friendship: { ...friendshipData },
 *   message: 'Friend request accepted'
 * };
 */
export interface RespondToFriendRequestResponse {
  success: boolean;
  friendship?: Friend;
  request?: FriendRequest;
  message?: string;
  error?: string;
}

/**
 * Response for remove friend API endpoint
 * 
 * @interface RemoveFriendResponse
 * @property {boolean} success - Whether friend was removed
 * @property {string} [message] - Success or error message
 * @property {string} [error] - Error message if success is false
 * 
 * @example
 * const response: RemoveFriendResponse = {
 *   success: true,
 *   message: 'Friend removed successfully'
 * };
 */
export interface RemoveFriendResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Response for block user API endpoint
 * 
 * @interface BlockUserResponse
 * @property {boolean} success - Whether user was blocked
 * @property {string} [message] - Success or error message
 * @property {string} [error] - Error message if success is false
 * 
 * @example
 * const response: BlockUserResponse = {
 *   success: true,
 *   message: 'User blocked successfully'
 * };
 */
export interface BlockUserResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================================================
// REQUEST PAYLOAD INTERFACES
// ============================================================================

/**
 * Payload for sending a friend request
 * 
 * @interface SendFriendRequestPayload
 * @property {string} toUserId - ID of player to send request to
 * @property {string} [message] - Optional intro message (max 200 chars)
 * 
 * @example
 * const payload: SendFriendRequestPayload = {
 *   toUserId: 'player-456',
 *   message: 'Hey! Want to team up for raids?'
 * };
 */
export interface SendFriendRequestPayload {
  toUserId: string;
  message?: string;
}

/**
 * Payload for responding to a friend request
 * 
 * @interface RespondToFriendRequestPayload
 * @property {string} requestId - ID of friend request to respond to
 * @property {boolean} accept - True to accept, false to decline
 * 
 * @example
 * const payload: RespondToFriendRequestPayload = {
 *   requestId: '507f1f77bcf86cd799439012',
 *   accept: true
 * };
 */
export interface RespondToFriendRequestPayload {
  requestId: string;
  accept: boolean;
}

/**
 * Payload for removing a friend
 * 
 * @interface RemoveFriendPayload
 * @property {string} friendId - ID of friend to remove
 * 
 * @example
 * const payload: RemoveFriendPayload = {
 *   friendId: 'player-456'
 * };
 */
export interface RemoveFriendPayload {
  friendId: string;
}

/**
 * Payload for blocking a user
 * 
 * @interface BlockUserPayload
 * @property {string} userId - ID of user to block
 * @property {string} [reason] - Optional reason for blocking
 * 
 * @example
 * const payload: BlockUserPayload = {
 *   userId: 'player-789',
 *   reason: 'Harassment'
 * };
 */
export interface BlockUserPayload {
  userId: string;
  reason?: string;
}

// ============================================================================
// SEARCH & DISCOVERY INTERFACES
// ============================================================================

/**
 * Player search result for friend discovery
 * 
 * @interface PlayerSearchResult
 * @property {string} _id - Player ID
 * @property {string} username - Player's display name
 * @property {number} level - Player's current level
 * @property {boolean} [vip] - Whether player has VIP status
 * @property {string} [clanTag] - Player's clan tag if in clan
 * @property {FriendStatus} [friendStatus] - Current friend status with searcher
 * @property {boolean} [hasPendingRequest] - Whether there's a pending request
 * @property {OnlineStatus} [onlineStatus] - Current online status
 * 
 * @example
 * const result: PlayerSearchResult = {
 *   _id: 'player-789',
 *   username: 'RaidLeader',
 *   level: 50,
 *   vip: true,
 *   clanTag: 'ELITE',
 *   friendStatus: FriendStatus.PENDING,
 *   hasPendingRequest: true
 * };
 */
export interface PlayerSearchResult {
  _id: string;
  username: string;
  level: number;
  vip?: boolean;
  clanTag?: string;
  friendStatus?: FriendStatus;
  hasPendingRequest?: boolean;
  onlineStatus?: OnlineStatus;
}

/**
 * Response for player search API endpoint
 * 
 * @interface SearchPlayersResponse
 * @property {boolean} success - Whether search succeeded
 * @property {PlayerSearchResult[]} players - Array of matching players
 * @property {number} total - Total number of results
 * @property {string} [error] - Error message if success is false
 * 
 * @example
 * const response: SearchPlayersResponse = {
 *   success: true,
 *   players: [
 *     { ...playerData1 },
 *     { ...playerData2 }
 *   ],
 *   total: 2
 * };
 */
export interface SearchPlayersResponse {
  success: boolean;
  players: PlayerSearchResult[];
  total: number;
  error?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Friend status summary for a user
 * 
 * Provides counts and lists for different friend relationship states.
 * Used in UI to display friend statistics.
 * 
 * @interface FriendStatusSummary
 * @property {number} totalFriends - Total accepted friends
 * @property {number} pendingReceived - Pending requests received
 * @property {number} pendingSent - Pending requests sent
 * @property {number} blocked - Number of blocked users
 * @property {number} onlineFriends - Number of friends currently online
 * 
 * @example
 * const summary: FriendStatusSummary = {
 *   totalFriends: 15,
 *   pendingReceived: 3,
 *   pendingSent: 2,
 *   blocked: 1,
 *   onlineFriends: 7
 * };
 */
export interface FriendStatusSummary {
  totalFriends: number;
  pendingReceived: number;
  pendingSent: number;
  blocked: number;
  onlineFriends: number;
}

/**
 * Friend relationship check result
 * 
 * Returned by getFriendStatus() to determine current relationship state.
 * 
 * @interface FriendshipStatus
 * @property {boolean} areFriends - Whether users are friends
 * @property {boolean} hasPendingRequest - Whether there's a pending request
 * @property {boolean} isBlocked - Whether user is blocked
 * @property {string} [requestDirection] - 'sent' | 'received' if pending
 * @property {FriendStatus} [status] - Current friend status if exists
 * 
 * @example
 * const status: FriendshipStatus = {
 *   areFriends: false,
 *   hasPendingRequest: true,
 *   isBlocked: false,
 *   requestDirection: 'sent',
 *   status: FriendStatus.PENDING
 * };
 */
export interface FriendshipStatus {
  areFriends: boolean;
  hasPendingRequest: boolean;
  isBlocked: boolean;
  requestDirection?: 'sent' | 'received';
  status?: FriendStatus;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if object is a valid Friend
 * 
 * @param obj - Object to check
 * @returns True if object is a Friend
 * 
 * @example
 * if (isFriend(data)) {
 *   console.log(`Friends since ${data.createdAt}`);
 * }
 */
export function isFriend(obj: unknown): obj is Friend {
  if (!obj || typeof obj !== 'object') return false;
  
  const f = obj as Record<string, unknown>;
  
  return (
    typeof f._id === 'string' &&
    typeof f.userId === 'string' &&
    typeof f.friendId === 'string' &&
    typeof f.status === 'string' &&
    Object.values(FriendStatus).includes(f.status as FriendStatus) &&
    typeof f.initiatedBy === 'string' &&
    f.createdAt instanceof Date &&
    f.updatedAt instanceof Date
  );
}

/**
 * Type guard to check if object is a valid FriendRequest
 * 
 * @param obj - Object to check
 * @returns True if object is a FriendRequest
 * 
 * @example
 * if (isFriendRequest(data)) {
 *   console.log(`Request from ${data.from} to ${data.to}`);
 * }
 */
export function isFriendRequest(obj: unknown): obj is FriendRequest {
  if (!obj || typeof obj !== 'object') return false;
  
  const fr = obj as Record<string, unknown>;
  
  return (
    typeof fr._id === 'string' &&
    typeof fr.from === 'string' &&
    typeof fr.to === 'string' &&
    typeof fr.status === 'string' &&
    Object.values(FriendRequestStatus).includes(fr.status as FriendRequestStatus) &&
    fr.createdAt instanceof Date &&
    (fr.message === undefined || typeof fr.message === 'string')
  );
}

/**
 * Type guard to check if object is a valid PlayerOnlineStatus
 * 
 * @param obj - Object to check
 * @returns True if object is a PlayerOnlineStatus
 * 
 * @example
 * if (isPlayerOnlineStatus(data)) {
 *   console.log(`${data.userId} is ${data.status}`);
 * }
 */
export function isPlayerOnlineStatus(obj: unknown): obj is PlayerOnlineStatus {
  if (!obj || typeof obj !== 'object') return false;
  
  const pos = obj as Record<string, unknown>;
  
  return (
    typeof pos.userId === 'string' &&
    typeof pos.status === 'string' &&
    Object.values(OnlineStatus).includes(pos.status as OnlineStatus) &&
    pos.lastSeen instanceof Date
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Friend system constants and limits
 */
export const FRIEND_CONSTANTS = {
  /** Maximum number of friends a player can have */
  MAX_FRIENDS: 100,
  
  /** Maximum number of pending friend requests (sent + received) */
  MAX_PENDING_REQUESTS: 50,
  
  /** Maximum length of friend request message */
  MAX_REQUEST_MESSAGE_LENGTH: 200,
  
  /** Friend request expiration time in days */
  REQUEST_EXPIRATION_DAYS: 30,
  
  /** Online status timeout in minutes (mark as away) */
  AWAY_TIMEOUT_MINUTES: 15,
  
  /** Online status timeout in hours (mark as offline) */
  OFFLINE_TIMEOUT_HOURS: 24,
  
  /** Polling interval for online status updates (milliseconds) */
  STATUS_POLL_INTERVAL_MS: 30000, // 30 seconds
  
  /** Maximum number of players in search results */
  MAX_SEARCH_RESULTS: 20,
} as const;

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. FRIEND STORAGE STRATEGY:
 *    - Store each friendship as single document (not duplicated)
 *    - Use compound queries to find friends: $or: [{ userId: X }, { friendId: X }]
 *    - Index on both userId and friendId for query performance
 *    - Compound index on (userId, friendId) for uniqueness
 * 
 * 2. BLOCKING IMPLEMENTATION:
 *    - Blocking can be done without existing friendship
 *    - Blocked users cannot send friend requests
 *    - Blocked users cannot send DMs
 *    - Blocked users don't appear in search results
 *    - Consider separate blockedUsers collection for non-friends
 * 
 * 3. ONLINE STATUS:
 *    - Use Redis or in-memory cache for real-time status
 *    - Update lastSeen on every user action
 *    - HTTP polling every 30 seconds for friend list
 *    - Consider WebSocket for instant status updates
 *    - Fall back to lastSeen timestamp if status data unavailable
 * 
 * 4. REQUEST EXPIRATION:
 *    - Implement background job to clean up expired requests
 *    - Set expiresAt = createdAt + 30 days
 *    - Auto-decline or archive requests past expiration
 *    - Notify sender if request expired
 * 
 * 5. PERFORMANCE OPTIMIZATION:
 *    - Index on (from, status) for pending requests
 *    - Index on (to, status) for received requests
 *    - Index on (userId, friendId, status) for friend lookups
 *    - Cache friend counts in player document
 *    - Paginate friend lists for users with many friends
 * 
 * 6. PRIVACY CONSIDERATIONS:
 *    - Allow users to disable friend requests (privacy setting)
 *    - Allow users to hide online status (appear offline)
 *    - Allow users to limit who can send requests (friends-of-friends only)
 *    - Block feature prevents all interaction
 * 
 * 7. INTEGRATION WITH DM SYSTEM:
 *    - "Message" button in friend actions opens DM conversation
 *    - DM system should check friendship status
 *    - Non-friends can be allowed to DM or restricted (config option)
 *    - Friend status shown in DM conversation header
 * 
 * 8. INTEGRATION WITH @MENTIONS:
 *    - Autocomplete should prioritize friends over non-friends
 *    - Show online status indicator in mention suggestions
 *    - Filter out blocked users from mention suggestions
 * 
 * 9. NOTIFICATION REQUIREMENTS:
 *    - Notify when friend request received
 *    - Notify when friend request accepted
 *    - Notify when friend comes online (optional, can be noisy)
 *    - Notify when friend sends DM
 *    - Badge count for pending requests
 * 
 * 10. TESTING CONSIDERATIONS:
 *     - Test bidirectional friend queries
 *     - Test blocking prevents all interaction
 *     - Test request expiration cleanup
 *     - Test max friends limit enforcement
 *     - Test concurrent request handling (race conditions)
 *     - Test friend removal updates both users
 * 
 * FUTURE ENHANCEMENTS:
 * - Friend groups/categories (Best Friends, Clan Members, etc.)
 * - Favorite friends (prioritized in lists)
 * - Friend activity feed (level ups, achievements, etc.)
 * - Friend recommendations based on clan, level, playtime
 * - Mutual friends count in search results
 * - Friend referral rewards system
 * - Friend leaderboards
 */
