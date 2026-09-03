/**
 * Tutorial Service
 * Created: 2025-10-25
 * Feature: FID-20251025-101 - Interactive Tutorial Quest System
 * 
 * OVERVIEW:
 * Core service managing the interactive tutorial system including quest chains,
 * progress tracking, step validation, and reward distribution. Implements exact
 * user vision: "Press W to move north → Navigate to cave → Found LEGENDARY digger!"
 * 
 * RESPONSIBILITIES:
 * - Quest chain definitions and management
 * - Player progress tracking in Drizzle ORM
 * - Step completion validation
 * - Reward distribution integration
 * - Analytics tracking
 * 
 * QUEST CHAIN DESIGN:
 * 1. Movement Basics (3 steps) - WASD navigation
 * 2. Resource Management & Army Building (7 steps) - Economy, caves, factories, units
 * 3. Combat Introduction (3 steps) - Attack first Beer Base
 * 4. Social Introduction (2 steps) - Clans and community (UI PENDING)
 * 5. Tech Tree Basics (2 steps) - First research
 * 6. Completion Celebration (1 step) - Claim starter pack
 * 
 * Total: ~21 steps across 6 quests
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tutorialProgress, tutorialActionTracking, players, factories } from '@/lib/db/schema';
import { randomUUID } from 'node:crypto';
import type {
  TutorialQuest,
  TutorialProgress,
  TutorialStep,
  TutorialStepCompletionResult,
  TutorialQuestCompletionResult,
  TutorialValidationRequest,
  TutorialReward,
  TutorialAnalytics,
  TutorialConfig,
  PlayerGameStateValidation,
} from '@/types/tutorial.types';
import { DEFAULT_TUTORIAL_CONFIG } from '@/types/tutorial.types';
import type { TutorialInventoryItem } from '@/types/game.types';
import { awardTutorialDiggerToPlayer } from './caveItemService';

/**
 * Tutorial Quest Chain Definitions
 * These are the hardcoded quest chains that guide new players
 */
