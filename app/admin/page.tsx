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

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
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
import SystemResetModal from '@/components/admin/SystemResetModal';
import WebSocketConsoleModal from '@/components/admin/WebSocketConsoleModal';
import HotkeyManagerPanel from '@/components/HotkeyManagerPanel';
import type { AdminStatsPayload, AdminPlayerListItem, AdminBotStatsPayload, AdminSchedulePayload } from '@/types/api-responses';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

interface AdminPageProps {
  embedded?: boolean;
}

export default function AdminPage({ embedded = false }: AdminPageProps = {}) {
  const router = useRouter();
  const { player } = useGameContext();
  const [stats, setStats] = useState<AdminStatsPayload | null>(null);
  const [players, setPlayers] = useState<AdminPlayerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [showTileInspector, setShowTileInspector] = useState(false);
  const [showFactoryInspector, setShowFactoryInspector] = useState(false);
  const [showBattleLogs, setShowBattleLogs] = useState(false);
  const [showAchievementStats, setShowAchievementStats] = useState(false);
  const [showSystemReset, setShowSystemReset] = useState(false);
  const [showWebSocketConsole, setShowWebSocketConsole] = useState(false);
  const [showHotkeyManager, setShowHotkeyManager] = useState(false);
  
  // WMD system state
  const [wmdStatus, setWmdStatus] = useState<any>(null);
  const [wmdAnalytics, setWmdAnalytics] = useState<any>(null);
  const [wmdTimeRange, setWmdTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  
  // Bot control state
  const [botStats, setBotStats] = useState<any>(null);
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
  
  // Schedule management state (FID-20251025-003)
  const [schedules, setSchedules] = useState<AdminSchedulePayload[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<AdminSchedulePayload | null>(null);
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
  const [beerSpawnStats, setBeerSpawnStats] = useState<any>(null);
  const [beerDefeatStats, setBeerDefeatStats] = useState<any>(null);
  const [beerEffectivenessStats, setBeerEffectivenessStats] = useState<any>(null);
  const [beerAnalyticsLoading, setBeerAnalyticsLoading] = useState(false);
  const [beerAnalyticsError, setBeerAnalyticsError] = useState<string | null>(null);
  
  // Analytics state
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [activityData, setActivityData] = useState<any[]>([]);
  const [resourceData, setResourceData] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<any>(null);
  const [flagData, setFlagData] = useState<any[]>([]);
  
  // VIP Management state
  const [vipUsers, setVipUsers] = useState<any[]>([]);
  const [vipFilter, setVipFilter] = useState<'all' | 'vip' | 'basic'>('all');
  const [vipSearchTerm, setVipSearchTerm] = useState('');
  const [vipLoading, setVipLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // RP Economy state
  const [rpEconomyExpanded, setRpEconomyExpanded] = useState(false);
  const [rpStats, setRpStats] = useState<any>(null);
  const [rpTransactions, setRpTransactions] = useState<any[]>([]);
  const [rpGenerationBySource, setRpGenerationBySource] = useState<any[]>([]);
  const [rpMilestoneStats, setRpMilestoneStats] = useState<any[]>([]);
  const [rpTopEarners, setRpTopEarners] = useState<any[]>([]);
  const [rpTopSpenders, setRpTopSpenders] = useState<any[]>([]);
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
          fetch('/api/admin/stats'),
          fetch('/api/admin/players'),
          fetch('/api/admin/bot-stats'),
          fetch('/api/admin/bot-config'),
          fetch('/api/admin/beer-bases/config')
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
        const wmdStatusRes = await fetch('/api/admin/wmd?action=status');
        const wmdStatusData = await wmdStatusRes.json();
        if (wmdStatusData.success) {
          setWmdStatus(wmdStatusData.data);
        }

        // Load WMD analytics
        const wmdAnalyticsRes = await fetch(`/api/admin/wmd?action=analytics&range=${wmdTimeRange}`);
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
    loadVipUsers();
  }, [player]);

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

  // Filter players by search term
  const filteredPlayers = players.filter(p =>
    p.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter VIP users
  const filteredVipUsers = vipUsers
    .filter(u => {
      const matchesSearch = u.username.toLowerCase().includes(vipSearchTerm.toLowerCase()) ||
                           (u.email && u.email.toLowerCase().includes(vipSearchTerm.toLowerCase()));
      const matchesFilter = vipFilter === 'all' || 
                           (vipFilter === 'vip' && u.isVIP) || 
                           (vipFilter === 'basic' && !u.isVIP);
      return matchesSearch && matchesFilter;
    });

  const vipCount = vipUsers.filter(u => u.isVIP).length;
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
        alert(`Successfully spawned ${data.data.spawned} bots!`);
        const botStatsRes = await fetch('/api/admin/bot-stats');
        const botStatsData = await botStatsRes.json();
        if (botStatsData.success) setBotStats(botStatsData.data);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Bot spawn error:', err);
      alert('Failed to spawn bots');
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
        alert(`Regeneration complete! Updated ${data.data.updated} bots, spawned ${data.data.spawned} new bots.`);
        const botStatsRes = await fetch('/api/admin/bot-stats');
        const botStatsData = await botStatsRes.json();
        if (botStatsData.success) setBotStats(botStatsData.data);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Bot regen error:', err);
      alert('Failed to run regeneration');
    } finally {
      setBotActionLoading(false);
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
        alert(`Beer bases respawned! ${data.count} bases created using smart spawning.`);
        // Refresh bot stats
        const botStatsRes = await fetch('/api/admin/bot-stats');
        const botStatsData = await botStatsRes.json();
        if (botStatsData.success) {
          setBotStats(botStatsData.data);
        }
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Beer base respawn error:', err);
      alert('Failed to respawn beer bases');
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
          spawnRateMin: beerBaseConfig.spawnRateMin / 100,
          spawnRateMax: beerBaseConfig.spawnRateMax / 100,
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
        alert('Beer Base configuration saved successfully!');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Beer Base config save error:', err);
      alert('Failed to save Beer Base configuration');
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
        alert(editingSchedule ? 'Schedule updated!' : 'Schedule created!');
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
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Schedule save error:', err);
      alert('Failed to save schedule');
    } finally {
      setSchedulesLoading(false);
    }
  };
  
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    
    setSchedulesLoading(true);
    try {
      const res = await fetch(`/api/admin/beer-bases/schedules?id=${id}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (data.success) {
        alert('Schedule deleted!');
        await loadSchedules();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Schedule delete error:', err);
      alert('Failed to delete schedule');
    } finally {
      setSchedulesLoading(false);
    }
  };
  
  const handleToggleSchedule = async (schedule: any) => {
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
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Schedule toggle error:', err);
      alert('Failed to toggle schedule');
    } finally {
      setSchedulesLoading(false);
    }
  };
  
  const handleEditSchedule = (schedule: any) => {
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
  const loadBeerBaseAnalytics = async () => {
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
  };
  
  // Load analytics when period changes or panel expands
  useEffect(() => {
    if (beerAnalyticsExpanded && player?.isAdmin) {
      loadBeerBaseAnalytics();
    }
  }, [beerAnalyticsPeriod, beerAnalyticsExpanded, player?.isAdmin]);
  
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
        alert('Bot configuration saved successfully!');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Config save error:', err);
      alert('Failed to save configuration');
    } finally {
      setBotActionLoading(false);
    }
  };
  
  const handleBotAnalytics = () => {
    if (!botStats) {
      alert('Bot stats not loaded yet');
      return;
    }
    
    const analyticsText = `
Bot Analytics:
━━━━━━━━━━━━━━
Total Bots: ${botStats.totalBots}
Active: ${botStats.activeBots}
Inactive: ${botStats.inactiveBots}

By Specialization:
- Hoarder: ${botStats.bySpecialization?.hoarder || 0}
- Fortress: ${botStats.bySpecialization?.fortress || 0}
- Raider: ${botStats.bySpecialization?.raider || 0}
- Ghost: ${botStats.bySpecialization?.ghost || 0}
- Balanced: ${botStats.bySpecialization?.balanced || 0}

Beer Bases: ${botStats.beerBases || 0}
Migration Rate: ${((botStats.migrationPercent || 0) * 100).toFixed(1)}%
Regen Cycle: ${botStats.lastRegenCycle || 'Never'}
    `.trim();
    
    alert(analyticsText);
  };
  
  // Load analytics data
  const loadAnalyticsData = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    
    try {
      const [activityRes, resourceRes, sessionRes, flagsRes] = await Promise.all([
        fetch(`/api/admin/analytics/activity-trends?period=${analyticsPeriod}`),
        fetch(`/api/admin/analytics/resource-trends?period=${analyticsPeriod}`),
        fetch(`/api/admin/analytics/session-trends?period=${analyticsPeriod}`),
        fetch('/api/admin/anti-cheat/flagged-players')
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
          setSessionData(sessionJson.data);
        }
      
      if (flagsJson.success) {
        // Transform flag data for pie chart
        const severityCounts = flagsJson.data.reduce((acc: any, flag: any) => {
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
  };

  // Load VIP users
  const loadVipUsers = useCallback(async () => {
    setVipLoading(true);
    try {
      const response = await fetch('/api/admin/vip/list');
      const data = await response.json();
      if (data.success) {
        setVipUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading VIP users:', error);
    } finally {
      setVipLoading(false);
    }
  }, []);

  // Grant VIP
  const handleGrantVip = async (username: string, days: number) => {
    if (!confirm(`Grant VIP to ${username} for ${days} days?`)) return;
    
    try {
      const response = await fetch('/api/admin/vip/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, days })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`✅ VIP granted to ${username} for ${days} days`);
        loadVipUsers(); // Refresh list
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error granting VIP:', error);
      alert('Failed to grant VIP');
    }
  };

  // Revoke VIP
  const handleRevokeVip = async (username: string) => {
    if (!confirm(`Revoke VIP from ${username}?`)) return;
    
    try {
      const response = await fetch('/api/admin/vip/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`✅ VIP revoked from ${username}`);
        loadVipUsers(); // Refresh list
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error revoking VIP:', error);
      alert('Failed to revoke VIP');
    }
  };

  // Load RP Economy data
  const loadRpEconomyData = async () => {
    setRpLoading(true);
    
    try {
      const [statsRes, txRes, genRes, milestoneRes, topRes] = await Promise.all([
        fetch('/api/admin/rp-economy/stats'),
        fetch(`/api/admin/rp-economy/transactions?period=${rpDateFilter}&source=${rpSourceFilter}&username=${rpUsernameFilter}`),
        fetch(`/api/admin/rp-economy/generation-by-source?period=${rpDateFilter}`),
        fetch('/api/admin/rp-economy/milestone-stats'),
        fetch(`/api/admin/rp-economy/top-players?period=${rpDateFilter}`)
      ]);
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setRpStats(data);
      }
      
      if (txRes.ok) {
        const data = await txRes.json();
        setRpTransactions(data.transactions || []);
      }
      
      if (genRes.ok) {
        const data = await genRes.json();
        setRpGenerationBySource(data.sources || []);
      }
      
      if (milestoneRes.ok) {
        const data = await milestoneRes.json();
        setRpMilestoneStats(data.milestones || []);
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
  };

  // Bulk RP Adjustment
  const handleRpBulkAdjustment = async () => {
    if (!rpBulkUsername || rpBulkAmount === 0 || !rpBulkReason) {
      setRpBulkResult('❌ Please fill all fields');
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
        setRpBulkResult(`✅ Success! ${rpBulkUsername} now has ${data.newBalance} RP`);
        setRpBulkUsername('');
        setRpBulkAmount(0);
        setRpBulkReason('');
        loadRpEconomyData(); // Refresh data
      } else {
        setRpBulkResult(`❌ Error: ${data.message}`);
      }
      
    } catch (error) {
      setRpBulkResult('❌ Failed to adjust RP');
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
  }, [rpDateFilter, rpSourceFilter, rpUsernameFilter, rpEconomyExpanded]);
  
  // Load analytics on mount and period change
  useEffect(() => {
    if (isAdmin && player) {
      loadAnalyticsData();
    }
  }, [analyticsPeriod, isAdmin, player]);

  // Helper functions for RP Economy
  const formatRpSourceName = (source: string) => {
    const sourceMap: Record<string, string> = {
      'harvest_milestone': '🌾 Harvest Milestone',
      'level_up': '⬆️ Level Up',
      'battle': '⚔️ Battle',
      'achievement': '🏆 Achievement',
      'daily_login': '📅 Daily Login',
      'admin_adjustment': '⚙️ Admin Adjustment'
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
      <>
        <TopNavBar />
        <GameLayout
          statsPanel={<StatsPanel />}
          controlsPanel={<ControlsPanel />}
          tileView={
            <div className="h-full w-full overflow-auto bg-[--void] text-white flex items-center justify-center">
              <p>Access Denied - Admin Only</p>
            </div>
          }
        />
      </>
    );
  }

  const renderAdminContent = () => (
    <div className={embedded ? "p-6" : "h-full w-full overflow-auto bg-[--void] text-white p-8"}>
      <div className="max-w-7xl mx-auto">
        {!embedded && <BackButton />}

        <div className="flex items-center justify-between mb-8 mt-4">
          <h1 className="text-4xl font-bold text-[--neon-pink]">⚙️ Admin Panel</h1>
          <div className="bg-[--neon-pink]/5 px-4 py-2 rounded-lg border border-[--neon-pink]/30">
            <p className="text-sm text-[--neon-pink]">Admin: {player.username}</p>
          </div>
        </div>

        {error && (
          <div className="bg-[--neon-red]/10 border border-[--neon-red]/20 rounded-lg p-4 mb-6">
            <p className="text-[--neon-red]">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-white/50">Loading admin data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Game Statistics */}
            {stats && (
              <div className="bg-[--card] rounded-lg p-6 border-2 border-[--neon-pink]/20">
                <h2 className="text-2xl font-bold text-[--neon-pink] mb-4">📊 Game Statistics</h2>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/50 text-sm">Total Players</p>
                    <p className="text-3xl font-bold text-[--electric]">{stats.totalPlayers}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/50 text-sm">Bots</p>
                    <p className="text-3xl font-bold text-[--synth]">{stats.totalBots}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/50 text-sm">Factories</p>
                    <p className="text-3xl font-bold text-[--neon-red]">{stats.totalFactories}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/50 text-sm">Clans</p>
                    <p className="text-3xl font-bold text-[--neon-pink]">{stats.totalClans}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/50 text-sm">Caves</p>
                    <p className="text-3xl font-bold text-[--solar]">{stats.totalCaves}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/50 text-sm">Battles</p>
                    <p className="text-3xl font-bold text-[--neon-yellow]">{stats.totalBattles}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/50 text-sm">Active (24h)</p>
                    <p className="text-3xl font-bold text-[--synth]">{stats.activePlayers24h}</p>
                  </div>
                  <div className="bg-[--card] p-4 rounded-lg">
                    <p className="text-white/50 text-sm">Resources Gathered</p>
                    <p className="text-3xl font-bold text-[--electric]">{stats.totalResourcesGathered.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Player Management */}
            <div className="bg-[--card] rounded-lg p-6 border-2 border-[--neon-pink]/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-[--neon-pink]">👥 Player Management</h2>
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[--card] border border-[--border] rounded-lg px-4 py-2 text-white focus:border-[--neon-pink]/30 focus:outline-none w-64"
                />
              </div>

              <div className="bg-[--card] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[--card]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Username</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Level</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">STR</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">DEF</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">X</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Y</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border]">
                    {filteredPlayers.map((p) => (
                      <tr key={p.username} className="hover:bg-[--card]/50 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{p.username}</td>
                        <td className="px-4 py-3 text-[--neon-yellow]">{p.level}</td>
                        <td className="px-4 py-3 text-[--neon-pink]">{p.rank}</td>
                        <td className="px-4 py-3 text-[--electric]">{p.totalStrength?.toLocaleString() ?? 0}</td>
                        <td className="px-4 py-3 text-[--neon-yellow]">{p.totalDefense?.toLocaleString() ?? 0}</td>
                        <td className="px-4 py-3 text-white/60">{p.current_x}</td>
                        <td className="px-4 py-3 text-white/60">{p.current_y}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedPlayer(p.username)}
                            className="bg-[--neon-pink]/15 hover:bg-[--neon-pink]/15 text-white px-3 py-1 rounded text-sm transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredPlayers.length === 0 && (
                  <div className="text-center py-8 text-white/50">
                    No players found
                  </div>
                )}
              </div>
            </div>

            {/* VIP Management */}
            <div className="bg-[--card] rounded-lg p-6 border-2 border-[--neon-yellow]/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-[--neon-yellow]">⚡ VIP Management</h2>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={vipSearchTerm}
                    onChange={(e) => setVipSearchTerm(e.target.value)}
                    className="bg-[--card] border border-[--border] rounded-lg px-4 py-2 text-white focus:border-[--neon-yellow]/20 focus:outline-none w-64"
                  />
                  <button
                    onClick={loadVipUsers}
                    disabled={vipLoading}
                    className="px-4 py-2 bg-[--neon-yellow]/15 hover:bg-white/10 disabled:bg-white/5 text-white rounded-lg font-semibold transition-colors"
                  >
                    {vipLoading ? '⟳' : '🔄'} Refresh
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-[--card] p-4 rounded-lg border border-[--electric]/20">
                  <p className="text-sm text-white/50">Total Users</p>
                  <p className="text-2xl font-bold text-[--electric]">{vipUsers.length}</p>
                </div>
                <div className="bg-[--card] p-4 rounded-lg border border-[--neon-yellow]/20">
                  <p className="text-sm text-white/50">VIP Users</p>
                  <p className="text-2xl font-bold text-[--neon-yellow]">{vipCount}</p>
                </div>
                <div className="bg-[--card] p-4 rounded-lg border border-[--neon-pink]/20">
                  <p className="text-sm text-white/50">Basic Users</p>
                  <p className="text-2xl font-bold text-[--neon-pink]">{basicCount}</p>
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setVipFilter('all')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    vipFilter === 'all'
                      ? 'bg-[--electric]/15 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/5'
                  }`}
                >
                  All Users
                </button>
                <button
                  onClick={() => setVipFilter('vip')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    vipFilter === 'vip'
                      ? 'bg-[--neon-yellow]/15 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/5'
                  }`}
                >
                  VIP Only
                </button>
                <button
                  onClick={() => setVipFilter('basic')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    vipFilter === 'basic'
                      ? 'bg-[--neon-pink]/15 text-white'
                      : 'bg-white/5 text-white/60 hover:bg-white/5'
                  }`}
                >
                  Basic Only
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-[--card] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[--card]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Username</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Expires</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border]">
                    {filteredVipUsers.map((user) => (
                      <tr key={user.username} className="hover:bg-[--card]/50">
                        <td className="px-4 py-3 text-white font-medium">{user.username}</td>
                        <td className="px-4 py-3 text-white/50 text-sm">{user.email || 'N/A'}</td>
                        <td className="px-4 py-3">
                          {user.vip ? (
                             <span className="inline-block bg-[--neon-yellow]/15 border border-[--neon-yellow]/25 text-[--neon-yellow] px-3 py-1 rounded-full text-xs font-bold">
                              ⚡ VIP
                            </span>
                          ) : (
                            <span className="inline-block bg-[--neon-pink]/15 text-white px-3 py-1 rounded-full text-xs font-bold">
                              BASIC
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/50 text-sm">
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
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {!user.vip ? (
                              <>
                                <button
                                  onClick={() => handleGrantVip(user.username, 7)}
                                  className="px-2 py-1 bg-[--neon-yellow]/15 hover:bg-white/10 text-white text-xs rounded transition-colors"
                                  title="Grant 7 days"
                                >
                                  7d
                                </button>
                                <button
                                  onClick={() => handleGrantVip(user.username, 30)}
                                  className="px-2 py-1 bg-[--neon-yellow]/15 hover:bg-white/10 text-white text-xs rounded transition-colors"
                                  title="Grant 30 days"
                                >
                                  30d
                                </button>
                                <button
                                  onClick={() => handleGrantVip(user.username, 365)}
                                  className="px-2 py-1 bg-[--neon-yellow]/15 hover:bg-white/10 text-white text-xs rounded transition-colors"
                                  title="Grant 1 year"
                                >
                                  1yr
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleRevokeVip(user.username)}
                                className="px-3 py-1 bg-[--neon-red]/15 hover:bg-white/10 text-white text-xs rounded transition-colors"
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
                        <td colSpan={5} className="px-4 py-8 text-center text-white/50">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analytics Dashboard */}
            <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-[--electric]">📊 Analytics Dashboard</h2>
                
                {/* Period Selector */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setAnalyticsPeriod('24h')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      analyticsPeriod === '24h'
                        ? 'bg-[--electric]/15 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/5'
                    }`}
                  >
                    24 Hours
                  </button>
                  <button
                    onClick={() => setAnalyticsPeriod('7d')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      analyticsPeriod === '7d'
                        ? 'bg-[--electric]/15 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/5'
                    }`}
                  >
                    7 Days
                  </button>
                  <button
                    onClick={() => setAnalyticsPeriod('30d')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      analyticsPeriod === '30d'
                        ? 'bg-[--electric]/15 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/5'
                    }`}
                  >
                    30 Days
                  </button>
                  <button
                    onClick={loadAnalyticsData}
                    disabled={analyticsLoading}
                    className="px-4 py-2 rounded-lg font-semibold bg-white/5 text-white/60 hover:bg-white/5 disabled:opacity-50 transition-colors"
                  >
                    {analyticsLoading ? '⟳' : '🔄'} Refresh
                  </button>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Activity Timeline */}
                <div>
                  <h3 className="text-lg font-semibold text-white/60 mb-2">Player Activity Trends</h3>
                  <ActivityTimeline 
                    data={activityData}
                    period={analyticsPeriod}
                    loading={analyticsLoading}
                    error={analyticsError}
                  />
                </div>

                {/* Resource Gains */}
                <div>
                  <h3 className="text-lg font-semibold text-white/60 mb-2">Resource Accumulation</h3>
                  <ResourceGains 
                    data={resourceData}
                    period={analyticsPeriod}
                    loading={analyticsLoading}
                    error={analyticsError}
                  />
                </div>

                {/* Session Distribution */}
                <div>
                  <h3 className="text-lg font-semibold text-white/60 mb-2">Session Duration Distribution</h3>
                  <SessionDistribution 
                    buckets={sessionData?.buckets || []}
                    period={analyticsPeriod}
                    loading={analyticsLoading}
                    error={analyticsError}
                  />
                </div>

                {/* Flag Breakdown */}
                <div>
                  <h3 className="text-lg font-semibold text-white/60 mb-2">Anti-Cheat Flag Severity</h3>
                  <FlagBreakdown 
                    data={flagData}
                    totalFlagged={flagData.reduce((sum, f) => sum + f.count, 0)}
                    loading={analyticsLoading}
                    error={analyticsError}
                  />
                </div>

                {/* Bot Population */}
                <div className="col-span-2">
                  <h3 className="text-lg font-semibold text-white/60 mb-2">Bot Population by Specialization</h3>
                  <BotPopulationTrends 
                    currentStats={botStats}
                    loading={!botStats}
                    error={null}
                  />
                </div>
              </div>
            </div>

            {/* Database Tools */}
            <div className="bg-[--card] rounded-lg p-6 border-2 border-[--neon-pink]/20">
              <h2 className="text-2xl font-bold text-[--neon-pink] mb-4">🛠️ Database Tools</h2>
              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={async () => {
                    if (!confirm('Fix all player base tiles? This will convert base coordinates to Wasteland.')) return;
                    try {
                      const res = await fetch('/api/admin/fix-base', { method: 'POST' });
                      const data = await res.json();
                      alert(data.message || 'Base tiles fixed!');
                      window.location.reload();
                    } catch (error) {
                      alert('Failed to fix base tiles');
                    }
                  }}
                  className="bg-[--solar]/15 hover:bg-white/10 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                >
                  🏠 Fix Base Tiles
                </button>
                <button 
                  onClick={() => setShowTileInspector(true)}
                  className="bg-[--electric]/15 hover:bg-[--electric]/15 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                >
                  📊 View Tiles
                </button>
                <button className="bg-[--synth]/15 hover:bg-[--synth]/15 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                  onClick={() => setShowFactoryInspector(true)}
                >
                  🏭 Factory Inspector
                </button>
                <button className="bg-[--neon-yellow]/15 hover:bg-[--neon-yellow]/15 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                  onClick={() => setShowBattleLogs(true)}
                >
                  📝 Battle Logs
                </button>
                <button className="bg-[--neon-pink]/15 hover:bg-[--neon-pink]/15 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                  onClick={() => setShowAchievementStats(true)}
                >
                  🎯 Achievement Stats
                </button>
                <button className="bg-[--neon-red]/15 hover:bg-[--neon-red]/15 text-white px-6 py-4 rounded-lg font-semibold transition-colors"
                  onClick={() => setShowSystemReset(true)}
                >
                  🔄 Reset Systems
                </button>
              </div>
            </div>

            {/* Bot System Controls */}
            <div className="bg-[--card] rounded-lg p-6 border-2 border-[--electric]/20">
              <h2 className="text-2xl font-bold text-[--electric] mb-4">🤖 Bot Ecosystem Controls</h2>
              
              <div className="space-y-6">
                {/* Bot Statistics */}
                <div className="bg-[--card] rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-[--electric] mb-3">Bot Population</h3>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="bg-[--card] p-3 rounded text-center">
                      <p className="text-xs text-white/50">Total Bots</p>
                      <p className="text-2xl font-bold text-[--electric]">{botStats?.totalBots || 0}</p>
                    </div>
                    <div className="bg-[--card] p-3 rounded text-center">
                      <p className="text-xs text-white/50">Hoarders</p>
                      <p className="text-2xl font-bold text-[--neon-yellow]">{botStats?.bySpecialization?.hoarder || 0}</p>
                    </div>
                    <div className="bg-[--card] p-3 rounded text-center">
                      <p className="text-xs text-white/50">Fortresses</p>
                      <p className="text-2xl font-bold text-[--electric]">{botStats?.bySpecialization?.fortress || 0}</p>
                    </div>
                    <div className="bg-[--card] p-3 rounded text-center">
                      <p className="text-xs text-white/50">Raiders</p>
                      <p className="text-2xl font-bold text-[--neon-red]">{botStats?.bySpecialization?.raider || 0}</p>
                    </div>
                    <div className="bg-[--card] p-3 rounded text-center">
                      <p className="text-xs text-white/50">Ghosts</p>
                      <p className="text-2xl font-bold text-[--neon-pink]">{botStats?.bySpecialization?.ghost || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-[--card] rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-[--electric] mb-3">Quick Actions</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={handleSpawn10Bots}
                      disabled={botActionLoading}
                      className="bg-[--synth]/15 hover:bg-[--synth]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm"
                    >
                      ➕ Spawn 10 Bots
                    </button>
                    <button 
                      onClick={handleRunRegen}
                      disabled={botActionLoading}
                      className="bg-[--electric]/15 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm"
                    >
                      🔄 Run Regen Cycle
                    </button>
                    <button 
                      onClick={handleBotAnalytics}
                      disabled={botActionLoading}
                      className="bg-[--neon-pink]/15 hover:bg-[--neon-pink]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm"
                    >
                      📊 Bot Analytics
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-3 mt-3">
                    <button 
                      onClick={() => setShowWebSocketConsole(true)}
                      className="bg-[--electric]/15 hover:bg-white/10 text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm"
                    >
                      🔌 WebSocket Console
                    </button>
                    <button 
                      onClick={() => setShowTileInspector(true)}
                      className="bg-white/5 hover:bg-white/5 text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm"
                    >
                      🗺️ Tile Inspector
                    </button>
                    <button 
                      onClick={() => setShowFactoryInspector(true)}
                      className="bg-white/5 hover:bg-white/5 text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm"
                    >
                      🏭 Factory Inspector
                    </button>
                    <button 
                      onClick={() => setShowHotkeyManager(true)}
                      className="bg-[--electric]/15 hover:bg-[--electric]/15 text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm"
                    >
                      ⌨️ Hotkey Manager
                    </button>
                    <button 
                      onClick={() => setShowSystemReset(true)}
                      className="bg-[--neon-red]/15 hover:bg-[--neon-red]/15 text-white px-4 py-3 rounded-lg font-semibold transition-colors text-sm"
                    >
                      ⚠️ System Reset
                    </button>
                  </div>
                </div>

                {/* System Configuration */}
                <div className="bg-[--card] rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-[--electric] mb-3">System Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Total Bot Cap</label>
                      <input 
                        type="number" 
                        value={botConfig.totalBotCap}
                        onChange={(e) => setBotConfig({...botConfig, totalBotCap: parseInt(e.target.value) || 0})}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Daily Spawn Count</label>
                      <input 
                        type="number" 
                        value={botConfig.dailySpawnCount}
                        onChange={(e) => setBotConfig({...botConfig, dailySpawnCount: parseInt(e.target.value) || 0})}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Migration % (0-100)</label>
                      <input 
                        type="number" 
                        step="1"
                        value={Math.round(botConfig.migrationPercent * 100)}
                        onChange={(e) => setBotConfig({...botConfig, migrationPercent: (parseInt(e.target.value) || 0) / 100})}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveConfig}
                    disabled={botActionLoading}
                    className="mt-4 bg-[--electric]/15 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-colors w-full"
                  >
                    💾 Save Configuration
                  </button>
                </div>

                {/* Resource Regeneration Rates */}
                <div className="bg-[--card] rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-[--electric] mb-3">Regeneration Rates (% per hour)</h3>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs text-[--neon-yellow]">Hoarder</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.hoarder}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, hoarder: parseFloat(e.target.value) || 0}
                        })}
                        className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[--electric]">Fortress</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.fortress}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, fortress: parseFloat(e.target.value) || 0}
                        })}
                        className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[--neon-red]">Raider</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.raider}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, raider: parseFloat(e.target.value) || 0}
                        })}
                        className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[--neon-pink]">Ghost</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.ghost}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, ghost: parseFloat(e.target.value) || 0}
                        })}
                        className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[--synth]">Balanced</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={botConfig.regenRates.balanced}
                        onChange={(e) => setBotConfig({
                          ...botConfig, 
                          regenRates: {...botConfig.regenRates, balanced: parseFloat(e.target.value) || 0}
                        })}
                        className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Beer Base Smart Spawning */}
                <div className="bg-[--card] rounded-lg p-4 border-2 border-[--neon-yellow]/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-[--neon-yellow] flex items-center gap-2">
                      <span>🍺</span>
                      <span>Beer Base Smart Spawning</span>
                      <span className="text-xs bg-[--synth]/15 px-2 py-1 rounded">AUTO</span>
                    </h3>
                    <div className="text-xs text-white/50">
                      Current: {botStats?.beerBases || 0} active
                    </div>
                  </div>
                  
                  <div className="bg-[--neon-yellow]/5 border border-[--neon-yellow]/20 rounded p-3 mb-4">
                    <p className="text-xs text-[--neon-yellow]">
                      🤖 <strong>Smart System Active:</strong> Beer Bases automatically spawn based on player levels. 
                      System analyzes active players and spawns appropriate difficulty targets.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-white/50 flex items-center gap-2">
                        Enable System
                        <span className="text-xs text-white/40">(Master switch)</span>
                      </label>
                      <select 
                        value={beerBaseConfig.enabled ? 'true' : 'false'}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, enabled: e.target.value === 'true'})}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      >
                        <option value="true">✅ Enabled</option>
                        <option value="false">❌ Disabled</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50 flex items-center gap-2">
                        Spawn Rate Min %
                        <span className="text-xs text-white/40">(of bots)</span>
                      </label>
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={beerBaseConfig.spawnRateMin}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, spawnRateMin: parseInt(e.target.value) || 0})}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50 flex items-center gap-2">
                        Spawn Rate Max %
                        <span className="text-xs text-white/40">(of bots)</span>
                      </label>
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={beerBaseConfig.spawnRateMax}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, spawnRateMax: parseInt(e.target.value) || 0})}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50 flex items-center gap-2">
                        Resource Multiplier
                        <span className="text-xs text-white/40">(1-20x)</span>
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="20"
                        value={beerBaseConfig.resourceMultiplier}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, resourceMultiplier: parseInt(e.target.value) || 1})}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Weekly Respawn Day</label>
                      <select 
                        value={beerBaseConfig.respawnDay}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, respawnDay: parseInt(e.target.value)})}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
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
                      <label className="text-sm text-white/50">Respawn Hour (0-23)</label>
                      <input 
                        type="number"
                        min="0"
                        max="23"
                        value={beerBaseConfig.respawnHour}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, respawnHour: parseInt(e.target.value) || 0})}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  {/* Variety Enforcement Settings (FID-20251025-001) */}
                  <div className="mt-4 bg-[--neon-yellow]/5 border border-[--neon-yellow]/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-[--neon-yellow] flex items-center gap-2">
                        🎨 Variety Enforcement
                        <span className="text-xs text-white/50">(Prevents homogeneous spawns)</span>
                      </h4>
                      <select 
                        value={beerBaseConfig.varietyEnabled ? 'true' : 'false'}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, varietyEnabled: e.target.value === 'true'})}
                        className="bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-xs"
                      >
                        <option value="true">✅ Enabled</option>
                        <option value="false">❌ Disabled</option>
                      </select>
                    </div>
                    
                    {beerBaseConfig.varietyEnabled && (
                      <>
                        <p className="text-xs text-white/50 mb-3">
                          Ensures minimum variety across all power tiers even when player base is homogeneous. 
                          Example: If all players are Level 15, variety prevents 100% Mid-tier spawns.
                        </p>
                        
                        <div className="grid grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-white/50">Min WEAK %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.minWeakPercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, minWeakPercent: parseInt(e.target.value) || 0})}
                              className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-white/50">Min MEDIUM %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.minMediumPercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, minMediumPercent: parseInt(e.target.value) || 0})}
                              className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-white/50">Min STRONG %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.minStrongPercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, minStrongPercent: parseInt(e.target.value) || 0})}
                              className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-white/50">Min ELITE %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.minElitePercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, minElitePercent: parseInt(e.target.value) || 0})}
                              className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-white/50">Max Same Tier %</label>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={beerBaseConfig.maxSameTierPercent}
                              onChange={(e) => setBeerBaseConfig({...beerBaseConfig, maxSameTierPercent: parseInt(e.target.value) || 0})}
                              className="w-full bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-2 text-xs text-white/40">
                          <strong>Current totals:</strong> Min {beerBaseConfig.minWeakPercent + beerBaseConfig.minMediumPercent + beerBaseConfig.minStrongPercent + beerBaseConfig.minElitePercent}% guaranteed variety
                        </div>
                      </>
                    )}
                  </div>

                  {/* Dynamic Schedules (FID-20251025-003) */}
                  <div className="mt-4 bg-[--electric]/5 border border-[--electric]/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-[--electric] flex items-center gap-2">
                        📅 Dynamic Respawn Schedules
                        <span className="text-xs text-white/50">(Multiple respawn times)</span>
                      </h4>
                      <select 
                        value={beerBaseConfig.schedulesEnabled ? 'true' : 'false'}
                        onChange={(e) => setBeerBaseConfig({...beerBaseConfig, schedulesEnabled: e.target.value === 'true'})}
                        className="bg-[--card] border border-[--border] rounded px-2 py-1 text-white text-xs"
                      >
                        <option value="false">🕐 Legacy Single Schedule</option>
                        <option value="true">✅ Dynamic Schedules</option>
                      </select>
                    </div>
                    
                    {beerBaseConfig.schedulesEnabled ? (
                      <>
                        <p className="text-xs text-white/50 mb-3">
                          Configure multiple respawn times per week with timezone support. Schedules can overlap (combine percentages).
                        </p>
                        
                        {/* Schedule List */}
                        {schedulesLoading ? (
                          <div className="text-center py-4 text-white/50">Loading schedules...</div>
                        ) : schedules.length === 0 ? (
                          <div className="bg-[--card] rounded p-3 text-center text-white/50 text-sm">
                            No schedules configured. Click "Add Schedule" to create one.
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
                                  className={`bg-[--card] rounded p-2 flex items-center justify-between ${!schedule.enabled ? 'opacity-50' : ''}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => handleToggleSchedule(schedule)}
                                      className={`w-12 h-6 rounded-full transition-colors ${schedule.enabled ? 'bg-[--synth]/15' : 'bg-white/5'}`}
                                    >
                                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${schedule.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                    </button>
                                    <div className="flex-1">
                                      <div className="text-sm text-white font-medium">
                                        {schedule.name || `Schedule ${days[schedule.dayOfWeek]} ${hourStr}`}
                                      </div>
                                      <div className="text-xs text-white/50">
                                        {days[schedule.dayOfWeek]} at {hourStr} {tzShort} • {schedule.spawnPercentage}% spawn
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditSchedule(schedule)}
                                      className="px-3 py-1 bg-[--electric]/15 hover:bg-[--electric]/15 text-white text-xs rounded"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSchedule(schedule.id)}
                                      className="px-3 py-1 bg-[--neon-red]/15 hover:bg-[--neon-red]/15 text-white text-xs rounded"
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
                          className="mt-3 w-full bg-[--electric]/15 hover:bg-[--electric]/15 text-white px-4 py-2 rounded text-sm font-semibold"
                        >
                          ➕ Add Schedule
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-white/50">
                        Using legacy single schedule: {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][beerBaseConfig.respawnDay]} at {beerBaseConfig.respawnHour.toString().padStart(2, '0')}:00
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button 
                      onClick={handleSaveBeerBaseConfig}
                      disabled={beerBaseLoading}
                      className="bg-[--neon-yellow]/15 hover:bg-[--neon-yellow]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      💾 Save Beer Base Config
                    </button>
                    <button 
                      onClick={handleRespawnBeerBases}
                      disabled={beerBaseLoading}
                      className="bg-[--solar]/15 hover:bg-white/10 disabled:bg-white/5 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      🍺 Manual Respawn Now
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-white/50 bg-[--card] rounded p-2">
                    <strong>How it works:</strong> System checks active players (last 7 days), analyzes their levels, 
                    and spawns Beer Bases with appropriate power tiers. Distribution: 40% same tier, 30% one up, 10% one down, 20% two up.
                  </div>
                </div>

                {/* Beer Base Analytics Dashboard (FID-20251025-004) */}
                <div className="mt-4 bg-[--electric]/5 border border-[--electric]/20 rounded-lg">
                  <button
                    onClick={() => {
                      setBeerAnalyticsExpanded(!beerAnalyticsExpanded);
                      if (!beerAnalyticsExpanded && !beerSpawnStats) {
                        loadBeerBaseAnalytics();
                      }
                    }}
                    className="w-full p-3 text-left hover:bg-[--electric]/5 transition-colors flex items-center justify-between rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-[--electric]">
                        📊 Beer Base Analytics Dashboard
                      </h4>
                      <span className="text-xs text-white/50">(365-day retention)</span>
                    </div>
                    <span className="text-2xl text-[--electric]">{beerAnalyticsExpanded ? '▼' : '▶'}</span>
                  </button>
                  
                  {beerAnalyticsExpanded && (
                    <div className="p-4 pt-0 space-y-4">
                      {/* Period Selector & Actions */}
                      <div className="flex items-center justify-between bg-[--card] rounded-lg p-3">
                        <div className="flex gap-2">
                          {(['7d', '14d', '30d', '90d', '365d'] as const).map((period) => (
                            <button
                              key={period}
                              onClick={() => setBeerAnalyticsPeriod(period)}
                              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                                beerAnalyticsPeriod === period
                                  ? 'bg-[--electric]/15 text-white'
                                  : 'bg-white/5 text-white/60 hover:bg-white/5'
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
                            className="px-3 py-1 bg-white/5 hover:bg-white/5 disabled:bg-white/5 text-white rounded text-xs font-semibold transition-colors"
                          >
                            {beerAnalyticsLoading ? '⟳' : '🔄'} Refresh
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
                            className="px-3 py-1 bg-[--synth]/15 hover:bg-[--synth]/15 text-white rounded text-xs font-semibold transition-colors"
                          >
                            📥 Export CSV
                          </button>
                        </div>
                      </div>

                      {beerAnalyticsLoading && !beerSpawnStats ? (
                        <div className="text-center py-8 text-white/50">Loading analytics...</div>
                      ) : beerAnalyticsError ? (
                        <div className="bg-[--neon-red]/5 border border-[--neon-red]/20 rounded p-4 text-[--neon-red]">
                          ❌ Error: {beerAnalyticsError}
                        </div>
                      ) : (
                        <>
                          {/* Quick Stats Cards */}
                          <div className="grid grid-cols-4 gap-3">
                            <div className="bg-[--card] rounded-lg p-3 border border-[--electric]/20">
                              <div className="text-xs text-white/50 mb-1">Total Spawns</div>
                              <div className="text-2xl font-bold text-[--electric]">
                                {beerSpawnStats?.dailySpawns?.reduce((sum: number, d: any) => sum + d.count, 0) || 0}
                              </div>
                              <div className="text-xs text-white/40">
                                Avg: {beerSpawnStats?.averagePerDay?.toFixed(1) || '0'}/day
                              </div>
                            </div>
                            <div className="bg-[--card] rounded-lg p-3 border border-[--neon-red]/20">
                              <div className="text-xs text-white/50 mb-1">Total Defeats</div>
                              <div className="text-2xl font-bold text-[--neon-red]">
                                {beerDefeatStats?.dailyDefeats?.reduce((sum: number, d: any) => sum + d.count, 0) || 0}
                              </div>
                              <div className="text-xs text-white/40">
                                Avg: {beerDefeatStats?.averagePerDay?.toFixed(1) || '0'}/day
                              </div>
                            </div>
                            <div className="bg-[--card] rounded-lg p-3 border border-[--neon-yellow]/20">
                              <div className="text-xs text-white/50 mb-1">Defeat Rate</div>
                              <div className="text-2xl font-bold text-[--neon-yellow]">
                                {beerEffectivenessStats?.defeatRate 
                                  ? `${(beerEffectivenessStats.defeatRate * 100).toFixed(1)}%`
                                  : '0%'}
                              </div>
                              <div className="text-xs text-white/40">
                                Engagement Score: {beerEffectivenessStats?.engagementScore?.toFixed(2) || '0'}
                              </div>
                            </div>
                            <div className="bg-[--card] rounded-lg p-3 border border-[--neon-pink]/20">
                              <div className="text-xs text-white/50 mb-1">Avg Lifespan</div>
                              <div className="text-2xl font-bold text-[--neon-pink]">
                                {beerEffectivenessStats?.avgLifespanByTier?.[0]?.avgLifespanHours
                                  ? `${(beerEffectivenessStats.avgLifespanByTier.reduce((sum: number, t: any) => sum + (t.avgLifespanHours || 0), 0) / beerEffectivenessStats.avgLifespanByTier.length).toFixed(1)}h`
                                  : '0h'}
                              </div>
                              <div className="text-xs text-white/40">All tiers combined</div>
                            </div>
                          </div>

                          {/* Tier Distribution */}
                          <div className="bg-[--card] rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-[--electric] mb-3">🎯 Spawn Distribution by Tier</h5>
                            <div className="space-y-2">
                              {beerSpawnStats?.tierDistribution?.map((tier: any) => {
                                const percentage = (tier.count / (beerSpawnStats?.dailySpawns?.reduce((sum: number, d: any) => sum + d.count, 0) || 1)) * 100;
                                const tierNames = ['WEAK', 'MEDIUM', 'STRONG', 'ELITE', 'ULTRA', 'LEGENDARY'];
                                const tierColors = ['bg-[--synth]/15', 'bg-[--electric]/15', 'bg-[--neon-pink]/15', 'bg-[--solar]/15', 'bg-[--neon-red]/15', 'bg-[--neon-pink]/15'];
                                
                                return (
                                  <div key={tier.tier} className="flex items-center gap-3">
                                    <div className="w-24 text-xs text-white/50">{tierNames[tier.tier]}</div>
                                    <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
                                      <div 
                                        className={`${tierColors[tier.tier]} h-full flex items-center justify-center text-xs font-bold text-white transition-all`}
                                        style={{ width: `${percentage}%` }}
                                      >
                                        {percentage >= 10 && `${percentage.toFixed(1)}%`}
                                      </div>
                                    </div>
                                    <div className="w-16 text-right text-sm font-bold text-white">{tier.count}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Defeat Stats by Tier */}
                          <div className="bg-[--card] rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-[--neon-red] mb-3">⚔️ Defeats by Tier</h5>
                            <div className="space-y-2">
                              {beerDefeatStats?.defeatsByTier?.map((tier: any) => {
                                const tierNames = ['WEAK', 'MEDIUM', 'STRONG', 'ELITE', 'ULTRA', 'LEGENDARY'];
                                const tierColors = ['text-[--synth]', 'text-[--electric]', 'text-[--neon-pink]', 'text-[--solar]', 'text-[--neon-red]', 'text-[--neon-pink]'];
                                
                                return (
                                  <div key={tier.tier} className="flex items-center justify-between bg-white/5/50 rounded px-3 py-2">
                                    <span className={`text-sm font-semibold ${tierColors[tier.tier]}`}>
                                      {tierNames[tier.tier]}
                                    </span>
                                    <span className="text-sm text-white font-bold">{tier.count} defeats</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Top Players */}
                          <div className="bg-[--card] rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-[--neon-yellow] mb-3">🏆 Top Beer Base Hunters</h5>
                            <div className="space-y-2">
                              {beerDefeatStats?.topPlayers?.slice(0, 10).map((player: any, index: number) => (
                                <div key={player.username} className="flex items-center justify-between bg-white/5/50 rounded px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">
                                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                    </span>
                                    <span className="text-sm font-semibold text-white">{player.username}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs">
                                    <span className="text-[--neon-red]">
                                      {player.totalDefeats} defeats
                                    </span>
                                    <span className="text-[--electric]">
                                      {player.totalRewards.metal.toLocaleString()} 🔩
                                    </span>
                                    <span className="text-[--neon-yellow]">
                                      {player.totalRewards.energy.toLocaleString()} ⚡
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Effectiveness Metrics */}
                          <div className="bg-[--card] rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-[--neon-pink] mb-3">📈 Effectiveness Metrics</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-white/50 mb-2">Average Lifespan by Tier</div>
                                <div className="space-y-1">
                                  {beerEffectivenessStats?.avgLifespanByTier?.map((tier: any) => {
                                    const tierNames = ['WEAK', 'MEDIUM', 'STRONG', 'ELITE', 'ULTRA', 'LEGENDARY'];
                                    return (
                                      <div key={tier.tier} className="flex justify-between text-xs">
                                        <span className="text-white/50">{tierNames[tier.tier]}:</span>
                                        <span className="text-white font-semibold">
                                          {tier.avgLifespanHours?.toFixed(1) || '0'}h
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-white/50 mb-2">Peak Activity Hours (UTC)</div>
                                <div className="space-y-1">
                                  {beerEffectivenessStats?.peakHours?.slice(0, 3).map((peak: any, index: number) => (
                                    <div key={peak.hour} className="flex justify-between text-xs">
                                      <span className="text-white/50">
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {peak.hour.toString().padStart(2, '0')}:00
                                      </span>
                                      <span className="text-white font-semibold">{peak.count} defeats</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Spawn Sources */}
                          {beerSpawnStats?.spawnSources && (
                            <div className="bg-[--card] rounded-lg p-4">
                              <h5 className="text-sm font-semibold text-[--synth] mb-3">🎲 Spawn Sources</h5>
                              <div className="flex gap-4">
                                {beerSpawnStats.spawnSources.map((source: any) => (
                                  <div key={source.source} className="flex-1 bg-white/5/50 rounded p-3 text-center">
                                    <div className="text-xs text-white/50 mb-1">
                                      {source.source === 'auto' ? 'Automatic' : 'Manual'}
                                    </div>
                                    <div className="text-xl font-bold text-[--synth]">{source.count}</div>
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
                <div className="mt-4 bg-[--synth]/5 border border-[--synth]/20 rounded-lg">
                  <button
                    onClick={() => {
                      const expanded = !(beerBaseConfig as any).predictiveExpanded;
                      setBeerBaseConfig({ ...beerBaseConfig, predictiveExpanded: expanded } as any);
                    }}
                    className="w-full p-3 text-left hover:bg-[--synth]/5 transition-colors flex items-center justify-between rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-[--synth]">
                        🔮 Predictive Spawning
                      </h4>
                      <span className="text-xs text-white/50">(Historical data forecasting)</span>
                    </div>
                    <span className="text-2xl text-[--synth]">{(beerBaseConfig as any).predictiveExpanded ? '▼' : '▶'}</span>
                  </button>
                  
                  {(beerBaseConfig as any).predictiveExpanded && (
                    <div className="p-4 pt-0 space-y-4">
                      <p className="text-xs text-white/50">
                        🧠 <strong>AI-Powered Forecasting:</strong> Uses 365-day player history with linear regression to predict 
                        future player levels. Spawns appropriate tiers <em>ahead</em> of progression curve.
                      </p>
                      
                      {/* Mode Toggle */}
                      <div className="bg-[--card] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-semibold text-[--synth]">Predictive Mode</label>
                          <select 
                            value={(beerBaseConfig as any).usePredictiveSpawning ? 'true' : 'false'}
                            onChange={(e) => setBeerBaseConfig({
                              ...beerBaseConfig, 
                              usePredictiveSpawning: e.target.value === 'true'
                            } as any)}
                            className="bg-white/5 border border-[--border] rounded px-3 py-2 text-white text-sm"
                          >
                            <option value="false">📊 Current Player Levels</option>
                            <option value="true">🔮 Predictive (Forecast)</option>
                          </select>
                        </div>
                        
                        {(beerBaseConfig as any).usePredictiveSpawning && (
                          <div className="space-y-2">
                            <label className="text-xs text-white/50">Prediction Horizon (weeks ahead)</label>
                            <input 
                              type="number"
                              min="1"
                              max="12"
                              value={(beerBaseConfig as any).predictiveWeeksAhead || 2}
                              onChange={(e) => setBeerBaseConfig({
                                ...beerBaseConfig,
                                predictiveWeeksAhead: parseInt(e.target.value) || 2
                              } as any)}
                              className="w-full bg-white/5 border border-[--border] rounded px-3 py-2 text-white text-sm"
                            />
                            <p className="text-xs text-white/40">
                              Default: 2 weeks. Higher values = spawns more challenging ahead of current playerbase
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Current Mode Indicator */}
                      <div className={`rounded-lg p-3 border-2 ${
                        (beerBaseConfig as any).usePredictiveSpawning 
                          ? 'bg-[--synth]/5 border-[--synth]/20' 
                          : 'bg-[--electric]/5 border-[--electric]/20'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{(beerBaseConfig as any).usePredictiveSpawning ? '🔮' : '📊'}</span>
                          <div>
                            <div className="text-sm font-bold text-white">
                              {(beerBaseConfig as any).usePredictiveSpawning ? 'PREDICTIVE MODE ACTIVE' : 'CURRENT MODE ACTIVE'}
                            </div>
                            <div className="text-xs text-white/50">
                              {(beerBaseConfig as any).usePredictiveSpawning 
                                ? `Spawning based on projected levels ${(beerBaseConfig as any).predictiveWeeksAhead || 2} weeks ahead`
                                : 'Spawning based on current player levels (last 7 days activity)'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Distribution Comparison */}
                      <div className="bg-[--card] rounded-lg p-4">
                        <h5 className="text-sm font-semibold text-[--synth] mb-3">📊 Distribution Comparison</h5>
                        <p className="text-xs text-white/50 mb-3">
                          Compare current vs predicted tier distributions. Predictive mode helps maintain challenge as players progress.
                        </p>
                        
                        <div className="grid grid-cols-6 gap-2 text-xs">
                          <div className="text-center text-white/50 font-semibold">Tier</div>
                          <div className="text-center text-white/50 font-semibold">WEAK</div>
                          <div className="text-center text-white/50 font-semibold">MID</div>
                          <div className="text-center text-white/50 font-semibold">STRONG</div>
                          <div className="text-center text-white/50 font-semibold">ELITE</div>
                          <div className="text-center text-white/50 font-semibold">ULTRA</div>
                          
                          {/* Current Distribution Row */}
                          <div className="text-left text-[--electric] font-semibold">Current</div>
                          {[0, 1, 2, 3, 4].map((tier) => (
                            <div key={`current-${tier}`} className="bg-[--electric]/5 rounded p-1 text-center text-white">
                              —%
                            </div>
                          ))}
                          
                          {/* Predicted Distribution Row */}
                          <div className="text-left text-[--synth] font-semibold">Predicted</div>
                          {[0, 1, 2, 3, 4].map((tier) => (
                            <div key={`predicted-${tier}`} className="bg-[--synth]/5 rounded p-1 text-center text-white">
                              —%
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-3 text-xs text-white/40">
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
                                  weeksAhead: (beerBaseConfig as any).predictiveWeeksAhead || 2
                                })
                              });
                              const data = await res.json();
                              if (data.success) {
                                alert(`✅ Predictions recalculated!\n\nProjected ${data.playerCount} players over ${data.weeksAhead} weeks.\nNew distribution: ${JSON.stringify(data.distribution, null, 2)}`);
                              } else {
                                alert(`❌ Error: ${data.error}`);
                              }
                            } catch (err) {
                              console.error('Recalculation error:', err);
                              alert('Failed to recalculate predictions');
                            } finally {
                              setBeerBaseLoading(false);
                            }
                          }}
                          disabled={beerBaseLoading}
                          className="flex-1 bg-[--synth]/15 hover:bg-[--synth]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-semibold text-sm transition-colors"
                        >
                          {beerBaseLoading ? '⏳ Calculating...' : '🔄 Recalculate Predictions'}
                        </button>
                        <button
                          onClick={() => {
                            alert('🔮 Predictive Spawning Details:\n\n' +
                              '1. ALGORITHM: Linear regression on 365 days of player snapshots\n' +
                              '2. PROJECTION: Forecasts player levels N weeks ahead\n' +
                              '3. TIER MAPPING: Projected levels → Power tier distribution\n' +
                              '4. VARIETY: Still enforces min/max tier percentages\n' +
                              '5. FALLBACK: Reverts to current distribution if prediction fails\n\n' +
                              'Use Case: Prevent "too easy" spawns as playerbase advances rapidly'
                            );
                          }}
                          className="px-4 py-2 bg-white/5 hover:bg-white/5 text-white rounded font-semibold text-sm transition-colors"
                        >
                          ℹ️ How It Works
                        </button>
                      </div>

                      {/* Implementation Status */}
                      <div className="bg-[--neon-yellow]/5 border border-[--neon-yellow]/20 rounded p-3">
                        <div className="flex items-start gap-2">
                          <span className="text-lg">⚠️</span>
                          <div className="text-xs text-[--neon-yellow]">
                            <strong>Implementation Status:</strong> Backend integration complete. 
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
                <div className="bg-[--card] rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-[--electric] mb-3">Tech System Costs & Cooldowns</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Bot Magnet Cost (Metal)</label>
                      <input 
                        type="number" 
                        defaultValue={10000}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Magnet Cooldown (hours)</label>
                      <input 
                        type="number" 
                        defaultValue={336}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Summoning Cost (Metal)</label>
                      <input 
                        type="number" 
                        defaultValue={25000}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Summoning Cost (Energy)</label>
                      <input 
                        type="number" 
                        defaultValue={25000}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Phase-Out System */}
                <div className="bg-[--card] rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-[--electric] mb-3">Phase-Out System</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Enabled</label>
                      <select className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white">
                        <option value="false">Disabled</option>
                        <option value="true">Enabled</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">1 Bot per X Players</label>
                      <input 
                        type="number" 
                        defaultValue={10}
                        className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Priority</label>
                      <select className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white">
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
            <div className="bg-[--card] rounded-lg p-6 border-2 border-[--neon-pink]/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-[--neon-pink]">☢️ WMD System Oversight</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/50">Time Range:</span>
                  <select 
                    value={wmdTimeRange}
                    onChange={(e) => setWmdTimeRange(e.target.value as '7d' | '30d' | '90d')}
                    className="bg-white/5 border border-[--border] rounded px-3 py-1 text-white text-sm"
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
                  <div className="bg-[--card] rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-[--neon-pink] mb-3">System Health</h3>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-[--card] p-3 rounded text-center">
                        <p className="text-xs text-white/50">Active Operations</p>
                        <p className="text-2xl font-bold text-[--neon-pink]">
                          {wmdStatus.activeOperations?.missiles || 0}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Missiles</p>
                      </div>
                      <div className="bg-[--card] p-3 rounded text-center">
                        <p className="text-xs text-white/50">Active Votes</p>
                        <p className="text-2xl font-bold text-[--neon-yellow]">
                          {wmdStatus.activeOperations?.votes || 0}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Pending</p>
                      </div>
                      <div className="bg-[--card] p-3 rounded text-center">
                        <p className="text-xs text-white/50">Scheduled Jobs</p>
                        <p className="text-2xl font-bold text-[--electric]">
                          {wmdStatus.jobs?.scheduled || 0}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Queue</p>
                      </div>
                      <div className="bg-[--card] p-3 rounded text-center">
                        <p className="text-xs text-white/50">System Alerts</p>
                        <p className={`text-2xl font-bold ${(wmdStatus.alerts?.length || 0) > 0 ? 'text-[--neon-red]' : 'text-[--synth]'}`}>
                          {wmdStatus.alerts?.length || 0}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Active</p>
                      </div>
                    </div>

                    {/* Active Alerts */}
                    {wmdStatus.alerts && wmdStatus.alerts.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-sm font-semibold text-[--neon-red]">⚠️ Active Alerts</h4>
                        {wmdStatus.alerts.map((alert: any, idx: number) => (
                          <div key={idx} className="bg-[--neon-red]/5 border border-[--neon-red]/20 rounded p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-semibold text-[--neon-red]">{alert.type}</p>
                                <p className="text-xs text-white/50 mt-1">{alert.message}</p>
                                <p className="text-xs text-white/40 mt-1">
                                  {alert.playerId && `Player: ${alert.playerId}`}
                                  {alert.clanId && ` | Clan: ${alert.clanId}`}
                                </p>
                              </div>
                              <span className="text-xs text-white/50">
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
                  <div className="bg-[--card] rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-[--neon-pink] mb-3">Analytics Summary</h3>
                    
                    {/* Missile Statistics */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-[--solar] mb-2">🚀 Missile Operations</h4>
                      <div className="grid grid-cols-5 gap-3">
                        <div className="bg-[--card] p-2 rounded text-center">
                          <p className="text-xs text-white/50">Total Launched</p>
                          <p className="text-xl font-bold text-[--solar]">
                            {wmdAnalytics.missiles?.total || 0}
                          </p>
                        </div>
                        <div className="bg-[--card] p-2 rounded text-center">
                          <p className="text-xs text-white/50">Intercepted</p>
                          <p className="text-xl font-bold text-[--electric]">
                            {wmdAnalytics.missiles?.intercepted || 0}
                          </p>
                        </div>
                        <div className="bg-[--card] p-2 rounded text-center">
                          <p className="text-xs text-white/50">Hit Targets</p>
                          <p className="text-xl font-bold text-[--neon-red]">
                            {wmdAnalytics.missiles?.hit || 0}
                          </p>
                        </div>
                        <div className="bg-[--card] p-2 rounded text-center">
                          <p className="text-xs text-white/50">Success Rate</p>
                          <p className="text-xl font-bold text-[--synth]">
                            {wmdAnalytics.missiles?.successRate ? 
                              `${(wmdAnalytics.missiles.successRate * 100).toFixed(1)}%` : '0%'}
                          </p>
                        </div>
                        <div className="bg-[--card] p-2 rounded text-center">
                          <p className="text-xs text-white/50">Avg Damage</p>
                          <p className="text-xl font-bold text-[--neon-yellow]">
                            {wmdAnalytics.missiles?.avgDamage ? 
                              Math.round(wmdAnalytics.missiles.avgDamage).toLocaleString() : '0'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Voting Statistics */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-[--neon-yellow] mb-2">🗳️ Voting Patterns</h4>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-[--card] p-2 rounded text-center">
                          <p className="text-xs text-white/50">Total Votes</p>
                          <p className="text-xl font-bold text-[--neon-yellow]">
                            {wmdAnalytics.votes?.total || 0}
                          </p>
                        </div>
                        <div className="bg-[--card] p-2 rounded text-center">
                          <p className="text-xs text-white/50">Passed</p>
                          <p className="text-xl font-bold text-[--synth]">
                            {wmdAnalytics.votes?.passed || 0}
                          </p>
                        </div>
                        <div className="bg-[--card] p-2 rounded text-center">
                          <p className="text-xs text-white/50">Failed</p>
                          <p className="text-xl font-bold text-[--neon-red]">
                            {wmdAnalytics.votes?.failed || 0}
                          </p>
                        </div>
                        <div className="bg-[--card] p-2 rounded text-center">
                          <p className="text-xs text-white/50">Approval Rate</p>
                          <p className="text-xl font-bold text-[--neon-pink]">
                            {wmdAnalytics.votes?.approvalRate ? 
                              `${(wmdAnalytics.votes.approvalRate * 100).toFixed(1)}%` : '0%'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Defense & Economic Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-[--electric] mb-2">🛡️ Defense Operations</h4>
                        <div className="bg-[--card] p-3 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-white/50">Research Attempts</span>
                            <span className="text-sm font-bold text-[--electric]">
                              {wmdAnalytics.defense?.researchAttempts || 0}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-white/50">Successful Research</span>
                            <span className="text-sm font-bold text-[--synth]">
                              {wmdAnalytics.defense?.researchSuccesses || 0}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-white/50">Active Spy Ops</span>
                            <span className="text-sm font-bold text-[--neon-pink]">
                              {wmdAnalytics.defense?.activeSpyOps || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-[--synth] mb-2">💰 Economic Impact</h4>
                        <div className="bg-[--card] p-3 rounded">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-white/50">Total Spent</span>
                            <span className="text-sm font-bold text-[--neon-red]">
                              {wmdAnalytics.economy?.totalSpent ? 
                                Math.round(wmdAnalytics.economy.totalSpent).toLocaleString() : '0'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-white/50">Avg Per Operation</span>
                            <span className="text-sm font-bold text-[--neon-yellow]">
                              {wmdAnalytics.economy?.avgCost ? 
                                Math.round(wmdAnalytics.economy.avgCost).toLocaleString() : '0'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-white/50">Clans Participating</span>
                            <span className="text-sm font-bold text-[--synth]">
                              {wmdAnalytics.economy?.uniqueClans || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Balance Warnings */}
                    {wmdAnalytics.balance?.warnings && wmdAnalytics.balance.warnings.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-[--solar] mb-2">⚠️ Balance Warnings</h4>
                        <div className="space-y-2">
                          {wmdAnalytics.balance.warnings.map((warning: string, idx: number) => (
                            <div key={idx} className="bg-[--solar]/5 border border-[--solar]/20 rounded px-3 py-2">
                               <p className="text-sm text-[--solar]">{warning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Emergency Admin Actions */}
                <div className="bg-[--card] rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-[--neon-pink] mb-3">🚨 Emergency Actions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-[--neon-red]">Missile Control</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          placeholder="Missile ID"
                          id="disarm-missile-id"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <input 
                          type="text"
                          placeholder="Reason for disarming"
                          id="disarm-reason"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <button
                          onClick={async () => {
                            const missileId = (document.getElementById('disarm-missile-id') as HTMLInputElement)?.value;
                            const reason = (document.getElementById('disarm-reason') as HTMLInputElement)?.value;
                            if (!missileId || !reason) {
                              alert('Please provide missile ID and reason');
                              return;
                            }
                            if (!confirm(`Emergency disarm missile ${missileId}? This will refund 50% of costs.`)) return;
                            
                            try {
                              const res = await fetch('/api/admin/wmd', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'disarm-missile', missileId, reason })
                              });
                              const data = await res.json();
                              if (data.success) {
                                alert('Missile disarmed successfully! Clan refunded 50% of costs.');
                                // Reload WMD status
                                const statusRes = await fetch('/api/admin/wmd?action=status');
                                const statusData = await statusRes.json();
                                if (statusData.success) setWmdStatus(statusData.data);
                              } else {
                                alert(`Error: ${data.error}`);
                              }
                            } catch (err) {
                              console.error('Disarm error:', err);
                              alert('Failed to disarm missile');
                            }
                          }}
                          className="w-full bg-[--neon-red]/15 hover:bg-[--neon-red]/15 text-white px-4 py-2 rounded font-semibold text-sm transition-colors"
                        >
                          🛑 Emergency Disarm
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-[--neon-yellow]">Vote Control</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          placeholder="Vote ID"
                          id="expire-vote-id"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <input 
                          type="text"
                          placeholder="Reason for expiration"
                          id="expire-reason"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <button
                          onClick={async () => {
                            const voteId = (document.getElementById('expire-vote-id') as HTMLInputElement)?.value;
                            const reason = (document.getElementById('expire-reason') as HTMLInputElement)?.value;
                            if (!voteId || !reason) {
                              alert('Please provide vote ID and reason');
                              return;
                            }
                            if (!confirm(`Force expire vote ${voteId}?`)) return;
                            
                            try {
                              const res = await fetch('/api/admin/wmd', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'expire-vote', voteId, reason })
                              });
                              const data = await res.json();
                              if (data.success) {
                                alert('Vote expired successfully!');
                                // Reload WMD status
                                const statusRes = await fetch('/api/admin/wmd?action=status');
                                const statusData = await statusRes.json();
                                if (statusData.success) setWmdStatus(statusData.data);
                              } else {
                                alert(`Error: ${data.error}`);
                              }
                            } catch (err) {
                              console.error('Expire error:', err);
                              alert('Failed to expire vote');
                            }
                          }}
                          className="w-full bg-[--neon-yellow]/15 hover:bg-[--neon-yellow]/15 text-white px-4 py-2 rounded font-semibold text-sm transition-colors"
                        >
                          ⏱️ Force Expire
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-[--electric]">Cooldown Adjustment</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          placeholder="Clan ID"
                          id="cooldown-clan-id"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <input 
                          type="number"
                          placeholder="Hours to adjust (+/-)"
                          id="cooldown-hours"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <input 
                          type="text"
                          placeholder="Reason"
                          id="cooldown-reason"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <button
                          onClick={async () => {
                            const clanId = (document.getElementById('cooldown-clan-id') as HTMLInputElement)?.value;
                            const hours = parseInt((document.getElementById('cooldown-hours') as HTMLInputElement)?.value || '0');
                            const reason = (document.getElementById('cooldown-reason') as HTMLInputElement)?.value;
                            if (!clanId || hours === 0 || !reason) {
                              alert('Please provide clan ID, hours adjustment, and reason');
                              return;
                            }
                            if (!confirm(`Adjust clan ${clanId} cooldown by ${hours} hours?`)) return;
                            
                            try {
                              const res = await fetch('/api/admin/wmd', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'adjust-cooldown', clanId, adjustmentHours: hours, reason })
                              });
                              const data = await res.json();
                              if (data.success) {
                                alert(`Cooldown adjusted! New cooldown expires: ${new Date(data.newCooldownExpiry).toLocaleString()}`);
                              } else {
                                alert(`Error: ${data.error}`);
                              }
                            } catch (err) {
                              console.error('Cooldown adjustment error:', err);
                              alert('Failed to adjust cooldown');
                            }
                          }}
                          className="w-full bg-[--electric]/15 hover:bg-[--electric]/15 text-white px-4 py-2 rounded font-semibold text-sm transition-colors"
                        >
                          ⏰ Adjust Cooldown
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-[--neon-pink]">Flag Suspicious Activity</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          placeholder="Player ID (optional)"
                          id="flag-player-id"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <input 
                          type="text"
                          placeholder="Clan ID (optional)"
                          id="flag-clan-id"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <select 
                          id="flag-activity-type"
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
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
                          className="w-full bg-[--card] border border-[--border] rounded px-3 py-2 text-white text-sm"
                        />
                        <button
                          onClick={async () => {
                            const playerId = (document.getElementById('flag-player-id') as HTMLInputElement)?.value || undefined;
                            const clanId = (document.getElementById('flag-clan-id') as HTMLInputElement)?.value || undefined;
                            const activityType = (document.getElementById('flag-activity-type') as HTMLSelectElement)?.value;
                            const details = (document.getElementById('flag-details') as HTMLTextAreaElement)?.value;
                            
                            if (!activityType || !details) {
                              alert('Please select activity type and provide details');
                              return;
                            }
                            if (!playerId && !clanId) {
                              alert('Please provide either player ID or clan ID');
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
                                alert('Activity flagged successfully! Alert created for admin review.');
                                // Reload WMD status to show new alert
                                const statusRes = await fetch('/api/admin/wmd?action=status');
                                const statusData = await statusRes.json();
                                if (statusData.success) setWmdStatus(statusData.data);
                              } else {
                                alert(`Error: ${data.error}`);
                              }
                            } catch (err) {
                              console.error('Flag error:', err);
                              alert('Failed to flag activity');
                            }
                          }}
                          className="w-full bg-[--neon-pink]/15 hover:bg-[--neon-pink]/15 text-white px-4 py-2 rounded font-semibold text-sm transition-colors"
                        >
                          🚩 Create Alert
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

        {/* RP Economy Management */}
        <div className="bg-[--card] rounded-lg border-2 border-[--neon-pink]/20">
              <button
                onClick={() => {
                  setRpEconomyExpanded(!rpEconomyExpanded);
                  if (!rpEconomyExpanded && !rpStats) {
                    loadRpEconomyData();
                  }
                }}
                className="w-full p-6 text-left hover:bg-white/5/50 transition-colors flex items-center justify-between"
              >
                <div>
                  <h2 className="text-2xl font-bold text-[--neon-yellow]">💰 RP Economy Management</h2>
                  <p className="text-white/50 text-sm mt-1">Monitor and manage the Research Point economy</p>
                </div>
                <span className="text-3xl text-[--neon-pink]">{rpEconomyExpanded ? '▼' : '▶'}</span>
              </button>

              {rpEconomyExpanded && (
                <div className="p-6 pt-0 space-y-6">
                  {rpLoading && !rpStats ? (
                    <div className="text-center py-8 text-white/50">Loading economy data...</div>
                  ) : (
                    <>
                      {/* Quick Actions Bar */}
                      <div className="flex items-center justify-between bg-[--card] rounded-lg p-4">
                        <div className="text-sm text-white/50">
                          Last refreshed: {new Date().toLocaleTimeString()}
                        </div>
                        <button
                          onClick={loadRpEconomyData}
                          disabled={rpLoading}
                          className="px-4 py-2 bg-[--neon-pink]/15 hover:bg-white/10 disabled:bg-white/5 rounded-lg font-semibold transition-colors text-sm"
                        >
                          {rpLoading ? '⏳ Loading...' : '🔄 Refresh Data'}
                        </button>
                      </div>

                      {/* Economy Overview Stats */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-[--neon-yellow]/15 to-[--solar]/15 rounded-lg p-4 text-white">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-2xl">💰</div>
                            <div className="text-xs opacity-80">Total RP in Circulation</div>
                          </div>
                          <div className="text-2xl font-bold">{rpStats?.totalRP?.toLocaleString() || '0'}</div>
                        </div>
                        <div className="bg-gradient-to-br from-[--synth]/15 to-[--synth]/15 rounded-lg p-4 text-white">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-2xl">📈</div>
                            <div className="text-xs opacity-80">Daily Generation</div>
                          </div>
                          <div className="text-2xl font-bold">{rpStats?.dailyGeneration?.toLocaleString() || '0'}</div>
                          <div className="text-xs opacity-80">Last 24 hours</div>
                        </div>
                        <div className="bg-gradient-to-br from-[--electric]/15 to-[--electric]/15 rounded-lg p-4 text-white">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-2xl">👥</div>
                            <div className="text-xs opacity-80">Active Earners</div>
                          </div>
                          <div className="text-2xl font-bold">{rpStats?.activeEarners24h?.toLocaleString() || '0'}</div>
                          <div className="text-xs opacity-80">Last 24 hours</div>
                        </div>
                        <div className="bg-gradient-to-br from-[--neon-pink]/15 to-[--neon-pink]/15 rounded-lg p-4 text-white">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-2xl">📊</div>
                            <div className="text-xs opacity-80">Average Balance</div>
                          </div>
                          <div className="text-2xl font-bold">{rpStats?.averageBalance?.toLocaleString() || '0'}</div>
                          <div className="text-xs opacity-80">Median: {rpStats?.medianBalance?.toLocaleString() || '0'}</div>
                        </div>
                      </div>

                      {/* Generation vs Spending & Bulk Adjustment */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* Generation/Spending */}
                        <div className="bg-[--card] rounded-lg p-4">
                          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[--neon-pink]">
                            <span>💸</span>
                            <span>Generation vs Spending</span>
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-white/50">Total Generated:</span>
                              <span className="text-[--synth] font-bold">{rpStats?.totalGenerated?.toLocaleString() || '0'} RP</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-white/50">Total Spent:</span>
                              <span className="text-[--neon-red] font-bold">{rpStats?.totalSpent?.toLocaleString() || '0'} RP</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-[--border]">
                              <span className="text-white/60 font-semibold">Net Circulation:</span>
                              <span className="text-[--neon-yellow] font-bold text-lg">{rpStats?.totalRP?.toLocaleString() || '0'} RP</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-white/40 text-xs">VIP Players:</span>
                              <span className="text-[--neon-pink] text-xs">{rpStats?.vipPlayers || 0} players (+50% bonus)</span>
                            </div>
                          </div>
                        </div>

                        {/* Bulk RP Adjustment Tool */}
                        <div className="bg-[--card] rounded-lg p-4">
                          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[--neon-pink]">
                            <span>⚙️</span>
                            <span>Bulk RP Adjustment</span>
                          </h3>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={rpBulkUsername}
                              onChange={(e) => setRpBulkUsername(e.target.value)}
                              className="w-full px-3 py-2 bg-[--card] border border-[--border] rounded text-white text-sm"
                              placeholder="Username"
                            />
                            <input
                              type="number"
                              value={rpBulkAmount || ''}
                              onChange={(e) => setRpBulkAmount(parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2 bg-[--card] border border-[--border] rounded text-white text-sm"
                              placeholder="Amount (+ to add, - to remove)"
                            />
                            <input
                              type="text"
                              value={rpBulkReason}
                              onChange={(e) => setRpBulkReason(e.target.value)}
                              className="w-full px-3 py-2 bg-[--card] border border-[--border] rounded text-white text-sm"
                              placeholder="Reason for adjustment"
                            />
                            <button
                              onClick={handleRpBulkAdjustment}
                              disabled={rpBulkLoading || !rpBulkUsername || rpBulkAmount === 0 || !rpBulkReason}
                              className="w-full px-4 py-2 bg-[--solar]/15 hover:bg-white/10 disabled:bg-white/5 rounded font-semibold transition-colors text-sm"
                            >
                              {rpBulkLoading ? '⏳ Processing...' : '💰 Adjust RP Balance'}
                            </button>
                            {rpBulkResult && (
                              <div className={`text-xs p-2 rounded ${rpBulkResult.startsWith('✅') ? 'bg-[--synth]/10 text-[--synth]' : 'bg-[--neon-red]/10 text-[--neon-red]'}`}>
                                {rpBulkResult}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Earners and Spenders */}
                      <div className="grid grid-cols-2 gap-6">
                        {/* Top Earners */}
                        <div className="bg-[--card] rounded-lg p-4">
                          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[--neon-pink]">
                            <span>🏆</span>
                            <span>Top RP Earners</span>
                            <span className="text-xs text-white/50 ml-auto">{rpDateFilter}</span>
                          </h3>
                          <div className="space-y-2">
                            {rpTopEarners.slice(0, 5).map((player: any, index: number) => (
                              <div key={player.username} className="flex items-center justify-between p-2 bg-[--card] rounded text-sm">
                                <div className="flex items-center gap-2">
                                  <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</span>
                                  <span className="font-semibold">{player.username}</span>
                                  {player.vip && <span className="text-xs bg-[--neon-pink]/15 px-1 py-0.5 rounded">VIP</span>}
                                </div>
                                <span className="text-[--synth] font-bold">{player.amount?.toLocaleString()} RP</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Top Spenders */}
                        <div className="bg-[--card] rounded-lg p-4">
                          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-[--neon-pink]">
                            <span>💸</span>
                            <span>Top RP Spenders</span>
                            <span className="text-xs text-white/50 ml-auto">{rpDateFilter}</span>
                          </h3>
                          <div className="space-y-2">
                            {rpTopSpenders.slice(0, 5).map((player: any, index: number) => (
                              <div key={player.username} className="flex items-center justify-between p-2 bg-[--card] rounded text-sm">
                                <div className="flex items-center gap-2">
                                  <span>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</span>
                                  <span className="font-semibold">{player.username}</span>
                                  {player.vip && <span className="text-xs bg-[--neon-pink]/15 px-1 py-0.5 rounded">VIP</span>}
                                </div>
                                <span className="text-[--neon-red] font-bold">{player.amount?.toLocaleString()} RP</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Transaction History with Filters */}
                      <div className="bg-[--card] rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-[--neon-pink]">
                            <span>📜</span>
                            <span>Recent RP Transactions</span>
                          </h3>
                          
                          {/* Filters */}
                          <div className="flex gap-2">
                            <select
                              value={rpDateFilter}
                              onChange={(e) => setRpDateFilter(e.target.value as any)}
                              className="px-2 py-1 bg-[--card] border border-[--border] rounded text-xs"
                            >
                              <option value="24h">Last 24 Hours</option>
                              <option value="7d">Last 7 Days</option>
                              <option value="30d">Last 30 Days</option>
                              <option value="all">All Time</option>
                            </select>
                            
                            <select
                              value={rpSourceFilter}
                              onChange={(e) => setRpSourceFilter(e.target.value)}
                              className="px-2 py-1 bg-[--card] border border-[--border] rounded text-xs"
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
                              className="px-2 py-1 bg-[--card] border border-[--border] rounded text-xs w-40"
                            />
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-[--card]">
                              <tr className="border-b border-[--border]">
                                <th className="text-left py-2 px-2">Time</th>
                                <th className="text-left py-2 px-2">Player</th>
                                <th className="text-left py-2 px-2">Source</th>
                                <th className="text-left py-2 px-2">Description</th>
                                <th className="text-right py-2 px-2">Amount</th>
                                <th className="text-center py-2 px-2">VIP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rpTransactions.slice(0, 50).map((tx: any) => (
                                <tr key={tx._id} className="border-b border-[--border]/50 hover:bg-[--card]/50">
                                  <td className="py-2 px-2 text-white/50">{formatRpTimestamp(tx.timestamp)}</td>
                                  <td className="py-2 px-2 font-semibold">{tx.username}</td>
                                  <td className="py-2 px-2">{formatRpSourceName(tx.source)}</td>
                                  <td className="py-2 px-2 text-white/50">{tx.description}</td>
                                  <td className={`py-2 px-2 text-right font-bold ${tx.amount >= 0 ? 'text-[--synth]' : 'text-[--neon-red]'}`}>
                                    {tx.amount >= 0 ? '+' : ''}{tx.amount?.toLocaleString()}
                                  </td>
                                  <td className="py-2 px-2 text-center">{tx.vipBonusApplied ? '👑' : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {rpTransactions.length === 0 && (
                            <div className="text-center py-8 text-white/50">No transactions found</div>
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
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-[--card] rounded-lg p-6 max-w-md w-full border-2 border-[--electric]/20">
                <h3 className="text-xl font-bold text-[--electric] mb-4">
                  {editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-white/50 block mb-1">Schedule Name (optional)</label>
                    <input
                      type="text"
                      value={scheduleForm.name}
                      onChange={(e) => setScheduleForm({...scheduleForm, name: e.target.value})}
                      placeholder="e.g., Weekend Morning Spawn"
                      className="w-full bg-white/5 border border-[--border] rounded px-3 py-2 text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-white/50 block mb-1">Day of Week</label>
                      <select
                        value={scheduleForm.dayOfWeek}
                        onChange={(e) => setScheduleForm({...scheduleForm, dayOfWeek: parseInt(e.target.value)})}
                        className="w-full bg-white/5 border border-[--border] rounded px-3 py-2 text-white"
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
                      <label className="text-sm text-white/50 block mb-1">Hour (0-23)</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={scheduleForm.hour}
                        onChange={(e) => setScheduleForm({...scheduleForm, hour: parseInt(e.target.value) || 0})}
                        className="w-full bg-white/5 border border-[--border] rounded px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-white/50 block mb-1">Spawn Percentage (1-200%)</label>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={scheduleForm.spawnPercentage}
                      onChange={(e) => setScheduleForm({...scheduleForm, spawnPercentage: parseInt(e.target.value) || 100})}
                      className="w-full bg-white/5 border border-[--border] rounded px-3 py-2 text-white"
                    />
                    <p className="text-xs text-white/40 mt-1">
                      Tip: Multiple schedules can combine (e.g., two 50% schedules = 100% total)
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm text-white/50 block mb-1">Timezone</label>
                    <select
                      value={scheduleForm.timezone}
                      onChange={(e) => setScheduleForm({...scheduleForm, timezone: e.target.value})}
                      className="w-full bg-white/5 border border-[--border] rounded px-3 py-2 text-white"
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
                    <label htmlFor="scheduleEnabled" className="text-sm text-white/60">
                      Schedule Enabled
                    </label>
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSaveSchedule}
                    disabled={schedulesLoading}
                    className="flex-1 bg-[--electric]/15 hover:bg-[--electric]/15 disabled:bg-white/5 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-semibold"
                  >
                    {schedulesLoading ? 'Saving...' : 'Save Schedule'}
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleModal(false);
                      setEditingSchedule(null);
                    }}
                     className="flex-1 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded font-semibold"
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

  if (embedded) {
    return renderAdminContent();
  }

  return (
    <>
      <TopNavBar />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void]">
            {renderAdminContent()}
          </div>
        }
      />
    </>
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
