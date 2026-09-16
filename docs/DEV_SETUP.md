# DarkFrame Development Setup

## Quick Start

### Option 1: Next.js Dev Server
```bash
npm run dev
```
Starts the Next.js dev server (webpack) on `http://localhost:3000`.

### Option 2: Custom Server (Next + Socket.io + Jobs)
```bash
npm run dev:server
```
Runs `server.ts`: Next.js + Socket.io on one port, plus the background-job
schedulers. Use this when testing realtime messaging, jobs, or anything
outside plain page rendering. Stripe webhooks still need a separate listener.

### Option 3: Manual (Two Terminals)
**Terminal 1 - Server:**
```bash
npm run dev:server
```

**Terminal 2 - Stripe Webhooks:**
```bash
npm run stripe:listen
```

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server (webpack) on port 3000 |
| `npm run dev:server` | Custom server: Next + Socket.io + background jobs |
| `scripts/start-dev.ps1` (or `.bat`) | PATH-safe launcher: dev:server + stripe:listen |
| `npm run stripe:listen` | Stripe webhook listener only |
| `npm run stripe:trigger:checkout` | Test checkout.session.completed event |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test:ci` | Run test suite once (vitest) |

## Windows PATH Issue

If you see `Error: spawn cmd.exe ENOENT`, `C:\Windows\System32` is missing
from PATH. No npm script fixes this automatically — repair your environment:
```powershell
$env:PATH += ";C:\Windows\System32"
```

## Stripe Webhook Testing

The Stripe CLI webhook listener will show:
```
Ready! Your webhook signing secret is whsec_...
```

Test webhook events:
```bash
npm run stripe:trigger:checkout
npm run stripe:trigger:subscription-update
npm run stripe:trigger:subscription-cancel
```

## Environment Variables

Ensure `.env.local` contains:
```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://user:password@host:5432/darkframe

# Redis Configuration (Optional - for rate limiting)
# Development: Use local Redis or leave unset (falls back to in-memory)
REDIS_URL=redis://localhost:6379

# Production: Use TLS connection
# REDIS_URL=rediss://username:password@host:port

# Alternative: Upstash Redis (serverless)
# UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### Redis Setup (Optional)

**Redis is optional** - the app will work without it using in-memory rate limiting.

**For Production:** Redis is recommended for:
- Persistent rate limiting across server restarts
- Multi-instance deployments (horizontal scaling)
- Better memory management

**Local Redis (Windows):**
```powershell
# Install via Chocolatey
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
# Start Redis
redis-server
```

**Upstash (Serverless - Recommended for Production):**
1. Sign up at https://upstash.com (free tier available)
2. Create Redis database
3. Copy REST URL and token to `.env.local`
4. Uses HTTPS - no VPN/firewall issues

**Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

**Verify Redis Connection:**
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

## Troubleshooting

**Problem:** `npm run dev` still fails with ENOENT  
**Solution:** Fix `C:\Windows\System32` on PATH (see above), or use `npm run dev:server` for just the custom server

**Problem:** Stripe events not being received  
**Solution:** Check that webhook listener shows "Ready!" and server is running on port 3000

**Problem:** Movement not working in game  
**Solution:** Check server terminal for detailed error messages starting with "❌ Movement API Error Details:"