export const TUTORIAL_QUESTS: TutorialQuest[] = [
  // ============================================================================
  // QUEST 1: Movement Basics
  // ============================================================================
  {
    _id: 'quest_movement_basics',
    title: 'Movement Basics',
    description: 'Learn to navigate by visiting important locations',
    category: 'MOVEMENT',
    order: 0,
    icon: 'Move',
    steps: [
      {
        id: 'movement_welcome',
        order: 0,
        title: 'Welcome to DarkFrame!',
        instruction: 'Welcome to DarkFrame! Let\'s learn how to navigate the world.',
        detailedHelp: 'You can move using WASD, QWEASDZXC, Arrow Keys, or Numpad. The best way to learn is by doing!',
        action: 'READ_INFO',
        difficulty: 'EASY',
        estimatedSeconds: 10,
        skipAllowed: false,
        autoComplete: true,
        autoCompleteDelay: 4000,
      },
      {
        id: 'movement_navigate_to_shrine',
        order: 1,
        title: 'Visit the Shrine',
        instruction: 'Navigate to the Shrine at (1, 1)!',
        detailedHelp: `🎯 WHY: The Shrine is your spiritual hub where you can upgrade units, unlock special abilities, and receive blessings.

🕐 WHEN TO USE:
• After winning battles to upgrade victorious units
• When you need special buffs before tough encounters
• To unlock new unit tiers and capabilities

⚡ HOW TO USE:
• Navigate to coordinates (1, 1) - top-left corner of the map
• Click "Visit Shrine" button when you arrive
• Use WASD, Arrow Keys, or Numpad to move`,
        action: 'MOVE_TO_COORDS',
        targetElement: '.movement-controls',
        validationData: { 
          targetX: 1,
          targetY: 1,
          locationName: 'Shrine'
        },
        completionMessage: 'You found the Shrine! Click the "Visit Shrine" button to access shrine services.',
        difficulty: 'EASY',
        estimatedSeconds: 30,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 500,
          displayMessage: 'You earned 500 Metal for finding the Shrine!',
        },
      },
      {
        id: 'movement_navigate_to_metal_bank',
        order: 2,
        title: 'Visit the Metal Bank',
        instruction: 'Navigate to the Metal Bank to learn about resource storage!',
        detailedHelp: `🎯 WHY: The Metal Bank protects your Metal from enemy raids! Stored resources are 100% safe.

🕐 WHEN TO USE:
• Before logging off to keep resources safe
• After big harvests or successful raids
• When preparing for risky battles (protect your wealth first!)

⚡ HOW TO USE:
• Navigate to coordinates (25, 25)
• Click "Bank" button to deposit/withdraw Metal
• Withdraw anytime - no fees, instant access!

💡 PRO TIP: Always bank your resources before going AFK to prevent raids from taking your hard-earned Metal!`,
        action: 'MOVE_TO_COORDS',
        targetElement: '.movement-controls',
        validationData: { 
          targetX: 25,
          targetY: 25,
          locationName: 'Metal Bank'
        },
        completionMessage: 'Found the Metal Bank! Store your Metal here to protect it.',
        difficulty: 'EASY',
        estimatedSeconds: 30,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 750,
          displayMessage: 'You earned 750 Metal for finding the Metal Bank!',
        },
      },
      {
        id: 'movement_navigate_to_exchange',
        order: 3,
        title: 'Visit the Exchange',
        instruction: 'Navigate to the Exchange Bank!',
        detailedHelp: `🎯 WHY: The Exchange is your resource conversion hub! Convert Metal ↔️ Energy with a 20% fee.

🕐 WHEN TO USE:
• When you have excess Metal but need Energy (or vice versa)
• To balance your resource stockpiles
• Before building units that require different resources

⚡ HOW TO USE:
• Navigate to coordinates (50, 50)
• Click "Exchange" button to see current rates
• Trade Metal for Energy or Energy for Metal
• Pay 20% conversion fee (e.g., 100 Metal → 80 Energy)

💡 PRO TIP: Plan conversions carefully - the 20% fee adds up! Only convert when you really need the other resource.`,
        action: 'MOVE_TO_COORDS',
        targetElement: '.movement-controls',
        validationData: { 
          targetX: 50,
          targetY: 50,
          locationName: 'Exchange Bank'
        },
        completionMessage: 'Found the Exchange! You can convert Metal ↔ Energy here with a 20% fee.',
        difficulty: 'EASY',
        estimatedSeconds: 30,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 1000,
          displayMessage: 'You earned 1,000 Metal for finding the Exchange!',
        },
      },
      {
        id: 'movement_navigate_to_energy_bank',
        order: 4,
        title: 'Visit the Energy Bank',
        instruction: 'Navigate to the Energy Bank!',
        detailedHelp: `🎯 WHY: The Energy Bank protects your Energy from raids! Just like Metal Bank but for Energy.

🕐 WHEN TO USE:
• After harvesting Energy from caves
• Before risky PvP battles
• When going offline/AFK
• After trading at the Exchange

⚡ HOW TO USE:
• Navigate to coordinates (75, 75)
• Click "Bank" button for deposit/withdraw
• No fees, instant access, 100% raid protection

💡 PRO TIP: Energy is precious! Always bank it immediately after harvest. Other players WILL raid you if they see high Energy counts!`,
        action: 'MOVE_TO_COORDS',
        targetElement: '.movement-controls',
        validationData: { 
          targetX: 75,
          targetY: 75,
          locationName: 'Energy Bank'
        },
        completionMessage: 'Found the Energy Bank! Keep your Energy safe here.',
        difficulty: 'EASY',
        estimatedSeconds: 30,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 50,
          displayMessage: 'You earned 50 Metal for finding the Energy Bank!',
        },
      },
      {
        id: 'movement_navigate_to_secondary_exchange',
        order: 5,
        title: 'Explore the Far Corner',
        instruction: 'Navigate to the far corner of the map at (100, 100)!',
        detailedHelp: `🎯 WHY: Exploring distant regions helps you understand map layout and discover hidden opportunities!

🕐 WHEN TO USE:
• When scouting for remote caves and resources
• Looking for less-contested harvest locations
• Planning factory placement in quieter areas
• Exploring the full extent of the game world

⚡ HOW TO EXPLORE:
• Navigate to coordinates (100, 100) - far corner
• Use WASD, Arrow Keys, or Numpad to move
• Notice how terrain changes in different regions
• Remote areas often have better resources!

💡 PRO TIP: The corners and edges of the map are often less crowded. Remote caves can be harvested safely while you grow stronger!`,
        action: 'MOVE_TO_COORDS',
        targetElement: '.movement-controls',
        validationData: { 
          targetX: 100,
          targetY: 100,
          locationName: 'Far Corner'
        },
        completionMessage: 'You explored the far corner! Remote areas often have hidden treasures.',
        difficulty: 'EASY',
        estimatedSeconds: 40,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 50,
          displayMessage: 'You earned 50 Metal for exploring the far corner!',
        },
      },
      {
        id: 'movement_free_exploration',
        order: 6,
        title: 'Free Exploration',
        instruction: 'Explore the map freely! Move 15 times in any direction.',
        detailedHelp: `🎯 WHY: Exploration helps you discover caves, resources, and strategic positions!

🕐 WHEN TO USE:
• When looking for Metal/Energy caves to harvest
• Scouting for enemy factories or beer bases
• Finding ideal factory placement locations
• Discovering new areas and opportunities

⚡ HOW TO EXPLORE:
• Use WASD, Arrow Keys, Q/E/Z/C, or Numpad
• Look for cave icons (🏔️) - these have resources!
• Check tile descriptions for harvest opportunities
• Move 15 times in any direction to complete

💡 PRO TIP: The world is full of hidden caves! Each tile shows terrain type - "Cave" tiles can be harvested for Metal or Energy. Explore systematically!`,
        action: 'MOVE',
        validationData: { requiredMoves: 15, anyDirection: true },
        completionMessage: 'Excellent! You\'ve mastered navigation!',
        difficulty: 'EASY',
        estimatedSeconds: 30,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 100,
          displayMessage: 'You earned 100 Metal for mastering movement!',
        },
      },
    ],
    completionReward: {
      type: 'ACHIEVEMENT',
      achievementId: 'tutorial_movement_complete',
      displayMessage: 'Achievement Unlocked: Navigator!',
    },
    isOptional: false,
    estimatedMinutes: 1,
  },

  // ============================================================================
  // QUEST 2: Resource Management & Army Building
  // ============================================================================
  {
    _id: 'quest_resource_army_building',
    title: 'Resource Management & Army Building',
    description: 'Learn to gather resources, harvest caves, and build your first army',
    category: 'ECONOMY',
    order: 1,
    icon: 'Coins',
    prerequisiteQuests: ['quest_movement_basics'],
    steps: [
      {
        id: 'resource_intro',
        order: 0,
        title: 'Understanding Resources',
        instruction: 'Resources are the foundation of your empire. Let\'s learn how to gather them!',
        detailedHelp: 'Metal and Energy are the two core resources in DarkFrame. You\'ll need them to build units, capture factories, and expand your territory. Caves are excellent sources of resources!',
        action: 'READ_INFO',
        difficulty: 'EASY',
        estimatedSeconds: 5,
        skipAllowed: false,
        autoComplete: true,
        autoCompleteDelay: 5000,
      },
      {
        id: 'resource_find_cave',
        order: 1,
        title: 'Find Your First Cave',
        instruction: 'Navigate to the cave at coordinates (20, 40) and harvest resources!',
        detailedHelp: `🎯 WHY: Caves are rich sources of Metal and Energy. Finding them often gives you a huge advantage!

🕐 WHEN TO USE:
• When you need quick resources
• When you want to avoid combat
• When exploring new areas of the map

⚡ HOW TO HARVEST:
• Navigate to coordinates (20, 40)
• Press F or click the Harvest button
• Caves regenerate over time - return often!

💡 PRO TIP: Harvesting caves also rewards you with special tools like diggers that boost your harvest amounts!`,
        action: 'MOVE',
        targetCoordinates: { x: 20, y: 40, radius: 0 },
        targetElement: '.cave-tile',
        completionMessage: 'You found the cave! Now harvest it!',
        difficulty: 'MEDIUM',
        estimatedSeconds: 30,
        skipAllowed: true,
      },
      {
        id: 'resource_harvest_cave',
        order: 2,
        title: 'Harvest the Cave',
        instruction: 'Press F (or click Harvest) to collect resources and earn a special quest reward digger!',
        detailedHelp: `🎁 SPECIAL QUEST REWARD: Harvesting this cave will give you resources AND a guaranteed Tutorial Universal Digger!

✨ WHAT YOU GET:
• Tutorial Universal Digger (RARE quality)
• +5% gathering efficiency for BOTH Metal AND Energy
• This is a PERMANENT bonus - it stacks with future diggers
• This special digger is a quest reward, not a random drop!

💡 IMPORTANT: This is your guaranteed tutorial reward - you won't find this digger anywhere else!`,
        action: 'HARVEST',
        targetElement: '.harvest-button',
        completionMessage: 'Excellent! You received your special quest reward: Tutorial Universal Digger (+5% gathering efficiency)!',
        difficulty: 'EASY',
        estimatedSeconds: 10,
        skipAllowed: false,
        reward: {
          type: 'ITEM',
          itemId: 'tutorial_universal_digger',
          itemName: 'Tutorial Universal Digger',
          displayMessage: '🎁 QUEST REWARD: You received a Tutorial Universal Digger! This permanently increases your gathering efficiency by 5% for both Metal AND Energy!',
        },
      },
      {
        id: 'resource_collect_metal',
        order: 3,
        title: 'Collect 5,000 Metal',
        instruction: 'Gather 5,000 Metal by harvesting caves or completing actions!',
        detailedHelp: `🎯 GOAL: Reach 5,000 Metal (tracks your current balance, not total earned)

💰 HOW TO EARN METAL:
• Harvest caves (primary source)
• Complete tutorial steps (bonus rewards)
• Attack Beer Bases (coming soon!)
• Raid other players (advanced strategy)

⚡ YOUR RARE DIGGER HELPS: +5% faster harvesting!

💡 PRO TIP: Your current Metal balance is shown in the top bar. Keep harvesting caves until you reach 5,000!`,
        action: 'CUSTOM',
        validationData: { requirementType: 'metal_balance', targetAmount: 5000 },
        completionMessage: 'Great! You\'ve collected 5,000 Metal!',
        difficulty: 'MEDIUM',
        estimatedSeconds: 120,
        skipAllowed: true,
      },
      {
        id: 'resource_collect_energy',
        order: 4,
        title: 'Collect 5,000 Energy',
        instruction: 'Gather 5,000 Energy by harvesting caves or completing actions!',
        detailedHelp: `🎯 GOAL: Reach 5,000 Energy (tracks your current balance, not total earned)

⚡ HOW TO EARN ENERGY:
• Harvest Energy caves (look for Energy-rich tiles)
• Complete tutorial steps (bonus rewards)
• Convert Metal to Energy at the Exchange (50, 50) - 20% fee
• Capture and hold Energy production buildings

💡 STRATEGY: You can convert Metal to Energy at the Exchange if you have excess Metal! Pay 20% fee (100 Metal → 80 Energy).`,
        action: 'CUSTOM',
        validationData: { requirementType: 'energy_balance', targetAmount: 5000 },
        completionMessage: 'Excellent! You\'ve collected 5,000 Energy!',
        difficulty: 'MEDIUM',
        estimatedSeconds: 120,
        skipAllowed: true,
      },
      {
        id: 'resource_capture_factory',
        order: 5,
        title: 'Capture a Factory',
        instruction: 'Find and capture a WEAK factory to start building units!',
        detailedHelp: `🎯 WHY: Factories produce military units - the backbone of your army!

🏭 WHAT TO DO:
• Find a WEAK factory on the map (factory icons)
• Click on it and select "Capture"
• WEAK factories usually have no defenders - easy capture!

⚡ AFTER CAPTURE:
• You'll own the factory and can build units there
• Factories generate passive income over time
• You can upgrade factories to build stronger units

💡 PRO TIP: Level 1 (WEAK) factories are perfect for beginners - they have minimal or no army guarding them!`,
        action: 'CUSTOM',
        validationData: { requirementType: 'factory_capture', tier: 'WEAK' },
        completionMessage: 'Factory captured! You can now build units!',
        difficulty: 'MEDIUM',
        estimatedSeconds: 60,
        skipAllowed: true,
      },
      {
        id: 'resource_build_infantry',
        order: 6,
        title: 'Build Your First Unit',
        instruction: 'Build 1 Infantry unit at your captured factory!',
        detailedHelp: `🎯 WHY: Units are essential for attacking, defending, and capturing territory!

👥 HOW TO BUILD:
• Go to your captured factory
• Click "Build Units" or open the factory panel
• Select Infantry (basic unit)
• Build 1 Infantry unit

⚡ ABOUT INFANTRY:
• Cheapest and fastest to build
• Good for early game expansion
• Required for capturing factories
• Can be upgraded at the Shrine

💡 NO DEPLOYMENT NEEDED: You only need units IN your factory to capture it. Units automatically defend your factory!`,
        action: 'CUSTOM',
        validationData: { requirementType: 'build_unit', unitType: 'infantry', count: 1 },
        completionMessage: 'Unit built! You\'re ready for combat!',
        difficulty: 'EASY',
        estimatedSeconds: 30,
        skipAllowed: false,
      },
    ],
    completionReward: {
      type: 'METAL',
      amount: 500,
      displayMessage: 'Resource Management Complete! +500 Metal bonus!',
    },
    isOptional: false,
    estimatedMinutes: 5,
  },

  // ============================================================================
  // QUEST 3: Combat Introduction
  // ============================================================================
  {
    _id: 'quest_combat_intro',
    title: 'First Battle',
    description: 'Learn combat by attacking your first Beer Base',
    category: 'COMBAT',
    order: 2,
    icon: 'Swords',
    prerequisiteQuests: ['quest_resource_army_building'],
    steps: [
      {
        id: 'combat_intro',
        order: 0,
        title: 'What are Beer Bases?',
        instruction: 'Beer Bases are enemy targets you can attack for rewards and experience!',
        detailedHelp: 'There are 6 power tiers: WEAK, MEDIUM, STRONG, ELITE, ULTRA, LEGENDARY. Start with WEAK!',
        action: 'READ_INFO',
        difficulty: 'EASY',
        estimatedSeconds: 15,
        skipAllowed: false,
        autoComplete: true,
        autoCompleteDelay: 7000,
      },
      {
        id: 'combat_find_target',
        order: 1,
        title: 'Find a Beer Base',
        instruction: 'Look for a WEAK Beer Base on the map (they appear as beer mug icons)',
        action: 'CUSTOM',
        targetElement: '.beer-base-tile',
        validationData: { requirementType: 'find_beer_base' },
        completionMessage: 'Target acquired!',
        difficulty: 'EASY',
        estimatedSeconds: 20,
        skipAllowed: true,
      },
      {
        id: 'combat_attack',
        order: 2,
        title: 'Attack the Base',
        instruction: 'Click on the Beer Base and select "Attack" to engage in combat!',
        action: 'ATTACK',
        targetElement: '.attack-button',
        validationData: { targetType: 'beer_base' },
        completionMessage: 'Victory! You\'ve won your first battle!',
        difficulty: 'MEDIUM',
        estimatedSeconds: 30,
        skipAllowed: false,
        reward: {
          type: 'EXPERIENCE',
          amount: 100,
          displayMessage: '+100 XP! You\'re getting stronger!',
        },
      },
    ],
    completionReward: {
      type: 'ACHIEVEMENT',
      achievementId: 'tutorial_first_battle',
      displayMessage: 'Achievement Unlocked: Warrior!',
    },
    isOptional: false,
    estimatedMinutes: 2,
  },

  // ============================================================================
  // QUEST 4: Social Introduction
  // ============================================================================
  {
    _id: 'quest_social_intro',
    title: 'Join the Community',
    description: 'Learn about clans and social features',
    category: 'SOCIAL',
    order: 3,
    icon: 'Users',
    prerequisiteQuests: ['quest_combat_intro'],
    steps: [
      {
        id: 'social_clan_intro',
        order: 0,
        title: 'What are Clans?',
        instruction: 'Clans are groups of players who work together. Let\'s explore this feature!',
        detailedHelp: 'Clans can declare wars, control territory, and share resources. Stronger together!',
        action: 'READ_INFO',
        difficulty: 'EASY',
        estimatedSeconds: 10,
        skipAllowed: false,
        autoComplete: true,
        autoCompleteDelay: 5000,
      },
      {
        id: 'social_open_clan_panel',
        order: 1,
        title: 'Open Clan Panel',
        instruction: 'Open the Clans panel to see available clans or create your own',
        action: 'OPEN_PANEL',
        targetElement: '.clan-panel-button',
        validationData: { panelName: 'clans' },
        completionMessage: 'You can join a clan or create your own anytime!',
        difficulty: 'EASY',
        estimatedSeconds: 15,
        skipAllowed: true,
      },
    ],
    completionReward: {
      type: 'METAL',
      amount: 150,
      displayMessage: 'Social Exploration Complete! +150 Metal!',
    },
    isOptional: true,
    estimatedMinutes: 1,
  },

  // ============================================================================
  // QUEST 5: Tech Tree Basics
  // ============================================================================
  {
    _id: 'quest_tech_tree_intro',
    title: 'Research & Development',
    description: 'Unlock new abilities through the Tech Tree',
    category: 'PROGRESSION',
    order: 4,
    icon: 'GraduationCap',
    prerequisiteQuests: ['quest_combat_intro'],
    steps: [
      {
        id: 'tech_intro',
        order: 0,
        title: 'What is the Tech Tree?',
        instruction: 'The Tech Tree lets you research upgrades to become more powerful!',
        detailedHelp: 'Research costs resources but grants permanent bonuses like faster harvesting or stronger attacks.',
        action: 'READ_INFO',
        difficulty: 'EASY',
        estimatedSeconds: 10,
        skipAllowed: false,
        autoComplete: true,
        autoCompleteDelay: 5000,
      },
      {
        id: 'tech_open_panel',
        order: 1,
        title: 'Explore Tech Tree',
        instruction: 'Open the Tech Tree panel to see available research options',
        action: 'OPEN_PANEL',
        targetElement: '.tech-tree-button',
        validationData: { panelName: 'tech-tree' },
        completionMessage: 'You can research upgrades as you earn more resources!',
        difficulty: 'EASY',
        estimatedSeconds: 15,
        skipAllowed: true,
      },
    ],
    completionReward: {
      type: 'OIL',
      amount: 100,
      displayMessage: 'Tech Tree Explored! +100 Oil!',
    },
    isOptional: true,
    estimatedMinutes: 1,
  },

  // ============================================================================
  // QUEST 6: Tutorial Complete!
  // ============================================================================
  {
    _id: 'quest_tutorial_complete',
    title: 'Tutorial Complete!',
    description: 'Claim your starter pack and begin your journey',
    category: 'UI_NAVIGATION',
    order: 5,
    icon: 'Trophy',
    prerequisiteQuests: ['quest_movement_basics', 'quest_resource_army_building', 'quest_combat_intro'],
    steps: [
      {
        id: 'tutorial_complete_celebration',
        order: 0,
        title: 'Congratulations!',
        instruction: 'You\'ve completed the tutorial! Click below to claim your starter pack.',
        detailedHelp: 'You\'re now ready to conquer DarkFrame. Good luck, Commander!',
        action: 'COLLECT_REWARD',
        difficulty: 'EASY',
        estimatedSeconds: 10,
        skipAllowed: false,
        reward: {
          type: 'ITEM',
          itemId: 'starter_pack',
          itemName: 'Starter Pack',
          displayMessage: 'Starter Pack: 500 Metal, 300 Oil, 5 Random Items!',
        },
      },
    ],
    completionReward: {
      type: 'ACHIEVEMENT',
      achievementId: 'tutorial_master',
      displayMessage: 'Achievement Unlocked: Tutorial Master! +50% bonus to all starter rewards!',
    },
    isOptional: false,
    estimatedMinutes: 1,
    unlocks: ['full_game_access'],
  },
];

