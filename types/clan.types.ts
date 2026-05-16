/**
 * Clan System Type Definitions
 * Created: 2025-10-18 09:40
 * 
 * OVERVIEW:
 * Complete type system for DarkFrame clan/guild functionality.
 * Supports clan creation, member management with roles, research progression,
 * territory control, warfare mechanics, monument bonuses, and social features.
 * 
 * Core Components:
 * - Clan structure with membership and resources
 * - Role-based permissions (Leader, Officer, Member)
 * - Research tree with permanent bonuses
 * - Territory claiming and defense bonuses
 * - Clan warfare and territory capture
 * - Monument control for passive bonuses
 * - Chat and activity tracking
 * 
 * Dependencies:
 * - MongoDB for data persistence
 * - Activity logging for clan events
 */

type ObjectId = string;

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Clan member roles with hierarchical permissions
 */
export enum ClanRole {
  LEADER = 'LEADER',           // Full control: disband, transfer leadership, promote to any role
  CO_LEADER = 'CO_LEADER',     // Second-in-command: promote to Officer, manage wars, territories
  OFFICER = 'OFFICER',         // Management: kick Members, invite, manage research
  ELITE = 'ELITE',             // Veteran: priority war deployment, bonus RP contribution
  MEMBER = 'MEMBER',           // Standard: contribute, view, chat
  RECRUIT = 'RECRUIT'          // Trial: limited contributions, view-only for 24 hours
}

/**
 * Clan research branches
 */
export enum ResearchBranch {
  STRENGTH = 'STRENGTH',         // Attack bonuses
  DEFENSE = 'DEFENSE',           // Defense bonuses
  ECONOMIC = 'ECONOMIC'          // Resource and efficiency bonuses
}

/**
 * Clan war status
 */
export enum WarStatus {
  DECLARED = 'DECLARED',   // War declared, not yet active
  ACTIVE = 'ACTIVE',       // War in progress, territory can be captured
  ENDED = 'ENDED',         // War concluded
  TRUCE = 'TRUCE'          // Temporary peace agreement
}

/**
 * Clan activity types for activity feed (enhanced)
 */
export enum ClanActivityType {
  CLAN_CREATED = 'CLAN_CREATED',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_LEFT = 'MEMBER_LEFT',
  MEMBER_KICKED = 'MEMBER_KICKED',
  MEMBER_PROMOTED = 'MEMBER_PROMOTED',
  MEMBER_DEMOTED = 'MEMBER_DEMOTED',
  LEADERSHIP_TRANSFERRED = 'LEADERSHIP_TRANSFERRED',
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  LEVEL_UP = 'LEVEL_UP',
  PERK_ACTIVATED = 'PERK_ACTIVATED',
  PERK_DEACTIVATED = 'PERK_DEACTIVATED',
  RESEARCH_UNLOCKED = 'RESEARCH_UNLOCKED',
  RESEARCH_CONTRIBUTED = 'RESEARCH_CONTRIBUTED',
  TERRITORY_CLAIMED = 'TERRITORY_CLAIMED',
  TERRITORY_LOST = 'TERRITORY_LOST',
  TERRITORY_INCOME_COLLECTED = 'TERRITORY_INCOME_COLLECTED',
  WAR_DECLARED = 'WAR_DECLARED',
  WAR_ENDED = 'WAR_ENDED',
  MONUMENT_CAPTURED = 'MONUMENT_CAPTURED',
  MONUMENT_LOST = 'MONUMENT_LOST',
  BANK_DEPOSIT = 'BANK_DEPOSIT',
  BANK_WITHDRAWAL = 'BANK_WITHDRAWAL',
  TAX_COLLECTED = 'TAX_COLLECTED',
  TAX_RATE_CHANGED = 'TAX_RATE_CHANGED',
  BANK_UPGRADED = 'BANK_UPGRADED',
  FUND_DISTRIBUTION = 'FUND_DISTRIBUTION',
  ALLIANCE_PROPOSED = 'ALLIANCE_PROPOSED',
  ALLIANCE_RECEIVED = 'ALLIANCE_RECEIVED',
  ALLIANCE_ACCEPTED = 'ALLIANCE_ACCEPTED',
  ALLIANCE_FORMED = 'ALLIANCE_FORMED',
  ALLIANCE_BROKEN = 'ALLIANCE_BROKEN',
  CONTRACT_ADDED = 'CONTRACT_ADDED',
  CONTRACT_REMOVED = 'CONTRACT_REMOVED',
}

/**
 * Fund distribution methods
 */
export enum DistributionMethod {
  EQUAL_SPLIT = 'EQUAL_SPLIT',         // Divide equally among all members
  PERCENTAGE = 'PERCENTAGE',           // Custom percentage per role or player
  MERIT = 'MERIT',                     // Based on contribution metrics
  DIRECT_GRANT = 'DIRECT_GRANT',       // Direct transfer to specific players
}

/**
 * Alliance types with cost progression
 */
export enum AllianceType {
  NAP = 'NAP',                         // Non-Aggression Pact (free)
  TRADE = 'TRADE',                     // Trade Alliance (10K M/E)
  MILITARY = 'MILITARY',               // Military Alliance (50K M/E)
  FEDERATION = 'FEDERATION',           // Federation (200K M/E)
}

/**
 * Alliance status
 */
export enum AllianceStatus {
  PROPOSED = 'PROPOSED',               // Proposed, awaiting acceptance
  ACTIVE = 'ACTIVE',                   // Active alliance
  BROKEN = 'BROKEN',                   // Alliance broken
  EXPIRED = 'EXPIRED',                 // Expired (if time-limited)
}

/**
 * Alliance contract types
 */
export enum ContractType {
  RESOURCE_SHARING = 'RESOURCE_SHARING',         // Share passive income
  DEFENSE_PACT = 'DEFENSE_PACT',                 // Auto-join defensive wars
  WAR_SUPPORT = 'WAR_SUPPORT',                   // Provide resources during wars
  JOINT_RESEARCH = 'JOINT_RESEARCH',             // Share research contributions
}

/**
 * Monument types with unique bonuses
 */
export enum MonumentType {
  ANCIENT_FORGE = 'ANCIENT_FORGE',           // +5% Metal yield
  WAR_MEMORIAL = 'WAR_MEMORIAL',             // +10% Attack
  MARKET_PLAZA = 'MARKET_PLAZA',             // -5% auction fees
  RESEARCH_LAB = 'RESEARCH_LAB',             // +15% RP gain
  GRAND_TEMPLE = 'GRAND_TEMPLE'              // +5% XP gain
}

/**
 * Clan role permissions matrix
 */
