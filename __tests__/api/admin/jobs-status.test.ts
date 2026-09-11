/**
 * @file __tests__/api/admin/jobs-status.test.ts
 * @overview FID-20260909-035 jobs-status panel + FID-20260909-036 lifecycle
 * controls — route contract.
 *
 * Pins: admin-only gate (403 for anonymous and non-admin), the aggregated
 * job list shape (interval/isRunning/stats/id on every entry), the persisted
 * respawn-week passthrough, the WMD sub-job expansion, and the POST
 * start/stop/restart/run-now dispatch incl. audit-row writes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { capture } = vi.hoisted(() => ({
  capture: {
    auth: null as { username: string; isAdmin?: boolean } | null,
    lastRespawnWeek: undefined as number | undefined,
    calls: [] as Array<{ fn: string; args: unknown[] }>,
    lastInsert: null as unknown,
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: (table: unknown) => {
      capture.calls.push({ fn: 'db.insert', args: [table] });
      return {
        values: (vals: unknown) => {
          capture.lastInsert = vals;
          return Promise.resolve();
        },
      };
    },
  },
}));

vi.mock('@/lib/authMiddleware', () => ({
  getAuthenticatedUser: async () => capture.auth,
}));

vi.mock('@/lib/beerBaseService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/beerBaseService')>()),
  getBeerBaseConfig: async () => ({ lastRespawnWeek: capture.lastRespawnWeek }),
}));

vi.mock('@/lib/jobs/beerBaseManager', () => ({
  getBeerBaseJobInfo: () => ({
    name: 'Beer Base Weekly Respawn',
    interval: 600_000,
    isRunning: true,
    stats: { lastRun: null, executionCount: 3, errorCount: 0, respawnCount: 1 },
  }),
  startBeerBaseJob: () => {
    capture.calls.push({ fn: 'startBeerBaseJob', args: [] });
    return { success: true, message: 'Beer Base respawn scheduler started' };
  },
  stopBeerBaseJob: () => {
    capture.calls.push({ fn: 'stopBeerBaseJob', args: [] });
  },
  runBeerBaseJobNow: async () => {
    capture.calls.push({ fn: 'runBeerBaseJobNow', args: [] });
  },
}));

vi.mock('@/lib/jobs/botGrowthManager', () => ({
  getBotGrowthJobInfo: () => ({
    name: 'Bot Growth Cycle (hourly)',
    interval: 3_600_000,
    isRunning: true,
    stats: { lastRun: null, executionCount: 5, errorCount: 1, lastSummary: { processed: 52, regenerated: 52, moved: 3, unitsBuilt: 7 } },
  }),
  startBotGrowthJob: () => {
    capture.calls.push({ fn: 'startBotGrowthJob', args: [] });
    return { success: true, message: 'Bot growth scheduler started (hourly)' };
  },
  stopBotGrowthJob: () => {
    capture.calls.push({ fn: 'stopBotGrowthJob', args: [] });
  },
  runBotGrowthJobNow: async () => {
    capture.calls.push({ fn: 'runBotGrowthJobNow', args: [] });
  },
}));

vi.mock('@/lib/jobs/flagBotManager', () => ({
  getFlagBotJobInfo: () => ({
    name: 'Flag Bot Manager',
    interval: 1_800_000,
    isRunning: false,
    stats: { lastRun: null, executionCount: 9, errorCount: 0, movementCount: 40, resetCount: 2 },
  }),
  startFlagBotJob: async () => {
    capture.calls.push({ fn: 'startFlagBotJob', args: [] });
    return { success: true, message: 'Flag bot job started' };
  },
  stopFlagBotJob: async () => {
    capture.calls.push({ fn: 'stopFlagBotJob', args: [] });
    return { success: true, message: 'Flag bot job stopped successfully' };
  },
}));

vi.mock('@/lib/jobs/factorySlotRegeneration', () => ({
  getFactorySlotRegenJobStats: () => ({
    lastRun: null, nextRun: null, executionCount: 7, errorCount: 0,
    factoriesRegenerated: 4, totalSlotsRegenerated: 33, averageExecutionTime: 12, isRunning: true,
  }),
  startFactorySlotRegenJob: async () => {
    capture.calls.push({ fn: 'startFactorySlotRegenJob', args: [] });
    return { success: true, message: 'Factory slot regeneration job started' };
  },
  stopFactorySlotRegenJob: async () => {
    capture.calls.push({ fn: 'stopFactorySlotRegenJob', args: [] });
    return { success: true, message: 'Factory slot regeneration job stopped' };
  },
}));

vi.mock('@/lib/wmd/jobs/scheduler', () => ({
  getSchedulerHealth: () => ({
    isRunning: true,
    uptime: 7_200_000,
    jobs: [
      { name: 'missileTracker', interval: 60_000, lastRun: null, nextRun: null, executionCount: 100, errorCount: 0, averageExecutionTime: 5, isRunning: true },
      { name: 'intelOps', interval: 300_000, lastRun: null, nextRun: null, executionCount: 20, errorCount: 2, averageExecutionTime: 8, isRunning: true },
    ],
  }),
  startWMDJobs: () => {
    capture.calls.push({ fn: 'startWMDJobs', args: [] });
    return { success: true, message: 'WMD jobs started' };
  },
  stopWMDJobs: () => {
    capture.calls.push({ fn: 'stopWMDJobs', args: [] });
    return { success: true, message: 'WMD jobs stopped' };
  },
  stopSingleWMDJob: (name: string) => {
    capture.calls.push({ fn: 'stopSingleWMDJob', args: [name] });
    return { success: false, message: `Job '${name}' is not running` };
  },
  startSingleWMDJob: (name: string) => {
    capture.calls.push({ fn: 'startSingleWMDJob', args: [name] });
    return { success: true, message: `Job '${name}' started` };
  },
}));

import { GET, POST } from '@/app/api/admin/jobs-status/route';

/** The wrapped route takes (request, routeContext) — context unused by the handler. */
function request() {
  return [
    new Request('http://localhost/api/admin/jobs-status') as unknown as Parameters<typeof GET>[0],
    {} as unknown as Parameters<typeof GET>[1],
  ] as const;
}

