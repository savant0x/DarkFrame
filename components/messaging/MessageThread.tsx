/**
 * Message Thread Component
 * Created: 2025-10-25
 * Feature: FID-20251025-102
 * 
 * OVERVIEW:
 * Chat interface for viewing and sending messages in a conversation.
 * Displays message history with read receipts, typing indicators, and emoji support.
 * Implements infinite scroll for loading older messages and real-time delivery.
 * 
 * KEY FEATURES:
 * - Message history with pagination
 * - Real-time message delivery via Socket.io
 * - Typing indicators
 * - Read receipts
 * - Emoji picker using @emoji-mart/react
 * - Message timestamps
 * - Auto-scroll to newest messages
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile, Loader, Check, CheckCheck, Clock } from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import type { Message, MessageThreadState } from '@/types/messaging.types';

interface MessageThreadProps {
  conversationId: string;
  playerId: string;
  recipientId: string;
  recipientUsername: string;
  className?: string;
}

export default function MessageThread({
  conversationId,
  playerId,
  recipientId,
  recipientUsername,
  className = '',
}: MessageThreadProps) {
  const [state, setState] = useState<MessageThreadState>({
    conversationId,
    messages: [],
    isLoading: true,
    hasMore: false,
    recipientTyping: false,
    draftMessage: '',
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  /**
   * Load message history
   */
  const loadMessages = async (before?: Date) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: undefined }));

      const params = new URLSearchParams({
        conversationId,
        limit: '50',
      });

      if (before) {
        params.append('before', before.toISOString());
      }

      const response = await fetch(`/api/messages?${params}`);
      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          messages: before
            ? [...data.messages, ...prev.messages]
            : data.messages,
          hasMore: data.hasMore,
          isLoading: false,
        }));

        // Scroll to bottom on initial load
        if (!before) {
          scrollToBottom();
        }

        // Mark messages as read
        markAsRead();
      } else {
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to load messages',
          isLoading: false,
        }));
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to load messages',
        isLoading: false,
      }));
    }
  };

  /**
   * Mark messages as read
   */
  const markAsRead = async () => {
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Load messages on mount and when conversation changes
  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  // ========================================================================
  // MESSAGE SENDING
  // ========================================================================

  /**
   * Send a message
   */
  const sendMessage = async () => {
    const content = state.draftMessage.trim();
    if (!content || isSending) return;

    setIsSending(true);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          content,
        }),
      });

      const data = await response.json();

      if (data.success && data.message) {
        // Add message to state
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, data.message],
          draftMessage: '',
        }));

        // Scroll to bottom
        scrollToBottom();

        // Stop typing indicator
        emitTypingStop();
      } else {
        setState(prev => ({
          ...prev,
          error: data.error || 'Failed to send message',
        }));
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to send message',
      }));
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handle input change with typing indicator
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState(prev => ({ ...prev, draftMessage: e.target.value }));

    // Emit typing indicator
    if (e.target.value.length > 0) {
      emitTypingStart();

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        emitTypingStop();
      }, 3000);
    } else {
      emitTypingStop();
    }
  };

  /**
   * Handle Enter key press
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * Handle emoji selection
   */
  const handleEmojiSelect = (emoji: any) => {
    setState(prev => ({
      ...prev,
      draftMessage: prev.draftMessage + emoji.native,
    }));
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // ========================================================================
  // REAL-TIME FEATURES (Placeholders for Socket.io)
  // ========================================================================

  const emitTypingStart = () => {
    // TODO: Emit via Socket.io
    // socket.emit('typing:start', { conversationId, recipientId });
  };

  const emitTypingStop = () => {
    // TODO: Emit via Socket.io
    // socket.emit('typing:stop', { conversationId, recipientId });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  /**
   * Scroll to bottom of messages
   */
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (date: Date): string => {
    const messageDate = new Date(date);
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  /**
   * Get message status icon
   */
  const getStatusIcon = (message: Message) => {
    if (message.senderId !== playerId) return null;

    switch (message.status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
      case 'delivered':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-400" />;
      case 'failed':
        return <span className="text-xs text-red-400">Failed</span>;
      default:
        return null;
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-3">
          {/* Recipient Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {recipientUsername.charAt(0).toUpperCase()}
          </div>

          {/* Recipient Info */}
          <div className="flex-1">
            <h3 className="font-semibold text-white">{recipientUsername}</h3>
            {state.recipientTyping && (
              <p className="text-xs text-blue-400 italic">typing...</p>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {state.isLoading && state.messages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : state.error ? (
          <div className="text-center">
            <p className="text-red-400">{state.error}</p>
            <button
              onClick={() => loadMessages()}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Load More Button */}
            {state.hasMore && (
              <div className="text-center">
                <button
                  onClick={() => {
                    const oldestMessage = state.messages[0];
                    if (oldestMessage) {
                      loadMessages(new Date(oldestMessage.createdAt));
                    }
                  }}
                  className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300"
                >
                  Load older messages
                </button>
              </div>
            )}

            {/* Messages */}
            {state.messages.map((message) => {
              const isOwn = message.senderId === playerId;

              return (
                <div
                  key={String(message._id)}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      isOwn
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <div className={`flex items-center gap-2 mt-1 text-xs ${
                      isOwn ? 'text-blue-200' : 'text-gray-400'
                    }`}>
                      <span>{formatTimestamp(message.createdAt)}</span>
                      {getStatusIcon(message)}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 right-4 z-50">
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme="dark"
              onClickOutside={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2">
          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
            title="Add emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Text Input */}
          <textarea
            ref={inputRef}
            value={state.draftMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${recipientUsername}...`}
            rows={1}
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none max-h-32"
          />

          {/* Send Button */}
          <button
            onClick={sendMessage}
            disabled={!state.draftMessage.trim() || isSending}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            {isSending ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Character Count */}
        <div className="mt-1 text-right">
          <span className={`text-xs ${
            state.draftMessage.length > 900
              ? 'text-red-400'
              : 'text-gray-500'
          }`}>
            {state.draftMessage.length} / 1000
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * TODO: Real-time features via Socket.io
 * 
 * useEffect(() => {
 *   const socket = io();
 *   
 *   // Join conversation room
 *   socket.emit('conversation:join', conversationId);
 *   
 *   // Listen for new messages
 *   socket.on('message:receive', (message: Message) => {
 *     if (message.conversationId === conversationId) {
 *       setState(prev => ({
 *         ...prev,
 *         messages: [...prev.messages, message],
 *       }));
 *       scrollToBottom();
 *       markAsRead();
 *     }
 *   });
 *   
 *   // Listen for typing indicators
 *   socket.on('typing:start', (data) => {
 *     if (data.conversationId === conversationId && data.playerId !== playerId) {
 *       setState(prev => ({ ...prev, recipientTyping: true }));
 *     }
 *   });
 *   
 *   socket.on('typing:stop', (data) => {
 *     if (data.conversationId === conversationId && data.playerId !== playerId) {
 *       setState(prev => ({ ...prev, recipientTyping: false }));
 *     }
 *   });
 *   
 *   // Listen for read receipts
 *   socket.on('message:read', (data) => {
 *     if (data.conversationId === conversationId) {
 *       setState(prev => ({
 *         ...prev,
 *         messages: prev.messages.map(m =>
 *           m._id === data.messageId ? { ...m, status: 'read', readAt: data.readAt } : m
 *         ),
 *       }));
 *     }
 *   });
 *   
 *   return () => {
 *     socket.emit('conversation:leave', conversationId);
 *     socket.off('message:receive');
 *     socket.off('typing:start');
 *     socket.off('typing:stop');
 *     socket.off('message:read');
 *   };
 * }, [conversationId]);
 */