export interface ClanPermissions {
  canDisband: boolean;              // Disband entire clan
  canTransferLeadership: boolean;   // Transfer leadership to another member
  canPromoteToCoLeader: boolean;    // Promote members to Co-Leader
  canPromoteToOfficer: boolean;     // Promote members to Officer
  canPromoteToElite: boolean;       // Promote members to Elite
  canDemote: boolean;               // Demote members to lower ranks
  canKick: boolean;                 // Kick members from clan
  canInvite: boolean;               // Invite new members
  canManageWars: boolean;           // Declare wars, negotiate truces
  canManageTerritories: boolean;    // Claim and abandon territories
  canManageResearch: boolean;       // Unlock research nodes
  canContributeRP: boolean;         // Contribute to research pool
  canContributeResources: boolean;  // Donate to clan treasury
  canViewTreasury: boolean;         // View clan resources
  canWithdrawFromBank: boolean;     // Withdraw resources from clan bank
  canManageTaxes: boolean;          // Set tax rates and policies
  canUpgradeBank: boolean;          // Upgrade clan bank capacity/features
  canUseChat: boolean;              // Send messages in clan chat
  canViewOfficerChat: boolean;      // Access officer-only channel
  canViewLeaderChat: boolean;       // Access leader-only channel
  canEditDescription: boolean;      // Edit clan description
  bonusRPContribution: number;      // Bonus RP multiplier (1.0 = normal, 1.15 = +15%)
  warDeploymentPriority: number;    // Priority in war deployments (1-6, 1 = highest)
}

/**
 * Role permission definitions
 */
export const ROLE_PERMISSIONS: Record<ClanRole, ClanPermissions> = {
  [ClanRole.LEADER]: {
    canDisband: true,
    canTransferLeadership: true,
    canPromoteToCoLeader: true,
    canPromoteToOfficer: true,
    canPromoteToElite: true,
    canDemote: true,
    canKick: true,
    canInvite: true,
    canManageWars: true,
    canManageTerritories: true,
    canManageResearch: true,
    canContributeRP: true,
    canContributeResources: true,
    canViewTreasury: true,
    canWithdrawFromBank: true,
    canManageTaxes: true,
    canUpgradeBank: true,
    canUseChat: true,
    canViewOfficerChat: true,
    canViewLeaderChat: true,
    canEditDescription: true,
    bonusRPContribution: 1.0,
    warDeploymentPriority: 1,
  },
  [ClanRole.CO_LEADER]: {
    canDisband: false,
    canTransferLeadership: false,
    canPromoteToCoLeader: false,
    canPromoteToOfficer: true,
    canPromoteToElite: true,
    canDemote: true, // Can demote Officers and below
    canKick: true,
    canInvite: true,
    canManageWars: true,
    canManageTerritories: true,
    canManageResearch: true,
    canContributeRP: true,
    canContributeResources: true,
    canViewTreasury: true,
    canWithdrawFromBank: true,
    canManageTaxes: false,
    canUpgradeBank: false,
    canUseChat: true,
    canViewOfficerChat: true,
    canViewLeaderChat: true,
    canEditDescription: true,
    bonusRPContribution: 1.0,
    warDeploymentPriority: 2,
  },
  [ClanRole.OFFICER]: {
    canDisband: false,
    canTransferLeadership: false,
    canPromoteToCoLeader: false,
    canPromoteToOfficer: false,
    canPromoteToElite: true, // Can promote Members to Elite
    canDemote: false,
    canKick: true, // Can kick Members and Recruits only
    canInvite: true,
    canManageWars: false,
    canManageTerritories: true,
    canManageResearch: true,
    canContributeRP: true,
    canContributeResources: true,
    canViewTreasury: true,
    canWithdrawFromBank: false,
    canManageTaxes: false,
    canUpgradeBank: false,
    canUseChat: true,
    canViewOfficerChat: true,
    canViewLeaderChat: false,
    canEditDescription: false,
    bonusRPContribution: 1.0,
    warDeploymentPriority: 3,
  },
  [ClanRole.ELITE]: {
    canDisband: false,
    canTransferLeadership: false,
    canPromoteToCoLeader: false,
    canPromoteToOfficer: false,
    canPromoteToElite: false,
    canDemote: false,
    canKick: false,
    canInvite: true, // Elite members can invite
    canManageWars: false,
    canManageTerritories: false,
    canManageResearch: false,
    canContributeRP: true,
    canContributeResources: true,
    canViewTreasury: true,
    canWithdrawFromBank: false,
    canManageTaxes: false,
    canUpgradeBank: false,
    canUseChat: true,
    canViewOfficerChat: false,
    canViewLeaderChat: false,
    canEditDescription: false,
    bonusRPContribution: 1.15, // +15% RP contribution bonus
    warDeploymentPriority: 4,
  },
  [ClanRole.MEMBER]: {
    canDisband: false,
    canTransferLeadership: false,
    canPromoteToCoLeader: false,
    canPromoteToOfficer: false,
    canPromoteToElite: false,
    canDemote: false,
    canKick: false,
    canInvite: false,
    canManageWars: false,
    canManageTerritories: false,
    canManageResearch: false,
    canContributeRP: true,
    canContributeResources: true,
    canViewTreasury: false,
    canWithdrawFromBank: false,
    canManageTaxes: false,
    canUpgradeBank: false,
    canUseChat: true,
    canViewOfficerChat: false,
    canViewLeaderChat: false,
    canEditDescription: false,
    bonusRPContribution: 1.0,
    warDeploymentPriority: 5,
  },
  [ClanRole.RECRUIT]: {
    canDisband: false,
    canTransferLeadership: false,
    canPromoteToCoLeader: false,
    canPromoteToOfficer: false,
    canPromoteToElite: false,
    canDemote: false,
    canKick: false,
    canInvite: false,
    canManageWars: false,
    canManageTerritories: false,
    canManageResearch: false,
    canContributeRP: true,
    canContributeResources: true,
    canViewTreasury: false,
    canWithdrawFromBank: false,
    canManageTaxes: false,
    canUpgradeBank: false,
    canUseChat: true, // Can chat after 24 hours
    canViewOfficerChat: false,
    canViewLeaderChat: false,
    canEditDescription: false,
    bonusRPContribution: 0.5, // -50% RP contribution (trial period)
    warDeploymentPriority: 6,
  },
};

/**
 * Check if a role has specific permission
 * 
 * @param role - Clan member role
 * @param permission - Permission to check
 * @returns Whether the role has the permission
 * 
 * @example
 * if (hasPermission(ClanRole.OFFICER, 'canKick')) {
 *   // Officer can kick members
 * }
 */