/**
 * Get all tutorial quests in order
 */
export function getTutorialQuests(): TutorialQuest[] {
  return TUTORIAL_QUESTS.sort((a, b) => a.order - b.order);
}

/**
 * Get specific tutorial quest by ID
 */
export function getTutorialQuest(questId: string): TutorialQuest | null {
  return TUTORIAL_QUESTS.find(q => q._id === questId) || null;
}

/**
 * Get next quest in chain based on current quest
 */
export function getNextQuest(currentQuestId: string): TutorialQuest | null {
  const currentQuest = getTutorialQuest(currentQuestId);
  if (!currentQuest) return null;
  
  const nextOrder = currentQuest.order + 1;
  return TUTORIAL_QUESTS.find(q => q.order === nextOrder) || null;
}

/**
 * Convert Drizzle row to TutorialProgress type
 */
function mapProgressRow(row: typeof tutorialProgress.$inferSelect): TutorialProgress {
  return {
    _id: row.id as any,
    playerId: row.playerId,
    currentQuestId: row.currentQuestId || undefined,
    currentStepIndex: row.currentStepIndex,
    completedQuests: row.completedQuests || [],
    completedSteps: row.completedSteps || [],
    skippedQuests: row.skippedQuests || [],
    claimedRewards: row.claimedRewards || [],
    tutorialSkipped: row.tutorialSkipped === 1,
    tutorialDeclined: row.tutorialDeclined === 1,
    tutorialComplete: row.tutorialComplete === 1,
    startedAt: row.startedAt,
    currentStepStartedAt: row.currentStepStartedAt || undefined,
    completedAt: row.completedAt || undefined,
    declinedAt: row.declinedAt || undefined,
    lastUpdated: row.lastUpdated,
    totalStepsCompleted: row.totalStepsCompleted,
    totalTimeSpent: row.totalTimeSpent,
  };
}

