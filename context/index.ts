/**
 * @file context/index.ts
 * @created 2025-10-26
 * @updated 2025-10-26 (FID-20251026-001: Full ECHO Architecture Compliance)
 * @overview React Context Providers - Barrel Export
 * 
 * OVERVIEW:
 * Central export point for all React Context providers including GameContext,
 * WebSocketContext, and ChatPanelContext.
 * 
 * Usage:
 * ```typescript
 * import { GameProvider, useGame, useWebSocket } from '@/context';
 * ```
 */

// ============================================================================
// CONTEXT PROVIDERS
// ============================================================================

// Game state management (player, resources, map)
export { GameProvider, useGameContext } from './GameContext';

// WebSocket connection management (real-time updates)
export { WebSocketProvider, useWebSocketContext } from './WebSocketContext';

// Chat panel state management (panel size state)
export { ChatPanelProvider, useChatPanelSize } from './ChatPanelContext';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * Context Provider Usage:
 * 
 * Wrap your application with providers in app/layout.tsx:
 * ```typescript
 * import { GameProvider, WebSocketProvider, ChatPanelProvider } from '@/context';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <GameProvider>
 *           <WebSocketProvider>
 *             <ChatPanelProvider>
 *               {children}
 *             </ChatPanelProvider>
 *           </WebSocketProvider>
 *         </GameProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 * 
 * Using Context Hooks:
 * ```typescript
 * import { useGame, useWebSocket, useChatPanel } from '@/context';
 * 
 * function MyComponent() {
 *   const { player, updatePlayer } = useGame();
 *   const { connected, sendMessage } = useWebSocket();
 *   const { isOpen, toggleChat } = useChatPanel();
 *   
 *   // Component logic
 * }
 * ```
 * 
 * Context Hierarchy:
 * 1. GameProvider (outermost - provides game state)
 * 2. WebSocketProvider (requires game context for player ID)
 * 3. ChatPanelProvider (innermost - simple UI state)
 * 
 * Performance:
 * - Context providers should use React.memo for optimization
 * - Avoid unnecessary re-renders by splitting contexts by concern
 * - Use context selectors or custom hooks for fine-grained subscriptions
 */

// ============================================================================
// END OF FILE
// ============================================================================
