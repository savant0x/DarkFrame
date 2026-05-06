/**
 * LoadingSpinner Component
 * 
 * Animated loading indicator
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Customizable loading spinner with multiple variants and sizes.
 * Uses framer-motion for smooth animations.
 * 
 * @example
 * <LoadingSpinner size="lg" variant="pulse" />
 */

'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'base' | 'lg' | 'xl';
  variant?: 'spin' | 'pulse' | 'bounce' | 'dots';
  color?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  base: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export function LoadingSpinner({
  size = 'base',
  variant = 'spin',
  color = 'text-primary-500',
  className = '',
}: LoadingSpinnerProps) {
  if (variant === 'spin') {
    return (
      <motion.div
        className={`${sizeClasses[size]} ${color} ${className}`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-full h-full" />
      </motion.div>
    );
  }

  if (variant === 'pulse') {
    return (
      <motion.div
        className={`${sizeClasses[size]} ${color} rounded-full bg-current ${className}`}
        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    );
  }

  if (variant === 'bounce') {
    return (
      <motion.div
        className={`${sizeClasses[size]} ${color} rounded-full bg-current ${className}`}
        animate={{ y: [-10, 0, -10] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    );
  }

  if (variant === 'dots') {
    return (
      <div className={`flex gap-2 ${className}`}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`${
              size === 'sm' ? 'w-2 h-2' : size === 'base' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-5 h-5'
            } ${color} rounded-full bg-current`}
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}

// Full-page loading overlay
interface LoadingOverlayProps {
  message?: string;
  spinner?: React.ComponentProps<typeof LoadingSpinner>;
}

export function LoadingOverlay({
  message = 'Loading...',
  spinner = {},
}: LoadingOverlayProps) {
  return (
    <motion.div
      className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="xl" {...spinner} />
        {message && (
          <motion.p
            className="text-text-secondary text-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {message}
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - 4 spinner variants: spin, pulse, bounce, dots
// - 4 size options: sm, base, lg, xl
// - Customizable color via Tailwind classes
// - LoadingOverlay for full-page loading states
// - Smooth animations with framer-motion
// - Uses Loader2 icon from lucide-react for spin variant
// ============================================================
// END OF FILE
// ============================================================
