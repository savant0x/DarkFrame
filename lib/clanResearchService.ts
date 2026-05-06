/**
 * Clan Research Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan research system with 4-branch technology tree (Industrial, Military,
 * Economic, Social). Handles RP contributions, research unlocking, prerequisite
 * validation, and bonus calculations. Provides 15+ technology nodes with progressive
 * unlocking and cumulative bonuses.
 */

import { createServiceClient } from '@/lib/supabase/server';

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

export async function contributeRP(
  clanId: string,
  playerId: string,
  amount: number
): Promise<{ success: boolean; newTotal: number; contributed: number }> {
  const supabase = createServiceClient();

  if (amount <= 0) {
    throw new Error('Contribution amount must be positive');
  }

  const { data: clan, error: clanError } = await supabase
    .from('clans')
    .select('research_points')
    .eq('id', clanId)
    .single();

  if (clanError || !clan) {
    throw new Error('Clan not found');
  }

  const { data: members } = await supabase
    .from('clan_members')
    .select('player_id')
    .eq('clan_id', clanId);

  const isMember = (members || []).some((m) => m.player_id === playerId);
  if (!isMember) {
    throw new Error('Player is not a member of this clan');
  }

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('username, research_points')
    .eq('username', playerId)
    .single();

  if (playerError || !player) {
    throw new Error('Player not found');
  }

  const playerRP = (player as Record<string, unknown>).research_points as number || 0;
  if (playerRP < amount) {
    throw new Error('Insufficient research points');
  }

  await supabase
    .from('players')
    .update({ research_points: playerRP - amount })
    .eq('username', playerId);

  const clanRP = (clan as Record<string, unknown>).research_points as number || 0;
  const newRP = clanRP + amount;

  await supabase
    .from('clans')
    .update({ research_points: newRP })
    .eq('id', clanId);

  await supabase.from('clan_activity').insert({
    clan_id: clanId,
    activity_type: 'RESEARCH_CONTRIBUTED',
    player_id: playerId,
    username: playerId,
    created_at: new Date().toISOString(),
    details: {
      amount,
      player_name: playerId,
    },
  });

  return {
    success: true,
    newTotal: newRP,
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
  const supabase = createServiceClient();

  const researchNode = RESEARCH_TREE.find((r) => r.id === researchId);
  if (!researchNode) {
    throw new Error('Research node not found');
  }

  const { data: clan, error: clanError } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .single();

  if (clanError || !clan) {
    throw new Error('Clan not found');
  }

  const r = clan as Record<string, unknown>;

  const { data: members } = await supabase
    .from('clan_members')
    .select('player_id, role')
    .eq('clan_id', clanId);

  const member = (members || []).find((m) => m.player_id === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  const allowedRoles = ['LEADER', 'CO_LEADER', 'OFFICER'];
  if (!allowedRoles.includes(member.role)) {
    throw new Error('Insufficient permissions to unlock research');
  }

  const unlockedResearch = (r.unlocked_research as string[]) || [];
  if (unlockedResearch.includes(researchId)) {
    throw new Error('Research already unlocked');
  }

  const clanLevel = r.clan_level as number;
  if (clanLevel < researchNode.requiredLevel) {
    throw new Error(
      `Clan level ${researchNode.requiredLevel} required (current: ${clanLevel})`
    );
  }

  for (const prereqId of researchNode.prerequisites) {
    if (!unlockedResearch.includes(prereqId)) {
      const prereq = RESEARCH_TREE.find((r) => r.id === prereqId);
      throw new Error(`Prerequisite not met: ${prereq?.name || prereqId}`);
    }
  }

  const currentRP = (r.research_points as number) || 0;
  if (currentRP < researchNode.cost) {
    throw new Error(
      `Insufficient research points (need ${researchNode.cost}, have ${currentRP})`
    );
  }

  const newUnlocked = [...unlockedResearch, researchId];
  const newRP = currentRP - researchNode.cost;

  await supabase
    .from('clans')
    .update({
      research_points: newRP,
      unlocked_research: newUnlocked,
    })
    .eq('id', clanId);

  await supabase.from('clan_activity').insert({
    clan_id: clanId,
    activity_type: 'RESEARCH_UNLOCKED',
    player_id: playerId,
    username: playerId,
    created_at: new Date().toISOString(),
    details: {
      research_id: researchId,
      research_name: researchNode.name,
      cost: researchNode.cost,
      unlocked_by: playerId,
    },
  });

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
  const supabase = createServiceClient();

  const { data: clan, error } = await supabase
    .from('clans')
    .select('research_points, unlocked_research, clan_level')
    .eq('id', clanId)
    .single();

  if (error || !clan) {
    throw new Error('Clan not found');
  }

  const r = clan as Record<string, unknown>;
  const unlockedResearch = (r.unlocked_research as string[]) || [];
  const clanLevel = r.clan_level as number;

  const isAvailable = (node: ResearchNode): boolean => {
    if (unlockedResearch.includes(node.id)) return false;
    if (clanLevel < node.requiredLevel) return false;
    return node.prerequisites.every((prereq) => unlockedResearch.includes(prereq));
  };

  return {
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
    researchPoints: (r.research_points as number) || 0,
  };
}

export async function getClanBonuses(clanId: string): Promise<Record<string, number>> {
  const supabase = createServiceClient();

  const { data: clan, error } = await supabase
    .from('clans')
    .select('unlocked_research')
    .eq('id', clanId)
    .single();

  if (error || !clan) {
    throw new Error('Clan not found');
  }

  const unlockedResearch = ((clan as Record<string, unknown>).unlocked_research as string[]) || [];
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
  const supabase = createServiceClient();

  const { data: clan, error } = await supabase
    .from('clans')
    .select('research_points, max_members, total_territories, wars_won')
    .eq('id', clanId)
    .single();

  if (error || !clan) {
    throw new Error('Clan not found');
  }

  const { data: members } = await supabase
    .from('clan_members')
    .select('player_id')
    .eq('clan_id', clanId);

  const r = clan as Record<string, unknown>;

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
  ].filter((res) => res.available && !res.unlocked);

  const warsActive = ((r.wars_won as number) || 0) > 0;
  const hasTerritory = ((r.total_territories as number) || 0) > 0;
  const memberCount = (members || []).length;
  const maxMembers = (r.max_members as number) || 20;
  const nearCapacity = memberCount >= maxMembers * 0.8;

  for (const research of availableResearch) {
    if (research.branch === 'MILITARY' && warsActive) {
      recommendations.push({
        research,
        reason: 'Recommended for active warfare',
        priority: 'high',
      });
    }
    else if (research.branch === 'ECONOMIC' && ((r.research_points as number) || 0) < 10000) {
      recommendations.push({
        research,
        reason: 'Boost economic strength',
        priority: 'medium',
      });
    }
    else if (research.branch === 'SOCIAL' && nearCapacity) {
      recommendations.push({
        research,
        reason: 'Expand member capacity',
        priority: 'high',
      });
    }
    else if (research.branch === 'INDUSTRIAL') {
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

  const calculateBranch = (branch: Array<{ unlocked: boolean }>) => {
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
