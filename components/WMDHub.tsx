/**
 * @file components/WMDHub.tsx
 * @created 2025-10-22
 * @updated 2026-09-08 (FID-20260908-009: NEON NOIR redesign — nn-sec header,
 * nn-tab text-rule navigation, token void shell; tab wiring byte-preserved)
 * @overview WMD System Hub Container
 *
 * OVERVIEW:
 * Main wrapper component for the WMD system. Provides tab navigation between
 * all WMD panels and displays system-wide status indicators.
 *
 * Dependencies: All WMD panel components, useWMDNotifications hook
 */

'use client';

import { useState } from 'react';
import { Crosshair } from 'lucide-react';
import { useWMDNotifications } from '@/hooks';
import WMDResearchPanel from './WMDResearchPanel';
import WMDMissilePanel from './WMDMissilePanel';
import WMDDefensePanel from './WMDDefensePanel';
import WMDIntelligencePanel from './WMDIntelligencePanel';
import WMDVotingPanel from './WMDVotingPanel';
import WMDNotificationsPanel from './WMDNotificationsPanel';

type TabType = 'research' | 'missiles' | 'defense' | 'intelligence' | 'voting' | 'notifications';

export default function WMDHub() {
  const [activeTab, setActiveTab] = useState<TabType>('research');

  // Subscribe to real-time WMD WebSocket events
  useWMDNotifications({
    showToasts: true,
    onIncomingMissile: (_data) => {
      // Auto-switch to missiles tab on incoming missile alert
      setActiveTab('missiles');
    },
    onVoteUpdate: (data) => {
      // Could show a badge or notification on voting tab
      console.log('[WMD] Vote update:', data);
    },
  });

  // Text-rule tabs: section label + count-style meta; no emoji slabs
  const tabs: { id: TabType; label: string }[] = [
    { id: 'research', label: 'Research' },
    { id: 'missiles', label: 'Missiles' },
    { id: 'defense', label: 'Defense' },
    { id: 'intelligence', label: 'Intel' },
    { id: 'voting', label: 'Voting' },
    { id: 'notifications', label: 'Alerts' },
  ];

  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ background: 'var(--nn-void)' }}>
      {/* Header — scanline section instrument */}
      <div
        className="flex-shrink-0 border-b px-6 pt-5 pb-4"
        style={{
          borderColor: 'color-mix(in oklab, var(--nn-magenta) 16%, transparent)',
          background: 'color-mix(in oklab, var(--nn-void) 88%, transparent)',
        }}
      >
        <div className="nn-sec nn-sec--magenta">
          <span className="nn-panel__icon"><Crosshair className="h-4 w-4" /></span>
          <span className="nn-sec__title">Weapons of Mass Destruction</span>
          <span className="nn-sec__note">Strategic Systems ▸ Research · Arsenal · Defense · Intel · Council</span>
        </div>
      </div>

      {/* Tab Navigation — text-rule tabs (never filled slabs) */}
      <div
        className="flex flex-wrap gap-0 px-6 border-b flex-shrink-0"
        style={{
          borderColor: 'color-mix(in oklab, var(--nn-magenta) 16%, transparent)',
          background: 'color-mix(in oklab, var(--nn-void) 88%, transparent)',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-selected={activeTab === tab.id}
            className={`nn-tab px-5 ${activeTab === tab.id ? 'nn-tab--on' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Panel */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'research' && <WMDResearchPanel />}
          {activeTab === 'missiles' && <WMDMissilePanel />}
          {activeTab === 'defense' && <WMDDefensePanel />}
          {activeTab === 'intelligence' && <WMDIntelligencePanel />}
          {activeTab === 'voting' && <WMDVotingPanel />}
          {activeTab === 'notifications' && <WMDNotificationsPanel />}
        </div>
      </div>
    </div>
  );
}
