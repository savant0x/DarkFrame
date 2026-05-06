/**
 * Socket.io Server Route
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Next.js 15 App Router compatible Socket.io server implementation.
 * Handles WebSocket connections, authentication, event routing, and room management.
 * 
 * Architecture:
 * - Uses custom HTTP server for WebSocket upgrade
 * - JWT authentication on connection
 * - Auto-joins users to appropriate rooms
 * - Routes events to category-specific handlers
 * 
 * Integration:
 * - Mounted at /api/socketio
 * - Client connects via: io('http://localhost:3000/api/socketio')
 * - Supports both cookie and token-based auth
 */

import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { Socket } from 'socket.io';
import { authenticateSocket } from '@/lib/websocket/auth';
import { autoJoinRooms } from '@/lib/websocket/rooms';
import {
  handlePositionUpdate,
  handlePlayerOnline,
  handlePlayerOffline,
  handleJoinClanRoom,
  handleDeclareWar,
} from '@/lib/websocket/handlers';
import {
  handleMessageSend,
  handleMessageRead,
  handleTypingStart,
  handleTypingStop,
  handleJoinConversation,
  handleLeaveConversation,
} from '@/lib/websocket/messagingHandlers';
import {
  handleChatMessage,
  handleJoinChannel,
  handleLeaveChannel,
  handleTypingStart as handleChatTypingStart,
  handleTypingStop as handleChatTypingStop,
  handleAskVeterans,
  autoJoinChatChannels,
} from '@/lib/websocket/chatHandlers';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/types/websocket';

// Global Socket.io server instance (singleton)
let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

/**
 * Gets or creates Socket.io server instance
 * 
 * @param httpServer - HTTP server for Socket.io to attach to
 * @returns Socket.io server instance
 */
export function getSocketIOServer(
  httpServer: HTTPServer
): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
  if (io) {
    return io;
  }

  console.log('[Socket.io] Initializing server...');

  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/api/socketio',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ============================================================================
  // AUTHENTICATION MIDDLEWARE WITH RETRY LOGIC
  // ============================================================================

  io.use(async (socket, next) => {
    const maxRetries = 3;
    const retryDelays = [100, 300, 500]; // Exponential backoff in ms
    
    let lastError = 'Authentication failed';
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await authenticateSocket(socket);

      if (result.success && result.user) {
        // Attach user data to socket
        socket.data.user = result.user;
        console.log(`[Socket.io] User authenticated: ${result.user.username} (${socket.id})${attempt > 0 ? ` (retry ${attempt})` : ''}`);
        return next();
      }
      
      lastError = result.error || 'Authentication failed';
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
    
    // All retries failed
    console.error(`[Socket.io] Authentication failed after ${maxRetries} attempts: ${lastError}`);
    next(new Error(lastError));
  });

  // ============================================================================
  // CONNECTION HANDLER
  // ============================================================================

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user;
    const ioServer = io!; // Non-null assertion since we're inside the connection handler
    console.log(`[Socket.io] Client connected: ${user.username} (${socket.id})`);

    // Auto-join appropriate rooms
    await autoJoinRooms(socket, user);

    // Auto-join accessible chat channels
    await autoJoinChatChannels(ioServer, socket);

    // Broadcast player online status
    await handlePlayerOnline(ioServer, socket, user);

    // ============================================================================
    // GAME EVENT HANDLERS
    // ============================================================================

    socket.on('game:update_position', async (data) => {
      await handlePositionUpdate(ioServer, socket, data);
    });

    socket.on('game:request_tile_info', async (data) => {
      // TODO: Implement tile info request
      console.log(`[Socket.io] Tile info requested: (${data.x},${data.y})`);
    });

    // ============================================================================
    // CLAN EVENT HANDLERS
    // ============================================================================

    socket.on('clan:join_room', async (data) => {
      await handleJoinClanRoom(ioServer, socket, data);
    });

    socket.on('clan:declare_war', async (data) => {
      await handleDeclareWar(ioServer, socket, data);
    });

    // ============================================================================
    // CHAT EVENT HANDLERS (Global/Channel Chat)
    // ============================================================================

    socket.on('chat:send_message', async (data, callback) => {
      await handleChatMessage(ioServer, socket, data, callback);
    });

    socket.on('chat:join_channel', async (data, callback) => {
      await handleJoinChannel(ioServer, socket, data, callback);
    });

    socket.on('chat:leave_channel', async (data) => {
      await handleLeaveChannel(ioServer, socket, data);
    });

    socket.on('chat:start_typing', async (data) => {
      await handleChatTypingStart(ioServer, socket, data);
    });

    socket.on('chat:stop_typing', async (data) => {
      await handleChatTypingStop(ioServer, socket, data);
    });

    socket.on('chat:ask_veterans', async (data, callback) => {
      await handleAskVeterans(ioServer, socket, data, callback);
    });

    // ============================================================================
    // MESSAGING EVENT HANDLERS (Private 1-on-1)
    // ============================================================================

    socket.on('message:send', async (data, callback) => {
      await handleMessageSend(ioServer, socket, data, callback);
    });

    socket.on('message:mark_read', async (data) => {
      await handleMessageRead(ioServer, socket, data);
    });

    socket.on('typing:start_private', async (data) => {
      await handleTypingStart(ioServer, socket, data);
    });

    socket.on('typing:stop_private', async (data) => {
      await handleTypingStop(ioServer, socket, data);
    });

    socket.on('conversation:join', async (data) => {
      await handleJoinConversation(socket, data);
    });

    socket.on('conversation:leave', async (data) => {
      await handleLeaveConversation(socket, data);
    });

    // ============================================================================
    // SYSTEM EVENT HANDLERS
    // ============================================================================

    socket.on('system:ping', (callback) => {
      callback(Date.now());
    });

    // ============================================================================
    // DISCONNECTION HANDLER
    // ============================================================================

    socket.on('disconnect', async (reason) => {
      console.log(`[Socket.io] Client disconnected: ${user.username} (${socket.id}) - ${reason}`);
      await handlePlayerOffline(ioServer, user);
    });
  });

  console.log('[Socket.io] Server initialized successfully');
  return io;
}

