/**
 * Clan Alliance Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages alliances between clans, enabling cooperation through contracts.
 * Supports 4 alliance types with different costs, benefits, and contract options.
 * Enables joint warfare capabilities for allied clans.
 * 
 * Alliance Types:
 * 1. NAP (Non-Aggression Pact) - Free, prevents war declarations
 * 2. Trade Alliance - 10K M/E, enables resource trading at reduced fees
 * 3. Military Alliance - 50K M/E, enables joint warfare and defense pacts
 * 4. Federation - 200K M/E, full integration with shared research and resources
 * 
 * Contract Types:
 * - Resource Sharing: Auto-share percentage of passive income
 * - Defense Pact: Auto-join defensive wars
 * - War Support: Provide troops/resources during wars
 * - Joint Research: Share research point contributions
 * 
 * Features:
 * - Alliance creation with mutual acceptance
 * - Contract management per alliance type
 * - Joint warfare participation (2v1, 2v2)
 * - Alliance breaking with cooldowns
 * - Contract enforcement automation
 * 
 * @module lib/clanAllianceService
 */

import { db } from '@/lib/db';
import { clans, players } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';


export enum AllianceType {
  NAP = 'NAP',
  TRADE = 'TRADE',
  MILITARY = 'MILITARY',
  FEDERATION = 'FEDERATION',
}

export enum AllianceStatus {
  PROPOSED = 'PROPOSED',
  ACTIVE = 'ACTIVE',
  BROKEN = 'BROKEN',
  EXPIRED = 'EXPIRED',
}

export enum ContractType {
  RESOURCE_SHARING = 'RESOURCE_SHARING',
  DEFENSE_PACT = 'DEFENSE_PACT',
  WAR_SUPPORT = 'WAR_SUPPORT',
  JOINT_RESEARCH = 'JOINT_RESEARCH',
}

export interface AllianceContract {
  type: ContractType;
  terms: {
    resourceSharePercentage?: number;
    autoJoinDefense?: boolean;
    supportAmount?: {
      metal: number;
      energy: number;
    };
    researchSharePercentage?: number;
  };
  createdAt: Date;
  createdBy: string;
}

export interface Alliance {
  _id?: string;
  clanIds: [string, string];
  type: AllianceType;
  status: AllianceStatus;
  proposedBy: string;
  proposedAt: Date;
  acceptedAt?: Date;
  contracts: AllianceContract[];
  cost: {
    metal: number;
    energy: number;
  };
  brokenAt?: Date;
  brokenBy?: string;
  cooldownUntil?: Date;
  metadata: {
    createdBy: string;
    createdByUsername: string;
  };
}

export const ALLIANCE_COSTS = {
  [AllianceType.NAP]: { metal: 0, energy: 0 },
  [AllianceType.TRADE]: { metal: 10000, energy: 10000 },
  [AllianceType.MILITARY]: { metal: 50000, energy: 50000 },
  [AllianceType.FEDERATION]: { metal: 200000, energy: 200000 },
};

export const ALLIANCE_BREAK_COOLDOWN_HOURS = 72;

export const CONTRACT_LIMITS: Record<AllianceType, ContractType[]> = {
  [AllianceType.NAP]: [],
  [AllianceType.TRADE]: [ContractType.RESOURCE_SHARING],
  [AllianceType.MILITARY]: [
    ContractType.RESOURCE_SHARING,
    ContractType.DEFENSE_PACT,
    ContractType.WAR_SUPPORT,
  ],
  [AllianceType.FEDERATION]: [
    ContractType.RESOURCE_SHARING,
    ContractType.DEFENSE_PACT,
    ContractType.WAR_SUPPORT,
    ContractType.JOINT_RESEARCH,
  ],
};

// Typed accessors for pg rows (jsonb columns arrive already-parsed; tolerate string forms)
function asString(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '');
}
function asDate(v: unknown): Date {
  return new Date(v as string | number | Date);
}
function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

