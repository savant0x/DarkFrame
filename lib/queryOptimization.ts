/**
 * Query Optimization Utilities
 * 
 * Provides helper functions for optimized Supabase queries with projections,
 * pagination, and performance monitoring.
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-040 (Database Query Optimization)
 * 
 * OVERVIEW:
 * This module contains utility functions that enforce best practices for
 * Supabase queries: using projections to reduce data transfer, implementing
 * pagination for large result sets, and monitoring query performance.
 * 
 * All query functions should use these utilities to maintain consistent
 * performance standards across the application.
 */

import { createServiceClient } from '@/lib/supabase/server';

/**
 * Common projection patterns for frequently queried tables
 * Only select fields that are actually needed
 */
export const projections = {
  playerBasic: 'username,level,power,clan_id',
  playerStats: 'username,level,power,current_hp,max_hp,x,y',

  clanBasic: 'name,tag,level,power',
  clanLeaderboard: 'name,tag,level,power,territory_count,member_count',

  territoryBasic: 'x,y,clan_id',

  battleSummary: 'attacker_id,defender_id,winner,timestamp,attacker_losses,defender_losses',

  auctionListing: 'item_type,item_name,quantity,starting_bid,current_bid,current_bidder,end_time,status',

  factoryBasic: 'x,y,owner_id,clan_id,level,resource_type',
} as const;

/**
 * Pagination options for query results
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  skip?: number;
}

/**
 * Query performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 50,
  CRITICAL_QUERY_MS: 100,
} as const;

/**
 * Calculate skip value from pagination options
 */
export function getSkipValue(options: PaginationOptions): number {
  if (options.skip !== undefined) {
    return options.skip;
  }

  const page = options.page || 1;
  const limit = options.limit || 20;
  return (page - 1) * limit;
}

type SupabaseFromFn = (relation: string) => ReturnType<ReturnType<typeof createServiceClient>['from']>;

/**
 * Paginated select query with performance monitoring
 */
export async function paginatedSelect<T extends Record<string, unknown>>(
  table: string,
  filter: Record<string, unknown>,
  pagination: PaginationOptions = {},
  sort?: { column: string; ascending: boolean },
  select?: string
): Promise<T[]> {
  const startTime = Date.now();
  const limit = pagination.limit || 20;
  const skip = getSkipValue(pagination);

  try {
    const supabase = createServiceClient();
    const from = supabase.from as SupabaseFromFn;

    let query = from(table)
      .select(select || '*', { count: 'exact' });

    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    if (sort) {
      query = query.order(sort.column, { ascending: sort.ascending }) as typeof query;
    }

    query = query.range(skip, skip + limit - 1) as typeof query;

    const { data, error } = await query;
    const duration = Date.now() - startTime;

    if (error) {
      console.error('Query error:', {
        table,
        filter,
        error,
      });
      throw error;
    }

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow query detected (${duration}ms):`, {
        table,
        filter: JSON.stringify(filter),
        limit,
        skip,
        sort: JSON.stringify(sort),
      });
    }

    return (data as T[]) || [];
  } catch (error) {
    console.error('Query error:', {
      table,
      filter,
      error,
    });
    throw error;
  }
}

/**
 * Count documents with caching hint
 */
export async function countDocuments<T extends Record<string, unknown>>(
  table: string,
  filter: Record<string, unknown>,
  _useEstimate = false
): Promise<number> {
  const startTime = Date.now();

  try {
    const supabase = createServiceClient();
    const from = supabase.from as SupabaseFromFn;

    let query = from(table)
      .select('*', { count: 'exact', head: true });

    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    const { count, error } = await query;
    const duration = Date.now() - startTime;

    if (error) {
      console.error('Count error:', {
        table,
        filter,
        error,
      });
      throw error;
    }

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow count query (${duration}ms):`, {
        table,
        filter: JSON.stringify(filter),
      });
    }

    return count || 0;
  } catch (error) {
    console.error('Count error:', {
      table,
      filter,
      error,
    });
    throw error;
  }
}

/**
 * Find one row with performance monitoring
 */