export function hasPermission(
  role: ClanRole | 'LEADER' | 'CO_LEADER' | 'OFFICER' | 'ELITE' | 'MEMBER' | 'RECRUIT',
  permission: keyof Omit<ClanPermissions, 'bonusRPContribution' | 'warDeploymentPriority'>
): boolean {
  return ROLE_PERMISSIONS[role as ClanRole][permission];
}

/**
 * Get bonus RP contribution multiplier for role
 * 
 * @param role - Clan member role
 * @returns RP contribution multiplier (1.0 = normal, 1.15 = +15%, 0.5 = -50%)
 * 
 * @example
 * const rpContributed = baseRP * getRPBonus(ClanRole.ELITE); // 1.15x for Elite
 */
export function getRPBonus(role: ClanRole): number {
  return ROLE_PERMISSIONS[role].bonusRPContribution;
}

/**
 * Get war deployment priority for role
 * 
 * @param role - Clan member role
 * @returns Priority level (1 = highest, 6 = lowest)
 * 
 * @example
 * const priority = getWarPriority(ClanRole.CO_LEADER); // Returns 2
 */
export function getWarPriority(role: ClanRole): number {
  return ROLE_PERMISSIONS[role].warDeploymentPriority;
}

/**
 * Clan bank tax configuration
 */
export interface ClanTaxConfig {
  metal: number;            // Tax rate 0-50% on metal harvests
  energy: number;           // Tax rate 0-50% on energy harvests
  researchPoints: number;   // Tax rate 0-50% on RP gains
}

/**
 * Clan bank transaction types
 * Note: Different from general BankTransactionType in game.types.ts
 * This is specific to clan banking operations
 */
export enum ClanBankTransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TAX_COLLECTION = 'TAX_COLLECTION',
  RESEARCH_SPENDING = 'RESEARCH_SPENDING',
  PERK_ACTIVATION = 'PERK_ACTIVATION',
  BANK_UPGRADE = 'BANK_UPGRADE',
}

/**
 * Clan bank transaction record
 */
export interface ClanBankTransaction {
  transactionId: string;
  type: ClanBankTransactionType;
  playerId?: string;
  username?: string;
  amount: {
    metal?: number;
    energy?: number;
    researchPoints?: number;
  };
  timestamp: Date;
  description: string;
}

/**
 * Clan bank structure
 */
export interface ClanBank {
  treasury: {
    metal: number;
    energy: number;
    researchPoints: number;
  };
  taxRates: ClanTaxConfig;
  upgradeLevel: number;      // 1-6 upgrade levels
  capacity: number;          // Maximum storage per resource
  transactions: ClanBankTransaction[];  // Last 100 transactions
}

/**
 * Clan perk categories
 */
export enum ClanPerkCategory {
  COMBAT = 'COMBAT',
  ECONOMIC = 'ECONOMIC',
  SOCIAL = 'SOCIAL',
  STRATEGIC = 'STRATEGIC',
}

/**
 * Clan perk tier types
 */
export enum ClanPerkTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  LEGENDARY = 'LEGENDARY',
}

/**
 * Clan perk definition (enhanced for Phase 2)
 */
export interface ClanPerk {
  id: string;                     // Unique perk ID
  name: string;                   // Display name
  description: string;            // Perk effect description
  category: ClanPerkCategory;     // Perk category
  tier: ClanPerkTier;             // Tier (Bronze, Silver, Gold, Legendary)
  requiredLevel: number;          // Minimum clan level
  cost: {                         // Activation cost
    metal: number;
    energy: number;
    researchPoints: number;
  };
  bonus: {                        // Bonus provided
    type: 'attack' | 'defense' | 'resource_yield' | 'xp_gain' | 'territory_cost' | 'max_members';
    value: number;                // Percentage or flat value
  };
  activatedAt?: Date;             // When perk was activated
  activatedBy?: string;           // Player ID who activated
}

/**
 * Clan level progression (enhanced for Phase 2)
 */
export interface ClanLevel {
  currentLevel: number;           // Current level (1-50)
  totalXP: number;                // Total XP accumulated since level 1
  currentLevelXP: number;         // XP progress in current level
  xpToNextLevel: number;          // XP remaining to reach next level
  featuresUnlocked: string[];     // Features unlocked (perks, monuments, warfare)
  milestonesCompleted: Array<{
    level: number;
    completedAt: Date;
    rewards: { metal: number; energy: number; researchPoints: number };
  }>;
  lastLevelUp?: Date;             // When clan last leveled up
  lastXPGain?: Date;              // When clan last gained XP
  prestigeBadge?: string;         // Visual badge/title for max level
}

/**
 * Clan research categories (enhanced 4-branch system)
 */
export enum ClanResearchCategory {
  INDUSTRIAL = 'INDUSTRIAL',
  MILITARY = 'MILITARY',
  ECONOMIC = 'ECONOMIC',
  SOCIAL = 'SOCIAL',
}

/**
 * Clan war status types
 */
export enum ClanWarStatus {
  DECLARED = 'DECLARED',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  TRUCE = 'TRUCE',
}

/**
 * Clan territory tile types
 */
export enum ClanTerritoryType {
  STANDARD = 'STANDARD',
  MONUMENT = 'MONUMENT',
  STRONGHOLD = 'STRONGHOLD',
}

/**
 * Clan member relationship
 */
export interface ClanMember {
  playerId: string;         // Player username
  username: string;         // Display name
  role: ClanRole;           // Member role (Leader, Officer, Member)
  joinedAt: Date;           // When member joined clan
  lastActive: Date;         // Last activity timestamp
}

/**
 * Main clan document (enhanced with levels, perks, banking)
 */
export interface Clan {
  _id?: ObjectId;
  name: string;             // Full clan name
  tag: string;              // 2-6 character clan tag (e.g., [DARK])
  description: string;      // Clan description/motto
  leaderId: string;         // Username of clan leader
  
  // Membership (enhanced)
  members: ClanMember[];    // Array of clan members
  maxMembers: number;       // Maximum members (upgradeable)
  
  // Clan progression (ENHANCED for Phase 2)
  level: ClanLevel;         // Full level progression object
  
  // Creation timestamp
  createdAt: Date;
  
  // Settings (NEW)
  settings: {
    messageOfTheDay: string;
    isRecruiting: boolean;
    minLevelToJoin: number;
    requiresApproval: boolean;
    allowTerritoryControl: boolean;
    allowWarDeclarations: boolean;
  };
  
  // Statistics (enhanced)
  stats: {
    totalPower: number;     // Calculated power rating
    totalTerritories: number; // Territory count
    totalMonuments: number; // Monument count
    warsWon: number;
    warsLost: number;
    totalRP: number;        // Total RP contributed (NEW)
  };
  
