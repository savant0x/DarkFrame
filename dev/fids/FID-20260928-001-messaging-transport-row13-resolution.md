# FID-20260928-001: SCOPE row 13 asserted a migration that never happened — messaging is still Socket.io

**Filename:** `FID-20260928-001-messaging-transport-row13-resolution.md`
**ID:** FID-20260928-001
**Severity:** HIGH
**Status:** created
**Created:** 2026-09-28

---

## 1. Summary

SCOPE row 13 (dated 2026-09-01) records: *"messaging moved from Socket.io to Ably, consistent with the Postgres pivot."* The operator directed this record resolved against the code. Every measurable signal says the migration never happened: Socket.io is a declared dependency, imported by 20 live files across 9 directories, mounted by the production server, and connected to by the client; the word `ably` appears in **zero** packages, **zero** imports, and **zero** `process.env` reads; no Ably SDK has ever entered the dependency manifest at any commit. The resolution is not to hunt for hidden Ably code — there is none — but to correct the ledger record to state what is true, citing evidence, and to leave the genuinely open question where it belongs: whether the *removal* of the orphaned `ABLY_*` credentials is a product decision. FID-20260927-006 had already found row 13 contradicted the code and explicitly deferred the decision; this FID executes it.

## 2. Evidence (RED)

All findings re-executed 2026-09-28 against the working tree on `main`. Every command was run this session; output excerpts pasted.