function rowToAlliance(row: Record<string, unknown>): Alliance {
  return {
    _id: String(row.id),
    clanIds: asJson<[string, string]>(row.clan_ids, ['', '']),
    type: asString(row.type) as AllianceType,
    status: asString(row.status) as AllianceStatus,
    proposedBy: asString(row.proposed_by),
    proposedAt: asDate(row.proposed_at),
    acceptedAt: row.accepted_at != null ? asDate(row.accepted_at) : undefined,
    contracts: asJson<AllianceContract[]>(row.contracts, []),
    cost: asJson<Alliance['cost']>(row.cost, { metal: 0, energy: 0 }),
    brokenAt: row.broken_at != null ? asDate(row.broken_at) : undefined,
    brokenBy: row.broken_by != null ? asString(row.broken_by) : undefined,
    cooldownUntil: row.cooldown_until != null ? asDate(row.cooldown_until) : undefined,
    metadata: asJson<Alliance['metadata']>(row.metadata, { createdBy: '', createdByUsername: '' }),
  };
}

export async function proposeAlliance(
  proposingClanId: string,
  targetClanId: string,
  allianceType: AllianceType,
  proposedBy: string
): Promise<Alliance> {
  if (proposingClanId === targetClanId) {
    throw new Error('Cannot create alliance with own clan');
  }
  
  const proposingClanRows = await db.select().from(clans).where(eq(clans.id, proposingClanId)).limit(1);
  const targetClanRows = await db.select().from(clans).where(eq(clans.id, targetClanId)).limit(1);
  
  if (proposingClanRows.length === 0 || targetClanRows.length === 0) {
    throw new Error('One or both clans not found');
  }
  
  const proposingClan = proposingClanRows[0];
  const targetClan = targetClanRows[0];
  
  const proposerMember = proposingClan.members.find((m: any) => m.playerId === proposedBy);
  if (!proposerMember || (proposerMember.role !== 'LEADER' && proposerMember.role !== 'CO_LEADER')) {
    throw new Error('Only Leaders or Co-Leaders can propose alliances');
  }
  
  // pg: jsonb-array containment probe must be array-shaped (["id"], not "id"),
  // and drizzle results carry .rows (mysql2-style array indexing is invalid)
  const existingRows = await db.execute(sql`
    SELECT * FROM clan_alliances
    WHERE clan_ids @> ${JSON.stringify([proposingClanId])}::jsonb
      AND clan_ids @> ${JSON.stringify([targetClanId])}::jsonb
      AND status IN (${AllianceStatus.PROPOSED}, ${AllianceStatus.ACTIVE})
    LIMIT 1
  `);
  
  if (existingRows.rows.length > 0) {
    throw new Error('Alliance already exists or is pending');
  }
  
  const brokenRows = await db.execute(sql`
    SELECT * FROM clan_alliances
    WHERE clan_ids @> ${JSON.stringify([proposingClanId])}::jsonb
      AND clan_ids @> ${JSON.stringify([targetClanId])}::jsonb
      AND status = ${AllianceStatus.BROKEN}
      AND cooldown_until > NOW()
    LIMIT 1
  `);
  
  if (brokenRows.rows.length > 0) {
    const brokenRow = brokenRows.rows[0] as Record<string, unknown>;
    const hoursRemaining = Math.ceil((asDate(brokenRow.cooldown_until).getTime() - Date.now()) / 3600000);
    throw new Error(`Alliance cooldown active. ${hoursRemaining} hours remaining.`);
  }
  
  const cost = ALLIANCE_COSTS[allianceType];
  const proposingTreasury = {
    metal: Number(proposingClan.bankTreasuryMetal),
    energy: Number(proposingClan.bankTreasuryEnergy),
    researchPoints: proposingClan.bankTreasuryResearchPoints,
  };
  
  if (proposingTreasury.metal < cost.metal || proposingTreasury.energy < cost.energy) {
    throw new Error(`Insufficient funds. Need ${cost.metal} metal, ${cost.energy} energy`);
  }
  
  if (cost.metal > 0 || cost.energy > 0) {
    await db.update(clans).set({
      bankTreasuryMetal: sql`${clans.bankTreasuryMetal} - ${cost.metal}`,
      bankTreasuryEnergy: sql`${clans.bankTreasuryEnergy} - ${cost.energy}`,
    }).where(eq(clans.id, proposingClanId));
  }
  
  const proposerRows = await db.select().from(players).where(eq(players.username, proposedBy)).limit(1);
  const proposer = proposerRows[0];
  
  const alliance: Omit<Alliance, '_id'> = {
    clanIds: [proposingClanId, targetClanId],
    type: allianceType,
    status: AllianceStatus.PROPOSED,
    proposedBy: proposingClanId,
    proposedAt: new Date(),
    contracts: [],
    cost,
    metadata: {
      createdBy: proposedBy,
      createdByUsername: proposer?.username || 'Unknown',
    },
  };
  
  // pg: RETURNING id replaces the MySQL insertId
  const result = await db.execute(sql`
    INSERT INTO clan_alliances
    (clan_ids, type, status, proposed_by, proposed_at, contracts, cost, metadata)
    VALUES (${JSON.stringify(alliance.clanIds)}, ${alliance.type}, ${alliance.status},
            ${alliance.proposedBy}, ${alliance.proposedAt}, ${JSON.stringify(alliance.contracts)},
            ${JSON.stringify(alliance.cost)}, ${JSON.stringify(alliance.metadata)})
    RETURNING id
  `);
  const insertedId = (result.rows[0] as { id: number | string } | undefined)?.id;
  const createdAlliance = { ...alliance, _id: insertedId?.toString() } as Alliance;
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${proposingClanId}, 'ALLIANCE_PROPOSED', ${new Date()},
            ${JSON.stringify({
              allianceType,
              targetClanId,
              targetClanName: targetClan.name,
              cost,
              proposedBy: proposer?.username,
            })})
  `);
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${targetClanId}, 'ALLIANCE_RECEIVED', ${new Date()},
            ${JSON.stringify({
              allianceType,
              proposingClanId,
              proposingClanName: proposingClan.name,
              cost,
            })})
  `);
  
  return createdAlliance;
}

