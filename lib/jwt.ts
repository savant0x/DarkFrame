/**
 * @file lib/jwt.ts
 * @overview Shared JWT secret — the single source of truth for every sign/verify site
 * (authService, middleware, session route, WebSocket auth). Each previously carried its
 * own fallback literal; a mismatch silently 401s tokens minted by another site.
 *
 * NOTE: Edge-compatible. This module is imported by middleware.ts (Edge runtime), so it
 * must not pull in Node-only APIs.
 */

export const JWT_SECRET = process.env.JWT_SECRET || 'darkframe-secret-change-in-production';

/** Pre-encoded secret for `jose` (jwtVerify/SignJWT) — Edge-safe. */
export const JOSE_SECRET = new TextEncoder().encode(JWT_SECRET);
