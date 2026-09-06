import { db } from '@/lib/db';
import { clans, players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface ResearchNode {
  id: string;
  name: string;
  description: string;
  branch: 'INDUSTRIAL' | 'MILITARY' | 'ECONOMIC' | 'SOCIAL';
  tier: number;
  cost: number;
  requiredLevel: number;
  prerequisites: string[];
  bonuses: {
    type: 'harvest_speed' | 'factory_output' | 'resource_capacity' | 'attack' | 'defense' | 
          'auction_fee_reduction' | 'bank_capacity' | 'member_slots' | 'xp_gain';
    value: number;
  }[];
}

const RESEARCH_TREE: ResearchNode[] = [
  {
    id: 'ind_harvest_1',
    name: 'Advanced Harvesting',
    description: 'Improved harvesting techniques increase resource gathering speed',
    branch: 'INDUSTRIAL',
    tier: 1,
    cost: 5000,
    requiredLevel: 5,
    prerequisites: [],
    bonuses: [{ type: 'harvest_speed', value: 10 }],
  },
  {
    id: 'ind_factory_1',
    name: 'Factory Automation',
    description: 'Automated systems boost factory production efficiency',
    branch: 'INDUSTRIAL',
    tier: 2,
    cost: 15000,
    requiredLevel: 10,
    prerequisites: ['ind_harvest_1'],
    bonuses: [{ type: 'factory_output', value: 15 }],
  },
  {
    id: 'ind_capacity_1',
    name: 'Resource Mastery',
    description: 'Advanced storage techniques increase resource capacity',
    branch: 'INDUSTRIAL',
    tier: 3,
    cost: 40000,
    requiredLevel: 20,
    prerequisites: ['ind_factory_1'],
    bonuses: [{ type: 'resource_capacity', value: 20 }],
  },
  {
    id: 'ind_super_harvest',
    name: 'Hyperharvesting',
    description: 'Ultimate harvesting technology maximizes resource extraction',
    branch: 'INDUSTRIAL',
    tier: 4,
    cost: 100000,
    requiredLevel: 30,
    prerequisites: ['ind_capacity_1'],
    bonuses: [
      { type: 'harvest_speed', value: 25 },
      { type: 'resource_capacity', value: 30 },
    ],
  },
  {
    id: 'mil_combat_1',
    name: 'Combat Training',
    description: 'Basic combat drills improve attack effectiveness',
    branch: 'MILITARY',
    tier: 1,
    cost: 5000,
    requiredLevel: 5,
    prerequisites: [],
    bonuses: [{ type: 'attack', value: 5 }],
  },
  {
    id: 'mil_tactics_1',
    name: 'Advanced Tactics',
    description: 'Strategic combat knowledge enhances offensive and defensive capabilities',
    branch: 'MILITARY',
    tier: 2,
    cost: 15000,
    requiredLevel: 10,
    prerequisites: ['mil_combat_1'],
    bonuses: [
      { type: 'attack', value: 10 },
      { type: 'defense', value: 5 },
    ],
  },
  {
    id: 'mil_warmachine',
    name: 'War Machine',
    description: 'Superior military technology dominates the battlefield',
    branch: 'MILITARY',
    tier: 3,
    cost: 40000,
    requiredLevel: 20,
    prerequisites: ['mil_tactics_1'],
    bonuses: [
      { type: 'attack', value: 15 },
      { type: 'defense', value: 10 },
    ],
  },
  {
    id: 'mil_domination',
    name: 'Total Domination',
    description: 'Ultimate military supremacy crushes all opposition',
    branch: 'MILITARY',
    tier: 4,
    cost: 100000,
    requiredLevel: 30,
    prerequisites: ['mil_warmachine'],
    bonuses: [
      { type: 'attack', value: 25 },
      { type: 'defense', value: 20 },
    ],
  },
  {
    id: 'eco_trade_1',
    name: 'Trade Expertise',
    description: 'Better negotiation reduces auction house fees',
    branch: 'ECONOMIC',
    tier: 1,
    cost: 5000,
    requiredLevel: 5,
    prerequisites: [],
    bonuses: [{ type: 'auction_fee_reduction', value: 5 }],
  },
  {
    id: 'eco_banking_1',
    name: 'Banking Systems',
    description: 'Improved financial infrastructure expands bank capacity',
    branch: 'ECONOMIC',
    tier: 2,
    cost: 15000,
    requiredLevel: 10,
    prerequisites: ['eco_trade_1'],
    bonuses: [{ type: 'bank_capacity', value: 25 }],
  },
  {
    id: 'eco_empire',
    name: 'Economic Empire',
    description: 'Vast economic power maximizes wealth generation',
    branch: 'ECONOMIC',
    tier: 3,
    cost: 40000,
    requiredLevel: 20,
    prerequisites: ['eco_banking_1'],
    bonuses: [
      { type: 'bank_capacity', value: 50 },
      { type: 'auction_fee_reduction', value: 10 },
    ],
  },
  {
    id: 'eco_monopoly',
    name: 'Market Monopoly',
    description: 'Complete market dominance ensures maximum profits',
    branch: 'ECONOMIC',
    tier: 4,
    cost: 100000,
    requiredLevel: 30,
    prerequisites: ['eco_empire'],
    bonuses: [
      { type: 'bank_capacity', value: 100 },
      { type: 'auction_fee_reduction', value: 20 },
    ],
  },
  {
    id: 'soc_recruit_1',
    name: 'Recruitment Drive',
    description: 'Expanded recruitment efforts increase member capacity',
    branch: 'SOCIAL',
    tier: 1,
    cost: 5000,
    requiredLevel: 5,
    prerequisites: [],
    bonuses: [{ type: 'member_slots', value: 10 }],
  },
  {
    id: 'soc_unity_1',
    name: 'Unity Bonus',
    description: 'Strong clan bonds accelerate member progression',
    branch: 'SOCIAL',
    tier: 2,
    cost: 15000,
    requiredLevel: 10,
    prerequisites: ['soc_recruit_1'],
    bonuses: [{ type: 'xp_gain', value: 5 }],
  },
  {
    id: 'soc_alliance',
    name: 'Grand Alliance',
    description: 'Massive organization supports more members and faster growth',
    branch: 'SOCIAL',
    tier: 3,
    cost: 40000,
    requiredLevel: 20,
    prerequisites: ['soc_unity_1'],
    bonuses: [
      { type: 'member_slots', value: 20 },
      { type: 'xp_gain', value: 10 },
    ],
  },
  {
    id: 'soc_empire',
    name: 'Empire of Unity',
    description: 'Ultimate social cohesion creates an unstoppable force',
    branch: 'SOCIAL',
    tier: 4,
    cost: 100000,
    requiredLevel: 30,
    prerequisites: ['soc_alliance'],
    bonuses: [
      { type: 'member_slots', value: 50 },
      { type: 'xp_gain', value: 20 },
    ],
  },
];

export function initializeClanResearchService(): void {
  // No-op: Drizzle uses direct db import
}

export async function contributeRP(
  clanId: string,
  playerId: string,
  amount: number
): Promise<{ success: boolean; newTotal: number; contributed: number }> {
  if (amount <= 0) {
    throw new Error('Contribution amount must be positive');
  }

  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0];
  if (!clan) {
    throw new Error('Clan not found');
  }

  const isMember = (clan.members as any[]).some((m: any) => m.playerId === playerId);
  if (!isMember) {
    throw new Error('Player is not a member of this clan');
  }

  const playerResult = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
  const player = playerResult[0];
  if (!player) {
    throw new Error('Player not found');
  }

  if ((player.researchPoints || 0) < amount) {
    throw new Error('Insufficient research points');
  }

  await db.update(players)
    .set({ researchPoints: (player.researchPoints || 0) - amount })
    .where(eq(players.username, playerId));

  const currentRP = clan.researchResearchPoints || 0;
  await db.update(clans)
    .set({ researchResearchPoints: currentRP + amount })
    .where(eq(clans.id, clanId));

  const { modLog } = await import('@/lib/db/schema');
  await db.insert(modLog).values({
    moderatorId: playerId,
    action: 'RP_CONTRIBUTED',
    targetId: clanId,
    reason: `Contributed ${amount} RP`,
    details: JSON.stringify({ amount, playerName: playerId }),
    createdAt: new Date(),
  });

  const updatedClanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const updatedClan = updatedClanResult[0];

  return {
    success: true,
    newTotal: updatedClan?.researchResearchPoints || 0,
    contributed: amount,
  };
}

