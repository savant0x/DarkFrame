// API Route: /api/battle/attack
// Records a battle and returns the result
// Updated: 2026-05-15 — FID-20260515-BATTLE-SYSTEM-FIX: Added session auth, aligned with battleService
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { resolveBattle, recordBattle, applyBattleResults } from '@/lib';
import { BattleType } from '@/types';
import { 
  withRequestLogging, 
  createRouteLogger,
  BattleAttackSchema,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS
} from '@/lib';
import { recordDefeatEvent } from '@/lib/beerBaseAnalytics';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.battle);

const handler = rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('BattleAttackAPI');
  const endTimer = log.time('battleResolution');
  
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const authenticatedUsername = auth.playerId;

    const body = await req.json();
    const validated = BattleAttackSchema.parse(body);
    
    const { attacker, defender, factoryLocation, attackerUnits, defenderUnits } = body;
    
    if (!attacker || !defender || !factoryLocation || !attackerUnits || !defenderUnits) {
      log.warn('Battle attack missing required fields', { attacker, defender, hasLocation: !!factoryLocation });
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
        fields: ['attacker', 'defender', 'factoryLocation', 'attackerUnits', 'defenderUnits']
      });
    }

    if (attacker !== authenticatedUsername) {
      log.warn('Battle attack attempted as different user', { authenticated: authenticatedUsername, requested: attacker });
      return createErrorResponse(ErrorCode.AUTH_FORBIDDEN, { message: 'You can only initiate battles as yourself' });
    }
    
    log.debug('Resolving battle', { attacker, defender, location: factoryLocation });
    
    const battleLog = await resolveBattle(
      attackerUnits, defenderUnits, attacker, defender,
      BattleType.Factory, factoryLocation
    );

    await applyBattleResults(battleLog);
    
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
    
    if (defender.startsWith('🍺BeerBase-') && battleLog.outcome === 'ATTACKER_WIN') {
      try {
        const supabase = createServiceClient();
        const { data: defenderDoc } = await supabase
          .from('players')
          .select('is_special_base, resources_metal, resources_energy, created_at')
          .eq('username', defender)
          .maybeSingle();
        
        if (defenderDoc && defenderDoc.is_special_base) {
          const tierMatch = defender.match(/🍺BeerBase-(\w+)-/);
          const tierName = tierMatch ? tierMatch[1] : 'WEAK';
          
          const tierMap: Record<string, number> = {
            'WEAK': 0, 'MID': 1, 'STRONG': 2, 'ELITE': 3, 'ULTRA': 4, 'LEGENDARY': 5
          };
          const tierNumber = tierMap[tierName] || 0;
          
          const spawnTime = new Date(defenderDoc.created_at).getTime();
          const defeatTime = battleLog.timestamp.getTime();
          const timeAliveSeconds = Math.floor((defeatTime - spawnTime) / 1000);
          
          await recordDefeatEvent(tierNumber, attacker, {
            metal: defenderDoc.resources_metal || 0,
            energy: defenderDoc.resources_energy || 0
          }, timeAliveSeconds);
          
          log.debug('Beer Base defeat recorded for analytics', {
            tier: tierName, defeatedBy: attacker, timeAliveHours: (timeAliveSeconds / 3600).toFixed(2)
          });
        }
      } catch (analyticsError) {
        log.warn('Failed to record Beer Base defeat analytics', analyticsError);
      }
    }
    
    log.info('Battle resolved successfully', { attacker, defender, outcome: battleLog.outcome, captured: battleLog.outcome === 'ATTACKER_WIN' });
    
    return NextResponse.json({ success: true, battle: battleLog });
    
  } catch (error) {
    log.error('Battle attack failed', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
});

export const POST = withRequestLogging(handler);
