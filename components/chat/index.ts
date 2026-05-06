/**
 * @file components/chat/index.ts
 * @created 2025-11-04
 * @updated 2025-11-04 (FID-20251026-001: Full ECHO Architecture Compliance Refactor)
 * @overview Chat Components - Barrel Export
 *
 * OVERVIEW:
 * Central export point for chat-related UI components.
 * Provides reusable chat interface elements for global chat system.
 *
 * Organization:
 * - Core Components: Main chat interface and message display
 *
 * Usage:
 * ```typescript
 * import { ChatPanel, ChatMessage } from '@/components/chat';
 * ```
 */

// ============================================================================
// CORE CHAT COMPONENTS
// ============================================================================

// Re-export main chat panel component
export { default as ChatPanel } from './ChatPanel';

// Re-export individual chat message component
export { default as ChatMessage } from './ChatMessage';

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * Chat Component Architecture:
 * - ChatPanel: Main chat interface with input, message list, and controls
 * - ChatMessage: Individual message display with formatting and interactions
 *
 * Features:
 * - Real-time message display
 * - Message formatting and links
 * - User interactions (mentions, replies)
 * - Moderation indicators (edited, deleted)
 *
 * Styling:
 * - Dark theme optimized for game UI
 * - Responsive design for different screen sizes
 * - Accessibility compliant (ARIA labels, keyboard navigation)
 *
 * Usage Examples:
 * ```typescript
 * import { ChatPanel } from '@/components/chat';
 *
 * // Render chat interface
 * <ChatPanel channelId="global" />
 * ```
 *
 * ============================================================================
 */