/**
 * Get player's tutorial progress
 * Creates initial progress if player is new
 */
export async function getTutorialProgress(playerId: string): Promise<TutorialProgress> {
  const progressRow = await db.select().from(tutorialProgress).where(eq(tutorialProgress.playerId, playerId)).limit(1);
  let progress = progressRow.length > 0 ? mapProgressRow(progressRow[0]) : null;
  
  // Block tutorial restart if permanently declined
  if (progress && progress.tutorialDeclined) {
    console.log(`[Tutorial] Player ${playerId} previously declined tutorial. Restart blocked.`);
    return progress;
  }
  
  if (!progress) {
    // Create initial progress for new player
    const firstQuest = TUTORIAL_QUESTS[0];
    const firstStep = firstQuest.steps[0];
    
    const now = new Date();
    const newProgress: Omit<TutorialProgress, '_id'> = {
      playerId,
      currentQuestId: firstQuest._id,
      currentStepIndex: 0,
      completedQuests: [],
      completedSteps: [],
      skippedQuests: [],
      claimedRewards: [],
      tutorialSkipped: false,
      tutorialDeclined: false,
      tutorialComplete: false,
      startedAt: now,
      currentStepStartedAt: now,
      lastUpdated: now,
      totalStepsCompleted: 0,
      totalTimeSpent: 0,
    };
    
    console.log(`[Tutorial] Created progress for ${playerId}: Quest ${firstQuest._id}, Step ${firstStep.id}, currentStepStartedAt initialized`);
    
    const id = randomUUID().replace(/-/g, '').substring(0, 24);
    await db.insert(tutorialProgress).values({
      id,
      playerId: newProgress.playerId,
      currentQuestId: newProgress.currentQuestId,
      currentStepIndex: newProgress.currentStepIndex,
      completedQuests: newProgress.completedQuests,
      completedSteps: newProgress.completedSteps,
      skippedQuests: newProgress.skippedQuests,
      claimedRewards: newProgress.claimedRewards,
      tutorialSkipped: newProgress.tutorialSkipped ? 1 : 0,
      tutorialDeclined: newProgress.tutorialDeclined ? 1 : 0,
      tutorialComplete: newProgress.tutorialComplete ? 1 : 0,
      startedAt: newProgress.startedAt,
      currentStepStartedAt: newProgress.currentStepStartedAt,
      lastUpdated: newProgress.lastUpdated,
      totalStepsCompleted: newProgress.totalStepsCompleted,
      totalTimeSpent: newProgress.totalTimeSpent,
    });
    progress = { ...newProgress, _id: id as any };
    
    // Initialize action tracking for first step if it has a target count
    if (firstStep.validationData) {
      const { requiredMoves, requiredHarvests, requiredAttacks } = firstStep.validationData;
      const targetCount = requiredMoves || requiredHarvests || requiredAttacks;
      if (targetCount) {
        await updateActionTracking(playerId, firstStep.id, 0, targetCount);
      }
    }
  }
  
  return progress;
}

