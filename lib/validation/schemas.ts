/**
 * @file lib/validation/schemas.ts
 * @created 2025-10-24 (FID-20251024-PROD: Production Readiness)
 * @overview Centralized Zod validation schemas for API routes
 * 
 * OVERVIEW:
 * Type-safe request validation using Zod schemas. Provides runtime validation
 * with automatic TypeScript type inference. Prevents malformed data, injection
 * attacks, and ensures data integrity across all API endpoints.
 * 
 * FEATURES:
 * - Request body validation with detailed error messages
 * - Type inference for TypeScript integration
 * - Reusable schema components
 * - Custom validation rules (username format, coordinates, etc.)
 * - Sanitization and normalization
 * 
 * USAGE:
 * import { BattleAttackSchema } from '@/lib/validation/schemas';
 * 
 * const validated = BattleAttackSchema.parse(await request.json());
 * // Type is inferred: { targetUsername: string, units: Record<string, number> }
 */

import { z } from 'zod';
import { AuctionItemType, ResourceType } from '@/types/auction.types';
import { UnitType } from '@/types/game.types';

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

/**
 * Valid username pattern (alphanumeric + underscore, 3-20 chars)
 */
export const UsernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

/**
 * Valid email pattern
 */
export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim();

/**
 * Password requirements (min 8 chars, uppercase, lowercase, number)
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Standard coordinate for game grid (0-based, legacy system)
 * Used by older systems (harvest, factory, waypoints). Most systems use 0-99
 * for compatibility with existing data. For new systems using 1-150 world
 * coordinates, use MapCoordinateSchema instead.
 */
export const CoordinateSchema = z
  .number()
  .int('Coordinate must be an integer')
  .min(0, 'Coordinate must be at least 0')
  .max(150, 'Coordinate must be at most 150');

/**
 * Map coordinate for world grid (1-150)
 * Some systems use a 1-based 150×150 grid (tiles numbered 1..150). Use this
 * schema for APIs that expect world positions (flag, auto-farm, etc.).
 */
export const MapCoordinateSchema = z
  .number()
  .int('Coordinate must be an integer')
  .min(1, 'Coordinate must be at least 1')
  .max(150, 'Coordinate must be at most 150');

/**
 * Positive integer (for resource amounts, unit counts, etc.)
 */
export const PositiveIntSchema = z
  .number()
  .int('Must be an integer')
  .nonnegative('Must be non-negative');

/**
 * Positive number (for amounts that can have decimals)
 */
export const PositiveNumberSchema = z
  .number()
  .nonnegative('Must be non-negative');

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

/**
 * Login request validation
 */
export const LoginSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  rememberMe: z.boolean().optional().default(false),
});

export type LoginRequest = z.infer<typeof LoginSchema>;

/**
 * Registration request validation
 */
export const RegisterSchema = z.object({
  username: UsernameSchema,
  email: EmailSchema,
  password: PasswordSchema,
});

export type RegisterRequest = z.infer<typeof RegisterSchema>;

// ============================================================================
// BATTLE SCHEMAS
// ============================================================================

/**
 * Battle attack request validation
 */
export const BattleAttackSchema = z.object({
  targetUsername: UsernameSchema,
  units: z.record(z.string(), PositiveIntSchema),
});

export type BattleAttackRequest = z.infer<typeof BattleAttackSchema>;

// ============================================================================
// MOVEMENT SCHEMAS
// ============================================================================

/**
 * Movement request validation
 */
export const MoveSchema = z.object({
  username: UsernameSchema,
  direction: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'REFRESH']),
});

export type MoveRequest = z.infer<typeof MoveSchema>;

// ============================================================================
// RESOURCE SCHEMAS
// ============================================================================

/**
 * Harvest request validation
 */
export const HarvestSchema = z.object({
  username: UsernameSchema,
  x: CoordinateSchema.optional(),
  y: CoordinateSchema.optional(),
});

export type HarvestRequest = z.infer<typeof HarvestSchema>;

// ============================================================================
// BANKING SCHEMAS
// ============================================================================

/**
 * Bank deposit validation
 * API format: { resourceType: "metal" | "energy", amount: number }
 * Note: Only metal and energy exist as resources in DarkFrame
 */
export const BankDepositSchema = z.object({
  resourceType: z.enum(['metal', 'energy']),
  amount: PositiveIntSchema.min(1, 'Deposit amount must be at least 1'),
});

