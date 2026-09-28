/**
 * FID-20260928-008 — raid telemetry pins.
 *
 * The telemetry adds ONE new write (hostility-gate refusals → player_activity
 * rows via logRaidRefusal) and ONE admin read endpoint; outcome/loot/casualty
 * aggregates read battle_logs BASE_RAID rows that already persist. Pins:
 *   - the refusal action is a lawful PlayerActionType (compile-time + value)
 *   - the raid route writes telemetry BEFORE refusing, with the verdict reason
 *   - the admin endpoint is admin-gated, clamps its params, and degrades
 *     structurally (outcomes may be null — never a throw into the panel)
 * Mirror/static-contract style for the route/endpoint shapes (defeatBookkeeping
 * precedent); the readers themselves are best-effort DB wrappers whose failure
 * path is the null/[] contract documented in lib/raidTelemetry.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RAID_REFUSAL_ACTION } from '@/lib/raidTelemetry';
import type { PlayerActionType } from '@/types';

const ROOT = path.resolve(__dirname, '..', '..'); // __tests__/lib/ → project root

describe('FID-20260928-008: the refusal action is a lawful PlayerActionType', () => {
  it('RAID_REFUSAL_ACTION matches the union member added to game.types', () => {
    expect(RAID_REFUSAL_ACTION).toBe('raid_refusal');
    // Compile-time pin: this assignment fails tsc if the union drifts.
    const lawful: PlayerActionType = RAID_REFUSAL_ACTION;
    expect(lawful).toBe('raid_refusal');
  });

  it('the union member carries the FID citation comment', () => {
    const types = fs.readFileSync(path.join(ROOT, 'types/game.types.ts'), 'utf8');
    expect(types).toMatch(/'raid_refusal'\s+\/\/ FID-20260928-008/);
  });
});

describe('FID-20260928-008: the raid route writes telemetry before refusing', () => {
  const route = fs.readFileSync(path.join(ROOT, 'app/api/combat/attack/route.ts'), 'utf8');

  it('the hostility gate imports and awaits logRaidRefusal (non-throwing telemetry)', () => {
    expect(route).toContain("import { logRaidRefusal } from '@/lib/activityLogger'");
    expect(route).toMatch(/await logRaidRefusal\(\{[\s\S]*?reason: verdict\.reason \?\? 'unknown'/);
  });

  it('the refusal write precedes the VALIDATION_FAILED response (ordering pin)', () => {
    const writeIdx = route.indexOf('await logRaidRefusal({');
    const refuseIdx = route.indexOf("return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: verdict.reason });", writeIdx);
    expect(writeIdx).toBeGreaterThan(-1);
    expect(refuseIdx).toBeGreaterThan(writeIdx);
  });

  it('the response contract is unchanged: the player still sees the verdict reason verbatim', () => {
    expect(route).toContain('{ message: verdict.reason }');
  });
});

describe('FID-20260928-008: logRaidRefusal is the single write path', () => {
  it('activityLogger exports it with the metadata shape the reader aggregates on', () => {
    const logger = fs.readFileSync(path.join(ROOT, 'lib/activityLogger.ts'), 'utf8');
    expect(logger).toMatch(/export async function logRaidRefusal\(/);
    // The pair aggregation keys on metadata ->>'attacker' / ->>'defender':
    expect(logger).toMatch(/attacker: params\.attacker/);
    expect(logger).toMatch(/defender: params\.defender/);
    expect(logger).toMatch(/reason: params\.reason/);
  });

  it('the reader derives pairs from the same action constant (one source of truth)', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'lib/raidTelemetry.ts'), 'utf8');
    expect(lib).toContain("eq(playerActivity.action, RAID_REFUSAL_ACTION)");
  });
});

describe('FID-20260928-008: the admin endpoint is gated, clamped, and structurally safe', () => {
  const endpoint = fs.readFileSync(path.join(ROOT, 'app/api/admin/raid-telemetry/route.ts'), 'utf8');

  it('admin-gated on the standard pattern', () => {
    expect(endpoint).toContain('getAuthenticatedUser()');
    expect(endpoint).toContain('tokenPayload.isAdmin !== true');
    expect(endpoint).toContain('ADMIN_ACCESS_REQUIRED');
  });

  it('params are clamped (windowHours ≤ 2160, limit ≤ 200)', () => {
    expect(endpoint).toContain('Math.min(2160');
    expect(endpoint).toContain('Math.min(200');
  });

  it('degrades structurally: outcomes may be null, the panel never gets a 500 from a read', () => {
    expect(endpoint).toContain('outcomes, // null ⇒ reader failed');
    expect(endpoint).toContain('refusalPairs');
    expect(endpoint).toContain('tuningTargets');
  });

  it('aggregates read the persistent raid record, not a new store', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'lib/raidTelemetry.ts'), 'utf8');
    expect(lib).toContain("eq(battleLogs.battleType, 'BASE_RAID')");
    expect(lib).toContain('playerActivity');
  });
});
