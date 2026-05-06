/**
 * Alert Component
 * 
 * Notification banner with variants
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Alert displays important messages with color-coded severity.
 * Supports icons, titles, descriptions, and dismissible state.
 * 
 * @example
 * <Alert variant="success" title="Success!">
 *   Your changes have been saved.
 * </Alert>
 */

'use client';

import { ReactNode, useState } from 'react';
import { X, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUp } from '@/lib/animations';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  icon?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  children: ReactNode;
}

const variantConfig = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    icon: <Info className="w-5 h-5" />,
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-400',
    icon: <CheckCircle className="w-5 h-5" />,
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    icon: <AlertCircle className="w-5 h-5" />,
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    icon: <XCircle className="w-5 h-5" />,
  },
};

export function Alert({
  variant = 'info',
  title,
  icon,
  dismissible = false,
  onDismiss,
  className = '',
  children,
}: AlertProps) {
  const [isVisible, setIsVisible] = useState(true);
  const config = variantConfig[variant];
  const displayIcon = icon !== undefined ? icon : config.icon;

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={slideUp}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`
            ${config.bg} ${config.border}
            border rounded-lg p-4
            ${className}
          `}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            {displayIcon && (
              <div className={`flex-shrink-0 ${config.text}`}>
                {displayIcon}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              {title && (
                <h4 className={`font-semibold mb-1 ${config.text}`}>
                  {title}
                </h4>
              )}
              <div className="text-sm text-text-secondary">
                {children}
              </div>
            </div>

            {/* Dismiss Button */}
            {dismissible && (
              <button
                onClick={handleDismiss}
                className={`
                  flex-shrink-0 ${config.text}
                  hover:opacity-70 transition-opacity
                `}
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - 4 variants: info, success, warning, error
// - Default icons per variant (customizable)
// - Optional title and dismissible state
// - Slide-up animation with AnimatePresence
// - Color-coded backgrounds and borders
// - Accessible with proper ARIA labels
// ============================================================
// END OF FILE
// ============================================================
