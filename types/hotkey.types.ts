// ============================================================
// FILE: types/hotkey.types.ts
// CREATED: 2025-01-23
// ============================================================
// OVERVIEW:
// TypeScript type definitions for the hotkey configuration system.
// Defines the structure for hotkey mappings, categories, and admin
// configuration interface.
// ============================================================

/**
 * Available hotkey actions in the game
 */
export enum HotkeyAction {
  // Panel Toggles
  BANK_PANEL = 'BANK_PANEL',
  SHRINE_PANEL = 'SHRINE_PANEL',
  UNIT_BUILD_PANEL = 'UNIT_BUILD_PANEL',
  FACTORY_MANAGEMENT = 'FACTORY_MANAGEMENT',
  TIER_UNLOCK = 'TIER_UNLOCK',
  ACHIEVEMENT_PANEL = 'ACHIEVEMENT_PANEL',
  AUCTION_HOUSE = 'AUCTION_HOUSE',
  FLAG_TRACKER = 'FLAG_TRACKER',
  BEER_BASE_PANEL = 'BEER_BASE_PANEL',
  BOT_SCANNER = 'BOT_SCANNER',
  BOT_MAGNET = 'BOT_MAGNET',
  BOT_SUMMONING = 'BOT_SUMMONING',
  BOUNTY_BOARD = 'BOUNTY_BOARD',
  
  // View Toggles
  CLAN_VIEW = 'CLAN_VIEW',
  CLAN_LEADERBOARD = 'CLAN_LEADERBOARD',
  PLAYER_LEADERBOARD = 'PLAYER_LEADERBOARD',
  
  // Auto-Farm Controls
  AUTO_FARM_TOGGLE = 'AUTO_FARM_TOGGLE',
  AUTO_FARM_STOP = 'AUTO_FARM_STOP',
  AUTO_FARM_STATS = 'AUTO_FARM_STATS',
  
  // Resource Actions
  HARVEST_METAL_ENERGY = 'HARVEST_METAL_ENERGY',
  HARVEST_CAVE_FOREST = 'HARVEST_CAVE_FOREST',
  
  // Combat Actions
  FACTORY_ATTACK = 'FACTORY_ATTACK',
}

/**
 * Hotkey configuration entry
 */
export interface HotkeyConfig {
  action: HotkeyAction;
  key: string;
  displayName: string;
  description: string;
  category: HotkeyCategory;
  requiresShift?: boolean;
  requiresCtrl?: boolean;
  requiresAlt?: boolean;
}

/**
 * Hotkey category for organization
 */
export enum HotkeyCategory {
  PANELS = 'PANELS',
  VIEWS = 'VIEWS',
  AUTO_FARM = 'AUTO_FARM',
  RESOURCES = 'RESOURCES',
  COMBAT = 'COMBAT',
}

/**
 * Hotkey configuration document stored in MongoDB
 */
export interface HotkeySettings {
  _id?: string;
  version: number;
  lastModified: Date;
  modifiedBy: string;
  hotkeys: HotkeyConfig[];
}

/**
 * Default hotkey configuration.
 *
 * RULE (see lib/hotkeyRegistry.ts): every key has exactly ONE mapping, and the
 * movement keys qweasdzxc are RESERVED for movement — never bound as a bare
 * hotkey (Shift/Ctrl/Alt combos are fine; MovementControls ignores presses
 * with modifiers held). Displaced actions keep their mnemonic via Shift+key.
 */
