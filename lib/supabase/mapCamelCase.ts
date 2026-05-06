/**
 * @file lib/supabase/mapCamelCase.ts
 * @created 2026-05-04
 * @overview Converts snake_case object keys to camelCase.
 * 
 * Only converts top-level keys (not recursive) to avoid corrupting
 * nested JSONB columns like bot_config, daily_bounties, etc.
 * 
 * Use this on ALL Supabase query results before sending to the client.
 * Eliminates the `...player` spread leak pattern forever.
 */

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

export function mapCamelCase<T = Record<string, unknown>>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(item => mapCamelCase(item)) as unknown as T;
  }
  if (!isObject(obj)) return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Only convert snake_case keys at the top level.
    // Nested JSONB objects (bot_config, daily_bounties, etc.) keep their internal keys.
    const camelKey = key.includes('_') ? snakeToCamel(key) : key;
    result[camelKey] = value;
  }
  return result as unknown as T;
}