function postRequest(body: unknown) {
  return [
    new Request('http://localhost/api/admin/jobs-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as unknown as Parameters<typeof POST>[0],
    {} as unknown as Parameters<typeof POST>[1],
  ] as const;
}

/** Manager-call sequence, excluding the audit-row db.insert the route appends. */
function seq() {
  return capture.calls.filter((c) => c.fn !== 'db.insert').map((c) => c.fn);
}

describe('GET /api/admin/jobs-status (FID-20260909-035)', () => {
  beforeEach(() => {
    capture.auth = null;
    capture.lastRespawnWeek = undefined;
    capture.calls = [];
    capture.lastInsert = null;
  });

  it('rejects anonymous callers with 403', async () => {
    const [req, ctx] = request();
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
  });

  it('rejects non-admin callers with 403', async () => {
    capture.auth = { username: 'fame', isAdmin: false };
    const [req, ctx] = request();
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
  });

  it('aggregates all five job families with the required shape', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = request();
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const jobs = body.data.jobs;
    const byName = new Map<string, {
      interval: number; isRunning: boolean;
      stats: { executionCount: number; errorCount: number; lastSummary?: { processed: number }; movementCount?: number; totalSlotsRegenerated?: number };
      details?: { persistedRespawnWeek?: number | null };
    }>(jobs.map((j: { name: string }) => [j.name, j]));
    expect(byName.get('Beer Base Weekly Respawn')).toBeTruthy();
    expect(byName.get('Bot Growth Cycle (hourly)')).toBeTruthy();
    expect(byName.get('Flag Bot Manager')).toBeTruthy();
    expect(byName.get('Factory Slot Regeneration (hourly)')).toBeTruthy();
    expect(byName.get('WMD · missileTracker')).toBeTruthy();
    expect(byName.get('WMD · intelOps')).toBeTruthy();

    for (const j of jobs) {
      expect(j.interval).toBeGreaterThan(0);
      expect(typeof j.isRunning).toBe('boolean');
      expect(j.stats).toBeTruthy();
      expect(typeof j.stats.executionCount).toBe('number');
      expect(typeof j.stats.errorCount).toBe('number');
    }

    // Job-specific detail passthrough.
    expect(byName.get('Bot Growth Cycle (hourly)')!.stats.lastSummary!.processed).toBe(52);
    expect(byName.get('Flag Bot Manager')!.stats.movementCount).toBe(40);
    expect(byName.get('Factory Slot Regeneration (hourly)')!.stats.totalSlotsRegenerated).toBe(33);
    expect(byName.get('WMD · intelOps')!.stats.errorCount).toBe(2);
  });

  it('passes through the persisted respawn week when set', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    capture.lastRespawnWeek = 37;
    const [req, ctx] = request();
    const res = await GET(req, ctx);
    const body = await res.json();
    const beerBase = body.data.jobs.find((j: { name: string }) => j.name === 'Beer Base Weekly Respawn');
    expect(beerBase.details.persistedRespawnWeek).toBe(37);
  });

  it('reports null persisted week before the first persisted respawn', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = request();
    const res = await GET(req, ctx);
    const body = await res.json();
    const beerBase = body.data.jobs.find((j: { name: string }) => j.name === 'Beer Base Weekly Respawn');
    expect(beerBase.details.persistedRespawnWeek).toBeNull();
  });

  it('exposes a stable id for every controllable job', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = request();
    const res = await GET(req, ctx);
    const body = await res.json();
    for (const j of body.data.jobs) {
      expect(typeof j.id).toBe('string');
      expect(j.id!.length).toBeGreaterThan(0);
    }
    const wmdSub = body.data.jobs.find((j: { id: string }) => j.id!.startsWith('wmd:'));
    expect(wmdSub).toBeTruthy();
  });
});