export async function acceptAlliance(
  allianceId: string,
  acceptingClanId: string,
  acceptedBy: string
): Promise<Alliance> {
  const allianceRows = await db.execute(sql`SELECT * FROM clan_alliances WHERE id = ${allianceId} LIMIT 1`);
  if (allianceRows.rows.length === 0) {
    throw new Error('Alliance not found');
  }
  
  const alliance = rowToAlliance(allianceRows.rows[0]);
  
  if (alliance.status !== AllianceStatus.PROPOSED) {
    throw new Error('Alliance is not in proposed state');
  }
  
  const targetClanId = alliance.clanIds.find((id) => id !== alliance.proposedBy);
  if (acceptingClanId !== targetClanId) {
    throw new Error('Only the target clan can accept this alliance');
  }
  
  const acceptingClanRows = await db.select().from(clans).where(eq(clans.id, acceptingClanId)).limit(1);
  if (acceptingClanRows.length === 0) {
    throw new Error('Accepting clan not found');
  }
  
  const acceptingClan = acceptingClanRows[0];
  const accepterMember = acceptingClan.members.find((m: any) => m.playerId === acceptedBy);
  if (!accepterMember || (accepterMember.role !== 'LEADER' && accepterMember.role !== 'CO_LEADER')) {
    throw new Error('Only Leaders or Co-Leaders can accept alliances');
  }
  
  const cost = alliance.cost;
  const acceptingTreasury = {
    metal: Number(acceptingClan.bankTreasuryMetal),
    energy: Number(acceptingClan.bankTreasuryEnergy),
    researchPoints: acceptingClan.bankTreasuryResearchPoints,
  };
  
  if (acceptingTreasury.metal < cost.metal || acceptingTreasury.energy < cost.energy) {
    throw new Error(`Insufficient funds. Need ${cost.metal} metal, ${cost.energy} energy`);
  }
  
  if (cost.metal > 0 || cost.energy > 0) {
    await db.update(clans).set({
      bankTreasuryMetal: sql`${clans.bankTreasuryMetal} - ${cost.metal}`,
      bankTreasuryEnergy: sql`${clans.bankTreasuryEnergy} - ${cost.energy}`,
    }).where(eq(clans.id, acceptingClanId));
  }
  
  await db.execute(sql`
    UPDATE clan_alliances
    SET status = ${AllianceStatus.ACTIVE}, accepted_at = ${new Date()}
    WHERE id = ${allianceId}
  `);
  
  const accepterRows = await db.select().from(players).where(eq(players.username, acceptedBy)).limit(1);
  const accepter = accepterRows[0];
  
  const proposingClanRows = await db.select().from(clans).where(eq(clans.id, alliance.proposedBy)).limit(1);
  const proposingClan = proposingClanRows[0];
  
  const acceptingClanFullRows = await db.select().from(clans).where(eq(clans.id, acceptingClanId)).limit(1);
  const acceptingClanFull = acceptingClanFullRows[0];
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${acceptingClanId}, 'ALLIANCE_ACCEPTED', ${new Date()},
            ${JSON.stringify({
              allianceType: alliance.type,
              allyClanId: alliance.proposedBy,
              allyClanName: proposingClan?.name,
              acceptedBy: accepter?.username,
            })})
  `);
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${alliance.proposedBy}, 'ALLIANCE_FORMED', ${new Date()},
            ${JSON.stringify({
              allianceType: alliance.type,
              allyClanId: acceptingClanId,
              allyClanName: acceptingClanFull.name,
            })})
  `);
  
  const updatedRows = await db.execute(sql`SELECT * FROM clan_alliances WHERE id = ${allianceId} LIMIT 1`);
  return rowToAlliance(updatedRows.rows[0]);
}

