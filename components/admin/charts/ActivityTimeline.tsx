/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Activity Timeline Chart Component
 * 
 * Displays player activity trends over time using a line chart.
 * Shows total actions and unique players per time interval.
 * Used in admin dashboard analytics section.
 * 
 * Features:
 * - Time-series line chart with dual Y-axes
 * - Responsive design with tooltips
 * - Color-coded lines (actions: blue, players: green)
 * - Loading and error states
 */

'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ActivityTimelineProps {
  data: Array<{
    timestamp: number;
    date: string;
    count: number;
    uniquePlayers: number;
  }>;
  period: '24h' | '7d' | '30d';
  loading?: boolean;
  error?: string | null;
}

export default function ActivityTimeline({ data, period, loading, error }: ActivityTimelineProps) {
  // Format timestamp for display
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    if (period === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const date = new Date(data.timestamp);

    return (
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3 shadow-lg">
        <p className="text-[color:var(--nn-text-secondary)] text-sm font-semibold mb-2">
          {period === '24h' 
            ? date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })
          }
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]"></div>
            <span className="text-[color:var(--nn-text-secondary)] text-sm">Actions:</span>
            <span className="text-[color:var(--nn-text-primary)] font-semibold">{data.count}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]"></div>
            <span className="text-[color:var(--nn-text-secondary)] text-sm">Players:</span>
            <span className="text-[color:var(--nn-text-primary)] font-semibold">{data.uniquePlayers}</span>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] mx-auto mb-3"></div>
          <p className="text-[color:var(--nn-text-secondary)]">Loading activity data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]">
        <div className="text-center">
          <p className="text-[color:var(--nn-magenta)] font-semibold mb-1">Failed to load activity data</p>
          <p className="text-[color:var(--nn-text-secondary)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none">
        <p className="text-[color:var(--nn-text-secondary)]">No activity data for this period</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatXAxis}
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
          />
          <YAxis 
            yAxisId="left"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
            label={{ value: 'Actions', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
            label={{ value: 'Players', angle: 90, position: 'insideRight', fill: '#9ca3af' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="circle"
          />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="count" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={false}
            name="Total Actions"
            activeDot={{ r: 6 }}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="uniquePlayers" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={false}
            name="Unique Players"
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Uses Recharts LineChart for time-series display
 * - Dual Y-axes for actions (left) and players (right)
 * - Responsive container adapts to parent width
 * - Custom tooltip with formatted dates
 * - Loading spinner and error handling
 * - Dark theme matching admin dashboard
 * 
 * 🎨 STYLING:
 * - Background: gray-800
 * - Actions line: blue (#3b82f6)
 * - Players line: green (#10b981)
 * - Grid: gray (#374151)
 * - Text: gray-400
 * 
 * 📊 DATA STRUCTURE:
 * - timestamp: Unix timestamp in milliseconds
 * - count: Total actions in interval
 * - uniquePlayers: Number of distinct players
 * 
 * ⚡ PERFORMANCE:
 * - Dots disabled for cleaner look with many data points
 * - MonotoneLine type for smooth interpolation
 * - Memoized formatters for efficiency
 */
