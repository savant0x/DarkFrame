'use client';

import React, { ReactNode, memo, useState, useEffect, useCallback } from 'react';
import { UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import ChatPanel from './chat/ChatPanel';
import { ChatPanelProvider } from '@/context/ChatPanelContext';
import FriendsList from './friends/FriendsList';
import FriendRequestsPanel from './friends/FriendRequestsPanel';
import AddFriendModal from './friends/AddFriendModal';

interface GameLayoutProps {
  statsPanel: ReactNode; tileView: ReactNode; controlsPanel: ReactNode; battleLogs?: ReactNode;
  backgroundImage?: string; tutorialQuestPanel?: ReactNode;
  chatUser?: { userId: string; username: string; level: number; isVIP: boolean; clanId?: string; clanName?: string; };
  initialChatTab?: 'CHAT' | 'DM'; onChatTabChange?: (tab: 'CHAT' | 'DM') => void;
  onDMUnreadCountChange?: (count: number) => void; showFriendsPanel?: boolean;
  onFriendRequestCountChange?: (count: number) => void; onOpenDMWithFriend?: (friendUsername: string) => void;
}

const GameLayoutInternal = memo(function GameLayoutInternal({
  statsPanel, tileView, controlsPanel, backgroundImage, battleLogs, chatUser, tutorialQuestPanel,
  initialChatTab, onChatTabChange, onDMUnreadCountChange, showFriendsPanel = false,
  onFriendRequestCountChange, onOpenDMWithFriend,
}: GameLayoutProps) {
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendsListKey, setFriendsListKey] = useState(0);
  const [requestsPanelKey, setRequestsPanelKey] = useState(0);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  useEffect(() => {
    if (!chatUser?.userId || !onFriendRequestCountChange) return;
    const fetchRequestCount = async () => {
      try { const response = await fetch('/api/friends/requests'); if (response.ok) { const data = await response.json(); onFriendRequestCountChange(data.received?.length || 0); } } catch {}
    };
    fetchRequestCount();
    const interval = setInterval(fetchRequestCount, 5000);
    return () => clearInterval(interval);
  }, [chatUser?.userId, onFriendRequestCountChange]);

  const handleFriendRemoved = useCallback(() => setFriendsListKey(p => p + 1), []);
  const handleRequestSent = useCallback(() => setRequestsPanelKey(p => p + 1), []);
  const handleRequestAccepted = useCallback(() => { setFriendsListKey(p => p + 1); setRequestsPanelKey(p => p + 1); }, []);
  const handleMessageFriend = useCallback((name: string) => onOpenDMWithFriend?.(name), [onOpenDMWithFriend]);

  const sidebarWidth = 288; // lg:w-72 = 18rem = 288px
  const sidebarWidthXl = 320; // xl:w-80 = 20rem = 320px

  const leftTransform = leftOpen ? 'translateX(0)' : 'translateX(-288px)';
  const rightTransform = rightOpen ? 'translateX(0)' : 'translateX(288px)';
  const centerLeft = leftOpen ? '288px' : '0px';
  const centerRight = rightOpen ? '288px' : '0px';

  return (
    <div className="relative min-h-screen bg-[--void] text-white">
      {backgroundImage && (
        <div className="fixed inset-0 z-0 transition-opacity duration-700 ease-in-out" style={{
          backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat', opacity: 0.35, filter: 'blur(2px) brightness(0.6)',
        }} />
      )}

      <div className="relative z-10 flex flex-col lg:flex-row h-screen">
        {/* Left Sidebar */}
        <aside
          className="hidden lg:flex flex-col overflow-hidden bg-[--card] border-r border-[--border] transition-all duration-300 ease-in-out fixed left-0 top-14 bottom-0 z-30"
          style={{ width: sidebarWidth, transform: leftTransform }}
        >
          <div className="flex-1 overflow-y-auto min-w-[288px]"><ErrorBoundary>{statsPanel}</ErrorBoundary></div>
          {battleLogs && <div className="border-t border-[--border] bg-[--card] min-w-[288px]"><ErrorBoundary>{battleLogs}</ErrorBoundary></div>}
        </aside>

        {/* Left toggle */}
        <button
          onClick={() => setLeftOpen(!leftOpen)}
          className="hidden lg:flex fixed top-1/2 -translate-y-1/2 z-40 w-5 h-12 items-center justify-center bg-[--card] border border-[--border] rounded-r-md hover:bg-white/[0.06] transition-all duration-300"
          style={{ left: leftOpen ? `${sidebarWidth - 1}px` : '0px' }}
        >
          <ChevronLeft className={`w-3 h-3 text-[--text-2] transition-transform duration-300 ${!leftOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Center — adjusting margins based on sidebar state */}
        <main
          className="flex-1 flex bg-transparent overflow-hidden pt-14 transition-all duration-300 ease-in-out"
          style={{ marginLeft: centerLeft, marginRight: centerRight }}
        >
          <ErrorBoundary>{tileView}</ErrorBoundary>
        </main>

        {/* Right toggle */}
        <button
          onClick={() => setRightOpen(!rightOpen)}
          className="hidden lg:flex fixed top-1/2 -translate-y-1/2 z-40 w-5 h-12 items-center justify-center bg-[--card] border border-[--border] rounded-l-md hover:bg-white/[0.06] transition-all duration-300"
          style={{ right: rightOpen ? `${sidebarWidth - 1}px` : '0px' }}
        >
          <ChevronRight className={`w-3 h-3 text-[--text-2] transition-transform duration-300 ${!rightOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Right Sidebar */}
        <aside
          className="hidden lg:flex flex-col overflow-y-auto bg-[--card] border-l border-[--border] transition-all duration-300 ease-in-out fixed right-0 top-14 bottom-0 z-30"
          style={{ width: sidebarWidth, transform: rightTransform }}
        >
          <div className="min-w-[288px]"><ErrorBoundary>{controlsPanel}</ErrorBoundary></div>
        </aside>
      </div>

      {/* Chat - positioned relative to left sidebar */}
      {chatUser && (
        <div
          className="fixed bottom-2 left-2 sm:bottom-4 sm:left-4 z-50 max-w-[calc(100vw-1rem)] sm:max-w-none transition-all duration-300"
          style={{ left: leftOpen ? `${sidebarWidth + 16}px` : '16px' }}
        >
          <ErrorBoundary><ChatPanel userId={chatUser.userId} username={chatUser.username} level={chatUser.level} isVIP={chatUser.isVIP} clanId={chatUser.clanId} clanName={chatUser.clanName} defaultCollapsed={false} initialTab={initialChatTab} onTabChange={onChatTabChange} onDMUnreadCountChange={onDMUnreadCountChange} /></ErrorBoundary>
        </div>
      )}

      {/* Friends */}
      {showFriendsPanel && chatUser && (
        <div
          className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-50 max-w-[calc(100vw-1rem)] sm:max-w-md transition-all duration-300"
          style={{ right: rightOpen ? `${sidebarWidth + 16}px` : '16px' }}
        >
          <ErrorBoundary>
            <div className="bg-[--card] border border-[--border] rounded-lg overflow-hidden">
              <div className="bg-white/[0.03] border-b border-[--border] px-3 py-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[--text-1] flex items-center gap-2"><UserPlus className="w-4 h-4 text-[--electric]" /> Friends</h3>
                <button onClick={() => setShowAddFriendModal(true)} className="px-2 py-1 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-[--text-2] rounded border border-[--border] transition-all font-semibold">Add Friend</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="border-b border-[--border]"><FriendRequestsPanel key={requestsPanelKey} onRequestAccepted={handleRequestAccepted} /></div>
                <FriendsList key={friendsListKey} onMessageFriend={handleMessageFriend} onFriendRemoved={handleFriendRemoved} onAddFriendClick={() => setShowAddFriendModal(true)} />
              </div>
            </div>
          </ErrorBoundary>
        </div>
      )}

      {showAddFriendModal && <AddFriendModal isOpen={showAddFriendModal} onClose={() => setShowAddFriendModal(false)} onRequestSent={handleRequestSent} />}
    </div>
  );
});

export default memo(function GameLayout(props: GameLayoutProps) {
  return (<><ChatPanelProvider><GameLayoutInternal {...props} /></ChatPanelProvider>{props.tutorialQuestPanel}</>);
});