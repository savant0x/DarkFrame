'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useChatPanelSize } from '@/context/ChatPanelContext';
import { MessageCircle, Send, Smile, Users, HelpCircle, ArrowDown, Loader2, Wifi, Zap, X, Mail, Search, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ChannelType } from '@/lib/channelService';
import ChatMessage from '@/components/chat/ChatMessage';
import type { DMConversation, DirectMessage, ConversationPreview } from '@/types/directMessage';

interface ChatPanelProps { userId: string; username: string; level: number; isVIP: boolean; clanId?: string; clanName?: string; defaultCollapsed?: boolean; initialTab?: 'CHAT' | 'DM'; onTabChange?: (tab: 'CHAT' | 'DM') => void; onDMUnreadCountChange?: (count: number) => void; }
interface ChatMessageData { id: string; channelId: ChannelType; senderId: string; senderUsername: string; senderLevel: number; senderIsVIP: boolean; content: string; timestamp: Date; edited?: boolean; editedAt?: Date; }
interface TypingUser { username: string; timestamp: number; }
interface ChannelMetadata { id: ChannelType; name: string; icon: React.ReactNode; description: string; color: string; canAccess: boolean; unreadCount: number; }
interface MuteStatus { isMuted: boolean; until?: Date; reason?: string; }
interface AskVeteransModalData { isOpen: boolean; question: string; }
interface MentionUser { id: string; display: string; }
interface PlayerSearchResult { _id: string; username: string; level: number; vip: boolean; clanTag?: string; }

const MAX_MESSAGE_LENGTH = 1000;
const MAX_DM_MESSAGE_LENGTH = 2000;
const MAX_VETERAN_QUESTION_LENGTH = 500;
const TYPING_TIMEOUT_MS = 3000;
const MESSAGE_LOAD_LIMIT = 50;
const VETERAN_MIN_LEVEL = 50;

