/**
 * Tutorial Service
 * Created: 2025-10-25
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * Feature: FID-20251025-101 - Interactive Tutorial Quest System
 * 
 * OVERVIEW:
 * Core service managing the interactive tutorial system including quest chains,
 * progress tracking, step validation, and reward distribution.
 * 
 * RESPONSIBILITIES:
 * - Quest chain definitions and management
 * - Player progress tracking in Supabase tutorial_progress table
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

import { createServiceClient } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/types/database';
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
import { awardTutorialDiggerToPlayer } from './caveItemService';

type TutorialProgressRow = Tables<'tutorial_progress'>;
type PlayerRow = Tables<'players'>;
type FactoryRow = Tables<'factories'>;
type PlayerUnitRow = Tables<'player_units'>;
type TutorialAnalyticsRow = Tables<'tutorial_analytics'>;

function getSupabase() {
  return createServiceClient();
}

/**
 * Initialize tutorial service (no-op for Supabase — kept for backward compatibility).
 * Previously accepted MongoDB client and db instances. Now ignores all arguments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function initializeTutorialService(..._args: any[]): void {
  // Supabase client is created on demand via createServiceClient().
  // This function exists only for backward compatibility with existing API routes.
}

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
          amount: 25000,
          displayMessage: 'Shrine Discovery: 25,000 Metal!',
        },
      },
      {
        id: 'movement_navigate_to_metal_bank',
        order: 2,
        title: 'Visit the Metal Bank',
        instruction: 'Navigate to the Metal Bank at (38, 38)!',
        detailedHelp: `🎯 WHY: The Metal Bank protects your Metal from enemy raids! Stored resources are 100% safe.

🕐 WHEN TO USE:
• Before logging off to keep resources safe
• After big harvests or successful raids
• When preparing for risky battles (protect your wealth first!)

⚡ HOW TO USE:
• Navigate to coordinates (38, 38)
• Click "Bank" button to deposit/withdraw Metal
• Withdraw anytime - no fees, instant access!

💡 PRO TIP: Always bank your resources before going AFK to prevent raids from taking your hard-earned Metal!`,
        action: 'MOVE_TO_COORDS',
        targetElement: '.movement-controls',
        validationData: { 
          targetX: 38,
          targetY: 38,
          locationName: 'Metal Bank'
        },
        completionMessage: 'Found the Metal Bank! Store your Metal here to protect it.',
        difficulty: 'EASY',
        estimatedSeconds: 30,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 15000,
          displayMessage: 'You earned 15,000 Metal for finding the Metal Bank!',
        },
      },
      {
        id: 'movement_navigate_to_exchange',
        order: 3,
        title: 'Visit the Exchange',
        instruction: 'Navigate to the Exchange at (38, 112)!',
        detailedHelp: `🎯 WHY: The Exchange is your resource conversion hub! Convert Metal ↔️ Energy with a 20% fee.

🕐 WHEN TO USE:
• When you have excess Metal but need Energy (or vice versa)
• To balance your resource stockpiles
• Before building units that require different resources

⚡ HOW TO USE:
• Navigate to coordinates (38, 112)
• Click "Exchange" button to see current rates
• Trade Metal for Energy or Energy for Metal
• Pay 20% conversion fee (e.g., 100 Metal → 80 Energy)

💡 PRO TIP: Plan conversions carefully - the 20% fee adds up! Only convert when you really need the other resource.`,
        action: 'MOVE_TO_COORDS',
        targetElement: '.movement-controls',
        validationData: { 
          targetX: 38,
          targetY: 112,
          locationName: 'Exchange Bank'
        },
        completionMessage: 'Found the Exchange! You can convert Metal ↔ Energy here with a 20% fee.',
        difficulty: 'EASY',
        estimatedSeconds: 30,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 12000,
          displayMessage: 'You earned 12,000 Metal for finding the Exchange!',
        },
      },
      {
        id: 'movement_navigate_to_energy_bank',
        order: 4,
        title: 'Visit the Energy Bank',
        instruction: 'Navigate to the Energy Bank at (112, 38)!',
        detailedHelp: `🎯 WHY: The Energy Bank protects your Energy from raids! Just like Metal Bank but for Energy.

🕐 WHEN TO USE:
• After harvesting Energy from caves
• Before risky PvP battles
• When going offline/AFK
• After trading at the Exchange

⚡ HOW TO USE:
• Navigate to coordinates (112, 38)
• Click "Bank" button for deposit/withdraw
• No fees, instant access, 100% raid protection

💡 PRO TIP: Energy is precious! Always bank it immediately after harvest. Other players WILL raid you if they see high Energy counts!`,
        action: 'MOVE_TO_COORDS',
        targetElement: '.movement-controls',
        validationData: { 
          targetX: 112,
          targetY: 38,
          locationName: 'Energy Bank'
        },
        completionMessage: 'Found the Energy Bank! Keep your Energy safe here.',
        difficulty: 'EASY',
        estimatedSeconds: 30,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 10000,
          displayMessage: 'You earned 10,000 Metal for finding the Energy Bank!',
        },
      },
      {
        id: 'movement_navigate_to_auction',
        order: 5,
        title: 'Explore the Far Corner',
        instruction: 'Navigate to the Auction House at (10, 10)!',
        detailedHelp: `🎯 WHY: Exploring distant landmarks helps you understand the map layout!

🕐 WHEN TO USE:
• When scouting for remote resources
• Looking for less-contested areas
• Planning your expansion strategy

⚡ HOW TO EXPLORE:
• Navigate to coordinates (10, 10)
• Use WASD, Arrow Keys, or Numpad to move
• Notice how terrain changes in different regions
• Remote areas often have better resources!

💡 PRO TIP: The corners and edges of the map are often less crowded. Remote caves can be harvested safely while you grow stronger!`,
        action: 'MOVE_TO_COORDS',
        targetElement: '.movement-controls',
        validationData: { 
          targetX: 10,
          targetY: 10,
          locationName: 'Auction House'
        },
        completionMessage: 'You explored the Auction House area! Keep exploring to find hidden treasures.',
        difficulty: 'EASY',
        estimatedSeconds: 40,
        skipAllowed: true,
        reward: {
          type: 'METAL',
          amount: 8000,
          displayMessage: 'You earned 8,000 Metal for exploring!',
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
          amount: 5000,
          displayMessage: 'You earned 5,000 Metal for mastering movement!',
        },
      },
    ],
    completionReward: {
      type: 'ACHIEVEMENT',
      achievementId: 'tutorial_movement_complete',
      displayMessage: 'Achievement Unlocked: Navigator! +50,000 Metal bonus!',
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
      amount: 50000,
      displayMessage: 'Resource Management Complete! +50,000 Metal bonus!',
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
          amount: 5000,
          displayMessage: '+5,000 XP! You\'re getting stronger!',
        },
      },
    ],
    completionReward: {
      type: 'ACHIEVEMENT',
      achievementId: 'tutorial_first_battle',
      displayMessage: 'Achievement Unlocked: Warrior! +75,000 Metal!',
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
      amount: 30000,
      displayMessage: 'Social Exploration Complete! +30,000 Metal!',
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
      type: 'ENERGY',
      amount: 25000,
      displayMessage: 'Tech Tree Explored! +25,000 Energy!',
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
          displayMessage: 'Starter Pack: 100,000 Metal, 75,000 Energy, 10 Random Items!',
        },
      },
    ],
    completionReward: {
      type: 'ACHIEVEMENT',
      achievementId: 'tutorial_master',
      displayMessage: 'Achievement Unlocked: Tutorial Master! +100,000 Metal & +50% bonus to all starter rewards!',
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
  return TUTORIAL_QUESTS.find(q => q._id === questId || q.id === questId) || null;
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
 * Maps a TutorialProgressRow from Supabase to the TutorialProgress type.
 */
