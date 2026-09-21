/**
 * @file __tests__/lib/clanDisbandTables.test.ts
 * @created 2026-09-19 (FID-20260919-012)
 * @overview Pin for the disbandClan aux-table fix: the raw-SQL cleanup must
 *            target tables that exist. The defect made every disband throw
 *            mid-transaction ("relation clan_chat does not exist") AFTER
 *            members were already cleared — a partial-state crash. The first
 *            pin walks the drizzle `sql` chunks and asserts the table names;
 *            the second proves against the committed migration snapshots that
 *            all three named tables exist and the phantom clan_chat does not.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const { selectState, executeCalls } = vi.hoisted(() => ({
  selectState: { rows: [] as unknown[], captured: null as null | unknown },
  executeCalls: [] as unknown[],
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: (_t: unknown) => ({
        where: (c: unknown) => {
          selectState.captured = c;
          return {
            limit: () => Promise.resolve(selectState.rows),
          };
        },
      }),
    }),
    execute: vi.fn(async (q: unknown) => {
      executeCalls.push(q);
      return { rowCount: 1 };
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  },
}));

vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return { ...actual };
});

vi.mock('@/lib/clanActivityService', () => ({
  logClanActivity: vi.fn().mockResolvedValue(undefined),
}));

import { disbandClan } from '@/lib/clanService';

const CLAN_ROW = {
  id: 'clan_dis1',
  leaderId: 'leader1',
  members: [
    { playerId: 'leader1', username: 'leader1', role: 'LEADER' },
    { playerId: 'm2', username: 'member2', role: 'MEMBER' },
  ],
};

function sqlText(q: unknown): string {
  // drizzle sql`` chunks: string literals + interpolated params interleave.
  const chunks = (q as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((c) => (typeof c === 'string' ? c : String((c as { value?: unknown }).value ?? '')))
    .join('?');
}

describe('disbandClan aux-table cleanup (FID-20260919-012)', () => {
  beforeEach(() => {
    executeCalls.length = 0;
    selectState.captured = null;
    selectState.rows = [CLAN_ROW];
  });

  it('clears members, deletes the clan, and cleans clan_invitations + clan_activities + clan_chat_messages — never the phantom clan_chat', async () => {
    const result = await disbandClan('clan_dis1', 'leader1');
    expect(result.success).toBe(true);

    const statements = executeCalls.map((q) => sqlText(q));
    expect(statements.some((t) => t.includes('DELETE FROM clan_invitations'))).toBe(true);
    expect(statements.some((t) => t.includes('DELETE FROM clan_activities'))).toBe(true);
    expect(statements.some((t) => t.includes('DELETE FROM clan_chat_messages'))).toBe(true);
    // The exact defect: the phantom bare name (not the _messages suffix) must
    // never appear again.
    expect(statements.some((t) => /FROM clan_chat(?![\w_])/.test(t))).toBe(false);
  });

  it('refuses non-leaders before any mutation', async () => {
    await expect(disbandClan('clan_dis1', 'member2')).rejects.toThrow(
      'Only clan leader can disband the clan'
    );
    expect(executeCalls.length).toBe(0);
  });

  it('migration truth: every table named in the disband cleanup exists, and clan_chat does not', () => {
    // The committed migration SQL is the schema source of truth (the live dev
    // DB was probed directly during the FID; the test env has no DATABASE_URL,
    // so the hermetic equivalent is the migration set).
    const migrationsDir = join(process.cwd(), 'lib', 'db', 'migrations');
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);
    const created = new Set<string>();
    const dropped = new Set<string>();
    for (const f of files) {
      const txt = readFileSync(join(migrationsDir, f), 'utf-8');
      for (const m of txt.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g)) {
        created.add(m[1]);
      }
      for (const m of txt.matchAll(/DROP TABLE (?:IF EXISTS )?(\w+)/g)) {
        dropped.add(m[1]);
      }
    }
    for (const required of ['clan_invitations', 'clan_activities', 'clan_chat_messages']) {
      expect(created.has(required)).toBe(true);
    }
    // The phantom never existed; nothing may have created it.
    expect(created.has('clan_chat')).toBe(false);
    expect(dropped.has('clan_chat')).toBe(false);
  });
});