/**
 * Check if player should see tutorial
 * Based on level, completion status, and config
 */
export async function shouldShowTutorial(playerId: string, playerLevel: number): Promise<boolean> {
  const progress = await getTutorialProgress(playerId);
  const config = DEFAULT_TUTORIAL_CONFIG;
  
  if (!config.enabled) return false;
  if (progress.tutorialComplete || progress.tutorialSkipped) return false;
  if (playerLevel < config.minimumLevel || playerLevel > config.maximumLevel) return false;
  
  return true;
}

/**
 * Get current quest and step for player with real-time action tracking
 */
export async function getCurrentQuestAndStep(playerId: string): Promise<{
  quest: TutorialQuest | null;
  step: TutorialStep | null;
  progress: TutorialProgress;
}> {
  const progress = await getTutorialProgress(playerId);
  
  if (progress.tutorialDeclined) {
    return { quest: null, step: null, progress };
  }
  
  if (!progress.currentQuestId || progress.tutorialComplete) {
    return { quest: null, step: null, progress };
  }
  
  const quest = getTutorialQuest(progress.currentQuestId);
  if (!quest) {
    return { quest: null, step: null, progress };
  }
  
  const step = quest.steps[progress.currentStepIndex] || null;
  
  if (step && step.validationData) {
    const actionTracking = await getActionTracking(playerId, step.id);
    if (actionTracking) {
      step.validationData = {
        ...step.validationData,
        currentCount: actionTracking.currentCount,
        targetCount: actionTracking.targetCount,
      };
    }
  }
  
  return { quest, step, progress };
}

/**
 * Tutorial action tracking (for real-time progress)
 */
interface ActionTracking {
  playerId: string;
  stepId: string;
  currentCount: number;
  targetCount: number;
  lastUpdated: Date;
}

/**
 * Get action tracking for a step
 */
async function getActionTracking(playerId: string, stepId: string): Promise<ActionTracking | null> {
  const rows = await db.select().from(tutorialActionTracking).where(
    and(
      eq(tutorialActionTracking.playerId, playerId),
      eq(tutorialActionTracking.stepId, stepId)
    )
  ).limit(1);
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  const trackingData = row.actionType ? JSON.parse(row.actionType) : {};
  
  return {
    playerId: row.playerId,
    stepId: row.stepId,
    currentCount: trackingData.currentCount ?? 0,
    targetCount: trackingData.targetCount ?? 0,
    lastUpdated: row.lastUpdated,
  };
}

/**
 * Update action tracking for a step
 * Called when player performs actions (moves, harvests, etc.)
 */
export async function updateActionTracking(
  playerId: string,
  stepId: string,
  currentCount: number,
  targetCount: number
): Promise<void> {
  const trackingData = JSON.stringify({ currentCount, targetCount });
  
  const existing = await db.select().from(tutorialActionTracking).where(
    and(
      eq(tutorialActionTracking.playerId, playerId),
      eq(tutorialActionTracking.stepId, stepId)
    )
  ).limit(1);
  
  if (existing.length > 0) {
    await db.update(tutorialActionTracking).set({
      actionType: trackingData,
      lastUpdated: new Date(),
    }).where(
      and(
        eq(tutorialActionTracking.playerId, playerId),
        eq(tutorialActionTracking.stepId, stepId)
      )
    );
  } else {
    const id = randomUUID().replace(/-/g, '').substring(0, 24);
    await db.insert(tutorialActionTracking).values({
      id,
      playerId,
      stepId,
      actionType: trackingData,
      completed: 0,
      lastUpdated: new Date(),
    });
  }
}

/**
 * Clear action tracking for a step (when step is completed)
 */
export async function clearActionTracking(playerId: string, stepId: string): Promise<void> {
  await db.delete(tutorialActionTracking).where(
    and(
      eq(tutorialActionTracking.playerId, playerId),
      eq(tutorialActionTracking.stepId, stepId)
    )
  );
}

/**
 * Complete a tutorial step
 * Validates completion and awards rewards
 */