export async function unlockResearch(
  clanId: string,
  playerId: string,
  researchId: string
): Promise<{
  success: boolean;
  research: ResearchNode;
  totalBonuses: Record<string, number>;
}> {
  const researchNode = RESEARCH_TREE.find((r) => r.id === researchId);
  if (!researchNode) {
    throw new Error('Research node not found');
  }

  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0];
  if (!clan) {
    throw new Error('Clan not found');
  }

  const member = (clan.members as any[]).find((m: any) => m.playerId === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  const allowedRoles = ['LEADER', 'CO_LEADER', 'OFFICER'];
  if (!allowedRoles.includes(member.role)) {
    throw new Error('Insufficient permissions to unlock research');
  }

  const unlockedResearch = (clan.researchUnlockedTechs as string[]) || [];
  if (unlockedResearch.includes(researchId)) {
    throw new Error('Research already unlocked');
  }

  if ((clan.levelCurrentLevel || 1) < researchNode.requiredLevel) {
    throw new Error(
      `Clan level ${researchNode.requiredLevel} required (current: ${clan.levelCurrentLevel || 1})`
    );
  }

  for (const prereqId of researchNode.prerequisites) {
    if (!unlockedResearch.includes(prereqId)) {
      const prereq = RESEARCH_TREE.find((r) => r.id === prereqId);
      throw new Error(`Prerequisite not met: ${prereq?.name || prereqId}`);
    }
  }

  const currentRP = clan.researchResearchPoints || 0;
  if (currentRP < researchNode.cost) {
    throw new Error(
      `Insufficient research points (need ${researchNode.cost}, have ${currentRP})`
    );
  }

  const newUnlocked = [...unlockedResearch, researchId];
  await db.update(clans)
    .set({
      researchResearchPoints: currentRP - researchNode.cost,
      researchUnlockedTechs: newUnlocked,
    })
    .where(eq(clans.id, clanId));

  const { modLog } = await import('@/lib/db/schema');
  await db.insert(modLog).values({
    moderatorId: playerId,
    action: 'RESEARCH_UNLOCKED',
    targetId: clanId,
    reason: `Unlocked ${researchNode.name}`,
    details: JSON.stringify({ researchId, researchName: researchNode.name, cost: researchNode.cost, unlockedBy: playerId }),
    createdAt: new Date(),
  });

  const updatedClanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const _updatedClan = updatedClanResult[0];

  const totalBonuses = await getClanBonuses(clanId);

  return {
    success: true,
    research: researchNode,
    totalBonuses,
  };
}

