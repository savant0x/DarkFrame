/**
 * useWebSocket Hook
 * Created: 2025-01-19
 * 
 * OVERVIEW:
 * Custom React hook for convenient WebSocket event subscription and emission.
 * Provides type-safe event handling with automatic cleanup and connection status checking.
 * 
 * Features:
 * - Type-safe event subscription
 * - Automatic event listener cleanup
 * - Connection status validation
 * - Convenient emit functions
 * - React lifecycle integration
 * 
 * Usage:
 * ```tsx
 * const { emit, on, isConnected } = useWebSocket();
 * 
 * // Subscribe to events
 * on('chat:message', (data) => {
 *   console.log('New message:', data);
 * });
 * 
 * // Emit events
 * emit('chat:send_message', { channelId: 'general', content: 'Hello!' });
 * ```
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/types/websocket';

// ============================================================================
// TYPES
// ============================================================================

type ServerEventNames = keyof ServerToClientEvents;
type ClientEventNames = keyof ClientToServerEvents;

type ServerEventHandler<E extends ServerEventNames> = ServerToClientEvents[E] extends (...args: infer P) => void
  ? (...args: P) => void
  : never;

type ClientEventData<E extends ClientEventNames> = ClientToServerEvents[E] extends (data: infer D, ...args: any[]) => void
  ? D
  : never;

interface UseWebSocketReturn {
  /** Emit a client event to the server */
  emit: <E extends ClientEventNames>(
    event: E,
    ...args: ClientToServerEvents[E] extends (data: infer D, callback?: infer C) => void
      ? [data: D, callback?: C]
      : ClientToServerEvents[E] extends (callback: infer C) => void
      ? [callback?: C]
      : never
  ) => void;
  
  /** Subscribe to a server event */
  on: <E extends ServerEventNames>(
    event: E,
    handler: ServerEventHandler<E>
  ) => () => void;
  
  /** Subscribe to a server event (runs once, then unsubscribes) */
  once: <E extends ServerEventNames>(
    event: E,
    handler: ServerEventHandler<E>
  ) => void;
  
  /** Whether socket is connected */
  isConnected: boolean;
  
  /** Current connection state */
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  /** Manually reconnect */
  reconnect: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for WebSocket event handling
 * 
 * @returns WebSocket utilities and connection state
 * 
 * @example
 * ```tsx
 * function ChatPanel() {
 *   const { emit, on, isConnected } = useWebSocket();
 *   const [messages, setMessages] = useState([]);
 * 
 *   // Subscribe to incoming messages
 *   useEffect(() => {
 *     const unsubscribe = on('chat:message', (data) => {
 *       setMessages(prev => [...prev, data]);
 *     });
 *     return unsubscribe;
 *   }, [on]);
 * 
 *   // Send message
 *   const sendMessage = (text: string) => {
 *     if (!isConnected) {
 *       console.error('Not connected');
 *       return;
 *     }
 *     
 *     emit('chat:send_message', {
 *       clanId: userClanId,
 *       message: text,
 *     }, (response) => {
 *       if (!response.success) {
 *         console.error('Send failed:', response.error);
 *       }
 *     });
 *   };
 * 
 *   return (
 *     <div>
 *       {isConnected ? 'Connected' : 'Disconnected'}
 *       {messages.map(msg => <div key={msg.id}>{msg.text}</div>)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebSocket(): UseWebSocketReturn {
  const { socket, isConnected, connectionState, reconnect } = useWebSocketContext();
  const listenersRef = useRef<Map<string, Function>>(new Map());

  /**
   * Emit event to server (type-safe)
   */
  const emit = useCallback<UseWebSocketReturn['emit']>(
    (event, ...args) => {
      if (!socket) {
        console.warn(`[useWebSocket] Cannot emit '${event}': Socket not initialized`);
        return;
      }

      if (!isConnected) {
        console.warn(`[useWebSocket] Cannot emit '${event}': Not connected`);
        return;
      }

      // @ts-expect-error - Complex overload, but runtime is correct
      socket.emit(event, ...args);
    },
    [socket, isConnected]
  );

  /**
   * Subscribe to server event (type-safe)
   * Returns unsubscribe function
   */
  const on = useCallback<UseWebSocketReturn['on']>(
    (event, handler) => {
      if (!socket) {
        console.warn(`[useWebSocket] Cannot subscribe to '${event}': Socket not initialized`);
        return () => {}; // Return no-op unsubscribe
      }

      // Store listener reference for cleanup
      const listenerKey = `${event}-${Date.now()}`;
      listenersRef.current.set(listenerKey, handler);

      // @ts-expect-error - Complex type, but runtime is correct
      socket.on(event, handler);

      // Return unsubscribe function
      return () => {
        // @ts-expect-error - Complex type, but runtime is correct
        socket.off(event, handler);
        listenersRef.current.delete(listenerKey);
      };
    },
    [socket]
  );

  /**
   * Subscribe to server event once (auto-unsubscribes after first event)
   */
  const once = useCallback<UseWebSocketReturn['once']>(
    (event, handler) => {
      if (!socket) {
        console.warn(`[useWebSocket] Cannot subscribe to '${event}': Socket not initialized`);
        return;
      }

      // @ts-expect-error - Complex type, but runtime is correct
      socket.once(event, handler);
    },
    [socket]
  );

  /**
   * Cleanup all listeners on unmount
   */
  useEffect(() => {
    return () => {
      if (socket) {
        listenersRef.current.forEach((handler, key) => {
          const eventName = key.split('-')[0];
          // @ts-expect-error - Runtime cleanup
          socket.off(eventName, handler);
        });
        listenersRef.current.clear();
      }
    };
  }, [socket]);

  return {
    emit,
    on,
    once,
    isConnected,
    connectionState,
    reconnect,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Type Safety:
 *    - Full TypeScript support for all events
 *    - Event names autocomplete in IDE
 *    - Payload types validated at compile time
 *    - Callback types enforced
 * 
 * 2. Event Subscription:
 *    - on() - Persistent listener, manual cleanup
 *    - once() - Auto-unsubscribes after first event
 *    - Returns unsubscribe function for on()
 *    - Automatic cleanup on component unmount
 * 
 * 3. Event Emission:
 *    - Validates connection before emitting
 *    - Supports callbacks for request/response patterns
 *    - Type-safe payloads
 *    - Logs warnings if not connected
 * 
 * 4. Connection Awareness:
 *    - isConnected boolean for UI conditionals
 *    - connectionState for detailed status
 *    - reconnect() function for manual reconnection
 * 
 * 5. Memory Management:
 *    - Tracks all listeners for cleanup
 *    - Auto-removes listeners on unmount
 *    - Prevents memory leaks
 * 
 * USAGE PATTERNS:
 * 
 * Pattern 1: Simple Event Subscription
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = on('game:level_up', (data) => {
 *     showNotification(`Level ${data.newLevel}!`);
 *   });
 *   return unsubscribe;
 * }, [on]);
 * ```
 * 
 * Pattern 2: Request/Response with Callback
 * ```tsx
 * const declareWar = (targetClanId: string) => {
 *   emit('clan:declare_war', { targetClanId }, (response) => {
 *     if (response.success) {
 *       console.log('War declared!');
 *     } else {
 *       console.error('Failed:', response.error);
 *     }
 *   });
 * };
 * ```
 * 
 * Pattern 3: One-Time Event
 * ```tsx
 * useEffect(() => {
 *   once('system:maintenance_alert', (data) => {
 *     alert(`Maintenance in ${data.minutesUntil} minutes`);
 *   });
 * }, [once]);
 * ```
 * 
 * Pattern 4: Connection-Dependent Actions
 * ```tsx
 * const handleAction = () => {
 *   if (!isConnected) {
 *     toast.error('Not connected to server');
 *     return;
 *   }
 *   emit('game:update_position', { x, y });
 * };
 * ```
 * 
 * PERFORMANCE:
 * - Minimal re-renders (stable callbacks with useCallback)
 * - Efficient event listener management
 * - No unnecessary socket re-creation
 * 
 * ERROR HANDLING:
 * - Validates socket existence before operations
 * - Logs warnings for debugging
 * - Graceful fallbacks (no crashes)
 */

