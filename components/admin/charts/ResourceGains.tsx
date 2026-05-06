/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Resource Gains Chart Component
 * 
 * Displays cumulative resource accumulation over time using stacked area chart.
 * Shows metal (blue) and energy (yellow) gains separately and combined.
 * Used in admin dashboard analytics section.
 * 
 * Features:
 * - Stacked area chart for resource types
 * - Responsive design with tooltips
 * - Color-coded areas (metal: blue, energy: yellow)
 * - Loading and error states
 */

'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatNumberAbbreviated } from '@/utils/formatting';

interface ResourceGainsProps {
  data: Array<{
    timestamp: number;
    date: string;
    metal: number;
    energy: number;
    total: number;
    sessions: number;
  }>;
  period: '24h' | '7d' | '30d';
  loading?: boolean;
  error?: string | null;
}

export default function ResourceGains({ data, period, loading, error }: ResourceGainsProps) {
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
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm font-semibold mb-2">
          {period === '24h' 
            ? date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })
          }
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-400 text-sm">Metal:</span>
            <span className="text-white font-semibold">{formatNumberAbbreviated(data.metal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-400 text-sm">Energy:</span>
            <span className="text-white font-semibold">{formatNumberAbbreviated(data.energy)}</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-gray-700">
            <span className="text-gray-400 text-sm">Total:</span>
            <span className="text-white font-semibold">{formatNumberAbbreviated(data.total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Sessions:</span>
            <span className="text-white font-semibold">{data.sessions}</span>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-3"></div>
          <p className="text-gray-400">Loading resource data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-800 rounded-lg border border-red-500">
        <div className="text-center">
          <p className="text-red-400 font-semibold mb-1">Failed to load resource data</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-800 rounded-lg">
        <p className="text-gray-500">No resource data for this period</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] bg-gray-800 rounded-lg p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorMetal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#eab308" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatXAxis}
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
          />
          <YAxis 
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af' }}
            tickFormatter={formatNumberAbbreviated}
            label={{ value: 'Resources', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="circle"
          />
          <Area 
            type="monotone" 
            dataKey="metal" 
            stackId="1"
            stroke="#3b82f6" 
            strokeWidth={2}
            fill="url(#colorMetal)"
            name="Metal Gained"
          />
          <Area 
            type="monotone" 
            dataKey="energy" 
            stackId="1"
            stroke="#eab308" 
            strokeWidth={2}
            fill="url(#colorEnergy)"
            name="Energy Gained"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 📝 IMPLEMENTATION NOTES:
 * - Uses Recharts AreaChart for stacked resource display
 * - Gradient fills for visual appeal
 * - Responsive container adapts to parent width
 * - Custom tooltip with formatted numbers
 * - Loading spinner and error handling
 * - Dark theme matching admin dashboard
 * 
 * 🎨 STYLING:
 * - Background: gray-800
 * - Metal area: blue (#3b82f6) with gradient
 * - Energy area: yellow (#eab308) with gradient
 * - Grid: gray (#374151)
 * - Text: gray-400
 * 
 * 📊 DATA STRUCTURE:
 * - timestamp: Unix timestamp in milliseconds
 * - metal: Metal gained in interval
 * - energy: Energy gained in interval
 * - total: Combined resources
 * - sessions: Number of sessions in interval
 * 
 * ⚡ PERFORMANCE:
 * - Stacked areas for cumulative view
 * - MonotoneArea type for smooth interpolation
 * - Number formatting for readability (K/M suffixes)
 */

