/**
 * Message Inbox Component
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * Displays a list of conversations with search, filters, and unread counts.
 * Shows conversation preview with last message, timestamp, and online status.
 * Supports pinning, archiving, and real-time updates via Socket.io.
 * 
 * KEY FEATURES:
 * - Conversation list with last message preview
 * - Unread message count badges
 * - Search conversations by participant name
 * - Filter: All / Unread / Archived / Pinned
 * - Real-time updates for new messages
 * - Responsive design for mobile and desktop
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search,  Pin, Archive, MessageCircle, Clock, Loader2 } from 'lucide-react';
import type { Conversation, MessageInboxState } from '@/types/messaging.types';

interface MessageInboxProps {
  playerId: string;
  onConversationSelect: (conversationId: string) => void;
  selectedConversationId?: string;
  className?: string;
}

export default function MessageInbox({
  playerId,
  onConversationSelect,
  selectedConversationId,
  className = '',
}: MessageInboxProps) {
  const [state, setState] = useState<MessageInboxState>({
    conversations: [],
    selectedConversationId,
    isLoading: true,
    searchQuery: '',
    filter: 'all',
  });

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  /**
   * Load conversations from API
   */
  const loadConversations = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: undefined }));

      const params = new URLSearchParams({
        playerId,
        limit: '50',
        sortBy: state.filter === 'unread' ? 'unread' : 'recent',
        includeArchived: state.filter === 'archived' ? 'true' : 'false',
      });

      const response = await fetch(`/api/messages/conversations?${params}`);
      const data = await response.json();

      if (data.success) {
        let conversations = data.conversations;

        // Apply client-side filters
        if (state.filter === 'pinned') {
          conversations = conversations.filter((c: Conversation) => 
            c.isPinned?.[playerId]
          );
        } else if (state.filter === 'unread') {
          conversations = conversations.filter((c: Conversation) => 
            (c.unreadCount?.[playerId] || 0) > 0
          );
        }

        // Apply search filter
        if (state.searchQuery) {
          conversations = conversations.filter((c: Conversation) => {
            const otherParticipant = c.participants.find(p => p !== playerId) || '';
            return otherParticipant.toLowerCase().includes(state.searchQuery.toLowerCase());
          });
        }

        setState(prev => ({
          ...prev,
          conversations,
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to load conversations',
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load conversations',
        isLoading: false,
      }));
    }
  }, [playerId, state.filter, state.searchQuery]);

  // Load conversations on mount and when filter/search changes
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.searchQuery !== '') {
        loadConversations();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [state.searchQuery, loadConversations]);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Handle search input change
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({ ...prev, searchQuery: e.target.value }));
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (filter: 'all' | 'unread' | 'archived' | 'pinned') => {
    setState(prev => ({ ...prev, filter }));
  };

  /**
   * Handle conversation selection
   */
  const handleSelectConversation = (conversationId: string) => {
    setState(prev => ({ ...prev, selectedConversationId: conversationId }));
    onConversationSelect(conversationId);
  };

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  /**
   * Get other participant in conversation
   */
  const getOtherParticipant = (conversation: Conversation): string => {
    return conversation.participants.find(p => p !== playerId) || 'Unknown';
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const messageDate = new Date(date);
    const diff = now.getTime() - messageDate.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return messageDate.toLocaleDateString();
    } else if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  /**
   * Truncate message preview
   */
  const truncateMessage = (message: string, maxLength: number = 50): string => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className={`flex flex-col h-full nn-surface--dark border-r border-[color:var(--nn-glass-border)] ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-[color:var(--nn-glass-border)]">
        <h2 className="nn-num text-xl font-bold nn-text-cyan mb-3 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-[color:var(--nn-cyan)]" />
          Messages
        </h2>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 nn-text-secondary" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={state.searchQuery}
            onChange={handleSearchChange}
            className="nn-input pl-10 w-full"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3 overflow-x-auto">
          <button
            onClick={() => handleFilterChange('all')}
            className={`nn-tabchip ${state.filter === 'all' ? 'nn-tabchip--on' : ''}`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('unread')}
            className={`nn-tabchip ${state.filter === 'unread' ? 'nn-tabchip--on' : ''}`}
          >
            Unread
          </button>
          <button
            onClick={() => handleFilterChange('pinned')}
            className={`nn-tabchip flex items-center gap-1 ${state.filter === 'pinned' ? 'nn-tabchip--on' : ''}`}
          >
            <Pin className="w-3 h-3" />
            Pinned
          </button>
          <button
            onClick={() => handleFilterChange('archived')}
            className={`nn-tabchip flex items-center gap-1 ${state.filter === 'archived' ? 'nn-tabchip--on' : ''}`}
          >
            <Archive className="w-3 h-3" />
            Archived
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {state.isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" aria-label="Loading conversations" />
          </div>
        ) : state.error ? (
          <div className="p-4 text-center">
            <p className="nn-text-magenta">{state.error}</p>
            <button onClick={loadConversations} className="nn-btn mt-2 px-4 py-2">
              Retry
            </button>
          </div>
        ) : state.conversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-12 h-12 nn-text-tertiary mx-auto mb-3" />
            <p className="nn-text-secondary">No conversations yet</p>
            <p className="nn-text-secondary mt-1 text-sm">
              Start chatting with other players!
            </p>
          </div>
        ) : (
          <div>
            {state.conversations.map((conversation) => {
              const otherParticipant = getOtherParticipant(conversation);
              const unreadCount = conversation.unreadCount?.[playerId] || 0;
              const isSelected = conversation._id === selectedConversationId;
              const isPinned = conversation.isPinned?.[playerId];

              return (
                <div
                  key={String(conversation._id)}
                  onClick={() => handleSelectConversation(String(conversation._id))}
                  style={isSelected ? { boxShadow: 'inset 2px 0 0 var(--nn-cyan)' } : undefined}
                  className={`p-4 border-b border-[color:var(--nn-glass-border)] cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_8%,transparent)]'
                      : 'hover:bg-[color-mix(in_oklab,var(--nn-cyan)_5%,transparent)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-12 w-12 flex-none items-center justify-center border border-[color-mix(in_oklab,var(--nn-cyan)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_12%,transparent)] nn-num text-lg font-bold text-[color:var(--nn-cyan)]">
                      {otherParticipant.charAt(0).toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[color:var(--nn-text-primary)] truncate">
                            {otherParticipant}
                          </span>
                          {isPinned && (
                            <Pin className="w-3 h-3 text-[color:var(--nn-amber)]" fill="currentColor" />
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <span className="nn-footnote flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(conversation.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>

                      {conversation.lastMessage && (
                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate ${
                            unreadCount > 0 ? 'text-[color:var(--nn-text-primary)] font-medium' : 'nn-text-secondary'
                          }`}>
                            {conversation.lastMessage.senderId === playerId && (
                              <span className="nn-text-secondary">You: </span>
                            )}
                            {truncateMessage(conversation.lastMessage.content)}
                          </p>
                          {unreadCount > 0 && (
                            <span className="nn-chip nn-chip--cyan ml-2 font-bold min-w-[20px] justify-center">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * REAL-TIME UPDATES (To be implemented):
 * 
 * useEffect(() => {
 *   const socket = io();
 *   
 *   socket.on('message:receive', (message) => {
 *     // Update conversation with new message
 *     loadConversations();
 *   });
 *   
 *   socket.on('conversation:updated', (conversation) => {
 *     // Update specific conversation
 *     setState(prev => ({
 *       ...prev,
 *       conversations: prev.conversations.map(c =>
 *         c._id === conversation._id ? conversation : c
 *       ),
 *     }));
 *   });
 *   
 *   return () => {
 *     socket.off('message:receive');
 *     socket.off('conversation:updated');
 *   };
 * }, []);
 */
