/**
 * Cache Service
 * 
 * Provides high-level caching operations with automatic fallback to database,
 * smart invalidation, and performance monitoring.
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-041 (Redis Caching Layer)
 * 
 * OVERVIEW:
 * This service wraps Redis operations with application-specific caching logic.
 * It handles cache misses gracefully, provides automatic fallback to database
 * queries, and tracks cache performance metrics.
 * 
 * Key Features:
 * - Automatic fallback on cache miss or Redis unavailable
 * - TTL management per data type
 * - Batch operations for efficiency
 * - Cache invalidation patterns
 * - Performance metrics tracking
 * 
 * Usage Pattern:
 *   1. Try to get from cache
 *   2. On miss, fetch from database
 *   3. Store in cache for future requests
 *   4. Return data to caller
 */

import { getRedisClient, isRedisAvailable } from './redis';


/**
 * Cache statistics for monitoring
 */
interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
}

/**
 * Global cache statistics
 */
const stats: CacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  hitRate: 0,
};

/**
 * Update cache statistics
 */
function updateStats(type: 'hit' | 'miss' | 'error'): void {
  if (type === 'hit') stats.hits++;
  if (type === 'miss') stats.misses++;
  if (type === 'error') stats.errors++;
  
  const total = stats.hits + stats.misses;
  stats.hitRate = total > 0 ? (stats.hits / total) * 100 : 0;
}

// ============================================================================
// L1 PROCESS-LOCAL MEMORY TIER (FID-20260909-024)
// ============================================================================
// Previously every operation no-oped when Redis was unavailable — meaning all
// TTL caches (leaderboard 300s, player profiles, …) silently degraded to a
// direct DB hit on EVERY request in dev or Redis-less deploys, and even with
// Redis up, every read paid a network round-trip.
//
// This tier is an L1 in front of Redis (L2): always written, checked first.
// The game runs as a single Next.js server process (server.ts owns socket.io),
// so a process-local L1 is coherent with the delete/set paths below, which
// always write through both tiers.

interface MemoryEntry {
  value: string;             // Pre-serialized, same wire format as Redis
  expiresAt: number | null;  // Epoch ms; null = no TTL (mirrors redis.set)
}

const MEMORY_MAX_ENTRIES = 500;
const memoryStore = new Map<string, MemoryEntry>();

/** Evict expired entries (lazy) and enforce the size cap (oldest first). */
function memorySweep(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
  while (memoryStore.size > MEMORY_MAX_ENTRIES) {
    // Map preserves insertion order — the first key is the oldest.
    const oldest = memoryStore.keys().next().value;
    if (oldest === undefined) break;
    memoryStore.delete(oldest);
  }
}

function memoryGetRaw(key: string): MemoryEntry | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry;
}

function memorySet(key: string, serialized: string, ttl?: number): void {
  memorySweep();
  // Re-inserting an existing key refreshes its insertion order too.
  memoryStore.delete(key);
  memoryStore.set(key, {
    value: serialized,
    expiresAt: ttl ? Date.now() + ttl * 1000 : null,
  });
}

function memoryMatchKeys(pattern: string): string[] {
  const regex = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$');
  return [...memoryStore.keys()].filter((k) => regex.test(k));
}

// ============================================================================
// SINGLE-FLIGHT DEDUPE (cache-stampede guard)
// ============================================================================
// Concurrent getCacheOrFetch misses for the same key previously each ran the
// fetchFn against the DB (cold leaderboard + N simultaneous players = N heavy
// queries). The first caller's promise is now shared by everyone waiting on
// that key.
const inFlightFetches = new Map<string, Promise<unknown>>();

/**
 * Get current cache statistics
 * 
 * @returns Cache performance metrics
 */
export function getCacheStats(): CacheStats {
  return { ...stats };
}

/**
 * Reset cache statistics
 * Useful for testing or monitoring resets
 */
export function resetCacheStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.errors = 0;
  stats.hitRate = 0;
}

