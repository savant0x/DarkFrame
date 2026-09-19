/**
 * @file app/api/referral/generate/route.ts
 * Created: 2025-10-24
 * Rewritten: 2026-09-19 (FID-20260917-017 slice 5: Mongo shim → direct drizzle/pg)
 *
 * OVERVIEW:
 * API endpoint to generate unique referral code for authenticated player.
 * Automatically called once when player registers, but can regenerate if needed.
 *
 * ENDPOINTS:
 * POST /api/referral/generate
 *   - Requires: Authentication (JWT)
 *   - Returns: { code, link }
 *   - Idempotent: Returns existing code if already generated
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { generateReferralCode, generateReferralLink } from '@/lib/referralService';

export async function POST(_request: NextRequest) {
  try {
    // Verify authentication
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload || !tokenPayload.username) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const username = tokenPayload.username;

    // Check if player already has referral code
    const [player] = await db
      .select({
        referralCode: players.referralCode,
        referralLink: players.referralLink,
      })
      .from(players)
      .where(eq(players.username, username))
      .limit(1);

    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // If already has code, return it (idempotent)
    if (player.referralCode) {
      return NextResponse.json({
        success: true,
        data: {
          code: player.referralCode,
          link: player.referralLink || generateReferralLink(player.referralCode)
        }
      });
    }

    // Generate new unique code
    let code = generateReferralCode();
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure code is unique (very unlikely to collide, but check anyway)
    while (attempts < maxAttempts) {
      const [existing] = await db
        .select({ username: players.username })
        .from(players)
        .where(eq(players.referralCode, code))
        .limit(1);
      if (!existing) {
        break; // Code is unique
      }
      code = generateReferralCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate unique referral code' },
        { status: 500 }
      );
    }

    const link = generateReferralLink(code);

    // Update player with referral code
    const updated = await db
      .update(players)
      .set({ referralCode: code, referralLink: link })
      .where(eq(players.username, username))
      .returning({ username: players.username });

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        code,
        link
      }
    });
  } catch (error) {
    console.error('[Referral Generate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to complete the request. Please try again.'
      },
      { status: 500 }
    );
  }
}
