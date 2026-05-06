/**
 * Input Component
 * 
 * Form input with label and error state
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Input component for forms with label, error message,
 * and various input types support.
 * 
 * @example
 * <Input
 *   label="Username"
 *   value={username}
 *   onChange={(e) => setUsername(e.target.value)}
 *   error="Username is required"
 * />
 */

'use client';

import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const hasError = !!error;

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {/* Label */}
        {label && (
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Left Icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
              {leftIcon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            className={`
              w-full px-4 py-2.5 
              bg-bg-tertiary border rounded-lg
              text-text-primary placeholder-text-tertiary
              transition-all duration-200
              focus:outline-none focus:ring-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${hasError
                ? 'border-red-500 focus:ring-red-500/20'
                : 'border-border-main focus:border-primary-500 focus:ring-primary-500/20'
              }
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />

          {/* Right Icon */}
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary">
              {rightIcon}
            </div>
          )}
        </div>

        {/* Error or Helper Text */}
        {(error || helperText) && (
          <p
            className={`
              text-sm mt-1.5
              ${hasError ? 'text-red-500' : 'text-text-tertiary'}
            `}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Supports all input HTML attributes
// - Label with required indicator
// - Error and helper text display
// - Left and right icon support
// - Focus ring with brand color
// - Disabled state styling
// - ForwardRef for form libraries
// ============================================================
// END OF FILE
// ============================================================
