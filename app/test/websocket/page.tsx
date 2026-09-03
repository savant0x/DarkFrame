/**
 * WebSocket Test Page
 * Created: 2025-10-19
 * 
 * OVERVIEW:
 * Testing interface for WebSocket connection and real-time events.
 * Displays connection status, allows manual event emission, and shows
 * received events in real-time. Used for verifying WebSocket infrastructure.
 * 
 * Access at: /test/websocket
 */

'use client';

import { useState, useEffect } from 'react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function WebSocketTestPage() {
  const { socket, isConnected, error } = useWebSocketContext();
  const { emit, on } = useWebSocket();
  
  const [events, setEvents] = useState<Array<{ time: string; event: string; data: any }>>([]);
  const [message, setMessage] = useState('');

  const addEvent = (event: string, data: any) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [{ time: timestamp, event, data }, ...prev].slice(0, 20)); // Keep last 20
  };

  // Subscribe to all major events for testing
  useEffect(() => {
    if (!on) return;

    on('game:position_update', (data) => {
      addEvent('game:position_update', data);
    });

    on('game:resource_change', (data) => {
      addEvent('game:resource_change', data);
    });

    on('game:level_up', (data) => {
      addEvent('game:level_up', data);
    });

    on('chat:message', (data) => {
      addEvent('chat:message', data);
    });

    on('combat:attack_started', (data) => {
      addEvent('combat:attack_started', data);
    });

    on('clan:war_declared', (data) => {
      addEvent('clan:war_declared', data);
    });
  }, [on]);

  const sendTestMessage = () => {
    if (!message.trim() || !emit) return;
    
    emit('chat:send_message', {
      content: message.trim(),
      channelId: 'global'
    });

    setMessage('');
    addEvent('chat:send_message (outgoing)', { message });
  };

  const clearEvents = () => {
    setEvents([]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">WebSocket Test Console</h1>

        {/* Connection Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="font-medium">Status:</span>
              {isConnected ? (
                <span className="flex items-center gap-2 text-green-400">
                  <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-2 text-red-400">
                  <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                  Disconnected
                </span>
              )}
            </div>

            {socket && (
              <div className="flex items-center gap-3">
                <span className="font-medium">Socket ID:</span>
                <code className="bg-gray-700 px-2 py-1 rounded text-sm">{socket.id || 'N/A'}</code>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 text-red-400">
                <span className="font-medium">Error:</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="font-medium">Transport:</span>
              <code className="bg-gray-700 px-2 py-1 rounded text-sm">
                {socket?.io.engine?.transport?.name || 'N/A'}
              </code>
            </div>
          </div>
        </div>

        {/* Test Actions */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendTestMessage()}
                placeholder="Type a chat message..."
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                disabled={!isConnected}
              />
              <button
                onClick={sendTestMessage}
                disabled={!isConnected || !message.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded font-medium transition-colors"
              >
                Send Chat
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => emit && emit('game:request_tile_info', { x: 50, y: 50 })}
                disabled={!isConnected || !emit}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded font-medium transition-colors"
              >
                Request Tile Info (50,50)
              </button>
              
              <button
                onClick={clearEvents}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-medium transition-colors"
              >
                Clear Events
              </button>
            </div>
          </div>
        </div>

        {/* Event Log */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Event Log</h2>
            <span className="text-sm text-gray-400">{events.length} events (last 20)</span>
          </div>

          {events.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No events received yet. Try sending a message or triggering game actions.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map((event, index) => (
                <div key={index} className="bg-gray-700 rounded p-3 text-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-blue-400">{event.event}</span>
                    <span className="text-gray-400 text-xs">{event.time}</span>
                  </div>
                  <pre className="text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-sm">
          <h3 className="font-semibold mb-2">Testing Instructions:</h3>
          <ul className="space-y-1 text-gray-300">
            <li>• Connection should establish automatically on page load</li>
            <li>• Try sending a chat message to test client → server communication</li>
            <li>• Perform actions in the game (move, harvest, attack) to see server → client events</li>
            <li>• Check browser console for detailed WebSocket logs</li>
            <li>• Open multiple browser tabs to test multi-client scenarios</li>
          </ul>
        </div>

        <div className="mt-4 text-center">
          <a href="/game" className="text-blue-400 hover:text-blue-300 underline">
            ← Back to Game
          </a>
        </div>
      </div>
    </div>
  );
}
