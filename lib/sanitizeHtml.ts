/**
 * @file lib/sanitizeHtml.ts
 * @overview HTML sanitization utility for user-generated rich text content
 * 
 * Client-side only — uses DOMPurify directly.
 * For server-side sanitization, use lib/sanitizeHtml.server.ts
 */

import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'h1', 'h2', 'h3',
  'ul', 'ol', 'li',
  'blockquote',
  'span', 'div',
];

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

/**
 * Sanitizes HTML string to prevent XSS attacks (client-side only)
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
}

/**
 * Strips ALL HTML tags, returning plain text only (client-side only)
 */
export function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
}

/**
 * Validates HTML doesn't exceed character limit (plain text)
 */
export function validateHtmlLength(html: string, maxLength: number): boolean {
  const plainText = stripHtml(html);
  return plainText.length <= maxLength;
}