/**
 * Get value from cache
 * Returns null if not found or Redis unavailable
 * 
 * @param key - Cache key
 * @returns Cached value or null
 * 
 * @example
 * const data = await getCache<PlayerProfile>('player:profile:123');
 * if (!data) {
 *   // Cache miss, fetch from database
 * }
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    // L1: process-local memory tier (works with or without Redis)
    const mem = memoryGetRaw(key);
    if (mem) {
      updateStats('hit');
      return JSON.parse(mem.value) as T;
    }

    if (!isRedisAvailable()) {
      updateStats('miss');
      return null;
    }

    const redis = await getRedisClient();
    if (!redis) {
      updateStats('miss');
      return null;
    }
    
    const cached = await redis.get(key);

    if (cached) {
      updateStats('hit');
      // Backfill L1 using the entry's remaining Redis TTL.
      const ttl = await redis.ttl(key);
      memorySet(key, cached, ttl > 0 ? ttl : undefined);
      return JSON.parse(cached) as T;
    }

    updateStats('miss');
    return null;
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error);
    updateStats('error');
    return null;
  }
}

/**
 * Set value in cache with TTL
 * 
 * @param key - Cache key
 * @param value - Value to cache (will be JSON stringified)
 * @param ttl - Time to live in seconds (optional, uses default for key type)
 * @returns True if successful
 * 
 * @example
 * await setCache('player:profile:123', playerData, CacheTTL.PLAYER_PROFILE);
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<boolean> {
  try {
    const serialized = JSON.stringify(value);

    // L1 write-through: cached data survives even with Redis down.
    memorySet(key, serialized, ttl);

    if (!isRedisAvailable()) {
      return true;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return true;
    }
    
    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }

    return true;
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error);
    updateStats('error');
    return false;
  }
}

/**
 * Delete specific key from cache
 * 
 * @param key - Cache key to delete
 * @returns True if deleted
 * 
 * @example
 * await deleteCache('player:profile:123');
 */
export async function deleteCache(key: string): Promise<boolean> {
  try {
    // L1 invalidate first (coherence: never leave stale memory entries).
    memoryStore.delete(key);

    if (!isRedisAvailable()) {
      return true;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return true;
    }
    
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error);
    updateStats('error');
    return false;
  }
}

/**
 * Delete all keys matching a pattern
 * Useful for invalidating related cache entries
 * 
 * @param pattern - Redis key pattern (e.g., 'player:*:123')
 * @returns Number of keys deleted
 * 
 * @example
 * // Delete all player-related cache
 * await deleteCachePattern('player:*:player123');
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  try {
    // L1 invalidate (glob → regex match over memory keys).
    for (const memKey of memoryMatchKeys(pattern)) {
      memoryStore.delete(memKey);
    }

    if (!isRedisAvailable()) {
      return 0;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return 0;
    }
    
    // Scan for matching keys (safer than KEYS command for production)
    const keys: string[] = [];
    let cursor = 0;
    
    do {
      const [nextCursorStr, matchedKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = parseInt(nextCursorStr, 10);
      keys.push(...matchedKeys);
    } while (cursor !== 0);

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return keys.length;
  } catch (error) {
    console.error(`Cache delete pattern error for ${pattern}:`, error);
    updateStats('error');
    return 0;
  }
}

/**
 * Get multiple values from cache
 * More efficient than multiple getCache calls
 * 
 * @param keys - Array of cache keys
 * @returns Array of cached values (null for misses)
 * 
 * @example
 * const [player1, player2] = await getCacheMultiple<PlayerProfile>([
 *   'player:profile:123',
 *   'player:profile:456'
 * ]);
 */
export async function getCacheMultiple<T>(keys: string[]): Promise<(T | null)[]> {
  try {
    if (keys.length === 0) {
      return [];
    }

    // L1 pass first.
    const results: (T | null)[] = keys.map((key) => {
      const mem = memoryGetRaw(key);
      if (mem) {
        updateStats('hit');
        return JSON.parse(mem.value) as T;
      }
      return null;
    });

    const missingIndices = results
      .map((r, _i) => (r === null ? _i : -1))
      .filter((idx) => idx >= 0);

    if (missingIndices.length === 0) return results;

    if (!isRedisAvailable()) {
      missingIndices.forEach(() => updateStats('miss'));
      return results;
    }

    const redis = await getRedisClient();
    if (!redis) {
      missingIndices.forEach(() => updateStats('miss'));
      return results;
    }
    
    const missingKeys = missingIndices.map((i) => keys[i]);
    const cached = await redis.mget(...missingKeys);

    cached.forEach((value: string | null, idx: number) => {
      const originalIndex = missingIndices[idx];
      if (value) {
        updateStats('hit');
        results[originalIndex] = JSON.parse(value) as T;
        void redis.ttl(missingKeys[idx]).then((ttl) => {
          memorySet(missingKeys[idx], value, ttl > 0 ? ttl : undefined);
        }).catch(() => undefined);
      } else {
        updateStats('miss');
      }
    });

    return results;
  } catch (error) {
    console.error('Cache mget error:', error);
    updateStats('error');
    return keys.map(() => null);
  }
}

