/**
 * Custom Next.js Server with Socket.io Support
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Custom Node.js server that runs Next.js with Socket.io integration.
 * Required because Next.js App Router doesn't natively support WebSockets.
 * 
 * Usage:
 * - Development: `npm run dev` (loads .env.local via tsx -r dotenv/config)
 * - Production: Build with `npm run build`, then `npm start`
 * 
 * Architecture:
 * - Creates HTTP server
 * - Attaches Next.js request handler
 * - Initializes Socket.io on same server
 * - Single port for both HTTP and WebSocket
 * 
 * Note: Environment variables are loaded via tsx's -r flag in package.json,
 * ensuring they're available BEFORE any TypeScript modules are imported.
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Initialize Socket.io (using dynamic import to access TypeScript ES module)
  // Note: The .ts extension is required for dynamic import to find the TypeScript file
  setTimeout(() => {
    import('./lib/websocket/server.ts').then(({ getSocketIOServer }) => {
      getSocketIOServer(httpServer);
      console.log('[Server] ✅ Socket.io initialized and ready');
    }).catch(err => {
      console.error('[Server] ⚠️  Socket.io initialization failed:', err.message);
      console.log('[Server] Server will run without WebSocket support');
      console.log('[Server] Tip: Ensure tsx is installed globally or use `npx tsx server.js`');
    });
  }, 2000); // Wait 2 seconds for Next.js to compile TypeScript

  httpServer.listen(port, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║  🚀 DarkFrame Server Ready                    ║
║                                               ║
║  🌐 HTTP:      http://${hostname}:${port}     ║
║  🔌 WebSocket: ws://${hostname}:${port}/api/socketio ║
║  📦 Mode:      ${dev ? 'Development' : 'Production'}              ║
╚═══════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