  // Research progress (enhanced structure)
  research: {
    researchPoints: number; // Shared RP pool
    unlockedTechs: string[]; // Array of unlocked research IDs
    activeResearch: string | null; // Currently researching tech ID
  };
  
  // Clan bank (NEW)
  bank: ClanBank;
  
  // Active perks (NEW)
  activePerks: ClanPerk[];
  
  // Territory
  territories: ClanTerritory[];
  
  // Monuments
  monuments: MonumentType[];
  
  // Wars
  wars: {
    active: ClanWar[];
    history: ClanWar[];
  };
}

/**
 * Clan research node definition
 */
export interface ClanResearch {
  researchId: string;       // Unique identifier
  name: string;             // Display name
  description: string;      // What it does
  branch: ResearchBranch;   // Research tree branch
  level: number;            // Current level (0-5)
  maxLevel: number;         // Maximum level
  
  // Cost per level
  cost: {
    rp: number;             // Research Points required
    metal?: number;         // Optional resource cost
    energy?: number;
  };
  
  // Prerequisites
  requires?: string[];      // Required research IDs
  
  // Bonuses granted
  bonuses: {
    type: 'attack' | 'defense' | 'metal_yield' | 'energy_yield' | 'member_capacity' | 'territory_cost_reduction';
    value: number;          // Bonus percentage or flat value
  }[];
}

/**
 * Clan territory tile
 */
export interface ClanTerritory {
  _id?: ObjectId;
  clanId: string;           // Owning clan
  tileX: number;            // X coordinate
  tileY: number;            // Y coordinate
  claimedAt: Date;          // When claimed
  claimedBy: string;        // Player who claimed it
  defenseBonus: number;     // Defense bonus percentage (+10% per adjacent tile)
}

/**
 * Clan war declaration (enhanced)
/**
 * Clan war declaration (enhanced)
 */
export interface ClanWar {
  _id?: ObjectId;
  warId: string;            // Unique war identifier
  attackerClanId: string;   // Attacking clan
  defenderClanId: string;   // Defending clan
  
  status: ClanWarStatus;    // Current war status
  
  // War timeline
  declaredAt: Date;         // When declared
  startedAt?: Date;         // When became active
  endedAt?: Date;           // When concluded
  
  // Costs
  declarationCost: {
    metal: number;          // 2000 Metal
    energy: number;         // 2000 Energy
  };
  
  // War statistics
  stats: {
    attackerTerritoryGained: number;
    defenderTerritoryGained: number;
    attackerBattlesWon: number;
    defenderBattlesWon: number;
  };
  
  // Outcome
  winner?: string;          // Winning clan ID
}

/**
 * Monument instance
 */
export interface ClanMonument {
  _id?: ObjectId;
  monumentId: string;       // Unique monument identifier
  type: MonumentType;       // Monument type
  name: string;             // Display name
  location: {
    centerX: number;        // Center tile X
    centerY: number;        // Center tile Y
    requiredTiles: Array<{ x: number; y: number }>;  // 3x3 grid
  };
  
  // Control
  controllingClanId?: string;  // Current controlling clan (null if unclaimed)
  controlledSince?: Date;      // When control began
  
  // Bonuses granted to controlling clan
  bonuses: {
    type: string;           // Bonus type
    value: number;          // Bonus value
    description: string;    // Human-readable description
  }[];
}

/**
 * Clan chat message
 */
export interface ClanChatMessage {
  _id?: ObjectId;
  clanId: string;           // Clan identifier
  senderId: string;         // Player username
  senderRole: ClanRole;     // Role at time of message
  message: string;          // Message content (max 500 characters)
  channel: 'general' | 'officer' | 'leader';  // Chat channel
  timestamp: Date;          // When sent
  deleted?: boolean;        // Soft delete flag
}

/**
 * Clan activity log entry
 */
export interface ClanActivity {
  _id?: ObjectId;
  clanId: string;           // Clan identifier
  activityType: ClanActivityType;  // Type of activity
  playerId?: string;        // Player involved (if applicable)
  username?: string;        // Player username
  details: {                // Activity-specific details
    [key: string]: any;
  };
  timestamp: Date;          // When activity occurred
}

// ============================================================================
// QUERY & UTILITY INTERFACES
// ============================================================================

/**
 * Clan creation parameters
 */
export interface CreateClanParams {
  name: string;             // Clan name (3-30 characters)
  tag: string;              // Clan tag (2-4 characters, uppercase)
  description?: string;     // Optional description
  leaderId: string;         // Creating player username
}

/**
 * Clan member invitation
 */
export interface ClanInvitation {
  _id?: ObjectId;
  clanId: string;           // Inviting clan
  clanName: string;         // Clan name for display
  invitedBy: string;        // Inviting player
  invitedPlayer: string;    // Invited player username
  invitedAt: Date;          // Invitation timestamp
  expiresAt: Date;          // Expiration (24 hours)
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

/**
 * Clan statistics for leaderboard
 */
export interface ClanLeaderboardEntry {
  rank: number;             // Leaderboard position
  clanId: string;           // Clan identifier
  clanName: string;         // Clan name
  tag: string;              // Clan tag
  memberCount: number;      // Number of members
  territoryCount: number;   // Tiles controlled
  monumentsControlled: number;  // Monuments held
  totalPower: number;       // Overall power rating
  researchLevel: number;    // Total research levels
  warsWon: number;          // Total wars won
  warsLost: number;         // Total wars lost
  totalRP: number;          // Total RP contributed
  avgMemberLevel: number;   // Average member XP level
}

/**
 * Clan ranking categories for leaderboard
 */
export enum ClanRankingType {
  TOTAL_POWER = 'TOTAL_POWER',           // Overall power rating
  MEMBER_COUNT = 'MEMBER_COUNT',         // Most members
  TERRITORY = 'TERRITORY',               // Most territory controlled
  MONUMENTS = 'MONUMENTS',               // Most monuments controlled
  RESEARCH = 'RESEARCH',                 // Highest research level
  WARS_WON = 'WARS_WON',                 // Most wars won
  RP_CONTRIBUTED = 'RP_CONTRIBUTED',     // Total RP contributed
  AVG_MEMBER_LEVEL = 'AVG_MEMBER_LEVEL'  // Highest average member level
}

/**
 * Clan bonuses calculation result
 */
export interface ClanBonuses {
  attack: number;           // Attack bonus percentage
  defense: number;          // Defense bonus percentage
  metalYield: number;       // Metal harvest bonus percentage
  energyYield: number;      // Energy harvest bonus percentage
  auctionFeeReduction: number;  // Auction fee reduction percentage
  rpGain: number;           // RP gain bonus percentage
  xpGain: number;           // XP gain bonus percentage
}

// ============================================================================
// VALIDATION & HELPERS
// ============================================================================

/**
 * Clan naming rules
 */
export const CLAN_NAMING_RULES = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 30,
  TAG_MIN_LENGTH: 2,
  TAG_MAX_LENGTH: 5,
  TAG_PATTERN: /^[A-Z0-9]+$/,  // Uppercase alphanumeric only
};