/**
 * Set multiple values in cache
 * More efficient than multiple setCache calls
 * 
 * @param entries - Array of {key, value, ttl} objects
 * @returns True if successful
 * 
 * @example
 * await setCacheMultiple([
 *   { key: 'player:profile:123', value: player1, ttl: 60 },
 *   { key: 'player:profile:456', value: player2, ttl: 60 }
 * ]);
 */
export async function setCacheMultiple<T>(
  entries: Array<{ key: string; value: T; ttl?: number }>
): Promise<boolean> {
  try {
    if (entries.length === 0) {
      return false;
    }

    // L1 write-through for every entry (Redis pipeline skips no-TTL items).
    for (const entry of entries) {
      memorySet(entry.key, JSON.stringify(entry.value), entry.ttl);
    }

    if (!isRedisAvailable()) {
      return true;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return false;
    }
    
    const pipeline = redis.pipeline();

    for (const entry of entries) {
      const serialized = JSON.stringify(entry.value);
      if (entry.ttl) {
        pipeline.setex(entry.key, entry.ttl, serialized);
      }
      // Note: Pipeline doesn't have plain set, only setex. Skip items without TTL.
    }

    await pipeline.exec();
    return true;
  } catch (error) {
    console.error('Cache mset error:', error);
    updateStats('error');
    return false;
  }
}

/**
 * Get value from cache or fetch from callback
 * Automatically caches the result on miss
 * 
 * @param key - Cache key
 * @param fetchFn - Function to call on cache miss
 * @param ttl - Cache TTL in seconds
 * @returns Cached or fetched value
 * 
 * @example
 * const player = await getCacheOrFetch(
 *   'player:profile:123',
 *   () => fetchPlayerFromDB('123'),
 *   CacheTTL.PLAYER_PROFILE
 * );
 */
export async function getCacheOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try cache first
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Single-flight: coalesce concurrent misses on the same key so a cold cache
  // plus a burst of requests produces ONE database fetch, not N.
  const existing = inFlightFetches.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const fetchPromise = (async () => {
    const data = await fetchFn();
    if (data !== null && data !== undefined) {
      await setCache(key, data, ttl);
    }
    return data;
  })().finally(() => {
    inFlightFetches.delete(key);
  });

  inFlightFetches.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Check if a key exists in cache
 * 
 * @param key - Cache key
 * @returns True if key exists
 * 
 * @example
 * if (await hasCache('player:profile:123')) {
 *   // Cache hit
 * }
 */
export async function hasCache(key: string): Promise<boolean> {
  try {
    if (memoryGetRaw(key)) {
      return true;
    }

    if (!isRedisAvailable()) {
      return false;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return false;
    }
    
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error(`Cache exists error for key ${key}:`, error);
    return false;
  }
}

/**
 * Get remaining TTL for a key
 * 
 * @param key - Cache key
 * @returns Remaining seconds (-1 if no TTL, -2 if not exists)
 * 
 * @example
 * const ttl = await getCacheTTL('player:profile:123');
 * console.log(`Cache expires in ${ttl} seconds`);
 */
export async function getCacheTTL(key: string): Promise<number> {
  try {
    if (!isRedisAvailable()) {
      return -2;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return -2;
    }
    
    return await redis.ttl(key);
  } catch (error) {
    console.error(`Cache TTL error for key ${key}:`, error);
    return -2;
  }
}

/**
 * Refresh TTL for a key (extend expiration)
 * 
 * @param key - Cache key
 * @param ttl - New TTL in seconds
 * @returns True if successful
 * 
 * @example
 * await refreshCacheTTL('player:profile:123', 60);
 */
export async function refreshCacheTTL(key: string, ttl: number): Promise<boolean> {
  try {
    if (!isRedisAvailable()) {
      return false;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return false;
    }
    
    await redis.expire(key, ttl);
    return true;
  } catch (error) {
    console.error(`Cache TTL refresh error for key ${key}:`, error);
    return false;
  }
}

/**
 * Flush all cache data
 * USE WITH CAUTION - Only for development/testing
 * 
 * @throws Error if not in development mode
 */
export async function flushAllCache(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot flush cache in production');
  }

  try {
    memoryStore.clear();

    if (!isRedisAvailable()) {
      return;
    }

    const redis = await getRedisClient();
    if (!redis) {
      return;
    }
    
    await redis.flushall();
    resetCacheStats();
    console.log('✅ All cache flushed');
  } catch (error) {
    console.error('Cache flush error:', error);
    throw error;
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - All operations fail gracefully if Redis unavailable
// - JSON serialization for complex objects
// - Pipeline for batch operations (better performance)
// - SCAN instead of KEYS for pattern matching (production-safe)
// - Cache stats for monitoring performance
// - TTL management for automatic expiration
// ============================================================
// END OF FILE
// ============================================================