| # | Finding | File:Line | Evidence (command + output excerpt) |
| - | ------- | --------- | ----------------------------------- |
| 1 | **The false claim**: row 13 records "messaging moved from Socket.io to Ably" as fact | `SCOPE.md:1061` | `grep -n "^| 13 |" SCOPE.md` → `| 13 | .env.local no longer contains MONGODB_URI; new vars: DATABASE_URL, ABLY_API_KEY, ABLY_SUBSCRIBE_KEY, REDIS_URL — messaging moved from Socket.io to Ably, consistent with the Postgres pivot; …` |
| 2 | **Socket.io is a first-class dependency** — both the server package and the browser client | `package.json:55-56` | `grep -n "socket" package.json` → `"socket.io": "^4.8.1",` / `"socket.io-client": "^4.8.1",` |
| 3 | **No Ably package has ever been declared** — not currently, not at any commit | `package.json` (all history) | manifest scan: the only transport packages matching `ably|socket|engine\.io|ws$` are `socket.io@^4.8.1`, `socket.io-client@^4.8.1`; `git log --all -S "ably" -- package.json package-lock.json` → **empty** (no commit ever added or removed the string) |
| 4 | **Zero `ably` imports in the tree** — live code, tests, scripts, config | repo-wide | `grep -rn -E "from ['\"](ably|ably/|@ably)\|require\(['\"](ably|@ably)" --include=*.ts --include=*.tsx --include=*.js --include=*.mjs --include=*.cjs .` (excluding `node_modules`, `.next`, `dev/archives`) → **exit 1, zero matches** |
| 5 | **No code reads the Ably credentials** — the env vars row 13 calls "new vars" are orphaned | repo-wide | `grep -rn -E "process\.env\.ABLY\|ABLY_API_KEY\|ABLY_SUBSCRIBE_KEY"` (same exclusions) → **exit 1, zero matches**. The vars exist in `.env.local` (key names verified, values never printed) and are consumed by nothing |
| 6 | **Socket.io is mounted by the production server entry point** | `server.ts:34` | `import { getSocketIOServer } from './lib/websocket/server';` — plus the banner at `server.ts:410`: `║  🔌 WebSocket: ws://${hostname}:${port}/api/socketio` |
| 7 | **The browser connects over Socket.io** | `context/WebSocketContext.tsx:32,147,149` | `import { io, Socket } from 'socket.io-client';` … `const newSocket = io(url, { … transports: ['websocket', 'polling'], … })` |
| 8 | **20 live files import `socket.io`/`socket.io-client` directly** across 9 directories | repo-wide | import-site census: `context/` 1 (`WebSocketContext`), `lib/` 1 (`veteranBroadcast`), `lib/websocket/` 6, `lib/websocket/handlers/` 4, `lib/websocket/__tests__/` 1, `lib/wmd/` 1 (`websocketIntegration.example.ts`), `scripts/` 4 (`e2eChatSocketLive.ts`, `e2eDmRealtimeLive.ts`, `e2ePlayerNotificationLive.ts`, `e2eVeteranBroadcastLive.ts`), `__tests__/api/` 1, `__tests__/lib/` 1 — total **20**. A wider import census (`@/lib/websocket`, `lib/websocket` references) reaches **33 files** |
| 9 | **The estate is functional, not vestigial**: dedicated handler modules, rooms, auth, broadcast, and live E2E scripts exercise it | `lib/websocket/` | the module carries `server.ts`, `auth.ts`, `broadcast.ts`, `rooms.ts`, `chatHandlers.ts`, `messagingHandlers.ts`, and `handlers/{clan,combat,game,wmd}Handler.ts`; the four `scripts/e2e*Live.ts` scripts drive real socket sessions end-to-end |
| 10 | **The row's supporting env claim is itself half-false**: `REDIS_URL` is genuinely consumed; the `ABLY_*` pair is not | `lib/redis.ts` vs repo-wide | `grep -rln "process.env.REDIS_URL" lib/ app/ server.ts` → `lib/redis.ts` (+ its test) — real consumer. `ABLY_*` → zero consumers (finding 5). Row 13 bundles a true claim and a false one into one sentence |
| 11 | **The row's cross-reference points at a file that no longer exists** — and per its own commit subject, *never* described a migration that happened | `SCOPE.md:1061`, git history | `find . -name "MONGODB_TO_MARIADB*"` → NOT FOUND; `git log --all --oneline -- "*MONGODB_TO_MARIADB*"` → `80518130` / `07e44ae7` *"docs: remove superseded MongoDB-to-MariaDB schema mapping (historical reference only)"* |
| 12 | **The false claim was introduced in a 851-file relocation checkpoint**, not in any messaging-focused change | git history | `git log --oneline -S "messaging moved from Socket.io to Ably" -- SCOPE.md` → single hit `ad14f790` *"checkpoint: WMD schema completion + lint burn-down + repo relocation to NTFS (session 2026-09-03)"* — the claim entered the ledger as a side effect of a bulk checkpoint, which is why no implementation commit backs it: **there is none** |
| 13 | **The only "ably" strings in live non-ledger files are hypotheticals in comments** | `lib/websocket/server.ts:296`, `types/stripe.types.ts:358` | `* - For Vercel/serverless: Consider alternative (Pusher, Ably)` — a future-consideration note inside the Socket.io server's own deployment comments; `* - Sustainable pricing supports server costs (MongoDB, Redis, Ably)` — a pricing rationale list. Neither is an import, a config read, or a migration record |
| 14 | **The tracking docs already recorded the contradiction and deferred the decision** — the deferral this FID executes | `dev/progress.md:44-46`, `dev/issues.md:105-107,119`, `SCOPE.md:139` | progress.md: *"No `ably` import exists anywhere in the tree, despite SCOPE row 13 recording that messaging had moved to Ably. Recorded here as an observation, not a decision."* issues.md lists *"Resolve the socket.io-vs-Ably record conflict noted above"* under outstanding debt |

**Call-graph notes (Law 4).** Runtime path for messaging: `server.ts:34` → `lib/websocket/server.ts` (Socket.io `Server` mounted at `/api/socketio`) → `chatHandlers`/`messagingHandlers`/`handlers/*` → `lib/chatSocketWiring.ts` and `lib/messagingBroadcast.ts` → client `context/WebSocketContext.tsx:147` (`io(url, { transports: ['websocket','polling'] })`) → consumers incl. `components/chat/ChatPanel.tsx` and `app/messages/page.tsx:111` (`const { emit, on, isConnected, connectionState, reconnect } = useWebSocket()`). Every hop is a real import reachable from the production entry point. There is no code path — live or dead — that reaches an Ably SDK, because no such module exists in the tree.

