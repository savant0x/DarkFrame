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
  data?: any;
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
  const addLog = useCallback((type: LogEntry['type'], message: string, event?: string, data?: any) => {
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
    emit('system:ping', (serverTime) => {
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
    connecting: 'text-yellow-400',
    connected: 'text-green-400',
    disconnected: 'text-gray-400',
    error: 'text-red-400',
  }[connectionState];

  const statusBg = {
    connecting: 'bg-yellow-400/20',
    connected: 'bg-green-400/20',
    disconnected: 'bg-gray-400/20',
    error: 'bg-red-400/20',
  }[connectionState];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">WebSocket Console</h2>
            <p className="text-gray-400 text-sm mt-1">Test real-time connection and events</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Connection Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg ${statusBg}`}>
              <div className="text-sm text-gray-400 mb-1">Status</div>
              <div className={`text-xl font-bold ${statusColor}`}>
                {connectionState.toUpperCase()}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-400/20">
              <div className="text-sm text-gray-400 mb-1">Latency</div>
              <div className="text-xl font-bold text-blue-400">
                {latency !== null ? `${latency}ms` : '—'}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-purple-400/20">
              <div className="text-sm text-gray-400 mb-1">Socket ID</div>
              <div className="text-xl font-bold text-purple-400 truncate">
                {socket?.id || '—'}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-900 rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-semibold text-cyan-300">Controls</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={testPing}
                disabled={!isConnected}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                📡 Test Ping
              </button>

              <button
                onClick={reconnect}
                disabled={isConnected}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                🔄 Reconnect
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Test Position Update</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={positionX}
                  onChange={(e) => setPositionX(parseInt(e.target.value) || 0)}
                  placeholder="X"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                />
                <input
                  type="number"
                  value={positionY}
                  onChange={(e) => setPositionY(parseInt(e.target.value) || 0)}
                  placeholder="Y"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                />
                <button
                  onClick={testPositionUpdate}
                  disabled={!isConnected}
                  className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-cyan-300">Event Log</h3>
              <button
                onClick={() => setLogs([])}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No events yet</div>
              ) : (
                logs.map(log => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg text-sm ${
                      log.type === 'error' ? 'bg-red-500/20 border border-red-500/50' :
                      log.type === 'warning' ? 'bg-yellow-500/20 border border-yellow-500/50' :
                      log.type === 'success' ? 'bg-green-500/20 border border-green-500/50' :
                      log.type === 'event' ? 'bg-blue-500/20 border border-blue-500/50' :
                      'bg-gray-800 border border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {log.event && (
                          <div className="text-xs font-mono text-cyan-400 mb-1">{log.event}</div>
                        )}
                        <div className="text-white">{log.message}</div>
                        {log.data && (
                          <pre className="text-xs text-gray-400 mt-2 overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
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
        <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            {error && <span className="text-red-400">Error: {error}</span>}
          </div>
          <button
            onClick={onClose}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
