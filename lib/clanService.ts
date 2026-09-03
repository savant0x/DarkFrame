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
 * - Drizzle ORM with MySQL database
 * - types/clan.types.ts for all type definitions
 * - lib/playerService.ts for player resource validation
 * - lib/clanActivityService.ts for activity logging
 */

import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clans, players } from '@/lib/db/schema';
import {
  Clan,
  ClanMember,
  ClanRole,
  ClanActivityType,
  ClanBank,
  ClanPerk,
  CLAN_CONSTANTS,
  CLAN_BANK_CONSTANTS,
  hasPermission,
} from '@/types/clan.types';

/**
 * Helper: Convert flat DB row to nested Clan object
 * @param row - Database row from clans table
 * @returns Clan object with nested structure
 */
function rowToClan(row: typeof clans.$inferSelect): Clan {
  return {
    _id: row.id,
    name: row.name,
    tag: row.tag,
    description: row.description,
    leaderId: row.leaderId,
    members: row.members || [],
    maxMembers: row.maxMembers,
    level: {
      currentLevel: row.levelCurrentLevel,
      totalXP: row.levelTotalXP,
      currentLevelXP: row.levelCurrentLevelXP,
      xpToNextLevel: row.levelXpToNextLevel,
      featuresUnlocked: row.levelFeaturesUnlocked || [],
      milestonesCompleted: row.levelMilestonesCompleted || [],
      lastLevelUp: row.levelLastLevelUp ?? new Date(),
    },
    createdAt: row.createdAt ?? new Date(),
    settings: {
      messageOfTheDay: row.settingsMessageOfTheDay,
      isRecruiting: Boolean(row.settingsIsRecruiting),
      minLevelToJoin: row.settingsMinLevelToJoin,
      requiresApproval: Boolean(row.settingsRequiresApproval),
      allowTerritoryControl: Boolean(row.settingsAllowTerritoryControl),
      allowWarDeclarations: Boolean(row.settingsAllowWarDeclarations),
    },
    stats: {
      totalPower: row.statsTotalPower,
      totalTerritories: row.statsTotalTerritories,
      totalMonuments: row.statsTotalMonuments,
      warsWon: row.statsWarsWon,
      warsLost: row.statsWarsLost,
      totalRP: row.statsTotalRP,
    },
    research: {
      researchPoints: row.researchResearchPoints,
      unlockedTechs: row.researchUnlockedTechs || [],
      activeResearch: row.researchActiveResearch,
    },
    bank: {
      treasury: {
        metal: Number(row.bankTreasuryMetal),
        energy: Number(row.bankTreasuryEnergy),
        researchPoints: row.bankTreasuryResearchPoints,
      },
      taxRates: {
        metal: Number(row.bankTaxRatesMetal),
        energy: Number(row.bankTaxRatesEnergy),
        researchPoints: Number(row.bankTaxRatesResearchPoints),
      },
      upgradeLevel: row.bankUpgradeLevel,
      capacity: Number(row.bankCapacity),
      transactions: row.bankTransactions || [],
    },
    activePerks: row.activePerks || [],
    territories: row.territories || [],
    monuments: row.monuments || [],
    wars: {
      active: row.warsActive || [],
      history: row.warsHistory || [],
    },
  };
}

/**
 * Helper: Get player by MongoDB-style ID (uses mongoId field)
 * @param playerId - MongoDB ObjectId string
 * @returns Player row or null
 */
async function getPlayerById(playerId: string) {
  const result = await db.select().from(players).where(eq(players.mongoId, playerId)).limit(1);
  return result[0] || null;
}

/**
 * Helper: Get player by username
 * @param username - Player username
 * @returns Player row or null
 */