export async function getResearchTree(clanId: string): Promise<{
  INDUSTRIAL: Array<ResearchNode & { unlocked: boolean; available: boolean }>;
  MILITARY: Array<ResearchNode & { unlocked: boolean; available: boolean }>;
  ECONOMIC: Array<ResearchNode & { unlocked: boolean; available: boolean }>;
  SOCIAL: Array<ResearchNode & { unlocked: boolean; available: boolean }>;
  clanLevel: number;
  researchPoints: number;
}> {
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0];
  if (!clan) {
    throw new Error('Clan not found');
  }

  const unlockedResearch = (clan.researchUnlockedTechs as string[]) || [];
  const clanLevel = clan.levelCurrentLevel;

  const isAvailable = (node: ResearchNode): boolean => {
    if (unlockedResearch.includes(node.id)) return false;
    if (clanLevel < node.requiredLevel) return false;
    return node.prerequisites.every((prereq) => unlockedResearch.includes(prereq));
  };

  const tree = {
    INDUSTRIAL: RESEARCH_TREE.filter((r) => r.branch === 'INDUSTRIAL').map((r) => ({
      ...r,
      unlocked: unlockedResearch.includes(r.id),
      available: isAvailable(r),
    })),
    MILITARY: RESEARCH_TREE.filter((r) => r.branch === 'MILITARY').map((r) => ({
      ...r,
      unlocked: unlockedResearch.includes(r.id),
      available: isAvailable(r),
    })),
    ECONOMIC: RESEARCH_TREE.filter((r) => r.branch === 'ECONOMIC').map((r) => ({
      ...r,
      unlocked: unlockedResearch.includes(r.id),
      available: isAvailable(r),
    })),
    SOCIAL: RESEARCH_TREE.filter((r) => r.branch === 'SOCIAL').map((r) => ({
      ...r,
      unlocked: unlockedResearch.includes(r.id),
      available: isAvailable(r),
    })),
    clanLevel,
    researchPoints: clan.researchResearchPoints || 0,
  };

  return tree;
}

