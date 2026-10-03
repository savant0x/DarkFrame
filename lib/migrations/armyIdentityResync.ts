/**
 * @file lib/migrations/armyIdentityResync.ts
 * @created 2026-10-02
 * @overview FID-20261002-004 §5.6 + source-audit — canonical army identity
 *           normalization and recount (dry-run first, explicit apply).
 *
 * OVERVIEW:
 * An idempotent normalization/recount tool for EXISTING army rows:
 *  - recognized blueprint-shaped `unitType` values (legacy blueprint ids like
 *    'titan', enum keys like 'T5_Titan') are normalized to the canonical
 *    persisted UnitType through the typed mapping — quantities, stats,
 *    investment and factory references are PRESERVED (identity only);
 *  - duplicate instance IDs with IDENTICAL type/stats merge their quantities;
 *  - conflicting duplicates (same id, different type/stats) are REPORTED and
 *    the player is SKIPPED — ambiguous records are quarantined for an explicit
 *    operator reconciliation, never deleted or guessed;
 *  - verified LEGACY Unit entries in inventoryItems (the old produceUnit
 *    storage) are moved into `units` exactly once by instance ID, preserving
 *    their power; only the migrated entries are removed from inventoryItems;
 *  - totalStrength/totalDefense are recounted from the preserved stats via the
 *    ONE shared reducer (lib/armyService.calculatePlayerUnitStats).
 *
 * SAFETY: dryRun NEVER writes. apply runs per player under the FID-20261002-002
 * transaction boundary (player row locked FOR UPDATE, whole-player atomicity);
 * any injected or real failure rolls that player back entirely. Running apply
 * twice is a no-op (idempotent).
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { PlayerUnit } from '@/types';
import {
  resolveCanonicalUnitType,
  unitConfigForIdentifier,
  type UnitConfig,
} from '@/types';
import { calculatePlayerUnitStats, newUnitInstanceId } from '@/lib/armyService';
import { withTransactionRetry } from '@/lib/db/treasuryLock';

/** One normalized identity: what it was, what it became. */
export interface ArmyIdentityCorrection {
  username: string;
  entryId: string;
  before: string | null;
  after: string;
  kind: 'unitType-normalized' | 'duplicate-merged' | 'legacy-moved';
}

/** A quarantined (reported, untouched) ambiguous record. */
export interface ArmyIdentityConflict {
  username: string;
  entryId: string;
  reason: string;
  entries: Array<Record<string, unknown>>;
}

export interface ArmyResyncReport {
  mode: 'dry-run' | 'apply';
  playersScanned: number;
  playersChanged: number;
  unitTypesNormalized: number;
  duplicatesMerged: number;
  duplicatesMergedQuantity: number;
  legacyMoved: number;
  totalsRecomputed: number;
  conflicts: ArmyIdentityConflict[];
  corrections: ArmyIdentityCorrection[];
}

/** Legacy inventory Unit discriminator (same shape test factoryService uses). */
function isLegacyUnitEntry(item: unknown): item is Record<string, unknown> {
  return (
    typeof item === 'object' && item !== null &&
    'producedAt' in item && 'strength' in item
  );
}

/**
 * Canonicalize ONE entry's identity when it is recognizable. Returns the
 * canonical UnitType value, or null when the record is unrecognized (reported,
 * never guessed).
 */
function canonicalUnitTypeOf(entry: Record<string, unknown>): string | null {
  const raw = entry.unitType ?? entry.type ?? entry.unitId;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const resolved = resolveCanonicalUnitType(raw);
  return resolved ?? null;
}

/**
 * Normalize the units array for one player WITHOUT writing:
 * returns the corrected array (or null when nothing changed), merge counts,
 * and any conflicts that quarantine the player.
 */