function rowToProgress(row: TutorialProgressRow): TutorialProgress {
  return {
    playerId: row.player_username,
    currentQuestId: row.current_quest_id || undefined,
    currentStepIndex: row.current_step_index,
    completedQuests: row.completed_quests || [],
    completedSteps: row.completed_steps || [],
    skippedQuests: row.skipped_quests || [],
    claimedRewards: row.claimed_rewards || [],
    tutorialSkipped: row.tutorial_skipped || false,
    tutorialDeclined: row.tutorial_declined || false,
    tutorialComplete: row.tutorial_complete || false,
    startedAt: row.started_at ? new Date(row.started_at) : new Date(),
    currentStepStartedAt: row.current_step_started_at ? new Date(row.current_step_started_at) : undefined,
    lastUpdated: new Date(row.last_updated),
    totalStepsCompleted: row.total_steps_completed || 0,
    totalTimeSpent: row.total_time_spent || 0,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    declinedAt: row.declined_at ? new Date(row.declined_at) : undefined,
  };
}

/**
 * Builds a TutorialProgressRow Insert object from a TutorialProgress.
 */
function progressToInsert(progress: TutorialProgress): TablesInsert<'tutorial_progress'> {
  return {
    player_username: progress.playerId,
    current_quest_id: progress.currentQuestId || null,
    current_step_index: progress.currentStepIndex,
    current_step_started_at: progress.currentStepStartedAt?.toISOString() || null,
    completed_quests: progress.completedQuests,
    completed_steps: progress.completedSteps,
    skipped_quests: progress.skippedQuests,
    claimed_rewards: progress.claimedRewards,
    tutorial_skipped: progress.tutorialSkipped,
    tutorial_declined: progress.tutorialDeclined,
    tutorial_complete: progress.tutorialComplete,
    started_at: progress.startedAt.toISOString(),
    last_updated: progress.lastUpdated.toISOString(),
    total_steps_completed: progress.totalStepsCompleted,
    total_time_spent: progress.totalTimeSpent,
    completed_at: progress.completedAt?.toISOString() || null,
    declined_at: progress.declinedAt?.toISOString() || null,
  };
}

