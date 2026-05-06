/**
 * @file utils/formatting.ts
 * @created 2025-10-23
 * @overview Common formatting utility functions
 * 
 * OVERVIEW:
 * Centralized formatting utilities to eliminate duplicate implementations
 * across the codebase. Provides consistent number, date, and text formatting.
 * 
 * Phase 2 Task 2.3: Deduplication of utility functions
 * - Eliminated 13+ duplicate formatNumber implementations
 * - Eliminated 4+ duplicate formatDate implementations
 * - Provides consistent formatting across entire application
 */

/**
 * Format number with thousand separators
 * 
 * @param num - Number to format
 * @returns Formatted string with commas (e.g., "1,234,567")
 * 
 * @example
 * ```typescript
 * formatNumber(1234567); // "1,234,567"
 * formatNumber(999); // "999"
 * formatNumber(0); // "0"
 * ```
 */
export function formatNumber(num: number): string {
  if (num === 0) return '0';
  if (!num) return '0';
  return num.toLocaleString();
}

/**
 * Format number with abbreviated units (K, M, B, T)
 * 
 * @param num - Number to format
 * @returns Abbreviated string (e.g., "1.2M", "543K")
 * 
 * @example
 * ```typescript
 * formatNumberAbbreviated(1234567); // "1.2M"
 * formatNumberAbbreviated(999); // "999"
 * formatNumberAbbreviated(5432); // "5.4K"
 * formatNumberAbbreviated(1500000000); // "1.5B"
 * ```
 */
export function formatNumberAbbreviated(num: number): string {
  if (num === 0) return '0';
  if (!num) return '0';
  
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (abs >= 1_000_000_000_000) {
    return sign + (abs / 1_000_000_000_000).toFixed(1) + 'T';
  }
  if (abs >= 1_000_000_000) {
    return sign + (abs / 1_000_000_000).toFixed(1) + 'B';
  }
  if (abs >= 1_000_000) {
    return sign + (abs / 1_000_000).toFixed(1) + 'M';
  }
  if (abs >= 1_000) {
    return sign + (abs / 1_000).toFixed(1) + 'K';
  }
  
  return num.toString();
}

/**
 * Format date/datetime string to human-readable format
 * 
 * @param date - Date object, ISO string, or timestamp
 * @param includeTime - Whether to include time (default: false)
 * @returns Formatted date string
 * 
 * @example
 * ```typescript
 * formatDate(new Date('2025-10-23T14:30:00')); // "Oct 23, 2025"
 * formatDate('2025-10-23T14:30:00', true); // "Oct 23, 2025 2:30 PM"
 * formatDate(1698075000000); // "Oct 23, 2023"
 * ```
 */
export function formatDate(date: Date | string | number, includeTime = false): string {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  if (includeTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
    options.hour12 = true;
  }
  
  return d.toLocaleDateString('en-US', options);
}

/**
 * Format datetime to full ISO-style readable format
 * 
 * @param isoString - ISO datetime string
 * @returns Formatted datetime string
 * 
 * @example
 * ```typescript
 * formatDateTime('2025-10-23T14:30:00'); // "Oct 23, 2025 2:30 PM"
 * ```
 */
export function formatDateTime(isoString: string): string {
  return formatDate(isoString, true);
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 * 
 * @param date - Date object, ISO string, or timestamp
 * @returns Relative time string
 * 
 * @example
 * ```typescript
 * formatRelativeTime(Date.now() - 3600000); // "1 hour ago"
 * formatRelativeTime(Date.now() + 7200000); // "in 2 hours"
 * ```
 */
export function formatRelativeTime(date: Date | string | number): string {
  if (!date) return 'N/A';
  
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.abs(Math.floor(diffMs / 1000));
  const isPast = diffMs < 0;
  
  if (diffSec < 60) {
    return isPast ? 'just now' : 'in a moment';
  }
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    const unit = diffMin === 1 ? 'minute' : 'minutes';
    return isPast ? `${diffMin} ${unit} ago` : `in ${diffMin} ${unit}`;
  }
  
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    const unit = diffHr === 1 ? 'hour' : 'hours';
    return isPast ? `${diffHr} ${unit} ago` : `in ${diffHr} ${unit}`;
  }
  
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) {
    const unit = diffDay === 1 ? 'day' : 'days';
    return isPast ? `${diffDay} ${unit} ago` : `in ${diffDay} ${unit}`;
  }
  
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) {
    const unit = diffWeek === 1 ? 'week' : 'weeks';
    return isPast ? `${diffWeek} ${unit} ago` : `in ${diffWeek} ${unit}`;
  }
  
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    const unit = diffMonth === 1 ? 'month' : 'months';
    return isPast ? `${diffMonth} ${unit} ago` : `in ${diffMonth} ${unit}`;
  }
  
  const diffYear = Math.floor(diffDay / 365);
  const unit = diffYear === 1 ? 'year' : 'years';
  return isPast ? `${diffYear} ${unit} ago` : `in ${diffYear} ${unit}`;
}

/**
 * Format duration in seconds to human-readable string
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 * 
 * @example
 * ```typescript
 * formatDuration(3661); // "1h 1m 1s"
 * formatDuration(90); // "1m 30s"
 * formatDuration(45); // "45s"
 * ```
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '0s';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

/**
 * Format percentage with optional decimal places
 * 
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 * 
 * @example
 * ```typescript
 * formatPercentage(45.678); // "45.7%"
 * formatPercentage(45.678, 2); // "45.68%"
 * formatPercentage(100); // "100.0%"
 * ```
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Capitalize first letter of string
 * 
 * @param str - String to capitalize
 * @returns Capitalized string
 * 
 * @example
 * ```typescript
 * capitalize('hello world'); // "Hello world"
 * capitalize('HELLO'); // "HELLO"
 * ```
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to title case
 * 
 * @param str - String to convert
 * @returns Title cased string
 * 
 * @example
 * ```typescript
 * titleCase('hello world'); // "Hello World"
 * titleCase('HELLO WORLD'); // "Hello World"
 * ```
 */
export function titleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
//
// Deduplication Summary:
// - formatNumber: 13 duplicate implementations eliminated
// - formatDate: 4 duplicate implementations eliminated
// - Additional utilities added for completeness
//
// Migration Strategy:
// 1. Import from '@/utils/formatting' or '@/utils'
// 2. Replace local implementations with centralized versions
// 3. Remove duplicate function declarations
//
// Future Enhancements:
// - Add currency formatting (formatCurrency)
// - Add file size formatting (formatFileSize)
// - Add distance formatting for game coordinates
//
// ============================================================================
