/**
 * @file lib/sanitizeHtml.server.ts
 * @server-only — Server-side HTML sanitization using jsdom + DOMPurify
 */
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'span', 'div'],
  ALLOWED_ATTR: ['style', 'class', 'data-*'],
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  IN_PLACE: false,
};

let cachedSanitize: typeof DOMPurify.sanitize | null = null;

function getSanitizer(): typeof DOMPurify.sanitize {
  if (!cachedSanitize) {
    const window = new JSDOM('').window;
    cachedSanitize = DOMPurify(window).sanitize;
  }
  return cachedSanitize;
}

export async function sanitizeHtmlServer(html: string): Promise<string> {
  return String(getSanitizer()(html, SANITIZE_OPTIONS));
}

export async function stripHtmlServer(html: string): Promise<string> {
  return String(getSanitizer()(html, { ALLOWED_TAGS: [], KEEP_CONTENT: true } as never));
}
