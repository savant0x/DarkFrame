/**
 * RP Package Checkout Session API (FID-20260919-010)
 *
 * OVERVIEW:
 * POST endpoint that creates a Stripe Checkout Session for a one-time RP
 * package purchase. Mirrors the VIP checkout route's auth/validation shape and
 * rides the FID-20260917-009 grant-path law: username-keyed, server-owned
 * amounts. The client sends ONLY a packageId; the price and RP amount are
 * resolved server-side from lib/stripe/rpPackages.
 *
 * ENDPOINT:
 * POST /api/stripe/rp-checkout
 * REQUEST BODY: { "packageId": "starter" | "boost" | "power" | "mega" | "legendary" }
 * RESPONSE: { success: true, sessionId, url } — the client redirects to url.
 *
 * Created: 2026-09-19
 * Feature: FID-20260919-010
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db, players } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createRpCheckoutSession } from '@/lib/stripe/stripeService';
import { getRPPackage } from '@/lib/stripe/rpPackages';
import { logger } from '@/lib/logger/productionLogger';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();

    if (!tokenPayload) {
      logger.warn('RP checkout attempted without authentication', {
        ip: request.headers.get('x-forwarded-for'),
      });
      return NextResponse.json({
        success: false,
        message: 'You must be logged in to purchase RP',
      }, { status: 401 });
    }

    // Get full player record (username-keyed — FID-20260917-009)
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.username, tokenPayload.username))
      .limit(1);

    if (!player) {
      logger.warn('Player not found in database during RP checkout', {
        username: tokenPayload.username,
      });
      return NextResponse.json({
        success: false,
        message: 'Player account not found. Please try logging in again.',
      }, { status: 404 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({
        success: false,
        message: 'Invalid request body',
      }, { status: 400 });
    }

    const { packageId } = body;

    // Validate package against the server's map (the only trusted source)
    if (!packageId || typeof packageId !== 'string' || !getRPPackage(packageId)) {
      logger.warn('Invalid RP package selected for checkout', {
        playerId: player.username,
        packageId,
      });
      return NextResponse.json({
        success: false,
        message: 'Invalid RP package selected. Please choose a valid package.',
      }, { status: 400 });
    }

    // Create the one-time checkout session (server-owned amount)
    const result = await createRpCheckoutSession({
      userId: player.username,
      username: player.username,
      email: player.email || tokenPayload.email,
      packageId,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/shop/rp-packages?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/shop/rp-packages?status=cancelled`,
    });

    if (!result.success) {
      logger.error('RP checkout session creation failed', undefined, {
        playerId: player.username,
        packageId,
        errorMessage: result.message,
      });
      return NextResponse.json({
        success: false,
        message: result.message || 'Failed to create checkout session. Please try again.',
      }, { status: 500 });
    }

    logger.info('RP checkout session created successfully', {
      playerId: player.username,
      packageId,
      sessionId: result.sessionId,
    });

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      url: result.url,
    });
  } catch (error) {
    logger.error(
      'Unexpected error in RP checkout session creation',
      error instanceof Error ? error : undefined,
      {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
    );

    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
    }, { status: 500 });
  }
}
