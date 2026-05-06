/**
 * hooks/useKeyboardShortcut.ts
 * Created: 2025-10-25
 * 
 * OVERVIEW:
 * Custom hook for registering keyboard shortcuts that automatically
 * disables itself when user is typing in input fields or textareas.
 * Prevents movement hotkeys from triggering while filling out forms.
 * 
 * Usage:
 * useKeyboardShortcut('k', () => setShowPanel(true));
 * useKeyboardShortcut('Escape', () => setShowPanel(false), { allowInInput: true });
 */

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutOptions {
  /**
   * Allow the shortcut to trigger even when typing in inputs
   * Useful for shortcuts like Escape that should work everywhere
   */
  allowInInput?: boolean;
  
  /**
   * Require modifier keys (shift, ctrl, alt, meta)
   */
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  
  /**
   * Prevent default browser behavior
   */
  preventDefault?: boolean;
}

/**
 * Check if user is currently typing in an input element
 * @returns true if focus is in an input/textarea/contenteditable
 */
export function isTypingInInput(): boolean {
  const activeElement = document.activeElement;
  
  // Check if active element is an input or textarea
  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement
  ) {
    return true;
  }
  
  // Check for contenteditable elements
  if (activeElement && (activeElement as HTMLElement).isContentEditable) {
    return true;
  }
  
  // Check tagName as fallback
  const tagName = activeElement?.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
    return true;
  }
  
  // Check if inside any input/textarea/contenteditable
  const target = activeElement as HTMLElement;
  if (
    target?.closest('input') !== null ||
    target?.closest('textarea') !== null ||
    target?.closest('[contenteditable="true"]') !== null
  ) {
    return true;
  }
  
  return false;
}

/**
 * Register a keyboard shortcut with automatic input detection
 * 
 * @param key - The key to listen for (e.g., 'k', 'Escape', 'Enter')
 * @param callback - Function to call when key is pressed
 * @param options - Configuration options
 * 
 * @example
 * // Simple shortcut
 * useKeyboardShortcut('b', () => togglePanel());
 * 
 * @example
 * // Escape key that works even in inputs
 * useKeyboardShortcut('Escape', () => closePanel(), { allowInInput: true });
 * 
 * @example
 * // Shift+F shortcut
 * useKeyboardShortcut('f', () => toggleAutoFarm(), { shiftKey: true });
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: KeyboardShortcutOptions = {}
) {
  const {
    allowInInput = false,
    shiftKey = false,
    ctrlKey = false,
    altKey = false,
    metaKey = false,
    preventDefault = false
  } = options;

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Check if we should ignore this event because user is typing
    if (!allowInInput && isTypingInInput()) {
      return;
    }

    // Check if the key matches (case-insensitive)
    if (event.key.toLowerCase() !== key.toLowerCase()) {
      return;
    }

    // Check modifier keys
    if (shiftKey && !event.shiftKey) return;
    if (ctrlKey && !event.ctrlKey) return;
    if (altKey && !event.altKey) return;
    if (metaKey && !event.metaKey) return;

    // Prevent default if requested
    if (preventDefault) {
      event.preventDefault();
    }

    // Execute callback
    callback();
  }, [key, callback, allowInInput, shiftKey, ctrlKey, altKey, metaKey, preventDefault]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);
}

/**
 * IMPLEMENTATION NOTES:
 * - Automatically prevents shortcuts from triggering when typing in forms
 * - Supports modifier keys (Shift, Ctrl, Alt, Meta)
 * - Special keys like Escape can optionally work even in inputs
 * - Case-insensitive key matching for user convenience
 * - Proper cleanup on component unmount
 * 
 * FUTURE CONSIDERATIONS:
 * - Add support for key combinations (e.g., 'Ctrl+K')
 * - Add global shortcut registry for displaying help menu
 * - Add conflict detection for overlapping shortcuts
 * - Consider adding shortcut priority system
 */