/**
 * Clan costs and limits
 */
export const CLAN_CONSTANTS = {
  CREATION_COST: {
    metal: 1500000,    // 1.5M Metal (admin configurable via server settings)
    energy: 1500000,   // 1.5M Energy (admin configurable via server settings)
  },
  MINIMUM_MEMBERS_TO_CREATE: 1,  // Solo players can create clans
  DEFAULT_MAX_MEMBERS: 20,        // Initial member cap
  TERRITORY_CLAIM_COST: {
    metal: 500,
    energy: 500,
  },
  WAR_DECLARATION_COST: {
    metal: 2000,
    energy: 2000,
  },
  DEFENSE_BONUS_PER_TILE: 10,     // +10% DEF per adjacent clan tile
  MAX_DEFENSE_BONUS: 50,          // Cap at +50% DEF
  MONUMENT_REQUIRED_TILES: 9,     // 3x3 grid
  CHAT_MESSAGE_MAX_LENGTH: 500,
  CHAT_HISTORY_LIMIT: 100,        // Last 100 messages
  CHAT_RETENTION_DAYS: 7,         // Keep messages for 7 days
  MAX_CLAN_LEVEL: 50,             // Maximum clan level
  BANK_BASE_CAPACITY: 1000000,    // 1M base capacity per resource
};

/**
 * Clan bank constants
 */
export const CLAN_BANK_CONSTANTS = {
  MIN_TAX_RATE: 0,
  MAX_TAX_RATE: 50,
  UPGRADE_COSTS: [
    { level: 2, metal: 50000, energy: 50000, rp: 100 },
    { level: 3, metal: 100000, energy: 100000, rp: 250 },
    { level: 4, metal: 200000, energy: 200000, rp: 500 },
    { level: 5, metal: 400000, energy: 400000, rp: 1000 },
    { level: 6, metal: 800000, energy: 800000, rp: 2000 },
  ],
  CAPACITY_MULTIPLIERS: [1, 1.5, 2, 3, 4, 6],  // Capacity multiplier per upgrade level
  TRANSACTION_HISTORY_LIMIT: 100,
};

/**
 * Helper function to calculate tax amount
 * 
 * @param amount - Amount to tax
 * @param taxRate - Tax rate (0-50)
 * @returns Tax amount
 * 
 * @example
 * const tax = calculateTaxAmount(1000, 10); // Returns 100 (10% of 1000)
 */
export function calculateTaxAmount(amount: number, taxRate: number): number {
  if (taxRate < CLAN_BANK_CONSTANTS.MIN_TAX_RATE || taxRate > CLAN_BANK_CONSTANTS.MAX_TAX_RATE) {
    throw new Error(`Tax rate must be between ${CLAN_BANK_CONSTANTS.MIN_TAX_RATE}% and ${CLAN_BANK_CONSTANTS.MAX_TAX_RATE}%`);
  }
  return Math.floor((amount * taxRate) / 100);
}

/**
 * Research tree definitions
 */
export const RESEARCH_TREE: Record<string, ClanResearch> = {
  // STRENGTH Branch
  strength_1: {
    researchId: 'strength_1',
    name: 'Basic Combat Training',
    description: '+2% Attack for all clan members',
    branch: ResearchBranch.STRENGTH,
    level: 0,
    maxLevel: 1,
    cost: { rp: 100 },
    bonuses: [{ type: 'attack', value: 2 }],
  },
  strength_2: {
    researchId: 'strength_2',
    name: 'Advanced Tactics',
    description: '+4% Attack for all clan members',
    branch: ResearchBranch.STRENGTH,
    level: 0,
    maxLevel: 1,
    cost: { rp: 250 },
    requires: ['strength_1'],
    bonuses: [{ type: 'attack', value: 4 }],
  },
  strength_3: {
    researchId: 'strength_3',
    name: 'Master Warfare',
    description: '+6% Attack for all clan members',
    branch: ResearchBranch.STRENGTH,
    level: 0,
    maxLevel: 1,
    cost: { rp: 500 },
    requires: ['strength_2'],
    bonuses: [{ type: 'attack', value: 6 }],
  },
  
  // DEFENSE Branch
  defense_1: {
    researchId: 'defense_1',
    name: 'Fortification Basics',
    description: '+2% Defense for all clan members',
    branch: ResearchBranch.DEFENSE,
    level: 0,
    maxLevel: 1,
    cost: { rp: 100 },
    bonuses: [{ type: 'defense', value: 2 }],
  },
  defense_2: {
    researchId: 'defense_2',
    name: 'Reinforced Positions',
    description: '+4% Defense for all clan members',
    branch: ResearchBranch.DEFENSE,
    level: 0,
    maxLevel: 1,
    cost: { rp: 250 },
    requires: ['defense_1'],
    bonuses: [{ type: 'defense', value: 4 }],
  },
  defense_3: {
    researchId: 'defense_3',
    name: 'Impenetrable Walls',
    description: '+6% Defense for all clan members',
    branch: ResearchBranch.DEFENSE,
    level: 0,
    maxLevel: 1,
    cost: { rp: 500 },
    requires: ['defense_2'],
    bonuses: [{ type: 'defense', value: 6 }],
  },
  
  // ECONOMIC Branch
  economic_1: {
    researchId: 'economic_1',
    name: 'Resource Efficiency',
    description: '+10% Metal and Energy yield for all clan members',
    branch: ResearchBranch.ECONOMIC,
    level: 0,
    maxLevel: 1,
    cost: { rp: 200 },
    bonuses: [
      { type: 'metal_yield', value: 10 },
      { type: 'energy_yield', value: 10 },
    ],
  },
  economic_2: {
    researchId: 'economic_2',
    name: 'Territory Expansion',
    description: '-20% cost for territory claims',
    branch: ResearchBranch.ECONOMIC,
    level: 0,
    maxLevel: 1,
    cost: { rp: 400 },
    requires: ['economic_1'],
    bonuses: [{ type: 'territory_cost_reduction', value: 20 }],
  },
  economic_3: {
    researchId: 'economic_3',
    name: 'Growing Empire',
    description: '+10 maximum clan members',
    branch: ResearchBranch.ECONOMIC,
    level: 0,
    maxLevel: 1,
    cost: { rp: 600 },
    requires: ['economic_2'],
    bonuses: [{ type: 'member_capacity', value: 10 }],
  },
};

