/**
 * @file components/clan/ClanMembersPanel.tsx
 * @created 2025-10-19
 * @overview Clan member management panel with role-based actions
 * 
 * OVERVIEW:
 * Comprehensive member management interface providing:
 * - Full member list with roles and online status
 * - Promote/demote functionality (leader/officer only)
 * - Kick member capability with confirmation
 * - Role badges and last active timestamps
 * - Permission-based action visibility
 * - Member search and filtering
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 2 - Management & Banking UI
 * - Uses ROLE_PERMISSIONS from clan.types.ts for access control
 * - Real-time updates via refresh callback
 * - Confirmation dialogs for destructive actions
 */

'use client';

import React, { useState } from 'react';
import { Button, Badge, Input } from '@/components/ui';
import {
  Users,
  Crown,
  Shield,
  Star,
  User,
  ChevronUp,
  ChevronDown,
  UserX,
  Search,
  Clock,
  Circle
} from 'lucide-react';
import { toast } from 'sonner';
import type { Clan, ClanMember } from '@/types/clan.types';
import { ClanRole, ROLE_PERMISSIONS } from '@/types/clan.types';

interface ClanMembersPanelProps {
  clan: Clan;
  currentUserRole: ClanRole;
  currentUsername: string;
  onRefresh: () => void;
}

/**
 * Role display configuration
 */
const ROLE_CONFIG: Record<ClanRole, {
  icon: any;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  [ClanRole.LEADER]: {
    icon: Crown,
    label: 'Leader',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30'
  },
  [ClanRole.CO_LEADER]: {
    icon: Crown,
    label: 'Co-Leader',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30'
  },
  [ClanRole.OFFICER]: {
    icon: Shield,
    label: 'Officer',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30'
  },
  [ClanRole.ELITE]: {
    icon: Star,
    label: 'Elite',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30'
  },
  [ClanRole.MEMBER]: {
    icon: User,
    label: 'Member',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30'
  },
  [ClanRole.RECRUIT]: {
    icon: User,
    label: 'Recruit',
    color: 'text-gray-500',
    bgColor: 'bg-gray-600/20',
    borderColor: 'border-gray-600/30'
  }
};

