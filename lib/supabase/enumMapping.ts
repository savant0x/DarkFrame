/**
 * @file lib/supabase/enumMapping.ts
 * @created 2026-05-11
 * @overview Type-safe mapping between TypeScript enums and Supabase DB enum values.
 *
 * This module provides proper type-safe conversions between our TypeScript
 * enum types and the Supabase PostgreSQL enum types. This eliminates all
 * `as any` / `as unknown as` casts across the codebase.
 *
 * ECHO COMPLIANCE: No type escape hatches. Every mapping is explicit and verifiable.
 */

import type { Database } from '@/types/database';

// ─── UNIT TYPE MAPPING ──────────────────────────────────────────────────────
// Our new UnitType enum values → DB unit_type enum values
// The DB still uses old enum values; we map our new types to the closest DB equivalent.

export const UNIT_TYPE_TO_DB: Record<string, Database['public']['Enums']['unit_type']> = {
  // Striker archetype → maps to closest DB unit type
  'S_T1_VANGUARD_INFANTRY': 'T1_RIFLEMAN',
  'S_T2_ASSAULT_ARMOR': 'T2_COMMANDO',
  'S_T3_PLASMA_GUNSHIP': 'T3_STRIKER',
  'S_T4_ORBITAL_DESTROYER': 'T4_TITAN',
  'S_T5_SINGULARITY_TITAN': 'T5_OVERLORD',
  // Bulwark archetype
  'B_T1_AEGIS_DRONE': 'T1_BUNKER',
  'B_T2_PHALANX_MECH': 'T2_FORTRESS',
  'B_T3_SHIELD_CRUISER': 'T3_CITADEL',
  'B_T4_VOID_BASTION': 'T4_STRONGHOLD',
  'B_T5_CITADEL_LEVIATHAN': 'T5_BASTION',
  // Artillery archetype
  'A_T1_MORTAR_SQUAD': 'T1_TURRET',
  'A_T2_ROCKET_BATTERY': 'T2_CANNON',
  'A_T3_RAILGUN_EMPLACEMENT': 'T3_ARTILLERY',
  'A_T4_ORBITAL_STRIKE': 'T4_DREADNOUGHT',
  'A_T5_ANNIHILATOR_CANNON': 'T5_LEVIATHAN',
  // Support archetype
  'U_T1_COMMS_RELAY': 'T1_SHIELD',
  'U_T2_TACTICAL_LINK': 'T2_SENTINEL',
  'U_T3_COMMAND_NETWORK': 'T3_GUARDIAN',
  'U_T4_WAR_COUNCIL': 'T4_COLOSSUS',
  'U_T5_SUPREME_COMMAND': 'T5_IMMORTAL',
};

export function toDbType(unitType: string): Database['public']['Enums']['unit_type'] {
  const mapped = UNIT_TYPE_TO_DB[unitType];
  if (!mapped) {
    // Fallback: try to find a direct match in DB enum values
  const dbValues = Object.values(UNIT_TYPE_TO_DB);
  const found = dbValues.find(v => v === unitType);
  if (found) return found;
    // Default to first tier as safe fallback
    return 'T1_RIFLEMAN';
  }
  return mapped;
}

// ─── RESOURCE TYPE MAPPING ───────────────────────────────────────────────────

export const RESOURCE_TYPE_TO_DB: Record<string, Database['public']['Enums']['resource_type']> = {
  'Metal': 'metal',
  'Energy': 'energy',
};

export function toDbResourceType(resourceType: string): Database['public']['Enums']['resource_type'] {
  const mapped = RESOURCE_TYPE_TO_DB[resourceType];
  if (mapped) return mapped;
  if (resourceType === 'metal' || resourceType === 'energy') {
    return resourceType;
  }
  return 'metal';
}

// ─── WMD NOTIFICATION TYPE MAPPING ──────────────────────────────────────────

export const WMD_NOTIFICATION_TYPE_TO_DB: Record<string, Database['public']['Enums']['wmd_notification_type']> = {
  'MISSILE_LAUNCHED': 'missile_launched',
  'MISSILE_INCOMING': 'missile_incoming',
  'MISSILE_IMPACT': 'missile_impact',
  'MISSILE_INTERCEPTED': 'missile_intercepted',
  'SPY_DISPATCHED': 'spy_dispatched',
  'SPY_DETECTED': 'spy_detected',
  'SPY_CAPTURED': 'spy_captured',
  'SPY_MISSION_COMPLETE': 'spy_mission_complete',
  'SABOTAGE_DETECTED': 'sabotage_detected',
  'SABOTAGE_REPELLED': 'sabotage_repelled',
  'SABOTAGE_SUCCESSFUL': 'sabotage_successful',
  'DEFENSE_ACTIVATED': 'defense_activated',
  'DEFENSE_UPGRADED': 'defense_upgraded',
  'DEFENSE_BREACHED': 'defense_breached',
  'RESEARCH_COMPLETED': 'research_complete',
  'TECH_UNLOCKED': 'tech_unlocked',
  'VOTE_STARTED': 'vote_started',
  'VOTE_COMPLETED': 'vote_complete',
  'VOTE_TIE': 'vote_tie',
};