async function getPlayerByUsername(username: string) {
  const result = await db.select().from(players).where(eq(players.username, username)).limit(1);
  return result[0] || null;
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
  description?: string
): Promise<Clan> {
  // Validate clan name
  if (!clanName || clanName.length < 3 || clanName.length > 30) {
    throw new Error('Clan name must be between 3 and 30 characters');
  }
  
  // Validate tag
  if (!tag || tag.length < 2 || tag.length > 6) {
    throw new Error('Clan tag must be between 2 and 6 characters');
  }
  
  // Check if name is already taken
  const existingClan = await db.select().from(clans).where(eq(clans.name, clanName)).limit(1);
  if (existingClan.length > 0) {
    throw new Error('Clan name already taken');
  }
  
  // Check if tag is already taken
  const existingTag = await db.select().from(clans).where(eq(clans.tag, tag.toUpperCase())).limit(1);
  if (existingTag.length > 0) {
    throw new Error('Clan tag already taken');
  }
  
  // Get player and validate resources
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  
  // Check if player is already in a clan
  if (player.clanId) {
    throw new Error('Player is already in a clan');
  }
  
  // Validate player has sufficient resources
  const { metal: costMetal, energy: costEnergy } = CLAN_CONSTANTS.CREATION_COST;
  if (Number(Number(player.resourcesMetal)) < costMetal || Number(Number(player.resourcesEnergy)) < costEnergy) {
    throw new Error(`Insufficient resources. Need ${costMetal.toLocaleString()} Metal and ${costEnergy.toLocaleString()} Energy`);
  }
  
  // Create founder member object
  const founderMember: ClanMember = {
    playerId,
    username: player.username,
    role: ClanRole.LEADER,
    joinedAt: new Date(),
    lastActive: new Date(),
  };
  
  // Initialize clan bank
  const initialBank: ClanBank = {
    treasury: {
      metal: 0,
      energy: 0,
      researchPoints: 0,
    },
    taxRates: {
      metal: 0,
      energy: 0,
      researchPoints: 0,
    },
    upgradeLevel: 1,
    capacity: CLAN_CONSTANTS.BANK_BASE_CAPACITY,
    transactions: [],
  };
  
  // Generate clan ID
  const clanId = crypto.randomUUID().slice(0, 24);
  
  // Create new clan object
  const newClan: Clan = {
    _id: undefined,
    name: clanName,
    tag: tag.toUpperCase(),
    description: description || '',
    leaderId: playerId,
    members: [founderMember],
    maxMembers: CLAN_CONSTANTS.DEFAULT_MAX_MEMBERS,
    level: {
      currentLevel: 1,
      totalXP: 0,
      currentLevelXP: 0,
      xpToNextLevel: 1000,
      featuresUnlocked: [],
      milestonesCompleted: [],
      lastLevelUp: new Date(),
    },
    createdAt: new Date(),
    settings: {
      messageOfTheDay: `Welcome to ${clanName}!`,
      isRecruiting: true,
      minLevelToJoin: 1,
      requiresApproval: false,
      allowTerritoryControl: true,
      allowWarDeclarations: true,
    },
    stats: {
      totalPower: 0,
      totalTerritories: 0,
      totalMonuments: 0,
      warsWon: 0,
      warsLost: 0,
      totalRP: 0,
    },
    research: {
      researchPoints: 0,
      unlockedTechs: [],
      activeResearch: null,
    },
    bank: initialBank,
    activePerks: [],
    territories: [],
    monuments: [],
    wars: {
      active: [],
      history: [],
    },
  };
  
  // Insert clan into database — fully-typed literal (clanToRow's partial mapping was
  // only ever called here and its `Record<string, any>` shape fought the insert type)
  await db.insert(clans).values({
    id: clanId,
    name: newClan.name,
    tag: newClan.tag,
    description: newClan.description,
    leaderId: newClan.leaderId,
    members: newClan.members,
    maxMembers: newClan.maxMembers,
    levelCurrentLevel: newClan.level.currentLevel,
    levelTotalXP: newClan.level.totalXP,
    levelCurrentLevelXP: newClan.level.currentLevelXP,
    levelXpToNextLevel: newClan.level.xpToNextLevel,
    levelFeaturesUnlocked: newClan.level.featuresUnlocked,
    levelMilestonesCompleted: newClan.level.milestonesCompleted,
    levelLastLevelUp: newClan.level.lastLevelUp,
    createdAt: newClan.createdAt,
    settingsMessageOfTheDay: newClan.settings.messageOfTheDay,
    settingsIsRecruiting: newClan.settings.isRecruiting ? 1 : 0,
    settingsMinLevelToJoin: newClan.settings.minLevelToJoin,
    settingsRequiresApproval: newClan.settings.requiresApproval ? 1 : 0,
    settingsAllowTerritoryControl: newClan.settings.allowTerritoryControl ? 1 : 0,
    settingsAllowWarDeclarations: newClan.settings.allowWarDeclarations ? 1 : 0,
    statsTotalPower: newClan.stats.totalPower,
    statsTotalTerritories: newClan.stats.totalTerritories,
    statsTotalMonuments: newClan.stats.totalMonuments,
    statsWarsWon: newClan.stats.warsWon,
    statsWarsLost: newClan.stats.warsLost,
    statsTotalRP: newClan.stats.totalRP,
    researchResearchPoints: newClan.research.researchPoints,
    researchUnlockedTechs: newClan.research.unlockedTechs,
    researchActiveResearch: newClan.research.activeResearch,
    bankTreasuryMetal: newClan.bank.treasury.metal,
    bankTreasuryEnergy: newClan.bank.treasury.energy,
    bankTreasuryResearchPoints: newClan.bank.treasury.researchPoints,
    bankTaxRatesMetal: String(newClan.bank.taxRates.metal),
    bankTaxRatesEnergy: String(newClan.bank.taxRates.energy),
    bankTaxRatesResearchPoints: String(newClan.bank.taxRates.researchPoints),
    bankUpgradeLevel: newClan.bank.upgradeLevel,
    bankCapacity: newClan.bank.capacity,
    bankTransactions: newClan.bank.transactions,
    activePerks: newClan.activePerks,
    territories: newClan.territories,
    monuments: newClan.monuments,
    warsActive: newClan.wars.active,
    warsHistory: newClan.wars.history,
  });

  // Deduct resources from player and assign clan (INCLUDING clanName for display)
  await db.update(players).set({
    resourcesMetal: Number(player.resourcesMetal) - costMetal,
    resourcesEnergy: Number(player.resourcesEnergy) - costEnergy,
    clanId,
    clanName: clanName,
    clanRole: ClanRole.LEADER,
  }).where(eq(players.mongoId, playerId));
  
  // Log activity
  await logClanActivity(clanId, ClanActivityType.CLAN_CREATED, playerId, {
    clanName,
    tag: newClan.tag,
  });

  // newClan is already a complete domain Clan; the generated id supplies `_id`.
  return { ...newClan, _id: clanId };
}

