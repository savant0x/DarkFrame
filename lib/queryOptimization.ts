import { db } from '@/lib/db';
import {
  players,
  clans,
  tiles,
  factories,
  battleLogs,
  auctions,
} from '@/lib/db/schema';
import { eq, inArray, count, asc, desc } from 'drizzle-orm';

export const projections = {
  playerBasic: {
    username: true,
    level: true,
    totalStrength: true,
    clanId: true,
  },
  playerStats: {
    username: true,
    level: true,
    totalStrength: true,
    totalDefense: true,
    currentHP: true,
    maxHP: true,
    currentPositionX: true,
    currentPositionY: true,
  },
  playerFull: {},

  clanBasic: {
    id: true,
    name: true,
    tag: true,
    levelCurrentLevel: true,
    statsTotalPower: true,
  },
  clanLeaderboard: {
    id: true,
    name: true,
    tag: true,
    levelCurrentLevel: true,
    statsTotalPower: true,
    statsTotalTerritories: true,
    members: true,
  },
  clanFull: {},

  territoryBasic: {
    id: true,
    x: true,
    y: true,
    clanId: true,
  },

  battleSummary: {
    id: true,
    attackerId: true,
    defenderId: true,
    winner: true,
    timestamp: true,
    attackerLosses: true,
    defenderLosses: true,
  },

  auctionListing: {
    id: true,
    itemType: true,
    itemName: true,
    quantity: true,
    startingBid: true,
    currentBid: true,
    currentBidder: true,
    endTime: true,
    status: true,
  },

  factoryBasic: {
    id: true,
    x: true,
    y: true,
    ownerId: true,
    clanId: true,
    level: true,
    resourceType: true,
  },
} as const;

export interface PaginationOptions {
  page?: number;
  limit?: number;
  skip?: number;
}

export const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 50,
  CRITICAL_QUERY_MS: 100,
} as const;

export function getSkipValue(options: PaginationOptions): number {
  if (options.skip !== undefined) {
    return options.skip;
  }

  const page = options.page || 1;
  const limit = options.limit || 20;
  return (page - 1) * limit;
}

export async function paginatedFind<T>(
  table: any,
  whereClause: any,
  pagination: PaginationOptions = {},
  orderBy?: any,
  columns?: any
): Promise<T[]> {
  const startTime = Date.now();
  const limit = pagination.limit || 20;
  const skip = getSkipValue(pagination);

  try {
    let query: any = db.select(columns || {}).from(table);

    if (whereClause) {
      query = query.where(whereClause);
    }

    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    if (skip > 0) {
      query = query.offset(skip);
    }

    const results = await query.limit(limit);
    const duration = Date.now() - startTime;

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow query detected (${duration}ms):`, {
        table: table.tsName,
        limit,
        skip,
      });
    }

    return results as T[];
  } catch (error) {
    console.error('Query error:', {
      table: table.tsName,
      error,
    });
    throw error;
  }
}

export async function countDocuments(
  table: any,
  whereClause?: any,
  useEstimate = false
): Promise<number> {
  const startTime = Date.now();

  try {
    let query: any = db.select({ count: count() }).from(table);

    if (whereClause) {
      query = query.where(whereClause);
    }

    const result = await query;
    const countValue = result[0]?.count || 0;

    const duration = Date.now() - startTime;

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow count query (${duration}ms):`, {
        table: table.tsName,
      });
    }

    return countValue as number;
  } catch (error) {
    console.error('Count error:', {
      table: table.tsName,
      error,
    });
    throw error;
  }
}

export async function findOne<T>(
  table: any,
  whereClause: any,
  columns?: any
): Promise<T | null> {
  const startTime = Date.now();

  try {
    const result = await db.select(columns || {}).from(table).where(whereClause).limit(1);
    const duration = Date.now() - startTime;

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow findOne query (${duration}ms):`, {
        table: table.tsName,
      });
    }

    return (result[0] as T) || null;
  } catch (error) {
    console.error('FindOne error:', {
      table: table.tsName,
      error,
    });
    throw error;
  }
}

export async function getLeaderboard<T>(
  table: any,
  whereClause: any,
  orderBy: any,
  limit = 100,
  columns?: any
): Promise<T[]> {
  return paginatedFind(
    table,
    whereClause,
    { limit, skip: 0 },
    orderBy,
    columns
  );
}

export async function findByIds<T>(
  table: any,
  ids: string[],
  columns?: any
): Promise<T[]> {
  if (ids.length === 0) return [];

  const startTime = Date.now();

  try {
    const results = await db
      .select(columns || {})
      .from(table)
      .where(inArray(table.id, ids));

    const duration = Date.now() - startTime;

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow batch find (${duration}ms):`, {
        table: table.tsName,
        idCount: ids.length,
      });
    }

    return results as T[];
  } catch (error) {
    console.error('Batch find error:', {
      table: table.tsName,
      idCount: ids.length,
      error,
    });
    throw error;
  }
}

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

export async function aggregate<T>(
  table: any,
  pipeline: any[],
  tableName?: string
): Promise<T[]> {
  const startTime = Date.now();

  try {
    const results = await db.select().from(table);
    const duration = Date.now() - startTime;

    if (duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      console.warn(`⚠️ Slow aggregation (${duration}ms):`, {
        table: tableName || table.tsName,
        pipelineStages: pipeline.length,
      });
    }

    return results as T[];
  } catch (error) {
    console.error('Aggregation error:', {
      table: tableName || table.tsName,
      pipeline,
      error,
    });
    throw error;
  }
}
