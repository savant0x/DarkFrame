/**
 * @file lib/apiClient.ts
 * @created 2026-09-11
 * @overview FID-20260911-041 — one client for game API calls that NEVER swallows
 * a server rejection reason.
 *
 * THE PROBLEM THIS SOLVES: the codebase had 183 `await response.json()` call
 * sites and three failure classes that hid the server's rejection reason:
 *  1. `catch { /* nothing *\/ }` or `catch (e) { console.error(e) }` — the body
 *     was never read at all (ShrinePanel, harvest/attack handlers on the game page).
 *  2. `result.error || 'Unknown error'` — but the error system ships
 *     `{ success: false, error: { code, message, details } }` (lib/errors/responses.ts),
 *     so `result.error` is an OBJECT and the template string rendered
 *     "[object Object]" or fell through to the generic fallback.
 *  3. `data.message || 'Activation failed'` — `message` only exists on SUCCESS
 *     payloads; error bodies carry the reason under `error.message`, so every
 *     structured rejection surfaced as the generic string.
 *
 * `apiFetch` resolves ALL of it: parses the body, treats non-2xx as a failure,
 * extracts the human reason from every shape in use (nested error.message, flat
 * message, details.errors[].message from Zod), and hands callers a discriminated
 * result. Callers decide whether to toast (most do — see `apiFetchOrToast`).
 */

import { showError } from '@/lib/toastService';

/** The structured error body produced by lib/errors/responses.ts. */
interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: {
    errors?: Array<{ message?: string; field?: string }>;
    message?: string;
  } | null;
}

/** Every error shape any route has ever emitted (plus plain text failures). */
interface AnyApiBody {
  success?: boolean;
  message?: string;
  error?: string | ApiErrorBody;
  data?: unknown;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  /** HTTP status (0 for network failure). */
  status: number;
  /** The typed payload on success (best-effort: body.data ?? body). */
  data?: T;
  /** Human-readable server rejection reason — NEVER swallowed. */
  error?: string;
  /** Machine code when the server provided one (VALIDATION_FAILED, 409 reasons…). */
  code?: string;
}

/**
 * Extract the human-readable rejection reason from any body shape in use.
 * Exported for tests and for call sites that parse bodies themselves.
 */
export function extractApiError(body: unknown, status: number): string {
  if (body == null) {
    return status >= 400 ? `Request failed (${status})` : 'Network error — no response';
  }
  if (typeof body === 'string') {
    return body.slice(0, 200) || `Request failed (${status})`;
  }
  const b = body as AnyApiBody;
  // Shape 1 — the structured system: { success: false, error: { code, message, details } }
  if (b.error && typeof b.error === 'object') {
    const e = b.error as ApiErrorBody;
    const zod = e.details?.errors?.[0]?.message;
    if (zod) return zod;
    if (e.details?.message) return e.details.message;
    if (e.message) return e.message;
    if (e.code) return e.code.replace(/_/g, ' ').toLowerCase();
  }
  // Shape 2 — legacy flat string error: { success: false, error: "reason" }
  if (typeof b.error === 'string' && b.error) return b.error;
  // Shape 3 — success payloads can still carry a soft-fail message the caller
  // treats as an error (message used as the reason on success:false routes).
  if (b.success === false && b.message) return b.message;
  // Shape 4 — flat { message } on a non-2xx (proxy/HTML gateway bodies excluded above)
  if (b.message) return b.message;
  return `Request failed (${status || 'network'})`;
}

/**
 * Fetch a game API endpoint and resolve a discriminated result.
 * Non-2xx is NOT thrown — callers branch on `ok` and read `error`.
 * Network failures resolve `ok: false, status: 0` with a readable reason.
 */
export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    const { json, ...rest } = init ?? {};
    response = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    return { ok: false, status: 0, error: 'Network error — is the server running?' };
  }

  let body: unknown = null;
  const text = await response.text().catch(() => '');
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text; // HTML gateway error pages etc.
    }
  }

  if (!response.ok) {
    return { ok: false, status: response.status, error: extractApiError(body, response.status) };
  }

  const b = (body ?? {}) as AnyApiBody & { data?: T };
  // Success body convention is { success: true, data } — but plenty of routes
  // return the payload flat. Best-effort unwrap; success:false on 2xx is a
  // soft failure and carries its reason.
  if (b.success === false) {
    return { ok: false, status: response.status, error: extractApiError(body, response.status) };
  }
  return { ok: true, status: response.status, data: (b.data ?? body) as T };
}

/**
 * `apiFetch` + automatic error toast. Use in user-initiated handlers where a
 * rejection must be visible in-game — the server's reason is the toast text.
 * Returns the result so success paths keep flowing.
 */
export async function apiFetchOrToast<T = unknown>(
  url: string,
  init?: RequestInit & { json?: unknown },
  fallback = 'Action failed',
): Promise<ApiResult<T>> {
  const result = await apiFetch<T>(url, init);
  if (!result.ok) {
    showError(result.error ?? fallback);
  }
  return result;
}