## 3. Impact Analysis

- **Who/what is affected:** the ledger's credibility as a record of truth (row 13 states a migration as fact); every future session that trusts row 13 (e.g. to plan removal of `lib/websocket/` would have "completed" an Ably migration that does not exist); the operator's understanding of the messaging estate; and — minor, out of scope here — two orphaned credentials in `.env.local`.
- **Failure modes if unfixed:** the ledger keeps a **Completed** row whose central clause is false; FID-20260927-006's deferral stands as an unresolved contradiction between two records; a future migration decision starts from a false baseline ("we already moved once") instead of the true one ("the transport has never changed").
- **Blast radius of the fix:** documentation only. No source file, dependency, env var, route, schema, or test changes in the resolution itself. Two living tracking docs get their open items retired; the lessons corpus gains one entry; row 13 is rewritten with its false clause marked false. The genuinely open question (credential removal, and any *future* managed-transport migration) is explicitly handed to the operator rather than silently absorbed.

## 4. Five Questions

| Question | Answer |
| -------- | ------ |
| Works for ALL cases, not just the common case? | **Yes.** The correction covers every clause of row 13's env sentence: the Mongo claim (true, already gated), the Redis claim (true, consumer cited), the Ably claim (false, proven at manifest/import/env-read level), and the mapping-doc cross-reference (dangling, corrected). Nothing is left half-rewritten. |
| Scales (design tolerates growth; harness reference is 1000 agents)? | **Yes.** The corrected row carries its evidence inline with exact counts and commands, so the next audit can re-run three greps instead of re-deriving the history. If a real Ably migration ever happens, the row's own text states what would constitute proof (a package, an import, a consumer), making the future change mechanically checkable. |
| Survives a hostile attacker, not just an honest user? | **Yes.** No runtime surface changes: no new endpoint, no auth change, no dependency change. The fix removes misinformation, which is attack surface in an evidence system, not in the game. The orphaned-credential question is surfaced as a risk (stale secrets in an env file) rather than buried. |
| Maintainable in 2 years? | **Yes.** The transport truth now lives in exactly one ledger row with citations, the tracking docs point at it, and the lesson generalizes (a bulk checkpoint is not a measurement). FID-20260927-006's deferral is consumed, so no dangling "awaiting operator decision" marker remains. |
| Sets the standard for the industry? | **Yes.** "A claim enters the ledger only with the probe that proved it" is the standard this repo's whole evidence layer already enforces elsewhere (Gates 3/7, Lessons 45-47); row 13 predated that discipline and is brought under it. |

## 5. Proposed Fix (GREEN)

Documentation-only. Correct the record; leave the transport untouched; hand the one real open question back to the operator explicitly.

- **Approach:** rewrite row 13's status cell to record what the probes prove (Socket.io live and mounted; Ably absent at every measurable layer), keep the row's *original* 2026-09-01 description visible as dated history rather than deleting it (the convention row 139 records for the tracking-doc refresh), retire the matching open items in `dev/progress.md` and `dev/issues.md`, and add Lesson 48 — the generalizable failure: a claim written inside a bulk checkpoint wore a measurement's clothes, and survived 25 days because nothing re-probed it.
- **Alternatives considered:**
  1. *Complete the migration to Ably* — rejected: no operator directive to migrate, and this FID's evidence shows the premise ("we already migrated") was never true. Starting a real migration from a corrected record is a separate, product-level decision with its own cost/benefit analysis.
  2. *Remove `lib/websocket/` and its 20 import sites as "superseded"* — rejected: it is the **live** transport; removing it would delete working chat/DM/WMD/veteran-broadcast realtime. This is the catastrophic misread the false row invites, which is precisely why it must be corrected.
  3. *Delete row 13 outright* — rejected: the row's core observation (no `MONGODB_URI` in `.env.local`) is true and mechanically enforced by Gate 3; the ledger preserves history and corrects in place rather than erasing.
  4. *Also delete the `ABLY_*` keys from `.env.local`* — rejected here: `.env.local` is outside the repository's tracked scope; credential hygiene is an operator action (the same disposition as the provider-side rotation item in `dev/issues.md`). Recorded as the open question this FID hands back.
