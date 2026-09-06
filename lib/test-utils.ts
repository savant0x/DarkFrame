import { db } from '@/lib/db';
import { players, clans, tiles, factories, battleLogs, mutes, bans, warnings, modLog, wordBlacklist } from '@/lib/db/schema';


export async function getTestDb() {
  return db;
}

export function createMockUser(overrides?: Partial<any>) {
  return {
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword123',
    position: { x: 0, y: 0 },
    resources: {
      metal: 1000,
      energy: 1000,
      rp: 100,
    },
    stats: {
      level: 1,
      experience: 0,
      health: 100,
      maxHealth: 100,
    },
    createdAt: new Date(),
    lastActive: new Date(),
    ...overrides,
  };
}

export function createMockBattleResult(overrides?: Partial<any>) {
  return {
    attackerId: 'attacker123',
    defenderId: 'defender456',
    winner: 'attacker123',
    attackerDamage: 50,
    defenderDamage: 30,
    resourcesStolen: {
      metal: 100,
      energy: 80,
      rp: 20,
    },
    timestamp: new Date(),
    ...overrides,
  };
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function clearTestData(): Promise<void> {
  await db.delete(battleLogs);
  await db.delete(wordBlacklist);
  await db.delete(modLog);
  await db.delete(warnings);
  await db.delete(bans);
  await db.delete(mutes);
  await db.delete(tiles);
  await db.delete(factories);
  await db.delete(clans);
  await db.delete(players);
}
