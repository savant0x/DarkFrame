# Redis Setup Guide

**Created:** 2025-10-18  
**Feature:** FID-20251018-041 (Redis Caching Layer)

## Overview

This guide explains how to set up and configure Redis for DarkFrame's caching layer. Redis provides high-performance in-memory caching to reduce database load and improve response times.

## Why Redis?

- **Speed:** Sub-millisecond response times
- **Persistence:** Optional data persistence for reliability
- **Scalability:** Handles thousands of requests per second
- **Simplicity:** Simple key-value storage with TTL support

## Installation Options

### Option 1: Local Development (Windows)

#### Using WSL2 (Recommended)
```bash
# Install WSL2 if not already installed
wsl --install

# Update package lists
sudo apt update

# Install Redis
sudo apt install redis-server

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping
# Should return: PONG
```

#### Using Docker (Alternative)
```bash
# Pull Redis image
docker pull redis:latest

# Run Redis container
docker run -d --name darkframe-redis -p 6379:6379 redis:latest

# Test connection
docker exec -it darkframe-redis redis-cli ping
# Should return: PONG
```

### Option 2: Production Deployment

#### Redis Cloud (Recommended)
1. Sign up at [Redis Cloud](https://redis.com/cloud/)
2. Create a free database (30MB, sufficient for development)
3. Copy the connection URL (format: `redis://username:password@host:port`)
4. Add to `.env.local`:
```env
REDIS_URL=redis://username:password@host:port
```

#### AWS ElastiCache
1. Create ElastiCache cluster in AWS Console
2. Choose Redis engine
3. Select instance type (cache.t3.micro for dev)
4. Configure security group (allow port 6379)
5. Get cluster endpoint
6. Add to `.env.local`:
```env
REDIS_URL=redis://endpoint:6379
```

## Configuration

### Environment Variables

Add to `.env.local`:
```env
# Local development
REDIS_URL=redis://localhost:6379

# Production (with authentication)
REDIS_URL=redis://username:password@host:port
```

### Connection Options

The Redis client is pre-configured with:
- **Auto-reconnection:** Exponential backoff (50ms to 2000ms)
- **Max retries:** 3 per request
- **Connect timeout:** 10 seconds
- **Offline queue:** Enabled (queues commands when disconnected)
- **Auto-pipelining:** Enabled for batch operations

## Cache Architecture

### Cache Categories

| Category     | Prefix         | TTL   | Purpose                    |
| ------------ | -------------- | ----- | -------------------------- |
| Leaderboards | `leaderboard:` | 5 min | Top 100 player/clan ranks  |
| Clans        | `clan:`        | 2 min | Clan stats and membership  |
| Players      | `player:`      | 1 min | Player profiles and stats  |
| Territories  | `territory:`   | 5 min | Territory ownership map    |
| Battles      | `battle:`      | 10 min| Battle logs and history    |
| Auctions     | `auction:`     | 30 sec| Active auction listings    |
| Factories    | `factory:`     | 2 min | Factory status and output  |
| Achievements | `achievement:` | 5 min | Achievement definitions    |

### Cache Warming

Hot data is pre-cached on server startup:
- Top 100 players (all leaderboard categories)
- Top 50 clans
- Global territory ownership map
- Recent battle logs

To manually warm cache:
```typescript
import { warmCache } from '@/lib/cacheWarming';

await warmCache();
```

### Cache Invalidation

Caches are automatically invalidated when data changes:

```typescript
import { deleteCache, deleteCachePattern } from '@/lib/cacheService';
import { ClanKeys, PlayerKeys } from '@/lib/cacheKeys';

// Invalidate single entry
await deleteCache(PlayerKeys.profile('username'));

// Invalidate all related entries
await deleteCachePattern(PlayerKeys.allForPlayer('username'));
```

## Monitoring

### Cache Statistics

View real-time cache metrics:
```
GET /api/cache/stats
```

Response includes:
- Hit rate (% of requests served from cache)
- Memory usage (bytes and MB)
- Key counts by category
- Request statistics (hits/misses/errors)
- Redis server info

### Cache Health Check

```typescript
import { testRedisConnection, isRedisAvailable } from '@/lib/redis';

// Test connection
const result = await testRedisConnection();
console.log(result.success); // true if connected

// Check availability
const available = isRedisAvailable();
console.log(available); // true if ready
```

## Performance Targets

- **Cache hit rate:** >80%
- **Response time:** <5ms for cached queries
- **Memory usage:** <50MB for typical workload
- **Database load reduction:** 70-90%

## Troubleshooting

### Connection Refused

**Problem:** `ECONNREFUSED 127.0.0.1:6379`

**Solution:**
```bash
# Check if Redis is running
sudo service redis-server status

# Start Redis
sudo service redis-server start
```

### Authentication Failed

**Problem:** `NOAUTH Authentication required`

**Solution:**
```env
# Add password to connection URL
REDIS_URL=redis://:password@localhost:6379
```

### Memory Issues

**Problem:** `OOM command not allowed when used memory > 'maxmemory'`

**Solution:**
```bash
# Increase max memory in redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru

# Restart Redis
sudo service redis-server restart
```

### Slow Performance

**Problem:** High latency on cache operations

**Solution:**
```bash
# Check for slow commands
redis-cli --latency

# Monitor commands in real-time
redis-cli monitor

# Check memory fragmentation
redis-cli info memory
```

## Testing

### Verify Cache Operations

```typescript
import { setCache, getCache, deleteCache } from '@/lib/cacheService';

// Set cache
await setCache('test:key', { value: 'test' }, 60);

// Get cache
const data = await getCache('test:key');
console.log(data); // { value: 'test' }

// Delete cache
await deleteCache('test:key');
```

### Verify Cache Warming

```typescript
import { warmCache } from '@/lib/cacheWarming';

const stats = await warmCache();
console.log(stats);
// {
//   startTime: Date,
//   endTime: Date,
//   duration: 1234,
//   itemsWarmed: 159,
//   errors: 0,
//   categories: ['leaderboards', 'players', 'clans', 'territories']
// }
```

## Production Checklist

- [ ] Redis installed and configured
- [ ] `REDIS_URL` set in environment variables
- [ ] Connection tested with health check
- [ ] Cache warming runs on server startup
- [ ] Cache statistics endpoint accessible
- [ ] Memory limits configured (256MB recommended)
- [ ] Eviction policy set (allkeys-lru recommended)
- [ ] Monitoring dashboard configured
- [ ] Backup strategy in place (if persistence enabled)

## Security Best Practices

1. **Use Authentication:** Always set `requirepass` in production
2. **Network Security:** Restrict access to trusted IPs only
3. **No Sensitive Data:** Never cache passwords or tokens
4. **Encryption:** Use TLS for production connections
5. **Regular Audits:** Monitor for unusual access patterns

## Additional Resources

- [Redis Documentation](https://redis.io/documentation)
- [ioredis GitHub](https://github.com/luin/ioredis)
- [Redis Best Practices](https://redis.io/topics/memory-optimization)
- [Redis Security](https://redis.io/topics/security)

---

**Last Updated:** 2025-10-18  
**Next Review:** When scaling beyond 1000 concurrent users
