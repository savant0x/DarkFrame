/**
 * @file lib/toastService.ts
 * @created 2025-10-17
 * @overview Toast notification service for user-facing messages
 * 
 * OVERVIEW:
 * Production-grade wrapper around react-hot-toast for consistent
 * user notification patterns. Replaces browser alert() calls with
 * non-blocking toast notifications.
 * 
 * Features:
 * - Success/error/info/warning toast variants
 * - Configurable duration and positioning
 * - Consistent styling across application
 * - No UI blocking (unlike alert())
 */

'use client';

import React from 'react';
import toast, { Toaster } from 'react-hot-toast';

/**
 * Toast configuration defaults
 */
const TOAST_CONFIG = {
  duration: 4000, // 4 seconds
  position: 'top-center' as const,
  style: {
    background: '#1F2937', // gray-800
    color: '#F3F4F6', // gray-100
    padding: '16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
};

/**
 * Show success toast notification
 * 
 * @param message - Success message to display
 * @param duration - Optional duration in ms (default: 4000)
 * 
 * @example
 * showSuccess('Successfully built 5x Steel Vanguard!');
 */
export function showSuccess(message: string, duration?: number): void {
  toast.success(message, {
    ...TOAST_CONFIG,
    duration: duration || TOAST_CONFIG.duration,
    style: {
      ...TOAST_CONFIG.style,
      borderLeft: '4px solid #10B981', // green-500
    },
  });
}

/**
 * Show error toast notification
 * 
 * @param message - Error message to display
 * @param duration - Optional duration in ms (default: 5000 for errors)
 * 
 * @example
 * showError('Insufficient metal (need 1,000, have 500)');
 */
export function showError(message: string, duration?: number): void {
  toast.error(message, {
    ...TOAST_CONFIG,
    duration: duration || 5000, // Longer for errors
    style: {
      ...TOAST_CONFIG.style,
      borderLeft: '4px solid #EF4444', // red-500
    },
  });
}

/**
 * Show info toast notification
 * 
 * @param message - Info message to display
 * @param duration - Optional duration in ms (default: 3000)
 * 
 * @example
 * showInfo('Factory upgraded to level 3!');
 */
export function showInfo(message: string, duration?: number): void {
  toast(message, {
    ...TOAST_CONFIG,
    duration: duration || 3000,
    icon: 'ℹ️',
    style: {
      ...TOAST_CONFIG.style,
      borderLeft: '4px solid #3B82F6', // blue-500
    },
  });
}

/**
 * Show warning toast notification
 * 
 * @param message - Warning message to display
 * @param duration - Optional duration in ms (default: 4000)
 * 
 * @example
 * showWarning('Harvest available in 2 minutes');
 */
export function showWarning(message: string, duration?: number): void {
  toast(message, {
    ...TOAST_CONFIG,
    duration: duration || 4000,
    icon: '⚠️',
    style: {
      ...TOAST_CONFIG.style,
      borderLeft: '4px solid #F59E0B', // amber-500
    },
  });
}

/**
 * Dismiss all active toasts
 * 
 * @example
 * dismissAll(); // Clear all notifications
 */
export function dismissAll(): void {
  toast.dismiss();
}

/**
 * Toast container component - add to root layout
 * 
 * @example
 * // In app/layout.tsx:
 * import { ToastContainer } from '@/lib/toastService';
 * 
 * export default function Layout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <ToastContainer />
 *       </body>
 *     </html>
 *   );
 * }
 */
export function ToastContainer() {
  return <Toaster position={TOAST_CONFIG.position} />;
}

// ============================================================
// END OF FILE
// Implementation Notes:
// - Uses react-hot-toast for consistent UX
// - Non-blocking notifications (no alert() blocking)
// - Themed to match game's dark UI
// - Error toasts last longer (5s vs 4s)
// - All toasts auto-dismiss (no manual close needed)
// - Position configurable via TOAST_CONFIG
// ============================================================
