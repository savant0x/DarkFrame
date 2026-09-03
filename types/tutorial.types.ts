/**
 * Tutorial System Type Definitions
 * Created: 2025-10-25
 * Feature: FID-20251025-101 - Interactive Tutorial Quest System
 * 
 * OVERVIEW:
 * Comprehensive type definitions for the interactive tutorial system including
 * quest chains, progress tracking, UI states, and reward structures.
 * 
 * QUEST CHAIN STRUCTURE:
 * - 15-20 progressive quests guiding players through core mechanics
 * - Each quest has multiple steps with validation and rewards
 * - UI highlighting targets specific elements for user guidance
 * 
 * PROGRESS TRACKING:
 * - Per-player tutorial state stored in MongoDB
 * - Step-by-step completion tracking
 * - Reward claiming and skip functionality
 */

import type { ObjectId } from 'mongodb';

/**
 * Tutorial quest step action types
 * Defines what the player needs to do to complete a step
 */
export type TutorialStepAction =
  | 'MOVE'           // Move to specific coordinates
  | 'MOVE_TO_COORDS' // Navigate to dynamically generated target coordinates
  | 'HARVEST'        // Harvest from a cave/resource
  | 'ATTACK'         // Attack an enemy/Beer Base
  | 'JOIN_CLAN'      // Join or create a clan
  | 'RESEARCH'       // Complete a research
  | 'CLICK_BUTTON'   // Click a specific UI element
  | 'OPEN_PANEL'     // Open a specific game panel
  | 'COLLECT_REWARD' // Claim a reward
  | 'READ_INFO'      // Read information (auto-complete after delay)
  | 'CUSTOM';        // Custom validation logic

/**
 * Tutorial quest step difficulty
 */
export type TutorialStepDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * Tutorial quest category
 * Helps organize quests thematically
 */
export type TutorialQuestCategory =
  | 'MOVEMENT'      // Basic navigation
  | 'COMBAT'        // Fighting mechanics
  | 'ECONOMY'       // Resources and harvesting
  | 'SOCIAL'        // Clans and community
  | 'PROGRESSION'   // Leveling and research
  | 'UI_NAVIGATION' // Interface familiarity
  | 'ENDGAME';      // Advanced features

/**
 * Reward type for quest completion
 */
export type TutorialRewardType =
  | 'METAL'
  | 'OIL'
  | 'ITEM'
  | 'ACHIEVEMENT'
  | 'EXPERIENCE'
  | 'UNLOCK_FEATURE';

/**
 * Individual tutorial quest step
 * Represents a single action the player must complete
 */
export interface TutorialStep {
  id: string;                    // Unique step ID (e.g., "movement_step_1")
  order: number;                 // Sequence in quest (0-indexed)
  title: string;                 // Short step name (e.g., "Move North")
  instruction: string;           // Player-facing instruction (e.g., "Press W to move north")
  detailedHelp?: string;         // Optional extended explanation
  action: TutorialStepAction;    // What action triggers completion
  targetElement?: string;        // CSS selector for UI highlighting (e.g., ".movement-controls")
  targetCoordinates?: {          // For MOVE actions
    x: number;
    y: number;
    radius?: number;             // Acceptable distance (default: 0 = exact match)
  };
  validationData?: Record<string, any>; // Custom validation parameters
  completionMessage?: string;    // Success message on completion
  reward?: TutorialReward;       // Optional step reward
  difficulty: TutorialStepDifficulty;
  estimatedSeconds: number;      // Expected completion time
  skipAllowed: boolean;          // Can player skip this step?
  autoComplete?: boolean;        // Auto-complete after reading (for READ_INFO)
  autoCompleteDelay?: number;    // Delay in ms before auto-complete
}

/**
 * Tutorial quest definition
 * Represents a complete quest chain (e.g., "Movement Basics")
 */
export interface TutorialQuest {
  _id?: string;                  // Quest ID (e.g., "quest_movement_basics")
  title: string;                 // Quest name (e.g., "Movement Basics")
  description: string;           // Quest summary
  category: TutorialQuestCategory;
  order: number;                 // Sequence in overall tutorial (0-indexed)
  icon?: string;                 // Icon name from lucide-react
  prerequisiteQuests?: string[]; // Quest IDs that must be complete first
  steps: TutorialStep[];         // Ordered steps in this quest
  completionReward: TutorialReward; // Reward for completing entire quest
  isOptional: boolean;           // Can be skipped without penalty
  estimatedMinutes: number;      // Total expected completion time
  unlocks?: string[];            // Feature IDs unlocked on completion
}

/**
 * Tutorial reward structure
 */
export interface TutorialReward {
  type: TutorialRewardType;
  amount?: number;               // For METAL, OIL, EXPERIENCE
  itemId?: string;               // For ITEM rewards
  itemName?: string;             // Display name for item
  achievementId?: string;        // For ACHIEVEMENT rewards
  featureId?: string;            // For UNLOCK_FEATURE rewards
  displayMessage?: string;       // Custom reward message
}

/**
 * Player tutorial progress
 * Tracks individual player's tutorial state
 */
