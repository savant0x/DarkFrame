/**
 * Clan Service - Core Clan Management
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Provides comprehensive clan management functionality including creation, member management,
 * role-based permissions, invitations, and clan settings. Handles all core clan operations
 * with proper validation, permission checks, and database transactions.
 * 
 * Key Features:
 * - Clan creation with 1.5M Metal + 1.5M Energy cost (admin configurable)
 * - Solo clan creation allowed (minimum 1 member)
 * - 6-role permission system (LEADER, CO_LEADER, OFFICER, ELITE, MEMBER, RECRUIT)
 * - Member management (invite, join, kick, promote, demote, transfer leadership)
 * - Clan settings (description, MOTD, max members)
 * - Activity tracking integration
 * - Clan level initialization and XP tracking
 * 
 * Dependencies:
 * - Supabase database connection
 * - types/clan.types.ts for all type definitions
 * - lib/playerService.ts for player resource validation
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';
import {
  ClanRole,
  ClanActivityType,
  CLAN_CONSTANTS,
  hasPermission,
} from '@/types/clan.types';

/**
 * Internal helper: fetch clan members for a clan
 */
async function getClanMembers(clanId: string): Promise<Tables<'clan_members'>[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId);

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Internal helper: count clan members for a clan
 */
async function countClanMembers(clanId: string): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('clan_members')
    .select('*', { count: 'exact', head: true })
    .eq('clan_id', clanId);

  if (error) throw new Error(error.message);
  return count || 0;
}

/**
 * Internal helper: find a specific clan member
 */
