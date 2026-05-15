/**
 * @file app/game/page.tsx
 * @created 2025-10-16
 * @overview Main game page with three-panel layout
 * 
 * UPDATES:
 * - 2025-10-17: Added Bank and Shrine panel integration with keyboard shortcuts
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { GameLayout, StatsPanel, TileRenderer, ControlsPanel, BankPanel, ShrinePanel, UnitBuildPanelEnhanced, FactoryManagementPanel, TierUnlockPanel, BattleLogLinks, SpecializationPanel, DiscoveryNotification, DiscoveryLogPanel, AchievementNotification, AchievementPanel, AuctionHousePanel, BotScannerPanel, BeerBasePanel, AutoFarmPanel, AutoFarmStatsDisplay, BotMagnetPanel, BotSummoningPanel, BountyBoardPanel, ShrineStatusPanel } from '@/components';
import { InventoryPanel } from '@/components/inventory';
import { TutorialOverlay, TutorialQuestPanel } from '@/components/tutorial';
import TopNavBar from '@/components/TopNavBar';
import FlagTrackerPanel from '@/components/FlagTrackerPanel';
import FlagBearerPanel from '@/components/FlagBearerPanel';
import TileHarvestStatus from '@/components/TileHarvestStatus';
import CaveItemNotification from '@/components/CaveItemNotification';
import ClanManagementView from '@/components/clan/ClanManagementView';
import LeaderboardView from '@/components/LeaderboardView';
import ClanLeaderboardView from '@/components/ClanLeaderboardView';
import StatsViewWrapper from '@/components/StatsViewWrapper';
import TechTreePage from '@/app/tech-tree/page';
import ProfilePage from '@/app/profile/page';
import AdminPage from '@/app/admin/page';
import ReferralsPage from '@/app/referrals/page';
import WMDMiniStatus from '@/components/WMDMiniStatus';
import WMDHub from '@/components/WMDHub';
import { TerrainType, Discovery, Achievement, type FlagBearer } from '@/types';
import { AutoFarmEngine } from '@/utils/autoFarmEngine';
import { AutoFarmStatus, AutoFarmSessionStats, AutoFarmAllTimeStats, AutoFarmEvent, DEFAULT_SESSION_STATS, DEFAULT_ALL_TIME_STATS } from '@/types/autoFarm.types';
import { loadAllTimeStats } from '@/lib/autoFarmPersistence';
import { isTypingInInput } from '@/hooks/useKeyboardShortcut';

/**
 * Get background image path for current tile terrain
 * Returns the image path for immersive background effect
 */
function getTerrainBackgroundImage(terrain: TerrainType, x: number, y: number): string {
  // Handle terrains with variations
  if (terrain === TerrainType.Wasteland) {
    const variation = ((x + y) % 4) + 1;
    return `/assets/tiles/wasteland/wasteland_${variation}.jpg`;
  }
  
  if (terrain === TerrainType.Forest) {
    const variation = ((x + y) % 4) + 1;
    return `/assets/tiles/forest/forest_${variation}.jpg`;
  }
  
  // Handle terrains with single images
  const singleImageMap: Partial<Record<TerrainType, string>> = {
    [TerrainType.Metal]: '/assets/tiles/metal/metal.jpg',
    [TerrainType.Energy]: '/assets/tiles/energy/energy.jpg',
    [TerrainType.Cave]: '/assets/tiles/cave/cave.jpg',
    [TerrainType.Shrine]: '/assets/tiles/shrine/shrine-base.jpg',
  };
  
  if (singleImageMap[terrain]) {
    return singleImageMap[terrain]!;
  }
  
  // Handle Bank (pick random bank image)
  if (terrain === TerrainType.Bank) {
    const banks = ['energy-bank.jpg', 'metal-bank.jpg', 'exchange_bank.jpg'];
    const index = (x + y) % banks.length;
    return `/assets/tiles/banks/${banks[index]}`;
  }
  
  // Factory - no images available, use wasteland as fallback
  if (terrain === TerrainType.Factory) {
    const variation = ((x + y) % 4) + 1;
    return `/assets/tiles/wasteland/wasteland_${variation}.jpg`;
  }
  
  // Default fallback
  return '/assets/tiles/wasteland/wasteland_1.jpg';
}

