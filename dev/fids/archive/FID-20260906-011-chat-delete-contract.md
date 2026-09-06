# FID-20260906-011: Chat Delete Dead-Wire — Client/Server Parameter Contract Mismatch

<!--
  ECHO Protocol v0.1.2 (single-agent) — FID.
  Saved per template rules; no attribution fields.
-->

**Filename:** `FID-20260906-011-chat-delete-contract.md`
**ID:** FID-20260906-011
**Severity:** HIGH (core chat feature: delete always 400s; confirm dialog never clears — the reported "hang")
**Status:** created → GREEN
**Created:** 2026-09-06

---

## 1. Summary

Clicking Delete on a chat message always fails: the client sends `messageId` in a DELETE **body**, the server reads it from **query params**. The 400 response's error field is also misread by the client, so the UI shows a generic error and never closes the confirm dialog.

## 2. RED — Evidence (file:line)

| # | Finding | Evidence |
|---|---------|----------|
| F1 | Client: `fetch('/api/chat/delete', { method:'DELETE', body: JSON.stringify({ messageId }) })` | `components/chat/ChatPanel.tsx:885-890` |
| F2 | Server: `const messageId = searchParams.get('messageId')` — body never read; 400 `'messageId is required'` | `app/api/chat/delete/route.ts:100-107` |
| F3 | Client error path reads `error.message`, but this route ships `{ success:false, error: string }` → generic fallback thrown | `ChatPanel.tsx:891-893` vs `route.ts:103` |
| F4 | On failure `setDeleteConfirmId(null)` never runs → confirm dialog stays open → the "hang" | `ChatPanel.tsx:894-914` |
| F5 | Server response contract on success is `{ success, message, messageId }` (not `data.*`) — client only checks `response.ok`, acceptable | `route.ts:140-146` |
| F6 | Error-shape drift is family-wide in ChatPanel handlers (`error.message \|\|` ×8 sites) against `{ error }`-shaped routes | grep evidence |

## 3. Root Cause

Route documents and implements query-param transport (its own JSDoc: `DELETE /api/chat/delete?messageId=msg_abc123`); client was written against an imagined body transport, and its error handler assumed a different error envelope. Nobody ever ran the flow.

## 4. Five Questions

1. **Broken?** Chat message delete — 100% of clicks.
2. **Since when?** Since the route's session-auth rework kept query-param transport while the client never matched it (original Mongo-era client code).
3. **Blast radius?** Chat delete (global + clan channels). No data risk — soft delete.
4. **Minimal correct fix?** Client sends query param (aligns with the documented route contract + REST semantics for DELETE); client error reads `error.error` with `message` fallback.
5. **Proof?** API probe (create → delete → verify filtered), then live UI drive: send a message, click Delete, assert removal + dialog closes.

## 5. GREEN — Design

- **R1 (`components/chat/ChatPanel.tsx`):** `fetch('/api/chat/delete?messageId=' + encodeURIComponent(messageId), { method:'DELETE' })`; error toast reads `error.error || error.message`. No body on DELETE.
- **R2:** same-shape twin check for `components/clan/ClanChatPanel.tsx:269` → `/api/clan/chat/delete` — verify its route's transport; align if same defect.
- **Non-goal (flagged):** batch-correcting all 8 `error.message ||` sites in ChatPanel to the `{ error }` envelope — deferred to the chat-system FID the user already queued; deleting is the broken flow fixed now.

## 6. Verification Plan

1. tsc 0 / eslint clean / suite pass.
2. API probe as a fresh session: POST message → DELETE with query param → 200 → GET shows filtered.
3. UI drive in preview: send chat message, click Delete, message disappears, no hang.
4. Loop record; archive; CHANGELOG; commit & push.

## 7. Loop Record

- **Pass 1:** route contract confirmed from its own JSDoc + implementation; clan twin route transport check added to R2 before code. Clan twin (`/api/clan/chat/delete`) uses BODY transport with a matching body-sending client — correct as-built, no change needed.
- **Pass 2 (verification):** API probe — DELETE with body (old client transport) → 400 `messageId is required` (reproduces the defect); DELETE with query param → 200 `Message deleted successfully`; second delete → 400 `Message is already deleted` (soft-delete guard intact). eslint 15→14 on ChatPanel (net -1), tsc 0.
- **Pass 3 (LIVE UI, user-verified):** operator clicked Delete on a live message in the running game → message removed, no hang. Feature verified repaired end-to-end.
- **Status: CONVERGED + IMPLEMENTED + LIVE-VERIFIED.**