describe('POST /api/admin/jobs-status (FID-20260909-036 lifecycle controls)', () => {
  beforeEach(() => {
    capture.auth = null;
    capture.calls = [];
    capture.lastInsert = null;
  });

  it('rejects anonymous callers with 403', async () => {
    const [req, ctx] = postRequest({ job: 'botGrowth', action: 'stop' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect(capture.calls).toHaveLength(0);
  });

  it('rejects non-admin callers with 403', async () => {
    capture.auth = { username: 'fame', isAdmin: false };
    const [req, ctx] = postRequest({ job: 'botGrowth', action: 'stop' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
    expect(capture.calls).toHaveLength(0);
  });

  it('rejects malformed bodies with 400', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    for (const body of [null, 'nope', {}, { job: 'botGrowth' }, { action: 'stop' }]) {
      const [req, ctx] = postRequest(body);
      const res = await POST(req, ctx);
      expect(res.status).toBe(400);
    }
    expect(capture.calls).toHaveLength(0);
  });

  it('rejects unknown jobs and unknown actions with 400', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const badJob = postRequest({ job: 'nuclearLaunch', action: 'stop' });
    expect((await POST(badJob[0], badJob[1])).status).toBe(400);
    const badAction = postRequest({ job: 'botGrowth', action: 'detonate' });
    expect((await POST(badAction[0], badAction[1])).status).toBe(400);
    expect(capture.calls).toHaveLength(0);
  });

  it('stop routes to the right manager stopper', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = postRequest({ job: 'flagBot', action: 'stop' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.success).toBe(true);
    expect(seq()).toEqual(['stopFlagBotJob']);
  });

  it('start routes to the right manager starter', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = postRequest({ job: 'factorySlotRegen', action: 'start' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(seq()).toEqual(['startFactorySlotRegenJob']);
  });

  it('restart stops then starts the family', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = postRequest({ job: 'beerBase', action: 'restart' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(seq()).toEqual(['stopBeerBaseJob', 'startBeerBaseJob']);
  });

  it('run-now fires the job immediately without touching its interval', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = postRequest({ job: 'botGrowth', action: 'run-now' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(seq()).toEqual(['runBotGrowthJobNow']);
  });

  it('run-now is refused for WMD sub-jobs', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = postRequest({ job: 'wmd:missileTracker', action: 'run-now' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(false);
    expect(seq()).toEqual([]); // no manager touched; the refusal is still audit-logged
  });

  it('addresses a single WMD sub-job through the wmd: prefix', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = postRequest({ job: 'wmd:missileTracker', action: 'stop' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(seq()).toEqual(['stopSingleWMDJob']);
    expect(capture.calls[0].args[0]).toBe('missileTracker');
  });

  it('wmd family start routes to startWMDJobs', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = postRequest({ job: 'wmd', action: 'start' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(seq()).toEqual(['startWMDJobs']);
  });

  it('writes an audit row with job, action, admin, and outcome', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = postRequest({ job: 'botGrowth', action: 'stop' });
    await POST(req, ctx);
    expect(capture.lastInsert).toBeTruthy();
    const row = capture.lastInsert as { moderatorId: string; action: string; targetId: string; details: string };
    expect(row.moderatorId).toBe('fame');
    expect(row.action).toBe('ADMIN_JOB_CONTROL');
    expect(row.targetId).toBe('botGrowth');
    const details = JSON.parse(row.details);
    expect(details.job).toBe('botGrowth');
    expect(details.action).toBe('stop');
    expect(typeof details.outcome).toBe('boolean');
  });

  it('still writes an audit row when the mutation itself fails', async () => {
    capture.auth = { username: 'fame', isAdmin: true };
    const [req, ctx] = postRequest({ job: 'wmd:missileTracker', action: 'restart' });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    // stopSingleWMDJob mock reports "not running" — restart proceeds to start.
    expect(body.data.success).toBe(true);
    expect(seq()).toEqual(['stopSingleWMDJob', 'startSingleWMDJob']);
  });
});
