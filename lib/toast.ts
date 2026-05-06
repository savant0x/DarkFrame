/**
 * Toast Utilities
 * 
 * Themed toast notifications using Sonner
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Wrapper around Sonner toast library with design system integration.
 * Provides consistent themed notifications for success, error, info, and warning.
 * 
 * @example
 * import { toast } from '@/lib/toast';
 * 
 * toast.success('Resources collected!');
 * toast.error('Battle lost!');
 * toast.info('New achievement unlocked');
 * toast.warning('Low resources');
 */

import { toast as sonnerToast, ExternalToast } from 'sonner';

// Design system colors for toasts
const toastStyles = {
  success: {
    style: {
      background: 'rgb(21, 128, 61)', // green-700
      border: '1px solid rgb(34, 197, 94)', // green-500
      color: 'rgb(240, 253, 244)', // green-50
    },
  },
  error: {
    style: {
      background: 'rgb(153, 27, 27)', // red-800
      border: '1px solid rgb(239, 68, 68)', // red-500
      color: 'rgb(254, 242, 242)', // red-50
    },
  },
  warning: {
    style: {
      background: 'rgb(161, 98, 7)', // yellow-800
      border: '1px solid rgb(234, 179, 8)', // yellow-500
      color: 'rgb(254, 252, 232)', // yellow-50
    },
  },
  info: {
    style: {
      background: 'rgb(30, 64, 175)', // blue-800
      border: '1px solid rgb(59, 130, 246)', // blue-500
      color: 'rgb(239, 246, 255)', // blue-50
    },
  },
  loading: {
    style: {
      background: 'rgb(88, 28, 135)', // purple-800
      border: '1px solid rgb(168, 85, 247)', // purple-500
      color: 'rgb(250, 245, 255)', // purple-50
    },
  },
};

/**
 * Show success toast
 */
function success(message: string, data?: ExternalToast) {
  return sonnerToast.success(message, {
    ...toastStyles.success,
    ...data,
  });
}

/**
 * Show error toast
 */
function error(message: string, data?: ExternalToast) {
  return sonnerToast.error(message, {
    ...toastStyles.error,
    ...data,
  });
}

/**
 * Show warning toast
 */
function warning(message: string, data?: ExternalToast) {
  return sonnerToast.warning(message, {
    ...toastStyles.warning,
    ...data,
  });
}

/**
 * Show info toast
 */
function info(message: string, data?: ExternalToast) {
  return sonnerToast.info(message, {
    ...toastStyles.info,
    ...data,
  });
}

/**
 * Show loading toast (returns ID to dismiss later)
 */
function loading(message: string, data?: ExternalToast) {
  return sonnerToast.loading(message, {
    ...toastStyles.loading,
    ...data,
  });
}

/**
 * Show custom toast with message
 */
function custom(message: string, data?: ExternalToast) {
  return sonnerToast(message, data);
}

/**
 * Promise toast - shows loading, then success/error based on promise result
 */
function promise<T>(
  promise: Promise<T>,
  {
    loading: loadingMsg,
    success: successMsg,
    error: errorMsg,
  }: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: any) => string);
  }
) {
  return sonnerToast.promise(promise, {
    loading: loadingMsg,
    success: successMsg,
    error: errorMsg,
    style: toastStyles.loading.style,
  });
}

/**
 * Dismiss a toast by ID
 */
function dismiss(toastId?: string | number) {
  return sonnerToast.dismiss(toastId);
}

/**
 * Dismiss all toasts
 */
function dismissAll() {
  return sonnerToast.dismiss();
}

// Export toast utilities
export const toast = {
  success,
  error,
  warning,
  info,
  loading,
  custom,
  promise,
  dismiss,
  dismissAll,
};

// ============================================================
// USAGE EXAMPLES:
// ============================================================
// 
// // Success notification
// toast.success('Battle won! +1000 XP');
// 
// // Error notification
// toast.error('Not enough resources');
// 
// // Warning notification
// toast.warning('Factory under attack!');
// 
// // Info notification
// toast.info('New territory discovered');
// 
// // Loading toast
// const id = toast.loading('Processing transaction...');
// // Later dismiss it
// toast.dismiss(id);
// 
// // Promise toast (auto handles loading/success/error)
// toast.promise(
//   fetch('/api/battle').then(r => r.json()),
//   {
//     loading: 'Calculating battle...',
//     success: (data) => `Victory! +${data.xp} XP`,
//     error: 'Battle failed',
//   }
// );
// 
// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Uses Sonner toast library (already installed)
// - Colors match design system (green/red/yellow/blue/purple)
// - Default duration: 4000ms (set in layout.tsx)
// - Position: top-right (configurable in layout.tsx)
// - Supports rich colors, expand, and icons
// - Promise toast auto-transitions loading → success/error
// ============================================================
// END OF FILE
// ============================================================
