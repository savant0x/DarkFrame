/**
 * Messages Page
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * Full-featured private messaging interface combining inbox and thread views.
 * Supports real-time message delivery via Socket.io, typing indicators,
 * read receipts, and conversation management. Integrates with existing
 * MessageInbox and MessageThread components.
 * 
 * KEY FEATURES:
 * - Split-pane responsive layout (desktop: side-by-side, mobile: stacked)
 * - Real-time Socket.io event integration
 * - Connection status indicator with reconnection
 * - Unread message counter
 * - Conversation selection with recipient extraction
 * - Auto-join/leave conversation rooms
 * 
 * DEPENDENCIES:
 * - useGameContext() for current player data
 * - useWebSocket() for real-time events
 * - MessageInbox component
 * - MessageThread component
 * 
 * SOCKET.IO EVENTS HANDLED:
 * - message:receive - Incoming messages
 * - conversation:updated - Conversation metadata changes
 * - message:read - Read receipt updates
 * - typing:start - Typing indicators
 * - typing:stop - Typing stopped
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MessageInbox, MessageThread } from '@/components/messaging';
import { useGameContext } from '@/context/GameContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Conversation } from '@/types/messaging.types';
import type {
  MessagingMessagePayload,
  MessagingConversationPayload,
  MessagingTypingPayload,
  MessagingReadReceiptPayload,
} from '@/types/websocket';

/**
 * Page state interface
 */