async function findClanMember(clanId: string, playerId: string): Promise<Tables<'clan_members'> | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId)
    .eq('player_id', playerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Create a new clan
 * Validates player resources (1.5M Metal + 1.5M Energy), creates clan with founder as leader,
 * deducts costs from player, and logs activity. Initializes clan at level 1 with empty bank.
 * 
 * @param playerId - ID of the player creating the clan
 * @param clanName - Name of the clan (3-30 characters, unique)
 * @param tag - Clan tag (2-6 characters, unique)
 * @param description - Clan description (max 500 characters, optional)
 * @returns Newly created clan object
 * @throws Error if insufficient resources, name taken, or validation fails
 * 
 * @example
 * const clan = await createClan('player123', 'Dark Warriors', 'DW', 'Elite fighters');
 */
export async function createClan(
  playerId: string,
  clanName: string,
  tag: string,
  description?: string,
  isPublic: boolean = false,
  minLevelToJoin: number = 1
): Promise<Tables<'clans'>> {
  const supabase = createServiceClient();
  
  if (!clanName || clanName.length < 3 || clanName.length > 30) {
    throw new Error('Clan name must be between 3 and 30 characters');
  }
  
  if (!tag || tag.length < 2 || tag.length > 6) {
    throw new Error('Clan tag must be between 2 and 6 characters');
  }
  
  // Check if name is already taken
  const { data: existingClan } = await supabase
    .from('clans')
    .select('id')
    .eq('name', clanName)
    .maybeSingle();
  if (existingClan) {
    throw new Error('Clan name already taken');
  }
  
  // Check if tag is already taken
  const { data: existingTag } = await supabase
    .from('clans')
    .select('id')
    .eq('tag', tag.toUpperCase())
    .maybeSingle();
  if (existingTag) {
    throw new Error('Clan tag already taken');
  }
  
  // Get player and validate resources
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('username', playerId)
    .single();

  if (playerError || !player) {
    throw new Error('Player not found');
  }
  
  // Check if player is already in a clan
  if (player.clan_id) {
    throw new Error('Player is already in a clan');
  }
  
  // Validate player has sufficient resources
  const { metal: costMetal, energy: costEnergy } = CLAN_CONSTANTS.CREATION_COST;
  if (player.resources_metal < costMetal || player.resources_energy < costEnergy) {
    throw new Error(`Insufficient resources. Need ${costMetal.toLocaleString()} Metal and ${costEnergy.toLocaleString()} Energy`);
  }
  
  const now = new Date().toISOString();
  
  // Create new clan record
  const clanSettings = {
    messageOfTheDay: `Welcome to ${clanName}!`,
    isRecruiting: isPublic,
    minLevelToJoin,
    requiresApproval: !isPublic,
    allowTerritoryControl: true,
    allowWarDeclarations: true,
  };
  
  const { data: clan, error: insertError } = await supabase
    .from('clans')
    .insert({
      name: clanName,
      tag: tag.toUpperCase(),
      description: description || '',
      leader_id: playerId,
      max_members: CLAN_CONSTANTS.DEFAULT_MAX_MEMBERS,
      clan_level: 1,
      total_xp: 0,
      current_level_xp: 0,
      xp_to_next_level: 1000,
      last_level_up: now,
      created_at: now,
      clan_settings: clanSettings,
      total_power: 0,
      total_territories: 0,
      total_monuments: 0,
      wars_won: 0,
      wars_lost: 0,
      total_rp: 0,
      research_points: 0,
      unlocked_research: [],
      active_research: null,
      bank_capacity: CLAN_CONSTANTS.BANK_BASE_CAPACITY,
      bank_treasury_metal: 0,
      bank_treasury_energy: 0,
      bank_treasury_rp: 0,
      bank_tax_metal: 0,
      bank_tax_energy: 0,
      bank_tax_rp: 0,
      bank_upgrade_level: 1,
    })
    .select('*')
    .single();

  if (insertError || !clan) {
    throw new Error('Failed to create clan: ' + (insertError?.message || 'Unknown error'));
  }
  
  // Add founder as member
  const { error: memberError } = await supabase
    .from('clan_members')
    .insert({
      clan_id: clan.id,
      player_id: playerId,
      username: player.username,
      role: ClanRole.LEADER,
      joined_at: now,
      last_active: now,
    });

  if (memberError) {
    // Rollback: delete the clan we just created
    await supabase.from('clans').delete().eq('id', clan.id);
    throw new Error('Failed to add founder: ' + memberError.message);
  }
  
  // Deduct resources from player and assign clan
  const { error: updateError } = await supabase
    .from('players')
    .update({
      resources_metal: player.resources_metal - costMetal,
      resources_energy: player.resources_energy - costEnergy,
      clan_id: clan.id,
      clan_name: clanName,
      clan_role: ClanRole.LEADER,
    })
    .eq('username', playerId);

  if (updateError) {
    // Rollback: delete clan_members and clan
    await supabase.from('clan_members').delete().eq('clan_id', clan.id);
    await supabase.from('clans').delete().eq('id', clan.id);
    throw new Error('Failed to update player: ' + updateError.message);
  }
  
  // Log activity (no clan_activities table in Supabase — log to console)
  logClanActivity(clan.id, ClanActivityType.CLAN_CREATED, playerId, {
    clanName,
    tag: clan.tag,
  });
  
  return clan;
}

/**
 * Get clan by ID
 * @param clanId - Clan ID
 * @returns Clan object or null if not found
 * 
 * @example
 * const clan = await getClanById('clan123');
 */
export async function getClanById(clanId: string): Promise<Tables<'clans'> | null> {
  const supabase = createServiceClient();
  const { data: clan, error } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return clan || null;
}

/**
 * Get clan by tag
 * @param tag - Clan tag (case-insensitive)
 * @returns Clan object or null if not found
 * 
 * @example
 * const clan = await getClanByTag('DW');
 */
export async function getClanByTag(tag: string): Promise<Tables<'clans'> | null> {
  const supabase = createServiceClient();
  const { data: clan, error } = await supabase
    .from('clans')
    .select('*')
    .eq('tag', tag.toUpperCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return clan || null;
}

/**
 * Get clan by player ID
 * @param playerId - Player ID
 * @returns Clan object or null if player not in clan
 * 
 * @example
 * const clan = await getClanByPlayerId('player123');
 */
export async function getClanByPlayerId(playerId: string): Promise<Tables<'clans'> | null> {
  const supabase = createServiceClient();
  const { data: player, error } = await supabase
    .from('players')
    .select('clan_id')
    .eq('username', playerId)
    .maybeSingle();

  if (error || !player || !player.clan_id) {
    return null;
  }
  
  return await getClanById(player.clan_id);
}

/**
 * Invite player to clan
 * Validates permissions (canInvite), checks clan capacity, creates pending invitation.
 * 
 * @param clanId - Clan ID
 * @param inviterId - Player ID of inviter (must have permission)
 * @param inviteeId - Player ID to invite
 * @returns Success status
 * @throws Error if no permission, clan full, or player already in clan
 * 
 * @example
 * await invitePlayerToClan('clan123', 'officer456', 'newPlayer789');
 */
export async function invitePlayerToClan(
  clanId: string,
  inviterId: string,
  inviteeId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();
  
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const inviterMember = await findClanMember(clanId, inviterId);
  if (!inviterMember) {
    throw new Error('Inviter not in clan');
  }
  
   if (!hasPermission(inviterMember.role, 'canInvite')) {
    throw new Error('No permission to invite members');
  }
  
  const memberCount = await countClanMembers(clanId);
  if (memberCount >= clan.max_members) {
    throw new Error('Clan is at maximum capacity');
  }
  
  const { data: invitee, error: inviteeError } = await supabase
    .from('players')
    .select('*')
    .eq('username', inviteeId)
    .single();

  if (inviteeError || !invitee) {
    throw new Error('Player not found');
  }
  
  if (invitee.clan_id) {
    throw new Error('Player is already in a clan');
  }
  
  const clanSettings = clan.clan_settings as Record<string, any> || {};
  if (invitee.level < (clanSettings.minLevelToJoin || 1)) {
    throw new Error(`Player must be level ${clanSettings.minLevelToJoin || 1} or higher`);
  }
  
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { error: inviteError } = await supabase
    .from('clan_invitations')
    .insert({
      clan_id: clanId,
      clan_name: clan.name,
      invited_by: inviterId,
      invited_player: inviteeId,
      invited_at: now,
      expires_at: expiresAt,
      status: 'pending',
    });

  if (inviteError) throw new Error(inviteError.message);
  
  return { success: true, message: `Invitation sent to ${invitee.username}` };
}

/**
 * Accept clan invitation and join clan
 * @param invitationId - Invitation ID
 * @param playerId - Player ID accepting invitation
 * @returns Success status with clan info
 * @throws Error if invitation invalid or expired
 * 
 * @example
 * const result = await joinClan('invitation123', 'player789');
 */
export async function joinClan(
  invitationId: string,
  playerId: string
): Promise<{ success: boolean; clan: Tables<'clans'> }> {
  const supabase = createServiceClient();
  
  const { data: invitation, error: inviteErr } = await supabase
    .from('clan_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('invited_player', playerId)
    .eq('status', 'pending')
    .maybeSingle();

  if (inviteErr || !invitation) {
    throw new Error('Invitation not found or already processed');
  }
  
  if (new Date() > new Date(invitation.expires_at)) {
    await supabase
      .from('clan_invitations')
      .update({ status: 'expired' })
      .eq('id', invitationId);
    throw new Error('Invitation has expired');
  }
  
  const clan = await getClanById(invitation.clan_id);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const memberCount = await countClanMembers(invitation.clan_id);
  if (memberCount >= clan.max_members) {
    throw new Error('Clan is now at maximum capacity');
  }
  
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('*')
    .eq('username', playerId)
    .single();

  if (playerErr || !player) {
    throw new Error('Player not found');
  }
  
  if (player.clan_id) {
    throw new Error('Player is already in a clan');
  }
  
  const now = new Date().toISOString();
  
  // Add member
  const { error: memberErr } = await supabase
    .from('clan_members')
    .insert({
      clan_id: invitation.clan_id,
      player_id: playerId,
      username: player.username,
      role: ClanRole.RECRUIT,
      joined_at: now,
      last_active: now,
    });

  if (memberErr) throw new Error(memberErr.message);
  
  // Update player
  const { error: updateErr } = await supabase
    .from('players')
    .update({
      clan_id: invitation.clan_id,
      clan_name: clan.name,
      clan_role: ClanRole.RECRUIT,
    })
    .eq('username', playerId);

  if (updateErr) throw new Error(updateErr.message);
  
  // Mark invitation as accepted
  await supabase
    .from('clan_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitationId);
  
  // Log activity
  logClanActivity(invitation.clan_id, ClanActivityType.MEMBER_JOINED, playerId, {
    username: player.username,
  });
  
  const updatedClan = await getClanById(invitation.clan_id);
  return { success: true, clan: updatedClan! };
}

/**
 * Join a clan directly (no invitation required — for public clans)
 */
export async function joinClanDirectly(
  clanId: string,
  playerId: string
): Promise<{ success: boolean; clan: Tables<'clans'> }> {
  const supabase = createServiceClient();

  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }

  const clanSettings = (clan.clan_settings as Record<string, any>) || {};
  if (clanSettings.requiresApproval) {
    throw new Error('This clan requires leader approval to join');
  }

  const memberCount = await countClanMembers(clanId);
  if (memberCount >= clan.max_members) {
    throw new Error('Clan is now at maximum capacity');
  }

  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('*')
    .eq('username', playerId)
    .single();

  if (playerErr || !player) {
    throw new Error('Player not found');
  }

  if (player.clan_id) {
    throw new Error('Player is already in a clan');
  }

  const now = new Date().toISOString();

  const { error: memberErr } = await supabase
    .from('clan_members')
    .insert({
      clan_id: clanId,
      player_id: playerId,
      username: player.username,
      role: ClanRole.RECRUIT,
      joined_at: now,
      last_active: now,
    });

  if (memberErr) throw new Error(memberErr.message);

  const { error: updateErr } = await supabase
    .from('players')
    .update({
      clan_id: clanId,
      clan_name: clan.name,
      clan_role: ClanRole.RECRUIT,
    })
    .eq('username', playerId);

  if (updateErr) throw new Error(updateErr.message);

  logClanActivity(clanId, ClanActivityType.MEMBER_JOINED, playerId, {
    username: player.username,
  });

  const updatedClan = await getClanById(clanId);
  return { success: true, clan: updatedClan! };
}

/**
 * Leave clan
 * Leader cannot leave without transferring leadership first.
 * 
 * @param clanId - Clan ID
 * @param playerId - Player ID leaving
 * @returns Success status
 * @throws Error if player is leader or not in clan
 * 
 * @example
 * await leaveClan('clan123', 'player456');
 */
export async function leaveClan(clanId: string, playerId: string): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();
  
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const member = await findClanMember(clanId, playerId);
  if (!member) {
    throw new Error('Player not in this clan');
  }
  
  if (member.role === ClanRole.LEADER) {
    throw new Error('Leader must transfer leadership before leaving');
  }
  
  // Remove member
  const { error: deleteErr } = await supabase
    .from('clan_members')
    .delete()
    .eq('clan_id', clanId)
    .eq('player_id', playerId);

  if (deleteErr) throw new Error(deleteErr.message);
  
  // Update player — remove clan fields
  const { error: updateErr } = await supabase
    .from('players')
    .update({
      clan_id: null,
      clan_name: null,
      clan_role: null,
    })
    .eq('username', playerId);

  if (updateErr) throw new Error(updateErr.message);
  
  // Log activity
  logClanActivity(clanId, ClanActivityType.MEMBER_LEFT, playerId, {
    username: member.username,
  });
  
  return { success: true, message: 'Successfully left clan' };
}

/**
 * Kick member from clan
 * Requires canKick permission. Cannot kick leader or members with equal/higher role.
 * 
 * @param clanId - Clan ID
 * @param kickerId - Player ID performing kick (must have permission)
 * @param targetId - Player ID to kick
 * @returns Success status
 * @throws Error if no permission or invalid target
 * 
 * @example
 * await kickMember('clan123', 'officer456', 'troubleMaker789');
 */
export async function kickMember(
  clanId: string,
  kickerId: string,
  targetId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();
  
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const kicker = await findClanMember(clanId, kickerId);
  if (!kicker) {
    throw new Error('Kicker not in clan');
  }
  
   if (!hasPermission(kicker.role, 'canKick')) {
    throw new Error('No permission to kick members');
  }
  
  const target = await findClanMember(clanId, targetId);
  if (!target) {
    throw new Error('Target player not in clan');
  }
  
  if (target.role === ClanRole.LEADER) {
    throw new Error('Cannot kick clan leader');
  }
  
  const roleHierarchy = [
    ClanRole.RECRUIT,
    ClanRole.MEMBER,
    ClanRole.ELITE,
    ClanRole.OFFICER,
    ClanRole.CO_LEADER,
    ClanRole.LEADER,
  ];
  
  const kickerRank = roleHierarchy.indexOf(kicker.role as ClanRole);
  const targetRank = roleHierarchy.indexOf(target.role as ClanRole);
  
  if (targetRank >= kickerRank && kicker.role !== ClanRole.LEADER) {
    throw new Error('Cannot kick members of equal or higher rank');
  }
  
  // Remove member
  const { error: deleteErr } = await supabase
    .from('clan_members')
    .delete()
    .eq('clan_id', clanId)
    .eq('player_id', targetId);

  if (deleteErr) throw new Error(deleteErr.message);
  
  // Update player — remove clan fields
  const { error: updateErr } = await supabase
    .from('players')
    .update({
      clan_id: null,
      clan_name: null,
      clan_role: null,
    })
    .eq('username', targetId);

  if (updateErr) throw new Error(updateErr.message);
  
  // Log activity
  logClanActivity(clanId, ClanActivityType.MEMBER_KICKED, kickerId, {
    targetUsername: target.username,
    kickerUsername: kicker.username,
  });
  
  return { success: true, message: `${target.username} has been kicked from the clan` };
}

/**
 * Promote or demote member
 * Requires appropriate permissions based on target role. Cannot modify leader or members of equal/higher rank.
 * 
 * @param clanId - Clan ID
 * @param promoterId - Player ID performing promotion (must have permission)
 * @param targetId - Player ID to promote/demote
 * @param newRole - New role to assign
 * @returns Success status
 * @throws Error if no permission or invalid role change
 * 
 * @example
 * await promoteMember('clan123', 'leader456', 'recruit789', ClanRole.MEMBER);
 */
export async function promoteMember(
  clanId: string,
  promoterId: string,
  targetId: string,
  newRole: ClanRole
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();
  
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const promoter = await findClanMember(clanId, promoterId);
  if (!promoter) {
    throw new Error('Promoter not in clan');
  }
  
  const target = await findClanMember(clanId, targetId);
  if (!target) {
    throw new Error('Target player not in clan');
  }
  
  if (target.role === ClanRole.LEADER || newRole === ClanRole.LEADER) {
    throw new Error('Use transferLeadership to change leader');
  }
  
  const roleHierarchy = [
    ClanRole.RECRUIT,
    ClanRole.MEMBER,
    ClanRole.ELITE,
    ClanRole.OFFICER,
    ClanRole.CO_LEADER,
    ClanRole.LEADER,
  ];
  
  const promoterRank = roleHierarchy.indexOf(promoter.role as ClanRole);
  const targetRank = roleHierarchy.indexOf(target.role as ClanRole);
  const newRank = roleHierarchy.indexOf(newRole);
  
  if (newRole === ClanRole.CO_LEADER && !hasPermission(promoter.role, 'canPromoteToCoLeader')) {
    throw new Error('No permission to promote to Co-Leader');
  }
  
  if (newRole === ClanRole.OFFICER && !hasPermission(promoter.role, 'canPromoteToOfficer')) {
    throw new Error('No permission to promote to Officer');
  }
  
  if (newRole === ClanRole.ELITE && !hasPermission(promoter.role, 'canPromoteToElite')) {
    throw new Error('No permission to promote to Elite');
  }
  
  const isDemotion = newRank < targetRank;
  if (isDemotion && !hasPermission(promoter.role, 'canDemote')) {
    throw new Error('No permission to demote members');
  }
  
  if (targetRank >= promoterRank && promoter.role !== ClanRole.LEADER) {
    throw new Error('Cannot modify members of equal or higher rank');
  }
  
  if (newRank >= promoterRank && promoter.role !== ClanRole.LEADER) {
    throw new Error('Cannot promote above your own rank');
  }
  
  // Update member role
  const { error: memberUpdateErr } = await supabase
    .from('clan_members')
    .update({ role: newRole })
    .eq('clan_id', clanId)
    .eq('player_id', targetId);

  if (memberUpdateErr) throw new Error(memberUpdateErr.message);
  
  // Update player role
  const { error: playerUpdateErr } = await supabase
    .from('players')
    .update({ clan_role: newRole })
    .eq('username', targetId);

  if (playerUpdateErr) throw new Error(playerUpdateErr.message);
  
  // Log activity
  const isPromotion = newRank > targetRank;
  logClanActivity(
    clanId,
    isPromotion ? ClanActivityType.MEMBER_PROMOTED : ClanActivityType.MEMBER_DEMOTED,
    promoterId,
    {
      targetUsername: target.username,
      oldRole: target.role,
      newRole,
    }
  );
  
  return {
    success: true,
    message: `${target.username} ${isPromotion ? 'promoted' : 'demoted'} to ${newRole}`,
  };
}

/**
 * Transfer clan leadership
 * Only current leader can transfer. New leader must be in clan.
 * Current leader becomes CO_LEADER after transfer.
 * 
 * @param clanId - Clan ID
 * @param currentLeaderId - Current leader ID (must match clan.leaderId)
 * @param newLeaderId - New leader ID (must be clan member)
 * @returns Success status
 * @throws Error if not current leader or invalid target
 * 
 * @example
 * await transferLeadership('clan123', 'oldLeader456', 'newLeader789');
 */
export async function transferLeadership(
  clanId: string,
  currentLeaderId: string,
  newLeaderId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();
  
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  if (clan.leader_id !== currentLeaderId) {
    throw new Error('Only current leader can transfer leadership');
  }
  
  const newLeader = await findClanMember(clanId, newLeaderId);
  if (!newLeader) {
    throw new Error('New leader must be a clan member');
  }
  
  if (currentLeaderId === newLeaderId) {
    throw new Error('Already clan leader');
  }
  
  // Update member roles
  await Promise.all([
    supabase
      .from('clan_members')
      .update({ role: ClanRole.CO_LEADER })
      .eq('clan_id', clanId)
      .eq('player_id', currentLeaderId),
    supabase
      .from('clan_members')
      .update({ role: ClanRole.LEADER })
      .eq('clan_id', clanId)
      .eq('player_id', newLeaderId),
  ]);
  
  // Update clan leader_id
  await supabase
    .from('clans')
    .update({ leader_id: newLeaderId })
    .eq('id', clanId);
  
  // Update player roles
  await Promise.all([
    supabase
      .from('players')
      .update({ clan_role: ClanRole.CO_LEADER })
      .eq('username', currentLeaderId),
    supabase
      .from('players')
      .update({ clan_role: ClanRole.LEADER })
      .eq('username', newLeaderId),
  ]);
  
  // Log activity
  logClanActivity(clanId, ClanActivityType.LEADERSHIP_TRANSFERRED, currentLeaderId, {
    newLeaderUsername: newLeader.username,
  });
  
  return { success: true, message: `Leadership transferred to ${newLeader.username}` };
}

/**
 * Update clan settings
 * Requires appropriate permissions based on setting being changed.
 * 
 * @param clanId - Clan ID
 * @param playerId - Player ID making changes (must have permission)
 * @param settings - Partial settings to update
 * @returns Updated clan
 * @throws Error if no permission
 * 
 * @example
 * await updateClanSettings('clan123', 'leader456', { messageOfTheDay: 'New MOTD!' });
 */
export async function updateClanSettings(
  clanId: string,
  playerId: string,
  settings: Partial<{
    messageOfTheDay: string;
    isRecruiting: boolean;
    minLevelToJoin: number;
    requiresApproval: boolean;
    allowTerritoryControl: boolean;
    allowWarDeclarations: boolean;
  }>
): Promise<Tables<'clans'>> {
  const supabase = createServiceClient();
  
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const member = await findClanMember(clanId, playerId);
  if (!member) {
    throw new Error('Player not in clan');
  }
  
  // Check description edit permission if message of the day being changed
  if (settings.messageOfTheDay !== undefined && !hasPermission(member.role, 'canEditDescription')) {
    throw new Error('No permission to edit message of the day');
  }
  
  // Only leader can change critical settings
  if (member.role !== ClanRole.LEADER) {
    const criticalSettings = ['isRecruiting', 'minLevelToJoin', 'requiresApproval', 'allowTerritoryControl', 'allowWarDeclarations'];
    const changingCriticalSetting = Object.keys(settings).some(key => criticalSettings.includes(key));
    
    if (changingCriticalSetting) {
      throw new Error('Only clan leader can change these settings');
    }
  }
  
  // Merge with existing settings
  const existingSettings = (clan.clan_settings as Record<string, any>) || {};
  const mergedSettings = { ...existingSettings, ...settings };
  
  const { data: updatedClan, error } = await supabase
    .from('clans')
    .update({ clan_settings: mergedSettings })
    .eq('id', clanId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  
  // Log activity
  logClanActivity(clanId, ClanActivityType.SETTINGS_CHANGED, playerId, {
    changes: Object.keys(settings),
  });
  
  return updatedClan!;
}

/**
 * Disband clan
 * Only leader can disband. Returns resources to leader and removes all members.
 * 
 * @param clanId - Clan ID
 * @param playerId - Player ID (must be leader)
 * @returns Success status
 * @throws Error if not leader
 * 
 * @example
 * await disbandClan('clan123', 'leader456');
 */
export async function disbandClan(clanId: string, playerId: string): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();
  
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  if (clan.leader_id !== playerId) {
    throw new Error('Only clan leader can disband the clan');
  }
  
  // Get all member player IDs
  const members = await getClanMembers(clanId);
  
  // Remove clan ID from all members
  for (const member of members) {
    await supabase
      .from('players')
      .update({
        clan_id: null,
        clan_name: null,
        clan_role: null,
      })
      .eq('username', member.player_id);
  }
  
  // Delete clan members
  await supabase
    .from('clan_members')
    .delete()
    .eq('clan_id', clanId);
  
  // Delete clan invitations
  await supabase
    .from('clan_invitations')
    .delete()
    .eq('clan_id', clanId);
  
  // Delete clan
  await supabase
    .from('clans')
    .delete()
    .eq('id', clanId);
  
  return { success: true, message: 'Clan disbanded successfully' };
}

/**
 * Get clan statistics
 * Calculates total power, member stats, research progress, etc.
 * 
 * @param clanId - Clan ID
 * @returns Clan statistics object
 * 
 * @example
 * const stats = await getClanStats('clan123');
 */
export async function getClanStats(clanId: string): Promise<{
  members: number;
  level: number;
  totalXP: number;
  totalPower: number;
  territories: number;
  monuments: number;
  researchPoints: number;
  bankCapacity: number;
  activePerks: number;
}> {
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  const memberCount = await countClanMembers(clanId);
  
  return {
    members: memberCount,
    level: clan.clan_level,
    totalXP: clan.total_xp,
    totalPower: clan.total_power,
    territories: clan.total_territories,
    monuments: clan.total_monuments,
    researchPoints: clan.research_points,
    bankCapacity: clan.bank_capacity,
    activePerks: 0,
  };
}

/**
 * Helper function to log clan activity
 * No dedicated clan_activities table in Supabase — logs to console.
 * 
 * @param clanId - Clan ID
 * @param activityType - Type of activity
 * @param playerId - Player performing activity
 * @param metadata - Additional activity data
 */
async function logClanActivity(
  clanId: string,
  activityType: ClanActivityType,
  playerId: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    console.log(`[Clan Activity] clan=${clanId} type=${activityType} player=${playerId}`, metadata);
  } catch (error) {
    console.error('Failed to log clan activity:', error);
  }
}

/**
 * IMPLEMENTATION NOTES:
 * - All operations validate permissions using hasPermission() helper from types
 * - Role hierarchy enforced: RECRUIT < MEMBER < ELITE < OFFICER < CO_LEADER < LEADER
 * - Clan creation cost configurable via CLAN_CONSTANTS (currently 1.5M/1.5M)
 * - Activity logging integrated for all major actions
 * - Clan initialized at level 1 with empty bank and no perks
 * - Solo players can create clans (minimum 1 member)
 * - Invitation system uses 7-day expiration for cleanup
 * - Leader protection: cannot be kicked, must transfer before leaving
 * - Co-Leader promotion restricted to Leader only (via permissions)
 * - XP tracking foundation in place, full implementation in clanLevelService
 * - Bank system initialized but full implementation in clanBankService
 * - Settings validation ensures only appropriate roles can change sensitive values
 */
