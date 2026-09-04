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

/**
 * Single source of truth for the session cookie name (FID-20260904-005 §5.0).
 * Previously redeclared as literals in lib/authService, lib/authMiddleware,
 * lib/websocket/auth, and lib/wmd/apiHelpers — a divergence-prone seam that
 * produced the phantom-cookie auth failures recorded in that FID.
 */
export const SESSION_COOKIE_NAME = 'darkframe_session';

/** Pre-encoded secret for `jose` (jwtVerify/SignJWT) — Edge-safe. */
export const JOSE_SECRET = new TextEncoder().encode(JWT_SECRET);