interface MessagesPageState {
  selectedConversationId: string | null;
  selectedRecipientId: string | null;
  selectedRecipientUsername: string | null;
  conversations: Conversation[];
  totalUnreadCount: number;
  isMobileView: boolean;
  showThread: boolean; // Mobile: toggle between inbox and thread
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

/**
 * Messages Page Component
 * Main container for private messaging interface
 * 
 * @returns Messages page JSX
 */
export default function MessagesPage() {
  const router = useRouter();
  const { player, isLoading: playerLoading } = useGameContext();
  const { emit, on, isConnected, connectionState, reconnect } = useWebSocket();

  const [state, setState] = useState<MessagesPageState>({
    selectedConversationId: null,
    selectedRecipientId: null,
    selectedRecipientUsername: null,
    conversations: [],
    totalUnreadCount: 0,
    isMobileView: false,
    showThread: false,
    connectionStatus: 'connecting',
  });

  // ============================================================================
  // AUTHENTICATION & REDIRECT
  // ============================================================================

  useEffect(() => {
    if (!playerLoading && !player) {
      // No authenticated player, redirect to login
      router.push('/login');
    }
  }, [player, playerLoading, router]);

  // Get current player username
  const currentPlayerId = useMemo(() => {
    return player?.username || '';
  }, [player]);

  // ============================================================================
  // RESPONSIVE LAYOUT DETECTION
  // ============================================================================

  useEffect(() => {
    const checkMobile = () => {
      setState(prev => ({
        ...prev,
        isMobileView: window.innerWidth < 768,
      }));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ============================================================================
  // CONNECTION STATUS SYNC
  // ============================================================================

  useEffect(() => {
    setState(prev => ({
      ...prev,
      connectionStatus: connectionState,
    }));
  }, [connectionState]);

  // ============================================================================
  // SOCKET.IO EVENT HANDLERS
  // ============================================================================

  /**
   * Handle incoming message
   * Updates conversation list and triggers UI updates
   */
  const handleMessageReceive = useCallback((payload: MessagingMessagePayload) => {
    console.log('[Messages] Received message:', payload);

    setState(prev => {
      const conversations = [...prev.conversations];
      const convIndex = conversations.findIndex(
        c => c._id.toString() === payload.conversationId
      );

      if (convIndex !== -1) {
        // Update existing conversation
        const conv = conversations[convIndex];
        const updatedConv = {
          ...conv,
          lastMessage: {
            content: payload.content,
            senderId: payload.senderId,
            createdAt: payload.createdAt,
            status: payload.status,
          },
          updatedAt: new Date(),
        };

        // Move to top of list
        conversations.splice(convIndex, 1);
        conversations.unshift(updatedConv);

        // Update unread count if not current conversation
        if (payload.conversationId !== prev.selectedConversationId && payload.senderId !== currentPlayerId) {
          const currentCount = conv.unreadCount[currentPlayerId] || 0;
          updatedConv.unreadCount = {
            ...conv.unreadCount,
            [currentPlayerId]: currentCount + 1,
          };
        }
      }

      // Recalculate total unread
      const totalUnread = conversations.reduce((sum, c) => {
        return sum + (c.unreadCount[currentPlayerId] || 0);
      }, 0);

      return {
        ...prev,
        conversations,
        totalUnreadCount: totalUnread,
      };
    });
  }, [currentPlayerId]);

  /**
   * Handle conversation metadata update
   * Updates conversation details (last message, unread counts, etc.)
   */
  const handleConversationUpdated = useCallback((payload: MessagingConversationPayload) => {
    console.log('[Messages] Conversation updated:', payload);

    setState(prev => {
      const conversations = [...prev.conversations];
      const convIndex = conversations.findIndex(
        c => c._id.toString() === payload._id
      );

      if (convIndex !== -1) {
        // Update existing conversation
        conversations[convIndex] = payload as any;
      } else {
        // New conversation - add to top
        conversations.unshift(payload as any);
      }

      // Recalculate total unread
      const totalUnread = conversations.reduce((sum, c) => {
        return sum + (c.unreadCount[currentPlayerId] || 0);
      }, 0);

      return {
        ...prev,
        conversations,
        totalUnreadCount: totalUnread,
      };
    });
  }, [currentPlayerId]);

  /**
   * Handle read receipt
   * MessageThread component handles this internally
   */
  const handleReadReceipt = useCallback((payload: MessagingReadReceiptPayload) => {
    console.log('[Messages] Read receipt:', payload);
    
    // Update unread count in conversation list
    setState(prev => {
      const conversations = prev.conversations.map(c => {
        if (c._id.toString() === payload.conversationId && payload.playerId === currentPlayerId) {
          return {
            ...c,
            unreadCount: {
              ...c.unreadCount,
              [currentPlayerId]: 0,
            },
          };
        }
        return c;
      });

      // Recalculate total unread
      const totalUnread = conversations.reduce((sum, c) => {
        return sum + (c.unreadCount[currentPlayerId] || 0);
      }, 0);

      return {
        ...prev,
        conversations,
        totalUnreadCount: totalUnread,
      };
    });
  }, [currentPlayerId]);

  /**
   * Handle typing indicators
   * MessageThread component handles display
   */
  const handleTypingStart = useCallback((payload: MessagingTypingPayload) => {
    console.log('[Messages] Typing started:', payload);
    // MessageThread component will handle this
  }, []);

  const handleTypingStop = useCallback((payload: MessagingTypingPayload) => {
    console.log('[Messages] Typing stopped:', payload);
    // MessageThread component will handle this
  }, []);

  // ============================================================================
  // REGISTER SOCKET.IO EVENT LISTENERS
  // ============================================================================

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers = [
      on('message:receive', handleMessageReceive),
      on('conversation:updated', handleConversationUpdated),
      on('message:read', handleReadReceipt),
      on('typing:start', handleTypingStart),
      on('typing:stop', handleTypingStop),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isConnected, on, handleMessageReceive, handleConversationUpdated, handleReadReceipt, handleTypingStart, handleTypingStop]);

  // ============================================================================
  // CONVERSATION MANAGEMENT
  // ============================================================================

  /**
   * Handle conversation selection
   * Extracts recipient info and joins conversation room
   */
  const handleConversationSelect = useCallback((conversationId: string) => {
    // Find conversation to extract recipient info
    const conversation = state.conversations.find(c => c._id.toString() === conversationId);
    if (!conversation) {
      console.error('[Messages] Selected conversation not found:', conversationId);
      return;
    }

    // Extract recipient (other participant)
    const recipientId = conversation.participants.find(p => p !== currentPlayerId);
    if (!recipientId) {
      console.error('[Messages] Could not determine recipient for conversation:', conversationId);
      return;
    }

    // Get recipient username (for now, using ID as username since API uses usernames)
    const recipientUsername = recipientId;

    setState(prev => ({
      ...prev,
      selectedConversationId: conversationId,
      selectedRecipientId: recipientId,
      selectedRecipientUsername: recipientUsername,
      showThread: true, // For mobile view
    }));

    // Join conversation room via Socket.io
    emit('conversation:join', { conversationId });

    console.log('[Messages] Joined conversation:', conversationId, 'with recipient:', recipientUsername);
  }, [currentPlayerId, state.conversations, emit]);

  /**
   * Handle back to inbox (mobile)
   * Leaves conversation room
   */
  const handleBackToInbox = useCallback(() => {
    if (state.selectedConversationId) {
      // Leave conversation room
      emit('conversation:leave', { conversationId: state.selectedConversationId });
    }

    setState(prev => ({
      ...prev,
      showThread: false,
      selectedConversationId: null,
      selectedRecipientId: null,
      selectedRecipientUsername: null,
    }));
  }, [state.selectedConversationId, emit]);

  // ============================================================================
  // LOADING & ERROR STATES
  // ============================================================================

  if (playerLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading player data...</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return null; // Will redirect via useEffect
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-gray-700 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold text-white">Messages</h1>
              <p className="text-sm text-gray-400 mt-1">
                Private conversations and real-time chat
              </p>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-3">
              {/* Unread Counter */}
              {state.totalUnreadCount > 0 && (
                <div className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  {state.totalUnreadCount > 99 ? '99+' : state.totalUnreadCount} unread
                </div>
              )}
              
              {/* Connection Status */}
              <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-full">
                <div
                  className={`w-2 h-2 rounded-full ${
                    state.connectionStatus === 'connected'
                      ? 'bg-green-500'
                      : state.connectionStatus === 'connecting'
                      ? 'bg-yellow-500 animate-pulse'
                      : state.connectionStatus === 'error'
                      ? 'bg-red-500'
                      : 'bg-red-500'
                  }`}
                  title={`Connection: ${state.connectionStatus}`}
                />
                <span className="text-xs text-gray-300 capitalize">
                  {state.connectionStatus}
                </span>
                
                {/* Reconnect Button (if disconnected) */}
                {state.connectionStatus === 'disconnected' && (
                  <button
                    onClick={reconnect}
                    className="ml-2 text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Reconnect
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden backdrop-blur-sm">
          {/* Desktop: Split Pane Layout */}
          {!state.isMobileView && (
            <div className="flex h-[calc(100vh-200px)]">
              {/* Inbox Pane */}
              <div className="w-1/3 border-r border-gray-700 overflow-hidden">
                <MessageInbox
                  playerId={currentPlayerId}
                  onConversationSelect={handleConversationSelect}
                  selectedConversationId={state.selectedConversationId || undefined}
                  className="h-full"
                />
              </div>

              {/* Thread Pane */}
              <div className="flex-1 overflow-hidden">
                {state.selectedConversationId && state.selectedRecipientId && state.selectedRecipientUsername ? (
                  <MessageThread
                    conversationId={state.selectedConversationId}
                    playerId={currentPlayerId}
                    recipientId={state.selectedRecipientId}
                    recipientUsername={state.selectedRecipientUsername}
                    className="h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-6xl mb-4">💬</div>
                      <h3 className="text-xl font-semibold text-gray-300 mb-2">
                        Select a Conversation
                      </h3>
                      <p className="text-gray-500">
                        Choose a conversation from the left to start messaging
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile: Stacked Layout */}
          {state.isMobileView && (
            <div className="h-[calc(100vh-200px)] overflow-hidden">
              {!state.showThread ? (
                <MessageInbox
                  playerId={currentPlayerId}
                  onConversationSelect={handleConversationSelect}
                  selectedConversationId={state.selectedConversationId || undefined}
                  className="h-full"
                />
              ) : (
                <div className="h-full flex flex-col">
                  {/* Back Button */}
                  <div className="bg-gray-700/50 p-3 border-b border-gray-600 flex-shrink-0">
                    <button
                      onClick={handleBackToInbox}
                      className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
                    >
                      <span className="text-lg">←</span>
                      <span className="font-medium">Back to Conversations</span>
                    </button>
                  </div>

                  {/* Thread */}
                  <div className="flex-1 overflow-hidden">
                    {state.selectedConversationId && state.selectedRecipientId && state.selectedRecipientUsername && (
                      <MessageThread
                        conversationId={state.selectedConversationId}
                        playerId={currentPlayerId}
                        recipientId={state.selectedRecipientId}
                        recipientUsername={state.selectedRecipientUsername}
                        className="h-full"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Connection Lost Warning (Fixed Position) */}
      {state.connectionStatus === 'disconnected' && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-2xl z-50 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">Connection Lost</p>
              <p className="text-sm opacity-90">Attempting to reconnect...</p>
            </div>
            <button
              onClick={reconnect}
              className="ml-4 px-3 py-1 bg-white text-red-500 rounded font-medium hover:bg-gray-100 transition-colors"
            >
              Retry Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Authentication:
 *    - Uses useGameContext() to get current player
 *    - Redirects to /login if not authenticated
 *    - Waits for player data to load before rendering
 * 
 * 2. Responsive Design:
 *    - Desktop: Split-pane (inbox 1/3, thread 2/3)
 *    - Mobile: Stacked with back button navigation
 *    - Auto-detects screen width changes
 * 
 * 3. Socket.io Integration:
 *    - Uses useWebSocket() hook (does NOT expose socket to children)
 *    - Registers event listeners with cleanup
 *    - Auto-joins/leaves conversation rooms
 *    - Handles connection state changes
 * 
 * 4. State Management:
 *    - Page-level state for selection and UI
 *    - Child components manage their own data
 *    - Real-time updates via Socket.io events
 * 
 * 5. Conversation Selection:
 *    - Extracts recipient from conversation participants
 *    - Joins Socket.io conversation room
 *    - Provides recipient info to MessageThread
 * 
 * 6. Unread Tracking:
 *    - Maintains total unread count
 *    - Updates on message:receive and message:read events
 *    - Shows badge in header
 * 
 * 7. Error Handling:
 *    - Loading states for player data
 *    - Connection status monitoring
 *    - Reconnect functionality
 *    - Console logging for debugging
 * 
 * 8. Performance:
 *    - useCallback for all handlers (prevent re-renders)
 *    - useMemo for derived values
 *    - Proper cleanup of event listeners
 *    - Efficient state updates
 * 
 * FUTURE ENHANCEMENTS:
 * - Add "New Message" button to start conversations
 * - Implement conversation search
 * - Add notification sound for new messages
 * - Support desktop notifications
 * - Add conversation archiving/deletion
 * - Implement message draft persistence
 */
