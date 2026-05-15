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
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

interface MessagesPageState {
  selectedConversationId: string | null;
  selectedRecipientId: string | null;
  selectedRecipientUsername: string | null;
  conversations: Conversation[];
  totalUnreadCount: number;
  isMobileView: boolean;
  showThread: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

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

  useEffect(() => {
    if (!playerLoading && !player) {
      router.push('/login');
    }
  }, [player, playerLoading, router]);

  const currentPlayerId = useMemo(() => {
    return player?.username || '';
  }, [player]);

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

  useEffect(() => {
    setState(prev => ({
      ...prev,
      connectionStatus: connectionState,
    }));
  }, [connectionState]);

  const handleMessageReceive = useCallback((payload: MessagingMessagePayload) => {
    console.log('[Messages] Received message:', payload);

    setState(prev => {
      const conversations = [...prev.conversations];
      const convIndex = conversations.findIndex(
        c => c._id.toString() === payload.conversationId
      );

      if (convIndex !== -1) {
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

        conversations.splice(convIndex, 1);
        conversations.unshift(updatedConv);

        if (payload.conversationId !== prev.selectedConversationId && payload.senderId !== currentPlayerId) {
          const currentCount = conv.unreadCount[currentPlayerId] || 0;
          updatedConv.unreadCount = {
            ...conv.unreadCount,
            [currentPlayerId]: currentCount + 1,
          };
        }
      }

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

  const handleConversationUpdated = useCallback((payload: MessagingConversationPayload) => {
    console.log('[Messages] Conversation updated:', payload);

    setState(prev => {
      const conversations = [...prev.conversations];
      const convIndex = conversations.findIndex(
        c => c._id.toString() === payload._id
      );

      if (convIndex !== -1) {
        conversations[convIndex] = payload as any;
      } else {
        conversations.unshift(payload as any);
      }

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

  const handleReadReceipt = useCallback((payload: MessagingReadReceiptPayload) => {
    console.log('[Messages] Read receipt:', payload);

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

  const handleTypingStart = useCallback((payload: MessagingTypingPayload) => {
    console.log('[Messages] Typing started:', payload);
  }, []);

  const handleTypingStop = useCallback((payload: MessagingTypingPayload) => {
    console.log('[Messages] Typing stopped:', payload);
  }, []);

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

  const handleConversationSelect = useCallback((conversationId: string) => {
    const conversation = state.conversations.find(c => c._id.toString() === conversationId);
    if (!conversation) {
      console.error('[Messages] Selected conversation not found:', conversationId);
      return;
    }

    const recipientId = conversation.participants.find(p => p !== currentPlayerId);
    if (!recipientId) {
      console.error('[Messages] Could not determine recipient for conversation:', conversationId);
      return;
    }

    const recipientUsername = recipientId;

    setState(prev => ({
      ...prev,
      selectedConversationId: conversationId,
      selectedRecipientId: recipientId,
      selectedRecipientUsername: recipientUsername,
      showThread: true,
    }));

    emit('conversation:join', { conversationId });

    console.log('[Messages] Joined conversation:', conversationId, 'with recipient:', recipientUsername);
  }, [currentPlayerId, state.conversations, emit]);

  const handleBackToInbox = useCallback(() => {
    if (state.selectedConversationId) {
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

  if (playerLoading) {
    return (
      <>
        <TopNavBar />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[--electric] mx-auto mb-4"></div>
                <p className="text-white/60">Loading player data...</p>
              </div>
            </div>
          }
        />
      </>
    );
  }

  if (!player) {
    return null;
  }

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void] flex flex-col">
            <div className="bg-[--card] border-b border-[--border] sticky top-0 z-10">
              <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-white">Messages</h1>
                    <p className="text-sm text-white/60 mt-1">
                      Private conversations and real-time chat
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {state.totalUnreadCount > 0 && (
                      <div className="bg-[--neon-red] text-white text-xs font-bold px-3 py-1.5 rounded-full">
                        {state.totalUnreadCount > 99 ? '99+' : state.totalUnreadCount} unread
                      </div>
                    )}

                    <div className="flex items-center gap-2 bg-[--card] px-3 py-1.5 rounded-full">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          state.connectionStatus === 'connected'
                            ? 'bg-[--synth]'
                            : state.connectionStatus === 'connecting'
                            ? 'bg-[--neon-yellow] animate-pulse'
                            : state.connectionStatus === 'error'
                            ? 'bg-[--neon-red]'
                            : 'bg-[--neon-red]'
                        }`}
                        title={`Connection: ${state.connectionStatus}`}
                      />
                      <span className="text-xs text-white/60 capitalize">
                        {state.connectionStatus}
                      </span>

                      {state.connectionStatus === 'disconnected' && (
                        <button
                          onClick={reconnect}
                          className="ml-2 text-xs text-[--electric] hover:opacity-80 underline"
                        >
                          Reconnect
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="max-w-7xl mx-auto h-full">
                <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden h-full">
                  {!state.isMobileView && (
                    <div className="flex h-[calc(100vh-200px)]">
                      <div className="w-1/3 border-r border-[--border] overflow-hidden">
                        <MessageInbox
                          playerId={currentPlayerId}
                          onConversationSelect={handleConversationSelect}
                          selectedConversationId={state.selectedConversationId || undefined}
                          className="h-full"
                        />
                      </div>

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
                              <h3 className="text-xl font-semibold text-white/60 mb-2">
                                Select a Conversation
                              </h3>
                              <p className="text-white/40">
                                Choose a conversation from the left to start messaging
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
                          <div className="bg-[--card] p-3 border-b border-[--border] flex-shrink-0">
                            <button
                              onClick={handleBackToInbox}
                              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                            >
                              <span className="text-lg">←</span>
                              <span className="font-medium">Back to Conversations</span>
                            </button>
                          </div>

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
            </div>

            {state.connectionStatus === 'disconnected' && (
              <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-[--neon-red] text-white px-6 py-3 rounded-lg z-50 animate-pulse">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="font-bold">Connection Lost</p>
                    <p className="text-sm opacity-90">Attempting to reconnect...</p>
                  </div>
                  <button
                    onClick={reconnect}
                    className="ml-4 px-3 py-1 bg-white text-[--neon-red] rounded font-medium hover:bg-white/80 transition-colors"
                  >
                    Retry Now
                  </button>
                </div>
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