export type BankDepositRequest = z.infer<typeof BankDepositSchema>;

/**
 * Bank withdrawal validation
 * API format: { resourceType: "metal" | "energy", amount: number }
 * Note: Only metal and energy exist as resources in DarkFrame
 */
export const BankWithdrawSchema = z.object({
  resourceType: z.enum(['metal', 'energy']),
  amount: PositiveIntSchema.min(1, 'Withdrawal amount must be at least 1'),
});

export type BankWithdrawRequest = z.infer<typeof BankWithdrawSchema>;

/**
 * Resource exchange validation
 */
export const ExchangeSchema = z.object({
  fromResource: z.enum(['metal', 'energy']),
  toResource: z.enum(['metal', 'energy']),
  amount: PositiveIntSchema,
}).refine(
  (data) => data.fromResource !== data.toResource,
  { message: 'Cannot exchange same resource type' }
);

export type ExchangeRequest = z.infer<typeof ExchangeSchema>;

// ============================================================================
// UNIT BUILDING SCHEMAS
// ============================================================================

/**
 * Unit build request validation
 * Matches app/api/player/build-unit/route.ts API format
 * 
 * Updated 2025-11-04: Removed hardcoded 100 quantity limit
 * Validation now relies on backend checks (resources, factory slots, etc.)
 */
export const BuildUnitSchema = z.object({
  username: UsernameSchema,
  unitTypeId: z.string().min(1, 'Unit type ID is required'),
  quantity: PositiveIntSchema.min(1, 'Quantity must be at least 1').default(1),
});

export type BuildUnitRequest = z.infer<typeof BuildUnitSchema>;

// ============================================================================
// FACTORY SCHEMAS
// ============================================================================

/**
 * Factory produce validation
 * Matches app/api/factory/produce/route.ts API format
 */
export const FactoryProduceSchema = z.object({
  username: UsernameSchema,
  x: CoordinateSchema,
  y: CoordinateSchema,
  unitType: z.string().optional(),
  quantity: z.number().int().min(1).max(1000).optional(),
});

export type FactoryProduceRequest = z.infer<typeof FactoryProduceSchema>;

/**
 * Factory upgrade validation
 * Matches app/api/factory/upgrade/route.ts API format
 */
export const FactoryUpgradeSchema = z.object({
  factoryX: CoordinateSchema,
  factoryY: CoordinateSchema,
});

export type FactoryUpgradeRequest = z.infer<typeof FactoryUpgradeSchema>;

// ============================================================================
// CLAN SCHEMAS
// ============================================================================

/**
 * Clan creation validation
 */
export const CreateClanSchema = z.object({
  name: z
    .string()
    .min(3, 'Clan name must be at least 3 characters')
    .max(30, 'Clan name must be at most 30 characters')
    .regex(/^[a-zA-Z0-9 _-]+$/, 'Clan name can only contain letters, numbers, spaces, hyphens, and underscores'),
  tag: z
    .string()
    .min(2, 'Clan tag must be at least 2 characters')
    .max(5, 'Clan tag must be at most 5 characters')
    .regex(/^[A-Z0-9]+$/, 'Clan tag must be uppercase letters and numbers only')
    .optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  minLevel: z.number().min(1).max(50).optional(),
});

export type CreateClanRequest = z.infer<typeof CreateClanSchema>;

/**
 * Clan join request validation
 */
export const JoinClanSchema = z.object({
  invitationId: z.string().min(1, 'Invitation ID is required'),
});

export type JoinClanRequest = z.infer<typeof JoinClanSchema>;

// ============================================================================
// AUCTION SCHEMAS
// ============================================================================

/**
 * Auction item validation (for CreateAuctionRequest)
 * Matches types/auction.types.ts AuctionItem interface
 */
export const AuctionItemSchema = z.object({
  itemType: z.nativeEnum(AuctionItemType),
  // Unit fields
  unitType: z.nativeEnum(UnitType).optional(),
  unitId: z.string().optional(),
  unitStrength: PositiveIntSchema.optional(),
  unitDefense: PositiveIntSchema.optional(),
  // Resource fields
  resourceType: z.nativeEnum(ResourceType).optional(),
  resourceAmount: PositiveIntSchema.optional(),
  // Tradeable item fields
  tradeableItemQuantity: PositiveIntSchema.optional(),
});

