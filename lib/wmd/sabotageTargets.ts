/**
 * FID-20260916-011: sabotage-target enumeration service.
 *
 * One read-only query per target type. The victim identity returned here is
 * the SAME identity executeSabotage's resolveSabotageTarget derives at fire
 * time (missile/research owner -> players.username; battery -> clan leader),
 * so the panel's preview shows the truth the protection void will hit.
 *
 * Listing uses targeted asset filters (a sabotaged missile is not a launchable
 * one); these mirror the assets' own operational status vocabulary. Refusals
 * stay server-side: the fire path re-derives and re-validates everything.
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  wmdSpies,
  missiles,
  wmdDefenseBatteries,
  playerResearch,
} from '@/lib/db/schema/wmd';
import { players } from '@/lib/db/schema/players';
import { clans } from '@/lib/db/schema/clans';
import { protectionActive } from '@/lib/playerProtection';
import {
  getSabotageDifficulty,
  getBaseDetectionRisk,
  SABOTAGE_SKILL_FLOOR,
  type SabotageTargetType,
} from './sabotageMath';

/** A sabotagable asset as the panel's target picker consumes it. */
export interface SabotageTargetOption {
  targetType: SabotageTargetType;
  targetId: string;
  /** Human label for the asset itself. */
  label: string;
  /** Victim identity the fire path will derive (and the void will hit). */
  victimKind: 'PLAYER' | 'CLAN';
  victimId: string;
  victimUsername: string | null;
  protected: boolean;
  /** Difficulty / base detection from the shared math module — display only. */
  difficulty: number;
  detectionRisk: number;
  /** FID-20261002-008 §5.6: whether the target can actually take effect right
   * now (batteries: IDLE/COOLDOWN only — DAMAGED/UPGRADING are unavailable;
   * research: an active tech with destructible RP; missiles: listed states are
   * eligible). Display alignment ONLY — the fire path re-derives everything
   * under lock. */
  eligible: boolean;
  /** Why a target is currently ineligible (display only). */
  statusNote?: string;
}

export interface SabotageTargetsResult {
  success: boolean;
  message?: string;
  missiles?: SabotageTargetOption[];
  batteries?: SabotageTargetOption[];
  research?: SabotageTargetOption[];
}

function toOption(
  targetType: SabotageTargetType,
  targetId: string,
  label: string,
  victimKind: 'PLAYER' | 'CLAN',
  victimId: string,
  victimUsername: string | null,
  protectionUntil: Date | string | null,
  eligible = true,
  statusNote?: string
): SabotageTargetOption {
  return {
    targetType,
    targetId,
    label,
    victimKind,
    victimId,
    victimUsername,
    protected: protectionUntil !== null && protectionActive(protectionUntil),
    difficulty: getSabotageDifficulty(targetType),
    detectionRisk: getBaseDetectionRisk(targetType),
    eligible,
    ...(statusNote ? { statusNote } : {}),
  };
}

/**
 * Enumerate every sabotagable asset visible to the spy's operator scope:
 * the spy's own owner plus (when the spy is clan-assigned) the clan, mirroring
 * how mission targeting scopes. Returns the three lists separately; any list
 * may be empty.
 */
export async function getSabotageTargets(spyId: string): Promise<SabotageTargetsResult> {
  try {
    const [spy] = await db
      .select({
        ownerId: wmdSpies.ownerId,
        clanId: wmdSpies.clanId,
        skillsSabotage: wmdSpies.skillsSabotage,
      })
      .from(wmdSpies)
      .where(eq(wmdSpies.spyId, spyId))
      .limit(1);

    if (!spy) {
      return { success: false, message: 'Spy not found' };
    }

    if (spy.skillsSabotage < SABOTAGE_SKILL_FLOOR) {
      return {
        success: false,
        message: `Spy lacks sufficient sabotage skills (minimum ${SABOTAGE_SKILL_FLOOR})`,
      };
    }

    // Listing is GLOBAL per FID §5 ("every sabotagable asset") — the fire path
    // validates any existing asset, so the preview must show the same universe.

    // MISSILE — victim derived exactly like resolveSabotageTarget:
    // missiles.ownerId -> players.username. Only operationally intact warheads
    // are listed (READY/STORED); fired/intercepted missiles are not targets.
    const missileRows = await db
      .select({
        missileId: missiles.missileId,
        warheadType: missiles.warheadType,
        status: missiles.status,
        ownerId: missiles.ownerId,
        username: players.username,
        protectionUntil: players.protectionUntil,
      })
      .from(missiles)
      .innerJoin(players, eq(players.username, missiles.ownerId))
      .where(inArray(missiles.status, ['READY', 'STORED']));

    // DEFENSE_BATTERY — battery -> clan -> leader (the fire path refuses on
    // the leader's window, so the leader is the victim shown). FID-20261002-008:
    // the status rides the option so the panel can mark DAMAGED/UPGRADING
    // batteries unavailable (the truthful engine refuses them under lock).
    const batteryRows = await db
      .select({
        batteryId: wmdDefenseBatteries.batteryId,
        clanId: wmdDefenseBatteries.clanId,
        status: wmdDefenseBatteries.status,
        clanName: clans.name,
        username: players.username,
        protectionUntil: players.protectionUntil,
      })
      .from(wmdDefenseBatteries)
      .innerJoin(clans, eq(clans.id, wmdDefenseBatteries.clanId))
      .innerJoin(players, eq(players.username, clans.leaderId));

    // RESEARCH — row id -> owner player (username-keyed). FID-20261002-008:
    // rows without an active tech (or without destructible RP) are listed but
    // marked ineligible — sabotaging them is a truthful no-effect, not damage.
    const researchRows = await db
      .select({
        id: playerResearch.id,
        playerId: playerResearch.playerId,
        playerUsername: playerResearch.playerUsername,
        currentTech: playerResearch.currentResearchTechId,
        rpSpent: playerResearch.currentResearchRpSpent,
        username: players.username,
        protectionUntil: players.protectionUntil,
      })
      .from(playerResearch)
      .innerJoin(players, eq(players.username, playerResearch.playerId));

    return {
      success: true,
      missiles: missileRows.map((r) =>
        toOption('MISSILE', r.missileId, `${r.warheadType} warhead (${r.status.toLowerCase()})`, 'PLAYER', r.ownerId, r.username, r.protectionUntil)
      ),
      batteries: batteryRows.map((r) => {
        const eligible = r.status === 'IDLE' || r.status === 'COOLDOWN';
        return toOption(
          'DEFENSE_BATTERY',
          r.batteryId,
          `${r.clanName} defense battery`,
          'CLAN',
          r.clanId,
          r.username,
          r.protectionUntil,
          eligible,
          eligible ? undefined : `Battery is ${r.status.toLowerCase()} — unavailable`
        );
      }),
      research: researchRows.map((r) => {
        const eligible = !!r.currentTech && (r.rpSpent ?? 0) > 0;
        return toOption(
          'RESEARCH',
          r.id,
          `${r.playerUsername}'s research`,
          'PLAYER',
          r.playerId,
          r.username,
          r.protectionUntil,
          eligible,
          eligible ? undefined : !r.currentTech ? 'No active research in progress' : 'Active research has no RP progress yet'
        );
      }),
    };
  } catch (error) {
    console.error('Error enumerating sabotage targets:', error);
    return { success: false, message: 'Failed to enumerate sabotage targets' };
  }
}