export async function breakAlliance(
  allianceId: string,
  breakingClanId: string,
  brokenBy: string
): Promise<Alliance> {
  const allianceRows = await db.execute(sql`SELECT * FROM clan_alliances WHERE id = ${allianceId} LIMIT 1`);
  if (allianceRows.rows.length === 0) {
    throw new Error('Alliance not found');
  }
  
  const alliance = rowToAlliance(allianceRows.rows[0]);
  
  if (alliance.status !== AllianceStatus.ACTIVE) {
    throw new Error('Alliance is not active');
  }
  
  if (!alliance.clanIds.includes(breakingClanId)) {
    throw new Error('Clan is not part of this alliance');
  }
  
  const breakingClanRows = await db.select().from(clans).where(eq(clans.id, breakingClanId)).limit(1);
  if (breakingClanRows.length === 0) {
    throw new Error('Breaking clan not found');
  }
  
  const breakingClan = breakingClanRows[0];
  const breakerMember = breakingClan.members.find((m: any) => m.playerId === brokenBy);
  if (!breakerMember || breakerMember.role !== 'LEADER') {
    throw new Error('Only clan leaders can break alliances');
  }
  
  const cooldownUntil = new Date();
  cooldownUntil.setHours(cooldownUntil.getHours() + ALLIANCE_BREAK_COOLDOWN_HOURS);
  
  await db.execute(sql`
    UPDATE clan_alliances
    SET status = ${AllianceStatus.BROKEN}, broken_at = ${new Date()},
        broken_by = ${breakingClanId}, cooldown_until = ${cooldownUntil}
    WHERE id = ${allianceId}
  `);
  
  const breakerRows = await db.select().from(players).where(eq(players.username, brokenBy)).limit(1);
  const breaker = breakerRows[0];
  
  const otherClanId = alliance.clanIds.find((id) => id !== breakingClanId)!;
  const otherClanRows = await db.select().from(clans).where(eq(clans.id, otherClanId)).limit(1);
  const otherClan = otherClanRows[0];
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${breakingClanId}, 'ALLIANCE_BROKEN', ${new Date()},
            ${JSON.stringify({
              allianceType: alliance.type,
              formerAllyClanId: otherClanId,
              formerAllyClanName: otherClan?.name,
              brokenBy: breaker?.username,
              cooldownHours: ALLIANCE_BREAK_COOLDOWN_HOURS,
            })})
  `);
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${otherClanId}, 'ALLIANCE_BROKEN', ${new Date()},
            ${JSON.stringify({
              allianceType: alliance.type,
              formerAllyClanId: breakingClanId,
              formerAllyClanName: breakingClan.name,
              brokenBy: breakingClan.name,
            })})
  `);
  
  const updatedRows = await db.execute(sql`SELECT * FROM clan_alliances WHERE id = ${allianceId} LIMIT 1`);
  return rowToAlliance(updatedRows.rows[0]);
}

