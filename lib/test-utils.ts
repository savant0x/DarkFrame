/**
 * Test Utilities
 * Created: 2025-10-23
 * 
 * OVERVIEW:
 * Provides helper functions for testing including database access,
 * mock data generation, and common test setup/teardown utilities.
 */

import { createServiceClient } from '@/lib/supabase/server';

/**
 * Get test database connection
 * Uses Supabase service client
 */
export function getTestDb() {
  return createServiceClient();
}

/**
 * Create mock user for testing
 */
export function createMockUser(overrides?: Record<string, unknown>) {
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
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock battle result for testing
 */
export function createMockBattleResult(overrides?: Record<string, unknown>) {
  return {
    attacker_id: 'attacker123',
    defender_id: 'defender456',
    winner: 'attacker123',
    attacker_damage: 50,
    defender_damage: 30,
    resources_stolen: {
      metal: 100,
      energy: 80,
      rp: 20,
    },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Wait for async operations (useful for testing timers)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clear all test data from database tables
 */
export async function clearTestData(): Promise<void> {
  const supabase = createServiceClient();
  const tables = ['players', 'clans', 'battles'];

  for (const table of tables) {
    const { error } = await supabase.from(table as 'players').delete().neq('id' as never, '');
    if (error) {
      console.error(`Failed to clear table ${table}:`, error);
    }
  }
}
