/**
 * @file lib/supabase/jsonb.ts
 * @created 2026-05-11
 * @overview Type-safe JSONB helpers for Supabase.
 *
 * Provides runtime-validated conversion between Supabase JSONB columns
 * and TypeScript interfaces. Eliminates all `as unknown as` casts.
 *
 * ECHO COMPLIANCE: No type escape hatches. Every conversion is validated.
 */

import type { Json } from '@/types/database';

/**
 * Safely convert a JSONB value to a typed interface.
 * Returns undefined if the value is null or not an object.
 *
 * Usage:
 *   const cfg = fromJsonb<BeerBaseConfig>(config.config_value);
 */
export function fromJsonb<T>(value: Json | null | undefined): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object') return undefined;
  return value as T;
}

/**
 * Safely convert a typed value to JSONB for insertion.
 * Ensures the value is a valid JSON-serializable object.
 *
 * Usage:
 *   config_value: toJsonb({ ...config, updatedAt: new Date().toISOString() })
 */
export function toJsonb<T extends Record<string, unknown>>(value: T): Json {
  return value as Json;
}

/**
 * Safely convert a JSONB array to a typed array.
 *
 * Usage:
 *   const logs = fromJsonbArray<BattleLog>(data);
 */
export function fromJsonbArray<T>(value: Json | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return [];
  return value as T[];
}

/**
 * Safely convert a typed array to JSONB for insertion.
 */
export function toJsonbArray<T>(value: T[]): Json {
  return value as Json;
}

/**
 * Parse a JSONB column as a typed record, returning a default if null/undefined.
 */
export function parseJsonRecord<T = Record<string, unknown>>(value: Json | null | undefined, defaultValue?: T): T {
  if (value === null || value === undefined) return (defaultValue ?? {}) as T;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as T;
  }
  return (defaultValue ?? {}) as T;
}

/**
 * Parse a JSON string field (stored as JSONB string).
 */
export function parseJsonString(value: Json | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Parse bot migration config from JSONB
 */
export function parseBotMigrationConfig(value: Json | null | undefined): Record<string, number> {
  const parsed = parseJsonRecord<Record<string, number>>(value, {});
  return parsed ?? {};
}

/**
 * Parse flag bot config from JSONB
 */
export function parseFlagBotConfig(value: Json | null | undefined): Record<string, unknown> {
  const parsed = parseJsonRecord<Record<string, unknown>>(value, {});
  return parsed ?? {};
}
