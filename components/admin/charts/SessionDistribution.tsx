/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Session Distribution Chart Component
 * 
 * Displays session duration distribution using a bar chart.
 * Color-coded bars indicate session length health (green = normal, red = excessive).
 * Used in admin dashboard analytics section for engagement analysis.
 * 
 * Features:
 * - Vertical bar chart with duration buckets
 * - Color-coded bars based on session length
 * - Responsive design with tooltips
 * - Loading and error states
 */

'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface SessionDistributionProps {
  buckets: Array<{
    label: string;
    range: string;
    count: number;
    uniquePlayers: number;
    color: string;
    avgDuration: number;
  }>;
  period: '24h' | '7d' | '30d';
  loading?: boolean;
  error?: string | null;
}

export default function SessionDistribution({ buckets, period, loading, error }: SessionDistributionProps) {
  // Format duration for display
  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm font-semibold mb-2">
          {data.label}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Sessions:</span>
            <span className="text-white font-semibold">{data.count}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Players:</span>
            <span className="text-white font-semibold">{data.uniquePlayers}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Avg Duration:</span>
            <span className="text-white font-semibold">{formatDuration(data.avgDuration)}</span>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-3"></div>
          <p className="text-gray-400">Loading session data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-800 rounded-lg border border-red-500">
        <div className="text-center">
          <p className="text-red-400 font-semibold mb-1">Failed to load session data</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!buckets || buckets.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-800 rounded-lg">
        <p className="text-gray-500">No session data for this period</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] bg-gray-800 rounded-lg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="label" 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
          />
          <YAxis 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
            label={{ value: 'Sessions', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="square"
          />
          <Bar 
            dataKey="count" 
            name="Session Count"
            radius={[8, 8, 0, 0]}
          >
            {buckets.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Legend explanation */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-green-500"></div>
          <span className="text-gray-400">Normal (0-2h)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-yellow-500"></div>
          <span className="text-gray-400">High (2-4h)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-orange-500"></div>
          <span className="text-gray-400">Very High (4-8h)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-500"></div>
          <span className="text-gray-400">Excessive (8h+)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Uses Recharts BarChart for duration distribution
 * - Color-coded bars via Cell components
 * - Responsive container adapts to parent width
 * - Custom tooltip with formatted durations
 * - Loading spinner and error handling
 * - Dark theme matching admin dashboard
 * 
 * 🎨 STYLING:
 * - Background: gray-800
 * - Bars: Color from bucket data (green → red)
 * - Grid: gray (#374151)
 * - Text: gray-400
 * - Rounded bar tops for visual appeal
 * 
 * 📊 DATA STRUCTURE:
 * - label: Duration range (e.g., "0-1h")
 * - count: Number of sessions in bucket
 * - uniquePlayers: Distinct players
 * - color: Bar color from endpoint
 * - avgDuration: Average session length in ms
 * 
 * 🚨 COLOR CODING:
 * - Green (#22c55e): 0-1h, 1-2h - Normal engagement
 * - Yellow (#eab308): 2-4h - High engagement
 * - Orange (#f97316): 4-8h - Very high engagement
 * - Red (#ef4444, #dc2626): 8h+ - Excessive (monitor for bots)
 * 
 * ⚡ PERFORMANCE:
 * - Static bucket count (6 buckets)
 * - Cell components for individual bar colors
 * - Memoized tooltip formatter
 */