export async function addContract(
  allianceId: string,
  clanId: string,
  playerId: string,
  contractType: ContractType,
  terms: AllianceContract['terms']
): Promise<Alliance> {
  const allianceRows = await db.execute(sql`SELECT * FROM clan_alliances WHERE id = ${allianceId} LIMIT 1`);
  if (allianceRows.rows.length === 0) {
    throw new Error('Alliance not found');
  }
  
  const alliance = rowToAlliance(allianceRows.rows[0]);
  
  if (alliance.status !== AllianceStatus.ACTIVE) {
    throw new Error('Alliance must be active to add contracts');
  }
  
  if (!alliance.clanIds.includes(clanId)) {
    throw new Error('Clan is not part of this alliance');
  }
  
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }
  
  const clan = clanRows[0];
  const member = clan.members.find((m: any) => m.playerId === playerId);
  if (!member || member.role !== 'LEADER') {
    throw new Error('Only clan leaders can add contracts');
  }
  
  const allowedContracts = CONTRACT_LIMITS[alliance.type];
  if (!allowedContracts.includes(contractType)) {
    throw new Error(`Contract type ${contractType} not allowed for ${alliance.type} alliance`);
  }
  
  const existingContract = alliance.contracts.find((c) => c.type === contractType);
  if (existingContract) {
    throw new Error(`Contract ${contractType} already exists for this alliance`);
  }
  
  validateContractTerms(contractType, terms);
  
  const contract: AllianceContract = {
    type: contractType,
    terms,
    createdAt: new Date(),
    createdBy: clanId,
  };
  
  const updatedContracts = [...alliance.contracts, contract];
  
  await db.execute(sql`
    UPDATE clan_alliances
    SET contracts = ${JSON.stringify(updatedContracts)}
    WHERE id = ${allianceId}
  `);
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${clanId}, 'CONTRACT_ADDED', ${new Date()},
            ${JSON.stringify({
              allianceId,
              contractType,
              terms,
            })})
  `);
  
  const updatedRows = await db.execute(sql`SELECT * FROM clan_alliances WHERE id = ${allianceId} LIMIT 1`);
  return rowToAlliance(updatedRows.rows[0]);
}

export async function removeContract(
  allianceId: string,
  clanId: string,
  playerId: string,
  contractType: ContractType
): Promise<Alliance> {
  const allianceRows = await db.execute(sql`SELECT * FROM clan_alliances WHERE id = ${allianceId} LIMIT 1`);
  if (allianceRows.rows.length === 0) {
    throw new Error('Alliance not found');
  }
  
  const alliance = rowToAlliance(allianceRows.rows[0]);
  
  if (!alliance.clanIds.includes(clanId)) {
    throw new Error('Clan is not part of this alliance');
  }
  
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }
  
  const clan = clanRows[0];
  const member = clan.members.find((m: any) => m.playerId === playerId);
  if (!member || member.role !== 'LEADER') {
    throw new Error('Only clan leaders can remove contracts');
  }
  
  const updatedContracts = alliance.contracts.filter((c) => c.type !== contractType);
  
  await db.execute(sql`
    UPDATE clan_alliances
    SET contracts = ${JSON.stringify(updatedContracts)}
    WHERE id = ${allianceId}
  `);
  
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, timestamp, details)
    VALUES (${clanId}, 'CONTRACT_REMOVED', ${new Date()},
            ${JSON.stringify({
              allianceId,
              contractType,
            })})
  `);
  
  const updatedRows = await db.execute(sql`SELECT * FROM clan_alliances WHERE id = ${allianceId} LIMIT 1`);
  return rowToAlliance(updatedRows.rows[0]);
}