export async function completeStep(
  validationRequest: TutorialValidationRequest
): Promise<TutorialStepCompletionResult> {
  const { playerId, questId, stepId, validationData } = validationRequest;
  
  const progress = await getTutorialProgress(playerId);
  const quest = getTutorialQuest(questId);
  
  if (!quest) {
    return {
      success: false,
      stepId,
      message: 'Quest not found',
      questComplete: false,
      tutorialComplete: false,
      progress,
    };
  }
  
  const step = quest.steps.find(s => s.id === stepId);
  if (!step) {
    return {
      success: false,
      stepId,
      message: 'Step not found',
      questComplete: false,
      tutorialComplete: false,
      progress,
    };
  }
  
  const enrichedValidationData = validationData || {};
  
  if (step.action === 'CUSTOM') {
    const gameState = await getPlayerGameState(playerId);
    const stepValidation = step.validationData || {};
    
    switch (stepValidation.requirementType) {
      case 'metal_balance':
        enrichedValidationData.metalBalance = gameState.metalBalance;
        break;
      
      case 'energy_balance':
        enrichedValidationData.energyBalance = gameState.energyBalance;
        break;
      
      case 'factory_capture':
        const targetTier = stepValidation.tier || 'WEAK';
        const hasFactory = gameState.ownedFactories.some(f => f.tier === targetTier);
        const matchingFactory = gameState.ownedFactories.find(f => f.tier === targetTier);
        enrichedValidationData.hasFactory = hasFactory;
        enrichedValidationData.factoryTier = matchingFactory?.tier || null;
        break;
      
      case 'build_unit':
        const unitType = stepValidation.unitType || 'Infantry';
        const normalizedUnitType = unitType.toLowerCase();
        let unitCount = 0;
        
        for (const [type, count] of Object.entries(gameState.unitCounts)) {
          if (type.toLowerCase() === normalizedUnitType) {
            unitCount += count;
          }
        }
        
        enrichedValidationData.unitCount = unitCount;
        break;
    }
    
    console.log(`[Tutorial] Injected game state for CUSTOM action:`, enrichedValidationData);
  }
  
  const isValid = await validateStepAction(step, enrichedValidationData);
  if (!isValid) {
    return {
      success: false,
      stepId,
      message: 'Step validation failed',
      questComplete: false,
      tutorialComplete: false,
      progress,
    };
  }
  
  if (!progress.completedSteps.includes(stepId)) {
    progress.completedSteps.push(stepId);
    progress.totalStepsCompleted += 1;
  }
  
  await clearActionTracking(playerId, stepId);
  
  const allStepsComplete = quest.steps.every(s => progress.completedSteps.includes(s.id));
  const questComplete = allStepsComplete;
  
  if (questComplete && !progress.completedQuests.includes(questId)) {
    progress.completedQuests.push(questId);
  }
  
  const nextStepIndex = progress.currentStepIndex + 1;
  const now = new Date();
  
  if (nextStepIndex < quest.steps.length) {
    progress.currentStepIndex = nextStepIndex;
    progress.currentStepStartedAt = now;
    
    console.log(`[Tutorial] Advanced to step ${nextStepIndex} in quest ${questId}, reset currentStepStartedAt`);
  } else {
    const nextQuest = getNextQuest(questId);
    if (nextQuest) {
      progress.currentQuestId = nextQuest._id;
      progress.currentStepIndex = 0;
      progress.currentStepStartedAt = now;
      
      console.log(`[Tutorial] Quest ${questId} complete, advanced to quest ${nextQuest._id}, reset currentStepStartedAt`);
    } else {
      progress.tutorialComplete = true;
      progress.completedAt = now;
      progress.currentQuestId = undefined;
      progress.currentStepStartedAt = undefined;
      
      console.log(`[Tutorial] Tutorial complete for player ${playerId}, awarding completion package`);
      
      await awardTutorialCompletionPackage(playerId);
    }
  }
  
  progress.lastUpdated = now;
  
  await db.update(tutorialProgress).set({
    currentQuestId: progress.currentQuestId,
    currentStepIndex: progress.currentStepIndex,
    completedQuests: progress.completedQuests,
    completedSteps: progress.completedSteps,
    skippedQuests: progress.skippedQuests,
    claimedRewards: progress.claimedRewards,
    tutorialSkipped: progress.tutorialSkipped ? 1 : 0,
    tutorialDeclined: progress.tutorialDeclined ? 1 : 0,
    tutorialComplete: progress.tutorialComplete ? 1 : 0,
    startedAt: progress.startedAt,
    currentStepStartedAt: progress.currentStepStartedAt,
    completedAt: progress.completedAt,
    declinedAt: progress.declinedAt,
    lastUpdated: progress.lastUpdated,
    totalStepsCompleted: progress.totalStepsCompleted,
    totalTimeSpent: progress.totalTimeSpent,
  }).where(eq(tutorialProgress.playerId, playerId));
  
  const nextStep = quest.steps[nextStepIndex];
  if (nextStep && nextStep.validationData) {
    const { requiredMoves, requiredHarvests, requiredAttacks } = nextStep.validationData;
    const targetCount = requiredMoves || requiredHarvests || requiredAttacks;
    if (targetCount) {
      await updateActionTracking(playerId, nextStep.id, 0, targetCount);
    }
  }
  
  if (step.reward) {
    await awardTutorialReward(playerId, step.reward);
  }
  
  return {
    success: true,
    stepId,
    message: step.completionMessage || 'Step completed!',
    reward: step.reward,
    nextStep,
    questComplete,
    tutorialComplete: progress.tutorialComplete,
    progress,
  };
}

/**
 * Validate step action completion
 */
async function validateStepAction(
  step: TutorialStep,
  validationData?: Record<string, any>
): Promise<boolean> {
  if (!validationData) {
    if (step.action === 'READ_INFO' || step.action === 'COLLECT_REWARD') {
      return true;
    }
    return false;
  }

  switch (step.action) {
    case 'MOVE':
      return validateMoveAction(step, validationData);
    
    case 'MOVE_TO_COORDS':
      return validateMoveToCordsAction(step, validationData);
    
    case 'HARVEST':
      return validateHarvestAction(step, validationData);
    
    case 'ATTACK':
      return validateAttackAction(step, validationData);
    
    case 'OPEN_PANEL':
      return validateOpenPanelAction(step, validationData);
    
    case 'CUSTOM':
      return validateCustomAction(step, validationData);
    
    case 'READ_INFO':
    case 'COLLECT_REWARD':
      return true;
    
    default:
      return false;
  }
}

/**
 * Get player's current game state from database
 */
async function getPlayerGameState(playerId: string): Promise<PlayerGameStateValidation> {
  const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
  
  if (playerRows.length === 0) {
    console.error(`[Tutorial] Player ${playerId} not found in database`);
    return {
      metalBalance: 0,
      energyBalance: 0,
      ownedFactories: [],
      unitCounts: {},
    };
  }
  
  const player = playerRows[0];
  
  const ownedFactories = await db.select().from(factories).where(eq(factories.owner, playerId));
  
  const unitCounts: Record<string, number> = {};
  for (const f of ownedFactories) {
    const units = (f as any).units || [];
    for (const unit of units) {
      const unitType = unit.type || 'Unknown';
      unitCounts[unitType] = (unitCounts[unitType] || 0) + 1;
    }
  }
  
  return {
    metalBalance: Number(player.resourcesMetal || 0),
    energyBalance: Number(player.resourcesEnergy || 0),
    ownedFactories: ownedFactories.map(f => ({
      factoryId: `${f.x},${f.y}`,
      tier: (f as any).tier || 'WEAK',
      level: (f as any).level || 1,
      x: (f as any).x || 0,
      y: (f as any).y || 0,
    })),
    unitCounts,
  };
}