// ============================================================================
// SPECIALIZED HOOKS (Optional Convenience)
// ============================================================================

/**
 * Hook for game events only
 * Convenience wrapper for game-specific event handling
 */
export function useGameEvents() {
  const { on, emit, isConnected } = useWebSocket();

  const updatePosition = useCallback((x: number, y: number) => {
    emit('game:update_position', { x, y });
  }, [emit]);

  return {
    updatePosition,
    onPositionUpdate: (handler: ServerEventHandler<'game:position_update'>) => on('game:position_update', handler),
    onLevelUp: (handler: ServerEventHandler<'game:level_up'>) => on('game:level_up', handler),
    onResourceChange: (handler: ServerEventHandler<'game:resource_change'>) => on('game:resource_change', handler),
    isConnected,
  };
}

/**
 * Hook for clan events only
 * Convenience wrapper for clan-specific event handling
 */
export function useClanEvents() {
  const { on, emit, isConnected } = useWebSocket();

  const declareWar = useCallback((targetClanId: string, warType: 'territory' | 'resource' | 'honor', unitsCommitted: number) => {
    emit('clan:declare_war', { targetClanId, warType, unitsCommitted });
  }, [emit]);

  return {
    declareWar,
    onWarDeclared: (handler: ServerEventHandler<'clan:war_declared'>) => on('clan:war_declared', handler),
    onTreasuryUpdate: (handler: ServerEventHandler<'clan:treasury_update'>) => on('clan:treasury_update', handler),
    onMemberJoined: (handler: ServerEventHandler<'clan:member_joined'>) => on('clan:member_joined', handler),
    isConnected,
  };
}

/**
 * Hook for chat events only
 * Convenience wrapper for chat-specific event handling
 */
export function useChatEvents() {
  const { on, emit, isConnected } = useWebSocket();

  const sendMessage = useCallback((channelId: string, content: string, callback?: (response: { success: boolean; error?: string }) => void) => {
    emit('chat:send_message', { channelId, content }, callback);
  }, [emit]);

  const startTyping = useCallback((channelId: string) => {
    emit('chat:start_typing', { channelId });
  }, [emit]);

  const stopTyping = useCallback((channelId: string) => {
    emit('chat:stop_typing', { channelId });
  }, [emit]);

  return {
    sendMessage,
    startTyping,
    stopTyping,
    onMessage: (handler: ServerEventHandler<'chat:message'>) => on('chat:message', handler),
    onTyping: (handler: ServerEventHandler<'chat:typing'>) => on('chat:typing', handler),
    isConnected,
  };
}