/**
 * Auction creation validation
 * Matches types/auction.types.ts CreateAuctionRequest interface
 */
export const CreateAuctionSchema = z.object({
  item: AuctionItemSchema,
  startingBid: PositiveIntSchema.min(100, 'Starting bid must be at least 100'),
  buyoutPrice: PositiveIntSchema.optional(),
  reservePrice: PositiveIntSchema.optional(),
  duration: z.union([z.literal(12), z.literal(24), z.literal(48)]),
  clanOnly: z.boolean().optional(),
});

export type CreateAuctionRequest = z.infer<typeof CreateAuctionSchema>;

/**
 * Auction bid validation
 * Matches types/auction.types.ts PlaceBidRequest interface
 */
export const BidAuctionSchema = z.object({
  auctionId: z.string().min(1, 'Auction ID is required'),
  bidAmount: PositiveIntSchema.min(1, 'Bid amount must be at least 1'),
});

export type BidAuctionRequest = z.infer<typeof BidAuctionSchema>;

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

/**
 * VIP grant validation
 * Matches app/api/admin/vip/grant/route.ts API format
 */
export const GrantVIPSchema = z.object({
  username: UsernameSchema,
  days: PositiveIntSchema.min(1, 'Duration must be at least 1 day').max(365, 'Duration cannot exceed 1 year'),
});

export type GrantVIPRequest = z.infer<typeof GrantVIPSchema>;

/**
 * VIP revoke validation
 * Matches app/api/admin/vip/revoke/route.ts API format
 */
export const RevokeVIPSchema = z.object({
  username: UsernameSchema,
});

export type RevokeVIPRequest = z.infer<typeof RevokeVIPSchema>;

/**
 * Give resources validation
 * Matches app/api/admin/give-resources/route.ts API format
 * Metal and energy are optional and default to 0
 */
export const GiveResourcesSchema = z.object({
  username: UsernameSchema,
  metal: z.number().int().min(0, 'Metal amount must be non-negative').optional().default(0),
  energy: z.number().int().min(0, 'Energy amount must be non-negative').optional().default(0),
}).refine(
  (data) => data.metal > 0 || data.energy > 0,
  { message: 'At least one of metal or energy must be greater than 0' }
);

export type GiveResourcesRequest = z.infer<typeof GiveResourcesSchema>;

/**
 * System reset validation
 * Matches app/api/admin/system-reset/route.ts API format
 * Dangerous operations that permanently delete data
 */
export const SystemResetSchema = z.object({
  action: z.enum([
    'clear-battle-logs',
    'clear-activity-logs', 
    'reset-flags',
    'clear-sessions'
  ])
});

export type SystemResetRequest = z.infer<typeof SystemResetSchema>;

// ============================================================================
// RESEARCH & PROGRESSION SCHEMAS
// ============================================================================

/**
 * Technology research validation
 * Matches app/api/research/route.ts API format
 */
export const ResearchTechSchema = z.object({
  username: UsernameSchema,
  technologyId: z.string().min(1, 'Technology ID is required'),
});

export type ResearchTechRequest = z.infer<typeof ResearchTechSchema>;

/**
 * Tier unlock validation
 * Matches app/api/tier/unlock/route.ts API format
 * Tiers 2-5 can be unlocked (Tier 1 is default)
 */
export const UnlockTierSchema = z.object({
  tier: z.number().int().min(2, 'Minimum tier is 2').max(5, 'Maximum tier is 5'),
});

export type UnlockTierRequest = z.infer<typeof UnlockTierSchema>;

/**
 * Specialization choice validation
 * Matches app/api/specialization/choose/route.ts API format
 * Allows choosing from offensive, defensive, or tactical doctrines
 */
export const ChooseSpecializationSchema = z.object({
  doctrine: z.enum(['offensive', 'defensive', 'tactical'])
});

export type ChooseSpecializationRequest = z.infer<typeof ChooseSpecializationSchema>;

// ============================================================================
// SHRINE & BOOST SCHEMAS
// ============================================================================

/**
 * Shrine sacrifice validation
 * Matches app/api/shrine/sacrifice/route.ts API format
 * Allows activating boosts by sacrificing items
 */
export const ShrineSacrificeSchema = z.object({
  tier: z.enum(['speed', 'heart', 'diamond', 'club']),
  quantity: z.number().int().positive().optional(), // Optional for future use
});