/**
 * Monument definitions with bonuses
 */
export const MONUMENTS: Record<MonumentType, Omit<ClanMonument, '_id' | 'controllingClanId' | 'controlledSince'>> = {
  [MonumentType.ANCIENT_FORGE]: {
    monumentId: 'monument_forge',
    type: MonumentType.ANCIENT_FORGE,
    name: 'Ancient Forge',
    location: {
      centerX: 50,
      centerY: 50,
      requiredTiles: [
        { x: 49, y: 49 }, { x: 50, y: 49 }, { x: 51, y: 49 },
        { x: 49, y: 50 }, { x: 50, y: 50 }, { x: 51, y: 50 },
        { x: 49, y: 51 }, { x: 50, y: 51 }, { x: 51, y: 51 },
      ],
    },
    bonuses: [
      { type: 'metal_yield', value: 5, description: '+5% Metal harvest for all clan members' },
    ],
  },
  [MonumentType.WAR_MEMORIAL]: {
    monumentId: 'monument_memorial',
    type: MonumentType.WAR_MEMORIAL,
    name: 'War Memorial',
    location: {
      centerX: 75,
      centerY: 75,
      requiredTiles: [
        { x: 74, y: 74 }, { x: 75, y: 74 }, { x: 76, y: 74 },
        { x: 74, y: 75 }, { x: 75, y: 75 }, { x: 76, y: 75 },
        { x: 74, y: 76 }, { x: 75, y: 76 }, { x: 76, y: 76 },
      ],
    },
    bonuses: [
      { type: 'attack', value: 10, description: '+10% Attack for all clan members' },
    ],
  },
  [MonumentType.MARKET_PLAZA]: {
    monumentId: 'monument_market',
    type: MonumentType.MARKET_PLAZA,
    name: 'Market Plaza',
    location: {
      centerX: 25,
      centerY: 75,
      requiredTiles: [
        { x: 24, y: 74 }, { x: 25, y: 74 }, { x: 26, y: 74 },
        { x: 24, y: 75 }, { x: 25, y: 75 }, { x: 26, y: 75 },
        { x: 24, y: 76 }, { x: 25, y: 76 }, { x: 26, y: 76 },
      ],
    },
    bonuses: [
      { type: 'auction_fee_reduction', value: 5, description: '-5% auction fees (stacks with member benefit)' },
    ],
  },
  [MonumentType.RESEARCH_LAB]: {
    monumentId: 'monument_lab',
    type: MonumentType.RESEARCH_LAB,
    name: 'Research Laboratory',
    location: {
      centerX: 75,
      centerY: 25,
      requiredTiles: [
        { x: 74, y: 24 }, { x: 75, y: 24 }, { x: 76, y: 24 },
        { x: 74, y: 25 }, { x: 75, y: 25 }, { x: 76, y: 25 },
        { x: 74, y: 26 }, { x: 75, y: 26 }, { x: 76, y: 26 },
      ],
    },
    bonuses: [
      { type: 'rp_gain', value: 15, description: '+15% RP gain for all clan members' },
    ],
  },
  [MonumentType.GRAND_TEMPLE]: {
    monumentId: 'monument_temple',
    type: MonumentType.GRAND_TEMPLE,
    name: 'Grand Temple',
    location: {
      centerX: 25,
      centerY: 25,
      requiredTiles: [
        { x: 24, y: 24 }, { x: 25, y: 24 }, { x: 26, y: 24 },
        { x: 24, y: 25 }, { x: 25, y: 25 }, { x: 26, y: 25 },
        { x: 24, y: 26 }, { x: 25, y: 26 }, { x: 26, y: 26 },
      ],
    },
    bonuses: [
      { type: 'xp_gain', value: 5, description: '+5% XP gain for all clan members' },
    ],
  },
};

// ============================================================================
// XP AND LEVEL PROGRESSION TYPES
// ============================================================================

/**
 * Clan XP source types (for tracking where XP comes from)
 */
export type ClanXPSource =
  | 'harvest'
  | 'combat'
  | 'research'
  | 'building'
  | 'territory_claim'
  | 'monument_control'
  | 'member_join'
  | 'clan_created';

/**
 * Clan milestone rewards at specific levels
 */
export interface ClanMilestone {
  level: number;
  rewards: {
    metal: number;
    energy: number;
    researchPoints: number;
  };
  unlocksFeature?: string;
  description: string;
}

/**
 * Clan level constants
 */
export const CLAN_LEVEL_CONSTANTS = {
  MAX_LEVEL: 50,
  BASE_XP_REQUIREMENT: 1000,   // Base XP for level 2
  XP_EXPONENT: 1.8,             // Exponential curve exponent
} as const;

/**
 * XP rates for different actions (XP per unit)
 */
export const CLAN_XP_RATES: Record<ClanXPSource, number> = {
  harvest: 0.005,              // 5 XP per 1000 resources
  combat: 10,                  // 10 XP per enemy defeated
  research: 0.015,             // 15 XP per 1000 RP contributed
  building: 20,                // 20 XP per building completed
  territory_claim: 50,         // 50 XP per territory claimed
  monument_control: 100,       // 100 XP per monument controlled
  member_join: 25,             // 25 XP when member joins
  clan_created: 100,           // 100 XP for creating clan
};

/**
 * Milestone rewards at key levels
 */
export const CLAN_MILESTONES: ClanMilestone[] = [
  {
    level: 5,
    rewards: { metal: 50000, energy: 50000, researchPoints: 5000 },
    unlocksFeature: 'bronze_perks',
    description: 'Unlocks Bronze tier perks and rewards',
  },
  {
    level: 10,
    rewards: { metal: 100000, energy: 100000, researchPoints: 10000 },
    unlocksFeature: 'silver_perks',
    description: 'Unlocks Silver tier perks and increased rewards',
  },
  {
    level: 15,
    rewards: { metal: 250000, energy: 250000, researchPoints: 25000 },
    unlocksFeature: 'gold_perks',
    description: 'Unlocks Gold tier perks and major rewards',
  },
  {
    level: 20,
    rewards: { metal: 500000, energy: 500000, researchPoints: 50000 },
    unlocksFeature: 'legendary_perks',
    description: 'Unlocks Legendary perks and monument access',
  },
  {
    level: 25,
    rewards: { metal: 1000000, energy: 1000000, researchPoints: 100000 },
    unlocksFeature: 'warfare',
    description: 'Unlocks clan warfare and massive rewards',
  },
  {
    level: 30,
    rewards: { metal: 2000000, energy: 2000000, researchPoints: 200000 },
    unlocksFeature: 'advanced_monuments',
    description: 'Unlocks advanced monument control',
  },
  {
    level: 40,
    rewards: { metal: 5000000, energy: 5000000, researchPoints: 500000 },
    unlocksFeature: 'elite_warfare',
    description: 'Unlocks elite warfare bonuses',
  },
  {
    level: 50,
    rewards: { metal: 10000000, energy: 10000000, researchPoints: 1000000 },
    unlocksFeature: 'prestige_badge',
    description: 'Maximum level! Prestige badge and ultimate rewards',
  },
];

