/**
 * @file components/admin/WebSocketConsoleModal.tsx
 * @created 2025-10-19
 * @overview WebSocket testing console for admin panel
 * 
 * OVERVIEW:
 * Modal component for testing WebSocket functionality within the admin panel.
 * Tests connection, authentication, event emission/reception, and latency.
 * Embedded within admin interface following ECHO containment principles.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWebSocketContext } from '@/context/WebSocketContext';

interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'event';
  event?: string;
  message: string;
  data?: unknown;
}

interface WebSocketConsoleModalProps {
  onClose: () => void;
}

export default function WebSocketConsoleModal({ onClose }: WebSocketConsoleModalProps) {
  const { socket, error } = useWebSocketContext();
  const { isConnected, connectionState, emit, on, reconnect } = useWebSocket();
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);

  /**
   * Add log entry
   */
  const addLog = useCallback((type: LogEntry['type'], message: string, event?: string, data?: unknown) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type,
      event,
      message,
      data,
    };
    
    setLogs(prev => [entry, ...prev].slice(0, 50)); // Keep last 50 logs
  }, []);

  /**
   * Test ping/pong latency
   */
  const testPing = useCallback(() => {
    if (!isConnected) {
      addLog('warning', 'Cannot ping: Not connected');
      return;
    }

    const startTime = Date.now();
    emit('system:ping', (_serverTime) => {
      const roundTripTime = Date.now() - startTime;
      setLatency(roundTripTime);
      addLog('success', `Ping successful: ${roundTripTime}ms`, 'system:ping');
    });
  }, [isConnected, emit, addLog]);

  /**
   * Test position update
   */
  const testPositionUpdate = useCallback(() => {
    if (!isConnected) {
      addLog('warning', 'Cannot update position: Not connected');
      return;
    }

    emit('game:update_position', { x: positionX, y: positionY });
    addLog('info', `Position update sent: (${positionX}, ${positionY})`, 'game:update_position');
  }, [isConnected, emit, positionX, positionY, addLog]);

  /**
   * Subscribe to events
   */
  useEffect(() => {
    if (!socket) return;

    const unsubscribers: (() => void)[] = [];

    // Game events
    unsubscribers.push(on('game:position_update', (data) => {
      addLog('event', `Position: (${data.x}, ${data.y})`, 'game:position_update', data);
    }));

    unsubscribers.push(on('game:level_up', (data) => {
      addLog('event', `Level up! New: ${data.newLevel}`, 'game:level_up', data);
    }));

    // Clan events
    unsubscribers.push(on('clan:war_declared', (data) => {
      addLog('event', `War: ${data.attackerClanName} vs ${data.defenderClanName}`, 'clan:war_declared', data);
    }));

    // Chat events
    unsubscribers.push(on('chat:message', (data) => {
      addLog('event', `${data.username}: ${data.content}`, 'chat:message', data);
    }));

    // Cleanup
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [socket, on, addLog]);

  /**
   * Log connection state changes
   */
  useEffect(() => {
    addLog('info', `Connection state: ${connectionState}`);
  }, [connectionState, addLog]);

  /**
   * Auto-ping every 10 seconds
   */
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(testPing, 10000);
    return () => clearInterval(interval);
  }, [isConnected, testPing]);

  // Connection status styling
  const statusColor = {
    connecting: 'text-[color:var(--nn-amber)]',
    connected: 'text-[color:var(--nn-green)]',
    disconnected: 'text-[color:var(--nn-text-secondary)]',
    error: 'text-[color:var(--nn-magenta)]',
  }[connectionState];

  const statusBg = {
    connecting: 'bg-[color-mix(in_oklab,var(--nn-amber)_12%,transparent)]',
    connected: 'bg-[color-mix(in_oklab,var(--nn-green)_12%,transparent)]',
    disconnected: 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_22%,transparent)]',
    error: 'bg-[color-mix(in_oklab,var(--nn-magenta)_12%,transparent)]',
  }[connectionState];

  return (
    <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4">
      <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">WebSocket Console</h2>
            <p className="text-[color:var(--nn-text-secondary)] text-sm mt-1">Test real-time connection and events</p>
          </div>
          <button
            onClick={onClose}
            className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Connection Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-none ${statusBg}`}>
              <div className="text-sm text-[color:var(--nn-text-secondary)] mb-1">Status</div>
              <div className={`text-xl font-bold ${statusColor}`}>
                {connectionState.toUpperCase()}
              </div>
            </div>

            <div className="p-4 rounded-none bg-[color-mix(in_oklab,var(--nn-cyan)_12%,transparent)]">
              <div className="text-sm text-[color:var(--nn-text-secondary)] mb-1">Latency</div>
              <div className="text-xl font-bold text-[color:var(--nn-cyan)]">
                {latency !== null ? `${latency}ms` : '—'}
              </div>
            </div>

            <div className="p-4 rounded-none bg-[color-mix(in_oklab,var(--nn-violet)_12%,transparent)]">
              <div className="text-sm text-[color:var(--nn-text-secondary)] mb-1">Socket ID</div>
              <div className="text-xl font-bold text-[color:var(--nn-violet)] truncate">
                {socket?.id || '—'}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-[color:var(--nn-void)] rounded-none p-4 space-y-4">
            <h3 className="text-lg font-semibold text-[color:var(--nn-cyan)]">Controls</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={testPing}
                disabled={!isConnected}
                className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-medium transition-colors"
              >
                📡 Test Ping
              </button>

              <button
                onClick={reconnect}
                disabled={isConnected}
                className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-medium transition-colors"
              >
                🔄 Reconnect
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[color:var(--nn-text-secondary)]">Test Position Update</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={positionX}
                  onChange={(e) => setPositionX(parseInt(e.target.value) || 0)}
                  placeholder="X"
                  className="flex-1 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
                />
                <input
                  type="number"
                  value={positionY}
                  onChange={(e) => setPositionY(parseInt(e.target.value) || 0)}
                  placeholder="Y"
                  className="flex-1 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none px-3 py-2 text-[color:var(--nn-text-primary)]"
                />
                <button
                  onClick={testPositionUpdate}
                  disabled={!isConnected}
                  className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-4 py-2 rounded-none font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div className="bg-[color:var(--nn-void)] rounded-none p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-[color:var(--nn-cyan)]">Event Log</h3>
              <button
                onClick={() => setLogs([])}
                className="text-sm text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center text-[color:var(--nn-text-secondary)] py-8">No events yet</div>
              ) : (
                logs.map(log => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-none text-sm ${
                      log.type === 'error' ? 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]' :
                      log.type === 'warning' ? 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]' :
                      log.type === 'success' ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]' :
                      log.type === 'event' ? 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]' :
                      'bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {log.event && (
                          <div className="text-xs font-mono text-[color:var(--nn-cyan)] mb-1">{log.event}</div>
                        )}
                        <div className="text-[color:var(--nn-text-primary)]">{log.message}</div>
                        {log.data !== undefined && log.data !== null && (
                          <pre className="text-xs text-[color:var(--nn-text-secondary)] mt-2 overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                      <div className="text-xs text-[color:var(--nn-text-secondary)] whitespace-nowrap">
                        {log.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color:var(--nn-void)] flex justify-between items-center">
          <div className="text-sm text-[color:var(--nn-text-secondary)]">
            {error && <span className="text-[color:var(--nn-magenta)]">Error: {error}</span>}
          </div>
          <button
            onClick={onClose}
            className="bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] px-6 py-2 rounded-none font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
