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
import { JSDOM } from 'jsdom';

// Safe HTML tags allowed in user content
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'h1', 'h2', 'h3',
  'ul', 'ol', 'li',
  'blockquote',
  'span', 'div',
];

// Safe attributes allowed on elements
const ALLOWED_ATTR = [
  'style',
  'class',
  'data-*',
];

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  IN_PLACE: false,
};

function getServerSanitizer(): typeof DOMPurify.sanitize {
  const window = new JSDOM('').window;
  return DOMPurify(window).sanitize;
}

const serverSanitize = getServerSanitizer();

/**
 * Sanitizes HTML string to prevent XSS attacks
 * @param html - Raw HTML from rich text editor
 * @returns Sanitized HTML safe for rendering
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') {
    return serverSanitize(html, SANITIZE_OPTIONS);
  }

  return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
}

/**
 * Strips ALL HTML tags, returning plain text only
 * Useful for character counting or plain text display
 * @param html - HTML string
 * @returns Plain text without any HTML
 */
export function stripHtml(html: string): string {
  if (typeof window === 'undefined') {
    return serverSanitize(html, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
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
