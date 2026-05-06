/**
 * @file components/friends/index.ts
 * @created 2025-10-26
 * @updated 2025-10-26 (FID-20251026-001: Full ECHO Architecture Compliance)
 * @overview Friend System Components - Barrel Export
 * 
 * OVERVIEW:
 * Central export point for all friend system components including friends list,
 * friend requests panel, add friend modal, and friend actions menu.
 * 
 * Usage:
 * ```typescript
 * import { FriendsList, FriendRequestsPanel, AddFriendModal } from '@/components/friends';
 * ```
 */

// ============================================================================
// FRIEND SYSTEM COMPONENTS
// ============================================================================

// Friends list with online status indicators
export { default as FriendsList } from './FriendsList';

// Friend requests panel (pending incoming/outgoing requests)
export { default as FriendRequestsPanel } from './FriendRequestsPanel';

// Add friend modal (search users and send friend requests)
export { default as AddFriendModal } from './AddFriendModal';

// Friend actions menu (remove friend, block user, send message)
export { default as FriendActionsMenu } from './FriendActionsMenu';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * Component Usage:
 * 
 * Friends List:
 * ```typescript
 * import { FriendsList } from '@/components/friends';
 * 
 * <FriendsList 
 *   friends={friends} 
 *   onSelectFriend={handleSelectFriend}
 *   onRemoveFriend={handleRemoveFriend}
 * />
 * ```
 * 
 * Friend Requests Panel:
 * ```typescript
 * import { FriendRequestsPanel } from '@/components/friends';
 * 
 * <FriendRequestsPanel
 *   pendingRequests={requests}
 *   onAccept={handleAccept}
 *   onDecline={handleDecline}
 * />
 * ```
 * 
 * Add Friend Modal:
 * ```typescript
 * import { AddFriendModal } from '@/components/friends';
 * 
 * <AddFriendModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onSendRequest={handleSendRequest}
 * />
 * ```
 * 
 * Friend Actions Menu:
 * ```typescript
 * import { FriendActionsMenu } from '@/components/friends';
 * 
 * <FriendActionsMenu
 *   friendId={friendId}
 *   onRemove={handleRemove}
 *   onBlock={handleBlock}
 *   onMessage={handleMessage}
 * />
 * ```
 * 
 * Features:
 * - Real-time online status tracking (green dots for online friends)
 * - Friend request management (accept, decline, cancel)
 * - User search with debouncing
 * - Block/unblock functionality
 * - Direct message integration
 * - HTTP polling for status updates (or WebSocket events)
 * 
 * Integration:
 * - Friend API: app/api/friends/ endpoints
 * - DM Integration: components/messaging/ components
 * - Online Status: WebSocket events or HTTP polling
 * - TopNavBar: Friends icon with notification badge
 */

// ============================================================================
// END OF FILE
// ============================================================================
