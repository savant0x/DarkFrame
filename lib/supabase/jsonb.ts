/**
 * Type-safe JSONB accessors for Supabase Json columns.
 */

import type { Json } from '@/types/database';

export function parseJsonRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>;
  }
  return {};
}

export function parseJsonArray(value: Json | null | undefined): Json[] {
  if (Array.isArray(value)) return value;
  return [];
}

export function parseJsonString(value: Json | null | undefined, fallback: string = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function parseJsonNumber(value: Json | null | undefined, fallback: number = 0): number {
  return typeof value === 'number' ? value : fallback;
}

export function parseJsonBoolean(value: Json | null | undefined, fallback: boolean = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export interface BotMigrationConfig {
  specialization?: string;
  tier?: number;
}

export function parseBotMigrationConfig(value: Json | null | undefined): BotMigrationConfig {
  const rec = parseJsonRecord(value);
  return {
    specialization: parseJsonString(rec.specialization),
    tier: parseJsonNumber(rec.tier, 1),
  };
}

export function parseFlagBotConfig(value: Json | null | undefined): Record<string, Json | undefined> {
  const rec = parseJsonRecord(value);
  return {
    trail: parseJsonArray(rec.trail),
    transferHistory: parseJsonArray(rec.transferHistory),
    statistics: parseJsonRecord(rec.statistics),
  };
}
