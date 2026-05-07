/**
 * Panel Component - Sci-Fi Glassmorphism Edition
 * 
 * Cyberpunk-themed glass panel with neon accents
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-SCI-FI (Sci-Fi Glassmorphism UI Redesign)
 * 
 * OVERVIEW:
 * Futuristic glass panel with frosted blur effects, neon borders,
 * and holographic styling. Perfect for sci-fi/cyberpunk interfaces.
 * 
 * @example
 * <Panel 
 *   title="Statistics" 
 *   icon={<BarChart />}
 *   neonColor="cyan"
 * >
 *   <div>Panel content here</div>
 * </Panel>
 */

'use client';

import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface PanelProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  neonColor?: 'cyan' | 'blue' | 'purple' | 'green';
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

const neonColors = {
  cyan: {
    border: 'border-[--electric]/20 hover:border-[--electric]/40',
    glow: 'shadow-glow-electric-sm',
    text: 'text-[--electric]',
  },
  blue: {
    border: 'border-[--electric]/20 hover:border-[--electric]/40',
    glow: 'shadow-glow-electric',
    text: 'text-[--electric]',
  },
  purple: {
    border: 'border-[--neon-pink]/20 hover:border-[--neon-pink]/40',
    glow: 'shadow-glow-pink-sm',
    text: 'text-[--neon-pink]',
  },
  green: {
    border: 'border-[--synth]/20 hover:border-[--synth]/40',
    glow: 'shadow-glow-synth-sm',
    text: 'text-[--synth]',
  },
};

export function Panel({
  title,
  subtitle,
  icon,
  action,
  footer,
  children,
  collapsible = false,
  defaultCollapsed = false,
  neonColor = 'cyan',
  className = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
}: PanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const colors = neonColors[neonColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`
        relative group
        bg-[--card]
        border ${colors.border}
        rounded-lg
        overflow-hidden
        transition-all duration-300
        ${className}
      `}
    >
      {/* Header */}
      {(title || icon || action) && (
        <div
          className={`
            relative z-10
            px-5 py-4
            border-b border-slate-700/50
            ${collapsible ? 'cursor-pointer hover:bg-slate-800/30 transition-colors' : ''}
            ${headerClassName}
          `}
          onClick={(e) => {
            // Only toggle if clicking the header itself, not nested elements
            if (collapsible && e.target === e.currentTarget) {
              setIsCollapsed(!isCollapsed);
            }
          }}
        >
          <div className="flex items-center justify-between" onClick={(e) => {
            // Allow clicking anywhere in the flex container to toggle (but not nested buttons)
            const target = e.target as HTMLElement;
            const isButton = target.tagName === 'BUTTON' || target.closest('button') !== null;
            const isLink = target.tagName === 'A' || target.closest('a') !== null;
            
            if (collapsible && !isButton && !isLink) {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }
          }}>
            <div className="flex items-center gap-3">
              {icon && (
                <div className={`${colors.text} ${colors.glow}`}>
                  {icon}
                </div>
              )}
              <div>
                {title && (
                  <h3 className={`
                    text-base font-semibold tracking-wide
                    bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent
                    font-display
                  `}>
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {action}
              {collapsible && (
                <motion.div
                  animate={{ rotate: isCollapsed ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-text-tertiary pointer-events-none"
                >
                  <ChevronDown className="w-5 h-5" />
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 overflow-hidden"
          >
            <div className={`p-5 ${bodyClassName}`}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      {footer && !isCollapsed && (
        <div className={`relative z-10 px-5 py-3 border-t border-slate-700/50 bg-slate-900/30 ${footerClassName}`}>
          {footer}
        </div>
      )}
    </motion.div>
  );
}

export default Panel;
