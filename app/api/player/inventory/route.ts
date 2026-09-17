/**
 * @file app/api/player/inventory/route.ts
 * @created 2025-01-19 (Mongo era)
 * @rewritten 2026-09-17 (FID-20260917-008)
 * @overview GET the authenticated player's inventory from PostgreSQL.
 *
 * History: this route survived the pg pivot on the Mongo stack — it
 * authenticated off a `playerId` cookie nothing sets anymore and queried
 * `clientPromise`/`db.collection('players')`, so every call 401'd while
 * InventoryPanel's `if (response.ok)` guard hid the failure (FID-20260917-008;
 * surfaced live during the session-046 clan-UI verification).
 *
 * Contract (matched to the sole consumer, components/InventoryPanel.tsx:180 —
 * the panel does `setInventory(data)` directly, so the payload is UNWRAPPED):
 *   200 → {
 *     capacity, items: InventoryItem[] (mixed jsonb rides along unfiltered —
 *       Unit entries belong to other subsystems and the panel's own filters
 *       simply never match them),
 *     gatheringBonus: { metalBonus, energyBonus },   // pg numerics → numbers
 *     metalDiggerCount, energyDiggerCount,
 *     activeBoosts: { gatheringBoost, expiresAt },   // expiresAt: ISO string | null
 *   }
 *   The legacy `resources`/`equipment` response fields were never consumed by
 *   any client and are not reconstructed.
 *
 * Auth: requireAuth on darkframe_session (house idiom, cf. app/api/clan/[id]).
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  requireAuth,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  withRequestLogging,
} from '@/lib';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';

export const GET = withRequestLogging(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const rows = await db
      .select({
        inventoryItems: players.inventoryItems,
        inventoryCapacity: players.inventoryCapacity,
        inventoryMetalDiggerCount: players.inventoryMetalDiggerCount,
        inventoryEnergyDiggerCount: players.inventoryEnergyDiggerCount,
        gatheringBonusMetalBonus: players.gatheringBonusMetalBonus,
        gatheringBonusEnergyBonus: players.gatheringBonusEnergyBonus,
        activeBoostsGatheringBoost: players.activeBoostsGatheringBoost,
        activeBoostsExpiresAt: players.activeBoostsExpiresAt,
      })
      .from(players)
      .where(eq(players.username, auth.playerId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      // requireAuth resolved the session via the same row, so this is a
      // mid-request deletion race — not a normal "not found" path.
      return createErrorResponse(ErrorCode.AUTH_USER_NOT_FOUND);
    }

    return NextResponse.json({
      capacity: row.inventoryCapacity,
      items: row.inventoryItems ?? [],
      gatheringBonus: {
        // pg numeric columns arrive as strings — the panel does arithmetic
        // and renders these as percentages, so parse before shipping.
        metalBonus: parseFloat(row.gatheringBonusMetalBonus),
        energyBonus: parseFloat(row.gatheringBonusEnergyBonus),
      },
      metalDiggerCount: row.inventoryMetalDiggerCount,
      energyDiggerCount: row.inventoryEnergyDiggerCount,
      activeBoosts: {
        gatheringBoost:
          row.activeBoostsGatheringBoost === null
            ? null
            : parseFloat(row.activeBoostsGatheringBoost),
        // The client feeds expiresAt straight into new Date(...) — ship an
        // ISO string, never a Date object (Next would serialize it but the
        // explicit toISOString pins the wire format).
        expiresAt: row.activeBoostsExpiresAt
          ? row.activeBoostsExpiresAt.toISOString()
          : null,
      },
    });
  } catch (error) {
    return createErrorFromException(error);
  }
});
