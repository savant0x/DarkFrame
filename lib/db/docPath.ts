/**
 * Doc-path jsonb containment predicate (shared truth).
 *
 * Extracted from the Mongo shim (lib/mongodb.ts buildDocPathPredicate) so both
 * the shim and pg-native routes emit the IDENTICAL probe shape — one function,
 * one truth (Law 13). Mongo-era dot-path filters like { 'bids.bidderUsername': u }
 * address a field INSIDE a stored document (optionally through an array — "any
 * element matches"). The translation is jsonb containment with a DUAL probe:
 * the leaf is emitted twice — wrapped in a single-element array ("some element
 * of doc.bids contains the probe"; jsonb arrays reject bare object probes —
 * live-verified my-bids 500) and as a plain object (object-shaped containers
 * like active_boosts). For any given container exactly one shape can match, so
 * the OR is precise, not a fuzzy fallback.
 */
import { type SQL, sql } from 'drizzle-orm';

export function docPathContainment(docColumn: unknown, key: string, value: unknown): SQL {
  const path = key.split('.');
  const leaf = { [path[path.length - 1]]: value };
  let arr: unknown = [leaf];
  let obj: unknown = leaf;
  for (let i = path.length - 2; i >= 0; i--) {
    arr = { [path[i]]: arr };
    obj = { [path[i]]: obj };
  }
  return sql`(${docColumn} @> ${JSON.stringify(arr)}::jsonb OR ${docColumn} @> ${JSON.stringify(obj)}::jsonb)`;
}
