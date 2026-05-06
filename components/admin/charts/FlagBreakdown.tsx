/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Flag Breakdown Chart Component
 * 
 * Displays anti-cheat flag severity distribution using a pie chart.
 * Shows proportion of flags by severity level (CRITICAL, HIGH, MEDIUM, LOW).
 * Used in admin dashboard analytics section for anti-cheat monitoring.
 * 
 * Features:
 * - Pie chart with severity-based color coding
 * - Percentage labels on segments
 * - Center label with total flagged players
 * - Responsive design with legend
 */

'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FlagBreakdownProps {
  data: Array<{
    severity: string;
    count: number;
  }>;
  totalFlagged: number;
  loading?: boolean;
  error?: string | null;
}

const COLORS = {
  CRITICAL: '#dc2626',   // Red
  HIGH: '#f97316',       // Orange
  MEDIUM: '#eab308',     // Yellow
  LOW: '#3b82f6'         // Blue
};

export default function FlagBreakdown({ data, totalFlagged, loading, error }: FlagBreakdownProps) {
  // Custom label for pie segments
  const renderLabel = (entry: any) => {
    const percent = ((entry.count / totalFlagged) * 100).toFixed(1);
    return `${percent}%`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0];
    const percent = ((data.value / totalFlagged) * 100).toFixed(1);

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm font-semibold mb-2">
          {data.name}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Players:</span>
            <span className="text-white font-semibold">{data.value}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Percentage:</span>
            <span className="text-white font-semibold">{percent}%</span>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-3"></div>
          <p className="text-gray-400">Loading flag data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-800 rounded-lg border border-red-500">
        <div className="text-center">
          <p className="text-red-400 font-semibold mb-1">Failed to load flag data</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.length === 0 || totalFlagged === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="text-green-500 text-4xl mb-2">✓</div>
          <p className="text-gray-400">No flagged players</p>
          <p className="text-gray-500 text-sm">Anti-cheat system active</p>
        </div>
      </div>
    );
  }

  // Transform data for pie chart
  const chartData = data.map(item => ({
    name: item.severity,
    value: item.count,
    color: COLORS[item.severity as keyof typeof COLORS] || '#6b7280'
  }));

  return (
    <div className="w-full h-[300px] bg-gray-800 rounded-lg p-4 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconType="circle"
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center label */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <div className="text-3xl font-bold text-white">{totalFlagged}</div>
        <div className="text-xs text-gray-400">Flagged</div>
      </div>

      {/* Severity explanation */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-600"></div>
          <span className="text-gray-400">Critical: Confirmed cheating</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span className="text-gray-400">High: Suspicious patterns</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-gray-400">Medium: Anomalies detected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-400">Low: Minor irregularities</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Uses Recharts PieChart for severity distribution
 * - Color-coded segments via Cell components
 * - Center label showing total flagged count
 * - Custom tooltip with percentages
 * - Loading spinner and error handling
 * - Special "no data" state with checkmark
 * - Dark theme matching admin dashboard
 * 
 * 🎨 STYLING:
 * - Background: gray-800
 * - CRITICAL: Red (#dc2626)
 * - HIGH: Orange (#f97316)
 * - MEDIUM: Yellow (#eab308)
 * - LOW: Blue (#3b82f6)
 * 
 * 📊 DATA STRUCTURE:
 * - severity: Flag severity level
 * - count: Number of players with this severity
 * - totalFlagged: Total flagged players (for percentages)
 * 
 * 🚨 SEVERITY LEVELS:
 * - CRITICAL: Confirmed cheating, immediate action
 * - HIGH: Suspicious patterns, manual review
 * - MEDIUM: Anomalies detected, monitor closely
 * - LOW: Minor irregularities, informational
 * 
 * ⚡ PERFORMANCE:
 * - Static color mapping
 * - Percentage calculation on render
 * - Center label via absolute positioning
 */
