// API Route: /api/battle/attack
// Records a battle and returns the result
// Modified: 2025-10-24 - Phase 3.1: Added Zod validation and structured error handling
import { NextRequest, NextResponse } from 'next/server';
import { recordBattle, resolveBattle } from '@/lib';
import { BattleType } from '@/types';
import { 
  withRequestLogging, 
  createRouteLogger,
  BattleAttackSchema,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  requireAuth
} from '@/lib';
import { recordDefeatEvent } from '@/lib/beerBaseAnalytics';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.battle);

const handler = rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('BattleAttackAPI');
  const endTimer = log.time('battleResolution');
  
  try {
    const body = await req.json();
    const validated = BattleAttackSchema.parse(body);
    
    log.debug('Battle attack initiated', { 
      target: validated.targetUsername,
      unitCount: Object.keys(validated.units).length 
    });
    
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    
    const { attacker, defender, factoryLocation, attackerUnits, defenderUnits } = body;
    
    if (!attacker || !defender || !factoryLocation || !attackerUnits || !defenderUnits) {
      log.warn('Battle attack missing required fields', { attacker, defender, hasLocation: !!factoryLocation });
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
        fields: ['attacker', 'defender', 'factoryLocation', 'attackerUnits', 'defenderUnits']
      });
    }
    
    log.debug('Resolving battle', { attacker, defender, location: factoryLocation });
    
    const battleLog = await resolveBattle(
      attackerUnits,
      defenderUnits,
      attacker,
      defender,
      BattleType.Factory,
      factoryLocation
    );
    
    await recordBattle({
      attacker: battleLog.attacker.username,
      defender: battleLog.defender.username,
      winner: battleLog.outcome === 'ATTACKER_WIN' ? battleLog.attacker.username : (battleLog.outcome === 'DEFENDER_WIN' ? battleLog.defender.username : ''),
      factoryLocation: battleLog.location ?? factoryLocation,
      attackerPower: battleLog.attacker.totalSTR,
      defenderPower: battleLog.defender.totalDEF,
      factoryCaptured: battleLog.outcome === 'ATTACKER_WIN',
      timestamp: battleLog.timestamp,
      details: battleLog,
    });
    
    // Beer Base usernames: legacy '🍺BeerBase-<TIER>-…' or compact 'b<TIER><ts8><rand4>'
    const isBeerBase = defender.startsWith('🍺BeerBase-') || /^b[WMSEUL]\d{12}$/.test(defender);
    if (isBeerBase && battleLog.outcome === 'ATTACKER_WIN') {
      try {
        const defenderDocResult = await db.select().from(players).where(eq(players.username, defender)).limit(1);
        const defenderDoc = defenderDocResult[0];
        
        if (defenderDoc && defenderDoc.isSpecialBase) {
          const compactTier = defender.match(/^b([WMSEUL])\d{12}$/);
          const tierName = compactTier
            ? ({ W: 'WEAK', M: 'MID', S: 'STRONG', E: 'ELITE', U: 'ULTRA', L: 'LEGENDARY' } as Record<string, string>)[compactTier[1]] ?? 'WEAK'
            : defender.match(/🍺BeerBase-(\w+)-/)?.[1] ?? 'WEAK';
          
          const tierMap: Record<string, number> = {
            'WEAK': 0, 'MID': 1, 'STRONG': 2, 'ELITE': 3, 'ULTRA': 4, 'LEGENDARY': 5
          };
          const tierNumber = tierMap[tierName] || 0;
          
          const spawnTime = defenderDoc.createdAt;
          const defeatTime = battleLog.timestamp;
          const timeAliveSeconds = Math.floor((defeatTime.getTime() - (spawnTime ? spawnTime.getTime() : Date.now())) / 1000);
          
          await recordDefeatEvent(
            tierNumber,
            attacker,
            {
              metal: Number(defenderDoc.resourcesMetal || 0),
              energy: Number(defenderDoc.resourcesEnergy || 0)
            },
            timeAliveSeconds
          );
          
          log.debug('Beer Base defeat recorded for analytics', {
            tier: tierName,
            defeatedBy: attacker,
            timeAliveHours: (timeAliveSeconds / 3600).toFixed(2)
          });
        }
      } catch (analyticsError) {
        log.warn('Failed to record Beer Base defeat analytics', analyticsError);
      }
    }
    
    log.info('Battle resolved successfully', { 
      attacker, 
      defender, 
      outcome: battleLog.outcome,
      captured: battleLog.outcome === 'ATTACKER_WIN'
    });
    
    return NextResponse.json({ success: true, battle: battleLog });
    
  } catch (error) {
    log.error('Battle attack failed', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
});

export const POST = withRequestLogging(handler);