function normalizeUnits(
  username: string,
  rawUnits: PlayerUnit[],
  legacy: unknown[],
): {
  units: PlayerUnit[] | null;
  corrections: ArmyIdentityCorrection[];
  conflicts: ArmyIdentityConflict[];
  duplicatesMerged: number;
  duplicatesMergedQuantity: number;
  legacyMoved: number;
} {
  const corrections: ArmyIdentityCorrection[] = [];
  const conflicts: ArmyIdentityConflict[] = [];
  let unitTypesNormalized = 0;
  let duplicatesMerged = 0;
  let duplicatesMergedQuantity = 0;
  let legacyMoved = 0;

  // ── Pass 1: identity normalization on recognized records ──
  const working: PlayerUnit[] = rawUnits.map((entry) => {
    const record = entry as unknown as Record<string, unknown>;
    const canonical = canonicalUnitTypeOf(record);
    if (!canonical) {
      // Unrecognized identity: keep as-is, report as a conflict so the
      // operator sees it — never guess (FID-20261002-004 §5.6).
      conflicts.push({
        username,
        entryId: String(entry.id ?? '<missing-id>'),
        reason: 'unrecognized unit identity (not a blueprint id, enum key or UnitType value)',
        entries: [record],
      });
      return entry;
    }
    const config: UnitConfig | null = unitConfigForIdentifier(canonical);
    if (String(record.unitType) !== canonical) {
      unitTypesNormalized += 1;
      corrections.push({
        username,
        entryId: String(entry.id ?? '<missing-id>'),
        before: String(record.unitType ?? record.type ?? record.unitId),
        after: canonical,
        kind: 'unitType-normalized',
      });
      return {
        ...entry,
        unitType: canonical as PlayerUnit['unitType'],
        // Keep the entry's own stats/quantity/provenance — identity only.
        // Stamp the canonical display name only when the entry carries none.
        name: entry.name || config?.name || entry.name,
      } as PlayerUnit;
    }
    return entry;
  });

  if (conflicts.length > 0) {
    // Quarantine: ambiguous records leave the player untouched.
    return { units: null, corrections, conflicts, duplicatesMerged, duplicatesMergedQuantity, legacyMoved };
  }

  // ── Pass 2: duplicate instance IDs with IDENTICAL type+stats merge ──
  const byId = new Map<string, PlayerUnit>();
  const merged: PlayerUnit[] = [];
  for (const entry of working) {
    const idKey = String(entry.id);
    const existing = byId.get(idKey);
    if (existing) {
      if (
        existing.unitType === entry.unitType &&
        existing.strength === entry.strength &&
        existing.defense === entry.defense
      ) {
        existing.quantity += entry.quantity;
        duplicatesMerged += 1;
        duplicatesMergedQuantity += entry.quantity;
        corrections.push({
          username,
          entryId: idKey,
          before: `quantity ${existing.quantity - entry.quantity}`,
          after: `quantity ${existing.quantity}`,
          kind: 'duplicate-merged',
        });
        continue;
      }
      // Same id, different type/stats: ambiguous — quarantine the player.
      conflicts.push({
        username,
        entryId: idKey,
        reason: 'conflicting duplicate instance id (same id, different type/stats)',
        entries: [existing as unknown as Record<string, unknown>, entry as unknown as Record<string, unknown>],
      });
      return { units: null, corrections, conflicts, duplicatesMerged, duplicatesMergedQuantity, legacyMoved };
    }
    byId.set(idKey, entry);
    merged.push(entry);
  }

  // ── Pass 3: verified legacy inventoryItems units → units, exactly once ──
  const presentIds = new Set(merged.map((u) => String(u.id)));
  const remainingLegacy: Array<Record<string, unknown>> = [];
  for (const legacyItem of legacy) {
    const legacyEntry = legacyItem as Record<string, unknown>;
    const canonical = canonicalUnitTypeOf(legacyEntry);
    const id = String(legacyEntry.id ?? '');
    if (!canonical) {
      conflicts.push({
        username,
        entryId: id || '<missing-id>',
        reason: 'unrecognized legacy inventory unit identity',
        entries: [legacyEntry],
      });
      remainingLegacy.push(legacyEntry);
      continue;
    }
    if (id && presentIds.has(id)) {
      conflicts.push({
        username,
        entryId: id,
        reason: 'legacy inventory unit shares an instance id already present in units (not moved — report only)',
        entries: [legacyEntry],
      });
      remainingLegacy.push(legacyEntry);
      continue;
    }
    const config = unitConfigForIdentifier(canonical)!;
    const moved: PlayerUnit = {
      id: id || newUnitInstanceId(username, canonical),
      unitId: config ? String(legacyEntry.unitId ?? canonical) : String(legacyEntry.unitId ?? canonical),
      unitType: canonical as PlayerUnit['unitType'],
      name: (legacyEntry.name as string) || config?.name || String(canonical),
      category: (config && config.defense > 0 && !config.strength ? 'DEF' : 'STR') as 'STR' | 'DEF',
      rarity: 'common' as const,
      // Preserve the legacy entry's OWN stats (its power must survive).
      strength: Number(legacyEntry.strength ?? config?.strength ?? 0),
      defense: Number(legacyEntry.defense ?? config?.defense ?? 0),
      quantity: 1,
      createdAt: (legacyEntry.producedDate as Date) || new Date(),
      producedAt: legacyEntry.producedAt as PlayerUnit['producedAt'] | undefined,
    };
    merged.push(moved);
    presentIds.add(String(moved.id));
    legacyMoved += 1;
    corrections.push({
      username,
      entryId: String(moved.id),
      before: 'inventoryItems legacy Unit',
      after: String(canonical),
      kind: 'legacy-moved',
    });
  }

  const units = (unitTypesNormalized > 0 || duplicatesMerged > 0 || legacyMoved > 0)
    ? merged
    : (legacyMoved === 0 && conflicts.length === 0 && merged.length === rawUnits.length && remainingLegacy.length === legacy.length
        ? null /* nothing changed */
        : merged);

  return {
    units,
    corrections,
    conflicts,
    duplicatesMerged,
    duplicatesMergedQuantity,
    legacyMoved: legacy.length - remainingLegacy.length,
  };
}

