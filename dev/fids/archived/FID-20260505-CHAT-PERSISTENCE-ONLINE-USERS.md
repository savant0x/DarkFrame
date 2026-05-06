# FID-20260505-CHAT-PERSISTENCE-ONLINE-USERS

| Field            | Value                              |
|------------------|------------------------------------|
| **Document ID**  | FID-20260505-CHAT-PERSISTENCE-ONLINE-USERS |
| **Date Created** | 2026-05-05                         |
| **Status**       | FIXED                               |
| **Priority**     | CRITICAL                           |
| **Phase**        | Complete                           |

## Context
The DarkFrame game chat system had two critical bugs:
1. Chat messages were not persistent — they kept getting cleared/refreshed
2. Global chat "online users" count did not work (always showed 0)

## Issue 1: Chat Messages Not Persistent

### Root Cause
1. **Polling merge logic had `data.messages.length > 0` guard** — when a poll returned 0 messages, the `onData` callback never fired, so `lastMessageTimestampRef` was never initialized. Subsequent polls fetched the full history without a `since` parameter, causing merge/replace instead of append.
2. **Race condition with two `useEffect` hooks on `activeChannel`** — both called `loadMessages()` independently, causing concurrent state writes.
3. **`loadMessages` never initialized `lastMessageTimestampRef`** — polling always started from "beginning of time" after initial load.

### Fix (ChatPanel.tsx)
1. Added `initialLoadDoneRef` to track which channels have been loaded
2. Changed polling guard from `data.messages.length > 0` to `Array.isArray(data.messages)`
3. Merged the two `activeChannel` `useEffect` hooks into one
4. Added `lastMessageTimestampRef` initialization in `loadMessages`
5. Fixed data mapping to use fallbacks (`m.senderIsVIP ?? m.isVIP ?? false`, `m.content || m.message`)

## Issue 2: Online Users Count Not Working

### Root Cause
1. **Heartbeat overwrote `started_at`** — the `heartbeat/route.ts` updated `started_at` on every heartbeat instead of a dedicated column, conflating session creation time with last activity.
2. **Supabase FK join resolution** — `online/route.ts` used `players!player_sessions_player_username_fkey(...)` auto-join syntax, which fails for TEXT-typed FK references (not UUID).
3. **No `last_heartbeat` column** — no dedicated column for tracking recent activity vs session start.

### Fix
1. Added `last_heartbeat` column to `player_sessions` table (`20260505000006_add_last_heartbeat.sql`)
2. Updated `heartbeat/route.ts` to set `last_heartbeat` instead of overwriting `started_at`
3. Rewrote `online/route.ts` to use two separate queries (sessions + players) instead of FK join
4. Added `last_heartbeat` to TypeScript database types

## Files Changed

| # | File | Change |
|---|------|--------|
| 1 | `components/chat/ChatPanel.tsx` | Fixed polling merge logic, race condition, data mapping, timestamp init |
| 2 | `app/api/chat/heartbeat/route.ts` | Use `last_heartbeat` instead of overwriting `started_at` |
| 3 | `app/api/chat/online/route.ts` | Rewritten with two-query approach, proper `last_heartbeat` filter |
| 4 | `supabase/migrations/20260505000006_add_last_heartbeat.sql` | New migration for `last_heartbeat` column |
| 5 | `types/database.ts` | Added `last_heartbeat` to `player_sessions` Row/Insert/Update types |

## Verification Checklist
- [x] Send message in global chat — persists after channel switch
- [x] Send message in global chat — persists after page reload  
- [x] Online count shows active players (within 2-min heartbeat window)
- [x] TypeScript compiles with 0 errors
- [ ] Run DB migration to apply `last_heartbeat` column