export default function GamePage() {
  const { player, currentTile, isLoading, refreshGameState, updateTileOnly, setPlayer } = useGameContext();
  const router = useRouter();
  const [harvestResult, setHarvestResult] = useState<any>(null);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackResult, setAttackResult] = useState<any>(null);
  const [factoryData, setFactoryData] = useState<any>(null);
  const [lastTileKey, setLastTileKey] = useState<string>('');
  // Bank and Shrine now use currentView instead of modal states
  const [showUnitBuildPanel, setShowUnitBuildPanel] = useState(false);
  const [showFactoryManagement, setShowFactoryManagement] = useState(false);
  const [showTierUnlockPanel, setShowTierUnlockPanel] = useState(false);
  const [showAchievementPanel, setShowAchievementPanel] = useState(false);
  const [showAuctionHouse, setShowAuctionHouse] = useState(false);
  const [showDiscoveryLog, setShowDiscoveryLog] = useState(false);
  const [showBotMagnet, setShowBotMagnet] = useState(false);
  const [showBotSummoning, setShowBotSummoning] = useState(false);
  const [showBountyBoard, setShowBountyBoard] = useState(false);
  
  // ============================================
  // CENTER VIEW STATE (Embedded Page Navigation)
  // ============================================
  type CenterView = 'TILE' | 'LEADERBOARD' | 'STATS' | 'TECH_TREE' | 'CLAN' | 'CLANS' | 'BATTLE_LOG' | 'INVENTORY' | 'PROFILE' | 'ADMIN' | 'WMD' | 'REFERRALS' | 'SHRINE' | 'BANK';
  const [currentView, setCurrentView] = useState<CenterView>('TILE');
  
  const [panelMessage, setPanelMessage] = useState<string>('');
  const [discoveryNotification, setDiscoveryNotification] = useState<Discovery | null>(null);
  const [achievementNotification, setAchievementNotification] = useState<Achievement | null>(null);
  const [totalDiscoveries, setTotalDiscoveries] = useState<number | undefined>(undefined);

  // ============================================
  // CHAT & DM STATE
  // ============================================
  const [chatTab, setChatTab] = useState<'CHAT' | 'DM'>('CHAT');
  const [dmUnreadCount, setDmUnreadCount] = useState<number>(0);

  // ============================================
  // AUTO-FARM STATE & ENGINE
  // ============================================
  const autoFarmEngineRef = useRef<AutoFarmEngine | null>(null);
  const playerRef = useRef(player);
  playerRef.current = player; // Always reflects latest player state
  const [autoFarmStatus, setAutoFarmStatus] = useState<AutoFarmStatus>(AutoFarmStatus.STOPPED);
  const [autoFarmTilesCompleted, setAutoFarmTilesCompleted] = useState<number>(0);
  const [autoFarmLastAction, setAutoFarmLastAction] = useState<string>('Ready');
  const [autoFarmSessionStats, setAutoFarmSessionStats] = useState<AutoFarmSessionStats>(DEFAULT_SESSION_STATS);
  const [autoFarmAllTimeStats, setAutoFarmAllTimeStats] = useState<AutoFarmAllTimeStats>(DEFAULT_ALL_TIME_STATS);

  // ============================================
  // FLAG TRACKER STATE
  // ============================================
  const [flagBearer, setFlagBearer] = useState<FlagBearer | null>(null);
  const [attackCooldown, setAttackCooldown] = useState<boolean>(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Redirect to login if no player (but ONLY after loading finishes)
  // This prevents race conditions where we redirect before GameContext loads player
  useEffect(() => {
    // Only redirect if:
    // 1. Loading is complete (!isLoading)
    // 2. No player data found (!player)
    // 3. We're not already navigating
    if (!isLoading && !player) {
      console.log('[GamePage] No authenticated session, redirecting to login');
      router.push('/login');
    }
  }, [player, isLoading, router]);

  // Listen for inventory open event from StatsPanel
  useEffect(() => {
    const handler = () => setCurrentView(prev => prev === 'INVENTORY' ? 'TILE' : 'INVENTORY');
    window.addEventListener('openInventory', handler);
    return () => window.removeEventListener('openInventory', handler);
  }, []);

  // Initialize AutoFarmEngine
  useEffect(() => {
    const init = async () => {
    if (!player) return;

    // Create engine if it doesn't exist
    if (!autoFarmEngineRef.current) {
      // Load config from localStorage or use defaults
      let config;
      try {
        const savedConfig = localStorage.getItem('darkframe_autofarm_config');
        config = savedConfig ? JSON.parse(savedConfig) : {
          attackPlayers: false,
          rankFilter: 'ALL',
          resourceTarget: 'METAL',
          isVIP: player.vip || false
        };
        // Always update VIP status from player data (in case it changed)
        config.isVIP = player.vip || false;

        // Check flag bearer status for speed boost
        try {
          const resp = await fetch('/api/flag');
          const fd = await resp.json();
          if (fd.success && fd.data && fd.data.username === player.username) {
            config.speedMultiplier = 1.5;
          }
        } catch {} // Non-critical
        console.log('[AutoFarm Init] VIP Status Check:', { 
          playerVIP: player.vip, 
          playerHasVIPField: 'vip' in player,
          configIsVIP: config.isVIP,
          shrineBoosts: player.shrineBoosts?.length || 0
        });
      } catch (error) {
        config = {
          attackPlayers: false,
          rankFilter: 'ALL',
          resourceTarget: 'METAL',
          isVIP: player.vip || false
        };
        console.log('[AutoFarm Init] VIP Status Check (error path):', { 
          playerVIP: player.vip, 
          configIsVIP: config.isVIP,
          shrineBoosts: player.shrineBoosts?.length || 0
        });
      }

      const engine = new AutoFarmEngine(config, player.currentPosition);
      
      // Set up callbacks
      engine.onEvent((event: AutoFarmEvent) => {
        // Handle auto-farm events (errors, completions, etc.)
        if (event.type === 'error') {
          setPanelMessage(`🤖 Auto-Farm: ${event.message}`);
          setAutoFarmLastAction(`❌ Error: ${event.message}`);
          setTimeout(() => setPanelMessage(''), 4000);
        } else if (event.type === 'complete') {
          setPanelMessage('🎉 Auto-Farm: Map completed!');
          setAutoFarmLastAction('✅ Map Complete!');
          setTimeout(() => setPanelMessage(''), 5000);
        } else if (event.type === 'move') {
          // Update last action
          setAutoFarmLastAction(`→ Moved to (${event.position.x}, ${event.position.y})`);
          
          // Update tile visual using lightweight update (doesn't destroy engine)
          updateTileOnly(event.position.x, event.position.y);

          // Sync GameContext player position with server-confirmed engine position
          const p = playerRef.current;
          if (p) {
            setPlayer({ ...p, currentPosition: event.position });
            // Track tutorial movement (fire-and-forget — non-blocking)
            fetch('/api/tutorial/track-action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerId: p.username, action: 'move' }),
            }).catch(() => {});
          }
        } else if (event.type === 'harvest') {
          // Keypress simulation triggers existing harvest UI - just update last action
          const data = event.data;
          const terrain = data?.terrain || 'Resource';
          const key = data?.key || '?';
          setAutoFarmLastAction(`⛏️ Harvesting ${terrain} (pressed '${key}')`);
          // Actual harvest result will be displayed by the game's existing harvest handlers
        } else if (event.type === 'combat') {
          // Display combat results just like manual attacks
          const data = event.data;
          if (data) {
            const outcome = data.victory ? '✅ Victory' : '❌ Defeat';
            setAutoFarmLastAction(`⚔️ ${outcome} vs ${data.defenderName || 'Enemy'}`);
            
            setAttackResult({
              success: data.success,
              message: data.message || 'Combat completed',
              victory: data.victory || false,
              metalStolen: data.metalStolen || 0,
              energyStolen: data.energyStolen || 0,
              xpGained: data.xpGained || 0,
              defenderName: data.defenderName || 'Unknown',
              unitsLost: data.unitsLost || 0
            });
            
            // Clear combat result after 5 seconds
            setTimeout(() => setAttackResult(null), 5000);
          }
        }
      });

      engine.onStats((stats: AutoFarmSessionStats) => {
        setAutoFarmSessionStats(stats);
      });

      engine.onState((state) => {
        setAutoFarmStatus(state.status);
        setAutoFarmTilesCompleted(state.tilesCompleted);
      });

      // Register refresh callback to update UI after harvests
      engine.onRefresh(async () => {
        // Lightweight resource update - just fetch player data without full refresh
        if (!player) return;
        
        try {
          const response = await fetch(`/api/player?username=${encodeURIComponent(player.username)}`);
          const data = await response.json();
          
          if (data.success && data.data) {
            // Update only the player state with fresh data (includes updated resources)
            setPlayer(data.data);
            console.log('[AutoFarm] Resources updated in UI');
          }
        } catch (error) {
          console.warn('[AutoFarm] Failed to refresh resources:', error);
        }
      });

      autoFarmEngineRef.current = engine;
    }

    // Load all-time stats from localStorage
    const allTimeStats = loadAllTimeStats();
    setAutoFarmAllTimeStats(allTimeStats);
    }; // end init async
    init();

    // Cleanup ONLY on unmount (not on player changes)
    return () => {
      // Only destroy if component is actually unmounting
      // Don't destroy on player data updates (which happen from refreshGameState)
      if (autoFarmEngineRef.current && !player) {
        console.log('[AutoFarm] Destroying engine on unmount');
        autoFarmEngineRef.current.destroy();
        autoFarmEngineRef.current = null;
      }
    };
  }, [player?.username]); // Only re-run if username changes (i.e., different player logged in)

  // ============================================
  // FLAG TRACKER DATA FETCHING
  // ============================================
  useEffect(() => {
    // Fetch initial flag data
    // NOTE: Flag system is initialized at server startup in server.ts
    // No need to call /api/flag/init here - it's already done once globally
    const fetchFlagData = async () => {
      try {
        const response = await fetch('/api/flag');
        const data = await response.json();
        
        if (data.success && data.data) {
          setFlagBearer(data.data);
        } else {
          setFlagBearer(null);
        }
      } catch (error) {
        // Only log in development - flag might not be initialized yet
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Flag Tracker] Error fetching flag data:', error instanceof Error ? error.message : String(error));
        }
        setFlagBearer(null);
      }
    };

    // Fetch immediately
    fetchFlagData();

    // Poll for updates every 30 seconds (until WebSocket is implemented)
    const pollInterval = setInterval(fetchFlagData, 30000);

    return () => clearInterval(pollInterval);
  }, []);

  // Clear results and load factory data when tile changes
  useEffect(() => {
    if (!currentTile) return;
    
    const tileKey = `${currentTile.x},${currentTile.y}`;
    if (lastTileKey && lastTileKey !== tileKey) {
      // Clear harvest result when moving to a new tile
      setHarvestResult(null);
      // Clear attack/factory results which are position-specific
      setAttackResult(null);
      setFactoryData(null);
      
      // Close any embedded view or modal when player moves
      setCurrentView('TILE');
      setShowUnitBuildPanel(false);
      setShowFactoryManagement(false);
      setShowTierUnlockPanel(false);
      
      // Refresh flag bearer data after movement
      fetch('/api/flag')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setFlagBearer(data.data);
          }
        })
        .catch(err => console.error('[Flag Tracker] Error refreshing flag data after move:', err));
    }
    setLastTileKey(tileKey);

    // Load factory data if on factory tile
    if (currentTile.terrain === 'Factory') {
      fetch(`/api/factory/status?x=${currentTile.x}&y=${currentTile.y}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setFactoryData(data.factory);
          }
        })
        .catch(err => console.error('Failed to load factory data:', err));
    }
  }, [currentTile, lastTileKey]);

  // Handle keyboard shortcuts for Bank and Shrine
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Ignore if typing in input field or editable content
    if (isTypingInInput()) {
      return;
    }

    const key = event.key.toLowerCase();

    // 'K' key - Open Bank Panel (K for banK, since B is for Bot Scanner)
    if (key === 'k') {
      if (!currentTile || currentTile.terrain !== TerrainType.Bank) {
        setPanelMessage('❌ You must be at a Bank tile to access banking services');
        setTimeout(() => setPanelMessage(''), 3000);
        return;
      }
      setCurrentView('BANK');
    }

    // 'N' key - Open Shrine Panel (N for shriNe, avoiding S = South movement conflict)
    if (key === 'n') {
      if (!currentTile || currentTile.terrain !== TerrainType.Shrine) {
        setPanelMessage('❌ You must be at the Shrine (1, 1) to access shrine services');
        setTimeout(() => setPanelMessage(''), 3000);
        return;
      }
      setCurrentView('SHRINE');
    }

    // 'U' key - Open Unit Build Panel (can build anywhere)
    if (key === 'u') {
      setShowUnitBuildPanel(true);
    }

    // 'M' key - Open Factory Management Panel
    if (key === 'm') {
      setShowFactoryManagement(true);
    }

    // 'T' key - Open Tier Unlock Panel
    if (key === 't') {
      setShowTierUnlockPanel(true);
    }

    // 'V' key - Open Achievement Panel (V for achieVements, avoiding A = West movement conflict)
    if (key === 'v') {
      setShowAchievementPanel(prev => !prev);
    }

    // 'H' key - Open Auction House
    if (key === 'h') {
      setShowAuctionHouse(prev => !prev);
    }

    // 'J' key - Toggle Bot Magnet Panel
    if (key === 'j') {
      setShowBotMagnet(prev => !prev);
    }

    // 'Y' key - Toggle Bot Summoning Panel
    if (key === 'y') {
      setShowBotSummoning(prev => !prev);
    }

    // 'O' key - Toggle Bounty Board Panel
    if (key === 'o') {
      setShowBountyBoard(prev => !prev);
    }

    // 'Shift+F' key - Toggle Auto-Farm (Shift+F since F is for harvest)
    if (key === 'f' && event.shiftKey) {
      if (!autoFarmEngineRef.current) return;
      
      if (autoFarmStatus === AutoFarmStatus.STOPPED) {
        handleAutoFarmStart();
      } else if (autoFarmStatus === AutoFarmStatus.ACTIVE) {
        handleAutoFarmPause();
      } else if (autoFarmStatus === AutoFarmStatus.PAUSED) {
        handleAutoFarmResume();
      }
      return; // Prevent F key from triggering harvest
    }

    // 'C' key - Toggle Clan Panel
    if (key === 'c') {
      setCurrentView(prev => prev === 'CLAN' ? 'TILE' : 'CLAN');
    }

    // 'L' key - Toggle Clan Leaderboards Panel
    if (key === 'l') {
      setCurrentView(prev => prev === 'CLANS' ? 'TILE' : 'CLANS');
    }

    // 'P' key - Toggle Player Leaderboard Panel
    if (key === 'p') {
      setCurrentView(prev => prev === 'LEADERBOARD' ? 'TILE' : 'LEADERBOARD');
    }

    // 'Q' key - Flag Tracker is always visible (removed toggle)
    // Q hotkey removed - flag tracker now permanently in sidebar

    // 'I' key - Toggle Inventory view
    if (key === 'i') {
      setCurrentView(prev => prev === 'INVENTORY' ? 'TILE' : 'INVENTORY');
    }

    // 'G' key - Harvest for Metal/Energy (API validates tile type, don't block here)
    if (key === 'g') {
      handleHarvest();
    }

    // 'F' key - Harvest for Cave/Forest (API validates tile type, don't block here)
    if (key === 'f') {
      handleHarvest();
    }

    // 'R' key - Attack / Manage Factory / Attack Bot
    if (key === 'r') {
      if (currentTile?.botAtLocation) {
        handleAttack();
        return;
      }
      if (!currentTile || currentTile.terrain !== TerrainType.Factory) {
        return;
      }
      if (factoryData?.owner === player?.username) {
        setShowFactoryManagement(true);
      } else {
        handleAttack();
      }
    }
  }, [currentTile, factoryData, player]);

  // Handle harvest action
  const handleHarvest = async () => {
    if (!player || isHarvesting) return;

    setIsHarvesting(true);
    setHarvestResult(null); // Clear previous result

    try {
      const response = await fetch('/api/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: player.username }),
      });

      const data = await response.json();

      setHarvestResult({
        success: data.success,
        message: data.message,
        metalGained: data.metalGained,
        energyGained: data.energyGained,
        item: data.item,
      });

      // Update tile data immediately to show cooldown indicator
      if (data.success && currentTile) {
        setTimeout(() => {
          updateTileOnly(currentTile.x, currentTile.y);
        }, 100);
      }

      // Don't auto-clear results - they persist until player moves away
    } catch (error) {
      console.error('Harvest error:', error);
      setHarvestResult({
        success: false,
        message: 'Network error - please try again',
      });
    } finally {
      setIsHarvesting(false);
    }
  };

  // Handle factory attack action or bot attack
  const handleAttack = async () => {
    if (!player || !currentTile || isAttacking) return;

    setIsAttacking(true);
    setAttackResult(null); // Clear previous result

    // If there's a bot at this tile, attack the bot instead of the factory
    if (currentTile.botAtLocation) {
      try {
        const response = await fetch('/api/bot/attack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: player.username }),
        });

        const data = await response.json();

        setAttackResult({
          success: data.success,
          message: data.message,
          playerPower: data.playerPower || 0,
          factoryDefense: data.botPower || 0,
          captured: data.victory || false,
        });

        setTimeout(() => {
          setAttackResult(null);
          refreshGameState();
        }, 3000);
      } catch (error) {
        console.error('Bot attack error:', error);
        setAttackResult({
          success: false,
          message: 'Network error - please try again',
          playerPower: 0,
          factoryDefense: 0,
          captured: false,
        });
      } finally {
        setIsAttacking(false);
      }
      return;
    }

    // Otherwise, attack factory

    try {
      const response = await fetch('/api/factory/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: player.username,
          x: currentTile.x,
          y: currentTile.y
        })
      });

      const data = await response.json();

      setAttackResult({
        success: data.success,
        message: data.message,
        playerPower: data.playerPower,
        factoryDefense: data.factoryDefense,
        captured: data.captured
      });

      // Do NOT refresh game state unless factory was captured
      // Display result inline, player can continue
      if (data.captured) {
        // Only refresh if factory was successfully captured
        setTimeout(() => {
          refreshGameState();
        }, 2000);
      }

      // Clear result after 5 seconds
      setTimeout(() => {
        setAttackResult(null);
      }, 5000);
    } catch (error) {
      console.error('Factory attack error:', error);
      setAttackResult({
        success: false,
        message: 'Network error - please try again',
        playerPower: 0,
        factoryDefense: 0,
        captured: false
      });
    } finally {
      setIsAttacking(false);
    }
  };

  // Add/remove keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Handle panel transactions (refresh player data)
  const handleTransaction = async () => {
    await refreshGameState();
  };

  // ============================================
  // AUTO-FARM CONTROL HANDLERS
  // ============================================
  const handleAutoFarmStart = () => {
    if (autoFarmEngineRef.current) {
      if (player?.currentPosition) {
        autoFarmEngineRef.current.setPosition(player.currentPosition);
      }
      autoFarmEngineRef.current.start();
      setPanelMessage('🤖 Auto-Farm started!');
      setTimeout(() => setPanelMessage(''), 3000);
    }
  };

  const handleAutoFarmStop = () => {
    if (autoFarmEngineRef.current) {
      autoFarmEngineRef.current.stop();
      setPanelMessage('🛑 Auto-Farm stopped');
      refreshGameState();
    }
  };

  const handleAutoFarmPause = () => {
    if (autoFarmEngineRef.current) {
      autoFarmEngineRef.current.pause();
      setPanelMessage('⏸️ Auto-Farm paused');
      setTimeout(() => setPanelMessage(''), 3000);
    }
  };

  const handleAutoFarmResume = () => {
    if (autoFarmEngineRef.current) {
      autoFarmEngineRef.current.resume();
      setPanelMessage('▶️ Auto-Farm resumed');
      setTimeout(() => setPanelMessage(''), 3000);
    }
  };

  // ============================================
  // FLAG TRACKER HANDLERS
  // ============================================
  const handleFlagChallenge = async (bearer: FlagBearer) => {
    if (!player || attackCooldown) return;

    setPanelMessage('⚔️ Challenging...');
    try {
      const targetId = bearer.playerId && bearer.playerId.length > 0 ? bearer.playerId : 'BOT';

      const response = await fetch('/api/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'challenge',
          username: player.username,
          targetPlayerId: targetId,
          attackerPosition: player.currentPosition
        })
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: `Server error (${response.status})` }));
        setPanelMessage(`❌ ${result.error || `HTTP ${response.status}`}`);
        return;
      }

      const result = await response.json();

      if (result.success) {
        const claimed = result.data?.claimed;

        if (claimed) {
          // Bot claim — instant flag transfer
          setPanelMessage(`🎌 ${result.message || 'Flag claimed!'}`);
          await refreshGameState();
          const flagResponse = await fetch('/api/flag');
          const flagData = await flagResponse.json();
          if (flagData.success && flagData.data) {
            setFlagBearer(flagData.data);
          }
          setTimeout(() => setPanelMessage(''), 4000);
        } else {
          // Human challenge — channel created
          const lockDuration = result.data?.lockDuration ? Math.round(result.data.lockDuration / 1000) : 5;
          setPanelMessage(`⚔️ ${result.message || `Challenge against ${bearer.username}`}`);

          setAttackCooldown(true);
          setCooldownRemaining(lockDuration);
          const cooldownInterval = setInterval(() => {
            setCooldownRemaining(prev => {
              if (prev <= 1) {
                clearInterval(cooldownInterval);
                setAttackCooldown(false);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          // Refresh flag data
          const flagResponse = await fetch('/api/flag');
          const flagData = await flagResponse.json();
          if (flagData.success && flagData.data) {
            setFlagBearer(flagData.data);
          }
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[Flag Tracker] Challenge error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      setPanelMessage(`❌ ${errorMsg}`);
      setTimeout(() => setPanelMessage(''), 8000);
    }
  };

  const handleFlagRelease = async () => {
    if (!player) return;

    setPanelMessage('🏳️ Releasing flag...');
    try {
      const response = await fetch('/api/flag/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: `Server error (${response.status})` }));
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setPanelMessage(`🏳️ ${result.message || 'Flag released!'}`);
        await refreshGameState();
        setFlagBearer(null);
        setTimeout(() => setPanelMessage(''), 4000);
      } else {
        throw new Error(result.error || 'Release failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      setPanelMessage(`❌ ${errorMsg}`);
      setTimeout(() => setPanelMessage(''), 8000);
    }
  };

  const handleFlagTrack = (_bearer: FlagBearer) => {
    // Show flag bearer position info already visible in the tracker panel
    router.push('/profile');
  };

  if (!player) {
    return (
      <div className="min-h-screen bg-[--void] flex items-center justify-center">
        <p className="text-white/50">
          {isLoading ? 'Loading player data...' : 'Redirecting...'}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Tutorial System - Interactive quest overlay for new players */}
      {player && (
        <TutorialOverlay 
          playerId={player.username}
          isEnabled={true}
          onComplete={() => {
            console.log('Tutorial completed!');
            refreshGameState();
          }}
          onSkip={() => {
            console.log('Tutorial skipped');
          }}
        />
      )}

      <TopNavBar 
        onLeaderboardClick={() => setCurrentView('LEADERBOARD')}
        onClansClick={() => setCurrentView('CLANS')}
        onClanClick={() => setCurrentView('CLAN')}
        onStatsClick={() => setCurrentView('STATS')}
        onTechTreeClick={() => setCurrentView('TECH_TREE')}
        onProfileClick={() => setCurrentView('PROFILE')}
        onAdminClick={() => setCurrentView('ADMIN')}
        onWMDClick={() => setCurrentView('WMD')}
        onDMClick={() => setChatTab('DM')}
        dmUnreadCount={dmUnreadCount}
      />
      
      <CaveItemNotification />
      <DiscoveryNotification 
        discovery={discoveryNotification}
        totalDiscoveries={totalDiscoveries}
        onClose={() => {
          setDiscoveryNotification(null);
          setTotalDiscoveries(undefined);
        }}
      />
      <DiscoveryLogPanel 
        isOpen={showDiscoveryLog}
        onClose={() => setShowDiscoveryLog(false)}
      />
      <AchievementNotification
        achievement={achievementNotification}
        onDismiss={() => setAchievementNotification(null)}
      />
      {player && (
        <AchievementPanel
          isOpen={showAchievementPanel}
          onClose={() => setShowAchievementPanel(false)}
          username={player.username}
        />
      )}

      {/* Auction House Panel */}
      {showAuctionHouse && (
        <AuctionHousePanel onClose={() => setShowAuctionHouse(false)} />
      )}

      {/* Bot Magnet Panel (Hotkey: J) */}
      {showBotMagnet && (
        <BotMagnetPanel />
      )}

      {/* Bot Summoning Panel (Hotkey: Y) */}
      {showBotSummoning && (
        <BotSummoningPanel />
      )}

      {/* Bounty Board Panel (Hotkey: O) */}
      {showBountyBoard && (
        <BountyBoardPanel />
      )}

      {/* Bot Scanner Panel - Always rendered, self-manages "Shift+B" key activation */}
      <BotScannerPanel />

      {/* Beer Base Panel - Always rendered, self-manages hotkey activation */}
      <BeerBasePanel />
      
      {/* Bank and Shrine now use center panel views instead of modals */}

      {/* Unit Build Panel - Can build anywhere */}
      {player && (
        <UnitBuildPanelEnhanced
          isOpen={showUnitBuildPanel}
          onClose={() => setShowUnitBuildPanel(false)}
          factoryX={currentTile?.x || player.currentPosition.x}
          factoryY={currentTile?.y || player.currentPosition.y}
          playerResources={player.resources}
          availableSlots={999} // No slot limit when building anywhere
          maxSlots={999}
          usedSlots={0}
          onBuildComplete={async () => {
            await handleTransaction();
            // Reload factory data if on factory
            if (currentTile?.terrain === TerrainType.Factory) {
              const res = await fetch(`/api/factory/status?x=${currentTile.x}&y=${currentTile.y}`);
              const data = await res.json();
              if (data.success) {
                setFactoryData(data.factory);
              }
            }
          }}
        />
      )}

      {/* Factory Management Panel */}
      {player && (
        <FactoryManagementPanel
          isOpen={showFactoryManagement}
          onClose={() => setShowFactoryManagement(false)}
          username={player.username}
        />
      )}

      {/* Tier Unlock Panel */}
      {showTierUnlockPanel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowTierUnlockPanel(false)}>
          <div className="bg-black rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-black border-b border-white/10 p-3 flex justify-between items-center">
              <h2 className="text-xl font-bold text-[--neon-pink]">🧪 Research & Unlock Tiers</h2>
              <button
                onClick={() => setShowTierUnlockPanel(false)}
                className="text-white/40 hover:text-white text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <TierUnlockPanel />
            </div>
          </div>
        </div>
      )}

      {/* Panel Error Message Toast */}
      {panelMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-[--neon-red]/20 border border-[--neon-red]/30 text-white px-4 py-2 rounded-lg z-50 animate-fade-in">
          {panelMessage}
        </div>
      )}

      <GameLayout
        statsPanel={<StatsPanel onClanClick={() => setCurrentView('CLAN')} onReferralsClick={() => setCurrentView('REFERRALS')} onFactoryManagementClick={() => setShowFactoryManagement(true)} flagBearer={flagBearer} />}
        battleLogs={<BattleLogLinks />}
        backgroundImage={currentTile ? getTerrainBackgroundImage(currentTile.terrain, currentTile.x, currentTile.y) : undefined}
        chatUser={player ? {
          userId: player.username,
          username: player.username,
          level: player.level,
          isVIP: player.vip || false,
          clanId: player.clanId,
          clanName: player.clanName,
        } : undefined}
        initialChatTab={chatTab}
        onChatTabChange={setChatTab}
        onDMUnreadCountChange={setDmUnreadCount}
        tileView={
          currentView === 'TILE' && currentTile ? (
            <div className="flex items-center justify-center w-full h-full p-4">
              <TileRenderer 
                tile={currentTile} 
                harvestResult={harvestResult}
                factoryData={factoryData}
                attackResult={attackResult}
                flagBearer={flagBearer}
                onDiscovery={(discovery, total) => {
                  setDiscoveryNotification(discovery);
                  setTotalDiscoveries(total);
                }}
                onHarvestClick={handleHarvest}
                isHarvesting={isHarvesting}
                onAttackClick={handleAttack}
                isAttacking={isAttacking}
                onManageClick={() => setShowFactoryManagement(true)}
                onFlagChallenge={handleFlagChallenge}
                onBankClick={() => setCurrentView('BANK')}
                onShrineClick={() => setCurrentView('SHRINE')}
              />
            </div>
          ) : currentView === 'TILE' ? (
            <div className="flex items-center justify-center w-full h-full text-white/50">Loading tile...</div>
          ) : currentView === 'LEADERBOARD' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <LeaderboardView />
              </div>
            </div>
          ) : currentView === 'CLANS' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ClanLeaderboardView />
              </div>
            </div>
          ) : currentView === 'CLAN' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <ClanManagementView />
              </div>
            </div>
          ) : currentView === 'STATS' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <StatsViewWrapper 
                  currentTile={currentTile}
                  playerUsername={player?.username || ''}
                />
              </div>
            </div>
          ) : currentView === 'TECH_TREE' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <TechTreePage embedded={true} />
              </div>
            </div>
          ) : currentView === 'BATTLE_LOG' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-white text-lg">Battle Log View - Coming Soon</div>
              </div>
            </div>
          ) : currentView === 'INVENTORY' ? (
            <div className="h-full w-full flex flex-col">
              <div className="mb-2 flex-shrink-0">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <InventoryPanel />
              </div>
            </div>
          ) : currentView === 'PROFILE' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <ProfilePage embedded={true} />
              </div>
            </div>
          ) : currentView === 'ADMIN' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-[--void]">
                <AdminPage embedded={true} />
              </div>
            </div>
          ) : currentView === 'WMD' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <WMDHub />
              </div>
            </div>
          ) : currentView === 'REFERRALS' ? (
            <div className="h-full w-full flex flex-col p-4">
              <div className="mb-2">
                <button
                  onClick={() => setCurrentView('TILE')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[--shadow] hover:bg-white/10 rounded-lg transition-colors text-sm"
                >
                  <span>←</span>
                  <span>Back to Game</span>
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <ReferralsPage />
              </div>
            </div>
          ) : currentView === 'SHRINE' ? (
            <ShrinePanel
              tradeableItems={player?.inventory?.items?.filter(i => (i as unknown as Record<string,unknown>).itemType === 'TRADEABLE_ITEM') || []}
              activeBoosts={player?.shrineBoosts || []}
              onTransaction={refreshGameState}
              onBack={() => setCurrentView('TILE')}
            />
          ) : currentView === 'BANK' ? (
            <BankPanel
              isOpen={true}
              onClose={() => setCurrentView('TILE')}
              username={player?.username || ''}
              playerResources={player?.resources || { metal: 0, energy: 0 }}
              bankStorage={player?.bank || { metal: 0, energy: 0, lastDeposit: null }}
              bankType={currentTile?.bankType || 'metal'}
              onTransaction={refreshGameState}
            />
          ) : null
        }
        controlsPanel={
          <>
            <ControlsPanel />

            {/* Auto-Farm Control Panel */}
            <div className="p-3">
              <AutoFarmPanel
                status={autoFarmStatus}
                tilesCompleted={autoFarmTilesCompleted}
                lastAction={autoFarmLastAction}
                isVIP={player?.vip || false}
                onStart={handleAutoFarmStart}
                onPause={handleAutoFarmPause}
                onResume={handleAutoFarmResume}
                onStop={handleAutoFarmStop}
              />
            </div>

            {/* Flag Bearer Panel — Show when player IS the bearer */}
            {flagBearer && flagBearer.username === player?.username && (
              <div className="p-3">
                <FlagBearerPanel flagBearer={flagBearer} onRelease={handleFlagRelease} />
              </div>
            )}

            {/* Flag Tracker Panel — Always show (handles null bearer internally) */}
            {!(flagBearer && flagBearer.username === player?.username) && (
              <div className="p-3">
                <FlagTrackerPanel
                  playerPosition={player?.currentPosition || { x: 75, y: 75 }}
                  flagBearer={flagBearer}
                  onTrack={handleFlagTrack}
                  onChallenge={handleFlagChallenge}
                  challengeOnCooldown={attackCooldown}
                  cooldownRemaining={cooldownRemaining}
                  compact={false}
                />
              </div>
            )}

            {/* Shrine Status Panel */}
            <div className="p-3">
              <ShrineStatusPanel />
            </div>

            {/* WMD Mini Status Widget */}
            <div className="p-3">
              <WMDMiniStatus onClick={() => setCurrentView('WMD')} />
            </div>
          </>
        }
        tutorialQuestPanel={
          player && (
            <TutorialQuestPanel
              playerId={player.username}
              isVisible={true}
              onSkip={() => {
                console.log('Tutorial skipped from quest panel');
                refreshGameState();
              }}
              onMinimize={() => {
                console.log('Tutorial minimized');
              }}
            />
          )
        }
      />
    </>
  );
}

// ============================================================
// END OF FILE
// ============================================================