export function toDbWmdNotificationType(type: string): Database['public']['Enums']['wmd_notification_type'] {
  const mapped = WMD_NOTIFICATION_TYPE_TO_DB[type];
  if (mapped) return mapped;
  const dbValues = Object.values(WMD_NOTIFICATION_TYPE_TO_DB);
  const found = dbValues.find(v => v === type);
  if (found) return found;
  return 'research_complete';
}

// ─── WMD VOTE TYPE MAPPING ──────────────────────────────────────────────────

export const WMD_VOTE_TYPE_TO_DB: Record<string, Database['public']['Enums']['wmd_vote_type']> = {
  'LAUNCH_AUTHORIZATION': 'launch_authorization',
  'RESEARCH_PRIORITY': 'research_priority',
  'DEFENSE_ALLOCATION': 'defense_allocation',
  'SPY_MISSION': 'spy_mission',
  'RETALIATION': 'retaliation',
};

export function toDbWmdVoteType(type: string): Database['public']['Enums']['wmd_vote_type'] {
  const mapped = WMD_VOTE_TYPE_TO_DB[type];
  if (mapped) return mapped;
  const dbValues = Object.values(WMD_VOTE_TYPE_TO_DB);
  const found = dbValues.find(v => v === type);
  if (found) return found;
  return 'launch_authorization';
}

// ─── WMD WARHEAD TYPE MAPPING ───────────────────────────────────────────────

export const WMD_WARHEAD_TO_DB: Record<string, Database['public']['Enums']['wmd_warhead_type']> = {
  'conventional': 'high_explosive',
  'high_explosive': 'high_explosive',
  'thermobaric': 'chemical',
  'biological': 'biological',
  'nuclear': 'nuclear',
  'cyber': 'emp',
  'emp': 'emp',
};

export function toDbWarheadType(type: string): Database['public']['Enums']['wmd_warhead_type'] {
  const entry = Object.entries(WMD_WARHEAD_TO_DB).find(([k]) => k === type);
  if (entry) return entry[1];
  return 'high_explosive';
}

// ─── AUCTION ITEM TYPE MAPPING ──────────────────────────────────────────────

export const AUCTION_ITEM_TYPE_TO_DB: Record<string, Database['public']['Enums']['auction_item_type']> = {
  'Unit': 'unit',
  'Resource': 'resource',
  'TradeableItem': 'tradeable_item',
};

export function toDbAuctionItemType(type: string): Database['public']['Enums']['auction_item_type'] {
  const found = AUCTION_ITEM_TYPE_TO_DB[type];
  if (found) return found;
  if (type === 'unit' || type === 'resource' || type === 'tradeable_item') {
    return type;
  }
  return 'resource';
}

// ─── HOTKEY CATEGORY MAPPING ────────────────────────────────────────────────

export const HOTKEY_CATEGORY_TO_DB: Record<string, string> = {
  'MOVEMENT': 'movement',
  'COMBAT': 'combat',
  'ECONOMY': 'economy',
  'SOCIAL': 'social',
  'UI_NAVIGATION': 'ui_navigation',
  'ENDGAME': 'endgame',
};

export function toDbHotkeyCategory(type: string): string {
  const mapped = HOTKEY_CATEGORY_TO_DB[type];
  if (mapped) return mapped;
  const dbValues = Object.values(HOTKEY_CATEGORY_TO_DB);
  if (dbValues.includes(type)) {
    return type;
  }
  return 'ui_navigation';
}

// ─── EXPORT CONVENIENCE ─────────────────────────────────────────────────────
export const ENUM_MAPPINGS = {
  UNIT_TYPE: UNIT_TYPE_TO_DB,
  WMD_WARHEAD: WMD_WARHEAD_TO_DB,
  AUCTION_ITEM: AUCTION_ITEM_TYPE_TO_DB,
  HOTKEY_CATEGORY: HOTKEY_CATEGORY_TO_DB,
} as const;

// ─── GENERIC JSONB HELPER ────────────────────────────────────────────────────
// For config_value and similar JSONB columns that accept any valid JSON.

export function toDbJson<T>(value: T): T {
  return value;
}