/**
 * Scan every player and normalize/recount army identity.
 * mode 'dry-run' computes the full report and writes NOTHING;
 * mode 'apply' commits per player inside the 002 transaction boundary.
 */
export async function armyIdentityResync(mode: 'dry-run' | 'apply'): Promise<ArmyResyncReport> {
  const report: ArmyResyncReport = {
    mode,
    playersScanned: 0,
    playersChanged: 0,
    unitTypesNormalized: 0,
    duplicatesMerged: 0,
    duplicatesMergedQuantity: 0,
    legacyMoved: 0,
    totalsRecomputed: 0,
    conflicts: [],
    corrections: [],
  };

  const rows = await db
    .select({
      username: players.username,
      units: players.units,
      inventoryItems: players.inventoryItems,
      totalStrength: players.totalStrength,
      totalDefense: players.totalDefense,
    })
    .from(players);

  for (const row of rows) {
    report.playersScanned += 1;
    const username = row.username;
    const rawUnits = Array.isArray(row.units) ? (row.units as PlayerUnit[]) : [];
    const inventory = Array.isArray(row.inventoryItems) ? row.inventoryItems : [];
    const legacy = inventory.filter(isLegacyUnitEntry);

    const outcome = normalizeUnits(username, rawUnits, legacy as unknown[]);

    report.corrections.push(...outcome.corrections);
    report.unitTypesNormalized += outcome.corrections.filter((c) => c.kind === 'unitType-normalized').length;
    report.duplicatesMerged += outcome.duplicatesMerged;
    report.duplicatesMergedQuantity += outcome.duplicatesMergedQuantity;
    report.legacyMoved += outcome.legacyMoved;
    report.conflicts.push(...outcome.conflicts);

    if (outcome.units === null) {
      // Quarantined (conflicts) or nothing to do — untouched either way.
      continue;
    }

    const { totalSTR, totalDEF } = calculatePlayerUnitStats(outcome.units);
    const totalsChanged = row.totalStrength !== totalSTR || row.totalDefense !== totalDEF;
    if (!totalsChanged && outcome.corrections.filter((c) => c.username === username).length === 0) {
      continue;
    }
    report.totalsRecomputed += 1;

    if (mode === 'dry-run') {
      report.playersChanged += 1;
      continue;
    }

    // APPLY: whole-player atomic — lock the row, recompute from the LOCKED
    // state (concurrent writers may have changed the army mid-scan), write.
    await withTransactionRetry(`armyIdentityResync(${username})`, () =>
      db.transaction(async (tx) => {
        const [locked] = await tx
          .select({
            units: players.units,
            inventoryItems: players.inventoryItems,
            totalStrength: players.totalStrength,
            totalDefense: players.totalDefense,
          })
          .from(players)
          .where(eq(players.username, username))
          .limit(1)
          .for('update');
        if (!locked) return;

        const lockedUnits = Array.isArray(locked.units) ? (locked.units as PlayerUnit[]) : [];
        const lockedInventory = Array.isArray(locked.inventoryItems) ? locked.inventoryItems : [];
        const lockedLegacy = lockedInventory.filter(isLegacyUnitEntry);
        const lockedOutcome = normalizeUnits(username, lockedUnits, lockedLegacy as unknown[]);
        if (lockedOutcome.conflicts.length > 0) {
          // Quarantined under the lock: leave untouched, surface the conflict.
          report.conflicts.push(...lockedOutcome.conflicts);
          return;
        }
        const nextUnits = lockedOutcome.units ?? lockedUnits;
        const nextLegacyIds = new Set(
          lockedLegacy
            .filter((entry) => {
              // Only the entries actually migrated leave inventoryItems.
              const id = String(entry.id ?? '');
              return id && nextUnits.some((u) => String(u.id) === id && lockedUnits.every((existing) => String(existing.id) !== id));
            })
            .map((entry) => String(entry.id)),
        );
        const nextInventory = lockedInventory.filter(
          (item) => !(isLegacyUnitEntry(item) && nextLegacyIds.has(String((item as Record<string, unknown>).id ?? ''))),
        );
        const stats = calculatePlayerUnitStats(nextUnits);

        await tx
          .update(players)
          .set({
            units: sql`${JSON.stringify(nextUnits)}::jsonb`,
            inventoryItems: sql`${JSON.stringify(nextInventory)}::jsonb`,
            totalStrength: stats.totalSTR,
            totalDefense: stats.totalDEF,
          })
          .where(eq(players.username, username));

        report.playersChanged += 1;
      }),
    );
  }

  return report;
}

/** Dry-run convenience: full report, zero writes. */
export function dryRunArmyIdentityResync(): Promise<ArmyResyncReport> {
  return armyIdentityResync('dry-run');
}

/** Explicit apply convenience: same engine, writes committed. */
export function applyArmyIdentityResync(): Promise<ArmyResyncReport> {
  return armyIdentityResync('apply');
}