- **Changes:**

| File | Action | Description |
| ---- | ------ | ----------- |
| `dev/fids/FID-20260928-001-messaging-transport-row13-resolution.md` | create | This document; runs the Perfection Loop to `loop-complete`, then closes under this session's standing implementation approval. |
| `SCOPE.md` (row 13) | modify | Status cell rewritten (see the closed row text in §7) with probes cited: packages (`socket.io@^4.8.1` + client, `package.json:55-56`), 20 direct import sites / 33 files in the wider census, `server.ts:34` mount, client connect at `WebSocketContext.tsx:147`, zero `ably` imports, zero `ABLY_*` consumers, no Ably package at any commit (`git log --all -S`), claim introduced by `ad14f790` (851-file checkpoint), dangling mapping-doc cross-reference. The Ably clause is marked **false**; the Mongo clause marked true (Gate 3); `REDIS_URL` marked true with its consumer. |
| `dev/progress.md` | modify | The two-sentence observation block at `:44-46` retires: the contradiction is resolved (row 13 corrected by this FID), so the text becomes a one-line closed note pointing at the row — superseded claims kept as dated history per this file's own convention. |
| `dev/issues.md` | modify | The "Messaging is still on socket.io" open item (`:105-107`) retires to strikethrough with the resolution one-liner; the outstanding-debt line *"Resolve the socket.io-vs-Ably record conflict"* (`:119`) is removed and replaced by the genuinely open residue: **operator decision — remove or rotate the orphaned `ABLY_API_KEY`/`ABLY_SUBSCRIBE_KEY` credentials in `.env.local` (untracked file; no repo work available)**. |
| `dev/lessons-learned.md` | modify | Add **Lesson 48** under the PROBE INTEGRITY section: *"A CLAIM WRITTEN INSIDE A BULK CHECKPOINT IS NOT A MEASUREMENT"* — a 851-file relocation commit carried a one-line migration claim into the ledger; nothing re-probed it for 25 days; the class survives because the claim's format (specific package names, plausible rationale) mimics evidence. Rule: any infra-migration claim must name the commit that performed it, or be recorded as unverified. |
| `dev/session-summaries/SESSION-2026-09-28-001.md` | create | The session record this FID's closure cites (census check D). |

- **Verification plan:** `npx tsc --noEmit` (0 errors — docs-only change must not move it); `npx eslint . --max-warnings 0` (0/0); `npx vitest run` (full suite green, count recorded); `node scripts/ledgerIntegrityCensus.cjs` (exit 0 — the rewritten row must keep 3-or-5-pipe shape and a parseable status); `git grep -ilE '\bably\b'` after the rewrite → only this FID, the row's dated-history text, CHANGELOG, and archives.
- **Call-graph reachability plan (Law 4, for the claim the row now makes):** the corrected row's "live" assertion is proven by `server.ts:34` (import from the production entry), `context/WebSocketContext.tsx:32` (client SDK import), and the 20-file direct-import census in §2 finding 8 — the same three citations the row text carries.

## 6. Audit Record

Double audit — two independent methods, evidence pasted, no self-reporting.

| Method | What was checked | Evidence (command + output) | Result |
| ------ | ---------------- | --------------------------- | ------ |
| Method 1: static analysis | Every §2 row re-executed this session; the import census run twice with two patterns (direct SDK imports, and the wider `lib/websocket` reference census) to bound the count from both sides; `git log -S` run over all branches for both `package.json` and the mapping doc | Per-finding commands and outputs in §2; counts: 20 direct / 33 wider / 9 directories; all three greps for Ably exit 1 | pass |
| Method 2: manual re-read against this FID | Row 13 read verbatim (`sed -n '1061p'`); the two live-comment "ably" mentions read in context (`lib/websocket/server.ts:294-298`, `types/stripe.types.ts:358`) to confirm neither is a migration record; tracking-doc deferral blocks read in full; lessons-corpus format read (Lesson 45-47 structure) before drafting 48; CHANGELOG/VERSION and summary conventions read from session 006's record | This document §2/§5 as written | pass (after one self-correct, below) |
| Method 3: operator directive | The resolution itself was operator-directed; the credential question is returned, not absorbed | Session directive quoted in §1 | pass |