export const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  // Panels
  {
    action: HotkeyAction.BANK_PANEL,
    key: 'b',
    displayName: 'Bank Panel',
    description: 'Open banking services (must be at Bank tile)',
    category: HotkeyCategory.PANELS,
  },
  {
    action: HotkeyAction.SHRINE_PANEL,
    key: 'n',
    displayName: 'Shrine Panel',
    description: 'Open shrine services (must be at Shrine)',
    category: HotkeyCategory.PANELS,
  },
  {
    action: HotkeyAction.UNIT_BUILD_PANEL,
    key: 'u',
    displayName: 'Unit Build Panel',
    description: 'Open unit construction panel',
    category: HotkeyCategory.PANELS,
  },
  {
    action: HotkeyAction.FACTORY_MANAGEMENT,
    key: 'm',
    displayName: 'Factory Management',
    description: 'Open factory management panel',
    category: HotkeyCategory.PANELS,
  },
  {
    action: HotkeyAction.TIER_UNLOCK,
    key: 't',
    displayName: 'Tier Unlock',
    description: 'Open tier unlock panel',
    category: HotkeyCategory.PANELS,
  },
  {
    action: HotkeyAction.ACHIEVEMENT_PANEL,
    key: 'v',
    displayName: 'Achievements',
    description: 'Toggle achievement panel',
    category: HotkeyCategory.PANELS,
  },
  {
    action: HotkeyAction.AUCTION_HOUSE,
    key: 'h',
    displayName: 'Auction House',
    description: 'Toggle auction house panel',
    category: HotkeyCategory.PANELS,
  },
  {
    action: HotkeyAction.FLAG_TRACKER,
    key: 'q',
    displayName: 'Flag Tracker (legacy default)',
    description: 'Legacy binding — unused (tracker is permanent); q is reserved for movement',
    category: HotkeyCategory.PANELS,
    requiresShift: true,
  },
  {
    action: HotkeyAction.BEER_BASE_PANEL,
    key: 'e',
    displayName: 'Beer Bases (Shift+E)',
    description: 'Toggle Beer Base attack panel — Shift+E (E alone is movement)',
    category: HotkeyCategory.COMBAT,
    requiresShift: true,
  },
  {
    action: HotkeyAction.BOT_SCANNER,
    key: 'x',
    displayName: 'Bot Scanner (Shift+X)',
    description: 'Toggle bot scanner panel (requires tech unlock) — Shift+X (X alone is movement)',
    category: HotkeyCategory.COMBAT,
    requiresShift: true,
  },
  {
    action: HotkeyAction.BOT_MAGNET,
    key: 'j',
    displayName: 'Bot Magnet',
    description: 'Toggle Bot Magnet panel',
    category: HotkeyCategory.COMBAT,
  },
  {
    action: HotkeyAction.BOT_SUMMONING,
    key: 'y',
    displayName: 'Bot Summoning',
    description: 'Toggle Bot Summoning panel',
    category: HotkeyCategory.COMBAT,
  },
  {
    action: HotkeyAction.BOUNTY_BOARD,
    key: 'o',
    displayName: 'Bounty Board',
    description: 'Toggle Bounty Board panel',
    category: HotkeyCategory.COMBAT,
  },
  
  // Views
  {
    action: HotkeyAction.CLAN_VIEW,
    key: 'c',
    displayName: 'Clan View (Shift+C)',
    description: 'Toggle clan panel view — Shift+C (C alone is movement)',
    category: HotkeyCategory.VIEWS,
    requiresShift: true,
  },
  {
    action: HotkeyAction.CLAN_LEADERBOARD,
    key: 'l',
    displayName: 'Clan Leaderboard',
    description: 'Toggle clan leaderboard view',
    category: HotkeyCategory.VIEWS,
  },
  {
    action: HotkeyAction.PLAYER_LEADERBOARD,
    key: 'p',
    displayName: 'Player Leaderboard',
    description: 'Toggle player leaderboard view',
    category: HotkeyCategory.VIEWS,
  },
  
  // Auto-Farm
  {
    action: HotkeyAction.AUTO_FARM_TOGGLE,
    key: 'f',
    displayName: 'Auto-Farm Toggle (Shift+F)',
    description: 'Start/pause/resume auto-farming — Shift+F (F alone harvests caves/forests)',
    category: HotkeyCategory.AUTO_FARM,
    requiresShift: true,
  },
  {
    action: HotkeyAction.AUTO_FARM_STATS,
    key: 's',
    displayName: 'Auto-Farm Stats (Shift+S)',
    description: 'Toggle auto-farm statistics display — Shift+S (S alone is refresh/movement)',
    category: HotkeyCategory.AUTO_FARM,
    requiresShift: true,
  },
  
  // Resources
  {
    action: HotkeyAction.HARVEST_METAL_ENERGY,
    key: 'g',
    displayName: 'Harvest Metal/Energy',
    description: 'Harvest metal or energy resources',
    category: HotkeyCategory.RESOURCES,
  },
  {
    action: HotkeyAction.HARVEST_CAVE_FOREST,
    key: 'f',
    displayName: 'Harvest Cave/Forest (F)',
    description: 'Explore caves or harvest forest — F alone (G is Metal/Energy, Shift+F is Auto-Farm)',
    category: HotkeyCategory.RESOURCES,
  },
  
  // Combat
  {
    action: HotkeyAction.FACTORY_ATTACK,
    key: 'r',
    displayName: 'Attack Factory',
    description: 'Attack the factory at current position',
    category: HotkeyCategory.COMBAT,
  },
];

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - HotkeyAction enum defines all possible hotkey actions
// - HotkeyConfig stores individual hotkey configuration
// - HotkeyCategory groups related hotkeys for admin UI
// - DEFAULT_HOTKEYS provides fallback configuration
// - Supports modifier keys (Shift, Ctrl, Alt) for combinations
// - MongoDB document structure for persistence
// - Version tracking for configuration migration
// ============================================================
// END OF FILE
// ============================================================