export async function findOne<T extends Record<string, unknown>>(
  table: string,
  filter: Record<string, unknown>,
  select?: string
): Promise<T | null> {
  const startTime = Date.now();

  try {
    const supabase = createServiceClient();
    const from = supabase.from as SupabaseFromFn;

    let query = from(table)
      .select(select || '*');

    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query.maybeSingle();
    const duration = Date.now() - startTime;

    if (error) {
      console.error('FindOne error:', {
        table,
        filter,
        error,
      });
      throw error;
    }

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow findOne query (${duration}ms):`, {
        table,
        filter: JSON.stringify(filter),
      });
    }

    return (data as T) || null;
  } catch (error) {
    console.error('FindOne error:', {
      table,
      filter,
      error,
    });
    throw error;
  }
}

/**
 * Leaderboard query helper
 */
export async function getLeaderboard<T extends Record<string, unknown>>(
  table: string,
  filter: Record<string, unknown>,
  sort: { column: string; ascending: boolean },
  limit = 100,
  select?: string
): Promise<T[]> {
  return paginatedSelect<T>(
    table,
    filter,
    { limit, skip: 0 },
    sort,
    select
  );
}

/**
 * Batch find by IDs
 */
export async function findByIds<T extends Record<string, unknown>>(
  table: string,
  ids: string[],
  select?: string
): Promise<T[]> {
  if (ids.length === 0) return [];

  const startTime = Date.now();

  try {
    const supabase = createServiceClient();
    const from = supabase.from as SupabaseFromFn;

    const { data, error } = await from(table)
      .select(select || '*')
      .in('id', ids);

    const duration = Date.now() - startTime;

    if (error) {
      console.error('Batch find error:', {
        table,
        idCount: ids.length,
        error,
      });
      throw error;
    }

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow batch find (${duration}ms):`, {
        table,
        idCount: ids.length,
      });
    }

    return (data as T[]) || [];
  } catch (error) {
    console.error('Batch find error:', {
      table,
      idCount: ids.length,
      error,
    });
    throw error;
  }
}

/**
 * Query performance logger
 */
export function logQueryPerformance(
  tableName: string,
  queryType: string,
  duration: number,
  details?: Record<string, unknown>
): void {
  const level = duration > PERFORMANCE_THRESHOLDS.CRITICAL_QUERY_MS
    ? 'CRITICAL'
    : duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS
      ? 'SLOW'
      : 'NORMAL';

  if (level !== 'NORMAL') {
    const emoji = level === 'CRITICAL' ? '🚨' : '⚠️';
    console.warn(`${emoji} ${level} Query (${duration}ms):`, {
      table: tableName,
      queryType,
      ...details,
    });
  }
}

/**
 * Build pagination metadata for API responses
 */
export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalItems: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit);

  return {
    currentPage: page,
    pageSize: limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Aggregate query helper with performance monitoring
 */
export async function aggregate(
  table: string,
  filters: Record<string, unknown>[],
  tableName?: string
): Promise<Record<string, unknown>[]> {
  const startTime = Date.now();

  try {
    const supabase = createServiceClient();
    const from = supabase.from as SupabaseFromFn;

    const mergedFilter: Record<string, unknown> = {};
    for (const filter of filters) {
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined && value !== null) {
          if (mergedFilter[key] !== undefined) {
            if (key.startsWith('$')) continue;
            if (typeof mergedFilter[key] === 'object' && typeof value === 'object' && !Array.isArray(value)) {
              mergedFilter[key] = { ...(mergedFilter[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
            }
          } else {
            mergedFilter[key] = value;
          }
        }
      }
    }

    let query = from(table).select('*');

    for (const [key, value] of Object.entries(mergedFilter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;
    const duration = Date.now() - startTime;

    if (error) {
      console.error('Aggregation error:', {
        table: tableName || table,
        filters,
        error,
      });
      throw error;
    }

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow aggregation (${duration}ms):`, {
        table: tableName || table,
        filterCount: filters.length,
      });
    }

    return (data as Record<string, unknown>[]) || [];
  } catch (error) {
    console.error('Aggregation error:', {
      table: tableName || table,
      filters,
      error,
    });
    throw error;
  }
}
