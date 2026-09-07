/**
 * @file components/GameLayout.tsx
 * @created 2025-10-16
 * @overview Three-panel game layout component with battle logs, chat, and error boundaries
 * 
 * OVERVIEW:
 * Main game layout with flexible panel system:
 * - Left: Stats panel (player info) with optional battle logs below
 * - Center: Tile view (current location)
 * - Right: Controls panel (movement, resources)
 * - Bottom-Right: Chat panel (global/clan/trade chat) - Fixed overlay
 * 
 * FEATURES:
 * - Error boundaries protect each panel from crashes
 * - React.memo optimization for expensive panels
 * - Accessible landmark regions (aside, main, header)
 * - Chat panel as fixed overlay (bottom-right corner)
 * 
 * UPDATES:
 * - 2025-10-17: Added battleLogs prop for bottom-left display
 * - 2025-01-17: Added ErrorBoundary integration and performance optimization
 * - 2025-01-25: Added ChatPanel integration for FID-20251025-103
 */

'use client';

import React, { ReactNode, memo, useState, useEffect, useCallback } from 'react';
import { UserPlus } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import ChatPanel from './chat/ChatPanel';
import { ChatPanelProvider } from '@/context/ChatPanelContext';
import FriendsList from './friends/FriendsList';
import FriendRequestsPanel from './friends/FriendRequestsPanel';
import AddFriendModal from './friends/AddFriendModal';

interface GameLayoutProps {
  statsPanel: ReactNode;
  tileView: ReactNode;
  controlsPanel: ReactNode;
  battleLogs?: ReactNode; // Optional battle logs for bottom-left
  backgroundImage?: string; // Optional dynamic background image URL
  tutorialQuestPanel?: ReactNode; // Optional tutorial quest panel to render inside provider
  // Chat panel user data (optional - if not provided, chat panel won't be shown)
  chatUser?: {
    userId: string;
    username: string;
    level: number;
    isVIP: boolean;
    clanId?: string;
    clanName?: string;
  };
  // DM system integration
  initialChatTab?: 'CHAT' | 'DM'; // Initial tab for ChatPanel
  onChatTabChange?: (tab: 'CHAT' | 'DM') => void; // Callback when chat tab changes
  onDMUnreadCountChange?: (count: number) => void; // Callback when DM unread count changes
  // Friend system integration
  showFriendsPanel?: boolean; // Whether to show the friends panel
  onFriendRequestCountChange?: (count: number) => void; // Callback when friend request count changes
  onOpenDMWithFriend?: (friendUsername: string) => void; // Callback to open DM with a friend
}

/**
 * Three-panel game layout component with battle logs, chat, and error boundaries
 * 
 * Each panel is wrapped in ErrorBoundary to prevent cascading failures.
 * Panels are memoized to prevent unnecessary re-renders.
 * Supports dynamic background images for immersive atmosphere.
 * ChatPanel positioned as fixed overlay in bottom-right corner (only if chatUser provided).
 */
