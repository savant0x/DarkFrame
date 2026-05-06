# FID-20260504-SUPABASE-CLEANUP: Remaining `as any` & Corrupted Files

| Field            | Value                              |
|------------------|------------------------------------|
| **Document ID**  | FID-20260504-SUPABASE-CLEANUP      |
| **Date Created** | 2026-05-04                         |
| **Status**   | CLOSED                               |
| **Priority**     | CRITICAL                            |
| **Parent FID**   | FID-20260503-SUPABASE              |

## Context
Phase 3-7 of the MongoDB→Supabase migration eliminated 200+ `as any` instances and rewrote 50+ files. 6 files remain with 28 TypeScript errors and ~11 residual `as any`. 1 file was corrupted by a task agent.

## Remaining Work

### Priority 1: Fix 28 TypeScript Errors
| File | Errors | Issue |
|---|---|---|
| `lib/wmd/jobs/spyMissionCompleter.ts` | 20 | Corrupted — needs full rewrite |
| `app/api/bounty-board/route.ts` | 4 | Service API mismatch |
| `lib/battleTrackingService.ts` | 1 | Missing `TablesInsert` import |
| `lib/botSummoningService.ts` | 1 | Missing `TablesInsert` import |
| `lib/clanWarfareService.ts` | 1 | Missing `ClanWarRecord` type |
| `lib/wmd/jobs/voteExpirationCleaner.ts` | 1 | Missing `VoteResult` type |

### Priority 2: Eliminate Residual `as any`
| File | Count | Pattern |
|---|---|---|
| `lib/researchPointService.ts` | 6 | `(supabase as any)` for table queries |
| `lib/messagingService.ts` | 2 | Insert type cast |
| `lib/mapGeneration.ts` | 2 | Batch insert + rpc |
| `lib/subscriptionService.ts` | 2 | Update + insert |
| `lib/websocket/handlers/chatHandler.ts` | 2 | User property access |
| `lib/broadcast.ts` | 5 | Socket.io emit (documented limitation) |
| `lib/auctionService.ts` | 1 | ResourceType cast |
| `lib/clanVotingService.ts` | 1 | Dynamic update field |

### Priority 3: Broadcast Socket.io Limitation
`lib/broadcast.ts` — 5 `payload as any` on `io.to().emit()`. This is a Socket.io type wrapper limitation. Document as known constraint with conversion function.

## Fix Plan
1. Rewrite `spyMissionCompleter.ts` from scratch
2. Fix bounty-board route API mismatch
3. Add missing imports and types
4. Rewrite `researchPointService.ts` for Supabase
5. Clean remaining `as any` with proper patterns
6. Document Socket.io broadcast limitation
7. Verify 0 TypeScript errors

## Verification Checklist
- [ ] `npx tsc --noEmit` passes (0 errors)
- [ ] 0 `as any` in production code (lib/, app/, types/)
- [ ] All files compile with proper types
- [ ] Spy mission completer logic restored
- [ ] PUSH GATE: Commit locally only