export type ShrineSacrificeRequest = z.infer<typeof ShrineSacrificeSchema>;

// ============================================================================
// COMBAT SCHEMAS
// ============================================================================

/**
 * Infantry combat validation
 * Matches app/api/combat/infantry/route.ts API format
 */
export const InfantryCombatSchema = z.object({
  targetUsername: UsernameSchema,
  unitIds: z.array(z.string()).min(1, 'Must select at least one unit for attack'),
});

export type InfantryCombatRequest = z.infer<typeof InfantryCombatSchema>;

// ============================================================================
// FLAG BEARER SCHEMAS
// ============================================================================

/**
 * Flag attack validation
 * Matches app/api/flag/attack/route.ts API format
 */
export const FlagAttackSchema = z.object({
  targetPlayerId: z.string(), // Allow empty string for bot holders
  // Flag system uses world coordinates (1-150) while other subsystems may use
  // 0-based coordinates. Use MapCoordinateSchema here to accept the 1-based
  // world positions produced by the client UI.
  attackerPosition: z.object({
    x: MapCoordinateSchema,
    y: MapCoordinateSchema,
  }),
});

export type FlagAttackRequest = z.infer<typeof FlagAttackSchema>;

// ============================================================================
// FAST TRAVEL SCHEMAS
// ============================================================================

/**
 * Fast travel waypoint set validation
 */
export const SetWaypointSchema = z.object({
  action: z.literal('set'),
  name: z.string().min(1, 'Waypoint name must be at least 1 character').max(20, 'Waypoint name must be at most 20 characters'),
  x: CoordinateSchema,
  y: CoordinateSchema,
});

export type SetWaypointRequest = z.infer<typeof SetWaypointSchema>;

/**
 * Fast travel to waypoint validation
 */
export const TravelToWaypointSchema = z.object({
  action: z.literal('travel'),
  name: z.string().min(1, 'Waypoint name is required'),
});

export type TravelToWaypointRequest = z.infer<typeof TravelToWaypointSchema>;

/**
 * Fast travel request validation (union of set and travel)
 */
export const FastTravelSchema = z.discriminatedUnion('action', [
  SetWaypointSchema,
  TravelToWaypointSchema,
]);

export type FastTravelRequest = z.infer<typeof FastTravelSchema>;

// ============================================================================
// WMD & MISSILE OPERATIONS
// ============================================================================

/**
 * Create missile request validation
 */
export const CreateMissileSchema = z.object({
  action: z.literal('create'),
  warheadType: z.enum(['TACTICAL', 'STRATEGIC', 'NEUTRON', 'CLUSTER', 'CLAN_BUSTER'], {
    message: 'Invalid warhead type',
  }),
});

export type CreateMissileRequest = z.infer<typeof CreateMissileSchema>;

/**
 * Assemble missile component request validation
 */
export const AssembleMissileSchema = z.object({
  action: z.literal('assemble'),
  missileId: z.string().min(1, 'Missile ID is required'),
  component: z.enum(['WARHEAD', 'PROPULSION', 'GUIDANCE', 'PAYLOAD', 'STEALTH'], {
    message: 'Invalid component type',
  }),
});

export type AssembleMissileRequest = z.infer<typeof AssembleMissileSchema>;

/**
 * Launch missile request validation
 */
export const LaunchMissileSchema = z.object({
  action: z.literal('launch'),
  missileId: z.string().min(1, 'Missile ID is required'),
  targetId: z.string().min(1, 'Target player ID is required'),
});

export type LaunchMissileRequest = z.infer<typeof LaunchMissileSchema>;

/**
 * Missile operations request validation (union of create, assemble, launch)
 */
export const MissileOperationSchema = z.discriminatedUnion('action', [
  CreateMissileSchema,
  AssembleMissileSchema,
  LaunchMissileSchema,
]);

export type MissileOperationRequest = z.infer<typeof MissileOperationSchema>;

// ============================================================================
// WMD DEFENSE OPERATIONS (Not yet needed - route needs creation)
// ============================================================================

// ============================================================================
// WMD VOTING SCHEMAS
// ============================================================================

/**
 * Clan vote creation validation
 * Matches app/api/wmd/voting/route.ts API format (POST action=create)
 */
