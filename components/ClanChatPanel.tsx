/**
 * Clan Chat Panel Component
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Real-time clan chat interface with message sending, editing, deletion, and
 * moderation features. Provides role-based UI for leaders/officers and
 * automatic message updates.
 * 
 * Features:
 * - Real-time message display with auto-scroll
 * - Message sending with validation
 * - Edit own messages (5-minute window)
 * - Delete messages (role-based)
 * - System message highlighting
 * - Leader announcement support
 * - Rate limit feedback
 * - Pagination (load more history)
 * 
 * Props:
 * - clanId: Clan identifier
 * - playerId: Current player ID
 * - role: Player's clan role (for permissions)
 * 
 * @module components/ClanChatPanel
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageType } from '@/lib/clanChatService';

interface ChatMessage {
  _id: string;
  clanId: string;
  type: string;
  playerId?: string;
  username?: string;
  role?: string;
  message: string;
  timestamp: string;
  editedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  eventType?: string;
}

interface ClanChatPanelProps {
  clanId: string;
  playerId: string;
  role: string;
}

export function ClanChatPanel({ clanId, playerId, role }: ClanChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const isLeader = role === 'LEADER';
  const canModerate = ['LEADER', 'CO_LEADER'].includes(role);

  // Load initial messages
  useEffect(() => {
    loadMessages();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(() => {
      pollNewMessages();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [clanId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/clan/chat?clanId=${clanId}&limit=50`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load messages');
      }
      
      setMessages(data.messages.reverse()); // Reverse to show oldest first
      setHasMore(data.messages.length === 50);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || isLoading || messages.length === 0) return;
    
    try {
      setIsLoading(true);
      const oldestMessage = messages[0];
      
      const response = await fetch(
        `/api/clan/chat?clanId=${clanId}&limit=50&before=${oldestMessage.timestamp}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load more messages');
      }
      
      if (data.messages.length === 0) {
        setHasMore(false);
        return;
      }
      
      setMessages([...data.messages.reverse(), ...messages]);
      setHasMore(data.messages.length === 50);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const pollNewMessages = async () => {
    if (messages.length === 0) return;
    
    try {
      const latestMessage = messages[messages.length - 1];
      
      const response = await fetch(
        `/api/clan/chat?clanId=${clanId}&since=${latestMessage.timestamp}`
      );
      const data = await response.json();
      
      if (response.ok && data.messages.length > 0) {
        setMessages([...messages, ...data.messages]);
      }
    } catch (err) {
      // Silently fail for polling
      console.error('Failed to poll messages:', err);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/clan/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId,
          message: messageText.trim(),
          type: isAnnouncement ? MessageType.ANNOUNCEMENT : MessageType.USER,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }
      
      // Add message to list
      setMessages([...messages, data.message]);
      setMessageText('');
      setIsAnnouncement(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (msg: ChatMessage) => {
    setEditingId(msg._id);
    setEditText(msg.message);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (messageId: string) => {
    if (!editText.trim()) return;
    
    try {
      setError(null);
      
      const response = await fetch('/api/clan/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          message: editText.trim(),
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to edit message');
      }
      
      // Update message in list
      setMessages(messages.map(m => m._id === messageId ? data.message : m));
      setEditingId(null);
      setEditText('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteMsg = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
      setError(null);
      
      const response = await fetch(`/api/clan/chat?messageId=${messageId}&clanId=${clanId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete message');
      }
      
      // Remove message from list
      setMessages(messages.filter(m => m._id !== messageId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getMessageClass = (msg: ChatMessage): string => {
    if (msg.type === 'SYSTEM') return 'bg-blue-900/20 border-l-4 border-blue-500 pl-4';
    if (msg.type === 'ANNOUNCEMENT') return 'bg-yellow-900/20 border-l-4 border-yellow-500 pl-4';
    return '';
  };

  const getRoleColor = (msgRole: string): string => {
    switch (msgRole) {
      case 'LEADER': return 'text-yellow-400 font-bold';
      case 'CO_LEADER': return 'text-orange-400';
      case 'OFFICER': return 'text-blue-400';
      case 'ELITE': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const canEdit = (msg: ChatMessage): boolean => {
    if (msg.type !== 'USER') return false;
    if (msg.playerId !== playerId) return false;
    
    // Check 5-minute window
    const timestamp = new Date(msg.timestamp).getTime();
    const now = Date.now();
    const minutesAgo = (now - timestamp) / (1000 * 60);
    
    return minutesAgo <= 5;
  };

  const canDelete = (msg: ChatMessage): boolean => {
    if (msg.type === 'SYSTEM') return false;
    if (canModerate) return true;
    return msg.playerId === playerId;
  };

  return (
    <div className="flex flex-col h-full bg-black/40 rounded border border-gray-700">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Clan Chat</h2>
        {hasMore && (
          <button
            onClick={loadMoreMessages}
            disabled={isLoading}
            className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
          >
            Load More
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-900/20 border border-red-500 rounded text-sm">
          {error}
        </div>
      )}

      {/* Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {messages.map((msg) => (
          <div
            key={msg._id}
            className={`p-3 rounded ${getMessageClass(msg)}`}
          >
            {/* Message Header */}
            {msg.type !== 'SYSTEM' && (
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <span className={getRoleColor(msg.role || '')}>
                    {msg.username}
                  </span>
                  {msg.type === 'ANNOUNCEMENT' && (
                    <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">
                      ANNOUNCEMENT
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                  {msg.editedAt && ' (edited)'}
                </span>
              </div>
            )}

            {/* Message Content */}
            {editingId === msg._id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-gray-600 rounded resize-none"
                  rows={3}
                  maxLength={500}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(msg._id)}
                    className="px-3 py-1 bg-green-600 rounded hover:bg-green-500 text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-200 whitespace-pre-wrap break-words">
                  {msg.message}
                </p>

                {/* Message Actions */}
                {msg.type !== 'SYSTEM' && (
                  <div className="flex gap-2 mt-2">
                    {canEdit(msg) && (
                      <button
                        onClick={() => startEdit(msg)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete(msg) && (
                      <button
                        onClick={() => deleteMsg(msg._id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700">
        {isLeader && (
          <label className="flex items-center gap-2 mb-2 text-sm">
            <input
              type="checkbox"
              checked={isAnnouncement}
              onChange={(e) => setIsAnnouncement(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-yellow-400">Send as Announcement</span>
          </label>
        )}
        
        <div className="flex gap-2">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="flex-1 px-3 py-2 bg-black/40 border border-gray-600 rounded resize-none"
            rows={3}
            maxLength={500}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !messageText.trim()}
            className="px-6 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1 text-right">
          {messageText.length}/500
        </div>
      </div>
    </div>
  );
}