/**
 * Gets existing Socket.io server instance
 * 
 * @returns Socket.io server instance or null
 */
export function getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null {
  return io;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Next.js App Router Compatibility:
 *    - Socket.io requires HTTP server, not available in App Router by default
 *    - Use custom server or API route with server.ts setup
 *    - Path: /api/socketio for client connections
 * 
 * 2. Authentication Flow:
 *    - Middleware runs on every connection attempt
 *    - JWT verified from cookie or handshake token
 *    - User data attached to socket.data.user
 *    - Failed auth prevents connection
 * 
 * 3. Room Management:
 *    - Auto-join global, user, and clan rooms on connect
 *    - Dynamic room joining via events
 *    - Auto-leave rooms on disconnect (handled by Socket.io)
 * 
 * 4. Event Routing:
 *    - Events categorized: game, clan, chat, combat, system
 *    - Each category has dedicated handler functions
 *    - Handlers validate permissions and update database
 * 
 * 5. Error Handling:
 *    - All handlers wrapped in try-catch
 *    - Errors logged with context
 *    - Failed operations don't crash server
 * 
 * 6. Performance:
 *    - Singleton pattern prevents multiple server instances
 *    - Efficient room-based broadcasting
 *    - Ping/pong for connection monitoring
 * 
 * DEPLOYMENT NOTES:
 * - For Vercel/serverless: Consider alternative (Pusher, Ably)
 * - For VPS/dedicated: Use PM2 or similar for server management
 * - Set NEXT_PUBLIC_APP_URL for production CORS
 * - Enable WebSocket transport for better performance
 * 
 * TESTING:
 * - Use /app/test/websocket page for connection testing
 * - Monitor logs for authentication and event flow
 * - Test room subscriptions and broadcasts
 */
