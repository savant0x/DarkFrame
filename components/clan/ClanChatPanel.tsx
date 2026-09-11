/**
 * @file components/clan/ClanChatPanel.tsx
 * @created 2025-10-19
 * @overview Real-time clan chat and activity feed with notifications
 * 
 * OVERVIEW:
 * Comprehensive social communication panel combining real-time chat messaging
 * with a detailed activity feed showing all clan actions. Provides members with
 * complete visibility into clan communications and recent events.
 * 
 * KEY FEATURES:
 * - Real-time chat with message history (last 100 messages)
 * - Activity feed with last 50 clan events
 * - Auto-refresh every 10 seconds
 * - Toast notifications for important events
 * - Categorized activity events with icons
 * - Message timestamps with "time ago" formatting
 * - Auto-scroll to latest messages
 * - Message sending with character limit
 * - Permission-based message deletion (Leaders/Officers)
 * - Event filtering (All, Members, Bank, Warfare, Territory)
 * 
 * ACTIVITY EVENT TYPES:
 * - MEMBER_JOIN: New member joins
 * - MEMBER_LEAVE: Member departure
 * - MEMBER_KICKED: Member removal
 * - PROMOTION: Role upgrade
 * - DEMOTION: Role downgrade
 * - BANK_DEPOSIT: Resources added to bank
 * - BANK_WITHDRAW: Resources removed from bank
 * - WAR_DECLARED: War declaration
 * - WAR_VICTORY: War won
 * - WAR_DEFEAT: War lost
 * - TERRITORY_CLAIMED: New territory acquired
 * - TERRITORY_LOST: Territory lost
 * - ALLIANCE_FORMED: New alliance created
 * - ALLIANCE_BROKEN: Alliance ended
 * - PERK_ACTIVATED: Clan perk enabled
 * - RESEARCH_COMPLETED: Tech research finished
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 6 - Social Features & Chat
 * - Integrates with WebSocket for real-time updates (future enhancement)
 * - Currently uses polling (10s intervals)
 * - All clan members can view and send messages
 * - Activity feed is read-only for all members
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

import { 
  MessageCircle, 
  Activity, 
  Send, 
  Trash2,
  UserPlus,
  UserMinus,
  ArrowUp,
  ArrowDown,
  Coins,
  Swords,
  Map,
  Handshake,
  Sparkles,
  Beaker,
  Shield,
  Clock,
  Filter,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  senderRole: string;
  content: string;
  timestamp: Date;
}

type ActivityEventType = 
  | 'MEMBER_JOIN'
  | 'MEMBER_LEAVE'
  | 'MEMBER_KICKED'
  | 'PROMOTION'
  | 'DEMOTION'
  | 'BANK_DEPOSIT'
  | 'BANK_WITHDRAW'
  | 'WAR_DECLARED'
  | 'WAR_VICTORY'
  | 'WAR_DEFEAT'
  | 'TERRITORY_CLAIMED'
  | 'TERRITORY_LOST'
  | 'ALLIANCE_FORMED'
  | 'ALLIANCE_BROKEN'
  | 'PERK_ACTIVATED'
  | 'RESEARCH_COMPLETED';

interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  description: string;
  actorUsername: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

type ActivityFilter = 'ALL' | 'MEMBERS' | 'BANK' | 'WARFARE' | 'TERRITORY';

interface ClanChatPanelProps {
  clanId: string;
  currentUserId: string;
  currentUserRole: string;
}

export default function ClanChatPanel({ clanId, currentUserId, currentUserRole }: ClanChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activitiesEndRef = useRef<HTMLDivElement>(null);

  const maxMessageLength = 500;

  /**
   * Checks for new important events and triggers toast notifications
   */
  const checkForNewEvents = useCallback((newActivities: ActivityEvent[]) => {
    if (activities.length === 0) return; // Skip on initial load

    const latestActivityTime = activities[0]?.timestamp.getTime() || 0;
    const importantEvents = newActivities.filter(a => 
      a.timestamp.getTime() > latestActivityTime &&
      ['WAR_DECLARED', 'WAR_VICTORY', 'WAR_DEFEAT', 'ALLIANCE_FORMED', 'PERK_ACTIVATED'].includes(a.type)
    );

    importantEvents.forEach(event => {
      toast.info(event.description, {
        description: `${event.actorUsername} • ${formatTimeAgo(event.timestamp)}`,
        duration: 5000
      });
    });
  }, [activities]);

  /**
   * Fetches chat message history (initial load / manual refresh — full window)
   */
  const fetchMessages = useCallback(async () => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/clan/chat/messages?clanId=${clanId}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      setMessages((data.messages as Array<ChatMessage & { timestamp: string | Date }>).map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      })));
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [clanId]);

  /**
   * Delta poll (FID-20260909-027 §3.1): fetch only messages newer than the
   * newest one we hold, instead of re-downloading the full 100-message window
   * every 10 seconds. Merges preserve the existing render contract (newest
   * first — the full fetch is DESC, so delta results are reversed+prepended).
   * A `resync: true` response means our cursor was too stale to trust: the
   * payload is a fresh full window and replaces state outright.
   */
  const pollNewMessages = useCallback(async () => {
    const latest = messages[0]; // DESC list → index 0 is newest
    if (!latest) return;

    try {
      const response = await fetch(
        `/api/clan/chat/messages?clanId=${clanId}&since=${encodeURIComponent(latest.timestamp.toISOString())}`
      );
      if (!response.ok) return; // transient — keep the current window

      const data: { success: boolean; messages: Array<ChatMessage & { timestamp: string | Date }>; resync?: boolean } =
        await response.json();
      if (!data.success) return;

      if (data.resync) {
        setMessages(data.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
        return;
      }
      if (data.messages.length === 0) return;

      const incoming = data.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = incoming
          .filter((m) => !seen.has(m.id))
          // wire delta is ASC (oldest→newest); render contract is newest-first
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return [...fresh, ...prev];
      });
    } catch (error) {
      console.error('Error polling new messages:', error);
    }
  }, [clanId, messages]);

  /**
   * Fetches clan activity feed
   */
  const fetchActivities = useCallback(async () => {
    setIsLoadingActivities(true);
    try {
      const response = await fetch(`/api/clan/activity?clanId=${clanId}&limit=50`);
      if (!response.ok) throw new Error('Failed to fetch activities');
      
      const data = await response.json();
      const newActivities = (data.activities as Array<ActivityEvent & { timestamp: string | Date }>).map((a) => ({
        ...a,
        timestamp: new Date(a.timestamp)
      }));

      // Check for new important events and show toasts
      checkForNewEvents(newActivities);
      
      setActivities(newActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [clanId, checkForNewEvents]);

  useEffect(() => {
    fetchMessages();
    fetchActivities();

    // Auto-refresh every 10 seconds — delta poll only (FID-027 §3.1);
    // full window is fetched on mount and via the manual refresh button.
    const refreshInterval = setInterval(() => {
      pollNewMessages();
      fetchActivities();
    }, 10000);

    return () => clearInterval(refreshInterval);
  }, [fetchMessages, fetchActivities, pollNewMessages]);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Sends a chat message
   */
  const handleSendMessage = async () => {
    if (!messageInput.trim() || messageInput.length > maxMessageLength) {
      toast.error('Message must be 1-500 characters');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/clan/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId,
          content: messageInput.trim()
        })
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      
      // Add message to local state immediately for instant feedback
      setMessages(prev => [...prev, {
        ...data.message,
        timestamp: new Date(data.message.timestamp)
      }]);
      
      setMessageInput('');
      toast.success('Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Deletes a message (Leaders/Officers only)
   */
  const handleDeleteMessage = async (messageId: string) => {
    if (!['LEADER', 'CO_LEADER', 'OFFICER'].includes(currentUserRole)) {
      toast.error('Insufficient permissions');
      return;
    }

    try {
      const response = await fetch('/api/clan/chat/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanId, messageId })
      });

      if (!response.ok) throw new Error('Failed to delete message');
      
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  /**
   * Filters activities based on selected filter
   */
  const getFilteredActivities = () => {
    if (activityFilter === 'ALL') return activities;

    const filterMap: Record<ActivityFilter, ActivityEventType[]> = {
      ALL: [],
      MEMBERS: ['MEMBER_JOIN', 'MEMBER_LEAVE', 'MEMBER_KICKED', 'PROMOTION', 'DEMOTION'],
      BANK: ['BANK_DEPOSIT', 'BANK_WITHDRAW'],
      WARFARE: ['WAR_DECLARED', 'WAR_VICTORY', 'WAR_DEFEAT', 'ALLIANCE_FORMED', 'ALLIANCE_BROKEN'],
      TERRITORY: ['TERRITORY_CLAIMED', 'TERRITORY_LOST']
    };

    return activities.filter(a => filterMap[activityFilter].includes(a.type));
  };

  /**
   * Formats timestamp to "time ago" format
   */
  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  /**
   * Gets icon for activity event type
   */
  const getActivityIcon = (type: ActivityEventType) => {
    const iconMap: Record<ActivityEventType, React.ReactNode> = {
      MEMBER_JOIN: <UserPlus className="w-4 h-4 text-[color:var(--nn-green)]" />,
      MEMBER_LEAVE: <UserMinus className="w-4 h-4 nn-text-secondary" />,
      MEMBER_KICKED: <UserMinus className="w-4 h-4 text-[color:var(--nn-magenta)]" />,
      PROMOTION: <ArrowUp className="w-4 h-4 text-[color:var(--nn-amber)]" />,
      DEMOTION: <ArrowDown className="w-4 h-4 nn-text-secondary" />,
      BANK_DEPOSIT: <Coins className="w-4 h-4 text-[color:var(--nn-green)]" />,
      BANK_WITHDRAW: <Coins className="w-4 h-4 text-[color:var(--nn-amber)]" />,
      WAR_DECLARED: <Swords className="w-4 h-4 text-[color:var(--nn-magenta)]" />,
      WAR_VICTORY: <Shield className="w-4 h-4 text-[color:var(--nn-green)]" />,
      WAR_DEFEAT: <Shield className="w-4 h-4 text-[color:var(--nn-magenta)]" />,
      TERRITORY_CLAIMED: <Map className="w-4 h-4 text-[color:var(--nn-cyan)]" />,
      TERRITORY_LOST: <Map className="w-4 h-4 text-[color:var(--nn-magenta)]" />,
      ALLIANCE_FORMED: <Handshake className="w-4 h-4 text-[color:var(--nn-violet)]" />,
      ALLIANCE_BROKEN: <Handshake className="w-4 h-4 nn-text-secondary" />,
      PERK_ACTIVATED: <Sparkles className="w-4 h-4 text-[color:var(--nn-amber)]" />,
      RESEARCH_COMPLETED: <Beaker className="w-4 h-4 text-[color:var(--nn-violet)]" />
    };

    return iconMap[type] || <Activity className="w-4 h-4 nn-text-secondary" />;
  };

  const filteredActivities = getFilteredActivities();
  const canDeleteMessages = ['LEADER', 'CO_LEADER', 'OFFICER'].includes(currentUserRole);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CHAT SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-[color:var(--nn-text-primary)] flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[color:var(--nn-cyan)]" />
            Clan Chat
          </h3>
          <button onClick={fetchMessages} className="nn-btn nn-btn--ghost gap-2" disabled={isLoadingMessages}>
            <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'nn-spin-icon' : ''}`} />
          </button>
        </div>

        {/* Message List */}
        <div className="nn-surface nn-surface--dark border border-[color:var(--nn-glass-border)] rounded-none h-[500px] flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoadingMessages && messages.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-cyan)]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-20 nn-text-secondary">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map(message => (
                <div key={message.id} className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[color:var(--nn-cyan)] font-semibold text-sm">{message.senderUsername}</span>
                      <span className={`nn-chip text-xs ${message.senderRole === 'LEADER' ? 'nn-chip--amber' : 'nn-chip--cyan'}`}>
                        {message.senderRole}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="nn-text-secondary text-xs">{formatTimeAgo(message.timestamp)}</span>
                      {canDeleteMessages && message.senderId !== currentUserId && (
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="text-[color:var(--nn-magenta)] transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="nn-text-primary text-sm">{message.content}</p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t border-[color:var(--nn-glass-border)] p-3">
            <div className="flex gap-2">
              <input
                placeholder="Type your message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value.slice(0, maxMessageLength))}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={isSending}
                className="nn-input flex-1"
               />
              <button onClick={handleSendMessage} disabled={isSending || !messageInput.trim()} className="nn-btn gap-2">
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs nn-text-secondary">
              <span>{messageInput.length} / {maxMessageLength}</span>
              {messageInput.length > maxMessageLength * 0.9 && (
                <span className="text-[color:var(--nn-amber)]">Character limit approaching</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVITY FEED SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-[color:var(--nn-text-primary)] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[color:var(--nn-violet)]" />
            Activity Feed
          </h3>
          <button onClick={fetchActivities} className="nn-btn nn-btn--ghost gap-2" disabled={isLoadingActivities}>
            <RefreshCw className={`w-4 h-4 ${isLoadingActivities ? 'nn-spin-icon' : ''}`} />
          </button>
        </div>

        {/* Activity Filters */}
        <div className="flex gap-2 flex-wrap">
          <FilterButton
            label="All"
            active={activityFilter === 'ALL'}
            onClick={() => setActivityFilter('ALL')}
            count={activities.length}
          />
          <FilterButton
            label="Members"
            active={activityFilter === 'MEMBERS'}
            onClick={() => setActivityFilter('MEMBERS')}
            count={activities.filter(a => ['MEMBER_JOIN', 'MEMBER_LEAVE', 'MEMBER_KICKED', 'PROMOTION', 'DEMOTION'].includes(a.type)).length}
          />
          <FilterButton
            label="Bank"
            active={activityFilter === 'BANK'}
            onClick={() => setActivityFilter('BANK')}
            count={activities.filter(a => ['BANK_DEPOSIT', 'BANK_WITHDRAW'].includes(a.type)).length}
          />
          <FilterButton
            label="Warfare"
            active={activityFilter === 'WARFARE'}
            onClick={() => setActivityFilter('WARFARE')}
            count={activities.filter(a => ['WAR_DECLARED', 'WAR_VICTORY', 'WAR_DEFEAT', 'ALLIANCE_FORMED', 'ALLIANCE_BROKEN'].includes(a.type)).length}
          />
          <FilterButton
            label="Territory"
            active={activityFilter === 'TERRITORY'}
            onClick={() => setActivityFilter('TERRITORY')}
            count={activities.filter(a => ['TERRITORY_CLAIMED', 'TERRITORY_LOST'].includes(a.type)).length}
          />
        </div>

        {/* Activity List */}
        <div className="nn-surface nn-surface--dark border border-[color:var(--nn-glass-border)] rounded-none h-[500px] overflow-y-auto p-4 space-y-2">
          {isLoadingActivities && activities.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="nn-spin-icon w-8 h-8 text-[color:var(--nn-violet)]" />
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-20 nn-text-secondary">
              <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No activities in this category</p>
            </div>
          ) : (
            filteredActivities.map(activity => (
              <div key={activity.id} className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm text-[color:var(--nn-text-primary)] leading-relaxed">{activity.description}</p>
                      <span className="nn-chip text-xs ml-2">
                        {activity.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs nn-text-secondary">
                      <span className="text-[color:var(--nn-cyan)]">{activity.actorUsername}</span>
                      <span>•</span>
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(activity.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={activitiesEndRef} />
        </div>

        {/* Activity Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-2 text-center">
            <div className="nn-text-secondary mb-1">Total Events</div>
            <div className="text-[color:var(--nn-text-primary)] font-bold">{activities.length}</div>
          </div>
          <div className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-2 text-center">
            <div className="nn-text-secondary mb-1">Last 24h</div>
            <div className="text-[color:var(--nn-cyan)] font-bold">
              {activities.filter(a => new Date().getTime() - a.timestamp.getTime() < 86400000).length}
            </div>
          </div>
          <div className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-2 text-center">
            <div className="nn-text-secondary mb-1">Member Actions</div>
            <div className="text-[color:var(--nn-green)] font-bold">
              {activities.filter(a => ['MEMBER_JOIN', 'MEMBER_LEAVE', 'PROMOTION', 'DEMOTION'].includes(a.type)).length}
            </div>
          </div>
          <div className="nn-surface border border-[color:var(--nn-glass-border)] rounded-none p-2 text-center">
            <div className="nn-text-secondary mb-1">Warfare</div>
            <div className="text-[color:var(--nn-magenta)] font-bold">
              {activities.filter(a => ['WAR_DECLARED', 'WAR_VICTORY', 'WAR_DEFEAT'].includes(a.type)).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Filter Button Component
 */
interface FilterButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
}

function FilterButton({ label, active, onClick, count }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-none border text-sm font-medium transition-all ${
        active
          ? 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] text-[color:var(--nn-violet)]'
          : 'nn-surface border-[color:var(--nn-glass-border)] nn-text-secondary hover:nn-surface'
      }`}
    >
      {label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
    </button>
  );
}