- **SELF-CORRECT (AUDIT pass 1 → 2):** the first draft of the row-13 rewrite called the `ABLY_*` keys "removed from `.env.local`" — an action this FID has no authority to take and cannot verify (the file is untracked). Corrected to "orphaned; removal is an operator decision," and the open question is carried into `dev/issues.md`'s outstanding list rather than silently closed. This is the same absorb-vs-record boundary FID-20260927-006 drew; the audit caught the draft crossing it.
- **Honest limitations recorded:** (1) "no Ably package at any commit" is proven over `package.json`/`package-lock.json` with `-S "ably"`; a dependency present under a scoped alias with no "ably" substring is theoretically possible but would still be caught by findings 4-5 (imports and env reads), which are tree-wide; (2) `.env.local` is untracked, so the *values* of the `ABLY_*` keys were never read — key names only, printed via `grep -oE '^[A-Za-z_]+='`; (3) the two comment mentions (finding 13) are recorded as hypotheticals; if the operator ever wants a managed transport, those comments are where the thought already lives.
- **Audit outcome: PASS → status `loop-complete`** (the LOOP converged on the DOCUMENT; implementation below is recorded separately). Circuit breakers: 2 passes, delta < 2% after the self-correct; no oscillation; iteration 2 of 10.

## 7. Implementation Record

- **Status:** not-started
- **Files changed:**

| File | Lines | Notes |
| ---- | ----- | ----- |
| `SCOPE.md` | row 13 (`:1061`) | Status cell rewritten: Ably clause marked false with the probe citations from §2; Mongo clause affirmed via Gate 3; `REDIS_URL` affirmed with `lib/redis.ts` consumer; mapping-doc cross-reference marked dangling (removed by `80518130`/`07e44ae7`, itself labeled "historical reference only"); original 2026-09-01 wording preserved inline as dated history. |
| `dev/progress.md` | `:44-46` block | Observation retired to a closed one-liner citing this FID and the corrected row. |
| `dev/issues.md` | `:105-107` item, `:119` debt line | Open item struck through with resolution; the record-conflict debt line replaced by the orphaned-credential operator decision. |
| `dev/lessons-learned.md` | appended | Lesson 48 (bulk-checkpoint claims; the rule: migration claims must name the commit that performed them). |
| `dev/session-summaries/SESSION-2026-09-28-001.md` | new | Session record (census check D citation for this closure). |
| This FID | §7 | Status → done; evidence below. |

- **Verification evidence:** _(pending — this section is filled only after the edits exist and the gates have actually run; no output may be written here in advance)_.
- **Call-graph reachability evidence:** _(pending)_
- **Call-graph reachability evidence:** §2 findings 6-8 stand as the proof of the corrected row's central claim; no code changed.

## 8. Closure

- **Gates:** [ ] typecheck 0 errors · [ ] lint 0 errors/0 warnings · [ ] tests pass · [ ] call-graph proven (documentation-only change; the row's live-transport claim is citation-backed)
- **Commit hash (G2 — required for `closed`):** recorded in SCOPE row 13's closure cell and the session summary at close
- **Staging plan (path-scoped, G3/G4):** commit 1 (resolution content): `git add dev/fids/FID-20260928-001-messaging-transport-row13-resolution.md dev/progress.md dev/issues.md dev/lessons-learned.md dev/session-summaries/`; commit 2 (ledger closure): `git add SCOPE.md CHANGELOG.md VERSION dev/fids/` — never `git add -A`.
- **Commit message (G8):** `docs(ledger): resolve row 13 — messaging transport is Socket.io; the Ably migration never happened (FID-20260928-001)`
- **Archive:** move to `dev/fids/archive/` at `closed`; CHANGELOG entry; archival logged in the session summary. Never at `loop-complete`.

---

**Final status:** loop-complete