export async function getClanBonuses(clanId: string): Promise<Record<string, number>> {
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0];
  if (!clan) {
    throw new Error('Clan not found');
  }

  const unlockedResearch = (clan.researchUnlockedTechs as string[]) || [];
  const bonuses: Record<string, number> = {};

  for (const researchId of unlockedResearch) {
    const node = RESEARCH_TREE.find((r) => r.id === researchId);
    if (node) {
      for (const bonus of node.bonuses) {
        bonuses[bonus.type] = (bonuses[bonus.type] || 0) + bonus.value;
      }
    }
  }

  return bonuses;
}

export async function getRecommendedResearch(clanId: string): Promise<
  Array<{
    research: ResearchNode;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }>
> {
  const clanResult = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanResult[0];
  if (!clan) {
    throw new Error('Clan not found');
  }

  const tree = await getResearchTree(clanId);
  const recommendations: Array<{
    research: ResearchNode;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }> = [];

  const availableResearch = [
    ...tree.INDUSTRIAL,
    ...tree.MILITARY,
    ...tree.ECONOMIC,
    ...tree.SOCIAL,
  ].filter((r) => r.available && !r.unlocked);

  const warsActive = (clan.statsTotalTerritories || 0) > 0;
  const memberCount = (clan.members as any[]).length;
  const nearCapacity = memberCount >= clan.maxMembers * 0.8;

  for (const research of availableResearch) {
    if (research.branch === 'MILITARY' && warsActive) {
      recommendations.push({
        research,
        reason: 'Recommended for active warfare',
        priority: 'high',
      });
    } else if (research.branch === 'ECONOMIC' && (clan.researchResearchPoints || 0) < 10000) {
      recommendations.push({
        research,
        reason: 'Boost economic strength',
        priority: 'medium',
      });
    } else if (research.branch === 'SOCIAL' && nearCapacity) {
      recommendations.push({
        research,
        reason: 'Expand member capacity',
        priority: 'high',
      });
    } else if (research.branch === 'INDUSTRIAL') {
      recommendations.push({
        research,
        reason: 'Improve resource production',
        priority: 'medium',
      });
    }
  }

  const priorityOrder = { high: 3, medium: 2, low: 1 };
  return recommendations
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .slice(0, 3);
}

export async function getResearchProgress(clanId: string): Promise<{
  INDUSTRIAL: { unlocked: number; total: number; percentage: number };
  MILITARY: { unlocked: number; total: number; percentage: number };
  ECONOMIC: { unlocked: number; total: number; percentage: number };
  SOCIAL: { unlocked: number; total: number; percentage: number };
  overall: { unlocked: number; total: number; percentage: number };
}> {
  const tree = await getResearchTree(clanId);

  const calculateBranch = (branch: any[]) => {
    const unlocked = branch.filter((r) => r.unlocked).length;
    const total = branch.length;
    return {
      unlocked,
      total,
      percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0,
    };
  };

  const progress = {
    INDUSTRIAL: calculateBranch(tree.INDUSTRIAL),
    MILITARY: calculateBranch(tree.MILITARY),
    ECONOMIC: calculateBranch(tree.ECONOMIC),
    SOCIAL: calculateBranch(tree.SOCIAL),
    overall: {
      unlocked: 0,
      total: RESEARCH_TREE.length,
      percentage: 0,
    },
  };

  progress.overall.unlocked =
    progress.INDUSTRIAL.unlocked +
    progress.MILITARY.unlocked +
    progress.ECONOMIC.unlocked +
    progress.SOCIAL.unlocked;
  progress.overall.percentage = Math.round(
    (progress.overall.unlocked / progress.overall.total) * 100
  );

  return progress;
}