export interface TutorialProgress {
  _id?: ObjectId;
  playerId: string;              // Player's unique ID
  currentQuestId?: string;       // Active quest (null if complete/skipped)
  currentStepIndex: number;      // Current step within active quest (0-indexed)
  completedQuests: string[];     // List of completed quest IDs
  completedSteps: string[];      // List of completed step IDs
  skippedQuests: string[];       // List of skipped quest IDs
  claimedRewards: string[];      // List of claimed reward IDs
  tutorialSkipped: boolean;      // Player chose to skip entire tutorial
  tutorialDeclined?: boolean;    // Player permanently declined tutorial (forfeits all rewards)
  tutorialComplete: boolean;     // All mandatory quests finished
  startedAt: Date;               // When tutorial began (analytics timestamp)
  currentStepStartedAt?: Date;   // When current step began (auto-complete timing)
  completedAt?: Date;            // When tutorial finished (null if incomplete)
  declinedAt?: Date;             // When tutorial was permanently declined
  lastUpdated: Date;             // Last progress update timestamp
  totalStepsCompleted: number;   // Progress metric
  totalTimeSpent: number;        // Time in seconds
}

/**
 * Tutorial state for UI components
 * Used by React components to manage tutorial display
 */
export interface TutorialUIState {
  isActive: boolean;             // Is tutorial currently active?
  showOverlay: boolean;          // Show full-screen overlay?
  showQuestPanel: boolean;       // Show mini quest tracker?
  currentQuest: TutorialQuest | null;
  currentStep: TutorialStep | null;
  progress: TutorialProgress | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Tutorial step completion result
 * Returned when player completes a step
 */
export interface TutorialStepCompletionResult {
  success: boolean;
  stepId: string;
  message: string;
  reward?: TutorialReward;
  nextStep?: TutorialStep;       // Next step in quest (null if quest complete)
  questComplete: boolean;        // Did this step complete the quest?
  tutorialComplete: boolean;     // Did this complete entire tutorial?
  progress: TutorialProgress;    // Updated progress object
}

/**
 * Tutorial quest completion result
 * Returned when player completes an entire quest
 */
export interface TutorialQuestCompletionResult {
  success: boolean;
  questId: string;
  message: string;
  reward: TutorialReward;
  unlockedFeatures?: string[];
  nextQuest?: TutorialQuest;     // Next quest in chain (null if tutorial complete)
  tutorialComplete: boolean;
  progress: TutorialProgress;
}

/**
 * Tutorial skip request
 */
export interface TutorialSkipRequest {
  playerId: string;
  skipType: 'STEP' | 'QUEST' | 'ENTIRE_TUTORIAL';
  skipId?: string;               // Step ID or Quest ID (not needed for ENTIRE_TUTORIAL)
  confirmed: boolean;            // User confirmed skip action
}

/**
 * Tutorial validation request
 * Sent to server to validate step completion
 */
export interface TutorialValidationRequest {
  playerId: string;
  questId: string;
  stepId: string;
  validationData?: Record<string, any>; // Action-specific data (e.g., coordinates for MOVE)
}

/**
 * Player game state validation data
 * Real-time player data fetched from database for tutorial validation
 * Used to validate CUSTOM action steps (e.g., "Collect 5,000 Metal")
 */
export interface PlayerGameStateValidation {
  metalBalance: number;
  energyBalance: number;
  ownedFactories: Array<{
    factoryId: string;
    tier: string;      // 'WEAK' | 'MEDIUM' | 'STRONG' | 'FORTRESS'
    level: number;
    x: number;
    y: number;
  }>;
  unitCounts: Record<string, number>; // { 'Infantry': 5, 'Tanks': 2, ... }
}

/**
 * Tutorial analytics data
 * Tracks tutorial effectiveness metrics
 */
export interface TutorialAnalytics {
  _id?: ObjectId;
  playerId: string;
  eventType: 'STARTED' | 'STEP_COMPLETED' | 'QUEST_COMPLETED' | 'SKIPPED' | 'ABANDONED' | 'COMPLETED';
  questId?: string;
  stepId?: string;
  timestamp: Date;
  timeSpent?: number;            // Seconds spent on step/quest
  skipReason?: string;           // If skipped, optional reason
  metadata?: Record<string, any>;
}

/**
 * Tutorial configuration
 * Admin-configurable tutorial settings
 */
export interface TutorialConfig {
  enabled: boolean;              // Global tutorial enable/disable
  showForNewPlayersOnly: boolean; // Only show for brand new accounts
  allowSkip: boolean;            // Allow skipping tutorial
  requireConfirmationToSkip: boolean;
  completionRewardMultiplier: number; // Bonus for completing entire tutorial (1.0 = 100%)
  minimumLevel: number;          // Min level to start tutorial (usually 1)
  maximumLevel: number;          // Max level to show tutorial (e.g., 5)
}

/**
 * Default tutorial configuration
 */
export const DEFAULT_TUTORIAL_CONFIG: TutorialConfig = {
  enabled: true,
  showForNewPlayersOnly: true,
  allowSkip: true,
  requireConfirmationToSkip: true,
  completionRewardMultiplier: 1.5, // 50% bonus for full completion
  minimumLevel: 1,
  maximumLevel: 5,
};