// ============================================================================
// PERK SYSTEM CONSTANTS
// ============================================================================

/**
 * Perk system limits
 */
export const CLAN_PERK_LIMITS = {
  MAX_ACTIVE_PERKS: 4,          // Maximum perks active at once
} as const;

/**
 * Perk catalog - all available perks
 */
export const CLAN_PERK_CATALOG: ClanPerk[] = [
  // ===== BRONZE TIER (Level 5+) =====
  {
    id: 'combat_bronze_berserker',
    name: 'Bronze Berserker',
    description: '+5% attack damage for all clan members',
    category: ClanPerkCategory.COMBAT,
    tier: ClanPerkTier.BRONZE,
    requiredLevel: 5,
    cost: { metal: 100000, energy: 100000, researchPoints: 10000 },
    bonus: { type: 'attack', value: 5 },
  },
  {
    id: 'combat_bronze_fortress',
    name: 'Bronze Fortress',
    description: '+5% defense for all clan members',
    category: ClanPerkCategory.COMBAT,
    tier: ClanPerkTier.BRONZE,
    requiredLevel: 5,
    cost: { metal: 100000, energy: 100000, researchPoints: 10000 },
    bonus: { type: 'defense', value: 5 },
  },
  {
    id: 'economic_bronze_prosperity',
    name: 'Bronze Prosperity',
    description: '+5% resource yield from harvesting',
    category: ClanPerkCategory.ECONOMIC,
    tier: ClanPerkTier.BRONZE,
    requiredLevel: 5,
    cost: { metal: 100000, energy: 100000, researchPoints: 10000 },
    bonus: { type: 'resource_yield', value: 5 },
  },
  {
    id: 'social_bronze_growth',
    name: 'Bronze Growth',
    description: '+5% XP gain for clan leveling',
    category: ClanPerkCategory.SOCIAL,
    tier: ClanPerkTier.BRONZE,
    requiredLevel: 5,
    cost: { metal: 100000, energy: 100000, researchPoints: 10000 },
    bonus: { type: 'xp_gain', value: 5 },
  },
  
  // ===== SILVER TIER (Level 10+) =====
  {
    id: 'combat_silver_conqueror',
    name: 'Silver Conqueror',
    description: '+10% attack damage for all clan members',
    category: ClanPerkCategory.COMBAT,
    tier: ClanPerkTier.SILVER,
    requiredLevel: 10,
    cost: { metal: 250000, energy: 250000, researchPoints: 25000 },
    bonus: { type: 'attack', value: 10 },
  },
  {
    id: 'combat_silver_bulwark',
    name: 'Silver Bulwark',
    description: '+10% defense for all clan members',
    category: ClanPerkCategory.COMBAT,
    tier: ClanPerkTier.SILVER,
    requiredLevel: 10,
    cost: { metal: 250000, energy: 250000, researchPoints: 25000 },
    bonus: { type: 'defense', value: 10 },
  },
  {
    id: 'economic_silver_abundance',
    name: 'Silver Abundance',
    description: '+10% resource yield from harvesting',
    category: ClanPerkCategory.ECONOMIC,
    tier: ClanPerkTier.SILVER,
    requiredLevel: 10,
    cost: { metal: 250000, energy: 250000, researchPoints: 25000 },
    bonus: { type: 'resource_yield', value: 10 },
  },
  {
    id: 'strategic_silver_expansion',
    name: 'Silver Expansion',
    description: '-10% territory claiming costs',
    category: ClanPerkCategory.STRATEGIC,
    tier: ClanPerkTier.SILVER,
    requiredLevel: 10,
    cost: { metal: 250000, energy: 250000, researchPoints: 25000 },
    bonus: { type: 'territory_cost', value: 10 },
  },
  
  // ===== GOLD TIER (Level 15+) =====
  {
    id: 'combat_gold_destroyer',
    name: 'Gold Destroyer',
    description: '+15% attack damage for all clan members',
    category: ClanPerkCategory.COMBAT,
    tier: ClanPerkTier.GOLD,
    requiredLevel: 15,
    cost: { metal: 500000, energy: 500000, researchPoints: 50000 },
    bonus: { type: 'attack', value: 15 },
  },
  {
    id: 'combat_gold_impenetrable',
    name: 'Gold Impenetrable',
    description: '+15% defense for all clan members',
    category: ClanPerkCategory.COMBAT,
    tier: ClanPerkTier.GOLD,
    requiredLevel: 15,
    cost: { metal: 500000, energy: 500000, researchPoints: 50000 },
    bonus: { type: 'defense', value: 15 },
  },
  {
    id: 'economic_gold_wealth',
    name: 'Gold Wealth',
    description: '+15% resource yield from harvesting',
    category: ClanPerkCategory.ECONOMIC,
    tier: ClanPerkTier.GOLD,
    requiredLevel: 15,
    cost: { metal: 500000, energy: 500000, researchPoints: 50000 },
    bonus: { type: 'resource_yield', value: 15 },
  },
  {
    id: 'social_gold_unity',
    name: 'Gold Unity',
    description: '+10% XP gain for clan leveling',
    category: ClanPerkCategory.SOCIAL,
    tier: ClanPerkTier.GOLD,
    requiredLevel: 15,
    cost: { metal: 500000, energy: 500000, researchPoints: 50000 },
    bonus: { type: 'xp_gain', value: 10 },
  },
  
  // ===== LEGENDARY TIER (Level 20+) =====
  {
    id: 'combat_legendary_annihilator',
    name: 'Legendary Annihilator',
    description: '+20% attack damage for all clan members',
    category: ClanPerkCategory.COMBAT,
    tier: ClanPerkTier.LEGENDARY,
    requiredLevel: 20,
    cost: { metal: 1000000, energy: 1000000, researchPoints: 100000 },
    bonus: { type: 'attack', value: 20 },
  },
  {
    id: 'combat_legendary_invincible',
    name: 'Legendary Invincible',
    description: '+20% defense for all clan members',
    category: ClanPerkCategory.COMBAT,
    tier: ClanPerkTier.LEGENDARY,
    requiredLevel: 20,
    cost: { metal: 1000000, energy: 1000000, researchPoints: 100000 },
    bonus: { type: 'defense', value: 20 },
  },
  {
    id: 'economic_legendary_empire',
    name: 'Legendary Empire',
    description: '+20% resource yield from harvesting',
    category: ClanPerkCategory.ECONOMIC,
    tier: ClanPerkTier.LEGENDARY,
    requiredLevel: 20,
    cost: { metal: 1000000, energy: 1000000, researchPoints: 100000 },
    bonus: { type: 'resource_yield', value: 20 },
  },
  {
    id: 'strategic_legendary_dominion',
    name: 'Legendary Dominion',
    description: '-20% territory claiming costs',
    category: ClanPerkCategory.STRATEGIC,
    tier: ClanPerkTier.LEGENDARY,
    requiredLevel: 20,
    cost: { metal: 1000000, energy: 1000000, researchPoints: 100000 },
    bonus: { type: 'territory_cost', value: 20 },
  },
];

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Clan Creation Requirements:
 *    - 1000 Metal + 1000 Energy cost
 *    - Unique clan tag (2-4 uppercase alphanumeric characters)
 *    - Unique clan name (3-30 characters)
 *    - Leader automatically assigned LEADER role
 *    - Solo players can create clans (no minimum member requirement)
 * 
 * 2. Member Management:
 *    - LEADER: Full control (disband, transfer leadership, promote to any role, kick anyone)
 *    - CO_LEADER: Second-in-command (promote to Officer/Elite, manage wars/territories, kick Members/Recruits)
 *    - OFFICER: Management (promote Members to Elite, kick Members/Recruits, invite, manage territories/research)
 *    - ELITE: Veteran (invite members, +15% RP contribution bonus, priority war deployment)
 *    - MEMBER: Standard (contribute RP/resources, participate in chat, view clan info)
 *    - RECRUIT: Trial period (50% RP contribution, 24-hour chat restriction, basic access)
 *    - Max 1 clan per player (enforced at join/create)
 * 
 * 3. Research System:
 *    - 9 total research nodes across 3 branches
 *    - Shared RP pool contributed by all members
 *    - Research unlocks apply permanent bonuses to all clan members
 *    - Prerequisites enforce tech tree progression
 * 
 * 4. Territory Mechanics:
 *    - Claiming costs 500 Metal + 500 Energy per tile
 *    - Territory must be adjacent to existing clan tiles (no islands)
 *    - Defense bonus: +10% DEF per adjacent clan tile (max +50%)
 *    - Territory can be captured during active wars
 * 
 * 5. Warfare System:
 *    - War declaration costs 2000 Metal + 2000 Energy
 *    - Wars have DECLARED → ACTIVE → ENDED lifecycle
 *    - Territory capture only allowed during ACTIVE war status
 *    - Battle logs integrated with activity logging system
 * 
 * 6. Monument Control:
 *    - Requires full 3x3 grid (9 tiles) around monument center
 *    - Permanent bonuses while controlled
 *    - Can be contested during clan wars
 *    - Only one clan can control each monument at a time
 * 
 * 7. Social Features:
 *    - Clan chat with 100 message history, 7-day retention
 *    - Officer/Leader channels for leadership discussions
 *    - Activity feed tracking all clan events
 *    - Integration with activity logging for analytics
 * 
 * 8. Member Benefits:
 *    - 0% auction house fees (vs 5% for non-clan)
 *    - Research bonuses apply to all members
 *    - Monument bonuses apply to all members
 *    - Territory defense bonuses when on clan land
 */