export const CreateVoteSchema = z.object({
  action: z.literal('create'),
  voteType: z.string().min(1, 'Vote type is required'),
  targetId: z.string().optional(),
  targetUsername: z.string().optional(),
  warheadType: z.string().optional(),
  resourceAmount: z.number().optional(),
});

export type CreateVoteRequest = z.infer<typeof CreateVoteSchema>;

/**
 * Cast vote validation
 * Matches app/api/wmd/voting/route.ts API format (POST action=cast)
 */
export const CastVoteSchema = z.object({
  action: z.literal('cast'),
  voteId: z.string().min(1, 'Vote ID is required'),
  vote: z.boolean(),
});

export type CastVoteRequest = z.infer<typeof CastVoteSchema>;

/**
 * Veto vote validation
 * Matches app/api/wmd/voting/route.ts API format (POST action=veto)
 */
export const VetoVoteSchema = z.object({
  action: z.literal('veto'),
  voteId: z.string().min(1, 'Vote ID is required'),
  reason: z.string().optional(),
});

export type VetoVoteRequest = z.infer<typeof VetoVoteSchema>;

/**
 * WMD voting operations (union of create, cast, veto)
 */
export const WMDVotingSchema = z.discriminatedUnion('action', [
  CreateVoteSchema,
  CastVoteSchema,
  VetoVoteSchema,
]);

export type WMDVotingRequest = z.infer<typeof WMDVotingSchema>;

// ============================================================================
// WMD INTELLIGENCE SCHEMAS
// ============================================================================

/**
 * Recruit spy validation
 * Matches app/api/wmd/intelligence/route.ts API format (POST action=recruit)
 */
export const RecruitSpySchema = z.object({
  action: z.literal('recruit'),
  specialization: z.string().min(1, 'Specialization is required'),
});

export type RecruitSpyRequest = z.infer<typeof RecruitSpySchema>;

/**
 * Start spy mission validation
 * Matches app/api/wmd/intelligence/route.ts API format (POST action=mission)
 */
export const StartMissionSchema = z.object({
  action: z.literal('mission'),
  spyId: z.string().min(1, 'Spy ID is required'),
  missionType: z.string().min(1, 'Mission type is required'),
  targetId: z.string().min(1, 'Target ID is required'),
});

export type StartMissionRequest = z.infer<typeof StartMissionSchema>;

/**
 * Execute sabotage validation
 * Matches app/api/wmd/intelligence/route.ts API format (POST action=sabotage)
 */
export const ExecuteSabotageSchema = z.object({
  action: z.literal('sabotage'),
  spyId: z.string().min(1, 'Spy ID is required'),
  targetId: z.string().min(1, 'Target ID is required'),
  targetType: z.string().min(1, 'Target type is required'),
});

export type ExecuteSabotageRequest = z.infer<typeof ExecuteSabotageSchema>;

/**
 * Counter-intelligence validation
 * Matches app/api/wmd/intelligence/route.ts API format (POST action=counterIntel)
 */
export const CounterIntelSchema = z.object({
  action: z.literal('counterIntel'),
});

export type CounterIntelRequest = z.infer<typeof CounterIntelSchema>;

/**
 * Train spy validation
 * Matches app/api/wmd/intelligence/route.ts API format (PATCH action=train)
 */
export const TrainSpySchema = z.object({
  action: z.literal('train'),
  spyId: z.string().min(1, 'Spy ID is required'),
  skillType: z.string().min(1, 'Skill type is required'),
  trainingIntensity: z.enum(['BASIC', 'ADVANCED', 'ELITE']).optional().default('BASIC'),
});

export type TrainSpyRequest = z.infer<typeof TrainSpySchema>;

/**
 * Complete mission validation
 * Matches app/api/wmd/intelligence/route.ts API format (PATCH action=complete)
 */
export const CompleteMissionSchema = z.object({
  action: z.literal('complete'),
  missionId: z.string().min(1, 'Mission ID is required'),
});

export type CompleteMissionRequest = z.infer<typeof CompleteMissionSchema>;

// ============================================================================
// SPECIALIZATION MASTERY SCHEMAS
// ============================================================================

/**
 * Switch specialization validation
 * Matches app/api/specialization/switch/route.ts API format (POST)
 */
export const SwitchSpecializationSchema = z.object({
  newDoctrine: z.enum(['offensive', 'defensive', 'tactical']),
});

export type SwitchSpecializationRequest = z.infer<typeof SwitchSpecializationSchema>;