/**
 * Validate MOVE action
 */
function validateMoveAction(step: TutorialStep, validationData: Record<string, any>): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.requiredMoves) {
    const moveCount = validationData.moveCount || 0;
    if (moveCount < stepValidation.requiredMoves) {
      return false;
    }
  }
  
  if (stepValidation.direction && !stepValidation.anyDirection) {
    const direction = validationData.direction?.toLowerCase();
    const requiredDirection = stepValidation.direction.toLowerCase();
    
    if (direction !== requiredDirection) {
      return false;
    }
  }
  
  if (stepValidation.targetCoordinates) {
    const { x, y } = validationData;
    const { x: targetX, y: targetY, radius = 0 } = stepValidation.targetCoordinates;
    
    if (radius === 0) {
      if (x !== targetX || y !== targetY) {
        return false;
      }
    } else {
      const distance = Math.sqrt(Math.pow(x - targetX, 2) + Math.pow(y - targetY, 2));
      if (distance > radius) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Validate MOVE_TO_COORDS action
 */
function validateMoveToCordsAction(step: TutorialStep, validationData: Record<string, any>): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.targetX === undefined || stepValidation.targetY === undefined) {
    return false;
  }
  
  const playerX = validationData.targetX;
  const playerY = validationData.targetY;
  
  return playerX === stepValidation.targetX && playerY === stepValidation.targetY;
}

/**
 * Validate HARVEST action
 */
function validateHarvestAction(step: TutorialStep, validationData: Record<string, any>): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.requiredHarvests) {
    const harvestCount = validationData.harvestCount || 0;
    if (harvestCount < stepValidation.requiredHarvests) {
      return false;
    }
  }
  
  if (stepValidation.targetCoordinates) {
    const { x, y } = validationData;
    const { x: targetX, y: targetY, radius = 0 } = stepValidation.targetCoordinates;
    
    if (radius === 0) {
      if (x !== targetX || y !== targetY) {
        return false;
      }
    } else {
      const distance = Math.sqrt(Math.pow(x - targetX, 2) + Math.pow(y - targetY, 2));
      if (distance > radius) {
        return false;
      }
    }
  }
  
  if (stepValidation.resourceType) {
    const resourceType = validationData.resourceType?.toLowerCase();
    const requiredType = stepValidation.resourceType.toLowerCase();
    
    if (resourceType !== requiredType) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate ATTACK action
 */
function validateAttackAction(step: TutorialStep, validationData: Record<string, any>): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.requiredAttacks) {
    const attackCount = validationData.attackCount || 0;
    if (attackCount < stepValidation.requiredAttacks) {
      return false;
    }
  }
  
  if (stepValidation.targetType) {
    const targetType = validationData.targetType?.toLowerCase();
    const requiredType = stepValidation.targetType.toLowerCase();
    
    if (targetType !== requiredType) {
      return false;
    }
  }
  
  if (stepValidation.requireSuccess) {
    const success = validationData.success === true;
    if (!success) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate OPEN_PANEL action
 */
function validateOpenPanelAction(step: TutorialStep, validationData: Record<string, any>): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.panelName) {
    const panelName = validationData.panelName?.toLowerCase();
    const requiredPanel = stepValidation.panelName.toLowerCase();
    
    if (panelName !== requiredPanel) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate CUSTOM action
 */
function validateCustomAction(step: TutorialStep, validationData: Record<string, any>): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.requirementType) {
    switch (stepValidation.requirementType) {
      case 'metal_balance':
        return (validationData.metalBalance || 0) >= (stepValidation.targetAmount || 0);
      
      case 'energy_balance':
        return (validationData.energyBalance || 0) >= (stepValidation.targetAmount || 0);
      
      case 'factory_capture':
        return validationData.hasFactory === true && validationData.factoryTier === stepValidation.tier;
      
      case 'build_unit':
        return (validationData.unitCount || 0) >= (stepValidation.count || 0);
      
      case 'find_beer_base':
        return validationData.requirementMet === true;
      
      default:
        console.error(`[Tutorial] Unknown requirementType: ${stepValidation.requirementType}`);
        return false;
    }
  }
  
  return false;
}

/**
 * Award tutorial reward to player
 */
async function awardTutorialReward(playerId: string, reward: TutorialReward): Promise<void> {
  switch (reward.type) {
    case 'METAL':
      if (reward.amount) {
        const playerRows = await db.select({ resourcesMetal: players.resourcesMetal }).from(players).where(eq(players.username, playerId)).limit(1);
        if (playerRows.length > 0) {
          const currentMetal = Number(playerRows[0].resourcesMetal || 0);
          await db.update(players).set({
            resourcesMetal: Number(BigInt(currentMetal + reward.amount)),
          }).where(eq(players.username, playerId));
        }
      }
      break;
    
    case 'OIL':
      break;
    
    case 'EXPERIENCE':
      if (reward.amount) {
        const playerRows = await db.select({ xp: players.xp }).from(players).where(eq(players.username, playerId)).limit(1);
        if (playerRows.length > 0) {
          await db.update(players).set({
            xp: (playerRows[0].xp || 0) + reward.amount,
          }).where(eq(players.username, playerId));
        }
      }
      break;
    
    case 'ITEM':
      if (reward.itemId && reward.itemName) {
        if (reward.itemId === 'tutorial_universal_digger') {
          console.log(`[TutorialService] Awarding tutorial universal digger to player ${playerId}`);
          const result = await awardTutorialDiggerToPlayer(playerId as string);
          if (!result.success) {
            console.error(`[TutorialService] Failed to award tutorial digger: ${result.message}`);
          } else {
            console.log(`[TutorialService] Successfully awarded tutorial digger: ${result.message}`);
          }
        } else {
          const playerRows = await db.select({ inventoryItems: players.inventoryItems }).from(players).where(eq(players.username, playerId)).limit(1);
          if (playerRows.length > 0) {
            const items = playerRows[0].inventoryItems || [];
            const newItem: TutorialInventoryItem = {
              id: `${reward.itemId}_${Date.now()}`,
              itemId: reward.itemId,
              name: reward.itemName,
              acquiredAt: new Date(),
              source: 'tutorial',
            };
            items.push(newItem);
            await db.update(players).set({
              inventoryItems: items,
            }).where(eq(players.username, playerId));
          }
        }
      }
      break;
    
    case 'ACHIEVEMENT':
      if (reward.achievementId) {
        const playerRows = await db.select({ achievements: players.achievements }).from(players).where(eq(players.username, playerId)).limit(1);
        if (playerRows.length > 0) {
          const achievements = playerRows[0].achievements || [];
          const alreadyExists = achievements.some((a: any) => a.achievementId === reward.achievementId);
          if (!alreadyExists) {
            const achievement = {
              achievementId: reward.achievementId,
              unlockedAt: new Date(),
              source: 'tutorial',
            };
            achievements.push(achievement);
            await db.update(players).set({
              achievements,
            }).where(eq(players.username, playerId));
          }
        }
      }
      break;
    
    case 'UNLOCK_FEATURE':
      break;
  }
}

