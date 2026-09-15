// @vitest-environment node
/**
 * Row-51 guard additions — header numeric claims pinned to code truth.
 *
 * The HEADER-DRIFT-SWEEP audit found player-facing numbers living only in
 * prose. Three pins (ladder-truth pattern: documented claim ↔ executed code):
 *
 *   #4a summoning config — SUMMONING_CONFIG constants equal the header's
 *       promises (5 bots, 20-tile radius, 1.5× resources, 168h cooldown).
 *   #4b summoning behavior — the 1.5× multiplier is APPLIED at L118-119
 *       (captured insert rows), and the 168h cooldown gates through
 *       getSummoningStatus boundaries (unexpired → blocked with ceil'd
 *       hours; expired/absent → open).
 *   #5  ranking parity — calculateEffectivePower mirrors balanceService
 *       exactly (floor(total × powerMultiplier), status passthrough) across
 *       every band and boundary, so the header's band table can never
 *       silently diverge from the single source again.
 *   #3  age/tier caps — getMaxArmySize pins the 20×tier ladder AND the
 *       1×/1.5×/2× age steps (with the 7d/30d boundaries) through behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectRows: { rows: Array<Record<string, unknown>> } = { rows: [] };
const inserted: { values: Array<Record<string, unknown>> } = { values: [] };

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({ where: () => ({ limit: async () => selectRows.rows }) }),
    })),
    insert: vi.fn(() => ({
      values: async (v: Array<Record<string, unknown>>) => {
        inserted.values = v;
      },
    })),
    update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
  },
}));
vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return { ...actual };
});
vi.mock('@/lib/botService', () => ({
  createBotPlayer: vi.fn(async () => ({
    username: 'summoned',
    resources: { metal: 1000, energy: 2000, food: 0 },
    botConfig: {},
    base: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    units: [],
  })),
}));
vi.mock('@/lib/playerService', () => ({
  mapDomainPlayerToRow: (d: unknown) => d,
}));

import {
  summonBots,
  getSummoningStatus,
  SUMMONING_CONFIG,
} from '@/lib/botSummoningService';
import { calculateEffectivePower } from '@/lib/rankingService';
import { calculateBalanceEffects } from '@/lib/balanceService';
import { getMaxArmySize } from '@/lib/botGrowthEngine';
import { BotSpecialization } from '@/types/game.types';

const HOUR = 3600_000;

beforeEach(() => {
  selectRows.rows = [];
  inserted.values = [];
});

describe('row-51 #4a — summoning config equals the header promises', () => {
  it('5 bots, 20-tile radius, 1.5× resources, 168h cooldown', () => {
    expect(SUMMONING_CONFIG.BOT_COUNT).toBe(5);
    expect(SUMMONING_CONFIG.SPAWN_RADIUS).toBe(20);
    expect(SUMMONING_CONFIG.RESOURCE_MULTIPLIER).toBe(1.5);
    expect(SUMMONING_CONFIG.COOLDOWN_HOURS).toBe(168);
  });
});

describe('row-51 #4b — summoning behavior (multiplier applied, cooldown gates)', () => {
  it('applies the 1.5× resource multiplier to every summoned bot', async () => {
    selectRows.rows = [{ username: 'caller', unlockedTechs: ['bot-summoning-circle'] }];
    const res = await summonBots('caller', { x: 75, y: 75 }, BotSpecialization.Hoarder);
    expect(res.success).toBe(true);
    expect(inserted.values).toHaveLength(5);
    for (const row of inserted.values) {
      const r = row.resources as { metal: number; energy: number };
      expect(r.metal).toBe(1500); // floor(1000 × 1.5)
      expect(r.energy).toBe(3000); // floor(2000 × 1.5)
    }
  });

  it('cooldown: unknown player cannot summon; fresh player can', async () => {
    selectRows.rows = [];
    expect(await getSummoningStatus('ghost')).toEqual({ canSummon: false });
    selectRows.rows = [{ username: 'fresh' }];
    expect(await getSummoningStatus('fresh')).toEqual({ canSummon: true });
  });

  it('cooldown: 169h-old summon is expired (open), 1h-old is blocked at 167h', async () => {
    selectRows.rows = [{ username: 'veteran', lastBotSummon: new Date(Date.now() - 169 * HOUR) }];
    const open = await getSummoningStatus('veteran');
    expect(open.canSummon).toBe(true);
    selectRows.rows = [{ username: 'recent', lastBotSummon: new Date(Date.now() - 1 * HOUR) }];
    const blocked = await getSummoningStatus('recent');
    expect(blocked.canSummon).toBe(false);
    expect(blocked.hoursRemaining).toBe(167);
  });
});

describe('row-51 #5 — ranking mirrors balanceService (parity sweep)', () => {
  const cases: Array<[number, number]> = [
    [200, 50], // CRITICAL 0.25
    [70, 100], // IMBALANCED boundary 0.7 (strict < keeps it out of CRITICAL)
    [80, 100], // IMBALANCED 0.8
    [85, 100], // BALANCED boundary (0.85 escapes IMBALANCED, misses OPTIMAL)
    [90, 100], // BALANCED 0.9
    [95, 100], // OPTIMAL boundary
    [100, 100], // OPTIMAL 1.0
    [4000, 5000], // header docstring example → 7200
    [0, 5000], // degenerate mono army (ratio 0 → CRITICAL)
  ];
  it.each(cases)('(%i STR, %i DEF) power and status equal balanceService truth', (s, d) => {
    const truth = calculateBalanceEffects(s, d);
    expect(calculateEffectivePower({ totalStrength: s, totalDefense: d })).toBe(
      Math.floor((s + d) * truth.powerMultiplier)
    );
  });

  it('header docstring example: 4000/5000 → 7200 (9000 × 0.8)', () => {
    expect(calculateEffectivePower({ totalStrength: 4000, totalDefense: 5000 })).toBe(7200);
  });

  it('zero army has zero power', () => {
    expect(calculateEffectivePower({ totalStrength: 0, totalDefense: 0 })).toBe(0);
  });
});

describe('row-51 #3 — age/tier army caps (20×tier ladder × 1/1.5/2 age steps)', () => {
  it('full table: tiers 1–7 × young/veteran/legendary', () => {
    for (let tier = 1; tier <= 7; tier += 1) {
      const base = 20 * tier;
      expect(getMaxArmySize(tier, 1)).toBe(base);
      expect(getMaxArmySize(tier, 10)).toBe(Math.floor(base * 1.5));
      expect(getMaxArmySize(tier, 40)).toBe(base * 2);
    }
  });

  it('age boundaries: 7d and 30d step up exactly', () => {
    expect(getMaxArmySize(3, 6.999)).toBe(60);
    expect(getMaxArmySize(3, 7)).toBe(90);
    expect(getMaxArmySize(3, 29.999)).toBe(90);
    expect(getMaxArmySize(3, 30)).toBe(120);
  });
});
