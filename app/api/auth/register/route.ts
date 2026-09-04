/**
 * @file app/api/auth/register/route.ts
 * @created 2025-10-16
 * @updated 2025-10-24 (Phase 2: Production infrastructure - validation, errors, rate limiting)
 * @overview Registration endpoint with email/password authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPlayerWithAuth } from '@/lib/playerService';
import { getTileAt } from '@/lib/movementService';
import { hashPassword, generateToken } from '@/lib/authService';
import { 
  validateReferralCode,
  createReferralRecord,
  generateReferralCode,
  generateReferralLink,
  checkForAbuse
} from '@/lib/referralService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  RegisterSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.register);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AuthRegister');
  const endTimer = log.time('registerProcess');
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = RegisterSchema.parse(body);
    const { username, email, password } = validated;
    const referralCode = body.referralCode || null; // Optional referral code
    
    log.debug('Registration attempt', { username, email, hasReferralCode: !!referralCode });
    
    // Get IP address for abuse detection
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    // Validate referral code if provided
    let referrerUsername: string | null = null;
    if (referralCode) {
      const codeValidation = await validateReferralCode(referralCode);
      if (!codeValidation.valid) {
        return NextResponse.json({
          success: false,
          error: `Invalid referral code: ${codeValidation.error}`
        }, { status: 400 });
      }
      
      // Check for abuse patterns
      const abuseCheck = await checkForAbuse(email, ip, referralCode);
      if (!abuseCheck.allowed) {
        log.warn('Referral abuse detected', { email, ip, reason: abuseCheck.reason });
        return NextResponse.json({
          success: false,
          error: abuseCheck.reason
        }, { status: 403 });
      }
      
      if (abuseCheck.riskLevel === 'medium' || abuseCheck.riskLevel === 'high') {
        log.warn('Referral risk detected', { email, ip, flags: abuseCheck.flags, risk: abuseCheck.riskLevel });
      }
      
      referrerUsername = codeValidation.referrerUsername || null;
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create player
    const player = await createPlayerWithAuth(username, email, hashedPassword);
    
    // Generate unique referral code for new player
    let newPlayerCode = generateReferralCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.select().from(players).where(eq(players.referralCode, newPlayerCode)).limit(1);
      if (!existing.length) break;
      newPlayerCode = generateReferralCode();
      attempts++;
    }
    
    const newPlayerLink = generateReferralLink(newPlayerCode);
    
    // Track referral usage (welcome package awarded on tutorial completion)
    if (referralCode) {
      // Update new player with referral tracking (resources awarded on tutorial completion)
      await db.update(players).set({
        referralCode: newPlayerCode,
        referralLink: newPlayerLink,
        referredBy: referralCode,
        referredByUsername: referrerUsername,
        referralValidated: 0,
        signupIP: ip,
        totalReferrals: 0,
        pendingReferrals: 0,
        referralRewardsMetal: 0,
        referralRewardsEnergy: 0,
        referralRewardsRp: 0,
        referralRewardsXp: 0,
        referralRewardsVipDays: 0,
        referralTitles: [],
        referralBadges: [],
        referralMultiplier: '1.0',
        referralMilestonesReached: [],
      }).where(eq(players.username, username));
      
      // Create referral record
      await createReferralRecord(referralCode, player, ip);
      
      log.info('Referral code tracked - welcome package will be awarded on tutorial completion', { 
        username,
        referredBy: referrerUsername
      });
    } else {
      // No referral code - just set up their referral code (starter package on tutorial completion)
      await db.update(players).set({
        referralCode: newPlayerCode,
        referralLink: newPlayerLink,
        signupIP: ip,
        totalReferrals: 0,
        pendingReferrals: 0,
        referralRewardsMetal: 0,
        referralRewardsEnergy: 0,
        referralRewardsRp: 0,
        referralRewardsXp: 0,
        referralRewardsVipDays: 0,
        referralTitles: [],
        referralBadges: [],
        referralMultiplier: '1.0',
        referralMilestonesReached: [],
      }).where(eq(players.username, username));
    }
    
    log.info('Registration successful', { username, email, referredBy: referrerUsername });
    
    // Generate JWT token (new players are not admins by default)
    const token = generateToken(player.username, player.email, false, false);
    
    // Get current tile
    const currentTile = await getTileAt(
      player.currentPosition.x,
      player.currentPosition.y
    );
    
    // Get updated player data with welcome package
    const updatedPlayerResult = await db.select().from(players).where(eq(players.username, username)).limit(1);
    const updatedPlayer = updatedPlayerResult[0] || player;
    
    // Remove password from response
    const playerWithoutPassword: Record<string, unknown> = { ...(updatedPlayer || player) } as Record<string, unknown>;
    delete playerWithoutPassword.password;
    
    // Set httpOnly cookie
    const response = NextResponse.json({
      success: true,
      data: {
        player: playerWithoutPassword,
        currentTile,
        token,
        welcomePackagePending: referralCode ? 'FULL_WELCOME' : 'STARTER',
        welcomePackageMessage: referralCode 
          ? 'Complete the tutorial to claim your full Welcome Package (50k Metal + 50k Energy + Legendary Digger + VIP Trial)!'
          : 'Complete the tutorial to claim your Starter Package (25k Metal + 25k Energy + Rare Digger + XP Boost)!'
      }
    }, { status: 201 });
    
    // Set secure session cookie — MUST be 'darkframe_session': that is the name middleware.ts,
    // the WebSocket auth, and lib/authService.setAuthCookie all read.
    response.cookies.set('darkframe_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    // Set playerId cookie for inventory and other endpoints
    response.cookies.set('playerId', player.username, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    return response;
    
  } catch (error) {
    log.error('Registration error', error as Error);
    
    // Handle validation errors
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    
    // Handle duplicate username/email (from MongoDB unique index)
    if (error instanceof Error && error.message.includes('duplicate')) {
      if (error.message.toLowerCase().includes('username')) {
        return createErrorResponse(ErrorCode.AUTH_USERNAME_ALREADY_EXISTS);
      }
      if (error.message.toLowerCase().includes('email')) {
        return createErrorResponse(ErrorCode.AUTH_EMAIL_ALREADY_EXISTS);
      }
    }
    
    // Handle all other errors
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// END OF FILE
// ============================================================
