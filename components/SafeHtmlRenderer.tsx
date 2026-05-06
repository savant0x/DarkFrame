/**
 * @file components/SafeHtmlRenderer.tsx
 * @created 2025-10-19
 * @overview Safe HTML rendering component for user-generated rich text content
 * 
 * OVERVIEW:
 * Renders user-generated HTML content safely using DOMPurify sanitization.
 * Used for displaying clan descriptions and base greetings with formatting.
 * 
 * SECURITY:
 * - All HTML is sanitized before rendering
 * - XSS protection via DOMPurify
 * - No scripts or dangerous elements can execute
 * 
 * Feature: FID-20251019-007 (Rich Text Editor Integration)
 */

'use client';

import React, { useMemo } from 'react';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

interface SafeHtmlRendererProps {
  html: string;
  className?: string;
  fallback?: string;
}

/**
 * Renders sanitized HTML content safely
 * @param html - Raw HTML from database
 * @param className - Additional CSS classes
 * @param fallback - Text to show if HTML is empty
 */
export const SafeHtmlRenderer: React.FC<SafeHtmlRendererProps> = ({
  html,
  className = '',
  fallback = 'No description available'
}) => {
  // Memoize sanitization to avoid re-processing on every render
  const sanitizedHtml = useMemo(() => {
    if (!html || html.trim() === '') {
      return '';
    }
    return sanitizeHtml(html);
  }, [html]);

  if (!sanitizedHtml) {
    return (
      <div className={`text-gray-400 italic ${className}`}>
        {fallback}
      </div>
    );
  }

  return (
    <div
      className={`prose prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - dangerouslySetInnerHTML is safe here because content is sanitized
// - Memoization prevents unnecessary re-sanitization
// - prose prose-invert for nice typography styling
// - Fallback text for empty content
// - Works with Tiptap HTML output
// ============================================================
// END OF FILE
// ============================================================
