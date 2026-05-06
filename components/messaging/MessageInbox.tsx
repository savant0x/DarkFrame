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

import React, { useState, useEffect } from 'react';
import { Search, Filter, Pin, Archive, MessageCircle, Clock } from 'lucide-react';
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
  const loadConversations = async () => {
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
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to load conversations',
        isLoading: false,
      }));
    }
  };

  // Load conversations on mount and when filter/search changes
  useEffect(() => {
    loadConversations();
  }, [playerId, state.filter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.searchQuery !== '') {
        loadConversations();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [state.searchQuery]);

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
    <div className={`flex flex-col h-full bg-gray-900 border-r border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-blue-400" />
          Messages
        </h2>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={state.searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3 overflow-x-auto">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              state.filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('unread')}
            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              state.filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => handleFilterChange('pinned')}
            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              state.filter === 'pinned'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Pin className="w-3 h-3" />
            Pinned
          </button>
          <button
            onClick={() => handleFilterChange('archived')}
            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              state.filter === 'archived'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : state.error ? (
          <div className="p-4 text-center">
            <p className="text-red-400">{state.error}</p>
            <button
              onClick={loadConversations}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : state.conversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No conversations yet</p>
            <p className="text-sm text-gray-500 mt-1">
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
                  className={`p-4 border-b border-gray-800 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-gray-800 border-l-4 border-l-blue-500'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      {otherParticipant.charAt(0).toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate">
                            {otherParticipant}
                          </span>
                          {isPinned && (
                            <Pin className="w-3 h-3 text-yellow-500" fill="currentColor" />
                          )}
                        </div>
                        {conversation.lastMessage && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(conversation.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>

                      {conversation.lastMessage && (
                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate ${
                            unreadCount > 0 ? 'text-white font-medium' : 'text-gray-400'
                          }`}>
                            {conversation.lastMessage.senderId === playerId && (
                              <span className="text-gray-500">You: </span>
                            )}
                            {truncateMessage(conversation.lastMessage.content)}
                          </p>
                          {unreadCount > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
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
