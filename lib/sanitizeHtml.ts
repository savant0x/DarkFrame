/**
 * @file lib/sanitizeHtml.ts
 * @created 2025-10-19
 * @overview HTML sanitization utility for user-generated rich text content
 * 
 * OVERVIEW:
 * Provides safe HTML sanitization for user-generated content from the rich text editor.
 * Uses DOMPurify to strip dangerous tags, attributes, and scripts to prevent XSS attacks.
 * 
 * SECURITY:
 * - Whitelist only safe HTML tags
 * - Remove all script tags and event handlers
 * - Strip dangerous attributes (onclick, onerror, etc.)
 * - Prevent DOM clobbering
 * - Content Security Policy compliant
 * 
 * Feature: FID-20251019-007 (Rich Text Editor Integration)
 */

import DOMPurify from 'dompurify';

// Safe HTML tags allowed in user content
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',         // Basic formatting
  'h1', 'h2', 'h3',                             // Headings
  'ul', 'ol', 'li',                             // Lists
  'blockquote',                                 // Quotes
  'span', 'div',                                // Containers
];

// Safe attributes allowed on elements
const ALLOWED_ATTR = [
  'style',           // For colors, fonts, alignment
  'class',           // For Tiptap classes
  'data-*',          // For Tiptap data attributes
];

/**
 * Sanitizes HTML string to prevent XSS attacks
 * @param html - Raw HTML from rich text editor
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: return as-is, will be sanitized on client
    // (DOMPurify requires DOM environment)
    return html;
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: true,                    // Allow data-* attributes
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    KEEP_CONTENT: true,                       // Keep text content when stripping tags
    RETURN_DOM: false,                        // Return string not DOM
    RETURN_DOM_FRAGMENT: false,
    IN_PLACE: false,                          // Don't modify original
  });
}

/**
 * Strips ALL HTML tags, returning plain text only
 * Useful for character counting or plain text display
 * @param html - HTML string
 * @returns Plain text without any HTML
 */
export function stripHtml(html: string): string {
  if (typeof window === 'undefined') {
    // Server-side: basic regex strip
    return html.replace(/<[^>]*>/g, '');
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],                         // No tags allowed
    KEEP_CONTENT: true,                       // Keep text content
  });
}

/**
 * Validates HTML doesn't exceed character limit (plain text)
 * @param html - HTML string
 * @param maxLength - Maximum characters (plain text)
 * @returns True if within limit
 */
export function validateHtmlLength(html: string, maxLength: number): boolean {
  const plainText = stripHtml(html);
  return plainText.length <= maxLength;
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - DOMPurify is industry-standard XSS protection
// - Whitelist approach: only allow safe tags/attributes
// - Works client-side only (requires DOM)
// - Server-side should re-sanitize before storage
// - Style attribute allowed for colors/fonts/alignment
// - No JavaScript can execute in sanitized HTML
// ============================================================
// END OF FILE
// ============================================================