/**
 * Award mastery XP validation
 * Matches app/api/specialization/mastery/route.ts API format (POST)
 */
export const AwardMasteryXPSchema = z.object({
  xpAmount: PositiveIntSchema.min(1, 'XP amount must be at least 1'),
  reason: z.string().min(1, 'Reason for XP gain is required'),
});

export type AwardMasteryXPRequest = z.infer<typeof AwardMasteryXPSchema>;

// ============================================================================
// AUCTION ADVANCED SCHEMAS
// ============================================================================

/**
 * Auction buyout validation
 * Matches app/api/auction/buyout/route.ts API format
 */
export const AuctionBuyoutSchema = z.object({
  auctionId: z.string().min(1, 'Auction ID is required'),
});

export type AuctionBuyoutRequest = z.infer<typeof AuctionBuyoutSchema>;

/**
 * Auction cancel validation
 * Matches app/api/auction/cancel/route.ts API format
 */
export const AuctionCancelSchema = z.object({
  auctionId: z.string().min(1, 'Auction ID is required'),
});

export type AuctionCancelRequest = z.infer<typeof AuctionCancelSchema>;

// ============================================================================
// CLAN WARFARE SCHEMAS
// ============================================================================

/**
 * Declare war validation
 * Matches app/api/clan/warfare/declare/route.ts API format
 */
export const DeclareWarSchema = z.object({
  targetClanId: z.string().min(1, 'Target clan ID is required'),
});

export type DeclareWarRequest = z.infer<typeof DeclareWarSchema>;

// ============================================================================
// CLAN ALLIANCE SCHEMAS
// ============================================================================

/**
 * Propose alliance validation
 * Matches app/api/clan/alliance/route.ts API format (POST)
 */
export const ProposeAllianceSchema = z.object({
  targetClanId: z.string().min(1, 'Target clan ID is required'),
  allianceType: z.enum(['NAP', 'TRADE', 'MILITARY', 'FEDERATION']),
});

export type ProposeAllianceRequest = z.infer<typeof ProposeAllianceSchema>;

/**
 * Accept alliance validation
 * Matches app/api/clan/alliance/route.ts API format (PUT)
 */
export const AcceptAllianceSchema = z.object({
  allianceId: z.string().min(1, 'Alliance ID is required'),
});

export type AcceptAllianceRequest = z.infer<typeof AcceptAllianceSchema>;

/**
 * Break alliance validation
 * Matches app/api/clan/alliance/route.ts API format (DELETE)
 */
export const BreakAllianceSchema = z.object({
  allianceId: z.string().min(1, 'Alliance ID is required'),
});

export type BreakAllianceRequest = z.infer<typeof BreakAllianceSchema>;

// ============================================================================
// BEER BASE SCHEMAS
// ============================================================================

/**
 * Beer Base config update validation
 * Matches app/api/beer-bases/route.ts API format (PUT)
 */
export const BeerBaseConfigSchema = z.object({
  spawnRateMin: z.number().int().min(0).max(100).optional(),
  spawnRateMax: z.number().int().min(0).max(100).optional(),
  resourceMultiplier: z.number().min(1).max(10).optional(),
  respawnDay: z.number().int().min(0).max(6).optional(),
  respawnHour: z.number().int().min(0).max(23).optional(),
  enabled: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one configuration field must be provided' }
);

export type BeerBaseConfigRequest = z.infer<typeof BeerBaseConfigSchema>;

// ============================================================================
// BOUNTY BOARD SCHEMAS
// ============================================================================

/**
 * Claim bounty reward validation
 * Matches app/api/bounty-board/route.ts API format (POST)
 */
export const ClaimBountySchema = z.object({
  bountyId: z.string().min(1, 'Bounty ID is required'),
});

export type ClaimBountyRequest = z.infer<typeof ClaimBountySchema>;

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

/**
 * Admin ban player validation
 * Matches app/api/admin/ban-player/route.ts API format (POST)
 */
export const BanPlayerSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  reason: z.string().min(10, 'Ban reason must be at least 10 characters'),
  durationDays: z.number().int().positive().optional(),
  autoResolveFlags: z.boolean().optional(),
});

export type BanPlayerRequest = z.infer<typeof BanPlayerSchema>;

/**
 * Admin clear flags validation
 * Matches app/api/admin/anti-cheat/clear-flags/route.ts API format (POST)
 */
