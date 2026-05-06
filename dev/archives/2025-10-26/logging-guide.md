# Logging Best Practices Guide

**Created:** 2025-01-23  
**FID:** FID-20251023-003 (Phase 3.1 Enhanced Logging Infrastructure)  
**Status:** COMPLETED

---

## 📋 OVERVIEW

This guide provides best practices for using the enhanced logging system in DarkFrame. Follow these patterns to ensure consistent, searchable, and actionable logs across the application.

---

## 🎯 WHEN TO USE EACH LOG LEVEL

### DEBUG (Development Only)
**Purpose:** Detailed diagnostic information for debugging  
**Examples:**
- Function entry/exit with parameters
- Intermediate calculation values
- Cache hits/misses
- Database query details

```typescript
logger.debug('Calculating player battle power', {
  playerId,
  baseStats: { strength, agility, intelligence },
  modifiers
});
```

### INFO
**Purpose:** General informational messages about application flow  
**Examples:**
- Successful operations
- Important state changes
- User actions
- System events

```typescript
logger.info('Player leveled up', {
  playerId,
  oldLevel: 5,
  newLevel: 6,
  experienceGained: 1500
});
```

### WARN
**Purpose:** Potentially harmful situations that don't prevent operation  
**Examples:**
- Deprecated API usage
- Resource limits approaching
- Unexpected but recoverable conditions
- Data validation warnings

```typescript
logger.warn('Player inventory nearly full', {
  playerId,
  currentSlots: 98,
  maxSlots: 100,
  itemsToAdd: 5
});
```

### ERROR
**Purpose:** Error events that allow application to continue  
**Examples:**
- Failed operations with fallback
- External service errors
- Validation failures
- Database errors (with retry)

```typescript
logger.error('Failed to send notification', error, {
  playerId,
  notificationType: 'achievement',
  willRetry: true
});
```

### FATAL
**Purpose:** Severe errors that may cause application to abort  
**Examples:**
- Database connection failures
- Critical system errors
- Unrecoverable state corruption
- Security breaches

```typescript
logger.fatal('Database connection lost', error, {
  connectionAttempts: 3,
  lastError: error.message
});
```

---

## 🔧 HOW TO ADD CONTEXT DATA

### Structured Data
**Always use structured objects** for searchable, filterable logs:

```typescript
// ✅ GOOD - Structured data
logger.info('Item crafted', {
  playerId: '12345',
  itemId: 'sword_legendary',
  craftingTime: 45000,
  materialsUsed: ['iron', 'mythril', 'dragon_scale']
});

// ❌ BAD - String interpolation
logger.info(`Player 12345 crafted sword_legendary using iron, mythril, dragon_scale`);
```

### Common Context Fields
Include these standard fields when relevant:

```typescript
{
  // Identity
  playerId: string,
  userId: string,
  clanId: string,
  
  // Timing
  duration: number,  // milliseconds
  timestamp: string, // ISO 8601
  
  // Actions
  action: string,
  outcome: 'success' | 'failure' | 'partial',
  
  // Resources
  resourceType: string,
  amount: number,
  
  // Location
  coordinate: { x: number, y: number },
  tileType: string
}
```

---

## 🎯 REQUEST ID TRACKING PATTERNS

### In API Routes (with middleware)
```typescript
import { withRequestLogging, createRouteLogger } from '@/lib';

export const GET = withRequestLogging(async (request) => {
  const log = createRouteLogger('PlayerAPI');
  
  // Request ID automatically included in all logs
  log.info('Fetching player stats');
  
  const stats = await getPlayerStats();
  
  log.info('Stats retrieved successfully', { count: stats.length });
  
  return NextResponse.json(stats);
});
```

### In Services (manual context)
```typescript
import { createLogger, getRequestContext } from '@/lib';

const logger = createLogger({ context: 'PlayerService' });

export async function getPlayerStats(playerId: string) {
  const ctx = getRequestContext();
  
  logger.debug('Loading player stats', {
    playerId,
    requestId: ctx?.requestId // Include request ID when available
  });
  
  // ... implementation
}
```

