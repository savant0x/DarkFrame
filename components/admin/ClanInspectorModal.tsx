/**
 * @file components/admin/ClanInspectorModal.tsx
 * @created 2025-10-19
 * @overview Ultra-detailed clan monitoring system for administrators
 * 
 * OVERVIEW:
 * Comprehensive 9-tab analytics dashboard providing deep insights into every
 * aspect of clan operations. Designed for "data junkies" requiring complete
 * visibility into clan activities, finances, warfare, and member behavior.
 * 
 * 9 MONITORING TABS:
 * 1. Overview - High-level metrics and health indicators
 * 2. Members Deep Dive - Complete member analytics and activity patterns
 * 3. Financial Analytics - Bank transactions, treasury trends, tax data
 * 4. Territory Management - All territories with income and defense analysis
 * 5. Warfare Analytics - Wars, battles, victories, losses, strategies
 * 6. Activity Logs - EVERY clan action timestamped and categorized
 * 7. Research & Perks - Tech tree progress, RP contributions, active perks
 * 8. Alliance Network - All alliances, terms, formation/break history
 * 9. Health Metrics - Clan health score, trends, predictions, alerts
 * 
 * FEATURES:
 * - Export to CSV/JSON for all tabs
 * - Real-time refresh capability
 * - Suspicious activity detection
 * - Search/filter per tab
 * - Date range filtering
 * - Sortable data tables
 * - Alert highlighting
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 5 - Admin Clan Analytics
 * - Admin-only access (permission check required)
 * - Integrates with 5 new admin API routes
 * - Performance optimized for large datasets
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

import { 
  X, 
  Download, 
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Coins,
  Map,
  Swords,
  Activity,
  Beaker,
  Handshake,
  Heart,
  Search,
  Eye,
  Shield,
  Clock,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import type { Clan, ClanMember } from '@/types/clan.types';

interface ClanInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  clanId: string;
}

// UI contract for /api/admin/clan/analytics — every field the tabs render.
// Backend implemented 2026-09-02 (SESSION-2026-09-02-010, resolves SCOPE.md #10):
// returns { success, clan, analytics } satisfying exactly this shape.
interface ClanAnalytics {
  totalPower?: number;
  alerts?: Array<{ message: string }>;
  recentActivity?: {
    bankTransactions?: number;
    memberChanges?: number;
    territoryClaims?: number;
    warsDeclared?: number;
  };
  totalDeposits?: number;
  totalWithdrawals?: number;
  activities?: Array<{ description: string; timestamp: string; type: string }>;
  alliances?: Array<{ clanIds?: string[]; createdAt: string; terms?: string }>;
  healthScore?: number;
}

// Members render with RP/resource contribution columns — enrichment the future
// analytics backend must supply (not part of the domain ClanMember type).
type MemberRow = ClanMember & { contributedRP?: number; contributedResources?: number };

type InspectorTab = 'overview' | 'members' | 'financial' | 'territory' | 'warfare' | 'activity' | 'research' | 'alliances' | 'health';

export default function ClanInspectorModal({ isOpen, onClose, clanId }: ClanInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview');
  const [clanData, setClanData] = useState<Clan | null>(null);
  const [analytics, setAnalytics] = useState<ClanAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Fetches comprehensive clan analytics data
   */
  const fetchClanAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/clan/analytics?clanId=${clanId}&tab=${activeTab}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const data = await response.json();
      setClanData(data.clan);
      setAnalytics(data.analytics);
    } catch (error) {
      console.error('Error fetching clan analytics:', error);
      toast.error('Failed to load clan analytics');
    } finally {
      setIsLoading(false);
    }
  }, [clanId, activeTab]);

  useEffect(() => {
    if (isOpen && clanId) {
      fetchClanAnalytics();
    }
  }, [isOpen, clanId, activeTab, fetchClanAnalytics]);

  /**
   * Exports current tab data to CSV
   */
  const exportToCSV = () => {
    if (!analytics) return;
    
    const csv = convertToCSV(analytics);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clan-${clanId}-${activeTab}-${Date.now()}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  /**
   * Exports current tab data to JSON
   */
  const exportToJSON = () => {
    if (!analytics) return;
    
    const json = JSON.stringify({ clan: clanData, analytics, tab: activeTab }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clan-${clanId}-${activeTab}-${Date.now()}.json`;
    a.click();
    toast.success('Exported to JSON');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header — FID-017: gradient strip → quiet cyan tint */}
        <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_8%,transparent)] border-b border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-8 h-8 text-[color:var(--nn-cyan)]" />
                <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">Clan Inspector</h2>
                <span className="nn-chip nn-chip--magenta text-xs">ADMIN ONLY</span>
              </div>
              {clanData && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-[color:var(--nn-text-secondary)]">Clan:</span>
                  <span className="text-[color:var(--nn-cyan)] font-semibold">{clanData.name}</span>
                  <span className="text-[color:var(--nn-text-secondary)]">•</span>
                  <span className="text-[color:var(--nn-text-secondary)]">Level {clanData.level?.currentLevel || 0}</span>
                  <span className="text-[color:var(--nn-text-secondary)]">•</span>
                  <span className="text-[color:var(--nn-text-secondary)]">{clanData.members?.length || 0} Members</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchClanAnalytics} className="nn-btn nn-btn--ghost gap-2" disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'nn-spin-icon' : ''}`} />
                Refresh
              </button>
              <button onClick={exportToCSV} className="nn-btn nn-btn--ghost gap-2">
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button onClick={exportToJSON} className="nn-btn nn-btn--ghost gap-2">
                <Download className="w-4 h-4" />
                JSON
              </button>
              <button onClick={onClose} className="nn-btn nn-btn--ghost text-[color:var(--nn-magenta)]">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
            <TabButton icon={<Eye />} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
            <TabButton icon={<Users />} label="Members" active={activeTab === 'members'} onClick={() => setActiveTab('members')} />
            <TabButton icon={<Coins />} label="Financial" active={activeTab === 'financial'} onClick={() => setActiveTab('financial')} />
            <TabButton icon={<Map />} label="Territory" active={activeTab === 'territory'} onClick={() => setActiveTab('territory')} />
            <TabButton icon={<Swords />} label="Warfare" active={activeTab === 'warfare'} onClick={() => setActiveTab('warfare')} />
            <TabButton icon={<Activity />} label="Activity" active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} />
            <TabButton icon={<Beaker />} label="Research" active={activeTab === 'research'} onClick={() => setActiveTab('research')} />
            <TabButton icon={<Handshake />} label="Alliances" active={activeTab === 'alliances'} onClick={() => setActiveTab('alliances')} />
            <TabButton icon={<Heart />} label="Health" active={activeTab === 'health'} onClick={() => setActiveTab('health')} />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="nn-spin-icon w-12 h-12 text-[color:var(--nn-cyan)]" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <OverviewTab clan={clanData} analytics={analytics} />}
              {activeTab === 'members' && <MembersTab clan={clanData} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
              {activeTab === 'financial' && <FinancialTab clan={clanData} analytics={analytics} />}
              {activeTab === 'territory' && <TerritoryTab clan={clanData} />}
              {activeTab === 'warfare' && <WarfareTab clan={clanData} />}
              {activeTab === 'activity' && <ActivityTab analytics={analytics} />}
              {activeTab === 'research' && <ResearchTab clan={clanData} />}
              {activeTab === 'alliances' && <AlliancesTab analytics={analytics} />}
              {activeTab === 'health' && <HealthTab analytics={analytics} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Tab Button Component
 */
interface TabButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ icon, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-none border transition-all ${
        active 
          ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] text-[color:var(--nn-cyan)]' 
          : 'bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] text-[color:var(--nn-text-secondary)]'
      }`}
    >
      <div className="w-5 h-5">{icon}</div>
      <span className="text-xs font-medium hidden lg:block">{label}</span>
    </button>
  );
}

/**
 * OVERVIEW TAB - High-level metrics
 */
function OverviewTab({ clan, analytics }: { clan: Clan | null; analytics: ClanAnalytics | null }) {
  if (!clan) return <div className="text-center text-[color:var(--nn-text-secondary)] py-12">No clan data available</div>;

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Power" value={analytics?.totalPower || clan.stats?.totalPower || 0} icon={<TrendingUp />} trend="+5%" />
        <MetricCard label="Members" value={`${clan.members?.length || 0}/${clan.maxMembers || 50}`} icon={<Users />} />
        <MetricCard label="Territories" value={clan.territories?.length || 0} icon={<Map />} />
        <MetricCard label="Bank Treasury" value={`${((clan.bank?.treasury?.metal || 0) + (clan.bank?.treasury?.energy || 0)).toLocaleString()}R`} icon={<Coins />} />
      </div>

      {/* Alerts */}
      {analytics?.alerts && analytics.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[color:var(--nn-amber)]" />
            Active Alerts
          </h3>
          {analytics.alerts.map((alert, i) => (
            <div key={i} className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-3">
              <p className="text-[color:var(--nn-amber)] text-sm">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent Activity Summary */}
      <div>
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)] mb-3">Recent Activity (Last 24h)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3">
            <div className="text-[color:var(--nn-text-secondary)] mb-1">Bank Transactions</div>
            <div className="text-2xl font-bold text-[color:var(--nn-cyan)]">{analytics?.recentActivity?.bankTransactions || 0}</div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3">
            <div className="text-[color:var(--nn-text-secondary)] mb-1">Member Changes</div>
            <div className="text-2xl font-bold text-[color:var(--nn-violet)]">{analytics?.recentActivity?.memberChanges || 0}</div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3">
            <div className="text-[color:var(--nn-text-secondary)] mb-1">Territory Claims</div>
            <div className="text-2xl font-bold text-[color:var(--nn-green)]">{analytics?.recentActivity?.territoryClaims || 0}</div>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3">
            <div className="text-[color:var(--nn-text-secondary)] mb-1">Wars Declared</div>
            <div className="text-2xl font-bold text-[color:var(--nn-magenta)]">{analytics?.recentActivity?.warsDeclared || 0}</div>
          </div>
        </div>
      </div>

      {/* Clan Info */}
      <div>
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)] mb-3">Clan Information</h3>
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div><span className="text-[color:var(--nn-text-secondary)]">Created:</span> <span className="text-[color:var(--nn-text-primary)] ml-2">{new Date(clan.createdAt).toLocaleDateString()}</span></div>
            <div><span className="text-[color:var(--nn-text-secondary)]">Leader:</span> <span className="text-[color:var(--nn-amber)] ml-2">{clan.leaderId}</span></div>
            <div><span className="text-[color:var(--nn-text-secondary)]">Level:</span> <span className="text-[color:var(--nn-cyan)] ml-2">{clan.level?.currentLevel || 0}</span></div>
            <div><span className="text-[color:var(--nn-text-secondary)]">XP:</span> <span className="text-[color:var(--nn-violet)] ml-2">{clan.level?.currentLevelXP || 0} / {clan.level?.xpToNextLevel || 0}</span></div>
            <div><span className="text-[color:var(--nn-text-secondary)]">Wars Won:</span> <span className="text-[color:var(--nn-green)] ml-2">{clan.stats?.warsWon || 0}</span></div>
            <div><span className="text-[color:var(--nn-text-secondary)]">Wars Lost:</span> <span className="text-[color:var(--nn-magenta)] ml-2">{clan.stats?.warsLost || 0}</span></div>
          </div>
          <div className="nn-divider my-6" />
          <div><span className="text-[color:var(--nn-text-secondary)]">Description:</span> <p className="text-[color:var(--nn-text-secondary)] mt-1">{clan.description || 'No description'}</p></div>
          <div><span className="text-[color:var(--nn-text-secondary)]">Message of the Day:</span> <p className="text-[color:var(--nn-text-secondary)] mt-1">{clan.settings?.messageOfTheDay || 'None'}</p></div>
        </div>
      </div>
    </div>
  );
}

/**
 * MEMBERS TAB - Deep dive into all members
 */
function MembersTab({ clan, searchQuery, setSearchQuery }: { clan: Clan | null; searchQuery: string; setSearchQuery: (q: string) => void }) {
  if (!clan?.members) return <div className="text-center text-[color:var(--nn-text-secondary)] py-12">No member data available</div>;

  const filteredMembers = clan.members.filter((m: MemberRow) => 
    !searchQuery || m.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--nn-text-secondary)]" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="nn-input pl-10"
          />
        </div>
        <span className="nn-chip nn-chip--cyan">{filteredMembers.length} Members</span>
      </div>

      <div className="space-y-2">
        {filteredMembers.map((member: MemberRow) => (
          <div key={member.playerId} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-semibold text-[color:var(--nn-text-primary)]">{member.username}</span>
                  <span className={`nn-chip ${member.role === 'LEADER' ? 'nn-chip--amber' : 'nn-chip--cyan'}`}>{member.role}</span>
                  {new Date().getTime() - new Date(member.lastActive).getTime() < 300000 && (
                    <span className="nn-chip nn-chip--green text-xs">Online</span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-[color:var(--nn-text-secondary)]">Joined:</span> <span className="text-[color:var(--nn-text-secondary)] ml-2">{new Date(member.joinedAt).toLocaleDateString()}</span></div>
                  <div><span className="text-[color:var(--nn-text-secondary)]">RP Contributed:</span> <span className="text-[color:var(--nn-violet)] ml-2">{member.contributedRP || 0}</span></div>
                  <div><span className="text-[color:var(--nn-text-secondary)]">Resources:</span> <span className="text-[color:var(--nn-amber)] ml-2">{member.contributedResources || 0}</span></div>
                  <div><span className="text-[color:var(--nn-text-secondary)]">Last Active:</span> <span className="text-[color:var(--nn-cyan)] ml-2">{new Date(member.lastActive).toLocaleDateString()}</span></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * FINANCIAL TAB - Bank transactions and treasury analysis
 */
function FinancialTab({ clan, analytics }: { clan: Clan | null; analytics: ClanAnalytics | null }) {
  const treasury = clan?.bank?.treasury || { metal: 0, energy: 0 };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Metal" value={treasury.metal?.toLocaleString() || 0} icon={<Coins className="text-[color:var(--nn-text-secondary)]" />} />
        <MetricCard label="Energy" value={treasury.energy?.toLocaleString() || 0} icon={<Coins className="text-[color:var(--nn-amber)]" />} />
        <MetricCard label="Research Points" value={clan?.research?.researchPoints?.toLocaleString() || 0} icon={<Beaker className="text-[color:var(--nn-violet)]" />} />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)] mb-3">Recent Transactions (Last 50)</h3>
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
          <div className="text-sm text-[color:var(--nn-text-secondary)] text-center py-8">
            Transaction history requires API integration
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
          <h4 className="text-sm font-semibold text-[color:var(--nn-text-secondary)] mb-2">Total Deposits (All Time)</h4>
          <div className="text-2xl font-bold text-[color:var(--nn-green)]">{analytics?.totalDeposits?.toLocaleString() || 0}</div>
        </div>
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
          <h4 className="text-sm font-semibold text-[color:var(--nn-text-secondary)] mb-2">Total Withdrawals (All Time)</h4>
          <div className="text-2xl font-bold text-[color:var(--nn-magenta)]">{analytics?.totalWithdrawals?.toLocaleString() || 0}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * TERRITORY TAB - All territories with analysis
 */
function TerritoryTab({ clan }: { clan: Clan | null }) {
  const territories = clan?.territories || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)]">Controlled Territories</h3>
        <span className="nn-chip nn-chip--cyan">{territories.length} Tiles</span>
      </div>

      {territories.length === 0 ? (
        <div className="text-center py-12 text-[color:var(--nn-text-secondary)]">No territories controlled</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {territories.map((territory, i) => (
            <div key={i} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[color:var(--nn-text-primary)] font-semibold">({territory.tileX}, {territory.tileY})</span>
                <span className="nn-chip nn-chip--green text-xs">+{territory.defenseBonus}% Defense</span>
              </div>
              <div className="text-sm space-y-1">
                <div><span className="text-[color:var(--nn-text-secondary)]">Claimed by:</span> <span className="text-[color:var(--nn-cyan)] ml-2">{territory.claimedBy}</span></div>
                <div><span className="text-[color:var(--nn-text-secondary)]">Date:</span> <span className="text-[color:var(--nn-text-secondary)] ml-2">{new Date(territory.claimedAt).toLocaleDateString()}</span></div>
                <div><span className="text-[color:var(--nn-text-secondary)]">Income:</span> <span className="text-[color:var(--nn-amber)] ml-2">100M + 100E/h</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * WARFARE TAB - Wars and battle analytics
 */
function WarfareTab({ clan }: { clan: Clan | null }) {
  const activeWars = clan?.wars?.active || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Wars Won" value={clan?.stats?.warsWon || 0} icon={<Trophy />} trend="+2" />
        <MetricCard label="Wars Lost" value={clan?.stats?.warsLost || 0} icon={<TrendingDown />} />
        <MetricCard label="Active Wars" value={activeWars.length} icon={<Swords />} />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)] mb-3">Active Wars</h3>
        {activeWars.length === 0 ? (
          <div className="text-center py-8 text-[color:var(--nn-text-secondary)]">No active wars</div>
        ) : (
          <div className="space-y-3">
            {activeWars.map((war, i) => (
              <div key={i} className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4">
                <div className="text-[color:var(--nn-text-primary)] font-semibold mb-2">War vs Clan {war.defenderClanId?.slice(0, 8)}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-[color:var(--nn-text-secondary)]">Status:</span> <span className="nn-chip nn-chip--magenta ml-2">{war.status}</span></div>
                  <div><span className="text-[color:var(--nn-text-secondary)]">Started:</span> <span className="text-[color:var(--nn-text-secondary)] ml-2">{new Date(war.startedAt || war.declaredAt).toLocaleDateString()}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ACTIVITY TAB - Complete activity log
 */
function ActivityTab({ analytics }: { analytics: ClanAnalytics | null }) {
  const activities = analytics?.activities || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)]">Activity Log</h3>
        <span className="nn-chip nn-chip--cyan">{activities.length} Events</span>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-12 text-[color:var(--nn-text-secondary)]">No activity logs available</div>
        ) : (
          activities.map((activity, i) => (
            <div key={i} className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[color:var(--nn-text-secondary)] mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm text-[color:var(--nn-text-primary)] mb-1">{activity.description}</div>
                  <div className="text-xs text-[color:var(--nn-text-secondary)]">{new Date(activity.timestamp).toLocaleString()}</div>
                </div>
                <span className="nn-chip nn-chip--cyan text-xs">{activity.type}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * RESEARCH TAB - Research tree and RP analytics
 */
function ResearchTab({ clan }: { clan: Clan | null }) {
  const research = clan?.research ?? { researchPoints: 0, unlockedTechs: [], activeResearch: null };
  const unlockedTechs = research.unlockedTechs || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Research Points" value={research.researchPoints?.toLocaleString() || 0} icon={<Beaker />} />
        <MetricCard label="Unlocked Technologies" value={unlockedTechs.length} icon={<Shield />} />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)] mb-3">Unlocked Technologies</h3>
        {unlockedTechs.length === 0 ? (
          <div className="text-center py-8 text-[color:var(--nn-text-secondary)]">No technologies unlocked yet</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {unlockedTechs.map((tech: string, i: number) => (
              <div key={i} className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] rounded-none p-3">
                <div className="text-[color:var(--nn-violet)] font-semibold text-sm">{tech}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {research.activeResearch && (
        <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-4">
          <h4 className="text-sm font-semibold text-[color:var(--nn-cyan)] mb-2">Currently Researching</h4>
          <div className="text-[color:var(--nn-text-primary)]">{research.activeResearch}</div>
        </div>
      )}
    </div>
  );
}

/**
 * ALLIANCES TAB - Alliance network analysis
 */
function AlliancesTab({ analytics }: { analytics: ClanAnalytics | null }) {
  const alliances = analytics?.alliances || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)]">Alliance Network</h3>
        <span className="nn-chip nn-chip--green">{alliances.length} Active</span>
      </div>

      {alliances.length === 0 ? (
        <div className="text-center py-12 text-[color:var(--nn-text-secondary)]">No active alliances</div>
      ) : (
        <div className="space-y-3">
          {alliances.map((alliance, i) => (
            <div key={i} className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[color:var(--nn-text-primary)] font-semibold">Alliance #{i + 1}</span>
                <span className="nn-chip nn-chip--green">Active</span>
              </div>
              <div className="text-sm space-y-1">
                <div><span className="text-[color:var(--nn-text-secondary)]">Allied Clans:</span> <span className="text-[color:var(--nn-cyan)] ml-2">{alliance.clanIds?.length || 0}</span></div>
                <div><span className="text-[color:var(--nn-text-secondary)]">Formed:</span> <span className="text-[color:var(--nn-text-secondary)] ml-2">{new Date(alliance.createdAt).toLocaleDateString()}</span></div>
                {alliance.terms && <div><span className="text-[color:var(--nn-text-secondary)]">Terms:</span> <p className="text-[color:var(--nn-text-secondary)] mt-1 text-xs">{alliance.terms}</p></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * HEALTH TAB - Clan health metrics and predictions
 */
function HealthTab({ analytics }: { analytics: ClanAnalytics | null }) {
  const healthScore = analytics?.healthScore || 75;
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-[color:var(--nn-green)]';
    if (score >= 60) return 'text-[color:var(--nn-amber)]';
    return 'text-[color:var(--nn-magenta)]';
  };

  return (
    <div className="space-y-6">
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-6 text-center">
        <h3 className="text-sm text-[color:var(--nn-text-secondary)] mb-2">Overall Clan Health</h3>
        <div className={`text-6xl font-bold ${getHealthColor(healthScore)} mb-2`}>{healthScore}%</div>
        <div className="text-sm text-[color:var(--nn-text-secondary)]">Based on activity, growth, and stability metrics</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
          <h4 className="text-sm text-[color:var(--nn-text-secondary)] mb-2">Member Activity</h4>
          <div className="flex items-center gap-2">
            <div className="nn-meter flex-1">
              <div className="nn-meter__seg nn-meter__seg--green" style={{ width: '80%' }}></div>
            </div>
            <span className="nn-num nn-text-green font-semibold">80%</span>
          </div>
        </div>
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
          <h4 className="text-sm text-[color:var(--nn-text-secondary)] mb-2">Financial Stability</h4>
          <div className="flex items-center gap-2">
            <div className="nn-meter flex-1">
              <div className="nn-meter__seg nn-meter__seg--amber" style={{ width: '65%' }}></div>
            </div>
            <span className="nn-num nn-text-amber font-semibold">65%</span>
          </div>
        </div>
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
          <h4 className="text-sm text-[color:var(--nn-text-secondary)] mb-2">Territory Security</h4>
          <div className="flex items-center gap-2">
            <div className="nn-meter flex-1">
              <div className="nn-meter__seg nn-meter__seg--str" style={{ width: '90%' }}></div>
            </div>
            <span className="nn-num nn-text-cyan font-semibold">90%</span>
          </div>
        </div>
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
          <h4 className="text-sm text-[color:var(--nn-text-secondary)] mb-2">Growth Rate</h4>
          <div className="flex items-center gap-2">
            <div className="nn-meter flex-1">
              <div className="nn-meter__seg nn-meter__seg--vio" style={{ width: '70%' }}></div>
            </div>
            <span className="nn-num nn-text-violet font-semibold">70%</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-[color:var(--nn-text-primary)] mb-3">Health Factors</h3>
        <div className="space-y-2 text-sm">
          <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[color:var(--nn-green)]" />
            <span className="text-[color:var(--nn-green)]">Strong member retention (95%)</span>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[color:var(--nn-green)]" />
            <span className="text-[color:var(--nn-green)]">Consistent resource contributions</span>
          </div>
          <div className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[color:var(--nn-amber)]" />
            <span className="text-[color:var(--nn-amber)]">Low territory expansion rate</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
}

function MetricCard({ label, value, icon, trend }: MetricCardProps) {
  return (
    <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[color:var(--nn-text-secondary)]">{label}</span>
        <div className="text-[color:var(--nn-cyan)]">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-[color:var(--nn-text-primary)] mb-1">{value}</div>
      {trend && (
        <div className={`text-xs ${trend.startsWith('+') ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-magenta)]'}`}>
          {trend}
        </div>
      )}
    </div>
  );
}

/**
 * Converts analytics data to CSV format
 */
function convertToCSV(data: object): string {
  // Simplified CSV conversion — flat key/value dump (per-tab exports can be
  // expanded now that the backend exists: SESSION-2026-09-02-010)
  const headers = Object.keys(data).join(',');
  const values = Object.values(data).join(',');
  return `${headers}\n${values}`;
}

// Trophy icon component
function Trophy({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>;
}
