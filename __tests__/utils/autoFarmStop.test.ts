/**
 * @file __tests__/utils/autoFarmStop.test.ts
 * @created 2026-09-27
 * @overview Pins for the auto-farm stop announcements (SCOPE row 133).
 *   stop() states its own cause: a manual stop announces "Auto-farm stopped";
 *   the bookkeeping stop that follows a natural map completion keeps "Entire
 *   map completed!" — never the opposite. The game page renders the event's
 *   own message (verified by re-read against SCOPE row 133; this file pins the
 *   engine half, where the message is born).
 *
 *   Red drill 2026-09-27: run against the PRE-fix engine, the map-complete
 *   assertion failed — stop() ignored its argument and always said
 *   "Auto-farm stopped", which is the second complete event that used to
 *   overwrite the honest completion label on the page.
 */
import { describe, it, expect } from 'vitest';
import { AutoFarmEngine } from '@/utils/autoFarmEngine';
import {
  AutoFarmStatus,
  RankFilter,
  ResourceTarget,
  type AutoFarmEvent,
} from '@/types/autoFarm.types';

function makeEngine(): { engine: AutoFarmEngine; events: AutoFarmEvent[] } {
  const engine = new AutoFarmEngine(
    {
      attackPlayers: false,
      rankFilter: RankFilter.ALL,
      resourceTarget: ResourceTarget.METAL,
      isVIP: false,
    },
    { x: 1, y: 1 }
  );
  const events: AutoFarmEvent[] = [];
  engine.onEvent((event) => events.push(event));
  return { engine, events };
}

function completeEvents(events: AutoFarmEvent[]): AutoFarmEvent[] {
  return events.filter((e) => e.type === 'complete');
}

describe('stop() announces its own cause (SCOPE row 133)', () => {
  it('a manual stop emits complete with the stopped message and the final stats', () => {
    const { engine, events } = makeEngine();
    engine.stop();

    const completes = completeEvents(events);
    expect(completes).toHaveLength(1);
    expect(completes[0].message).toBe('Auto-farm stopped');
    // The stats-carrying contract FID-20260925-005 established: the page
    // merges into all-time ONLY when event.data is present, so the manual
    // stop's final session must still be attached.
    expect(completes[0].data).toBeDefined();
    expect(completes[0].data?.tilesVisited).toBe(0);
  });

  it('the post-map-completion bookkeeping stop keeps the completion message', () => {
    const { engine, events } = makeEngine();
    // processNextTile announces "Entire map completed!" (no data), then calls
    // this — the event below is the one carrying the final stats, and the one
    // the page renders last. It must NOT relabel the run as stopped.
    engine.stop('map-complete');

    const completes = completeEvents(events);
    expect(completes).toHaveLength(1);
    expect(completes[0].message).toBe('Entire map completed!');
    expect(completes[0].data).toBeDefined();
  });

  it('a bare stop() — the destroy()/cleanup path — still reads as stopped', () => {
    const { engine, events } = makeEngine();
    engine.destroy();

    const completes = completeEvents(events);
    expect(completes).toHaveLength(1);
    expect(completes[0].message).toBe('Auto-farm stopped');
    // The engine is stopped after cleanup.
    expect(engine.getState().status).toBe(AutoFarmStatus.STOPPED);
  });
});
