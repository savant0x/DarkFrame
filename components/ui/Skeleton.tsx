/**
 * Skeleton Component
 * 
 * Loading placeholder with shimmer animation
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-044 (UI/UX Dashboard Redesign)
 * 
 * OVERVIEW:
 * Skeleton component creates loading placeholders that match
 * the shape of content being loaded. Includes shimmer animation.
 * 
 * @example
 * <Skeleton variant="text" width="200px" />
 * <Skeleton variant="circular" width="40px" height="40px" />
 * <Skeleton variant="rectangular" width="100%" height="100px" />
 */

'use client';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
}

const variantClasses = {
  text: 'h-4 rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-md',
};

export function Skeleton({
  variant = 'text',
  width = '100%',
  height,
  className = '',
}: SkeletonProps) {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: height
      ? typeof height === 'number'
        ? `${height}px`
        : height
      : variant === 'text'
      ? '1rem'
      : '100%',
  };

  return (
    <div
      className={`
        bg-bg-tertiary animate-pulse
        ${variantClasses[variant]}
        ${className}
      `}
      style={style}
    />
  );
}

/**
 * SkeletonGroup - Multiple skeleton lines
 */
interface SkeletonGroupProps {
  lines?: number;
  spacing?: 'sm' | 'base' | 'lg';
  className?: string;
}

const spacingClasses = {
  sm: 'gap-2',
  base: 'gap-3',
  lg: 'gap-4',
};

export function SkeletonGroup({
  lines = 3,
  spacing = 'base',
  className = '',
}: SkeletonGroupProps) {
  return (
    <div className={`flex flex-col ${spacingClasses[spacing]} ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - 3 variants: text, circular, rectangular
// - Customizable width and height
// - Built-in pulse animation
// - SkeletonGroup for multiple lines
// - Matches content shape while loading
// ============================================================
// END OF FILE
// ============================================================