export const ClearFlagsSchema = z.object({
  username: z.string().min(1, 'Username is required'),
});

export type ClearFlagsRequest = z.infer<typeof ClearFlagsSchema>;

/**
 * Admin clear single flag validation
 * Matches app/api/admin/clear-flag/route.ts API format (POST)
 */
export const ClearFlagSchema = z.object({
  flagId: z.string().min(1, 'Flag ID is required'),
  adminNotes: z.string().min(10, 'Admin notes required (min 10 characters)'),
});

export type ClearFlagRequest = z.infer<typeof ClearFlagSchema>;

/**
 * Admin bot config patch validation
 * Matches app/api/admin/bot-config/route.ts API format (PATCH)
 */
export const BotConfigPatchSchema = z.object({
  username: z.string().min(1, 'Bot username is required'),
  updates: z.object({
    specialization: z.enum(['Hoarder', 'Fortress', 'Raider', 'Balanced', 'Ghost']).optional(),
    tier: z.number().int().min(1).max(6).optional(),
    position: z.object({
      x: z.number().min(0).max(5000),
      y: z.number().min(0).max(5000),
    }).optional(),
    resources: z.object({
      metal: z.number().nonnegative().optional(),
      energy: z.number().nonnegative().optional(),
    }).optional(),
    isSpecialBase: z.boolean().optional(),
  }),
});

export type BotConfigPatchRequest = z.infer<typeof BotConfigPatchSchema>;

/**
 * Admin bot regen validation
 * Matches app/api/admin/bot-regen/route.ts API format (POST)
 */
export const BotRegenSchema = z.object({
  username: z.string().optional(), // Optional - if omitted, regenerates all bots
});

export type BotRegenRequest = z.infer<typeof BotRegenSchema>;

/**
 * Admin bot spawn validation
 * Matches app/api/admin/bot-spawn/route.ts API format (POST)
 */
export const BotSpawnSchema = z.object({
  specialization: z.enum(['Hoarder', 'Fortress', 'Raider', 'Balanced', 'Ghost']),
  tier: z.number().int().min(1).max(6),
  position: z.object({
    x: z.number().min(0).max(5000),
    y: z.number().min(0).max(5000),
  }).optional(),
  isSpecialBase: z.boolean().optional(),
  count: z.number().int().min(1).max(10).optional(),
});

export type BotSpawnRequest = z.infer<typeof BotSpawnSchema>;

/**
 * Admin hotkey update validation
 * Matches app/api/admin/hotkeys/route.ts API format (PUT)
 */
export const HotkeyUpdateSchema = z.object({
  hotkeys: z.array(
    z.object({
      action: z.string().min(1),
      key: z.string().min(1),
      displayName: z.string().min(1),
      category: z.string().min(1),
    })
  ).min(1, 'Hotkeys array cannot be empty'),
});

export type HotkeyUpdateRequest = z.infer<typeof HotkeyUpdateSchema>;

/**
 * Admin RP bulk adjust validation
 * Matches app/api/admin/rp-economy/bulk-adjust/route.ts API format (POST)
 */
export const RPBulkAdjustSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  amount: z.number().int().refine(val => val !== 0, 'Amount cannot be zero'),
  reason: z.string().min(1, 'Reason is required'),
  adminUsername: z.string().optional(),
});

export type RPBulkAdjustRequest = z.infer<typeof RPBulkAdjustSchema>;

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Validates request body against schema and returns typed data
 * Throws ZodError with detailed validation errors if invalid
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and typed data
 * @throws ZodError if validation fails
 */
export function validateRequest<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Safe validation that returns success/error result
 * Does not throw, use for optional validation or user-friendly errors
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Success result with data or error result with issues
 */
export function safeValidateRequest<T extends z.ZodType>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error.issues };
}

/**
 * FOOTER:
 * This validation system provides type-safe runtime validation for all API
 * routes. Schemas are reusable and composable. All validation errors are
 * user-friendly and provide specific guidance on what went wrong.
 * 
 * To add new schemas:
 * 1. Create schema using z.object() with appropriate field validators
 * 2. Export TypeScript type using z.infer<>
 * 3. Use in API routes with validateRequest() or safeValidateRequest()
 * 
 * Performance: Zod validation is fast (<1ms for typical requests)
 * Security: Prevents injection attacks, malformed data, type confusion
 */