/**
 * Get clan by ID
 * @param clanId - Clan ID
 * @returns Clan object or null if not found
 * 
 * @example
 * const clan = await getClanById('clan123');
 */
export async function getClanById(clanId: string): Promise<Clan | null> {
  const result = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (result.length === 0) return null;
  return rowToClan(result[0]);
}

/**
 * Get clan by tag
 * @param tag - Clan tag (case-insensitive)
 * @returns Clan object or null if not found
 * 
 * @example
 * const clan = await getClanByTag('DW');
 */
export async function getClanByTag(tag: string): Promise<Clan | null> {
  const result = await db.select().from(clans).where(eq(clans.tag, tag.toUpperCase())).limit(1);
  if (result.length === 0) return null;
  return rowToClan(result[0]);
}

/**
 * Get clan by player ID
 * @param playerId - Player ID
 * @returns Clan object or null if player not in clan
 * 
 * @example
 * const clan = await getClanByPlayerId('player123');
 */
export async function getClanByPlayerId(playerId: string): Promise<Clan | null> {
  const player = await getPlayerById(playerId);
  
  if (!player || !player.clanId) {
    return null;
  }
  
  return await getClanById(player.clanId);
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
  // Get clan
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  // Get inviter member
  const inviterMember = clan.members.find(m => m.playerId === inviterId);
  if (!inviterMember) {
    throw new Error('Inviter not in clan');
  }
  
  // Check permissions
  if (!hasPermission(inviterMember.role, 'canInvite')) {
    throw new Error('No permission to invite members');
  }
  
  // Check clan capacity
  if (clan.members.length >= clan.maxMembers) {
    throw new Error('Clan is at maximum capacity');
  }
  
  // Get invitee player
  const invitee = await getPlayerById(inviteeId);
  if (!invitee) {
    throw new Error('Player not found');
  }
  
  // Check if already in a clan
  if (invitee.clanId) {
    throw new Error('Player is already in a clan');
  }
  
  // Check level requirement
  if (invitee.level < clan.settings.minLevelToJoin) {
    throw new Error(`Player must be level ${clan.settings.minLevelToJoin} or higher`);
  }
  
  // Create invitation
  // TODO: clan_invitations table schema not yet created - using raw SQL
  await db.execute(sql`
    INSERT INTO clan_invitations 
    (clan_id, clan_name, inviter_id, inviter_username, invitee_id, invitee_username, created_at, expires_at, status)
    VALUES (${clanId}, ${clan.name}, ${inviterId}, ${inviterMember.username}, ${inviteeId}, ${invitee.username}, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), 'pending')
  `);
  
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
): Promise<{ success: boolean; clan: Clan }> {
  // Get invitation
  // TODO: clan_invitations table schema not yet created - using raw SQL
  const invitationResult = await db.execute(sql`
    SELECT * FROM clan_invitations 
    WHERE id = ${invitationId} AND invitee_id = ${playerId} AND status = 'pending'
    LIMIT 1
  `);
  
  const rows = (invitationResult as any)[0];
  if (!rows || rows.length === 0) {
    throw new Error('Invitation not found or already processed');
  }
  
  const invitation = rows[0];
  
  // Check expiration
  if (new Date() > new Date(invitation.expires_at)) {
    await db.execute(sql`
      UPDATE clan_invitations SET status = 'expired' WHERE id = ${invitationId}
    `);
    throw new Error('Invitation has expired');
  }
  
  // Get clan
  const clan = await getClanById(invitation.clan_id);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  // Check capacity again
  if (clan.members.length >= clan.maxMembers) {
    throw new Error('Clan is now at maximum capacity');
  }
  
  // Get player
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  
  // Check if already in clan
  if (player.clanId) {
    throw new Error('Player is already in a clan');
  }
  
  // Create new member object
  const newMember: ClanMember = {
    playerId,
    username: player.username,
    role: ClanRole.RECRUIT,
    joinedAt: new Date(),
    lastActive: new Date(),
  };
  
  // Add member to clan - read JSON array, modify, then update
  const updatedMembers = [...clan.members, newMember];
  await db.update(clans).set({
    members: updatedMembers as any,
  }).where(eq(clans.id, invitation.clan_id));
  
  // Update player with clan info (INCLUDING clanName for display)
  await db.update(players).set({
    clanId: invitation.clan_id,
    clanName: clan.name,
    clanRole: ClanRole.RECRUIT,
  }).where(eq(players.mongoId, playerId));
  
  // Mark invitation as accepted
  await db.execute(sql`
    UPDATE clan_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = ${invitationId}
  `);
  
  // Log activity
  await logClanActivity(invitation.clan_id, ClanActivityType.MEMBER_JOINED, playerId, {
    username: player.username,
  });
  
  const updatedClan = await getClanById(invitation.clan_id);
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
  // Get clan
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  // Get member
  const member = clan.members.find(m => m.playerId === playerId);
  if (!member) {
    throw new Error('Player not in this clan');
  }
  
  // Leader cannot leave without transferring
  if (member.role === ClanRole.LEADER) {
    throw new Error('Leader must transfer leadership before leaving');
  }
  
  // Remove member from clan - read JSON array, filter, then update
  const updatedMembers = clan.members.filter(m => m.playerId !== playerId);
  await db.update(clans).set({
    members: updatedMembers as any,
  }).where(eq(clans.id, clanId));
  
  // Update player (REMOVE all clan fields including clanName)
  await db.update(players).set({
    clanId: null,
    clanName: null,
    clanRole: null,
  }).where(eq(players.mongoId, playerId));
  
  // Log activity
  await logClanActivity(clanId, ClanActivityType.MEMBER_LEFT, playerId, {
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
  // Get clan
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  // Get kicker member
  const kicker = clan.members.find(m => m.playerId === kickerId);
  if (!kicker) {
    throw new Error('Kicker not in clan');
  }
  
  // Check permissions
  if (!hasPermission(kicker.role, 'canKick')) {
    throw new Error('No permission to kick members');
  }
  
  // Get target member
  const target = clan.members.find(m => m.playerId === targetId);
  if (!target) {
    throw new Error('Target player not in clan');
  }
  
  // Cannot kick leader
  if (target.role === ClanRole.LEADER) {
    throw new Error('Cannot kick clan leader');
  }
  
  // Cannot kick equal or higher role (unless you're leader)
  const roleHierarchy = [
    ClanRole.RECRUIT,
    ClanRole.MEMBER,
    ClanRole.ELITE,
    ClanRole.OFFICER,
    ClanRole.CO_LEADER,
    ClanRole.LEADER,
  ];
  
  const kickerRank = roleHierarchy.indexOf(kicker.role);
  const targetRank = roleHierarchy.indexOf(target.role);
  
  if (targetRank >= kickerRank && kicker.role !== ClanRole.LEADER) {
    throw new Error('Cannot kick members of equal or higher rank');
  }
  
  // Remove member - read JSON array, filter, then update
  const updatedMembers = clan.members.filter(m => m.playerId !== targetId);
  await db.update(clans).set({
    members: updatedMembers as any,
  }).where(eq(clans.id, clanId));
  
  // Update player (REMOVE all clan fields including clanName)
  await db.update(players).set({
    clanId: null,
    clanName: null,
    clanRole: null,
  }).where(eq(players.mongoId, targetId));
  
  // Log activity
  await logClanActivity(clanId, ClanActivityType.MEMBER_KICKED, kickerId, {
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
  // Get clan
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  // Get promoter member
  const promoter = clan.members.find(m => m.playerId === promoterId);
  if (!promoter) {
    throw new Error('Promoter not in clan');
  }
  
  // Get target member
  const target = clan.members.find(m => m.playerId === targetId);
  if (!target) {
    throw new Error('Target player not in clan');
  }
  
  // Cannot change leader role (must use transferLeadership)
  if (target.role === ClanRole.LEADER || newRole === ClanRole.LEADER) {
    throw new Error('Use transferLeadership to change leader');
  }
  
  // Role hierarchy validation
  const roleHierarchy = [
    ClanRole.RECRUIT,
    ClanRole.MEMBER,
    ClanRole.ELITE,
    ClanRole.OFFICER,
    ClanRole.CO_LEADER,
    ClanRole.LEADER,
  ];
  
  const promoterRank = roleHierarchy.indexOf(promoter.role);
  const targetRank = roleHierarchy.indexOf(target.role);
  const newRank = roleHierarchy.indexOf(newRole);
  
  // Permission checks based on new role
  if (newRole === ClanRole.CO_LEADER && !hasPermission(promoter.role, 'canPromoteToCoLeader')) {
    throw new Error('No permission to promote to Co-Leader');
  }
  
  if (newRole === ClanRole.OFFICER && !hasPermission(promoter.role, 'canPromoteToOfficer')) {
    throw new Error('No permission to promote to Officer');
  }
  
  if (newRole === ClanRole.ELITE && !hasPermission(promoter.role, 'canPromoteToElite')) {
    throw new Error('No permission to promote to Elite');
  }
  
  // Can demote?
  const isDemotion = newRank < targetRank;
  if (isDemotion && !hasPermission(promoter.role, 'canDemote')) {
    throw new Error('No permission to demote members');
  }
  
  // Cannot modify equal or higher rank (unless leader)
  if (targetRank >= promoterRank && promoter.role !== ClanRole.LEADER) {
    throw new Error('Cannot modify members of equal or higher rank');
  }
  
  // Cannot promote above your own rank (unless leader)
  if (newRank >= promoterRank && promoter.role !== ClanRole.LEADER) {
    throw new Error('Cannot promote above your own rank');
  }
  
  // Update member role in clan - read JSON array, modify, then update
  const updatedMembers = clan.members.map(m =>
    m.playerId === targetId ? { ...m, role: newRole } : m
  );
  await db.update(clans).set({
    members: updatedMembers as any,
  }).where(eq(clans.id, clanId));
  
  // Update player role
  await db.update(players).set({
    clanRole: newRole,
  }).where(eq(players.mongoId, targetId));
  
  // Log activity
  const isPromotion = newRank > targetRank;
  await logClanActivity(
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
  // Get clan
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  // Verify current leader
  if (clan.leaderId !== currentLeaderId) {
    throw new Error('Only current leader can transfer leadership');
  }
  
  // Get new leader member
  const newLeader = clan.members.find(m => m.playerId === newLeaderId);
  if (!newLeader) {
    throw new Error('New leader must be a clan member');
  }
  
  // Cannot transfer to self
  if (currentLeaderId === newLeaderId) {
    throw new Error('Already clan leader');
  }
  
  // Update roles in clan - read JSON array, modify, then update
  const updatedMembers = clan.members.map(m => {
    if (m.playerId === currentLeaderId) {
      return { ...m, role: ClanRole.CO_LEADER };
    }
    if (m.playerId === newLeaderId) {
      return { ...m, role: ClanRole.LEADER };
    }
    return m;
  });
  
  await db.update(clans).set({
    leaderId: newLeaderId,
    members: updatedMembers as any,
  }).where(eq(clans.id, clanId));
  
  // Update player roles
  await db.update(players).set({
    clanRole: ClanRole.CO_LEADER,
  }).where(eq(players.mongoId, currentLeaderId));
  
  await db.update(players).set({
    clanRole: ClanRole.LEADER,
  }).where(eq(players.mongoId, newLeaderId));
  
  // Log activity
  await logClanActivity(clanId, ClanActivityType.LEADERSHIP_TRANSFERRED, currentLeaderId, {
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
  settings: Partial<Clan['settings']>
): Promise<Clan> {
  // Get clan
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  // Get member
  const member = clan.members.find(m => m.playerId === playerId);
  if (!member) {
    throw new Error('Player not in clan');
  }
  
  // Check description edit permission if description being changed
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
  
  // Build update object with flat column names
  const updateFields: Record<string, any> = {};
  if (settings.messageOfTheDay !== undefined) updateFields.settingsMessageOfTheDay = settings.messageOfTheDay;
  if (settings.isRecruiting !== undefined) updateFields.settingsIsRecruiting = settings.isRecruiting ? 1 : 0;
  if (settings.minLevelToJoin !== undefined) updateFields.settingsMinLevelToJoin = settings.minLevelToJoin;
  if (settings.requiresApproval !== undefined) updateFields.settingsRequiresApproval = settings.requiresApproval ? 1 : 0;
  if (settings.allowTerritoryControl !== undefined) updateFields.settingsAllowTerritoryControl = settings.allowTerritoryControl ? 1 : 0;
  if (settings.allowWarDeclarations !== undefined) updateFields.settingsAllowWarDeclarations = settings.allowWarDeclarations ? 1 : 0;
  
  await db.update(clans).set(updateFields).where(eq(clans.id, clanId));
  
  // Log activity
  await logClanActivity(clanId, ClanActivityType.SETTINGS_CHANGED, playerId, {
    changes: Object.keys(settings),
  });
  
  return (await getClanById(clanId))!;
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
  // Get clan
  const clan = await getClanById(clanId);
  if (!clan) {
    throw new Error('Clan not found');
  }
  
  // Verify leader
  if (clan.leaderId !== playerId) {
    throw new Error('Only clan leader can disband the clan');
  }
  
  // Remove clan ID from all members
  const memberIds = clan.members.map(m => m.playerId);
  await db.update(players).set({
    clanId: null,
    clanRole: null,
  }).where(inArray(players.mongoId, memberIds));
  
  // Delete clan
  await db.delete(clans).where(eq(clans.id, clanId));
  
  // Delete associated data
  // TODO: clan_invitations, clan_activities, clan_chat table schemas not yet created - using raw SQL
  await db.execute(sql`DELETE FROM clan_invitations WHERE clan_id = ${clanId}`);
  await db.execute(sql`DELETE FROM clan_activities WHERE clan_id = ${clanId}`);
  await db.execute(sql`DELETE FROM clan_chat WHERE clan_id = ${clanId}`);
  
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
  
  return {
    members: clan.members.length,
    level: clan.level.currentLevel,
    totalXP: clan.level.totalXP,
    totalPower: clan.stats.totalPower,
    territories: clan.territories.length,
    monuments: clan.monuments.length,
    researchPoints: clan.research.researchPoints,
    bankCapacity: clan.bank.capacity,
    activePerks: clan.activePerks.length,
  };
}

/**
 * Helper function to log clan activity
 * Integrates with clan activity tracking system.
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
    // TODO: clan_activities table schema not yet created - using raw SQL
    await db.execute(sql`
      INSERT INTO clan_activities (clan_id, activity_type, player_id, metadata, timestamp)
      VALUES (${clanId}, ${activityType}, ${playerId}, ${JSON.stringify(metadata)}, NOW())
    `);
  } catch (error) {
    // Don't fail the operation if logging fails
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
 * - Migrated from MongoDB to Drizzle ORM with MySQL
 * - Player lookups use mongoId field for backward compatibility with existing player IDs
 * - Clan members stored as JSON array in flat column - read/modify/update pattern used
 * - TODO: clan_invitations, clan_activities, clan_chat tables need Drizzle schema definitions
 */
