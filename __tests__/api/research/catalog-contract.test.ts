/**
 * @file __tests__/api/research/catalog-contract.test.ts
 * @overview FID-20260912-058 T1 contract — "the route sells exactly what the
 * UI shows" is now structural, and these tests keep it that way.
 *
 * Architecture under contract: lib/research/techCatalog.ts is the single
 * source of truth; GET /api/research exposes it (catalog + catalogTotalRp);
 * the Tech Tree view hydrates ENTIRELY from that GET payload — it carries no
 * local catalog. Therefore route catalog == UI catalog by construction, and
 * these tests pin the two halves of that construction:
 *
 *   1. POST accepts every id GET advertises (sellable == shown), with the
 *      wire price identical to the catalog, and refuses unknown ids.
 *   2. The view file cannot quietly grow a local mock again (source-level
 *      tripwire) and renders from the hydrated state.
 *
 * Reference defect (FID-057): the route sold 6 effectless techs while the UI
 * advertised 6 functional bot techs the route refused to sell.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TECH_CATALOG,
  TECH_CATALOG_BY_ID,
  TECH_CATALOG_TOTAL_RP,
} from '@/lib/research/techCatalog';

const { capture } = vi.hoisted(() => ({
  capture: {
    playerRow: { unlockedTechs: null as string[] | null, researchPoints: 0 } as {
      unlockedTechs: string[] | null;
      researchPoints: number;
    },
    updates: [] as Array<{ set: Record<string, unknown> }>,
    spendCalls: [] as Array<{ playerId: string; amount: number; reason: string }>,
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: vi.fn(async () => ({ username: 'tester', playerId: 'tester', isAdmin: false })),
}));

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
          capture.updates.push({ set });
        },
      }),
    }),
  },
}));

vi.mock('@/lib/db/schema', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/schema')>()),
  players: { username: 'username', unlockedTechs: 'unlocked_techs' },
}));

vi.mock('@/lib/xpService', () => ({
  spendResearchPoints: vi.fn(async (playerId: string, amount: number, reason: string) => {
    capture.spendCalls.push({ playerId, amount, reason });
    if (capture.playerRow.researchPoints < amount) {
      return {
        success: false,
        newBalance: capture.playerRow.researchPoints,
        message: `Insufficient research points. Need ${amount}, have ${capture.playerRow.researchPoints}`,
      };
    }
    const newBalance = capture.playerRow.researchPoints - amount;
    capture.playerRow.researchPoints = newBalance;
    return { success: true, newBalance, message: `Spent ${amount} RP on ${reason}` };
  }),
}));

vi.mock('@/lib/activityLogger', () => ({
  logTechUnlock: vi.fn(async () => undefined),
}));

vi.mock('@/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib')>();
  return {
    ...actual,
    createRateLimiter: () => (fn: unknown) => fn,
    withRequestLogging: (fn: unknown) => fn,
  };
});

import { GET as researchGET, POST as researchPOST } from '@/app/api/research/route';

type RouteHandler = (req?: NextRequest) => Promise<Response>;
const POST = researchPOST as unknown as RouteHandler;
const GET = researchGET as unknown as RouteHandler;

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('T1 contract — GET advertises exactly what POST sells', () => {
  beforeEach(() => {
    capture.updates.length = 0;
    capture.spendCalls.length = 0;
    capture.playerRow = { unlockedTechs: null, researchPoints: 0 };
  });

  it('GET exposes the shared catalog with a consistent total', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.catalog).toEqual(TECH_CATALOG);
    expect(data.catalogTotalRp).toBe(TECH_CATALOG_TOTAL_RP);
    expect(data.catalogTotalRp).toBe(
      (data.catalog as Array<{ cost: number }>).reduce((s, t) => s + t.cost, 0)
    );
  });

  it('POST accepts EVERY id the catalog advertises, at the catalog price', async () => {
    for (const tech of TECH_CATALOG) {
      capture.updates.length = 0;
      capture.spendCalls.length = 0;
      // Seed the tech's prerequisite chain — the route enforces prereqs, so
      // a chain tech is only sellable once its parents are unlocked.
      capture.playerRow = { unlockedTechs: [...tech.prerequisites], researchPoints: 1_000_000 };

      const res = await POST(post({ technologyId: tech.id }));
      const data = await res.json();

      expect(data.success, `POST must sell catalog id '${tech.id}'`).toBe(true);
      expect(capture.spendCalls).toHaveLength(1);
      expect(capture.spendCalls[0].amount).toBe(tech.cost);
      // The route persists the FULL set (existing + new), so a chain tech's
      // unlock row carries its parents too.
      expect(capture.updates[0]?.set.unlockedTechs).toEqual([
        ...tech.prerequisites,
        tech.id,
      ]);
    }
  });

  it('refuses a catalog tech whose prerequisites are unmet (chain is enforced)', async () => {
    const chained = TECH_CATALOG.find((t) => t.prerequisites.length > 0);
    expect(chained).toBeDefined();
    capture.playerRow = { unlockedTechs: null, researchPoints: 1_000_000 };

    const res = await POST(post({ technologyId: chained!.id }));
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(capture.spendCalls).toHaveLength(0);
  });

  it('refuses an id that is NOT in the catalog (no dead content returns)', async () => {
    capture.playerRow = { unlockedTechs: null, researchPoints: 1_000_000 };
    const res = await POST(post({ technologyId: 'factory-automation' }));
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(capture.spendCalls).toHaveLength(0);
  });

  it('every catalog id is unique and every prerequisite is itself sellable', () => {
    const ids = TECH_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tech of TECH_CATALOG) {
      for (const prereq of tech.prerequisites) {
        expect(
          TECH_CATALOG_BY_ID.has(prereq),
          `'${tech.id}' requires '${prereq}' which the catalog does not sell`
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// View-side tripwire — the UI must render the ROUTE's catalog, not its own.
// ---------------------------------------------------------------------------

const VIEW_PATH = resolve(process.cwd(), 'app/tech-tree/TechTreeView.tsx');

describe('T1 contract — Tech Tree view hydrates from the route (no local mock)', () => {
  let viewSource = '';
  try {
    viewSource = readFileSync(VIEW_PATH, 'utf8');
  } catch {
    // File moved/renamed: the resolve-based read fails loudly below.
    viewSource = '';
  }

  it('view file exists at its wired path', () => {
    expect(viewSource).not.toBe('');
  });

  it('carries no local technology catalog (the FID-057 defect cannot return)', () => {
    expect(viewSource).not.toMatch(/const\s+TECHNOLOGIES\s*:\s*Technology\[\]\s*=\s*\[/);
    expect(viewSource).not.toMatch(/const\s+TECH_CATALOG\s*[:=]/);
  });

  it('hydrates from the GET payload (data.catalog) and marks unlocks from it', () => {
    expect(viewSource).toContain("fetch('/api/research')");
    expect(viewSource).toContain('data.catalog');
    expect(viewSource).toContain('unlockedIds.has(entry.id)');
  });

  it('renders the hydrated state (no empty default catalog to mask sync failure)', () => {
    expect(viewSource).toMatch(/useState<Technology\[\]>\(\[\]\)/);
    expect(viewSource).toContain('Syncing research catalog');
  });
});