export default function ClanMembersPanel({
  clan,
  currentUserRole,
  currentUsername,
  onRefresh
}: ClanMembersPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Get current user's permissions
  const permissions = ROLE_PERMISSIONS[currentUserRole];

  /**
   * Filters members based on search term
   */
  const filteredMembers = clan.members.filter(member =>
    member.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Sorts members by role hierarchy
   */
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const roleOrder = ['LEADER', 'CO_LEADER', 'OFFICER', 'ELITE', 'MEMBER', 'RECRUIT'];
    return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
  });

  /**
   * Handles promoting a member
   */
  const handlePromote = async (targetUsername: string, currentRole: ClanRole) => {
    if (!canPromote(currentRole)) {
      toast.error('You cannot promote this member');
      return;
    }

    const roleOrder: ClanRole[] = [ClanRole.RECRUIT, ClanRole.MEMBER, ClanRole.ELITE, ClanRole.OFFICER, ClanRole.CO_LEADER];
    const currentIndex = roleOrder.indexOf(currentRole);
    const newRole = roleOrder[currentIndex + 1];

    const confirmed = window.confirm(
      `Promote ${targetUsername} to ${ROLE_CONFIG[newRole].label}?`
    );
    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      const response = await fetch('/api/clan/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId: clan._id?.toString(),
          targetUsername,
          newRole
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to promote member');
      }

      toast.success(`${targetUsername} promoted to ${ROLE_CONFIG[newRole].label}`);
      onRefresh();
    } catch (error: any) {
      console.error('Error promoting member:', error);
      toast.error(error.message || 'Failed to promote member');
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Handles demoting a member
   */
  const handleDemote = async (targetUsername: string, currentRole: ClanRole) => {
    if (!canDemote(currentRole)) {
      toast.error('You cannot demote this member');
      return;
    }

    const roleOrder: ClanRole[] = [ClanRole.RECRUIT, ClanRole.MEMBER, ClanRole.ELITE, ClanRole.OFFICER, ClanRole.CO_LEADER];
    const currentIndex = roleOrder.indexOf(currentRole);
    const newRole = roleOrder[currentIndex - 1];

    const confirmed = window.confirm(
      `Demote ${targetUsername} to ${ROLE_CONFIG[newRole].label}?`
    );
    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      const response = await fetch('/api/clan/demote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId: clan._id?.toString(),
          targetUsername,
          newRole
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to demote member');
      }

      toast.success(`${targetUsername} demoted to ${ROLE_CONFIG[newRole].label}`);
      onRefresh();
    } catch (error: any) {
      console.error('Error demoting member:', error);
      toast.error(error.message || 'Failed to demote member');
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Handles kicking a member
   */
  const handleKick = async (targetUsername: string) => {
    const confirmed = window.confirm(
      `Kick ${targetUsername} from the clan? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      const response = await fetch('/api/clan/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId: clan._id?.toString(),
          targetUsername
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to kick member');
      }

      toast.success(`${targetUsername} has been removed from the clan`);
      onRefresh();
    } catch (error: any) {
      console.error('Error kicking member:', error);
      toast.error(error.message || 'Failed to kick member');
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Checks if current user can promote target role
   */
  const canPromote = (targetRole: ClanRole): boolean => {
    if (targetRole === ClanRole.LEADER) return false; // Can't promote leader
    if (targetRole === ClanRole.CO_LEADER) return permissions.canPromoteToCoLeader;
    if (targetRole === ClanRole.OFFICER || targetRole === ClanRole.ELITE) return permissions.canPromoteToOfficer;
    return permissions.canPromoteToElite;
  };

  /**
   * Checks if current user can demote target role
   */
  const canDemote = (targetRole: ClanRole): boolean => {
    if (targetRole === ClanRole.RECRUIT) return false; // Can't demote below recruit
    if (targetRole === ClanRole.LEADER) return false; // Can't demote leader
    return permissions.canDemote;
  };

  /**
   * Checks if member is online (last active within 5 minutes)
   */
  const isOnline = (lastActive: Date): boolean => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(lastActive) > fiveMinutesAgo;
  };

  /**
   * Formats last active timestamp
   */
  const formatLastActive = (lastActive: Date): string => {
    const now = Date.now();
    const diff = now - new Date(lastActive).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 5) return 'Online';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Clan Members
          </h3>
          <p className="text-sm text-gray-400">
            {clan.members.length} / {clan.maxMembers} members
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search members..."
          className="pl-10"
        />
      </div>

      {/* Member List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {sortedMembers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No members found
          </div>
        ) : (
          sortedMembers.map((member) => {
            const roleConfig = ROLE_CONFIG[member.role];
            const RoleIcon = roleConfig.icon;
            const isCurrentUser = member.username === currentUsername;
            const online = isOnline(member.lastActive);

            return (
              <div
                key={member.playerId}
                className={`bg-slate-800/50 rounded-lg p-3 border ${roleConfig.borderColor} hover:bg-slate-800/70 transition-colors`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Member Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Online Status */}
                    <div className="relative">
                      <RoleIcon className={`w-5 h-5 ${roleConfig.color}`} />
                      <Circle
                        className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 ${
                          online ? 'fill-green-400 text-green-400' : 'fill-gray-600 text-gray-600'
                        }`}
                      />
                    </div>

                    {/* Name & Badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold truncate">
                          {member.username}
                          {isCurrentUser && (
                            <span className="text-cyan-400 text-xs ml-1">(You)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Badge variant="default" className={`${roleConfig.bgColor} ${roleConfig.color} text-xs`}>
                          {roleConfig.label}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatLastActive(member.lastActive)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (only if not current user and have permissions) */}
                  {!isCurrentUser && (
                    <div className="flex items-center gap-1">
                      {/* Promote Button */}
                      {canPromote(member.role) && member.role !== ClanRole.CO_LEADER && (
                        <Button
                          onClick={() => handlePromote(member.username, member.role)}
                          variant="secondary"
                          size="sm"
                          disabled={isActionLoading}
                          title="Promote"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Demote Button */}
                      {canDemote(member.role) && (
                        <Button
                          onClick={() => handleDemote(member.username, member.role)}
                          variant="secondary"
                          size="sm"
                          disabled={isActionLoading}
                          title="Demote"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Kick Button */}
                      {permissions.canKick && member.role !== ClanRole.LEADER && (
                        <Button
                          onClick={() => handleKick(member.username)}
                          variant="danger"
                          size="sm"
                          disabled={isActionLoading}
                          title="Kick from clan"
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * - Real-time member sorting by role hierarchy
 * - Online status detection (last active within 5 minutes)
 * - Permission-based action visibility using ROLE_PERMISSIONS
 * - Confirmation dialogs for all destructive actions
 * - Loading states prevent duplicate actions
 * - Search functionality for large member lists
 * 
 * FUTURE ENHANCEMENTS:
 * - Member stats display (contributions, battles, etc.)
 * - Bulk actions (promote multiple, kick multiple)
 * - Member activity timeline
 * - Private messaging to members
 */
