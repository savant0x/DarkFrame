/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Bot Population Trends Chart Component
 * 
 * Displays bot population distribution by specialization over time.
 * Shows trends for Hoarders, Fortresses, Raiders, Balanced, and Ghost bots.
 * Used in admin dashboard analytics section for bot ecosystem monitoring.
 * 
 * Features:
 * - Multi-line chart for specialization trends
 * - Color-coded lines by bot type
 * - Responsive design with legend
 * - Current snapshot display
 */

'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BotStats {
  total: number;
  bySpecialization: {
    Hoarder: number;
    Fortress: number;
    Raider: number;
    Balanced: number;
    Ghost: number;
  };
}

interface BotPopulationTrendsProps {
  currentStats: BotStats;
  loading?: boolean;
  error?: string | null;
}

const SPEC_COLORS = {
  Hoarder: '#eab308',    // Yellow
  Fortress: '#3b82f6',   // Blue
  Raider: '#dc2626',     // Red
  Balanced: '#10b981',   // Green
  Ghost: '#8b5cf6',      // Purple
};

export default function BotPopulationTrends({ currentStats, loading, error }: BotPopulationTrendsProps) {
  // For now, display current snapshot
  // TODO: Enhance with historical tracking from database
  const snapshotData = [
    {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      Hoarder: currentStats?.bySpecialization.Hoarder || 0,
      Fortress: currentStats?.bySpecialization.Fortress || 0,
      Raider: currentStats?.bySpecialization.Raider || 0,
      Balanced: currentStats?.bySpecialization.Balanced || 0,
      Ghost: currentStats?.bySpecialization.Ghost || 0,
      Total: currentStats?.total || 0,
    }
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm font-semibold mb-2">
          Current Bot Population
        </p>
        <div className="space-y-1">
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-400 text-sm">{entry.name}:</span>
              <span className="text-white font-semibold">{entry.value}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-700">
            <span className="text-gray-400 text-sm">Total:</span>
            <span className="text-white font-semibold">{data.Total}</span>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-3"></div>
          <p className="text-gray-400">Loading bot data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-800 rounded-lg border border-red-500">
        <div className="text-center">
          <p className="text-red-400 font-semibold mb-1">Failed to load bot data</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!currentStats || currentStats.total === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-800 rounded-lg">
        <p className="text-gray-500">No bots in ecosystem</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] bg-gray-800 rounded-lg p-4">
      {/* Current stats display */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Bot Population</h3>
        <div className="text-2xl font-bold text-white">{currentStats.total}</div>
      </div>

      {/* Breakdown grid */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {Object.entries(currentStats.bySpecialization).map(([spec, count]) => (
          <div key={spec} className="text-center p-2 bg-gray-700 rounded">
            <div 
              className="w-2 h-2 rounded-full mx-auto mb-1"
              style={{ backgroundColor: SPEC_COLORS[spec as keyof typeof SPEC_COLORS] }}
            />
            <div className="text-xs text-gray-400">{spec}</div>
            <div className="text-sm font-semibold text-white">{count}</div>
          </div>
        ))}
      </div>

      {/* Placeholder for future trend chart */}
      <div className="h-[140px] bg-gray-700 rounded flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-sm mb-1">📊 Historical Trends</p>
          <p className="text-xs">Coming soon - Historical bot population tracking</p>
        </div>
      </div>

      {/* Specialization legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-gray-400">Hoarder: Resource focus</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-400">Fortress: Defense focus</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-600"></div>
          <span className="text-gray-400">Raider: Attack focus</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-400">Balanced: Mixed strategy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-gray-400">Ghost: Stealth focus</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Currently displays snapshot of current bot population
 * - Future enhancement: Historical tracking in database
 * - Grid layout shows current distribution
 * - Placeholder for future trend line chart
 * - Color-coded by specialization
 * - Dark theme matching admin dashboard
 * 
 * 🎨 STYLING:
 * - Background: gray-800
 * - Hoarder: Yellow (#eab308)
 * - Fortress: Blue (#3b82f6)
 * - Raider: Red (#dc2626)
 * - Balanced: Green (#10b981)
 * - Ghost: Purple (#8b5cf6)
 * 
 * 📊 DATA STRUCTURE:
 * - currentStats: Snapshot from bot-stats endpoint
 * - bySpecialization: Count per bot type
 * - total: Total bot population
 * 
 * 🚀 FUTURE ENHANCEMENTS:
 * - Database collection for historical snapshots
 * - Periodic snapshot creation (hourly/daily)
 * - Line chart showing population changes over time
 * - Trend analysis and predictions
 * 
 * ⚡ CURRENT FUNCTIONALITY:
 * - Live snapshot display
 * - Specialization breakdown
 * - Total population count
 * - Color-coded indicators
 */