/**
 * Get player's tutorial progress
 * Creates initial progress if player is new
 */
export async function getTutorialProgress(playerId: string): Promise<TutorialProgress> {
  const supabase = getSupabase();
  
  const { data: row, error } = await supabase
    .from('tutorial_progress')
    .select('*')
    .eq('player_username', playerId)
    .single();

  const progress: TutorialProgress | null = row && !error ? rowToProgress(row) : null;
  
  // Block tutorial restart if permanently declined
  if (progress && progress.tutorialDeclined) {
    console.log(`[Tutorial] Player ${playerId} previously declined tutorial. Restart blocked.`);
    return progress;
  }
  
  if (!progress) {
    const firstQuest = TUTORIAL_QUESTS[0];
    const firstStep = firstQuest.steps[0];
    
    const now = new Date();
    const newProgress: TutorialProgress = {
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
    
    console.log(`[Tutorial] Created progress for ${playerId}: Quest ${firstQuest._id}, Step ${firstStep.id}`);

    const insertRow = progressToInsert(newProgress);
    const { data: insertedRow, error: insertError } = await supabase
      .from('tutorial_progress')
      .insert(insertRow)
      .select('*')
      .single();

    if (insertError || !insertedRow) {
      throw new Error('Failed to create tutorial progress');
    }

    const createdProgress = rowToProgress(insertedRow);
    
    if (firstStep.validationData) {
      const { requiredMoves, requiredHarvests, requiredAttacks } = firstStep.validationData;
      const targetCount = requiredMoves || requiredHarvests || requiredAttacks;
      if (targetCount) {
        await updateActionTracking(playerId, firstStep.id, 0, targetCount);
      }
    }
    
    return createdProgress;
  }
  
  return progress;
}

/**
 * Check if player should see tutorial
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
 * Stores tracking data as a JSON blob in bot_config or similar.
 * Since there's no dedicated tutorial_action_tracking table in Supabase,
 * we use an in-memory + bot_config hybrid approach.
 */
const actionTrackingCache = new Map<string, ActionTracking>();

export async function getActionTracking(playerId: string, stepId: string): Promise<ActionTracking | null> {
  const key = `${playerId}:${stepId}`;
  const cached = actionTrackingCache.get(key);
  if (cached) return cached;

  const supabase = getSupabase();
  const { data } = await supabase
    .from('tutorial_action_tracking')
    .select('current_count, target_count, last_updated')
    .eq('player_username', playerId)
    .eq('step_id', stepId)
    .maybeSingle();

  if (data) {
    const tracking: ActionTracking = {
      playerId,
      stepId,
      currentCount: data.current_count || 0,
      targetCount: data.target_count || 0,
      lastUpdated: new Date(data.last_updated || Date.now()),
    };
    actionTrackingCache.set(key, tracking);
    return tracking;
  }

  return null;
}

/**
 * Update action tracking for a step
 */
export async function updateActionTracking(
  playerId: string,
  stepId: string,
  currentCount: number,
  targetCount: number
): Promise<void> {
  const key = `${playerId}:${stepId}`;
  const tracking: ActionTracking = {
    playerId,
    stepId,
    currentCount,
    targetCount,
    lastUpdated: new Date(),
  };
  actionTrackingCache.set(key, tracking);

  const supabase = getSupabase();
  await supabase
    .from('tutorial_action_tracking')
    .upsert({
      player_username: playerId,
      step_id: stepId,
      current_count: currentCount,
      target_count: targetCount,
      last_updated: tracking.lastUpdated.toISOString(),
    });
}

/**
 * Clear action tracking for a step
 */
export async function clearActionTracking(playerId: string, stepId: string): Promise<void> {
  const key = `${playerId}:${stepId}`;
  actionTrackingCache.delete(key);

  const supabase = getSupabase();
  await supabase
    .from('tutorial_action_tracking')
    .delete()
    .eq('player_username', playerId)
    .eq('step_id', stepId);
}

/**
 * Complete a tutorial step
 */
export async function completeStep(
  validationRequest: TutorialValidationRequest
): Promise<TutorialStepCompletionResult> {
  const { playerId, questId, stepId, validationData } = validationRequest;
  const supabase = getSupabase();
  
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
  
  let enrichedValidationData = validationData || {};

  // Enrich MOVE_TO_COORDS validation with actual player position from database
  if (step.action === 'MOVE_TO_COORDS') {
    const { data: player } = await supabase
      .from('players')
      .select('current_x, current_y')
      .eq('username', playerId)
      .maybeSingle();

    if (player) {
      enrichedValidationData = {
        ...enrichedValidationData,
        targetX: player.current_x || 0,
        targetY: player.current_y || 0,
      };
    }
  }

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
        
        // Map blueprint IDs to DB enum values for lookup
        const BLUEPRINT_TO_DB: Record<string, string> = {
          infantry: 'T1_RIFLEMAN', militia: 'T1_RIFLEMAN', rifleman: 'T1_RIFLEMAN',
          scout: 'T1_SCOUT', saboteur: 'T1_SCOUT',
          grenadier: 'T1_GRENADIER', sniper: 'T1_SNIPER', marksman: 'T1_SNIPER',
          commando: 'T2_COMMANDO', tank: 'T2_COMMANDO',
          bomber: 'T2_DEMOLISHER', bombardier: 'T2_DEMOLISHER',
          artillery: 'T2_CANNON', gunship: 'T3_RAIDER',
          juggernaut: 'T3_STRIKER', warlord: 'T3_WARLORD',
          titan: 'T4_TITAN', dreadnought: 'T4_DREADNOUGHT', annihilator: 'T4_ANNIHILATOR',
          barricade: 'T1_BARRIER', watchman: 'T1_BARRIER',
          palisade: 'T1_BUNKER', trench: 'T1_BUNKER', wall: 'T1_BUNKER', bunker: 'T1_BUNKER',
          turret: 'T1_TURRET', pillbox: 'T1_TURRET',
          rampart: 'T2_BARRICADE', fortress: 'T2_FORTRESS',
          sentinel: 'T2_SENTINEL', sentinel_prime: 'T2_SENTINEL',
          aegis: 'T1_SHIELD', guardian: 'T3_GUARDIAN', guardian_array: 'T3_GUARDIAN',
          citadel: 'T3_CITADEL', stronghold: 'T4_STRONGHOLD',
          colossus: 'T4_COLOSSUS', bastion: 'T5_BASTION', invincible: 'T5_IMMORTAL',
        };
        const dbUnitType = BLUEPRINT_TO_DB[normalizedUnitType] || unitType.toUpperCase();
        let unitCount = 0;
        
        for (const [type, count] of Object.entries(gameState.unitCounts)) {
          if (type === dbUnitType) {
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
  
  const updateRow = progressToInsert(progress);
  await supabase
    .from('tutorial_progress')
    .update(updateRow)
    .eq('player_username', playerId);
  
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
  validationData?: Record<string, unknown>
): Promise<boolean> {
  if (!validationData) {
    if (step.action === 'READ_INFO' || step.action === 'COLLECT_REWARD') {
      return true;
    }
    return false;
  }

  switch (step.action) {
    case 'MOVE':
      return validateMoveAction(step, validationData as Record<string, number | string | boolean>);
    
    case 'MOVE_TO_COORDS':
      return validateMoveToCoordsAction(step, validationData as Record<string, number | string | boolean>);
    
    case 'HARVEST':
      return validateHarvestAction(step, validationData as Record<string, number | string | boolean>);
    
    case 'ATTACK':
      return validateAttackAction(step, validationData as Record<string, number | string | boolean>);
    
    case 'OPEN_PANEL':
      return validateOpenPanelAction(step, validationData as Record<string, number | string | boolean>);
    
    case 'CUSTOM':
      return validateCustomAction(step, validationData as Record<string, number | string | boolean>);
    
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
  const supabase = getSupabase();
  
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('username, resources_metal, resources_energy')
    .eq('username', playerId)
    .single();
  
  if (playerErr || !player) {
    console.error(`[Tutorial] Player ${playerId} not found in database`);
    return {
      metalBalance: 0,
      energyBalance: 0,
      ownedFactories: [],
      unitCounts: {},
    };
  }
  
  const { data: ownedFactories, error: factoryErr } = await supabase
    .from('factories')
    .select('*')
    .eq('owner', playerId);

  let factoriesList: { factoryId: string; tier: string; level: number; x: number; y: number }[] = [];
  if (!factoryErr && ownedFactories) {
    factoriesList = (ownedFactories as FactoryRow[]).map(f => ({
      factoryId: f.id,
      tier: String(f.level || 1),
      level: f.level,
      x: f.x || 0,
      y: f.y || 0,
    }));
  }

  const { data: playerUnits, error: unitsErr } = await supabase
    .from('player_units')
    .select('*')
    .eq('player_username', playerId);

  const unitCounts: Record<string, number> = {};
  if (!unitsErr && playerUnits) {
    for (const unit of (playerUnits as PlayerUnitRow[])) {
      const unitType = unit.unit_type || 'Unknown';
      unitCounts[unitType] = (unitCounts[unitType] || 0) + (unit.quantity || 0);
    }
  }
  
  return {
    metalBalance: player.resources_metal,
    energyBalance: player.resources_energy,
    ownedFactories: factoriesList,
    unitCounts,
  };
}

/**
 * Validate MOVE action
 */
function validateMoveAction(
  step: TutorialStep,
  validationData: Record<string, number | string | boolean>
): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.requiredMoves) {
    const moveCount = (validationData.moveCount as number) || (validationData.currentCount as number) || 0;
    if (moveCount < stepValidation.requiredMoves) {
      return false;
    }
  }
  
  if (stepValidation.direction && !stepValidation.anyDirection) {
    const direction = String(validationData.direction || '').toLowerCase();
    const requiredDirection = stepValidation.direction.toLowerCase();
    
    if (direction !== requiredDirection) {
      return false;
    }
  }
  
  if (stepValidation.targetCoordinates) {
    const x = Number(validationData.x) || 0;
    const y = Number(validationData.y) || 0;
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
function validateMoveToCoordsAction(
  step: TutorialStep,
  validationData: Record<string, number | string | boolean>
): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.targetX === undefined || stepValidation.targetY === undefined) {
    return false;
  }
  
  const playerX = Number(validationData.targetX) || 0;
  const playerY = Number(validationData.targetY) || 0;
  
  return playerX === stepValidation.targetX && playerY === stepValidation.targetY;
}

/**
 * Validate HARVEST action
 */
function validateHarvestAction(
  step: TutorialStep,
  validationData: Record<string, number | string | boolean>
): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.requiredHarvests) {
    const harvestCount = (validationData.harvestCount as number) || 0;
    if (harvestCount < stepValidation.requiredHarvests) {
      return false;
    }
  }
  
  if (stepValidation.targetCoordinates) {
    const x = Number(validationData.x) || 0;
    const y = Number(validationData.y) || 0;
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
    const resourceType = String(validationData.resourceType || '').toLowerCase();
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
function validateAttackAction(
  step: TutorialStep,
  validationData: Record<string, number | string | boolean>
): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.requiredAttacks) {
    const attackCount = (validationData.attackCount as number) || 0;
    if (attackCount < stepValidation.requiredAttacks) {
      return false;
    }
  }
  
  if (stepValidation.targetType) {
    const targetType = String(validationData.targetType || '').toLowerCase();
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
function validateOpenPanelAction(
  step: TutorialStep,
  validationData: Record<string, number | string | boolean>
): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.panelName) {
    const panelName = String(validationData.panelName || '').toLowerCase();
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
function validateCustomAction(
  step: TutorialStep,
  validationData: Record<string, number | string | boolean>
): boolean {
  const stepValidation = step.validationData || {};
  
  if (stepValidation.requirementType) {
    switch (stepValidation.requirementType) {
      case 'metal_balance':
        return ((validationData.metalBalance as number) || 0) >= (stepValidation.targetAmount || 0);
      
      case 'energy_balance':
        return ((validationData.energyBalance as number) || 0) >= (stepValidation.targetAmount || 0);
      
      case 'factory_capture':
        return validationData.hasFactory === true && validationData.factoryTier === stepValidation.tier;
      
      case 'build_unit':
        return ((validationData.unitCount as number) || 0) >= (stepValidation.count || 0);
      
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
  const supabase = getSupabase();
  
  switch (reward.type) {
    case 'METAL':
      if (reward.amount) {
        const { data: player } = await supabase
          .from('players')
          .select('resources_metal')
          .eq('username', playerId)
          .single();
        const currentMetal = player?.resources_metal || 0;
        await supabase
          .from('players')
          .update({ resources_metal: currentMetal + reward.amount })
          .eq('username', playerId);
      }
      break;
    
    case 'OIL':
      // OIL is legacy alias for ENERGY
      if (reward.amount) {
        const { data: p } = await supabase
          .from('players').select('resources_energy').eq('username', playerId).single();
        await supabase
          .from('players')
          .update({ resources_energy: (p?.resources_energy || 0) + reward.amount })
          .eq('username', playerId);
      }
      break;

    case 'ENERGY':
      if (reward.amount) {
        const { data: p } = await supabase
          .from('players').select('resources_energy').eq('username', playerId).single();
        await supabase
          .from('players')
          .update({ resources_energy: (p?.resources_energy || 0) + reward.amount })
          .eq('username', playerId);
      }
      break;
    
    case 'EXPERIENCE':
      if (reward.amount) {
        const { data: player } = await supabase
          .from('players')
          .select('xp')
          .eq('username', playerId)
          .single();
        const currentXp = player?.xp || 0;
        await supabase
          .from('players')
          .update({ xp: currentXp + reward.amount })
          .eq('username', playerId);
      }
      break;
    
    case 'ITEM':
      if (reward.itemId && reward.itemName) {
        if (reward.itemId === 'tutorial_universal_digger') {
          console.log(`[TutorialService] Awarding tutorial universal digger to player ${playerId}`);
          const result = await awardTutorialDiggerToPlayer(playerId);
          if (!result.success) {
            console.error(`[TutorialService] Failed to award tutorial digger: ${result.message}`);
          } else {
            console.log(`[TutorialService] Successfully awarded tutorial digger: ${result.message}`);
          }
        } else {
          const newItem: TablesInsert<'player_inventory'> = {
            player_username: playerId,
            item_id: reward.itemId,
            name: reward.itemName,
            item_type: 'TRADEABLE_ITEM',
            rarity: 'COMMON',
            found_date: new Date().toISOString(),
          };
          await supabase.from('player_inventory').insert(newItem);
        }
      }
      break;
    
    case 'ACHIEVEMENT':
      if (reward.achievementId) {
        const achievement: TablesInsert<'player_achievements'> = {
          player_username: playerId,
          achievement_id: reward.achievementId,
          name: 'Tutorial Achievement',
          category: 'progression',
          rarity: 'common',
        };
        await supabase.from('player_achievements').insert(achievement);
      }
      break;
    
    case 'UNLOCK_FEATURE':
      if (reward.featureId) {
        console.log(`[TutorialService] Feature unlock ${reward.featureId} handled client-side`);
      }
      break;
  }
}

/**
 * Award tutorial completion package
 */
async function awardTutorialCompletionPackage(playerId: string): Promise<void> {
  const supabase = getSupabase();
  
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('*')
    .eq('username', playerId)
    .single();
  if (playerErr || !player) {
    console.error(`[Tutorial] Player ${playerId} not found for completion package`);
    return;
  }
  
  const hasReferralCode = !!player.referred_by;
  const packageType = hasReferralCode ? 'FULL_WELCOME' : 'STARTER';
  
  const { getWelcomePackage, getStarterPackage } = await import('./referralService');
  const completionPackage = hasReferralCode ? getWelcomePackage() : getStarterPackage();
  
  console.log(`[Tutorial] Awarding ${packageType} package to ${player.username} (referral: ${hasReferralCode})`);
  
  const currentMetal = player.resources_metal || 0;
  const currentEnergy = player.resources_energy || 0;
  
  await supabase
    .from('players')
    .update({
      resources_metal: currentMetal + completionPackage.metal,
      resources_energy: currentEnergy + completionPackage.energy,
    })
    .eq('username', playerId);
  
  console.log(`[Tutorial] ${packageType} package awarded successfully:`, {
    metal: completionPackage.metal,
    energy: completionPackage.energy,
    items: completionPackage.items?.length || 0,
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
  const supabase = getSupabase();
  const progress = await getTutorialProgress(playerId);
  
  if (skipType === 'ENTIRE_TUTORIAL') {
    progress.tutorialSkipped = true;
    progress.tutorialComplete = true;
    progress.completedAt = new Date();
    progress.currentQuestId = undefined;
    
    const updateRow = progressToInsert(progress);
    await supabase
      .from('tutorial_progress')
      .update(updateRow)
      .eq('player_username', playerId);
    
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
    
    const updateRow = progressToInsert(progress);
    await supabase
      .from('tutorial_progress')
      .update(updateRow)
      .eq('player_username', playerId);
    
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

  const supabase = getSupabase();
  
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

  const updateRow = progressToInsert(progress);
  await supabase
    .from('tutorial_progress')
    .update(updateRow)
    .eq('player_username', playerId);

  const analyticsInsert: TablesInsert<'tutorial_analytics'> = {
    player_username: playerId,
    event_type: 'DECLINED',
    quest_id: progress.currentQuestId || null,
    step_id: null,
    time_spent: progress.totalTimeSpent,
    created_at: now.toISOString(),
    metadata: {
      hadReferral: false,
      levelAtDecline: 1,
    },
  };
  await supabase.from('tutorial_analytics').insert(analyticsInsert);

  console.log(`[Tutorial] Player ${playerId} permanently declined tutorial. No rewards awarded.`);

  return { 
    success: true, 
    message: 'Tutorial declined. All rewards forfeited. You can now explore the game on your own.' 
  };
}
