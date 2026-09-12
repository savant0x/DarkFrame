/**
 * @file __tests__/lib/rpDailyCap.test.ts
 * @overview FID-20260912-062 B3 — the global daily RP cap inside awardRP().
 *
 * Contract under test:
 *  - BASE earnings clamp to DAILY_RP_CAP per player per UTC day, all sources.
 *  - At-cap awards are refused (success: false, dailyCapRemaining: 0);
 *    partial awards clamp with the remainder exposed.
 *  - Multipliers (VIP +50%, flag-bearer ×2) apply AFTER the base clamp.
 *  - 'admin' bypasses the cap entirely (exact grants, no ledger traffic) and
 *    tags bypassedDailyCap on the rptransactions audit row.
 *  - The ledger upsert accumulates the granted BASE amount.
 *  - Fail-open: a ledger outage must never block gameplay rewards.
 *  - Day rollover: a fresh UTC ledger key means a fresh cap.
 *
 * Mock strategy: awardRP is raw-SQL heavy, so @/lib/db is mocked at the
 * statement level. A tiny renderer flattens drizzle `sql` templates (v0.45:
 * SQL text in StringChunk.value[], params as bare values) into
 * "text | p1 | p2" keys, and the mock routes on distinctive fragments.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { capture } = vi.hoisted(() => ({
  capture: {
    playerRow: {
      researchPoints: 100,
      vip: false,
      vipExpiration: null as string | null,
      rpHistory: [],
    } as Record<string, unknown>,
    ledger: 0,
    executed: [] as Array<{ key: string; params: string[] }>,
    failLedgerRead: false,
  },
}));

function renderSql(query: unknown): { key: string; params: string[] } {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  let text = '';
  const params: string[] = [];
  for (const chunk of chunks) {
    const value = (chunk as { value?: unknown }).value;
    if (Array.isArray(value)) text += value.join('');
    else params.push(String(chunk));
  }
  return { key: text, params };
}

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [capture.playerRow],
        }),
      }),
    }),
    update: () => ({
      set: (set: Record<string, unknown>) => ({
        where: async () => {
          capture.executed.push({
            key: 'PLAYERS_UPDATE',
            params: [String(set.researchPoints)],
          });
          return true;
        },
      }),
    }),
    execute: async (query: unknown) => {
      const { key, params } = renderSql(query);
      if (key.includes('INSERT INTO rpTransactions')) {
        capture.executed.push({ key: 'RPTRANSACTIONS_INSERT', params });
        return {};
      }
      if (key.includes('rp_daily_totals') && key.includes('INSERT INTO')) {
        capture.ledger += Number(params[2]); // (username, daykey, grantedBase)
        capture.executed.push({ key: 'LEDGER_UPSERT', params });
        return {};
      }
      if (key.includes('rp_daily_totals')) {
        if (capture.failLedgerRead) throw new Error('ledger unreachable');
        capture.executed.push({ key: 'LEDGER_SELECT', params });
        return { rows: [{ baserpedtoday: capture.ledger }] };
      }
      capture.executed.push({ key, params });
      return { rows: [] };
    },
  },
}));

vi.mock('@/lib/flagBonusService', () => ({
  isFlagBearer: vi.fn(async () => false),
}));

import { awardRP, DAILY_RP_CAP, getRPDayKey } from '@/lib/researchPointService';

describe('FID-20260912-062 B3: global daily RP cap', () => {
  beforeEach(() => {
    capture.playerRow = { researchPoints: 100, vip: false, vipExpiration: null, rpHistory: [] };
    capture.ledger = 0;
    capture.executed = [];
    capture.failLedgerRead = false;
  });

  it('awards normally under the cap and records base earnings in the ledger', async () => {
    const result = await awardRP('tester', 100, 'battle', 'Victory');
    expect(result.success).toBe(true);
    expect(result.rpAwarded).toBe(100);
    expect(result.dailyCapRemaining).toBe(DAILY_RP_CAP - 100); // post-award envelope
    expect(capture.ledger).toBe(100);
  });

  it('clamps partially when the award would exceed the cap', async () => {
    capture.ledger = DAILY_RP_CAP - 50;
    const result = await awardRP('tester', 500, 'battle', 'Victory');
    expect(result.success).toBe(true);
    expect(result.rpAwarded).toBe(50);
    expect(result.dailyCapRemaining).toBe(0); // envelope fully consumed
    expect(capture.ledger).toBe(DAILY_RP_CAP);
  });

  it('refuses awards once the cap is exhausted', async () => {
    capture.ledger = DAILY_RP_CAP;
    const result = await awardRP('tester', 100, 'battle', 'Victory');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Daily RP cap');
    expect(result.rpAwarded).toBe(0);
    expect(result.dailyCapRemaining).toBe(0);
    // Nothing persisted: no balance write, no ledger upsert, no audit row.
    expect(capture.executed.filter((e) => e.key === 'PLAYERS_UPDATE')).toHaveLength(0);
    expect(capture.executed.filter((e) => e.key === 'LEDGER_UPSERT')).toHaveLength(0);
    expect(capture.executed.filter((e) => e.key === 'RPTRANSACTIONS_INSERT')).toHaveLength(0);
  });

  it('VIP multiplier applies to the clamped amount, not the request', async () => {
    capture.playerRow.vip = true;
    capture.playerRow.vipExpiration = new Date(Date.now() + 86_400_000).toISOString();
    capture.ledger = DAILY_RP_CAP - 100;
    const result = await awardRP('tester', 500, 'battle', 'Victory');
    expect(result.rpAwarded).toBe(150); // clamp 100 → ×1.5 VIP
    expect(capture.ledger).toBe(DAILY_RP_CAP); // ledger tracks BASE only
  });

  it('admin source bypasses the cap and tags the audit row', async () => {
    capture.ledger = DAILY_RP_CAP;
    const result = await awardRP('tester', 5000, 'admin', 'Compensation grant');
    expect(result.success).toBe(true);
    expect(result.rpAwarded).toBe(5000);
    expect(result.dailyCapRemaining).toBeUndefined();
    // No ledger reads or writes for admin grants.
    expect(capture.executed.filter((e) => e.key.startsWith('LEDGER_'))).toHaveLength(0);
    const audit = capture.executed.find((e) => e.key === 'RPTRANSACTIONS_INSERT');
    expect(audit).toBeDefined();
    expect(audit!.params[audit!.params.length - 1]).toBe('1'); // bypassedDailyCap
  });

  it('fails open when the cap ledger is unreachable', async () => {
    capture.failLedgerRead = true;
    const result = await awardRP('tester', 1000, 'battle', 'Victory');
    expect(result.success).toBe(true);
    expect(result.rpAwarded).toBe(1000);
    // The post-award ledger write still attempts to record the grant.
    expect(capture.ledger).toBe(1000);
  });

  it('resets with the UTC day key', async () => {
    capture.ledger = DAILY_RP_CAP;
    const refused = await awardRP('tester', 100, 'battle', 'Victory');
    expect(refused.success).toBe(false);
    // Simulate the day rolling over: a new (player, daykey) row reads zero.
    capture.ledger = 0;
    const after = await awardRP('tester', 100, 'battle', 'Victory');
    expect(after.success).toBe(true);
    expect(getRPDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('accumulates base earnings across sources into one envelope', async () => {
    await awardRP('tester', 100, 'battle', 'Victory');
    await awardRP('tester', 160, 'daily_login', 'Streak');
    await awardRP('tester', 200, 'harvest_milestone', 'Milestone');
    expect(capture.ledger).toBe(460);
    expect(capture.executed.filter((e) => e.key === 'LEDGER_UPSERT')).toHaveLength(3);
  });
});
