/**
 * Custom Next.js Server with Socket.io Support (TypeScript)
 * Created: 2025-01-19
 * Updated: 2025-10-19
 * 
 * OVERVIEW:
 * Production-ready TypeScript server that runs Next.js with Socket.io integration.
 * Uses tsx with --env-file flag for environment variable loading.
 * 
 * This implementation follows TypeScript-first principles:
 * - Full type safety for Next.js app and HTTP server
 * - Direct imports of TypeScript modules (no compilation workarounds)
 * - Proper error handling with typed error responses
 * - Graceful shutdown for production deployments
 * - Environment variables loaded via tsx --env-file=.env.local
 * 
 * Usage:
 * - Development: `npm run dev` (uses tsx --env-file=.env.local)
 * - Production: `npm run build` then `npm run start`
 * 
 * Architecture:
 * - Environment variables loaded by tsx before module imports
 * - Creates HTTP server with typed request/response handlers
 * - Attaches Next.js request handler with error boundaries
 * - Initializes Socket.io on same server (single port)
 * - Graceful shutdown handling for clean restarts
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import type { Server as HTTPServer } from 'http';
import type { NextServer } from 'next/dist/server/next';
import { getSocketIOServer } from './lib/websocket/server';
import { startWMDJobs, stopWMDJobs } from './lib/wmd/jobs/scheduler';
import { startFlagBotJob, stopFlagBotJob } from './lib/jobs/flagBotManager';
import { createServiceClient } from './lib/supabase/server';

// Environment configuration
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js with typed configuration
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/**
 * Initialize and start the custom server
 * 
 * Process:
 * 1. Prepare Next.js application (compile routes, load config)
 * 2. Create HTTP server with async request handler
 * 3. Initialize Socket.io server on same HTTP instance
 * 4. Start listening on configured port
 * 5. Setup graceful shutdown handlers
 * 
 * Error Handling:
 * - Request errors: Return 500 with JSON error details
 * - Socket.io errors: Non-fatal warning, server continues
 * - Startup errors: Fatal, exit process with error code
 */