### Propagating Request IDs
```typescript
// In middleware or route handler
import { setRequestContext, generateRequestId } from '@/lib';

const requestId = generateRequestId();
setRequestContext({ requestId, timestamp: Date.now() });

// Now all subsequent logs automatically include requestId
```

---

## ⚡ PERFORMANCE LOGGING EXAMPLES

### Simple Timing
```typescript
const logger = createLogger({ context: 'BattleService' });

export async function executeBattle(attackerId: string, defenderId: string) {
  const endTimer = logger.time('executeBattle');
  
  try {
    const result = await performBattleCalculations(attackerId, defenderId);
    return result;
  } finally {
    endTimer(); // Automatically logs duration
  }
}
```

### Manual Performance Tracking
```typescript
const start = performance.now();

const result = await complexOperation();

const duration = performance.now() - start;
logger.info('Complex operation completed', {
  operation: 'mapGeneration',
  duration: Math.round(duration),
  itemsProcessed: result.length
});
```

### Slow Operation Alerts
```typescript
const SLOW_THRESHOLD = 1000; // 1 second

const duration = performance.now() - start;
if (duration > SLOW_THRESHOLD) {
  logger.warn('Slow operation detected', {
    operation: 'databaseQuery',
    duration: Math.round(duration),
    threshold: SLOW_THRESHOLD,
    query: 'findPlayersByRegion'
  });
}
```

---

## 🔒 SECURITY CONSIDERATIONS

### Never Log Sensitive Data
**Always redact sensitive information:**

```typescript
// ❌ BAD - Exposes password
logger.info('User login attempt', {
  email: 'user@example.com',
  password: 'secret123'
});

// ✅ GOOD - Sanitized
logger.info('User login attempt', {
  email: 'user@example.com',
  passwordProvided: true,
  passwordLength: 9
});
```

### PII (Personally Identifiable Information)
```typescript
// Use hashed or tokenized IDs instead of real data
logger.info('User profile updated', {
  userId: 'hash_abc123',  // ✅ Hashed ID
  fieldsUpdated: ['displayName', 'avatar'], // ✅ Field names only
  // ❌ Don't log actual email, IP, real name
});
```

### Automatic Sanitization
```typescript
function sanitizeLogData(data: any): any {
  const sensitive = ['password', 'token', 'secret', 'apiKey', 'ssn', 'creditCard'];
  const sanitized = { ...data };
  
  for (const field of sensitive) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

logger.info('User data processed', sanitizeLogData(userData));
```

---

## 📊 PRACTICAL USAGE PATTERNS

### Pattern 1: API Route with Full Logging
```typescript
import { withRequestLogging, createRouteLogger } from '@/lib';

export const POST = withRequestLogging(async (request) => {
  const log = createRouteLogger('CraftingAPI');
  const endTimer = log.time('craftItem');
  
  try {
    const { itemId, materialIds } = await request.json();
    
    log.debug('Crafting request received', { itemId, materialIds });
    
    const result = await craftItem(itemId, materialIds);
    
    log.info('Item crafted successfully', {
      itemId,
      resultItemId: result.id,
      craftingTime: result.duration
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    log.error('Crafting failed', error as Error, { itemId });
    return NextResponse.json(
      { error: 'Crafting failed' },
      { status: 500 }
    );
  } finally {
    endTimer();
  }
});
```

### Pattern 2: Service with Child Loggers
```typescript
import { createLogger } from '@/lib';

const logger = createLogger({ context: 'PlayerService' });

export async function updatePlayerStats(playerId: string, stats: Stats) {
  const log = logger.child('updateStats');
  
  log.debug('Updating player stats', { playerId, stats });
  
  try {
    const result = await db.update(playerId, stats);
    log.info('Stats updated', { playerId });
    return result;
  } catch (error) {
    log.error('Failed to update stats', error as Error, { playerId });
    throw error;
  }
}
```

### Pattern 3: Error Handling with Context
```typescript
try {
  const result = await riskyOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn('Validation failed', {
      errorType: 'validation',
      fields: error.fields,
      playerId
    });
    // Handle gracefully
  } else if (error instanceof NetworkError) {
    logger.error('Network error', error, {
      errorType: 'network',
      endpoint: error.endpoint,
      retryAttempt: attempt
    });
    // Retry logic
  } else {
    logger.fatal('Unexpected error', error, {
      errorType: 'unknown',
      operation: 'riskyOperation'
    });
    // Critical failure
  }
}
```