const GameLayoutInternal = memo(function GameLayoutInternal({ 
  statsPanel, 
  tileView, 
  controlsPanel, 
  battleLogs, 
  backgroundImage,
  chatUser,
  tutorialQuestPanel,
  initialChatTab,
  onChatTabChange,
  onDMUnreadCountChange,
  showFriendsPanel = false,
  onFriendRequestCountChange,
  onOpenDMWithFriend
}: GameLayoutProps) {
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendsListKey, setFriendsListKey] = useState(0);
  const [requestsPanelKey, setRequestsPanelKey] = useState(0);

  // Poll for pending friend request count
  useEffect(() => {
    if (!chatUser?.userId || !onFriendRequestCountChange) return;

    const fetchRequestCount = async () => {
      try {
        const response = await fetch('/api/friends/requests');
        if (response.ok) {
          const data = await response.json();
          const pendingCount = data.received?.length || 0;
          onFriendRequestCountChange(pendingCount);
        }
      } catch (error) {
        console.error('Failed to fetch friend request count:', error);
      }
    };

    fetchRequestCount();
    const interval = setInterval(fetchRequestCount, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [chatUser?.userId, onFriendRequestCountChange]);

  // Handle friend removal - refresh the friends list
  const handleFriendRemoved = useCallback(() => {
    setFriendsListKey(prev => prev + 1);
  }, []);

  // Handle friend request sent - refresh both panels
  const handleRequestSent = useCallback(() => {
    setRequestsPanelKey(prev => prev + 1);
  }, []);

  // Handle friend request accepted - refresh friends list
  const handleRequestAccepted = useCallback(() => {
    setFriendsListKey(prev => prev + 1);
    setRequestsPanelKey(prev => prev + 1);
  }, []);

  // Handle opening DM with a friend
  const handleMessageFriend = useCallback((friendUsername: string) => {
    if (onOpenDMWithFriend) {
      onOpenDMWithFriend(friendUsername);
    }
  }, [onOpenDMWithFriend]);

  // NEON NOIR §5.1: derive the per-terrain color grade from the scene image path
  // (/assets/tiles/<terrain>/...) — cyan-teal energy, rust metal, violet cave, emerald forest, …
  const terrainClass = React.useMemo(() => {
    if (!backgroundImage) return 'default';
    const match = backgroundImage.match(/\/assets\/tiles\/([a-z]+)\//i);
    const terrain = (match?.[1] ?? 'default').toLowerCase();
    const GRADES: Record<string, string> = {
      metal: 'metal', energy: 'energy', cave: 'cave', forest: 'forest',
      factory: 'factory', shrine: 'shrine', bank: 'bank',
    };
    return GRADES[terrain] ?? 'default';
  }, [backgroundImage]);
  // Scene image fades in only once decoded — an un-gated fade let the backdrop
  // paint bright and then visibly re-grade 2–3s after a tile load.
  const [sceneReady, setSceneReady] = React.useState(false);
  React.useEffect(() => {
    setSceneReady(false);
  }, [backgroundImage]);
  return (
    <div className="nn-shell relative min-h-screen text-[color:var(--nn-text-primary)]">
      {/* NEON NOIR scene layer (§5.1 F3 upgrade): full-window terrain background kept,
          now with per-terrain color grade, vignette, and 9s ambient drift. The
          crossfade between terrains is handled by the <img> opacity transition. */}
      {backgroundImage && (
        <div className="nn-scene" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed scene layer; next/image fill is the tile viewport's job */}
          <img
            key={backgroundImage}
            src={backgroundImage}
            alt=""
            className={`nn-scene__image object-cover ${sceneReady ? 'nn-scene__image--ready' : ''}`}
            onLoad={() => setSceneReady(true)}
          />
          <div className={`nn-scene__grade nn-scene__grade--${terrainClass}`} />
          <div className="nn-scene__vignette" />
        </div>
    )}

      {/* Main Game Area — nn-shell pads 56px for the fixed TopNav (the old
          pt-14 utility computed 0 post-Tailwind-4-migration, clipping the
          rails' first panels under the nav). */}
      <div className="relative z-10 flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        {/* Left Column - Stats + Battle Logs */}
        <aside className="nn-rail nn-rail--left hidden lg:flex w-full lg:w-72 xl:w-80 flex-col overflow-hidden" aria-label="Player statistics">
          {/* Stats Panel (Scrollable) */}
          <div className="flex-1 overflow-y-auto">
            <ErrorBoundary>
              {statsPanel}
            </ErrorBoundary>
          </div>
          
          {/* Battle Logs Panel (Fixed at bottom, if provided) */}
          {battleLogs && (
            <div className="nn-rail--left border-t border-[color-mix(in_oklab,var(--nn-cyan)_18%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] backdrop-blur-sm">
              <ErrorBoundary>
                {battleLogs}
              </ErrorBoundary>
            </div>
          )}
        </aside>

        {/* Center Panel - Tile View */}
        {/* scrollable so expanded tile content (factory status, attack results) below the
            tile image stays reachable instead of being clipped */}
        <main className="flex-1 flex bg-transparent overflow-y-auto" aria-label="Game world view">
          <ErrorBoundary>
            {tileView}
          </ErrorBoundary>
        </main>

        {/* Right Panel - Controls */}
        <aside className="nn-rail nn-rail--right hidden lg:flex lg:flex-col w-full lg:w-72 xl:w-80 overflow-y-auto" aria-label="Game controls">
          <ErrorBoundary>
            {controlsPanel}
          </ErrorBoundary>
        </aside>
      </div>

      {/* Tutorial quest — fixed overlay docked against the right sidebar's inner
          edge (mirrors chat on the left). Mounted OUTSIDE the rail: the rail's
          backdrop-filter makes position:fixed children rail-relative. */}
      {tutorialQuestPanel && (
        <ErrorBoundary>
          {tutorialQuestPanel}
        </ErrorBoundary>
      )}

      {/* Chat Panel - Fixed Overlay (Bottom-Left Corner) */}
      {chatUser && (
        <div className="fixed bottom-2 left-2 sm:bottom-4 sm:left-4 lg:left-[19rem] xl:left-[21rem] z-50 max-w-[calc(100vw-1rem)] sm:max-w-none">
          <ErrorBoundary>
            <ChatPanel 
              userId={chatUser.userId}
              username={chatUser.username}
              level={chatUser.level}
              isVIP={chatUser.isVIP}
              clanId={chatUser.clanId}
              clanName={chatUser.clanName}
              initialTab={initialChatTab}
              onTabChange={onChatTabChange}
              onDMUnreadCountChange={onDMUnreadCountChange}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Friends Panel - Fixed Overlay (Bottom-Right Corner) */}
      {showFriendsPanel && chatUser && (
        <div className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 lg:right-[19rem] xl:right-[21rem] z-50 max-w-[calc(100vw-1rem)] sm:max-w-md">
          <ErrorBoundary>
            <div className="rounded-lg border border-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_85%,transparent)] shadow-[0_0_24px_color-mix(in_oklab,var(--nn-cyan)_12%,transparent)] backdrop-blur-md overflow-hidden">
              {/* Friends Panel Header */}
              <div className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_8%,transparent)] px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="nn-scan-header flex items-center gap-2 text-sm font-bold tracking-[0.14em] text-[color:var(--nn-text-primary)]">
                    <UserPlus className="h-4 w-4 text-[color:var(--nn-cyan)]" />
                    FRIENDS
                  </h3>
                  <button
                    onClick={() => setShowAddFriendModal(true)}
                    className="nn-btn nn-btn--primary px-3 py-1.5 text-xs"
                  >
                    Add Friend
                  </button>
                </div>
              </div>

              {/* Friends Panel Content - Scrollable */}
              <div className="max-h-[60vh] overflow-y-auto">
                {/* Friend Requests Section */}
                <div className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)]">
                  <FriendRequestsPanel 
                    key={requestsPanelKey}
                    onRequestAccepted={handleRequestAccepted}
                  />
                </div>

                {/* Friends List Section */}
                <div>
                  <FriendsList
                    key={friendsListKey}
                    onMessageFriend={handleMessageFriend}
                    onFriendRemoved={handleFriendRemoved}
                    onAddFriendClick={() => setShowAddFriendModal(true)}
                  />
                </div>
              </div>
            </div>
          </ErrorBoundary>
        </div>
      )}

      {/* Add Friend Modal */}
      {showAddFriendModal && (
        <AddFriendModal
          isOpen={showAddFriendModal}
          onClose={() => setShowAddFriendModal(false)}
          onRequestSent={handleRequestSent}
        />
      )}
    </div>
  );
});

