# DarkFrame Development Setup

## Quick Start

### Option 1: Automated (Recommended)
```bash
npm run dev
```
This will automatically:
- Fix Windows PATH issues
- Start the development server on `http://localhost:3000`
- Start the Stripe webhook listener

### Option 2: Server Only
```bash
npm run dev:only
```
Use this if you don't need Stripe webhook testing.

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
| `npm run dev` | **Primary:** Start server + Stripe webhooks (auto-fixes Windows PATH) |
| `npm run dev:only` | Server only (no webhooks) |
| `npm run dev:concurrent` | Raw concurrently command (may fail on Windows without PATH fix) |
| `npm run stripe:listen` | Stripe webhook listener only |
| `npm run stripe:trigger:checkout` | Test checkout.session.completed event |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm test` | Run tests |

## Windows PATH Issue

If you see `Error: spawn cmd.exe ENOENT`, the main `dev` script now automatically fixes this by adding `C:\Windows\System32` to PATH before running.

**Alternative:** Run this in PowerShell before any npm command:
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
MONGODB_URI=mongodb://...

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
**Solution:** Use `npm run dev:only` for just the server, or run webhook listener separately

**Problem:** Stripe events not being received  
**Solution:** Check that webhook listener shows "Ready!" and server is running on port 3000

**Problem:** Movement not working in game  
**Solution:** Check server terminal for detailed error messages starting with "❌ Movement API Error Details:"