---

## 🔍 SEARCHABLE LOG PATTERNS

### Use Consistent Field Names
```typescript
// ✅ GOOD - Consistent naming
logger.info('Battle started', { battleId, attackerId, defenderId });
logger.info('Battle ended', { battleId, winnerId, loserId, duration });

// ❌ BAD - Inconsistent naming
logger.info('Battle started', { id: battleId, attacker: attackerId });
logger.info('Battle ended', { battleId, winner: winnerId });
```

### Add Operation Markers
```typescript
// Start
logger.info('OPERATION_START: MapGeneration', { mapId, size });

// Progress
logger.debug('OPERATION_PROGRESS: MapGeneration', { mapId, percentComplete: 50 });

// End
logger.info('OPERATION_END: MapGeneration', { mapId, duration, tilesGenerated });
```

### Use Structured Error Codes
```typescript
logger.error('Operation failed', error, {
  errorCode: 'CRAFT_INSUFFICIENT_MATERIALS',
  playerId,
  itemId,
  requiredMaterials,
  availableMaterials
});
```

---

## 🚀 MIGRATION FROM CONSOLE.LOG

### Replace Console Statements
```typescript
// ❌ OLD - console.log
console.log('Player logged in:', playerId);
console.error('Login failed:', error);

// ✅ NEW - Structured logging
import { logger } from '@/lib';

logger.info('Player logged in', { playerId });
logger.error('Login failed', error, { playerId });
```

### Development vs Production
```typescript
// Development: Detailed debugging
if (process.env.NODE_ENV === 'development') {
  logger.debug('Full request details', {
    headers: Object.fromEntries(request.headers),
    body: await request.json()
  });
}

// Production: Essential info only
logger.info('Request processed', {
  method: request.method,
  path: url.pathname,
  status: response.status
});
```

---

## 📈 MONITORING AND ALERTS

### Log for Metrics
```typescript
// Track business metrics
logger.info('METRIC: PlayerRegistration', {
  timestamp: new Date().toISOString(),
  playerId,
  referralSource: 'organic',
  conversionTime: 3600000 // 1 hour
});

// Track performance metrics
logger.info('METRIC: APIPerformance', {
  endpoint: '/api/player/stats',
  duration: 45,
  cacheHit: true
});
```

### Alert-worthy Events
```typescript
// Security events
logger.warn('ALERT: MultipleFailedLogins', {
  playerId,
  attemptCount: 5,
  timeWindow: 300000, // 5 minutes
  lastAttempt: new Date().toISOString()
});

// Resource exhaustion
logger.error('ALERT: DatabaseConnectionPool', {
  availableConnections: 2,
  totalConnections: 100,
  queuedRequests: 50
});
```

---

## ✅ CHECKLIST

Before deploying logging changes:

- [ ] All sensitive data redacted (passwords, tokens, PII)
- [ ] Consistent field names across related logs
- [ ] Appropriate log levels used
- [ ] Performance timers on slow operations
- [ ] Error context includes troubleshooting info
- [ ] Request IDs propagate through service calls
- [ ] Structured data (not string interpolation)
- [ ] Environment-aware (debug logs dev-only)

---

## 🔗 RELATED DOCUMENTATION

- **Production Logger:** `lib/logger/productionLogger.ts`
- **Request Middleware:** `lib/middleware/requestLogger.ts`
- **Phase 3 Roadmap:** `dev/phase3-roadmap.md`

---

## 📚 ADDITIONAL RESOURCES

**Log Aggregation Tools:**
- Datadog
- CloudWatch Logs
- Elasticsearch + Kibana
- Grafana Loki

**Best Practices:**
- [12 Factor App - Logs](https://12factor.net/logs)
- [Google Cloud Logging Best Practices](https://cloud.google.com/logging/docs/best-practices)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

---

**Implementation Status:** ✅ COMPLETED  
**Next Steps:** Apply logging patterns to API routes, add health check endpoint