async function startServer(): Promise<void> {
  try {
    // Prepare Next.js
    console.log('[Server] 🔄 Preparing Next.js application...');
    await app.prepare();
    console.log('[Server] ✅ Next.js application ready');

    // Create HTTP server with typed request handler
    const httpServer: HTTPServer = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url || '', true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('[Server] ❌ Error handling request:', {
          url: req.url,
          method: req.method,
          error: err instanceof Error ? err.message : String(err),
        });

        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: dev ? (err instanceof Error ? err.message : String(err)) : 'An unexpected error occurred',
        }));
      }
    });

    // Initialize Socket.io server
    try {
      console.log('[Server] 🔄 Initializing Socket.io...');
      getSocketIOServer(httpServer);
      console.log('[Server] ✅ Socket.io initialized and ready');
    } catch (err) {
      console.error('[Server] ⚠️  Socket.io initialization failed:', {
        error: err instanceof Error ? err.message : String(err),
        stack: dev && err instanceof Error ? err.stack : undefined,
      });
      console.log('[Server] ⚠️  Server will run without WebSocket support');
    }

    // ============================================================
    // FACTORY SLOTS STARTUP MIGRATION (SKIPPED — Supabase)
    // ============================================================
    console.log('[Server] ℹ️  Factory Slots migration skipped (one-time migration already applied to Supabase; factories table has correct slots)');

    // WMD background jobs deferred — need Supabase rewrite of 5 job modules
    // Initialize WMD Background Jobs
    try {
      console.log('[Server] 🔄 Starting WMD background jobs...');
      const jobsResult = startWMDJobs();
      
      if (jobsResult.success) {
        console.log('[Server] ✅ WMD jobs started:', jobsResult.message);
      } else {
        console.error('[Server] ⚠️  WMD jobs failed to start:', jobsResult.message);
      }
      console.log('[Server] ⚠️  WMD background jobs deferred — need Supabase rewrite of 5 job modules');
    } catch (err) {
      console.error('[Server] ⚠️  WMD jobs initialization failed:', {
        error: err instanceof Error ? err.message : String(err),
        stack: dev && err instanceof Error ? err.stack : undefined,
      });
      console.log('[Server] ⚠️  Server will run without WMD background jobs');
    }

    // Initialize Flag Bot Background Job
    try {
      console.log('[Server] 🔄 Starting Flag Bot background job...');
      const flagJobResult = await startFlagBotJob();
      
      if (flagJobResult.success) {
        console.log('[Server] ✅ Flag bot job started:', flagJobResult.message);
      } else {
        console.error('[Server] ⚠️  Flag bot job failed to start:', flagJobResult.message);
      }
    } catch (err) {
      console.error('[Server] ⚠️  Flag bot job initialization failed:', {
        error: err instanceof Error ? err.message : String(err),
        stack: dev && err instanceof Error ? err.stack : undefined,
      });
      console.log('[Server] ⚠️  Server will run without Flag Bot background job');
    }

    // ============================================================
    // START FACTORY SLOT REGENERATION BACKGROUND JOB
    // ============================================================
    try {
      console.log('[Server] 🔄 Starting Factory Slot Regeneration background job...');
      const { startFactorySlotRegenJob } = await import('./lib/jobs/factorySlotRegeneration');
      const factoryJobResult = await startFactorySlotRegenJob();
      
      if (factoryJobResult.success) {
        console.log('[Server] ✅ Factory slot regen job started:', factoryJobResult.message);
      } else {
        console.error('[Server] ⚠️  Factory slot regen job failed to start:', factoryJobResult.message);
      }
    } catch (err) {
      console.error('[Server] ⚠️  Factory slot regen job initialization failed:', {
        error: err instanceof Error ? err.message : String(err),
        stack: dev && err instanceof Error ? err.stack : undefined,
      });
      console.log('[Server] ⚠️  Server will run without Factory Slot Regeneration background job');
    }

    // Start HTTP server
    await new Promise<void>((resolve, reject) => {
      httpServer.listen(port, hostname, () => resolve());
      httpServer.on('error', reject);
    });

    // Log success
    console.log(`
╔════════════════════════════════════════════════════════╗
║  🚀 DarkFrame Server Ready (TypeScript)                ║
║                                                        ║
║  🌐 HTTP:      http://${hostname}:${port.toString().padEnd(26)}║
║  🔌 WebSocket: ws://${hostname}:${port}/api/socketio${' '.repeat(10)}║
║  📦 Mode:      ${(dev ? 'Development' : 'Production').padEnd(37)}║
║  🔧 Runtime:   tsx (TypeScript execution)${' '.repeat(12)}║
╚════════════════════════════════════════════════════════╝
    `);

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\n[Server] 🛑 ${signal} received, shutting down gracefully...`);
      
      // Stop WMD background jobs
      try {
        const stopResult = stopWMDJobs();
        console.log('[Server] ✅ WMD jobs stopped:', stopResult.message);
      } catch (err) {
        console.error('[Server] ⚠️  Error stopping WMD jobs:', err);
      }
      
      // Stop Flag Bot background job
      try {
        const flagStopResult = stopFlagBotJob();
        console.log('[Server] ✅ Flag bot job stopped:', flagStopResult.message);
      } catch (err) {
        console.error('[Server] ⚠️  Error stopping Flag bot job:', err);
      }
      
      // Stop Factory Slot Regeneration background job
      try {
        const { stopFactorySlotRegenJob } = await import('./lib/jobs/factorySlotRegeneration');
        const factoryStopResult = stopFactorySlotRegenJob();
        console.log('[Server] ✅ Factory slot regen job stopped:', factoryStopResult.message);
      } catch (err) {
        console.error('[Server] ⚠️  Error stopping Factory slot regen job:', err);
      }
      
      httpServer.close(() => {
        console.log('[Server] ✅ HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('[Server] ⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (err) {
    console.error('[Server] ❌ Failed to start server:', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the server
startServer();

/**
 * IMPLEMENTATION NOTES:
 * 
 * Type Safety:
 * - NextServer type ensures proper Next.js configuration
 * - HTTPServer type provides Node.js server typing
 * - Error handling uses proper type guards (instanceof Error)
 * 
 * Error Handling:
 * - Request errors: 500 response with JSON error details
 * - Socket.io errors: Non-fatal, server continues without WebSockets
 * - Startup errors: Fatal, exit process with error code
 * 
 * Production Considerations:
 * - Graceful shutdown for zero-downtime deployments
 * - Structured error logging for monitoring integration
 * - Environment-specific error detail exposure
 * - Timeout handling for forced shutdown scenarios
 */
