/**
 * @file app/admin/page.tsx
 * @created 2025-10-18
 * @overview Admin panel with database inspection and player management
 * 
 * OVERVIEW:
 * Admin-only page (level 3+ required) for viewing game statistics,
 * managing players, inspecting database, and troubleshooting issues.
 */

'use client';

import React, { useState, useEffect, useCallback, lazy, Suspense, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { extractApiError } from '@/lib/apiClient';
import { formatNumberAbbreviated } from '@/utils/formatting';
import BackButton from '@/components/BackButton';
import ActivityTimeline from '@/components/admin/charts/ActivityTimeline';
import ResourceGains from '@/components/admin/charts/ResourceGains';
import SessionDistribution from '@/components/admin/charts/SessionDistribution';
import FlagBreakdown from '@/components/admin/charts/FlagBreakdown';
import BotPopulationTrends from '@/components/admin/charts/BotPopulationTrends';
import PlayerDetailModal from '@/components/admin/PlayerDetailModal';
import TileInspectorModal from '@/components/admin/TileInspectorModal';
import FactoryInspectorModal from '@/components/admin/FactoryInspectorModal';
import BattleLogsModal from '@/components/admin/BattleLogsModal';
import AchievementStatsModal from '@/components/admin/AchievementStatsModal';

// FID-20260909-035: scheduler-health panel, lazy-loaded (opened on demand)
const JobsStatusModal = lazy(() => import('@/components/admin/JobsStatusModal'));

// FID-20260912-074: factory settings surface, lazy-loaded (opened on demand)
const FactorySettingsPanel = lazy(() => import('@/components/admin/FactorySettingsPanel'));
import SystemResetModal from '@/components/admin/SystemResetModal';
import WebSocketConsoleModal from '@/components/admin/WebSocketConsoleModal';
import HotkeyManagerPanel from '@/components/HotkeyManagerPanel';
import { showSuccess, showError, showInfo } from '@/lib/toastService';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { Coins, Crown, Users, CalendarClock } from 'lucide-react';

interface AdminStats {
  totalPlayers: number;
  totalBases: number;
  totalFactories: number;
  activePlayers1h?: number;
  activePlayers24h: number;
  activePlayers7d?: number;
  mapStats: {
    wastelands: number;
    metal: number;
    energy: number;
    caves: number;
    forests: number;
    banks: number;
    shrines: number;
  };
}

interface PlayerListItem {
  username: string;
  level: number;
  rank: number;
  metal: number;
  energy: number;
  baseLocation: string;
  lastActive?: string;
  // FID-20260912-084: bot identity for the registry's Type column + filter
  isBot?: boolean;
  isBeerBase?: boolean;
  specialization?: string | null;
  botTier?: number | null;
  // FID-20260912-085: loot drilldown for beer base rows
  totalStrength?: number;
  totalDefense?: number;
  armySize?: number;
}

/**
 * FID-20260912-086: tier gradient chip — T1 (green) through T7 (red), so the
 * registry shows the power gradient for every bot at a glance. Colors follow
 * the threat ramp used elsewhere (scanner, WMD): cool → hot as tier rises.
 */
const TIER_CHIP_COLORS: Record<number, string> = {
  1: 'var(--nn-green)',
  2: 'var(--nn-cyan)',
  3: 'var(--nn-violet)',
  4: 'var(--nn-amber)',
  5: '#ff9f43',
  6: 'var(--nn-magenta)',
  7: 'var(--nn-red, #ff4757)',
};

function TierChip({ tier }: { tier: number }) {
  const color = TIER_CHIP_COLORS[tier] ?? 'var(--nn-text-secondary)';
  return (
    <span
      className="nn-lab ml-2"
      style={{
        marginBottom: 0,
        color,
        borderColor: color,
        fontSize: '0.65rem',
        padding: '0 4px',
      }}
      title={`Power tier ${tier}`}
    >
      T{tier}
    </span>
  );
}

interface AdminPageProps {
  embedded?: boolean; // When true, hides router-based navigation elements
}

// ============================================================================
// API payload types — structural shapes derived from the producing routes
// (app/api/admin/...) and the chart components' prop interfaces. Sources noted
// per type. (SESSION-2026-09-02-007 lint burn-down)
// ============================================================================

// app/api/admin/bot-stats → { data: BotStatsPayload } (field `total`, capitalized spec keys)
type BotSpecKey = 'Hoarder' | 'Fortress' | 'Raider' | 'Balanced' | 'Ghost';
interface BotStatsPayload {
  total: number;
  bySpecialization: Record<BotSpecKey, number>;
  byTier: { tier1: number; tier2: number; tier3: number; tier4: number; tier5: number; tier6: number };
  specialBases: number;
  totalResources: { metal: number; energy: number };
  averageResources: { metal: number; energy: number };
  zoneDistribution: Record<string, number>;
}

// app/api/admin/wmd-status → { data: WmdStatusPayload }
interface WmdAlert {
  type: string;
  message: string;
  playerId?: string;
  clanId?: string;
  createdAt: string;
}
interface WmdStatusPayload {
  activeOperations?: { missiles: number; votes: number };
  jobs?: { scheduled: number };
  alerts?: WmdAlert[];
}

// app/api/admin/wmd-analytics → { data: WmdAnalyticsPayload }
interface WmdAnalyticsPayload {
  missiles?: { total?: number; intercepted?: number; hit?: number; successRate?: number; avgDamage?: number };
  votes?: { total?: number; passed?: number; failed?: number; approvalRate?: number };
  defense?: { researchAttempts?: number; researchSuccesses?: number; activeSpyOps?: number };
  economy?: { totalSpent?: number; avgCost?: number; uniqueClans?: number };
  balance?: { warnings?: string[] };
}

// app/api/admin/beer-bases/analytics/* → { data: ... }
interface TierCount { tier: number; count: number }
interface BeerSpawnStats {
  dailySpawns?: Array<{ count: number }>;
  averagePerDay?: number;
  tierDistribution?: TierCount[];
  spawnSources?: Array<{ source: string; count: number }>;
}
interface BeerDefeatStats {
  dailyDefeats?: Array<{ count: number }>;
  averagePerDay?: number;
  defeatsByTier?: TierCount[];
  topPlayers?: Array<{ username: string; totalDefeats: number; totalRewards: { metal: number; energy: number } }>;
}
interface BeerEffectivenessStats {
  defeatRate?: number;
  engagementScore?: number;
  avgLifespanByTier?: Array<{ tier: number; avgLifespanHours: number }>;
  peakHours?: Array<{ hour: number; count: number }>;
}

// GET /api/admin/health → panel header strip payload (FID-20260906-003 S7)
interface HealthPayload {
  db: { ok: boolean; latencyMs: number };
  migrations: { latest: string; upToDate: boolean };
  env: { jwtSecret: boolean; databaseUrl: boolean; cronSecret: boolean; stripeSecretKey: boolean };
  cron: { reachable: boolean; note: string };
  wmdAlerts: { unacknowledged: number; latest: Array<{ type: string; severity: string; message: string; createdAt: string }> };
  checkedAt: string;
}

/**
 * FID-20260906-003 S5: fetch wrapper with one retry on 5xx/network errors.
 * The dashboard bursts ~8 parallel fetches on mount; Supavisor's 15-client
 * session cap occasionally sheds one under load, blanking whole panels until a
 * manual reload. 4xx responses are returned as-is (retrying can't fix auth/validation).
 */
const fetchAdminJson = async (path: string, retries = 1): Promise<Response> => {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(path);
      if (res.ok || res.status < 500 || attempt >= retries) return res;
    } catch (err) {
      if (attempt >= retries) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
};

// app/api/admin/rp-economy/*
interface RpStats {
  totalRP: number;
  dailyGeneration: number;
  activeEarners24h: number;
  averageBalance: number;
  medianBalance: number;
  totalGenerated: number;
  totalSpent: number;
  vipPlayers: number;
}
interface RpTransaction {
  _id: string;
  timestamp: string;
  username: string;
  source: string;
  description: string;
  amount: number;
  vipBonusApplied: boolean;
}
// top-players route sends `isVIP` (not `vip`)
interface RpTopPlayer { username: string; amount: number; isVIP: boolean }

// app/api/admin/vip/list → { users: [...] } (field is `vip`, boolean)
interface VipUser {
  username: string;
  email: string | null;
  vip: boolean;
  vipExpiration: string | null;
}

// app/api/admin/beer-bases/list rows (FID-20260912-081 roster)
interface BeerBaseRosterEntry {
  username: string;
  tier: string;
  level: number;
  position: { x: number; y: number };
  totalStrength: number;
  totalDefense: number;
  resources: { metal: number; energy: number };
  armySize: number;
}

// app/api/admin/beer-bases/schedules rows
interface BeerSchedule {
  id: string;
  enabled: boolean;
  dayOfWeek: number;
  hour: number;
  spawnPercentage: number;
  timezone: string;
  name?: string | null;
}

// Chart-feeding state shapes = the chart components' prop interfaces
// (ActivityTimeline / ResourceGains / SessionDistribution / FlagBreakdown).
interface ActivityPoint { timestamp: number; date: string; count: number; uniquePlayers: number }
interface ResourcePoint { timestamp: number; date: string; metal: number; energy: number; total: number; sessions: number }
interface SessionBucket { label: string; range: string; count: number; uniquePlayers: number; color: string; avgDuration: number }
interface FlagSlice { severity: string; count: number }

export default function AdminPage({ embedded = false }: AdminPageProps) {
  const router = useRouter();
  const { player } = useGameContext();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [players, setPlayers] = useState<PlayerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // FID-20260906-003 S7: system health strip payload (GET /api/admin/health).
  const [health, setHealth] = useState<{ data: HealthPayload } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [showTileInspector, setShowTileInspector] = useState(false);
  const [showFactoryInspector, setShowFactoryInspector] = useState(false);
  const [showBattleLogs, setShowBattleLogs] = useState(false);
  const [showAchievementStats, setShowAchievementStats] = useState(false);
  const [showSystemReset, setShowSystemReset] = useState(false);
  const [showWebSocketConsole, setShowWebSocketConsole] = useState(false);
  const [showHotkeyManager, setShowHotkeyManager] = useState(false);
  // FID-20260909-035: scheduler-health visibility (jobs-status panel).
  const [showJobsStatus, setShowJobsStatus] = useState(false);
  
  // WMD system state
  const [wmdStatus, setWmdStatus] = useState<WmdStatusPayload | null>(null);
  const [wmdAnalytics, setWmdAnalytics] = useState<WmdAnalyticsPayload | null>(null);
  const [wmdTimeRange, setWmdTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  
  // Bot control state
  const [botStats, setBotStats] = useState<BotStatsPayload | null>(null);
  const [botConfig, setBotConfig] = useState({
    totalBotCap: 1000,
    dailySpawnCount: 75,
    migrationPercent: 0.30,
    regenRates: {
      hoarder: 0.05,
      fortress: 0.10,
      raider: 0.15,
      ghost: 0.20,
      balanced: 0.10
    }
  });
  const [botActionLoading, setBotActionLoading] = useState(false);
  
  // Beer Base smart spawning state
  const [beerBaseConfig, setBeerBaseConfig] = useState({
    enabled: true,
    spawnRateMin: 5,
    spawnRateMax: 10,
    resourceMultiplier: 3,
    respawnDay: 0, // 0 = Sunday
    respawnHour: 4, // 4 AM
    
    // Variety enforcement settings (FID-20251025-001)
    varietyEnabled: true,
    minWeakPercent: 15,
    minMediumPercent: 20,
    minStrongPercent: 15,
    minElitePercent: 10,
    maxSameTierPercent: 60,
    
    // Dynamic schedules settings (FID-20251025-003)
    schedulesEnabled: false,
    
    // Predictive spawning settings (FID-20251025-002)
    usePredictiveSpawning: false, // Use current player levels by default
    predictiveWeeksAhead: 2, // Project 2 weeks ahead when enabled
    predictiveExpanded: false, // UI state for collapsible section
  });
  const [beerBaseLoading, setBeerBaseLoading] = useState(false);
  
  // FID-20260912-081: the actual base roster (config sliders existed, the list didn't)
  const [beerBaseRoster, setBeerBaseRoster] = useState<BeerBaseRosterEntry[]>([]);
  const [beerBaseRosterLoading, setBeerBaseRosterLoading] = useState(false);
  const [beerBaseRosterOpen, setBeerBaseRosterOpen] = useState(false);
  
  // Schedule management state (FID-20251025-003)
  const [schedules, setSchedules] = useState<BeerSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // FID-20260912-074: factory settings panel visibility
  const [showFactorySettings, setShowFactorySettings] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BeerSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    enabled: true,
    dayOfWeek: 0,
    hour: 4,
    spawnPercentage: 100,
    timezone: 'America/New_York',
    name: ''
  });
  
  // Beer Base Analytics state (FID-20251025-004)
  const [beerAnalyticsExpanded, setBeerAnalyticsExpanded] = useState(false);
  const [beerAnalyticsPeriod, setBeerAnalyticsPeriod] = useState<'7d' | '14d' | '30d' | '90d' | '365d'>('30d');
  const [beerSpawnStats, setBeerSpawnStats] = useState<BeerSpawnStats | null>(null);
  const [beerDefeatStats, setBeerDefeatStats] = useState<BeerDefeatStats | null>(null);
  const [beerEffectivenessStats, setBeerEffectivenessStats] = useState<BeerEffectivenessStats | null>(null);
  const [beerAnalyticsLoading, setBeerAnalyticsLoading] = useState(false);
  const [beerAnalyticsError, setBeerAnalyticsError] = useState<string | null>(null);
  
  // Analytics state
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [activityData, setActivityData] = useState<ActivityPoint[]>([]);
  const [resourceData, setResourceData] = useState<ResourcePoint[]>([]);
  const [sessionData, setSessionData] = useState<{ buckets?: SessionBucket[] } | null>(null);
  const [flagData, setFlagData] = useState<FlagSlice[]>([]);
  
  // VIP Management state
  const [vipUsers, setVipUsers] = useState<VipUser[]>([]);
  const [vipFilter, setVipFilter] = useState<'all' | 'vip' | 'basic'>('all');
  const [vipSearchTerm, setVipSearchTerm] = useState('');
  const [vipLoading, setVipLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // RP Economy state
  const [rpEconomyExpanded, setRpEconomyExpanded] = useState(false);
  const [rpStats, setRpStats] = useState<RpStats | null>(null);
  const [rpTransactions, setRpTransactions] = useState<RpTransaction[]>([]);
  const [rpTopEarners, setRpTopEarners] = useState<RpTopPlayer[]>([]);
  const [rpTopSpenders, setRpTopSpenders] = useState<RpTopPlayer[]>([]);
  const [rpDateFilter, setRpDateFilter] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [rpSourceFilter, setRpSourceFilter] = useState<string>('all');
  const [rpUsernameFilter, setRpUsernameFilter] = useState('');
  const [rpBulkUsername, setRpBulkUsername] = useState('');
  const [rpBulkAmount, setRpBulkAmount] = useState<number>(0);
  const [rpBulkReason, setRpBulkReason] = useState('');
  const [rpBulkLoading, setRpBulkLoading] = useState(false);
  const [rpBulkResult, setRpBulkResult] = useState<string>('');
  const [rpLoading, setRpLoading] = useState(false);

  // Access control - Admin only (check isAdmin flag)
  const isAdmin = player?.isAdmin === true;

  useEffect(() => {
    if (!player) return;

    if (!isAdmin) {
      router.push('/game');
    }
  }, [player, router, isAdmin]);

  // Load admin stats
  useEffect(() => {
    if (!player || !isAdmin) return;

    const loadStats = async () => {
      setLoading(true);
      try {
        const [statsRes, playersRes, botStatsRes, botConfigRes, beerBaseConfigRes] = await Promise.all([
          fetchAdminJson('/api/admin/stats'),
          fetchAdminJson('/api/admin/players'),
          fetchAdminJson('/api/admin/bot-stats'),
          fetchAdminJson('/api/admin/bot-config'),
          fetchAdminJson('/api/admin/beer-bases/config')
        ]);

        const statsData = await statsRes.json();
        const playersData = await playersRes.json();
        const botStatsData = await botStatsRes.json();
        const botConfigData = await botConfigRes.json();
        const beerBaseConfigData = await beerBaseConfigRes.json();

        if (statsData.success) {
          setStats(statsData.data);
        }

        if (playersData.success) {
          setPlayers(playersData.data);
        }
        
        if (botStatsData.success) {
          setBotStats(botStatsData.data);
        }
        
        if (botConfigData.success) {
          setBotConfig(prev => ({
            ...prev,
            ...botConfigData.data
          }));
        }
        
        if (beerBaseConfigData.success) {
          const config = beerBaseConfigData.config;
          setBeerBaseConfig({
            enabled: config.enabled ?? true,
            spawnRateMin: config.spawnRateMin ?? 5,
            spawnRateMax: config.spawnRateMax ?? 10,
            resourceMultiplier: config.resourceMultiplier ?? 3,
            respawnDay: config.respawnDay ?? 0,
            respawnHour: config.respawnHour ?? 4,
            
            // Variety settings (FID-20251025-001)
            varietyEnabled: config.varietyEnabled ?? true,
            minWeakPercent: config.minWeakPercent ?? 15,
            minMediumPercent: config.minMediumPercent ?? 20,
            minStrongPercent: config.minStrongPercent ?? 15,
            minElitePercent: config.minElitePercent ?? 10,
            maxSameTierPercent: config.maxSameTierPercent ?? 60,
            
            // Dynamic schedules (FID-20251025-003)
            schedulesEnabled: config.schedulesEnabled ?? false,
            
            // Predictive spawning (FID-20251025-002)
            usePredictiveSpawning: config.usePredictiveSpawning ?? false,
            predictiveWeeksAhead: config.predictiveWeeksAhead ?? 2,
            predictiveExpanded: false, // UI state (not from backend)
          });
          
          // Load schedules if available
          if (config.schedules) {
            setSchedules(config.schedules);
          }
        }

        // Load WMD status
        const wmdStatusRes = await fetchAdminJson('/api/admin/wmd?action=status');
        const wmdStatusData = await wmdStatusRes.json();
        if (wmdStatusData.success) {
          setWmdStatus(wmdStatusData.data);
        }

        // Load WMD analytics
        const wmdAnalyticsRes = await fetchAdminJson(`/api/admin/wmd?action=analytics&range=${wmdTimeRange}`);
        const wmdAnalyticsData = await wmdAnalyticsRes.json();
        if (wmdAnalyticsData.success) {
          setWmdAnalytics(wmdAnalyticsData.data);
        }
      } catch (err) {
        console.error('Error loading admin data:', err);
        setError('Failed to load admin data');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    loadVipUsers(); // Load VIP users on mount
    // FID-20260906-003 S7: health strip load (one retry, never blocks the panel).
    fetchAdminJson('/api/admin/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHealth(data?.success ? data : null))
      .catch((err) => console.error('Failed to load admin health:', err));
  }, [player, isAdmin, wmdTimeRange]);

  // Reload WMD analytics when time range changes
  useEffect(() => {
    if (!player || !isAdmin) return;
    
    const loadWmdAnalytics = async () => {
      try {
        const res = await fetch(`/api/admin/wmd?action=analytics&range=${wmdTimeRange}`);
        const data = await res.json();
        if (data.success) {
          setWmdAnalytics(data.data);
        }
      } catch (err) {
        console.error('Failed to load WMD analytics:', err);
      }
    };

    loadWmdAnalytics();
  }, [wmdTimeRange, player, isAdmin]);

  // Reload VIP users when filter changes
  useEffect(() => {
    if (player && isAdmin) {
      loadVipUsers();
    }
  }, [vipFilter, player, isAdmin]);

  // Filter players by search term + FID-20260912-084 registry type filter
  const [registryFilter, setRegistryFilter] = useState<'all' | 'players' | 'bots' | 'beer'>('all');
  // FID-20260912-085: expanded beer-base loot rows (username-keyed)
  const [lootOpen, setLootOpen] = useState<Set<string>>(new Set());
  const toggleLoot = (username: string) => {
    setLootOpen(prev => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };
  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.username.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    switch (registryFilter) {
      case 'players': return !p.isBot;
      case 'bots': return !!p.isBot && !p.isBeerBase;
      case 'beer': return !!p.isBeerBase;
      default: return true;
    }
  });

  // Filter VIP users
  const filteredVipUsers = vipUsers
    .filter(u => {
      const matchesSearch = u.username.toLowerCase().includes(vipSearchTerm.toLowerCase()) ||
                           (u.email && u.email.toLowerCase().includes(vipSearchTerm.toLowerCase()));
      const matchesFilter = vipFilter === 'all' || 
                           (vipFilter === 'vip' && u.vip) || 
                           (vipFilter === 'basic' && !u.vip);
      return matchesSearch && matchesFilter;
    });

  // vip/list route sends `vip: boolean` (not `isVIP`) — counts were always 0
  const vipCount = vipUsers.filter(u => u.vip).length;
  const basicCount = vipUsers.length - vipCount;
  
  // Bot Control Handlers
  const handleSpawn10Bots = async () => {
    setBotActionLoading(true);
    try {
      const res = await fetch('/api/admin/bot-spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10, specialization: 'random' })
      });
      
      const data = await res.json();
      if (data.success) {
        // bot-spawn returns { bots: string[] } — derive the count from it.
        showSuccess(`Successfully spawned ${Array.isArray(data.bots) ? data.bots.length : 0} bots!`);
        // Refresh bot stats
        const botStatsRes = await fetch('/api/admin/bot-stats');
        const botStatsData = await botStatsRes.json();
        if (botStatsData.success) setBotStats(botStatsData.data);
      } else {
        showError(`Error: ${extractApiError(data, res.status)}`);
      }
    } catch (err) {
      console.error('Bot spawn error:', err);
      showError('Failed to spawn bots');
    } finally {
      setBotActionLoading(false);
    }
  };
  
  const handleRunRegen = async () => {
    setBotActionLoading(true);
    try {
      const res = await fetch('/api/admin/bot-regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (data.success) {
        showSuccess(`Regeneration complete! Updated ${data.updated} bots, spawned ${data.spawned} new bots.`);
        // Refresh bot stats
        const botStatsRes = await fetch('/api/admin/bot-stats');
        const botStatsData = await botStatsRes.json();
        if (botStatsData.success) setBotStats(botStatsData.data);
      } else {
        showError(`Error: ${extractApiError(data, res.status)}`);
      }
    } catch (err) {
      console.error('Bot regen error:', err);
      showError('Failed to run regeneration');
    } finally {
      setBotActionLoading(false);
    }
  };
  
  // FID-20260912-081: fetch the live base roster for the admin list
  const loadBeerBaseRoster = async () => {
    setBeerBaseRosterLoading(true);
    try {
      const res = await fetch('/api/admin/beer-bases/list');
      const data = await res.json();
      if (data.success) {
        setBeerBaseRoster(data.bases);
      } else {
        showError(`Failed to load beer base roster: ${extractApiError(data, res.status)}`);
      }
    } catch (err) {
      console.error('Beer base roster error:', err);
      showError('Failed to load beer base roster');
    } finally {
      setBeerBaseRosterLoading(false);
    }
  };

  const handleRespawnBeerBases = async () => {
    setBeerBaseLoading(true);
    try {
      const res = await fetch('/api/admin/beer-bases/respawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (data.success) {
        showSuccess(`Beer bases respawned! ${data.count} bases created using smart spawning.`);
        // Refresh bot stats + the roster list (FID-20260912-081)
        const botStatsRes = await fetch('/api/admin/bot-stats');
        const botStatsData = await botStatsRes.json();
        if (botStatsData.success) {
          setBotStats(botStatsData.data);
        }
        void loadBeerBaseRoster();
      } else {
        showError(`Error: ${extractApiError(data, res.status)}`);
      }
    } catch (err) {
      console.error('Beer base respawn error:', err);
      showError('Failed to respawn beer bases');
    } finally {
      setBeerBaseLoading(false);
    }
  };
  
  const handleSaveBeerBaseConfig = async () => {
    setBeerBaseLoading(true);
    try {
      const res = await fetch('/api/admin/beer-bases/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: beerBaseConfig.enabled,
          // FID-20260912-081: spawnRateMin/Max are PERCENT INTEGERS end to end —
          // the previous /100 here stored fractions (0.05) which getTargetBeerBaseCount
          // divided by 100 again, starving the population to a single base.
          spawnRateMin: beerBaseConfig.spawnRateMin,
          spawnRateMax: beerBaseConfig.spawnRateMax,
          resourceMultiplier: beerBaseConfig.resourceMultiplier,
          respawnDay: beerBaseConfig.respawnDay,
          respawnHour: beerBaseConfig.respawnHour,
          
          // Variety settings (FID-20251025-001)
          varietyEnabled: beerBaseConfig.varietyEnabled,
          minWeakPercent: beerBaseConfig.minWeakPercent,
          minMediumPercent: beerBaseConfig.minMediumPercent,
          minStrongPercent: beerBaseConfig.minStrongPercent,
          minElitePercent: beerBaseConfig.minElitePercent,
          maxSameTierPercent: beerBaseConfig.maxSameTierPercent,
          
          // Dynamic schedules (FID-20251025-003)
          schedulesEnabled: beerBaseConfig.schedulesEnabled,
          
          // Predictive spawning (FID-20251025-002)
          usePredictiveSpawning: beerBaseConfig.usePredictiveSpawning,
          predictiveWeeksAhead: beerBaseConfig.predictiveWeeksAhead,
        })
      });
      
      const data = await res.json();
      if (data.success) {
        showSuccess('Beer Base configuration saved successfully!');
      } else {
        showError(`Error: ${extractApiError(data, res.status)}`);
      }
    } catch (err) {
      console.error('Beer Base config save error:', err);
      showError('Failed to save Beer Base configuration');
    } finally {
      setBeerBaseLoading(false);
    }
  };
  
  // Schedule management functions (FID-20251025-003)
  const loadSchedules = async () => {
    setSchedulesLoading(true);
    try {
      const res = await fetch('/api/admin/beer-bases/schedules');
      const data = await res.json();
      if (data.success) {
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setSchedulesLoading(false);
    }
  };
  
  const handleSaveSchedule = async () => {
    setSchedulesLoading(true);
    try {
      const method = editingSchedule ? 'PUT' : 'POST';
      const body = editingSchedule 
        ? { id: editingSchedule.id, ...scheduleForm }
        : scheduleForm;
      
      const res = await fetch('/api/admin/beer-bases/schedules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (data.success) {
        showSuccess(editingSchedule ? 'Schedule updated!' : 'Schedule created!');
        setShowScheduleModal(false);
        setEditingSchedule(null);
        setScheduleForm({
          enabled: true,
          dayOfWeek: 0,
          hour: 4,
          spawnPercentage: 100,
          timezone: 'America/New_York',
          name: ''
        });
        await loadSchedules();
      } else {
        showError(`Error: ${extractApiError(data, res.status)}`);
      }
    } catch (err) {
      console.error('Schedule save error:', err);
      showError('Failed to save schedule');
    } finally {
      setSchedulesLoading(false);
    }
  };
  
  const handleDeleteSchedule = async (id: string) => {
    if (!(await confirmDialog('Delete this schedule?'))) return;
    
    setSchedulesLoading(true);
    try {
      const res = await fetch(`/api/admin/beer-bases/schedules?id=${id}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (data.success) {
        showSuccess('Schedule deleted!');
        await loadSchedules();
      } else {
        showError(`Error: ${extractApiError(data, res.status)}`);
      }
    } catch (err) {
      console.error('Schedule delete error:', err);
      showError('Failed to delete schedule');
    } finally {
      setSchedulesLoading(false);
    }
  };
  
  const handleToggleSchedule = async (schedule: BeerSchedule) => {
    setSchedulesLoading(true);
    try {
      const res = await fetch('/api/admin/beer-bases/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id,
          enabled: !schedule.enabled
        })
      });
      
      const data = await res.json();
      if (data.success) {
        await loadSchedules();
      } else {
        showError(`Error: ${extractApiError(data, res.status)}`);
      }
    } catch (err) {
      console.error('Schedule toggle error:', err);
      showError('Failed to toggle schedule');
    } finally {
      setSchedulesLoading(false);
    }
  };
  
  const handleEditSchedule = (schedule: BeerSchedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      enabled: schedule.enabled,
      dayOfWeek: schedule.dayOfWeek,
      hour: schedule.hour,
      spawnPercentage: schedule.spawnPercentage,
      timezone: schedule.timezone,
      name: schedule.name || ''
    });
    setShowScheduleModal(true);
  };
  
  // Load schedules when dynamic schedules are enabled
  useEffect(() => {
    if (beerBaseConfig.schedulesEnabled) {
      loadSchedules();
    }
  }, [beerBaseConfig.schedulesEnabled]);
  
  // Load Beer Base analytics (FID-20251025-004)
  const loadBeerBaseAnalytics = useCallback(async () => {
    setBeerAnalyticsLoading(true);
    setBeerAnalyticsError(null);
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      // Calculate start date based on period
      switch (beerAnalyticsPeriod) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '14d':
          startDate.setDate(endDate.getDate() - 14);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '365d':
          startDate.setDate(endDate.getDate() - 365);
          break;
      }
      
      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();
      
      const [spawnRes, defeatRes, effectivenessRes] = await Promise.all([
        fetch(`/api/admin/beer-bases/analytics/spawn-stats?startDate=${startStr}&endDate=${endStr}`),
        fetch(`/api/admin/beer-bases/analytics/defeat-stats?startDate=${startStr}&endDate=${endStr}`),
        fetch(`/api/admin/beer-bases/analytics/effectiveness?startDate=${startStr}&endDate=${endStr}`)
      ]);
      
      const [spawnData, defeatData, effectivenessData] = await Promise.all([
        spawnRes.json(),
        defeatRes.json(),
        effectivenessRes.json()
      ]);
      
      if (spawnData.success) {
        setBeerSpawnStats(spawnData.data);
      }
      
      if (defeatData.success) {
        setBeerDefeatStats(defeatData.data);
      }
      
      if (effectivenessData.success) {
        setBeerEffectivenessStats(effectivenessData.data);
      }
      
    } catch (err) {
      console.error('Failed to load Beer Base analytics:', err);
      setBeerAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setBeerAnalyticsLoading(false);
    }
  }, [beerAnalyticsPeriod]);
  
  // Load analytics when period changes or panel expands
  useEffect(() => {
    if (beerAnalyticsExpanded && player?.isAdmin) {
      loadBeerBaseAnalytics();
    }
  }, [beerAnalyticsPeriod, beerAnalyticsExpanded, player?.isAdmin, loadBeerBaseAnalytics]);
  
  const handleSaveConfig = async () => {
    setBotActionLoading(true);
    try {
      const res = await fetch('/api/admin/bot-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(botConfig)
      });
      
      const data = await res.json();
      if (data.success) {
        showSuccess('Bot configuration saved successfully!');
      } else {
        showError(`Error: ${extractApiError(data, res.status)}`);
      }
    } catch (err) {
      console.error('Config save error:', err);
      showError('Failed to save configuration');
    } finally {
      setBotActionLoading(false);
    }
  };
  
  const handleBotAnalytics = () => {
    if (!botStats) {
      showError('Bot stats not loaded yet');
      return;
    }
    
    // Route ground truth (bot-stats payload): field is `total`, spec keys are
    // capitalized. The previously displayed active/inactive/beerBases/migration/
    // regen fields do not exist in the payload and rendered undefined/0.
    // (SESSION-2026-09-02-007)
    const analyticsText = `
Bot Analytics:
━━━━━━━━━━━━━━
Total Bots: ${botStats.total}

By Specialization:
- Hoarder: ${botStats.bySpecialization.Hoarder || 0}
- Fortress: ${botStats.bySpecialization.Fortress || 0}
- Raider: ${botStats.bySpecialization.Raider || 0}
- Ghost: ${botStats.bySpecialization.Ghost || 0}
- Balanced: ${botStats.bySpecialization.Balanced || 0}
    `.trim();
    
    showInfo(analyticsText);
  };
  
  // Load analytics data
  const loadAnalyticsData = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    
    try {
      const [activityRes, resourceRes, sessionRes, flagsRes] = await Promise.all([
        fetchAdminJson(`/api/admin/analytics/activity-trends?period=${analyticsPeriod}`),
        fetchAdminJson(`/api/admin/analytics/resource-trends?period=${analyticsPeriod}`),
        fetchAdminJson(`/api/admin/analytics/session-trends?period=${analyticsPeriod}`),
        fetchAdminJson('/api/admin/anti-cheat/flagged-players')
      ]);
      
      const [activityJson, resourceJson, sessionJson, flagsJson] = await Promise.all([
        activityRes.json(),
        resourceRes.json(),
        sessionRes.json(),
        flagsRes.json()
      ]);
      
      if (activityJson.success) {
        setActivityData(activityJson.data || []);
      }
      
      if (resourceJson.success) {
        setResourceData(resourceJson.data || []);
      }
      
      if (sessionJson.success) {
        setSessionData(sessionJson);
      }
      
      if (flagsJson.success) {
        // Transform flag data for pie chart
        // Boundary cast pins the consumed shape of the flagged-players payload
        const severityCounts = (flagsJson.data as Array<{ maxSeverity?: string }>).reduce<Record<string, number>>((acc, flag) => {
          const severity = flag.maxSeverity || 'LOW';
          acc[severity] = (acc[severity] || 0) + 1;
          return acc;
        }, {});
        
        setFlagData(Object.entries(severityCounts).map(([severity, count]) => ({
          severity,
          count
        })));
      }
      
    } catch (err) {
      console.error('Analytics load error:', err);
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsPeriod]);

  // Load VIP users (FID-20260909-025 §4.2: failures are surfaced — an empty
  // table used to silently stand in for a 403/network error and read as
  // "there is no grant feature".
  const loadVipUsers = async () => {
    setVipLoading(true);
    try {
      const response = await fetch('/api/admin/vip/list');
      const data = await response.json();
      if (data.success) {
        setVipUsers(data.users);
      } else {
        showError(extractApiError(data, response.status));
      }
    } catch (error) {
      console.error('Error loading VIP users:', error);
      showError('Failed to load VIP users');
    } finally {
      setVipLoading(false);
    }
  };

  // Grant VIP
  const handleGrantVip = async (username: string, days: number) => {
    if (!(await confirmDialog(`Grant VIP to ${username} for ${days} days?`))) return;
    
    try {
      const response = await fetch('/api/admin/vip/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, days })
      });
      
      const data = await response.json();
      if (data.success) {
        showSuccess(`VIP granted to ${username} for ${days} days`);
        loadVipUsers(); // Refresh list
      } else {
        // FID-20260909-028 §2.2: createErrorResponse nests the message under
        // error.message; interpolating the object read as [object Object].
        const reason = data?.error?.message ?? data?.message ?? 'Request failed';
        showError(`Grant failed: ${reason}`);
      }
    } catch (error) {
      console.error('Error granting VIP:', error);
      showError('Failed to grant VIP');
    }
  };

  // Revoke VIP
  const handleRevokeVip = async (username: string) => {
    if (!(await confirmDialog(`Revoke VIP from ${username}?`))) return;
    
    try {
      const response = await fetch('/api/admin/vip/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      const data = await response.json();
      if (data.success) {
        showSuccess(`VIP revoked from ${username}`);
        loadVipUsers(); // Refresh list
      } else {
        const reason = data?.error?.message ?? data?.message ?? 'Request failed';
        showError(`Revoke failed: ${reason}`);
      }
    } catch (error) {
      console.error('Error revoking VIP:', error);
      showError('Failed to revoke VIP');
    }
  };

  // Load RP Economy data
  const loadRpEconomyData = useCallback(async () => {
    setRpLoading(true);
    
    try {
      const [statsRes, txRes, topRes] = await Promise.all([
        fetchAdminJson('/api/admin/rp-economy/stats'),
        fetchAdminJson(`/api/admin/rp-economy/transactions?period=${rpDateFilter}&source=${rpSourceFilter}&username=${rpUsernameFilter}`),
        fetchAdminJson(`/api/admin/rp-economy/top-players?period=${rpDateFilter}`)
      ]);
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setRpStats(data);
      }
      
      if (txRes.ok) {
        const data = await txRes.json();
        setRpTransactions(data.transactions || []);
      }
      
      if (topRes.ok) {
        const data = await topRes.json();
        setRpTopEarners(data.topEarners || []);
        setRpTopSpenders(data.topSpenders || []);
      }
      
    } catch (error) {
      console.error('Failed to load RP economy data:', error);
    } finally {
      setRpLoading(false);
    }
  }, [rpDateFilter, rpSourceFilter, rpUsernameFilter]);

  // Bulk RP Adjustment
  const handleRpBulkAdjustment = async () => {
    if (!rpBulkUsername || rpBulkAmount === 0 || !rpBulkReason) {
      setRpBulkResult('Please fill all fields');
      return;
    }
    
    setRpBulkLoading(true);
    setRpBulkResult('');
    
    try {
      const res = await fetch('/api/admin/rp-economy/bulk-adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: rpBulkUsername,
          amount: rpBulkAmount,
          reason: rpBulkReason,
          adminUsername: player?.username
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setRpBulkResult(`Success! ${rpBulkUsername} now has ${data.newBalance} RP`);
        setRpBulkUsername('');
        setRpBulkAmount(0);
        setRpBulkReason('');
        loadRpEconomyData(); // Refresh data
      } else {
        setRpBulkResult(`Error: ${extractApiError(data, res.status)}`);
      }
      
    } catch (error) {
      setRpBulkResult('Failed to adjust RP');
      console.error('Bulk adjustment error:', error);
    } finally {
      setRpBulkLoading(false);
    }
  };

  // Load RP Economy data when filters change
  useEffect(() => {
    if (rpEconomyExpanded && player?.isAdmin) {
      loadRpEconomyData();
    }
  }, [rpDateFilter, rpSourceFilter, rpUsernameFilter, rpEconomyExpanded, player?.isAdmin, loadRpEconomyData]);
  
  // Load analytics on mount and period change
  useEffect(() => {
    if (isAdmin && player) {
      loadAnalyticsData();
    }
  }, [analyticsPeriod, isAdmin, player, loadAnalyticsData]);

  // Helper functions for RP Economy
  const formatRpSourceName = (source: string) => {
    const sourceMap: Record<string, string> = {
      'harvest_milestone': 'Harvest Milestone',
      'level_up': 'Level Up',
      'battle': 'Battle',
      'achievement': 'Achievement',
      'daily_login': 'Daily Login',
      'admin_adjustment': 'Admin Adjustment'
    };
    return sourceMap[source] || source;
  };

  const formatRpTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (!player || !isAdmin) {
    return (
      <div className="nn-shell min-h-screen text-[color:var(--nn-text-primary)] flex items-center justify-center">
        <p>Access Denied - Admin Only</p>
      </div>
    );
  }

  return (
    <div className={embedded ? "p-6" : "nn-shell min-h-screen text-[color:var(--nn-text-primary)] p-8"}>
      <div className="w-full">
        {!embedded && <BackButton />}

        <div className="flex items-center justify-between mb-8 mt-4">
          <h1 className="nn-panel__title" style={{ fontSize: '1.5rem', letterSpacing: '0.25em' }}>ADMIN PANEL</h1>
          <div className="nn-chip nn-chip--violet" style={{ padding: '0.375rem 1rem', fontSize: '0.75rem' }}>
            <p className="text-sm text-[color:var(--nn-violet)]">Admin: {player.username}</p>
          </div>
        </div>

        {error && (
          <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4 mb-6">
            <p className="text-[color:var(--nn-magenta)]">{error}</p>
          </div>
        )}

        {/* FID-20260906-003 S7: system health strip — real checks, no mocks. */}
        {health && (
          <div className={`rounded-none p-3 mb-6 border flex flex-wrap items-center gap-x-5 gap-y-2 text-sm ${health.data.db.ok && health.data.migrations.upToDate && health.data.env.jwtSecret && health.data.env.databaseUrl ? 'bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]' : 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]'}`}>
            <span className="font-semibold text-[color:var(--nn-text-secondary)]">System Health</span>
            <span className="flex items-center gap-1.5">
              <span className={health.data.db.ok ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}>●</span>
              <span className="text-[color:var(--nn-text-secondary)]">DB</span>
              <span className={health.data.db.ok ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}>{health.data.db.ok ? `${health.data.db.latencyMs}ms` : 'down'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={health.data.migrations.upToDate ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-amber)]'}>●</span>
              <span className="text-[color:var(--nn-text-secondary)]">Migrations</span>
              <span className="text-[color:var(--nn-text-secondary)]" title={health.data.migrations.latest}>{health.data.migrations.upToDate ? 'current' : `behind (${health.data.migrations.latest})`}</span>
            </span>
            {(['jwtSecret', 'databaseUrl', 'cronSecret', 'stripeSecretKey'] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={health!.data.env[k] ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}>●</span>
                <span className="text-[color:var(--nn-text-secondary)] text-xs uppercase">{k.replace('Secret', '').replace('Key', '')}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5" title={health.data.cron.note}>
              <span className={health.data.cron.reachable ? 'text-[color:var(--nn-green)]' : health.data.cron.note.includes('skipped') ? 'text-[color:var(--nn-amber)]' : 'text-[color:var(--nn-magenta)]'}>●</span>
              <span className="text-[color:var(--nn-text-secondary)]">Cron</span>
            </span>
            {health.data.wmdAlerts.unacknowledged > 0 ? (
              <button
                onClick={() => document.getElementById('admin-wmd-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="nn-abtn nn-abtn--danger px-3 py-1 text-xs ml-auto"
              >
                ALERT · {health.data.wmdAlerts.unacknowledged} WMD alert{health.data.wmdAlerts.unacknowledged === 1 ? '' : 's'} — review
              </button>
            ) : (
              <span className="ml-auto text-[color:var(--nn-green)]">WMD alerts clear</span>
            )}
            <button
              onClick={() => document.getElementById('admin-vip-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="nn-abtn nn-abtn--amber px-3 py-1 text-xs"
              title="Jump to VIP Management (grant / revoke)"
            >
              VIP ▾
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-[color:var(--nn-text-secondary)]">Loading admin data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Game Statistics */}
            {stats && (
              <div className="nn-panel nn-panel--x-pad nn-panel--violet">
                <div className="nn-panel__header nn-panel__header--bleed">
                  <span className="nn-panel__title">Game Statistics</span>
                  <span className="nn-panel__meta">SOURCE ▸ SERVER AGGREGATE</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="nn-stat">
                    <p className="nn-stat__lab">Total Players</p>
                    <p className="nn-stat__num nn-stat__num--glow-cyan">{stats.totalPlayers}</p>
                  </div>
                  <div className="nn-stat">
                    <p className="nn-stat__lab">Player Bases</p>
                    <p className="nn-stat__num nn-stat__num--glow-green">{stats.totalBases}</p>
                  </div>
                  <div className="nn-stat">
                    <p className="nn-stat__lab">Factories</p>
                    <p className="nn-stat__num nn-stat__num--glow-magenta">{stats.totalFactories}</p>
                  </div>
                  <div className="nn-stat">
                    <p className="nn-stat__lab">Active · 1h / 24h / 7d</p>
                    <p className="nn-stat__num nn-stat__num--glow-green">{(stats.activePlayers1h ?? 0)} / {stats.activePlayers24h} / {(stats.activePlayers7d ?? 0)}</p>
                  </div>                  
                </div>

                <div className="mt-6">
                  <h3 className="nn-panel__title mb-3">Map Distribution</h3>
                  <div className="grid grid-cols-7 gap-2">
                    <div className="nn-tile p-3 text-center">
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Wasteland</p>
                      <p className="nn-num text-lg font-bold">{stats.mapStats.wastelands}</p>
                    </div>
                    <div className="nn-tile p-3 text-center">
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Metal</p>
                      <p className="nn-num text-lg font-bold text-[color:var(--nn-cyan)]">{stats.mapStats.metal}</p>
                    </div>
                    <div className="nn-tile p-3 text-center">
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Energy</p>
                      <p className="nn-num text-lg font-bold text-[color:var(--nn-amber)]">{stats.mapStats.energy}</p>
                    </div>
                    <div className="nn-tile p-3 text-center">
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Caves</p>
                      <p className="nn-num text-lg font-bold text-[color:var(--nn-amber)]">{stats.mapStats.caves}</p>
                    </div>
                    <div className="nn-tile p-3 text-center">
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Forests</p>
                      <p className="nn-num text-lg font-bold text-[color:var(--nn-green)]">{stats.mapStats.forests}</p>
                    </div>
                    <div className="nn-tile p-3 text-center">
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Banks</p>
                      <p className="nn-num text-lg font-bold text-[color:var(--nn-violet)]">{stats.mapStats.banks}</p>
                    </div>
                    <div className="nn-tile p-3 text-center">
                      <p className="text-xs text-[color:var(--nn-text-secondary)]">Shrines</p>
                      <p className="nn-num text-lg font-bold text-[color:var(--nn-magenta)]">{stats.mapStats.shrines}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Player Management */}
            <div className="nn-panel nn-panel--x-pad nn-panel--violet">
              <div className="nn-panel__header nn-panel__header--bleed">
                <span className="nn-panel__title">Player Management</span>
                <span className="nn-panel__meta">REGISTRY ▸ ALL PLAYERS</span>
              </div>
              <div className="flex justify-end items-center gap-3 mb-4">
                {/* FID-20260912-084: registry type filter */}
                <div className="flex gap-1">
                  {([['all', 'All'], ['players', 'Players'], ['bots', 'Bots'], ['beer', '🍺 Beer Bases']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setRegistryFilter(key)}
                      className={`nn-abtn nn-abtn--ghost text-xs ${registryFilter === key ? 'nn-abtn--amber' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="nn-input w-64"
                />
              </div>

              <div className="bg-[color:var(--nn-void)] rounded-none overflow-hidden">
                <table className="nn-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Type</th>
                      <th>Level</th>
                      <th>Rank</th>
                      <th>Metal</th>
                      <th>Energy</th>
                      <th>Base</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((p) => (
                      <Fragment key={p.username}>
                      <tr className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] transition-colors">
                        <td className="font-medium">
                          {p.isBeerBase ? '🍺 ' : p.isBot ? '🤖 ' : ''}{p.username}
                        </td>
                        <td className="text-[color:var(--nn-text-secondary)] text-xs">
                          {p.isBeerBase
                            ? `BEER BASE${p.botTier ? ` · T${p.botTier}` : ''}`
                            : p.isBot
                              ? <>Bot{p.specialization ? ` · ${p.specialization}` : ''}{p.botTier != null && <TierChip tier={p.botTier} />}</>
                              : 'Player'}
                        </td>
                        <td className="nn-table__num text-[color:var(--nn-amber)]">{p.level}</td>
                        <td className="nn-table__num text-[color:var(--nn-violet)]">{p.rank}</td>
                        {/* FID-20260912-085: beer base loot cells toggle the drilldown */}
                        <td
                          className={`nn-table__num text-[color:var(--nn-cyan)] ${p.isBeerBase ? 'cursor-pointer underline decoration-dotted underline-offset-4' : ''}`}
                          onClick={p.isBeerBase ? () => toggleLoot(p.username) : undefined}
                          title={p.isBeerBase ? 'Toggle loot breakdown' : undefined}
                        >
                          {p.metal.toLocaleString()}
                        </td>
                        <td
                          className={`nn-table__num text-[color:var(--nn-amber)] ${p.isBeerBase ? 'cursor-pointer underline decoration-dotted underline-offset-4' : ''}`}
                          onClick={p.isBeerBase ? () => toggleLoot(p.username) : undefined}
                          title={p.isBeerBase ? 'Toggle loot breakdown' : undefined}
                        >
                          {p.energy.toLocaleString()}
                        </td>
                        <td className="nn-table__num text-[color:var(--nn-green)]">{p.baseLocation}</td>
                        <td>
                          <button
                            onClick={() => setSelectedPlayer(p.username)}
                            className="nn-abtn nn-abtn--violet"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                      {p.isBeerBase && lootOpen.has(p.username) && (
                        <tr key={`${p.username}-loot`}>
                          <td colSpan={8} className="bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] border-l-2 border-[color:var(--nn-amber)]">
                            <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-2 text-xs">
                              <span className="nn-lab" style={{ marginBottom: 0 }}>🍺 Loot breakdown</span>
                              <span>Metal <b className="text-[color:var(--nn-cyan)]">{p.metal.toLocaleString()}</b></span>
                              <span>Energy <b className="text-[color:var(--nn-amber)]">{p.energy.toLocaleString()}</b></span>
                              <span>Combined <b className="text-[color:var(--nn-green)]">{(p.metal + p.energy).toLocaleString()}</b></span>
                              <span>STR <b className="text-[color:var(--nn-magenta)]">{formatNumberAbbreviated(p.totalStrength ?? 0)}</b></span>
                              <span>DEF <b className="text-[color:var(--nn-violet)]">{formatNumberAbbreviated(p.totalDefense ?? 0)}</b></span>
                              <span>Army <b>{(p.armySize ?? 0).toLocaleString()}</b></span>
                              <span>Tier <b>{p.botTier ? `T${p.botTier}` : '—'}</b></span>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>

                {filteredPlayers.length === 0 && (
                  <div className="text-center py-10">
                    <Users className="w-10 h-10 mx-auto mb-2 nn-text-dim" />
                    <p className="nn-text-dim">No players found</p>
                    <p className="text-sm nn-text-dim mt-1">Try a different search or filter.</p>
                  </div>
                )}
              </div>
            </div>

            {/* VIP Management */}
            <div className="nn-panel nn-panel--x-pad nn-panel--amber" id="admin-vip-management">
              <div className="nn-panel__header nn-panel__header--bleed">
                <span className="nn-panel__title">VIP Management</span>
                <span className="nn-panel__meta">GRANT ▸ 7D / 30D / 1YR</span>
                <span className="nn-panel__meta">TIER ▸ STATUS CONTROL</span>
              </div>
              <div className="flex justify-end items-center mb-4">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={vipSearchTerm}
                    onChange={(e) => setVipSearchTerm(e.target.value)}
                    className="nn-input w-64"
                  />
                  <button
                    onClick={loadVipUsers}
                    disabled={vipLoading}
                    className="nn-abtn nn-abtn--amber px-6 py-2.5"
                  >
                    {vipLoading ? 'LOADING' : 'REFRESH'}
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="nn-tile border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
                  <p className="text-sm text-[color:var(--nn-text-secondary)]">Total Users</p>
                  <p className="nn-num text-lg font-bold text-[color:var(--nn-cyan)]">{vipUsers.length}</p>
                </div>
                <div className="nn-tile border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]">
                  <p className="text-sm text-[color:var(--nn-text-secondary)]">VIP Users</p>
                  <p className="nn-num text-lg font-bold text-[color:var(--nn-amber)]">{vipCount}</p>
                </div>
                <div className="nn-tile border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]">
                  <p className="text-sm text-[color:var(--nn-text-secondary)]">Basic Users</p>
                  <p className="nn-num text-lg font-bold text-[color:var(--nn-violet)]">{basicCount}</p>
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setVipFilter('all')}
                  className={`nn-tabchip ${vipFilter === 'all' ? 'nn-tabchip--on' : ''}`}
                >
                  All Users
                </button>
                <button
                  onClick={() => setVipFilter('vip')}
                  className={`nn-tabchip ${vipFilter === 'vip' ? 'nn-tabchip--on' : ''}`}
                >
                  VIP Only
                </button>
                <button
                  onClick={() => setVipFilter('basic')}
                  className={`nn-tabchip ${vipFilter === 'basic' ? 'nn-tabchip--on' : ''}`}
                >
                  Basic Only
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-[color:var(--nn-void)] rounded-none overflow-hidden">
                <table className="nn-table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Expires</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVipUsers.map((user) => (
                      <tr key={user.username} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]">
                        <td className="font-medium">{user.username}</td>
                        <td className="nn-table__num text-[color:var(--nn-text-secondary)] text-sm">{user.email || 'N/A'}</td>
                        <td>
                          {user.vip ? (
                            <span className="nn-chip nn-chip--amber">
                              VIP
                            </span>
                          ) : (
                            <span className="nn-chip">
                              BASIC
                            </span>
                          )}
                        </td>
                        <td className="nn-table__num text-[color:var(--nn-text-secondary)] text-sm">
                          {user.vip && user.vipExpiration 
                            ? new Date(user.vipExpiration).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '—'}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {!user.vip ? (
                              <>
                                <button
                                  onClick={() => handleGrantVip(user.username, 7)}
                                  className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] text-xs rounded-none transition-colors"
                                  title="Grant 7 days"
                                >
                                  7d
                                </button>
                                <button
                                  onClick={() => handleGrantVip(user.username, 30)}
                                  className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] text-xs rounded-none transition-colors"
                                  title="Grant 30 days"
                                >
                                  30d
                                </button>
                                <button
                                  onClick={() => handleGrantVip(user.username, 365)}
                                  className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] text-xs rounded-none transition-colors"
                                  title="Grant 1 year"
                                >
                                  1yr
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleRevokeVip(user.username)}
                                className="nn-abtn nn-abtn--magenta"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredVipUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center">
                          <Crown className="w-10 h-10 mx-auto mb-2 nn-text-dim" />
                          <p className="nn-text-dim">No users found</p>
                          <p className="text-sm nn-text-dim mt-1">VIP grants will appear here.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analytics Dashboard */}
            <div className="nn-panel nn-panel--x-pad">
              <div className="nn-panel__header nn-panel__header--bleed">
                <span className="nn-panel__title">Analytics Dashboard</span>
                <span className="nn-panel__meta">TELEMETRY ▸ LIVE</span>
              </div>
              <div className="flex justify-end items-center mb-4">
                
                {/* Period Selector */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setAnalyticsPeriod('24h')}
                    className={`nn-tabchip ${analyticsPeriod === '24h' ? 'nn-tabchip--on' : ''}`}
                  >
                    24 Hours
                  </button>
                  <button
                    onClick={() => setAnalyticsPeriod('7d')}
                    className={`nn-tabchip ${analyticsPeriod === '7d' ? 'nn-tabchip--on' : ''}`}
                  >
                    7 Days
                  </button>
                  <button
                    onClick={() => setAnalyticsPeriod('30d')}
                    className={`nn-tabchip ${analyticsPeriod === '30d' ? 'nn-tabchip--on' : ''}`}
                  >
                    30 Days
                  </button>
                  <button
                    onClick={loadAnalyticsData}
                    disabled={analyticsLoading}
                    className="nn-abtn nn-abtn--cyan px-6 py-2.5 disabled:opacity-40"
                  >
                    {analyticsLoading ? 'LOADING' : 'REFRESH'}
                  </button>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Activity Timeline */}
                <div>
                  <h3 className="nn-panel__title mb-2">Player Activity Trends</h3>
                  <ActivityTimeline 
                    data={activityData}
                    period={analyticsPeriod}
                    loading={analyticsLoading}
                    error={analyticsError}
                  />
                </div>

                {/* Resource Gains */}
                <div>
                  <h3 className="nn-panel__title mb-2">Resource Accumulation</h3>
                  <ResourceGains 
                    data={resourceData}
                    period={analyticsPeriod}
                    loading={analyticsLoading}
                    error={analyticsError}
                  />
                </div>

                {/* Session Distribution */}
                <div>
                  <h3 className="nn-panel__title mb-2">Session Duration Distribution</h3>
                  <SessionDistribution 
                    buckets={sessionData?.buckets || []}
                    period={analyticsPeriod}
                    loading={analyticsLoading}
                    error={analyticsError}
                  />
                </div>

                {/* Flag Breakdown */}
                <div>
                  <h3 className="nn-panel__title mb-2">Anti-Cheat Flag Severity</h3>
                  <FlagBreakdown 
                    data={flagData}
                    totalFlagged={flagData.reduce((sum, f) => sum + f.count, 0)}
                    loading={analyticsLoading}
                    error={analyticsError}
                  />
                </div>

                {/* Bot Population */}
                <div className="col-span-2">
                  <h3 className="nn-panel__title mb-2">Bot Population by Specialization</h3>
                  <BotPopulationTrends 
                    currentStats={botStats ?? { total: 0, bySpecialization: { Hoarder: 0, Fortress: 0, Raider: 0, Balanced: 0, Ghost: 0 } }}
                    loading={!botStats}
                    error={null}
                  />
                </div>
              </div>
            </div>

            {/* Database Tools */}
            <div className="nn-panel nn-panel--x-pad nn-panel--violet">
              <div className="nn-panel__header nn-panel__header--bleed">
                <span className="nn-panel__title">Database Tools</span>
                <span className="nn-panel__meta">OPS ▸ DIRECT ACCESS</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={async () => {
                    if (!(await confirmDialog('Fix all player base tiles? This will convert base coordinates to Wasteland.'))) return;
                    try {
                      const res = await fetch('/api/admin/fix-base', { method: 'POST' });
                      const data = await res.json();
                      showInfo(data.message || 'Base tiles fixed!');
                      window.location.reload();
                    } catch {
                      showError('Failed to fix base tiles');
                    }
                  }}
                  className="nn-abtn nn-abtn--amber"
                >
                  Fix Base Tiles
                </button>
                <button 
                  onClick={() => setShowTileInspector(true)}
                  className="nn-abtn nn-abtn--cyan"
                >
                  View Tiles
                </button>
                <button className="nn-abtn nn-abtn--green"
                  onClick={() => setShowFactoryInspector(true)}> Factory Inspector
                </button>
                <button className="nn-abtn nn-abtn--amber"
                  onClick={() => setShowBattleLogs(true)}> Battle Logs
                </button>
                <button className="nn-abtn nn-abtn--violet"
                  onClick={() => setShowAchievementStats(true)}
                >
                  Achievement Stats
                </button>
                <button className="nn-abtn nn-abtn--green"
                  onClick={() => setShowJobsStatus(true)}
                >
                  Scheduler Health
                </button>
                {/* FID-20260912-074: factory economy settings */}
                <button className="nn-abtn nn-abtn--amber"
                  onClick={() => setShowFactorySettings(true)}
                >
                  Factory Settings
                </button>
                <button className="nn-abtn nn-abtn--magenta"
                  onClick={() => setShowSystemReset(true)}
                >
                  Reset Systems
                </button>
              </div>
            </div>

            {/* Bot System Controls */}
            <div className="nn-panel nn-panel--x-pad">
              <div className="nn-panel__header nn-panel__header--bleed">
                <span className="nn-panel__title">Bot Ecosystem Controls</span>
                <span className="nn-panel__meta">POPULATION ▸ MANAGED</span>
              </div>
              
              <div className="space-y-6">
                {/* Bot Statistics */}
                <div className="nn-tile">
                  <h3 className="nn-panel__title mb-3">Bot Population</h3>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="nn-stat text-center">
                      <p className="nn-stat__lab">Total Bots</p>
                      <p className="nn-stat__num nn-stat__num--glow-cyan">{botStats?.total || 0}</p>
                    </div>
                    <div className="nn-stat text-center">
                      <p className="nn-stat__lab">Hoarders</p>
                      <p className="nn-stat__num nn-stat__num--glow-amber">{botStats?.bySpecialization?.Hoarder || 0}</p>
                    </div>
                    <div className="nn-stat text-center">
                      <p className="nn-stat__lab">Fortresses</p>
                      <p className="nn-stat__num nn-stat__num--glow-cyan">{botStats?.bySpecialization?.Fortress || 0}</p>
                    </div>
                    <div className="nn-stat text-center">
                      <p className="nn-stat__lab">Raiders</p>
                      <p className="nn-stat__num nn-stat__num--glow-magenta">{botStats?.bySpecialization?.Raider || 0}</p>
                    </div>
                    <div className="nn-stat text-center">
                      <p className="nn-stat__lab">Ghosts</p>
                      <p className="nn-stat__num nn-stat__num--glow-violet">{botStats?.bySpecialization?.Ghost || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="nn-tile">
                  <h3 className="nn-panel__title mb-3">Quick Actions</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={handleSpawn10Bots}
                      disabled={botActionLoading}
                      className="nn-abtn nn-abtn--green disabled:cursor-not-allowed"
                    >
                      Spawn 10 Bots
                    </button>
                    <button 
                      onClick={handleRunRegen}
                      disabled={botActionLoading}
                      className="nn-abtn nn-abtn--cyan disabled:cursor-not-allowed"
                    >
                      Run Regen Cycle
                    </button>
                    <button 
                      onClick={handleBotAnalytics}
                      disabled={botActionLoading}
                      className="nn-abtn nn-abtn--violet disabled:cursor-not-allowed"
                    >
                      Bot Analytics
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-3 mt-3">
                    <button 
                      onClick={() => setShowWebSocketConsole(true)}
                      className="nn-abtn nn-abtn--violet"
                    >
                      WebSocket Console
                    </button>
                    <button 
                      onClick={() => setShowTileInspector(true)}
                      className="nn-abtn nn-abtn--ghost"
                    >
                      Tile Inspector
                    </button>
                    <button 
                      onClick={() => setShowFactoryInspector(true)}
                      className="nn-abtn nn-abtn--ghost"
                    >
                      Factory Inspector
                    </button>
                    <button 
                      onClick={() => setShowHotkeyManager(true)}
                      className="nn-abtn nn-abtn--cyan"
                    >
                      Hotkey Manager
                    </button>
                    <button 
                      onClick={() => setShowSystemReset(true)}
                      className="nn-abtn nn-abtn--magenta"
                    >
                      System Reset
                    </button>
                  </div>
                </div>

                {/* System Configuration */}
                <div className="nn-tile">
                  <h3 className="nn-panel__title mb-3">System Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="nn-lab">Total Bot Cap</label>
                      <input 
                        type="number" 
                        value={botConfig.totalBotCap}
                        onChange={(e) => setBotConfig({...botConfig, totalBotCap: parseInt(e.target.value) || 0})}
                        className="nn-input w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab">Daily Spawn Count</label>
                      <input 
                        type="number" 
                        value={botConfig.dailySpawnCount}
                        onChange={(e) => setBotConfig({...botConfig, dailySpawnCount: parseInt(e.target.value) || 0})}
                        className="nn-input w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab">Migration % (0-100)</label>
                      <input 
                        type="number" 
                        step="1"
                        value={Math.round(botConfig.migrationPercent * 100)}
                        onChange={(e) => setBotConfig({...botConfig, migrationPercent: (parseInt(e.target.value) || 0) / 100})}
                        className="nn-input w-full"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveConfig}
                    disabled={botActionLoading}
                    className="nn-abtn nn-abtn--cyan mt-4 w-full disabled:cursor-not-allowed"
                  >
                    Save Configuration
                  </button>
                </div>

                {/* Resource Regeneration Rates */}
                <div className="nn-tile">
                  <h3 className="nn-panel__title mb-3">Regeneration Rates (% per hour)</h3>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs text-[color:var(--nn-amber)]">Hoarder</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.hoarder}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, hoarder: parseFloat(e.target.value) || 0}
                        })}
                        className="nn-input w-full px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[color:var(--nn-cyan)]">Fortress</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.fortress}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, fortress: parseFloat(e.target.value) || 0}
                        })}
                        className="nn-input w-full px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[color:var(--nn-magenta)]">Raider</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.raider}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, raider: parseFloat(e.target.value) || 0}
                        })}
                        className="nn-input w-full px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[color:var(--nn-violet)]">Ghost</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.ghost}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, ghost: parseFloat(e.target.value) || 0}
                        })}
                        className="nn-input w-full px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[color:var(--nn-green)]">Balanced</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.balanced}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, balanced: parseFloat(e.target.value) || 0}
                        })}
                        className="nn-input w-full px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Beer Base Smart Spawning */}
              <div className="nn-panel nn-panel--amber nn-panel--x-pad">
                  <div className="nn-panel__header nn-panel__header--bleed">
                <span className="nn-panel__title">Beer Base Smart Spawning</span>
                <span className="nn-panel__meta">AUTO ▸ {botStats?.specialBases || 0} ACTIVE</span>
              </div>
                  
                  <div className="nn-brief nn-brief--amber mb-4">
                    <p>
                      <strong>Smart System Active</strong> — Beer Bases automatically spawn based on player levels. 
                      System analyzes active players and spawns appropriate difficulty targets.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="nn-lab flex items-center gap-2">
                        Enable System · Master Switch
                      </label>
                      <select 
                        value={beerBaseConfig.enabled ? 'true' : 'false'}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, enabled: e.target.value === 'true'})}
                        className="nn-input w-full"
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab flex items-center gap-2">
                        Spawn Rate Min % · % of Bots
                      </label>
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={beerBaseConfig.spawnRateMin}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, spawnRateMin: parseInt(e.target.value) || 0})}
                        className="nn-input w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab flex items-center gap-2">
                        Spawn Rate Max % · % of Bots
                      </label>
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={beerBaseConfig.spawnRateMax}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, spawnRateMax: parseInt(e.target.value) || 0})}
                        className="nn-input w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab flex items-center gap-2">
                        Resource Multiplier · 1–20x
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={beerBaseConfig.resourceMultiplier}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, resourceMultiplier: parseInt(e.target.value) || 1})}
                        className="nn-input w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab">Weekly Respawn Day</label>
                      <select 
                        value={beerBaseConfig.respawnDay}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, respawnDay: parseInt(e.target.value)})}
                        className="nn-input w-full"
                      >
                        <option value="0">Sunday</option>
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab">Respawn Hour · 0–23h</label>
                      <input 
                        type="number"
                        min="0"
                        max="23"
                        value={beerBaseConfig.respawnHour}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, respawnHour: parseInt(e.target.value) || 0})}
                        className="nn-input w-full"
                      />
                    </div>
                  </div>

                  {/* Variety Enforcement Settings (FID-20251025-001) */}
                  <div className="nn-brief nn-brief--amber mt-4">
                    <div className="nn-brief__head">
                      <h4 className="nn-brief__title">
                        Variety Enforcement · Anti-Homogeneity
                      </h4>
                      <select 
                        value={beerBaseConfig.varietyEnabled ? 'true' : 'false'}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, varietyEnabled: e.target.value === 'true'})}
                        className="nn-input px-2 py-1 text-xs"
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>
                    
                    {beerBaseConfig.varietyEnabled && (
                      <>
                        <p className="text-xs text-[color:var(--nn-text-secondary)] mb-3">
                          Ensures minimum variety across all power tiers even when player base is homogeneous. 
                          Example: If all players are Level 15, variety prevents 100% Mid-tier spawns.
                        </p>
                        
                        <div className="grid grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <label className="nn-lab">Min WEAK %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.minWeakPercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, minWeakPercent: parseInt(e.target.value) || 0})}
                              className="nn-input w-full px-2.5 py-1.5 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="nn-lab">Min MEDIUM %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.minMediumPercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, minMediumPercent: parseInt(e.target.value) || 0})}
                              className="nn-input w-full px-2.5 py-1.5 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="nn-lab">Min STRONG %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.minStrongPercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, minStrongPercent: parseInt(e.target.value) || 0})}
                              className="nn-input w-full px-2.5 py-1.5 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="nn-lab">Min ELITE %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.minElitePercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, minElitePercent: parseInt(e.target.value) || 0})}
                              className="nn-input w-full px-2.5 py-1.5 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="nn-lab">Max Same Tier %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.maxSameTierPercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, maxSameTierPercent: parseInt(e.target.value) || 0})}
                              className="nn-input w-full px-2.5 py-1.5 text-xs"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--nn-text-tertiary)' }}>
                          Min guaranteed variety ▸ <span className="nn-num" style={{ color: 'var(--nn-amber)' }}>{beerBaseConfig.minWeakPercent + beerBaseConfig.minMediumPercent + beerBaseConfig.minStrongPercent + beerBaseConfig.minElitePercent}%</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Dynamic Schedules (FID-20251025-003) */}
                  <div className="nn-brief nn-brief--cyan mt-4">
                    <div className="nn-brief__head">
                      <h4 className="nn-brief__title">
                        Dynamic Respawn Schedules · Multi-Slot
                      </h4>
                      <select 
                        value={beerBaseConfig.schedulesEnabled ? 'true' : 'false'}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, schedulesEnabled: e.target.value === 'true'})}
                        className="nn-input px-2 py-1 text-xs"
                      >
                        <option value="false">Legacy Single Schedule</option>
                        <option value="true">Dynamic Schedules</option>
                      </select>
                    </div>
                    
                    {beerBaseConfig.schedulesEnabled ? (
                      <>
                        <p className="text-xs text-[color:var(--nn-text-secondary)] mb-3">
                          Configure multiple respawn times per week with timezone support. Schedules can overlap (combine percentages).
                        </p>
                        
                        {/* Schedule List */}
                        {schedulesLoading ? (
                          <div className="text-center py-4 text-[color:var(--nn-text-secondary)]">Loading schedules...</div>
                        ) : schedules.length === 0 ? (
                          <div className="rounded-none p-4 text-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)]">
                            <CalendarClock className="w-8 h-8 mx-auto mb-2 nn-text-dim" />
                            <p className="nn-text-dim text-sm">No schedules configured</p>
                            <p className="nn-text-dim text-xs mt-1">Click &quot;Add Schedule&quot; to create one.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {schedules.map((schedule) => {
                              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                              const hourStr = schedule.hour.toString().padStart(2, '0') + ':00';
                              const tzShort = schedule.timezone.split('/').pop();
                              
                              return (
                                <div 
                                  key={schedule.id}
                                  className={`bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-2 flex items-center justify-between ${!schedule.enabled ? 'opacity-50' : ''}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => handleToggleSchedule(schedule)}
                                      className={`nn-switch ${schedule.enabled ? 'nn-switch--on' : ''}`}
                                    >
                                      <div className="nn-switch__knob" />
                                    </button>
                                    <div className="flex-1">
                                      <div className="text-sm text-[color:var(--nn-text-primary)] font-medium">
                                        {schedule.name || `Schedule ${days[schedule.dayOfWeek]} ${hourStr}`}
                                      </div>
                                      <div className="text-xs text-[color:var(--nn-text-secondary)]">
                                        {days[schedule.dayOfWeek]} at {hourStr} {tzShort} • {schedule.spawnPercentage}% spawn
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditSchedule(schedule)}
                                      className="nn-abtn nn-abtn--cyan"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSchedule(schedule.id)}
                                      className="nn-abtn nn-abtn--magenta"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        <button
                          onClick={() => {
                            setEditingSchedule(null);
                            setScheduleForm({
                              enabled: true,
                              dayOfWeek: 0,
                              hour: 4,
                              spawnPercentage: 100,
                              timezone: 'America/New_York',
                              name: ''
                            });
                            setShowScheduleModal(true);
                          }}
                          className="nn-abtn nn-abtn--cyan mt-3 w-full"
                        >
                          Add Schedule
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-[color:var(--nn-text-secondary)]">
                        Using legacy single schedule: {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][beerBaseConfig.respawnDay]} at {beerBaseConfig.respawnHour.toString().padStart(2, '0')}:00
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button 
                      onClick={handleSaveBeerBaseConfig}
                      disabled={beerBaseLoading}
                      className="nn-abtn nn-abtn--amber disabled:cursor-not-allowed"
                    >
                      Save Beer Base Config
                    </button>
                    <button 
                      onClick={handleRespawnBeerBases}
                      disabled={beerBaseLoading}
                      className="nn-abtn nn-abtn--cyan disabled:cursor-not-allowed"
                    >
                      Manual Respawn Now
                    </button>
                  </div>

                  <div className="nn-brief nn-brief--cyan mt-4">
                    <strong>How It Works</strong> — System checks active players (last 7 days), analyzes their levels, 
                    and spawns Beer Bases with appropriate power tiers. Distribution: 40% same tier, 30% one up, 10% one down, 20% two up.
                  </div>

                  {/* Live roster (FID-20260912-081): the actual bases on the map */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => {
                          const next = !beerBaseRosterOpen;
                          setBeerBaseRosterOpen(next);
                          if (next && beerBaseRoster.length === 0) void loadBeerBaseRoster();
                        }}
                        className="nn-abtn nn-abtn--ghost text-xs"
                      >
                        {beerBaseRosterOpen ? '▾' : '▸'} Live Roster ({beerBaseRoster.length})
                      </button>
                      {beerBaseRosterOpen && (
                        <button
                          onClick={() => void loadBeerBaseRoster()}
                          disabled={beerBaseRosterLoading}
                          className="nn-abtn nn-abtn--ghost text-xs disabled:cursor-not-allowed"
                        >
                          {beerBaseRosterLoading ? 'Loading…' : '↻ Refresh'}
                        </button>
                      )}
                    </div>
                    {beerBaseRosterOpen && (
                      beerBaseRoster.length === 0 ? (
                        <div className="nn-brief nn-brief--amber">
                          <p>No Beer Bases currently on the map. Use &quot;Manual Respawn Now&quot; to populate.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[color:var(--nn-text-secondary)]">
                                <th className="py-1.5 pr-3 font-medium">Base</th>
                                <th className="py-1.5 pr-3 font-medium">Tier</th>
                                <th className="py-1.5 pr-3 font-medium">Lvl</th>
                                <th className="py-1.5 pr-3 font-medium">Position</th>
                                <th className="py-1.5 pr-3 font-medium">STR</th>
                                <th className="py-1.5 pr-3 font-medium">DEF</th>
                                <th className="py-1.5 pr-3 font-medium">Army</th>
                                <th className="py-1.5 pr-3 font-medium">Loot (M/E)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {beerBaseRoster.map((base) => (
                                <tr key={base.username} className="border-t border-[color:var(--nn-border)]">
                                  <td className="py-1.5 pr-3 font-medium">🍺 {base.username}</td>
                                  <td className="py-1.5 pr-3">{base.tier}</td>
                                  <td className="py-1.5 pr-3">{base.level}</td>
                                  <td className="py-1.5 pr-3">({base.position.x}, {base.position.y})</td>
                                  <td className="py-1.5 pr-3">{formatNumberAbbreviated(base.totalStrength)}</td>
                                  <td className="py-1.5 pr-3">{formatNumberAbbreviated(base.totalDefense)}</td>
                                  <td className="py-1.5 pr-3">{base.armySize}</td>
                                  <td className="py-1.5 pr-3">{formatNumberAbbreviated(base.resources.metal)} / {formatNumberAbbreviated(base.resources.energy)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Beer Base Analytics Dashboard (FID-20251025-004) */}
                <div className="mt-4 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_18%,transparent)] rounded-none">
                  <button
                    onClick={() => {
                      setBeerAnalyticsExpanded(!beerAnalyticsExpanded);
                      if (!beerAnalyticsExpanded && !beerSpawnStats) {
                        loadBeerBaseAnalytics();
                      }
                    }}
                    className="w-full p-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--nn-cyan)_8%,transparent)] flex items-center justify-between rounded-none"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="nn-panel__title">
                        Beer Base Analytics Dashboard
                      </h4>
                      <span className="nn-lab">365-Day Retention</span>
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--nn-cyan)' }}>{beerAnalyticsExpanded ? '▼' : '▶'}</span>
                  </button>
                  
                  {beerAnalyticsExpanded && (
                    <div className="p-4 pt-0 space-y-4">
                      {/* Period Selector & Actions */}
                      <div className="flex items-center justify-between bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-3">
                        <div className="flex gap-2">
                          {(['7d', '14d', '30d', '90d', '365d'] as const).map((period) => (
                            <button
                              key={period}
                              onClick={() => setBeerAnalyticsPeriod(period)}
                              className={`nn-tabchip ${
                                beerAnalyticsPeriod === period ? 'nn-tabchip--on' : ''
                              }`}
                            >
                              {period.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={loadBeerBaseAnalytics}
                            disabled={beerAnalyticsLoading}
                            className="nn-abtn nn-abtn--ghost text-xs"
                          >
                            {beerAnalyticsLoading ? 'LOADING' : 'REFRESH'}
                          </button>
                          <button
                            onClick={async () => {
                              const startDate = new Date();
                              startDate.setDate(startDate.getDate() - parseInt(beerAnalyticsPeriod));
                              const endDate = new Date();
                              
                              const startStr = startDate.toISOString();
                              const endStr = endDate.toISOString();
                              
                              window.open(
                                `/api/admin/beer-bases/analytics/export?format=csv&startDate=${startStr}&endDate=${endStr}`,
                                '_blank'
                              );
                            }}
                            className="nn-abtn nn-abtn--green"
                          >
                            Export CSV
                          </button>
                        </div>
                      </div>

                      {beerAnalyticsLoading && !beerSpawnStats ? (
                        <div className="text-center py-8 text-[color:var(--nn-text-secondary)]">Loading analytics...</div>
                      ) : beerAnalyticsError ? (
                        <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4 text-[color:var(--nn-magenta)]">
                          Error: {beerAnalyticsError}
                        </div>
                      ) : (
                        <>
                          {/* Quick Stats Cards */}
                          <div className="grid grid-cols-4 gap-3">
                            <div className="nn-stat">
                              <div className="nn-stat__lab">Total Spawns</div>
                              <div className="nn-stat__num nn-stat__num--glow-cyan">
                                {beerSpawnStats?.dailySpawns?.reduce((sum, d) => sum + d.count, 0) || 0}
                              </div>
                              <div className="nn-stat__sub">
                                Avg {beerSpawnStats?.averagePerDay?.toFixed(1) || '0'}/day
                              </div>
                            </div>
                            <div className="nn-stat">
                              <div className="nn-stat__lab">Total Defeats</div>
                              <div className="nn-stat__num nn-stat__num--glow-magenta">
                                {beerDefeatStats?.dailyDefeats?.reduce((sum, d) => sum + d.count, 0) || 0}
                              </div>
                              <div className="nn-stat__sub">
                                Avg {beerDefeatStats?.averagePerDay?.toFixed(1) || '0'}/day
                              </div>
                            </div>
                            <div className="nn-stat">
                              <div className="nn-stat__lab">Defeat Rate</div>
                              <div className="nn-stat__num nn-stat__num--glow-amber">
                                {beerEffectivenessStats?.defeatRate 
                                  ? `${(beerEffectivenessStats.defeatRate * 100).toFixed(1)}%`
                                  : '0%'}
                              </div>
                              <div className="nn-stat__sub">
                                Engagement Score: {beerEffectivenessStats?.engagementScore?.toFixed(2) || '0'}
                              </div>
                            </div>
                            <div className="nn-stat">
                              <div className="nn-stat__lab">Avg Lifespan</div>
                              <div className="nn-stat__num nn-stat__num--glow-violet">
                                {beerEffectivenessStats?.avgLifespanByTier?.[0]?.avgLifespanHours
                                  ? `${(beerEffectivenessStats.avgLifespanByTier.reduce((sum, t) => sum + (t.avgLifespanHours || 0), 0) / beerEffectivenessStats.avgLifespanByTier.length).toFixed(1)}h`
                                  : '0h'}
                              </div>
                              <div className="text-xs text-[color:var(--nn-text-secondary)]">All tiers combined</div>
                            </div>
                          </div>

                          {/* Tier Distribution */}
                          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
                            <h5 className="nn-panel__title mb-3">Spawn Distribution by Tier</h5>
                            <div className="space-y-2">
                              {beerSpawnStats?.tierDistribution?.map((tier) => {
                                const percentage = (tier.count / (beerSpawnStats?.dailySpawns?.reduce((sum, d) => sum + d.count, 0) || 1)) * 100;
                                const tierNames = ['WEAK', 'MEDIUM', 'STRONG', 'ELITE', 'ULTRA', 'LEGENDARY'];
                                const tierColors = ['bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]', 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]', 'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]', 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]', 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]', 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]'];
                                
                                return (
                                  <div key={tier.tier} className="flex items-center gap-3">
                                    <div className="nn-lab w-24">{tierNames[tier.tier]}</div>
                                    <div className="nn-meter flex-1">
                                      <div 
                                        className={`${tierColors[tier.tier]} h-full flex items-center justify-center text-xs font-bold text-[color:var(--nn-text-primary)] transition-all`}
                                        style={{ width: `${percentage}%` }}
                                      >
                                        {percentage >= 10 && `${percentage.toFixed(1)}%`}
                                      </div>
                                    </div>
                                    <div className="nn-num w-16 text-right text-sm text-[color:var(--nn-text-primary)]">{tier.count}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Defeat Stats by Tier */}
                          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
                            <h5 className="nn-panel__title mb-3">Defeats by Tier</h5>
                            <div className="space-y-2">
                              {beerDefeatStats?.defeatsByTier?.map((tier) => {
                                const tierNames = ['WEAK', 'MEDIUM', 'STRONG', 'ELITE', 'ULTRA', 'LEGENDARY'];
                                const tierColors = ['text-[color:var(--nn-green)]', 'text-[color:var(--nn-cyan)]', 'text-[color:var(--nn-violet)]', 'text-[color:var(--nn-amber)]', 'text-[color:var(--nn-magenta)]', 'text-[color:var(--nn-magenta)]'];
                                
                                return (
                                  <div key={tier.tier} className="flex items-center justify-between bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none px-3 py-2">
                                    <span className={`text-sm font-semibold ${tierColors[tier.tier]}`}>
                                      {tierNames[tier.tier]}
                                    </span>
                                    <span className="text-sm text-[color:var(--nn-text-primary)] font-bold">{tier.count} defeats</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Top Players */}
                          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
                            <h5 className="nn-panel__title mb-3">Top Beer Base Hunters</h5>
                            <div className="space-y-2">
                              {beerDefeatStats?.topPlayers?.slice(0, 10).map((player, index) => (
                                <div key={player.username} className="flex items-center justify-between bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    <span className="nn-num w-8 text-center text-xs" style={{ color: index === 0 ? 'var(--nn-amber)' : index === 1 ? 'var(--nn-cyan)' : index === 2 ? 'var(--nn-violet)' : 'var(--nn-text-tertiary)' }}>
                                      {`#${index + 1}`}
                                    </span>
                                    <span className="text-sm font-semibold text-[color:var(--nn-text-primary)]">{player.username}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs">
                                    <span className="text-[color:var(--nn-magenta)]">
                                      {player.totalDefeats} defeats
                                    </span>
                                    <span className="text-[color:var(--nn-cyan)]">
                                      {player.totalRewards.metal.toLocaleString()} ME
                                    </span>
                                    <span className="text-[color:var(--nn-amber)]">
                                      {player.totalRewards.energy.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Effectiveness Metrics */}
                          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
                            <h5 className="nn-panel__title mb-3">Effectiveness Metrics</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="nn-lab mb-2">Average Lifespan by Tier</div>
                                <div className="space-y-1">
                                  {beerEffectivenessStats?.avgLifespanByTier?.map((tier) => {
                                    const tierNames = ['WEAK', 'MEDIUM', 'STRONG', 'ELITE', 'ULTRA', 'LEGENDARY'];
                                    return (
                                      <div key={tier.tier} className="flex justify-between text-xs">
                                        <span className="nn-lab">{tierNames[tier.tier]}</span>
                                        <span className="text-[color:var(--nn-text-primary)] font-semibold">
                                          {tier.avgLifespanHours?.toFixed(1) || '0'}h
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <div className="nn-lab mb-2">Peak Activity Hours (UTC)</div>
                                <div className="space-y-1">
                                  {beerEffectivenessStats?.peakHours?.slice(0, 3).map((peak, index) => (
                                    <div key={peak.hour} className="flex justify-between text-xs">
                                      <span className="text-[color:var(--nn-text-secondary)]">
                                        #{index + 1} · {peak.hour.toString().padStart(2, '0')}:00
                                      </span>
                                      <span className="text-[color:var(--nn-text-primary)] font-semibold">{peak.count} defeats</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Spawn Sources */}
                          {beerSpawnStats?.spawnSources && (
                            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
                              <h5 className="nn-panel__title mb-3">Spawn Sources</h5>
                              <div className="flex gap-4">
                                {beerSpawnStats.spawnSources.map((source) => (
                                  <div key={source.source} className="nn-stat flex-1 text-center">
                                    <div className="nn-stat__lab">
                                      {source.source === 'auto' ? 'Automatic' : 'Manual'}
                                    </div>
                                    <div className="nn-stat__num nn-stat__num--glow-green">{source.count}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Predictive Spawning Configuration (FID-20251025-002) */}
                <div className="mt-4 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_18%,transparent)] rounded-none">
                  <button
                    onClick={() => {
                      const expanded = !beerBaseConfig.predictiveExpanded;
                      setBeerBaseConfig({ ...beerBaseConfig, predictiveExpanded: expanded });
                    }}
                    className="w-full p-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--nn-green)_8%,transparent)] flex items-center justify-between rounded-none"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="nn-panel__title">
                        Predictive Spawning
                      </h4>
                      <span className="nn-lab">Historical Forecasting</span>
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--nn-green)' }}>{beerBaseConfig.predictiveExpanded ? '▼' : '▶'}</span>
                  </button>
                  
                  {beerBaseConfig.predictiveExpanded && (
                    <div className="p-4 pt-0 space-y-4">
                      <p className="nn-brief nn-brief--green text-xs"><strong>AI-Powered Forecasting</strong> — Uses 365-day player history with linear regression to predict 
                        future player levels. Spawns appropriate tiers <em>ahead</em> of progression curve.
                      </p>
                      
                      {/* Mode Toggle */}
                      <div className="nn-brief nn-brief--green">
                        <div className="nn-brief__head">
                          <label className="nn-brief__title">Predictive Mode</label>
                          <select 
                            value={beerBaseConfig.usePredictiveSpawning ? 'true' : 'false'}
                            onChange={(e) => setBeerBaseConfig({
                              ...beerBaseConfig, 
                              usePredictiveSpawning: e.target.value === 'true'
                            })}
                            className="nn-input text-xs"
                          >
                            <option value="false">Current Player Levels</option>
                            <option value="true">Predictive (Forecast)</option>
                          </select>
                        </div>
                        
                        {beerBaseConfig.usePredictiveSpawning && (
                          <div className="space-y-2">
                            <label className="nn-lab">Prediction Horizon (weeks ahead)</label>
                            <input 
                              type="number"
                              min="1"
                              max="12"
                              value={beerBaseConfig.predictiveWeeksAhead || 2}
                              onChange={(e) => setBeerBaseConfig({
                                ...beerBaseConfig,
                                predictiveWeeksAhead: parseInt(e.target.value) || 2
                              })}
                              className="nn-input w-full text-xs"
                            />
                            <p className="text-xs text-[color:var(--nn-text-secondary)]">
                              Default: 2 weeks. Higher values = spawns more challenging ahead of current playerbase
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Current Mode Indicator */}
                      <div
                      className="nn-brief"
                      style={{
                        borderColor: 'color-mix(in oklab, var(--nn-rail) 20%, transparent)',
                        borderLeft: `${beerBaseConfig.usePredictiveSpawning ? 'var(--nn-green)' : 'var(--nn-cyan)'}}`,
                      }}
                    >
                        <div className="flex items-center gap-2">
                          <span className={`nn-chip ${beerBaseConfig.usePredictiveSpawning ? 'nn-chip--green' : 'nn-chip--cyan'}`}>{beerBaseConfig.usePredictiveSpawning ? 'PREDICTIVE' : 'DISTRIBUTED'}</span>
                          <div>
                            <div className="text-sm font-bold text-[color:var(--nn-text-primary)]">
                              {beerBaseConfig.usePredictiveSpawning ? 'PREDICTIVE MODE ACTIVE' : 'CURRENT MODE ACTIVE'}
                            </div>
                            <div className="text-xs text-[color:var(--nn-text-secondary)]">
                              {beerBaseConfig.usePredictiveSpawning 
                                ? `Spawning based on projected levels ${beerBaseConfig.predictiveWeeksAhead || 2} weeks ahead`
                                : 'Spawning based on current player levels (last 7 days activity)'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Distribution Comparison */}
                      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
                        <h5 className="nn-panel__title mb-3">Distribution Comparison</h5>
                        <p className="text-xs text-[color:var(--nn-text-secondary)] mb-3">
                          Compare current vs predicted tier distributions. Predictive mode helps maintain challenge as players progress.
                        </p>
                        
                        <div className="grid grid-cols-6 gap-2 text-xs">
                          <div className="nn-lab text-center">Tier</div>
                          <div className="nn-lab text-center">WEAK</div>
                          <div className="nn-lab text-center">MID</div>
                          <div className="nn-lab text-center">STRONG</div>
                          <div className="nn-lab text-center">ELITE</div>
                          <div className="nn-lab text-center">ULTRA</div>
                          
                          {/* Current Distribution Row */}
                          <div className="text-left text-[color:var(--nn-cyan)] font-semibold">Current</div>
                          {[0, 1, 2, 3, 4].map((tier) => (
                            <div key={`current-${tier}`} className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] rounded-none p-1 text-center text-[color:var(--nn-text-primary)]">
                              —%
                            </div>
                          ))}
                          
                          {/* Predicted Distribution Row */}
                          <div className="text-left text-[color:var(--nn-green)] font-semibold">Predicted</div>
                          {[0, 1, 2, 3, 4].map((tier) => (
                            <div key={`predicted-${tier}`} className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] rounded-none p-1 text-center text-[color:var(--nn-text-primary)]">
                              —%
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-3 text-xs text-[color:var(--nn-text-secondary)]">
                          <strong>Note:</strong> Real-time distribution data requires backend integration with 
                          /api/admin/beer-bases/predictive-comparison endpoint. Values shown when available.
                        </div>
                      </div>

                      {/* Manual Recalculation */}
                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            try {
                              setBeerBaseLoading(true);
                              const res = await fetch('/api/admin/beer-bases/recalculate-predictions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  weeksAhead: beerBaseConfig.predictiveWeeksAhead || 2
                                })
                              });
                              const data = await res.json();
                              if (data.success) {
                                showSuccess(`Predictions recalculated!\n\nProjected ${data.playerCount} players over ${data.weeksAhead} weeks.\nNew distribution: ${JSON.stringify(data.distribution, null, 2)}`);
                              } else {
                                showError(`Error: ${extractApiError(data, res.status)}`);
                              }
                            } catch (err) {
                              console.error('Recalculation error:', err);
                              showError('Failed to recalculate predictions');
                            } finally {
                              setBeerBaseLoading(false);
                            }
                          }}
                          disabled={beerBaseLoading}
                          className="nn-abtn nn-abtn--green flex-1 disabled:cursor-not-allowed"
                        >
                          {beerBaseLoading ? 'CALCULATING' : 'RECALCULATE PREDICTIONS'}
                        </button>
                        <button
                          onClick={() => {
                            showInfo('Predictive Spawning Details:\n\n' +
                              '1. ALGORITHM: Linear regression on 365 days of player snapshots\n' +
                              '2. PROJECTION: Forecasts player levels N weeks ahead\n' +
                              '3. TIER MAPPING: Projected levels → Power tier distribution\n' +
                              '4. VARIETY: Still enforces min/max tier percentages\n' +
                              '5. FALLBACK: Reverts to current distribution if prediction fails\n\n' +
                              'Use Case: Prevent "too easy" spawns as playerbase advances rapidly'
                            );
                          }}
                          className="nn-abtn nn-abtn--ghost text-xs"
                        >
                          How It Works
                        </button>
                      </div>

                      {/* Implementation Status */}
                      <div className="nn-brief nn-brief--amber">
                        <div className="flex items-start gap-2">
                          <span className="nn-lab" style={{ color: 'var(--nn-amber)' }}>Implementation Status</span>
                          <div className="text-xs text-[color:var(--nn-amber)]">
                            <strong>Backend Integration</strong> — complete. 
                            API endpoints /api/admin/beer-bases/predictive-comparison and 
                            /api/admin/beer-bases/recalculate-predictions may need implementation for full UI functionality.
                            Core spawning logic is already active in beerBaseService.ts.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tech System Costs */}
                <div className="nn-tile">
                  <h3 className="nn-panel__title mb-3">Tech System Costs & Cooldowns</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="nn-lab">Bot Magnet Cost (Metal)</label>
                      <input 
                        type="number" 
                        defaultValue={10000}
                        className="nn-input w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab">Magnet Cooldown (hours)</label>
                      <input 
                        type="number" 
                        defaultValue={336}
                        className="nn-input w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab">Summoning Cost (Metal)</label>
                      <input 
                        type="number" 
                        defaultValue={25000}
                        className="nn-input w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab">Summoning Cost (Energy)</label>
                      <input 
                        type="number" 
                        defaultValue={25000}
                        className="nn-input w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Phase-Out System */}
                <div className="nn-tile">
                  <h3 className="nn-panel__title mb-3">Phase-Out System</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="nn-lab">Enabled</label>
                      <select className="nn-input w-full">
                        <option value="false">Disabled</option>
                        <option value="true">Enabled</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab">1 Bot per X Players</label>
                      <input 
                        type="number" 
                        defaultValue={10}
                        className="nn-input w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="nn-lab">Priority</label>
                      <select className="nn-input w-full">
                        <option value="weakest">Weakest</option>
                        <option value="oldest">Oldest</option>
                        <option value="random">Random</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* WMD System Oversight */}
            <div id="admin-wmd-section" className="nn-panel nn-panel--x-pad nn-panel--magenta">
              <div className="nn-panel__header nn-panel__header--bleed">
                <span className="nn-panel__title">WMD System Oversight</span>
                <span className="nn-panel__meta">THREAT ▸ STRATEGIC</span>
              </div>
              <div className="flex items-center justify-end gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[color:var(--nn-text-secondary)]">Time Range:</span>
                  <select 
                    value={wmdTimeRange}
                    onChange={(e) => setWmdTimeRange(e.target.value as '7d' | '30d' | '90d')}
                    className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-1 text-[color:var(--nn-text-primary)] text-sm"
                  >
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                  </select>
                </div>
              </div>

              <div className="space-y-6">
                {/* System Health Status */}
                {wmdStatus && (
                  <div className="nn-tile">
                    <h3 className="nn-panel__title mb-3">System Health</h3>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none text-center">
                        <p className="text-xs text-[color:var(--nn-text-secondary)]">Active Operations</p>
                        <p className="nn-num text-lg font-bold text-[color:var(--nn-magenta)]">
                          {wmdStatus.activeOperations?.missiles || 0}
                        </p>
                        <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">Missiles</p>
                      </div>
                      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none text-center">
                        <p className="text-xs text-[color:var(--nn-text-secondary)]">Active Votes</p>
                        <p className="nn-num text-lg font-bold text-[color:var(--nn-amber)]">
                          {wmdStatus.activeOperations?.votes || 0}
                        </p>
                        <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">Pending</p>
                      </div>
                      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none text-center">
                        <p className="text-xs text-[color:var(--nn-text-secondary)]">Scheduled Jobs</p>
                        <p className="nn-num text-lg font-bold text-[color:var(--nn-cyan)]">
                          {wmdStatus.jobs?.scheduled || 0}
                        </p>
                        <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">Queue</p>
                      </div>
                      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none text-center">
                        <p className="text-xs text-[color:var(--nn-text-secondary)]">System Alerts</p>
                        <p className={`nn-num text-lg font-bold ${(wmdStatus.alerts?.length || 0) > 0 ? 'text-[color:var(--nn-magenta)]' : 'text-[color:var(--nn-green)]'}`}>
                          {wmdStatus.alerts?.length || 0}
                        </p>
                        <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">Active</p>
                      </div>
                    </div>

                    {/* Active Alerts */}
                    {wmdStatus.alerts && wmdStatus.alerts.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="nn-panel__title">Active Alerts</h4>
                        {wmdStatus.alerts.map((alert, idx) => (
                          <div key={idx} className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-semibold text-[color:var(--nn-magenta)]">{alert.type}</p>
                                <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">{alert.message}</p>
                                <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                                  {alert.playerId && `Player: ${alert.playerId}`}
                                  {alert.clanId && ` | Clan: ${alert.clanId}`}
                                </p>
                              </div>
                              <span className="text-xs text-[color:var(--nn-text-secondary)]">
                                {new Date(alert.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Analytics Summary */}
                {wmdAnalytics && (
                  <div className="nn-tile">
                    <h3 className="nn-panel__title mb-3">Analytics Summary</h3>
                    
                    {/* Missile Statistics */}
                    <div className="mb-4">
                      <h4 className="nn-panel__title mb-2">Missile Operations</h4>
                      <div className="grid grid-cols-5 gap-3">
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-center">
                          <p className="text-xs text-[color:var(--nn-text-secondary)]">Total Launched</p>
                          <p className="text-xl font-bold text-[color:var(--nn-amber)]">
                            {wmdAnalytics.missiles?.total || 0}
                          </p>
                        </div>
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-center">
                          <p className="text-xs text-[color:var(--nn-text-secondary)]">Intercepted</p>
                          <p className="text-xl font-bold text-[color:var(--nn-cyan)]">
                            {wmdAnalytics.missiles?.intercepted || 0}
                          </p>
                        </div>
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-center">
                          <p className="text-xs text-[color:var(--nn-text-secondary)]">Hit Targets</p>
                          <p className="text-xl font-bold text-[color:var(--nn-magenta)]">
                            {wmdAnalytics.missiles?.hit || 0}
                          </p>
                        </div>
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-center">
                          <p className="text-xs text-[color:var(--nn-text-secondary)]">Success Rate</p>
                          <p className="text-xl font-bold text-[color:var(--nn-green)]">
                            {wmdAnalytics.missiles?.successRate ? 
                              `${(wmdAnalytics.missiles.successRate * 100).toFixed(1)}%` : '0%'}
                          </p>
                        </div>
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-center">
                          <p className="text-xs text-[color:var(--nn-text-secondary)]">Avg Damage</p>
                          <p className="text-xl font-bold text-[color:var(--nn-amber)]">
                            {wmdAnalytics.missiles?.avgDamage ? 
                              Math.round(wmdAnalytics.missiles.avgDamage).toLocaleString() : '0'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Voting Statistics */}
                    <div className="mb-4">
                      <h4 className="nn-panel__title mb-2">Voting Patterns</h4>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-center">
                          <p className="text-xs text-[color:var(--nn-text-secondary)]">Total Votes</p>
                          <p className="text-xl font-bold text-[color:var(--nn-amber)]">
                            {wmdAnalytics.votes?.total || 0}
                          </p>
                        </div>
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-center">
                          <p className="text-xs text-[color:var(--nn-text-secondary)]">Passed</p>
                          <p className="text-xl font-bold text-[color:var(--nn-green)]">
                            {wmdAnalytics.votes?.passed || 0}
                          </p>
                        </div>
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-center">
                          <p className="text-xs text-[color:var(--nn-text-secondary)]">Failed</p>
                          <p className="text-xl font-bold text-[color:var(--nn-magenta)]">
                            {wmdAnalytics.votes?.failed || 0}
                          </p>
                        </div>
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-center">
                          <p className="text-xs text-[color:var(--nn-text-secondary)]">Approval Rate</p>
                          <p className="text-xl font-bold text-[color:var(--nn-violet)]">
                            {wmdAnalytics.votes?.approvalRate ? 
                              `${(wmdAnalytics.votes.approvalRate * 100).toFixed(1)}%` : '0%'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Defense & Economic Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="nn-panel__title mb-2">Defense Operations</h4>
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-[color:var(--nn-text-secondary)]">Research Attempts</span>
                            <span className="text-sm font-bold text-[color:var(--nn-cyan)]">
                              {wmdAnalytics.defense?.researchAttempts || 0}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-[color:var(--nn-text-secondary)]">Successful Research</span>
                            <span className="text-sm font-bold text-[color:var(--nn-green)]">
                              {wmdAnalytics.defense?.researchSuccesses || 0}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-[color:var(--nn-text-secondary)]">Active Spy Ops</span>
                            <span className="text-sm font-bold text-[color:var(--nn-violet)]">
                              {wmdAnalytics.defense?.activeSpyOps || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="nn-panel__title mb-2">Economic Impact</h4>
                        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-3 rounded-none">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-[color:var(--nn-text-secondary)]">Total Spent</span>
                            <span className="text-sm font-bold text-[color:var(--nn-magenta)]">
                              {wmdAnalytics.economy?.totalSpent ? 
                                Math.round(wmdAnalytics.economy.totalSpent).toLocaleString() : '0'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-[color:var(--nn-text-secondary)]">Avg Per Operation</span>
                            <span className="text-sm font-bold text-[color:var(--nn-amber)]">
                              {wmdAnalytics.economy?.avgCost ? 
                                Math.round(wmdAnalytics.economy.avgCost).toLocaleString() : '0'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-[color:var(--nn-text-secondary)]">Clans Participating</span>
                            <span className="text-sm font-bold text-[color:var(--nn-green)]">
                              {wmdAnalytics.economy?.uniqueClans || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Balance Warnings */}
                    {wmdAnalytics.balance?.warnings && wmdAnalytics.balance.warnings.length > 0 && (
                      <div className="mt-4">
                        <h4 className="nn-panel__title mb-2">Balance Warnings</h4>
                        <div className="space-y-2">
                          {wmdAnalytics.balance.warnings.map((warning: string, idx: number) => (
                            <div key={idx} className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none px-3 py-2">
                              <p className="text-sm text-[color:var(--nn-amber)]">{warning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Emergency Admin Actions */}
                <div className="nn-tile">
                  <h3 className="nn-panel__title mb-3">Emergency Actions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="nn-panel__title">Missile Control</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          placeholder="Missile ID"
                          id="disarm-missile-id"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <input 
                          type="text"
                          placeholder="Reason for disarming"
                          id="disarm-reason"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <button
                          onClick={async () => {
                            const missileId = (document.getElementById('disarm-missile-id') as HTMLInputElement)?.value;
                            const reason = (document.getElementById('disarm-reason') as HTMLInputElement)?.value;
                            if (!missileId || !reason) {
                              showInfo('Please provide missile ID and reason');
                              return;
                            }
                            if (!(await confirmDialog(`Emergency disarm missile ${missileId}? This will refund 50% of costs.`))) return;
                            
                            try {
                              const res = await fetch('/api/admin/wmd', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'disarm-missile', missileId, reason })
                              });
                              const data = await res.json();
                              if (data.success) {
                                showSuccess('Missile disarmed successfully! Clan refunded 50% of costs.');
                                // Reload WMD status
                                const statusRes = await fetch('/api/admin/wmd?action=status');
                                const statusData = await statusRes.json();
                                if (statusData.success) setWmdStatus(statusData.data);
                              } else {
                                showError(`Error: ${extractApiError(data, res.status)}`);
                              }
                            } catch (err) {
                              console.error('Disarm error:', err);
                              showError('Failed to disarm missile');
                            }
                          }}
                          className="w-full bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold text-sm transition-colors"
                        >
                          Emergency Disarm
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="nn-panel__title">Vote Control</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          placeholder="Vote ID"
                          id="expire-vote-id"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <input 
                          type="text"
                          placeholder="Reason for expiration"
                          id="expire-reason"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <button
                          onClick={async () => {
                            const voteId = (document.getElementById('expire-vote-id') as HTMLInputElement)?.value;
                            const reason = (document.getElementById('expire-reason') as HTMLInputElement)?.value;
                            if (!voteId || !reason) {
                              showInfo('Please provide vote ID and reason');
                              return;
                            }
                            if (!(await confirmDialog(`Force expire vote ${voteId}?`))) return;
                            
                            try {
                              const res = await fetch('/api/admin/wmd', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'expire-vote', voteId, reason })
                              });
                              const data = await res.json();
                              if (data.success) {
                                showSuccess('Vote expired successfully!');
                                // Reload WMD status
                                const statusRes = await fetch('/api/admin/wmd?action=status');
                                const statusData = await statusRes.json();
                                if (statusData.success) setWmdStatus(statusData.data);
                              } else {
                                showError(`Error: ${extractApiError(data, res.status)}`);
                              }
                            } catch (err) {
                              console.error('Expire error:', err);
                              showError('Failed to expire vote');
                            }
                          }}
                          className="w-full bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold text-sm transition-colors"
                        >
                          ⏱️ Force Expire
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="nn-panel__title">Cooldown Adjustment</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          placeholder="Clan ID"
                          id="cooldown-clan-id"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <input 
                          type="number"
                          placeholder="Hours to adjust (+/-)"
                          id="cooldown-hours"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <input 
                          type="text"
                          placeholder="Reason"
                          id="cooldown-reason"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <button
                          onClick={async () => {
                            const clanId = (document.getElementById('cooldown-clan-id') as HTMLInputElement)?.value;
                            const hours = parseInt((document.getElementById('cooldown-hours') as HTMLInputElement)?.value || '0');
                            const reason = (document.getElementById('cooldown-reason') as HTMLInputElement)?.value;
                            if (!clanId || hours === 0 || !reason) {
                              showInfo('Please provide clan ID, hours adjustment, and reason');
                              return;
                            }
                            if (!(await confirmDialog(`Adjust clan ${clanId} cooldown by ${hours} hours?`))) return;
                            
                            try {
                              const res = await fetch('/api/admin/wmd', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'adjust-cooldown', clanId, adjustmentHours: hours, reason })
                              });
                              const data = await res.json();
                              if (data.success) {
                                showInfo(`Cooldown adjusted! New cooldown expires: ${new Date(data.newCooldownExpiry).toLocaleString()}`);
                              } else {
                                showError(`Error: ${extractApiError(data, res.status)}`);
                              }
                            } catch (err) {
                              console.error('Cooldown adjustment error:', err);
                              showError('Failed to adjust cooldown');
                            }
                          }}
                          className="w-full bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold text-sm transition-colors"
                        >
                          ⏰ Adjust Cooldown
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="nn-panel__title">Flag Suspicious Activity</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          placeholder="Player ID (optional)"
                          id="flag-player-id"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <input 
                          type="text"
                          placeholder="Clan ID (optional)"
                          id="flag-clan-id"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <select 
                          id="flag-activity-type"
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        >
                          <option value="">Select Activity Type</option>
                          <option value="rapid_launch">Rapid Launch</option>
                          <option value="vote_manipulation">Vote Manipulation</option>
                          <option value="cooldown_exploit">Cooldown Exploit</option>
                          <option value="coordinated_attack">Coordinated Attack</option>
                          <option value="other">Other</option>
                        </select>
                        <textarea 
                          placeholder="Details and evidence"
                          id="flag-details"
                          rows={3}
                          className="w-full bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)] text-sm"
                        />
                        <button
                          onClick={async () => {
                            const playerId = (document.getElementById('flag-player-id') as HTMLInputElement)?.value || undefined;
                            const clanId = (document.getElementById('flag-clan-id') as HTMLInputElement)?.value || undefined;
                            const activityType = (document.getElementById('flag-activity-type') as HTMLSelectElement)?.value;
                            const details = (document.getElementById('flag-details') as HTMLTextAreaElement)?.value;
                            
                            if (!activityType || !details) {
                              showInfo('Please select activity type and provide details');
                              return;
                            }
                            if (!playerId && !clanId) {
                              showInfo('Please provide either player ID or clan ID');
                              return;
                            }
                            
                            try {
                              const res = await fetch('/api/admin/wmd', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  action: 'flag-activity', 
                                  playerId, 
                                  clanId, 
                                  activityType, 
                                  details 
                                })
                              });
                              const data = await res.json();
                              if (data.success) {
                                showSuccess('Activity flagged successfully! Alert created for admin review.');
                                // Reload WMD status to show new alert
                                const statusRes = await fetch('/api/admin/wmd?action=status');
                                const statusData = await statusRes.json();
                                if (statusData.success) setWmdStatus(statusData.data);
                              } else {
                                showError(`Error: ${extractApiError(data, res.status)}`);
                              }
                            } catch (err) {
                              console.error('Flag error:', err);
                              showError('Failed to flag activity');
                            }
                          }}
                          className="w-full bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold text-sm transition-colors"> Create Alert
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

        {/* RP Economy Management */}
        <div className="nn-panel nn-panel--violet">
              <button
                onClick={() => {
                  setRpEconomyExpanded(!rpEconomyExpanded);
                  if (!rpEconomyExpanded && !rpStats) {
                    loadRpEconomyData();
                  }
                }}
                className="w-full p-6 text-left bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] transition-colors flex items-center justify-between"
              >
                <div>
                  <h2 className="nn-panel__title">RP Economy Management</h2>
                  <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">Monitor and manage the Research Point economy</p>
                </div>
                <span className="text-3xl text-[color:var(--nn-violet)]">{rpEconomyExpanded ? '▼' : '▶'}</span>
              </button>

              {rpEconomyExpanded && (
                <div className="p-6 pt-0 space-y-6">
                  {rpLoading && !rpStats ? (
                    <div className="text-center py-8 text-[color:var(--nn-text-secondary)]">Loading economy data...</div>
                  ) : (
                    <>
                      {/* Quick Actions Bar */}
                      <div className="flex items-center justify-between nn-tile">
                        <div className="text-sm text-[color:var(--nn-text-secondary)]">
                          Last refreshed: {new Date().toLocaleTimeString()}
                        </div>
                        <button
                          onClick={loadRpEconomyData}
                          disabled={rpLoading}
                          className="nn-abtn nn-abtn--violet px-6 py-2.5"
                        >
                          {rpLoading ? 'LOADING' : 'REFRESH DATA'}
                        </button>
                      </div>

                      {/* Economy Overview Stats */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="nn-well nn-well--accent !mx-0 p-4" style={{ borderColor: 'color-mix(in oklab, var(--nn-amber) 35%, transparent)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="nn-lab">TOTAL RP</div>
                            <div className="text-xs opacity-80">Total RP in Circulation</div>
                          </div>
                          <div className="nn-num text-lg font-bold">{rpStats?.totalRP?.toLocaleString() || '0'}</div>
                        </div>
                        <div className="nn-well nn-well--accent !mx-0 p-4" style={{ borderColor: 'color-mix(in oklab, var(--nn-green) 35%, transparent)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="nn-lab">TREND</div>
                            <div className="text-xs opacity-80">Daily Generation</div>
                          </div>
                          <div className="nn-num text-lg font-bold">{rpStats?.dailyGeneration?.toLocaleString() || '0'}</div>
                          <div className="text-xs opacity-80">Last 24 hours</div>
                        </div>
                        <div className="nn-well nn-well--accent !mx-0 p-4" style={{ borderColor: 'color-mix(in oklab, var(--nn-cyan) 35%, transparent)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="nn-lab">HOLDERS</div>
                            <div className="text-xs opacity-80">Active Earners</div>
                          </div>
                          <div className="nn-num text-lg font-bold">{rpStats?.activeEarners24h?.toLocaleString() || '0'}</div>
                          <div className="text-xs opacity-80">Last 24 hours</div>
                        </div>
                        <div className="nn-well nn-well--accent !mx-0 p-4" style={{ borderColor: 'color-mix(in oklab, var(--nn-violet) 35%, transparent)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="nn-lab">STAT</div>
                            <div className="text-xs opacity-80">Average Balance</div>
                          </div>
                          <div className="nn-num text-lg font-bold">{rpStats?.averageBalance?.toLocaleString() || '0'}</div>
                          <div className="text-xs opacity-80">Median: {rpStats?.medianBalance?.toLocaleString() || '0'}</div>
                        </div>
                      </div>

                      {/* Generation vs Spending & Bulk Adjustment */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* Generation/Spending */}
                        <div className="nn-tile">
                          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[color:var(--nn-violet)]">
                            <span>Generation vs Spending</span>
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-[color:var(--nn-text-secondary)]">Total Generated:</span>
                              <span className="text-[color:var(--nn-green)] font-bold">{rpStats?.totalGenerated?.toLocaleString() || '0'} RP</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[color:var(--nn-text-secondary)]">Total Spent:</span>
                              <span className="text-[color:var(--nn-magenta)] font-bold">{rpStats?.totalSpent?.toLocaleString() || '0'} RP</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                              <span className="text-[color:var(--nn-text-secondary)] font-semibold">Net Circulation:</span>
                              <span className="text-[color:var(--nn-amber)] font-bold text-lg">{rpStats?.totalRP?.toLocaleString() || '0'} RP</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[color:var(--nn-text-secondary)] text-xs">VIP Players:</span>
                              <span className="text-[color:var(--nn-violet)] text-xs">{rpStats?.vipPlayers || 0} players (+50% bonus)</span>
                            </div>
                          </div>
                        </div>

                        {/* Bulk RP Adjustment Tool */}
                        <div className="nn-tile">
                          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[color:var(--nn-violet)]">
                            
                            <span>Bulk RP Adjustment</span>
                          </h3>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={rpBulkUsername}
                              onChange={(e) => setRpBulkUsername(e.target.value)}
                              className="w-full px-3 py-2 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm"
                              placeholder="Username"
                            />
                            <input
                              type="number"
                              value={rpBulkAmount || ''}
                              onChange={(e) => setRpBulkAmount(parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm"
                              placeholder="Amount (+ to add, - to remove)"
                            />
                            <input
                              type="text"
                              value={rpBulkReason}
                              onChange={(e) => setRpBulkReason(e.target.value)}
                              className="w-full px-3 py-2 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-[color:var(--nn-text-primary)] text-sm"
                              placeholder="Reason for adjustment"
                            />
                            <button
                              onClick={handleRpBulkAdjustment}
                              disabled={rpBulkLoading || !rpBulkUsername || rpBulkAmount === 0 || !rpBulkReason}
                              className="w-full px-4 py-2 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] rounded-none font-semibold transition-colors text-sm"
                            >
                              {rpBulkLoading ? 'PROCESSING' : 'ADJUST RP BALANCE'}
                            </button>
                            {rpBulkResult && (
                              <div className={`text-xs p-2 rounded-none ${rpBulkResult.startsWith('Success') ? 'bg-[color-mix(in_oklab,var(--nn-green)_12%,transparent)] text-[color:var(--nn-green)]' : 'bg-[color-mix(in_oklab,var(--nn-magenta)_12%,transparent)] text-[color:var(--nn-magenta)]'}`}>
                                {rpBulkResult}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Earners and Spenders */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* Top Earners */}
                        <div className="nn-tile">
                          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[color:var(--nn-violet)]">
                            
                            <span>Top RP Earners</span>
                            <span className="text-xs text-[color:var(--nn-text-secondary)] ml-auto">{rpDateFilter}</span>
                          </h3>
                          <div className="space-y-2">
                            {rpTopEarners.slice(0, 5).map((player, index) => (
                              <div key={player.username} className="flex items-center justify-between p-2 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="nn-num w-7 text-center text-xs" style={{ color: index === 0 ? 'var(--nn-amber)' : index === 1 ? 'var(--nn-cyan)' : index === 2 ? 'var(--nn-violet)' : 'var(--nn-text-tertiary)' }}>{`#${index + 1}`}</span>
                                  <span className="font-semibold">{player.username}</span>
                                  {player.isVIP && <span className="text-xs bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] px-1 py-0.5 rounded-none">VIP</span>}
                                </div>
                                <span className="text-[color:var(--nn-green)] font-bold">{player.amount?.toLocaleString()} RP</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Top Spenders */}
                        <div className="nn-tile">
                          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[color:var(--nn-violet)]">
                            
                            <span>Top RP Spenders</span>
                            <span className="text-xs text-[color:var(--nn-text-secondary)] ml-auto">{rpDateFilter}</span>
                          </h3>
                          <div className="space-y-2">
                            {rpTopSpenders.slice(0, 5).map((player, index) => (
                              <div key={player.username} className="flex items-center justify-between p-2 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="nn-num w-7 text-center text-xs" style={{ color: index === 0 ? 'var(--nn-amber)' : index === 1 ? 'var(--nn-cyan)' : index === 2 ? 'var(--nn-violet)' : 'var(--nn-text-tertiary)' }}>{`#${index + 1}`}</span>
                                  <span className="font-semibold">{player.username}</span>
                                  {player.isVIP && <span className="text-xs bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] px-1 py-0.5 rounded-none">VIP</span>}
                                </div>
                                <span className="text-[color:var(--nn-magenta)] font-bold">{player.amount?.toLocaleString()} RP</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Transaction History with Filters */}
                      <div className="nn-tile">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-[color:var(--nn-violet)]">
                            <span>Recent RP Transactions</span>
                          </h3>
                          
                          {/* Filters */}
                          <div className="flex gap-2">
                            <select
                              value={rpDateFilter}
                              onChange={(e) => setRpDateFilter(e.target.value as '24h' | '7d' | '30d' | 'all')}
                              className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-xs"
                            >
                              <option value="24h">Last 24 Hours</option>
                              <option value="7d">Last 7 Days</option>
                              <option value="30d">Last 30 Days</option>
                              <option value="all">All Time</option>
                            </select>
                            
                            <select
                              value={rpSourceFilter}
                              onChange={(e) => setRpSourceFilter(e.target.value)}
                              className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-xs"
                            >
                              <option value="all">All Sources</option>
                              <option value="harvest_milestone">Harvest Milestones</option>
                              <option value="level_up">Level Ups</option>
                              <option value="battle">Battles</option>
                              <option value="achievement">Achievements</option>
                              <option value="daily_login">Daily Login</option>
                              <option value="admin_adjustment">Admin Adjustments</option>
                            </select>
                            
                            <input
                              type="text"
                              value={rpUsernameFilter}
                              onChange={(e) => setRpUsernameFilter(e.target.value)}
                              placeholder="Filter by username..."
                              className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-xs w-40"
                            />
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-[color:var(--nn-void)]">
                              <tr className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
                                <th className="text-left py-2 px-2">Time</th>
                                <th className="text-left py-2 px-2">Player</th>
                                <th className="text-left py-2 px-2">Source</th>
                                <th className="text-left py-2 px-2">Description</th>
                                <th className="text-right py-2 px-2">Amount</th>
                                <th className="text-center py-2 px-2">VIP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rpTransactions.slice(0, 50).map((tx) => (
                                <tr key={tx._id} className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]">
                                  <td className="py-2 px-2 text-[color:var(--nn-text-secondary)]">{formatRpTimestamp(tx.timestamp)}</td>
                                  <td className="py-2 px-2 font-semibold">{tx.username}</td>
                                  <td className="py-2 px-2">{formatRpSourceName(tx.source)}</td>
                                  <td className="py-2 px-2 text-[color:var(--nn-text-secondary)]">{tx.description}</td>
                                  <td className={`py-2 px-2 text-right font-bold ${tx.amount >= 0 ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
                                    {tx.amount >= 0 ? '+' : ''}{tx.amount?.toLocaleString()}
                                  </td>
                                  <td className="py-2 px-2 text-center">{tx.vipBonusApplied ? 'VIP' : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {rpTransactions.length === 0 && (
                            <div className="text-center py-10">
                              <Coins className="w-10 h-10 mx-auto mb-2 nn-text-dim" />
                              <p className="nn-text-dim">No transactions found</p>
                              <p className="text-sm nn-text-dim mt-1">RP activity will appear here.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

          {/* Player Detail Modal */}
          {selectedPlayer && (
            <PlayerDetailModal
              username={selectedPlayer}
              onClose={() => setSelectedPlayer(null)}
            />
          )}

          {/* Tile Inspector Modal */}
          {showTileInspector && (
            <TileInspectorModal
              onClose={() => setShowTileInspector(false)}
            />
          )}

          {showFactoryInspector && (
            <FactoryInspectorModal
              onClose={() => setShowFactoryInspector(false)}
            />
          )}

          {showBattleLogs && (
            <BattleLogsModal
              onClose={() => setShowBattleLogs(false)}
            />
          )}

          {showAchievementStats && (
            <AchievementStatsModal
              onClose={() => setShowAchievementStats(false)}
            />
          )}

          {/* Scheduler Health Modal (FID-20260909-035 jobs-status panel) */}
          {showJobsStatus && (
            <Suspense fallback={null}>
              <JobsStatusModal
                onClose={() => setShowJobsStatus(false)}
              />
            </Suspense>
          )}

          {/* Factory Settings Panel (FID-20260912-074) */}
          {showFactorySettings && (
            <Suspense fallback={null}>
              <FactorySettingsPanel
                onClose={() => setShowFactorySettings(false)}
              />
            </Suspense>
          )}

          {showSystemReset && (
            <SystemResetModal
              onClose={() => setShowSystemReset(false)}
            />
          )}

          {showWebSocketConsole && (
            <WebSocketConsoleModal
              onClose={() => setShowWebSocketConsole(false)}
            />
          )}

          {/* Hotkey Manager Modal */}
          {showHotkeyManager && (
            <HotkeyManagerPanel
              isOpen={showHotkeyManager}
              onClose={() => setShowHotkeyManager(false)}
            />
          )}

          {/* Schedule Management Modal (FID-20251025-003) */}
          {showScheduleModal && (
            <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_50%,transparent)] flex items-center justify-center z-50 p-4">
              <div className="nn-panel max-w-md w-full">
                <h3 className="text-xl font-bold text-[color:var(--nn-cyan)] mb-4">
                  {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Schedule Name (optional)</label>
                    <input
                      type="text"
                      value={scheduleForm.name}
                      onChange={(e) => setScheduleForm({...scheduleForm, name: e.target.value})}
                      placeholder="e.g., Weekend Morning Spawn"
                      className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Day of Week</label>
                      <select
                        value={scheduleForm.dayOfWeek}
                        onChange={(e) => setScheduleForm({...scheduleForm, dayOfWeek: parseInt(e.target.value)})}
                        className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
                      >
                        <option value="0">Sunday</option>
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Hour (0-23)</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={scheduleForm.hour}
                        onChange={(e) => setScheduleForm({...scheduleForm, hour: parseInt(e.target.value) || 0})}
                        className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Spawn Percentage (1-200%)</label>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={scheduleForm.spawnPercentage}
                      onChange={(e) => setScheduleForm({...scheduleForm, spawnPercentage: parseInt(e.target.value) || 100})}
                      className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
                    />
                    <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                      Tip: Multiple schedules can combine (e.g., two 50% schedules = 100% total)
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm text-[color:var(--nn-text-secondary)] block mb-1">Timezone</label>
                    <select
                      value={scheduleForm.timezone}
                      onChange={(e) => setScheduleForm({...scheduleForm, timezone: e.target.value})}
                      className="w-full bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
                    >
                      <option value="America/New_York">Eastern (EST/EDT)</option>
                      <option value="America/Chicago">Central (CST/CDT)</option>
                      <option value="America/Denver">Mountain (MST/MDT)</option>
                      <option value="America/Los_Angeles">Pacific (PST/PDT)</option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Paris">Paris (CET/CEST)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="Asia/Shanghai">Shanghai (CST)</option>
                      <option value="Australia/Sydney">Sydney (AEDT/AEST)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="scheduleEnabled"
                      checked={scheduleForm.enabled}
                      onChange={(e) => setScheduleForm({...scheduleForm, enabled: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <label htmlFor="scheduleEnabled" className="text-sm text-[color:var(--nn-text-secondary)]">
                      Schedule Enabled
                    </label>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSaveSchedule}
                    disabled={schedulesLoading}
                    className="flex-1 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold"
                  >
                    {schedulesLoading ? 'Saving...' : 'Save Schedule'}
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleModal(false);
                      setEditingSchedule(null);
                    }}
                    className="flex-1 bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Access restricted to level 10+ players
// - Displays game statistics and player management tools
// - Backend API needed: /api/admin/stats and /api/admin/players
// - Future: Individual database inspection tools per button
// ============================================================
