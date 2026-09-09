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
import { Loader2 } from 'lucide-react';

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
  // Custom label for pie segments — recharts' PieLabel contract supplies the
  // segment datum on `payload`, while `value` mirrors `payload.count`
  const renderLabel = (entry: { count?: number; value?: number | string; payload?: { count: number } }) => {
    const count = entry.count ?? (typeof entry.value === 'number' ? entry.value : undefined) ?? entry.payload?.count ?? 0;
    const percent = ((count / totalFlagged) * 100).toFixed(1);
    return `${percent}%`;
  };

  // Custom tooltip — pie entries carry name/value with the datum under `payload`
  interface TooltipEntry {
    name?: string;
    value: number;
    payload: {
      severity: string;
      count: number;
    };
  }
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0];
    const percent = ((data.value / totalFlagged) * 100).toFixed(1);

    return (
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-3 shadow-lg">
        <p className="text-[color:var(--nn-text-secondary)] text-sm font-semibold mb-2">
          {data.name}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[color:var(--nn-text-secondary)] text-sm">Players:</span>
            <span className="text-[color:var(--nn-text-primary)] font-semibold">{data.value}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[color:var(--nn-text-secondary)] text-sm">Percentage:</span>
            <span className="text-[color:var(--nn-text-primary)] font-semibold">{percent}%</span>
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
          <Loader2 className="nn-spin-icon w-12 h-12 text-[color:var(--nn-magenta)] mx-auto mb-3" aria-label="Loading flag breakdown" />
          <p className="text-[color:var(--nn-text-secondary)]">Loading flag data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]">
        <div className="text-center">
          <p className="text-[color:var(--nn-magenta)] font-semibold mb-1">Failed to load flag data</p>
          <p className="text-[color:var(--nn-text-secondary)] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.length === 0 || totalFlagged === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none">
        <div className="text-center">
          <div className="text-[color:var(--nn-green)] text-4xl mb-2">✓</div>
          <p className="text-[color:var(--nn-text-secondary)]">No flagged players</p>
          <p className="text-[color:var(--nn-text-secondary)] text-sm">Anti-cheat system active</p>
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
    <div className="w-full h-[300px] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4 relative">
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
        <div className="text-3xl font-bold text-[color:var(--nn-text-primary)]">{totalFlagged}</div>
        <div className="text-xs text-[color:var(--nn-text-secondary)]">Flagged</div>
      </div>

      {/* Severity explanation */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]"></div>
          <span className="text-[color:var(--nn-text-secondary)]">Critical: Confirmed cheating</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]"></div>
          <span className="text-[color:var(--nn-text-secondary)]">High: Suspicious patterns</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]"></div>
          <span className="text-[color:var(--nn-text-secondary)]">Medium: Anomalies detected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]"></div>
          <span className="text-[color:var(--nn-text-secondary)]">Low: Minor irregularities</span>
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