function validateContractTerms(contractType: ContractType, terms: AllianceContract['terms']): void {
  switch (contractType) {
    case ContractType.RESOURCE_SHARING:
      if (!terms.resourceSharePercentage || terms.resourceSharePercentage < 1 || terms.resourceSharePercentage > 50) {
        throw new Error('Resource share percentage must be between 1-50%');
      }
      break;
    case ContractType.DEFENSE_PACT:
      if (terms.autoJoinDefense === undefined) {
        throw new Error('autoJoinDefense must be specified for defense pact');
      }
      break;
    case ContractType.WAR_SUPPORT:
      if (!terms.supportAmount || terms.supportAmount.metal < 0 || terms.supportAmount.energy < 0) {
        throw new Error('Valid support amounts required for war support');
      }
      break;
    case ContractType.JOINT_RESEARCH:
      if (!terms.researchSharePercentage || terms.researchSharePercentage < 1 || terms.researchSharePercentage > 30) {
        throw new Error('Research share percentage must be between 1-30%');
      }
      break;
  }
}

export async function getAlliancesForClan(
  clanId: string,
  includeInactive = false
): Promise<Alliance[]> {
  let query = sql`SELECT * FROM clan_alliances WHERE clan_ids @> ${JSON.stringify([clanId])}::jsonb`;
  
  if (!includeInactive) {
    query = sql`SELECT * FROM clan_alliances WHERE clan_ids @> ${JSON.stringify([clanId])}::jsonb AND status IN (${AllianceStatus.PROPOSED}, ${AllianceStatus.ACTIVE})`;
  }
  
  query = sql`${query} ORDER BY proposed_at DESC`;
  
  const result = await db.execute(query);
  return result.rows.map((r) => rowToAlliance(r as Record<string, unknown>));
}

export async function getAllianceBetweenClans(
  clanId1: string,
  clanId2: string
): Promise<Alliance | null> {
  const result = await db.execute(sql`
    SELECT * FROM clan_alliances
    WHERE clan_ids @> ${JSON.stringify([clanId1])}::jsonb
      AND clan_ids @> ${JSON.stringify([clanId2])}::jsonb
      AND status = ${AllianceStatus.ACTIVE}
    LIMIT 1
  `);
  
  if (result.rows.length === 0) return null;
  return rowToAlliance(result.rows[0]);
}

export async function areAllies(clanId1: string, clanId2: string): Promise<boolean> {
  const alliance = await getAllianceBetweenClans(clanId1, clanId2);
  return alliance !== null;
}

export async function getAllyIds(clanId: string): Promise<string[]> {
  const alliances = await getAlliancesForClan(clanId, false);
  const allyIds = alliances
    .filter((a) => a.status === AllianceStatus.ACTIVE)
    .map((a) => a.clanIds.find((id) => id !== clanId)!)
    .filter(Boolean);
  
  return allyIds;
}
