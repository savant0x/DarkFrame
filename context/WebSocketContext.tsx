/**
 * WebSocket Context Provider
 * Created: 2025-01-19
 * 
 * OVERVIEW:
 * React Context for managing Socket.io client connection across the application.
 * Provides connection state, auto-reconnect, and socket instance to all child components.
 * 
 * Features:
 * - Automatic connection on mount
 * - Auto-reconnect with exponential backoff
 * - Connection state tracking (connecting, connected, disconnected, error)
 * - Singleton socket instance shared across app
 * - Authentication via HTTP-only cookies (automatic)
 * - Graceful cleanup on unmount
 * 
 * Usage:
 * ```tsx
 * // In app/layout.tsx
 * <WebSocketProvider>
 *   {children}
 * </WebSocketProvider>
 * 
 * // In components
 * const { socket, isConnected } = useWebSocketContext();
 * ```
 */

'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/websocket';

// ============================================================================
// TYPES
// ============================================================================

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketContextValue {
  /** Socket.io client instance */
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Whether socket is currently connected */
  isConnected: boolean;
  /** Last error message (if any) */
  error: string | null;
  /** Manually reconnect to server */
  reconnect: () => void;
  /** Manually disconnect from server */
  disconnect: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface WebSocketProviderProps {
  children: React.ReactNode;
  /** Optional custom server URL (defaults to current domain) */
  serverUrl?: string;
  /** Whether to auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

export function WebSocketProvider({
  children,
  serverUrl,
  autoConnect = true, // Auto-connect now that TypeScript server is working
}: WebSocketProviderProps) {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = useCallback(() => {
    return Math.min(
      baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
      30000 // Max 30 seconds
    );
  }, []);

  /**
   * Initialize socket connection
   */
  const connect = useCallback(() => {
    if (socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    console.log('[WebSocket] Initializing connection...');
    setConnectionState('connecting');
    setError(null);

    const url = serverUrl || window.location.origin;
    
    const newSocket = io(url, {
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      reconnection: false, // We handle reconnection manually
      withCredentials: true, // Send cookies for authentication
    });

    // Connection successful
    newSocket.on('connect', () => {
      console.log('[WebSocket] Connected successfully');
      setConnectionState('connected');
      setError(null);
      reconnectAttemptsRef.current = 0; // Reset reconnect counter
    });

    // Connection error
    newSocket.on('connect_error', (err) => {
      const isAuthError = err.message.includes('authentication') || err.message.includes('token');
      
      // For auth errors on initial connection (attempt 0), this is likely a timing issue
      // The server now has retry logic (3 attempts with backoff), so we should retry a few times
      // to give the session cookie time to be established
      const isInitialConnection = reconnectAttemptsRef.current === 0;
      const shouldRetryAuthError = isAuthError && isInitialConnection && reconnectAttemptsRef.current < 3;
      
      // Use warn for auth errors (expected when not logged in), error for others
      if (isAuthError) {
        if (shouldRetryAuthError) {
          console.warn('[WebSocket] Initial auth error (timing issue), will retry:', err.message);
        } else {
          console.warn('[WebSocket] Authentication failed after retries:', err.message);
        }
      } else {
        console.error('[WebSocket] Connection error:', err.message);
      }
      
      setConnectionState('error');
      setError(err.message);

      // Don't retry authentication errors UNLESS it's an initial connection timing issue
      if (isAuthError && !shouldRetryAuthError) {
        console.warn('[WebSocket] Skipping reconnection attempts - authentication required');
        return;
      }

      // Attempt reconnection with exponential backoff
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = getReconnectDelay();
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current += 1;
          newSocket.connect();
        }, delay);
      } else {
        console.error('[WebSocket] Max reconnection attempts reached');
        setError('Failed to connect after multiple attempts. Please refresh the page.');
      }
    });

    // Disconnection
    newSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setConnectionState('disconnected');

      // Auto-reconnect if server disconnected us (not manual disconnect)
      if (reason === 'io server disconnect') {
        console.log('[WebSocket] Server disconnected, reconnecting...');
        reconnectAttemptsRef.current = 0;
        newSocket.connect();
      } else if (reason === 'transport close' || reason === 'ping timeout') {
        // Network issue, attempt reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = getReconnectDelay();
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            newSocket.connect();
          }, delay);
        }
      }
    });

    setSocket(newSocket);
  }, [serverUrl, getReconnectDelay]); // Removed 'socket' to prevent infinite loop

  /**
   * Manually trigger reconnection
   */
  const reconnect = useCallback(() => {
    console.log('[WebSocket] Manual reconnection triggered');
    reconnectAttemptsRef.current = 0;
    
    if (socket) {
      socket.disconnect();
      socket.connect();
    } else {
      connect();
    }
  }, [socket, connect]);

  /**
   * Manually disconnect
   */
  const disconnectSocket = useCallback(() => {
    console.log('[WebSocket] Manual disconnection triggered');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    
    setConnectionState('disconnected');
    setError(null);
  }, [socket]);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (autoConnect && !socket) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        console.log('[WebSocket] Cleaning up connection');
        socket.disconnect();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]); // Only run on mount and when autoConnect changes

  const value: WebSocketContextValue = {
    socket,
    connectionState,
    isConnected: connectionState === 'connected',
    error,
    reconnect,
    disconnect: disconnectSocket,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access WebSocket context
 * 
 * @throws Error if used outside WebSocketProvider
 * @returns WebSocket context value
 * 
 * @example
 * ```tsx
 * const { socket, isConnected } = useWebSocketContext();
 * 
 * useEffect(() => {
 *   if (!socket || !isConnected) return;
 *   
 *   socket.emit('game:update_position', { x: 10, y: 20 });
 * }, [socket, isConnected]);
 * ```
 */
export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  
  return context;
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Connection Management:
 *    - Auto-connects on mount by default
 *    - Uses HTTP-only cookies for authentication (no manual token needed)
 *    - Exponential backoff for reconnection (1s → 2s → 4s → 8s → 16s → 30s max)
 *    - Max 5 reconnection attempts before giving up
 * 
 * 2. State Tracking:
 *    - connecting: Initial connection attempt
 *    - connected: Successfully connected and authenticated
 *    - disconnected: Not connected (manual or graceful disconnect)
 *    - error: Connection failed or authentication error
 * 
 * 3. Reconnection Logic:
 *    - Automatic on network issues (transport close, ping timeout)
 *    - Automatic if server disconnects client
 *    - Manual via reconnect() function
 *    - Uses exponential backoff to prevent server overload
 * 
 * 4. Authentication:
 *    - Handled automatically via HTTP-only cookies
 *    - withCredentials: true sends cookies with connection
 *    - Server middleware validates JWT from cookie
 *    - No client-side token management needed
 * 
 * 5. Cleanup:
 *    - Clears reconnection timers on unmount
 *    - Disconnects socket gracefully
 *    - Prevents memory leaks
 * 
 * 6. Usage Pattern:
 *    - Wrap app in WebSocketProvider (layout.tsx)
 *    - Use useWebSocketContext() in any component
 *    - Check isConnected before emitting events
 *    - Use useWebSocket() hook for event subscriptions (see hooks/useWebSocket.ts)
 * 
 * PERFORMANCE:
 * - Socket instance shared across entire app (singleton pattern)
 * - No unnecessary re-renders (stable socket reference)
 * - Efficient reconnection strategy
 * 
 * SECURITY:
 * - Cookies sent via withCredentials (secure, HttpOnly)
 * - No token exposure in client code
 * - Server validates on every connection
 */