export default function ChatPanel({ userId, username, level, clanId, clanName, isVIP, defaultCollapsed = true, initialTab = 'CHAT', onTabChange, onDMUnreadCountChange }: ChatPanelProps) {
  const [activeChannel, setActiveChannel] = useState<ChannelType>(ChannelType.GLOBAL);
  const [activeTab, setActiveTab] = useState<'CHAT' | 'DM'>(initialTab);
  const [messages, setMessages] = useState<Map<ChannelType, ChatMessageData[]>>(new Map());
  const [messageInput, setMessageInput] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<ChannelType, TypingUser[]>>(new Map());
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [unreadCounts, setUnreadCounts] = useState<Map<ChannelType, number>>(new Map());
  const [muteStatus, setMuteStatus] = useState<MuteStatus>({ isMuted: false });
  const [askVeteransModal, setAskVeteransModal] = useState<AskVeteransModalData>({ isOpen: false, question: '' });
  const [onlineUsers, setOnlineUsers] = useState<MentionUser[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmInput, setDmInput] = useState('');
  const [isSendingDM, setIsSendingDM] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingDMMessages, setIsLoadingDMMessages] = useState(false);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deleteConversationConfirmId, setDeleteConversationConfirmId] = useState<string | null>(null);

  const { panelSize, setPanelSize } = useChatPanelSize();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const lastMessageTimestampRef = useRef<Date | null>(null);
  const initialLoadDoneRef = useRef<Set<string>>(new Set());
  const [isPollingMessages, setIsPollingMessages] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const channels: ChannelMetadata[] = useMemo(() => {
    const isNewbie = level >= 1 && level <= 5;
    return [
      { id: ChannelType.GLOBAL, name: 'Global', icon: <MessageCircle className="w-3.5 h-3.5" />, description: 'Chat with all players', color: 'text-[--electric]', canAccess: true, unreadCount: unreadCounts.get(ChannelType.GLOBAL) || 0 },
      { id: ChannelType.NEWBIE, name: 'Newbie', icon: <HelpCircle className="w-3.5 h-3.5" />, description: 'For new players (Lv 1-5)', color: 'text-[--synth]', canAccess: isNewbie, unreadCount: unreadCounts.get(ChannelType.NEWBIE) || 0 },
      { id: ChannelType.CLAN, name: clanName || 'Clan', icon: <Users className="w-3.5 h-3.5" />, description: 'Clan members only', color: 'text-[--neon-pink]', canAccess: !!clanId, unreadCount: unreadCounts.get(ChannelType.CLAN) || 0 },
      { id: ChannelType.TRADE, name: 'Trade', icon: <Zap className="w-3.5 h-3.5" />, description: 'Trading & marketplace', color: 'text-[--neon-yellow]', canAccess: true, unreadCount: unreadCounts.get(ChannelType.TRADE) || 0 },
      { id: ChannelType.HELP, name: 'Help', icon: <HelpCircle className="w-3.5 h-3.5" />, description: 'Ask for help', color: 'text-[--electric]', canAccess: true, unreadCount: unreadCounts.get(ChannelType.HELP) || 0 },
      { id: ChannelType.VIP, name: 'VIP', icon: <Zap className="w-3.5 h-3.5" />, description: 'VIP members only', color: 'text-[--neon-yellow]', canAccess: isVIP, unreadCount: unreadCounts.get(ChannelType.VIP) || 0 },
    ].filter(c => c.canAccess);
  }, [level, clanId, clanName, isVIP, unreadCounts]);

  // Poll for new messages every 2 seconds
  useEffect(() => {
    let active = true; let timer: NodeJS.Timeout | null = null;
    const fetchMessages = async () => {
      try {
        setFetchError(null);
        const since = lastMessageTimestampRef.current ? `&since=${lastMessageTimestampRef.current.toISOString()}` : '';
        const res = await fetch(`/api/chat?channelId=${activeChannel}&limit=${MESSAGE_LOAD_LIMIT}${since}`);
        if (!res.ok) throw new Error('Failed to load messages');
        const data = await res.json();
        if (!active) return;
        if (data?.messages && Array.isArray(data.messages)) {
          const newMessages: ChatMessageData[] = data.messages.map((m: any) => ({ id: m.id, channelId: m.channelId, senderId: m.senderId, senderUsername: m.senderUsername, senderLevel: m.senderLevel, senderIsVIP: m.senderIsVIP ?? m.isVIP ?? false, content: m.content || m.message, timestamp: new Date(m.timestamp), edited: m.edited, editedAt: m.editedAt ? new Date(m.editedAt) : undefined }));
          setMessages(prev => {
            const updated = new Map(prev);
            const existing = prev.get(activeChannel) || [];
            const existingIds = new Set(existing.map(m => m.id));
            const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
            const merged = [...existing, ...uniqueNew].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            updated.set(activeChannel, merged.slice(-100));
            return updated;
          });
          if (newMessages.length > 0) lastMessageTimestampRef.current = newMessages[newMessages.length - 1].timestamp;
        }
      } catch (err) {
        if (active) {
          console.error('[Chat] Poll error:', err);
          setFetchError(err instanceof Error ? err.message : 'Failed to load messages');
        }
      }
    };
    fetchMessages();
    timer = setInterval(fetchMessages, 2000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [activeChannel]);

  // Poll for typing indicators
  useEffect(() => {
    let active = true; let timer: NodeJS.Timeout | null = null;
    const fetchTypers = async () => {
      try {
        const res = await fetch(`/api/chat/typing?channelId=${activeChannel}`);
        if (!res.ok) throw new Error('Failed to load typers');
        const data = await res.json();
        if (!active) return;
        if (data?.typers) {
          setTypingUsers(prev => { const updated = new Map(prev); updated.set(activeChannel, data.typers.filter((t: any) => t.userId !== userId)); return updated; });
        }
      } catch (err) { if (active) console.error('[Chat] Typing poll error:', err); }
    };
    fetchTypers();
    timer = setInterval(fetchTypers, 2000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [activeChannel, userId]);

  // Poll for online count
  useEffect(() => {
    let active = true; let timer: NodeJS.Timeout | null = null;
    const fetchOnline = async () => {
      try {
        const res = await fetch(`/api/chat/online?channelId=${activeChannel}`);
        if (!res.ok) throw new Error('Failed to load online count');
        const data = await res.json();
        if (!active) return;
        setOnlineCount(data.count ?? 0);
      } catch (err) { if (active) console.error('[Chat] Online poll error:', err); }
    };
    fetchOnline();
    timer = setInterval(fetchOnline, 30000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [activeChannel]);

  // Poll for DM conversations
  useEffect(() => {
    if (activeTab !== 'DM') return;
    let active = true; let timer: NodeJS.Timeout | null = null;
    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/dm');
        if (!res.ok) throw new Error('Failed to load conversations');
        const data = await res.json();
        if (!active) return;
        if (data?.conversations && Array.isArray(data.conversations)) {
          const newConversations = data.conversations.map((c: any) => ({ id: c.id, otherUserId: c.otherUserId, otherUsername: c.otherUsername, lastMessage: c.lastMessage ? { content: c.lastMessage.content, senderId: c.lastMessage.senderId, timestamp: new Date(c.lastMessage.timestamp), status: c.lastMessage.status } : null, unreadCount: c.unreadCount || 0, updatedAt: new Date(c.updatedAt) }));
          setConversations(prev => {
            const existingIds = new Set(prev.map((c: ConversationPreview) => c.id));
            const uniqueNew = newConversations.filter((c: ConversationPreview) => !existingIds.has(c.id));
            const merged = [...prev, ...uniqueNew];
            for (const updated of newConversations) {
              const idx = merged.findIndex((c: ConversationPreview) => c.id === updated.id);
              if (idx !== -1) merged[idx] = updated;
            }
            return merged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          });
        }
      } catch (err) { if (active) console.error('[Chat] Conversations poll error:', err); }
    };
    fetchConversations();
    timer = setInterval(fetchConversations, 2000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [activeTab]);

  // Poll for DM messages
  useEffect(() => {
    if (activeTab !== 'DM' || !selectedConversationId) return;
    let active = true; let timer: NodeJS.Timeout | null = null;
    const fetchDMMessages = async () => {
      try {
        const res = await fetch(`/api/dm/${selectedConversationId}`);
        if (!res.ok) throw new Error('Failed to load DM messages');
        const data = await res.json();
        if (!active) return;
        if (data?.messages && Array.isArray(data.messages)) {
          const newDmMessages = data.messages.map((m: any) => ({ id: m.id, conversationId: m.conversationId, senderId: m.senderId, recipientId: m.recipientId, content: m.content || m.message, status: m.status, timestamp: new Date(m.timestamp), editedAt: m.editedAt ? new Date(m.editedAt) : undefined, deletedAt: m.deletedAt ? new Date(m.deletedAt) : undefined }));
          setDmMessages(prev => {
            const existingIds = new Set(prev.map((m: DirectMessage) => m.id));
            const uniqueNew = newDmMessages.filter((m: DirectMessage) => !existingIds.has(m.id));
            const merged = [...prev, ...uniqueNew].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            return merged;
          });
        }
      } catch (err) { if (active) console.error('[Chat] DM messages poll error:', err); }
    };
    fetchDMMessages();
    timer = setInterval(fetchDMMessages, 2000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [activeTab, selectedConversationId]);

  // Notify parent of DM unread count
  useEffect(() => {
    if (onDMUnreadCountChange) onDMUnreadCountChange(conversations.reduce((sum, c) => sum + c.unreadCount, 0));
  }, [conversations, onDMUnreadCountChange]);

  const currentMessages = messages.get(activeChannel) || [];
  const currentTypingUsers = typingUsers.get(activeChannel) || [];
  const isConnected = isPollingMessages;
  const connectionText = isConnected ? 'Connected' : 'Connecting...';
  const connectionIcon = isConnected ? <Wifi className="w-3.5 h-3.5 text-[--synth]" /> : <Loader2 className="w-3.5 h-3.5 text-[--text-3] animate-spin" />;

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowScrollButton(false); };

  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim() || messageInput.length > MAX_MESSAGE_LENGTH) { toast.error(`Message must be 1-${MAX_MESSAGE_LENGTH} characters`); return; }
    if (muteStatus.isMuted) { toast.error('You are muted'); return; }
    setIsSending(true);
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId: activeChannel, message: messageInput.trim() }) })
      .then(res => res.json()).then(data => { if (data?.message) { setMessageInput(''); scrollToBottom(); } setIsSending(false); })
      .catch(() => { toast.error('Failed to send'); setIsSending(false); });
  }, [messageInput, muteStatus, activeChannel]);

  const handleSendDM = useCallback(() => {
    if (!dmInput.trim() || !selectedConversationId) return;
    setIsSendingDM(true);
    fetch('/api/dm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: conversations.find(c => c.id === selectedConversationId)?.otherUserId, content: dmInput.trim() }) })
      .then(res => res.json()).then(data => { if (data?.message) { setDmInput(''); scrollToBottom(); } setIsSendingDM(false); })
      .catch(() => { toast.error('Failed to send'); setIsSendingDM(false); });
  }, [dmInput, selectedConversationId, conversations]);

  const formatTime = (date: Date): string => {
    const now = new Date(); const diffMs = now.getTime() - date.getTime(); const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now'; if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`; return date.toLocaleDateString();
  };

  const getUserInitials = (name: string): string => { if (!name) return '?'; const w = name.trim().split(/\s+/); return w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase(); };

  const totalUnreadDMs = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (panelSize === 'hidden') {
    return (
      <button onClick={() => setPanelSize('minimal')} className="w-10 h-10 bg-[--card] border border-[--border] rounded-full flex items-center justify-center text-[--electric] hover:bg-[--electric]/10 transition-all shadow-glow-electric" title="Show Chat">
        <MessageCircle className="w-5 h-5" />
      </button>
    );
  }

  const heightClass = panelSize === 'full' ? 'h-[calc(100vh-8rem)]' : panelSize === 'half' ? 'h-[400px]' : 'h-auto';
  const widthClass = 'w-full sm:w-96 lg:w-[28rem] xl:w-[32rem]';

  return (
    <div className={`${heightClass} ${widthClass} flex flex-col bg-[--card] border border-[--border] rounded-lg overflow-hidden transition-all duration-300`}>
      {/* HEADER */}
      <div className="px-3 py-2 border-b border-[--border] flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[--electric]" />
          <div>
            <h3 className="text-[13px] font-bold text-[--text-1]">
              {activeTab === 'DM'
                ? (selectedConversationId
                    ? conversations.find(c => c.id === selectedConversationId)?.otherUsername || 'DM'
                    : 'Direct Messages')
                : channels.find(c => c.id === activeChannel)?.name || 'Global Chat'}
            </h3>
            <p className="text-[10px] text-[--text-3]">{connectionText}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {connectionIcon}
          <div className="flex gap-1 ml-1">
            {(['full', 'half', 'minimal', 'hidden'] as const).map(size => (
              <button key={size} onClick={() => setPanelSize(size)} className={`px-2 py-0.5 text-[10px] rounded transition-colors ${panelSize === size ? 'bg-[--electric]/15 text-[--electric] border border-[--electric]/25' : 'text-[--text-3] hover:text-[--text-1] border border-transparent hover:border-[--border]'}`} title={size}>
                {size === 'hidden' ? '✕' : size.charAt(0).toUpperCase() + size.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MINIMAL MODE */}
      {panelSize === 'minimal' && (
        <div className="px-3 py-2 cursor-pointer hover:bg-white/[0.03] transition-colors border-t border-[--border]" onClick={() => setPanelSize('half')}>
          {currentMessages.length > 0 ? (
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-[--electric]/10 border border-[--electric]/20 flex items-center justify-center text-[10px] font-bold text-[--electric]">{getUserInitials(currentMessages[currentMessages.length - 1]?.senderUsername || '')}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-[--text-1]">{currentMessages[currentMessages.length - 1]?.senderUsername}</span>
                  {currentMessages[currentMessages.length - 1]?.senderIsVIP && <span className="text-[8px] font-bold text-[--neon-yellow] bg-[--neon-yellow]/10 px-1 rounded">VIP</span>}
                  <span className="text-[10px] text-[--text-3] ml-auto">{formatTime(currentMessages[currentMessages.length - 1]?.timestamp || new Date())}</span>
                </div>
                <p className="text-xs text-[--text-2] truncate">{currentMessages[currentMessages.length - 1]?.content}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[--text-3]"><MessageCircle className="w-4 h-4" /><p className="text-xs italic">No messages yet</p></div>
          )}
        </div>
      )}

      {/* HALF MODE */}
      {panelSize === 'half' && (
        <>
          <div className="px-3 py-1.5 border-b border-[--border] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs"><Users className="w-3.5 h-3.5 text-[--text-3]" /><span className="text-[--text-2]">{onlineCount} online</span></div>
            <select value={activeChannel} onChange={e => setActiveChannel(e.target.value as ChannelType)} className="bg-white/[0.04] border border-[--border] rounded px-2 py-0.5 text-xs text-[--text-1] cursor-pointer">
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}{c.unreadCount > 0 ? ` (${c.unreadCount})` : ''}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {currentMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[--text-3]"><MessageCircle className="w-8 h-8 mb-2 opacity-50" /><p className="text-xs">No messages yet</p></div>
            ) : currentMessages.map(msg => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  currentUserId={userId}
                  channelType={activeChannel}
                />
              ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="px-2 py-2 border-t border-[--border]">
            <div className="flex gap-1">
              <input value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Type a message..." maxLength={MAX_MESSAGE_LENGTH} className="flex-1 bg-white/[0.04] border border-[--border] rounded px-2 py-1 text-xs text-[--text-1] placeholder-[--text-3] focus:outline-none focus:border-[--electric]/30" />
              <Button variant="primary" size="sm" onClick={handleSendMessage} disabled={isSending || !messageInput.trim()}><Send className="w-3 h-3" /></Button>
            </div>
          </div>
        </>
      )}

      {/* FULL MODE */}
      {panelSize === 'full' && (
        <>
          {/* Mode tabs */}
          <div className="px-3 py-2 border-b border-[--border] flex gap-1.5">
            <button onClick={() => setActiveTab('CHAT')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'CHAT' ? 'bg-[--electric]/10 border border-[--electric]/25 text-[--electric]' : 'bg-white/[0.03] border border-[--border] text-[--text-2] hover:bg-white/[0.06]'}`}>
              <MessageCircle className="w-3.5 h-3.5" /> Channels
            </button>
            <button onClick={() => setActiveTab('DM')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${activeTab === 'DM' ? 'bg-[--electric]/10 border border-[--electric]/25 text-[--electric]' : 'bg-white/[0.03] border border-[--border] text-[--text-2] hover:bg-white/[0.06]'}`}>
              <Mail className="w-3.5 h-3.5" /> DMs{totalUnreadDMs > 0 && <Badge className="bg-[--neon-red] text-[9px] px-1 py-0 text-white font-bold">{totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}</Badge>}
            </button>
          </div>

          {activeTab === 'CHAT' ? (
            <>
              {/* Channel tabs */}
              <div className="px-3 py-1.5 border-b border-[--border] flex gap-1 overflow-x-auto">
                {channels.map(c => (
                  <button key={c.id} onClick={() => setActiveChannel(c.id)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-all ${activeChannel === c.id ? 'bg-[--electric]/10 border border-[--electric]/25 text-[--electric]' : 'bg-white/[0.03] border border-[--border] text-[--text-2] hover:bg-white/[0.06]'}`}>
                    {c.icon}<span>{c.name}</span>{c.unreadCount > 0 && <span className="bg-[--neon-red] text-white text-[8px] px-1 rounded-full font-bold">{c.unreadCount}</span>}
                  </button>
                ))}
              </div>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {fetchError && (
                  <div className="flex flex-col items-center justify-center py-4 text-[--neon-red]">
                    <p className="text-xs">{fetchError}</p>
                    <button onClick={() => { setIsPollingMessages(true); setFetchError(null); }} className="text-[10px] underline mt-1">Retry</button>
                  </div>
                )}
                {currentMessages.length === 0 && !fetchError ? (
                  <div className="flex flex-col items-center justify-center h-full text-[--text-3]"><MessageCircle className="w-8 h-8 mb-2 opacity-50" /><p className="text-xs">No messages yet. Start the conversation!</p></div>
                ) : currentMessages.map(msg => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    currentUserId={userId}
                    channelType={activeChannel}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
              {/* Input */}
              <div className="px-2 py-2 border-t border-[--border]">
                <div className="flex gap-1">
                  <input value={messageInput} onChange={e => setMessageInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Type a message..." maxLength={MAX_MESSAGE_LENGTH} className="flex-1 bg-white/[0.04] border border-[--border] rounded px-2 py-1 text-xs text-[--text-1] placeholder-[--text-3] focus:outline-none focus:border-[--electric]/30" />
                  <Button variant="primary" size="sm" onClick={handleSendMessage} disabled={isSending || !messageInput.trim()}><Send className="w-3 h-3" /></Button>
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-[--text-3]">
                  <span>{messageInput.length}/{MAX_MESSAGE_LENGTH}</span>
                  {currentTypingUsers.length > 0 && <span className="italic">{currentTypingUsers.map(t => t.username).join(', ')} typing...</span>}
                </div>
              </div>
            </>
          ) : (
            /* DM MODE */
            <div className="flex-1 flex flex-col">
              {selectedConversationId ? (
                <>
                  <div className="px-3 py-2 border-b border-[--border] flex items-center justify-between">
                    <button onClick={() => setSelectedConversationId(null)} className="text-xs text-[--text-2] hover:text-[--text-1]">← Back</button>
                    <span className="text-xs font-bold text-[--text-1]">{conversations.find(c => c.id === selectedConversationId)?.otherUsername}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {dmMessages.filter(m => !m.deletedAt).map(msg => {
                      const isOwn = msg.senderId === userId;
                      return (
                        <div key={msg.id} className={`rounded px-2 py-1.5 max-w-[80%] ${isOwn ? 'ml-auto bg-[--electric]/10' : 'bg-white/[0.03]'}`}>
                          <p className="text-xs text-[--text-2] break-words whitespace-pre-wrap">{msg.content}</p>
                          <span className="text-[9px] text-[--text-3] mt-0.5 block">{formatTime(msg.timestamp)}</span>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="px-2 py-2 border-t border-[--border]">
                    <div className="flex gap-1">
                      <input value={dmInput} onChange={e => setDmInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendDM(); } }} placeholder="Type a message..." className="flex-1 bg-white/[0.04] border border-[--border] rounded px-2 py-1 text-xs text-[--text-1] placeholder-[--text-3] focus:outline-none focus:border-[--electric]/30" />
                      <Button variant="primary" size="sm" onClick={handleSendDM} disabled={isSendingDM || !dmInput.trim()}><Send className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="px-3 py-2 border-b border-[--border] flex items-center justify-between">
                    <span className="text-xs font-bold text-[--text-1]">Conversations</span>
                    <button onClick={() => setShowNewMessageModal(true)} className="p-1 bg-[--electric]/10 hover:bg-[--electric]/20 border border-[--electric]/25 rounded transition-all" title="New Message"><UserPlus className="w-3.5 h-3.5 text-[--electric]" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-[--text-3]"><Mail className="w-8 h-8 mb-2 opacity-30" /><p className="text-xs">No conversations yet</p></div>
                    ) : conversations.map(c => (
                      <button key={c.id} onClick={() => setSelectedConversationId(c.id)} className="w-full px-3 py-2 border-b border-[--border] hover:bg-white/[0.03] transition-colors flex items-center justify-between text-left">
                        <div><span className="text-xs font-semibold text-[--text-1]">{c.otherUsername}</span>{c.lastMessage && <p className="text-[10px] text-[--text-3] truncate max-w-[200px]">{c.lastMessage.content}</p>}</div>
                        {c.unreadCount > 0 && <span className="bg-[--neon-red] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{c.unreadCount}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
