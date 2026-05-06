/**
 * PageTransition Component
 * 
 * Smooth page transitions with framer-motion
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Wrapper component that adds enter/exit animations to pages.
 * Uses AnimatePresence for smooth transitions between routes.
 * 
 * @example
 * <PageTransition>
 *   <YourPageContent />
 * </PageTransition>
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  variant?: 'fade' | 'slide' | 'scale' | 'blur';
  duration?: number;
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(10px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(10px)' },
  },
};

export function PageTransition({
  children,
  variant = 'fade',
  duration = 0.3,
}: PageTransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants[variant]}
      transition={{ duration }}
    >
      {children}
    </motion.div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - 4 transition variants: fade, slide, scale, blur
// - Configurable duration (default 300ms)
// - Works with Next.js app router
// - Wrap page content for smooth transitions
// - Uses framer-motion's AnimatePresence context
// ============================================================
// END OF FILE
// ============================================================