export default memo(function GameLayout(props: GameLayoutProps) {
  return (
    <ChatPanelProvider>
      {/* FID-20260906-005 T3.1: tutorialQuestPanel renders inside the right controls
          rail (see aside above) — no longer a viewport-fixed overlay. */}
      <GameLayoutInternal {...props} />
    </ChatPanelProvider>
  );
});

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * CHAT PANEL INTEGRATION (FID-20251025-103):
 * - ChatPanel added as fixed overlay in bottom-left corner
 * - Positioned with z-50 to appear above game panels
 * - Only rendered when chatUser prop is provided
 * - Wrapped in ErrorBoundary to prevent crashes
 * - User data passed via optional chatUser prop:
 *   {
 *     userId: string,
 *     username: string,
 *     level: number,
 *     isVIP: boolean,
 *     clanId?: string,
 *     clanName?: string
 *   }
 * 
 * FRIEND SYSTEM INTEGRATION (FID-20251026-019 - Task 29):
 * - Friends panel added as fixed overlay in bottom-right corner
 * - Positioned with z-50, mirrors chat panel positioning on opposite side
 * - Rendered when showFriendsPanel prop is true
 * - Contains three sections:
 *   1. FriendRequestsPanel - Dual tabs for received/sent requests
 *   2. FriendsList - List of accepted friends with online status
 *   3. AddFriendModal - Search and send friend requests
 * - HTTP polling every 5 seconds for friend request count updates
 * - Key-based component refresh for real-time updates:
 *   * friendsListKey - Incremented when friend removed or request accepted
 *   * requestsPanelKey - Incremented when request sent or accepted
 * - Integration with DM system:
 *   * onOpenDMWithFriend callback switches chat to DM mode
 *   * "Message" button in FriendActionsMenu opens DM conversation
 * - Badge updates via onFriendRequestCountChange callback
 * 
 * USAGE:
 * Pages using GameLayout should pass friend-related props to enable friends panel:
 * 
 * <GameLayout
 *   statsPanel={<StatsPanel />}
 *   tileView={<TileView />}
 *   controlsPanel={<ControlsPanel />}
 *   chatUser={{
 *     userId: player.username,
 *     username: player.username,
 *     level: player.level,
 *     isVIP: player.isVIP,
 *     clanId: player.clanId,
 *     clanName: player.clanName
 *   }}
 *   showFriendsPanel={friendsPanelOpen}
 *   onFriendRequestCountChange={(count) => setFriendRequestCount(count)}
 *   onOpenDMWithFriend={(username) => {
 *     setChatTab('DM');
 *     setSelectedDMUser(username);
 *     setDmPanelOpen(true);
 *   }}
 * />
 * 
 * If showFriendsPanel is false, friends panel won't be rendered.
 * This allows toggling the panel on/off from parent components.
 */

// ============================================================
// END OF FILE
// ============================================================