// ============================================================================
// CLAN ANALYTICS TYPES (for ClanInspectorModal)
// ============================================================================

export interface ClanAnalyticsOverview {
  totalMembers: number;
  activeMembers7d: number;
  treasury: { metal: number; energy: number };
  territoryCount: number;
  warRecord: { wins: number; losses: number };
  healthScore: number;
  createdAt: string;
}

export interface ClanAnalyticsMember {
  username: string;
  role: ClanRole;
  joinedAt: string;
  lastActive: string;
  rpContributed: number;
  warsParticipated: number;
  territoriesCaptured: number;
}

export interface ClanAnalyticsFinancial {
  totalDeposits: number;
  totalWithdrawals: number;
  netFlow: number;
  taxCollected: number;
  transactions: Array<{
    id: string;
    username: string;
    type: 'deposit' | 'withdrawal' | 'tax';
    amount: number;
    resource: 'metal' | 'energy';
    createdAt: string;
  }>;
}

export interface ClanAnalyticsTerritory {
  totalTerritories: number;
  incomePerDay: number;
  defenseBonus: number;
  territories: Array<{
    x: number;
    y: number;
    terrain: string;
    income: number;
    capturedAt: string;
  }>;
}

export interface ClanAnalyticsWarfare {
  totalWars: number;
  currentWars: number;
  winRate: number;
  battles: Array<{
    id: string;
    opponentClan: string;
    result: 'win' | 'loss';
    date: string;
    territoriesGained: number;
    territoriesLost: number;
  }>;
}

export interface ClanAnalyticsActivity {
  totalActions: number;
  actionsByType: Record<string, number>;
  recentActivities: Array<{
    id: string;
    username: string;
    action: string;
    details: string;
    createdAt: string;
  }>;
}

export interface ClanAnalyticsResearch {
  totalRPContributed: number;
  completedResearch: string[];
  inProgress: Array<{
    name: string;
    progress: number;
    required: number;
  }>;
  activePerks: string[];
}

export interface ClanAnalyticsAlliance {
  totalAlliances: number;
  alliances: Array<{
    clanName: string;
    formedAt: string;
    status: 'active' | 'broken';
    terms: string;
  }>;
}

export interface ClanAnalyticsHealth {
  healthScore: number;
  trend: 'improving' | 'stable' | 'declining';
  factors: Array<{
    name: string;
    score: number;
    weight: number;
  }>;
  prediction: string;
}

export type ClanAnalyticsData =
  | ClanAnalyticsOverview
  | ClanAnalyticsMember[]
  | ClanAnalyticsFinancial
  | ClanAnalyticsTerritory
  | ClanAnalyticsWarfare
  | ClanAnalyticsActivity
  | ClanAnalyticsResearch
  | ClanAnalyticsAlliance
  | ClanAnalyticsHealth;
