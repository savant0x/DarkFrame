/**
 * Clan Activity Feed Component
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Displays clan activity history with filtering and categorization. Shows all
 * clan events including wars, distributions, alliances, members, and territory
 * actions with timestamps and participant details.
 * 
 * Features:
 * - Real-time activity updates
 * - Filter by activity type (Wars, Distributions, Alliances, Members, All)
 * - Pagination (load more history)
 * - Color-coded activity types
 * - Participant highlighting
 * - Resource amount display
 * 
 * Props:
 * - clanId: Clan identifier
 * 
 * @module components/ClanActivityFeed
 */

'use client';

import React, { useState, useEffect } from 'react';

interface Activity {
  _id: string;
  type: string;
  playerId?: string;
  username?: string;
  timestamp: string;
  details?: any;
}

interface ClanActivityFeedProps {
  clanId: string;
}

type FilterType = 'ALL' | 'WARS' | 'DISTRIBUTIONS' | 'ALLIANCES' | 'MEMBERS' | 'TERRITORY';

export function ClanActivityFeed({ clanId }: ClanActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadActivities();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      pollNewActivities();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [clanId]);

  useEffect(() => {
    applyFilter();
  }, [activities, filter]);

  const loadActivities = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/clan/activities?clanId=${clanId}&limit=50`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load activities');
      }
      
      setActivities(data.activities || []);
      setHasMore(data.activities?.length === 50);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || isLoading) return;
    
    try {
      setIsLoading(true);
      const nextPage = page + 1;
      
      const response = await fetch(
        `/api/clan/activities?clanId=${clanId}&limit=50&page=${nextPage}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load more activities');
      }
      
      setActivities([...activities, ...(data.activities || [])]);
      setHasMore(data.activities?.length === 50);
      setPage(nextPage);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const pollNewActivities = async () => {
    if (activities.length === 0) return;
    
    try {
      const latestActivity = activities[0];
      
      const response = await fetch(
        `/api/clan/activities?clanId=${clanId}&since=${latestActivity.timestamp}`
      );
      const data = await response.json();
      
      if (response.ok && data.activities?.length > 0) {
        setActivities([...data.activities, ...activities]);
      }
    } catch (err) {
      console.error('Failed to poll activities:', err);
    }
  };

  const applyFilter = () => {
    if (filter === 'ALL') {
      setFilteredActivities(activities);
      return;
    }

    const filterMap: Record<FilterType, string[]> = {
      WARS: ['WAR_DECLARED', 'WAR_ENDED', 'WAR_JOINED'],
      DISTRIBUTIONS: ['FUND_DISTRIBUTION'],
      ALLIANCES: [
        'ALLIANCE_PROPOSED', 'ALLIANCE_ACCEPTED', 'ALLIANCE_BROKEN',
        'CONTRACT_ADDED', 'CONTRACT_REMOVED',
      ],
      MEMBERS: ['MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_PROMOTED', 'MEMBER_DEMOTED', 'MEMBER_KICKED'],
      TERRITORY: ['TERRITORY_CAPTURED', 'TERRITORY_LOST', 'TERRITORY_INCOME_COLLECTED'],
      ALL: [],
    };

    const types = filterMap[filter] || [];
    setFilteredActivities(activities.filter(a => types.includes(a.type)));
  };

  const getActivityIcon = (type: string): string => {
    if (type.startsWith('WAR')) return '⚔️';
    if (type.includes('ALLIANCE') || type.includes('CONTRACT')) return '🤝';
    if (type.includes('DISTRIBUTION')) return '💰';
    if (type.includes('MEMBER')) return '👤';
    if (type.includes('TERRITORY')) return '🏰';
    return '📋';
  };

  const getActivityColor = (type: string): string => {
    if (type.startsWith('WAR')) return 'text-red-400 border-red-500/30';
    if (type.includes('ALLIANCE') || type.includes('CONTRACT')) return 'text-blue-400 border-blue-500/30';
    if (type.includes('DISTRIBUTION')) return 'text-green-400 border-green-500/30';
    if (type.includes('MEMBER')) return 'text-purple-400 border-purple-500/30';
    if (type.includes('TERRITORY')) return 'text-yellow-400 border-yellow-500/30';
    return 'text-gray-400 border-gray-500/30';
  };

  const formatActivityMessage = (activity: Activity): string => {
    const { type, username, details } = activity;
    
    switch (type) {
      case 'WAR_DECLARED':
        return `${username} declared war on ${details?.targetClanName || 'Unknown'}`;
      case 'WAR_ENDED':
        return `War with ${details?.targetClanName || 'Unknown'} has ended`;
      case 'WAR_JOINED':
        return `${username} joined war as ${details?.side || 'ally'}`;
      case 'FUND_DISTRIBUTION':
        return `${username} distributed ${details?.totalAmount || 0} ${details?.resourceType || 'resources'} using ${details?.method || 'Unknown'} method`;
      case 'ALLIANCE_PROPOSED':
        return `${username} proposed ${details?.allianceType || ''} alliance with ${details?.targetClanName || 'Unknown'}`;
      case 'ALLIANCE_ACCEPTED':
        return `Alliance with ${details?.targetClanName || 'Unknown'} has been accepted`;
      case 'ALLIANCE_BROKEN':
        return `${username} broke alliance with ${details?.targetClanName || 'Unknown'}`;
      case 'CONTRACT_ADDED':
        return `${username} added ${details?.contractType || ''} contract to alliance with ${details?.targetClanName || 'Unknown'}`;
      case 'CONTRACT_REMOVED':
        return `${username} removed ${details?.contractType || ''} contract from alliance with ${details?.targetClanName || 'Unknown'}`;
      case 'MEMBER_JOINED':
        return `${username} joined the clan`;
      case 'MEMBER_LEFT':
        return `${username} left the clan`;
      case 'MEMBER_PROMOTED':
        return `${username} was promoted to ${details?.newRole || 'Unknown'}`;
      case 'MEMBER_DEMOTED':
        return `${username} was demoted to ${details?.newRole || 'Unknown'}`;
      case 'MEMBER_KICKED':
        return `${username} was kicked from the clan`;
      case 'TERRITORY_CAPTURED':
        return `${username} captured territory at (${details?.x || 0}, ${details?.y || 0})`;
      case 'TERRITORY_LOST':
        return `Territory at (${details?.x || 0}, ${details?.y || 0}) was lost`;
      case 'TERRITORY_INCOME_COLLECTED':
        return `${username} collected ${details?.metalCollected || 0}M ${details?.energyCollected || 0}E from territories`;
      default:
        return `${username} performed ${type}`;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filters: FilterType[] = ['ALL', 'WARS', 'DISTRIBUTIONS', 'ALLIANCES', 'MEMBERS', 'TERRITORY'];

  return (
    <div className="flex flex-col h-full bg-black/40 rounded border border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold mb-3">Clan Activity Feed</h2>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-900/20 border border-red-500 rounded text-sm">
          {error}
        </div>
      )}

      {/* Activities */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredActivities.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 py-8">
            No activities found
          </div>
        )}
        
        {filteredActivities.map((activity) => (
          <div
            key={activity._id}
            className={`p-3 rounded border-l-4 bg-black/20 ${getActivityColor(activity.type)}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-2 flex-1">
                <span className="text-xl">{getActivityIcon(activity.type)}</span>
                <div className="flex-1">
                  <p className={`font-medium ${getActivityColor(activity.type).split(' ')[0]}`}>
                    {formatActivityMessage(activity)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {hasMore && (
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    </div>
  );
}