/**
 * Award tutorial completion package
 */
async function awardTutorialCompletionPackage(playerId: string): Promise<void> {
  const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
  if (playerRows.length === 0) {
    console.error(`[Tutorial] Player ${playerId} not found for completion package`);
    return;
  }
  
  const player = playerRows[0];
  const hasReferralCode = !!player.referredBy;
  const packageType = hasReferralCode ? 'FULL_WELCOME' : 'STARTER';
  
  const { getWelcomePackage, getStarterPackage } = await import('./referralService');
  const completionPackage = hasReferralCode ? getWelcomePackage() : getStarterPackage();
  
  console.log(`[Tutorial] Awarding ${packageType} package to ${player.username} (referral: ${hasReferralCode})`);
  
  const currentMetal = Number(player.resourcesMetal || 0);
  const currentEnergy = Number(player.resourcesEnergy || 0);
  const inventoryItems = player.inventoryItems || [];
  
  if (completionPackage.items && completionPackage.items.length > 0) {
    for (const item of completionPackage.items) {
      const newItem: TutorialInventoryItem = {
        id: `${item.id}_${Date.now()}`,
        itemId: item.id,
        name: item.name,
        type: item.type,
        quantity: item.quantity,
        acquiredAt: new Date(),
        source: 'tutorial_completion',
      };
      inventoryItems.push(newItem);
    }
  }
  
  const achievements = player.achievements || [];
  const alreadyExists = achievements.some((a: any) => a.achievementId === 'tutorial_completed');
  if (!alreadyExists) {
    const achievement = {
      id: `tutorial_complete_${Date.now()}`,
      achievementId: 'tutorial_completed',
      name: 'Welcome Aboard!',
      description: 'Completed the welcome tutorial',
      unlockedAt: new Date(),
      source: 'tutorial_completion',
      category: 'tutorial',
      rarity: 'common'
    };
    achievements.push(achievement);
  }
  
  await db.update(players).set({
    resourcesMetal: Number(BigInt(currentMetal + completionPackage.metal)),
    resourcesEnergy: Number(BigInt(currentEnergy + completionPackage.energy)),
    inventoryItems,
    achievements,
  }).where(eq(players.username, playerId));
  
  console.log(`[Tutorial] ${packageType} package awarded successfully:`, {
    metal: completionPackage.metal,
    energy: completionPackage.energy,
    items: completionPackage.items?.length || 0,
    xpBoost: completionPackage.xpBoostPercent ? `${completionPackage.xpBoostPercent}% for ${completionPackage.xpBoostDuration} days` : 'none',
    vip: completionPackage.vipTrialDays ? `${completionPackage.vipTrialDays} days` : 'none',
    achievement: 'tutorial_completed'
  });
}

/**
 * Skip tutorial (entire tutorial or specific quest)
 */
export async function skipTutorial(
  playerId: string,
  skipType: 'ENTIRE_TUTORIAL' | 'QUEST',
  questId?: string
): Promise<{ success: boolean; message: string }> {
  const progress = await getTutorialProgress(playerId);
  
  if (skipType === 'ENTIRE_TUTORIAL') {
    progress.tutorialSkipped = true;
    progress.tutorialComplete = true;
    progress.completedAt = new Date();
    progress.currentQuestId = undefined;
    
    await db.update(tutorialProgress).set({
      tutorialSkipped: 1,
      tutorialComplete: 1,
      completedAt: progress.completedAt,
      currentQuestId: null,
      lastUpdated: new Date(),
    }).where(eq(tutorialProgress.playerId, playerId));
    
    return { success: true, message: 'Tutorial skipped successfully' };
  }
  
  if (skipType === 'QUEST' && questId) {
    if (!progress.skippedQuests.includes(questId)) {
      progress.skippedQuests.push(questId);
    }
    
    const nextQuest = getNextQuest(questId);
    if (nextQuest) {
      progress.currentQuestId = nextQuest._id;
      progress.currentStepIndex = 0;
    } else {
      progress.tutorialComplete = true;
      progress.completedAt = new Date();
      progress.currentQuestId = undefined;
    }
    
    progress.lastUpdated = new Date();
    
    await db.update(tutorialProgress).set({
      skippedQuests: progress.skippedQuests,
      currentQuestId: progress.currentQuestId,
      currentStepIndex: progress.currentStepIndex,
      tutorialComplete: progress.tutorialComplete ? 1 : 0,
      completedAt: progress.completedAt,
      lastUpdated: progress.lastUpdated,
    }).where(eq(tutorialProgress.playerId, playerId));
    
    return { success: true, message: 'Quest skipped successfully' };
  }
  
  return { success: false, message: 'Invalid skip request' };
}

/**
 * Permanently decline the tutorial with 2-click confirmation
 */
export async function declineTutorial(
  playerId: string,
  confirmed: boolean
): Promise<{ success: boolean; message: string }> {
  if (!confirmed) {
    return { 
      success: false, 
      message: 'Decline requires confirmation. Please confirm you understand all rewards will be forfeited.' 
    };
  }

  const progress = await getTutorialProgress(playerId);
  
  if (progress.tutorialDeclined) {
    return { 
      success: false, 
      message: 'Tutorial already declined' 
    };
  }

  if (progress.tutorialComplete) {
    return { 
      success: false, 
      message: 'Tutorial already completed. Cannot decline.' 
    };
  }

  const now = new Date();

  progress.tutorialDeclined = true;
  progress.declinedAt = now;
  progress.tutorialComplete = false;
  progress.currentQuestId = undefined;
  progress.currentStepIndex = 0;
  progress.currentStepStartedAt = undefined;
  progress.lastUpdated = now;

  await db.update(tutorialProgress).set({
    tutorialDeclined: 1,
    declinedAt: now,
    tutorialComplete: 0,
    currentQuestId: null,
    currentStepIndex: 0,
    currentStepStartedAt: null,
    lastUpdated: now,
  }).where(eq(tutorialProgress.playerId, playerId));

  console.log(`[Tutorial] Player ${playerId} permanently declined tutorial. No rewards awarded.`);

  return { 
    success: true, 
    message: 'Tutorial declined. All rewards forfeited. You can now explore the game on your own.' 
  };
}
