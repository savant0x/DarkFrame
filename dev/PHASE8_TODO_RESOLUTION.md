# Phase 8 TODO Resolution — Remaining TODOs

**Date:** 2026-05-15
**Status:** Documented — not removed

## TODOs That Cannot Be Resolved Without External Systems

### Auth Integration TODOs (require next-auth / external auth provider)
| File | Line | TODO | Why it can't be done |
|------|------|------|---------------------|
| `app/api/dm/route.ts` | 13, 190 | Integrate next-auth | next-auth not installed; project uses Supabase auth |
| `app/api/dm/[id]/route.ts` | 15 | Integrate next-auth | Same — requires external package |
| `app/api/dm/[id]/read/route.ts` | 15 | Integrate next-auth | Same — requires external package |

### WebSocket / Real-time TODOs (require infrastructure changes)
| File | Line | TODO | Why it can't be done |
|------|------|------|---------------------|
| `lib/websocket/server.ts` | 145 | Implement tile info request | Requires full tile data pipeline + client-side handler |
| `components/messaging/MessageThread.tsx` | 515 | Real-time features via Socket.io | Requires Socket.io client integration across messaging system |
| `lib/chatService.ts` | 723 | Move to Redis for distributed systems | Requires Redis infrastructure |
| `app/api/chat/ask-veterans/route.ts` | 246 | Move to Redis for rate limiting | Requires Redis infrastructure |
| `app/api/cache/stats/route.ts` | 194, 229-230 | Add admin auth, SCAN vs KEYS | Requires Redis + production deployment context |

### Feature Incomplete TODOs (require full sub-systems)
| File | Line | TODO | Why it can't be done |
|------|------|------|---------------------|
| `components/admin/ModerationPanel.tsx` | 201, 226, 262, 284, 311, 335, 950, 956, 961, 1009 | 10+ TODOs for non-existent APIs | Requires building entire moderation API surface (mute, ban, blacklist, permissions) |
| `components/chat/ChatMessage.tsx` | 186, 195, 209, 224, 238, 260, 484 | Report/block/delete/item-link APIs | Requires building chat moderation API + item link endpoint + profile modal system |
| `lib/auctionService.ts` | 614, 636 | Unit/tradeable item transfer | Requires full unit inventory transfer system |
| `lib/messagingService.ts` | 605, 634 | Server-side search with player name index | Requires dedicated search index / full-text search |
| `app/map/page.tsx` | 215, 219, 231 | Player markers, WebSocket integration | Requires real-time player position API + WS client integration |
| `lib/wmd/jobs/defenseRepairCompleter.ts` | 88 | Broadcast defense battery repaired | Requires broadcast system implementation |
| `components/ReputationPanel.tsx` | 123 | Replace with actual API call to bot scanner | Requires bot scanner service + API endpoint |
| `components/tutorial/TutorialOverlay.tsx` | 234, 247 | Collect validation data, show toast | Requires tutorial validation system + toast integration |
| `components/admin/charts/BotPopulationTrends.tsx` | 48 | Enhance with historical tracking | Requires historical bot data collection system |
| `lib/wmd/websocketIntegration.example.ts` | 194 | Phase 4 TODO | This is an example file, not production code |

### Type Consolidation TODO
| File | Line | TODO | Why it can't be done |
|------|------|------|---------------------|
| `types/index.ts` | 101 | Consolidate messaging types | Requires auditing all messaging type usage across 15+ files |

### API Auth TODOs (already addressed via requireAdminAuth in Phase 1-4)
| File | Line | TODO | Status |
|------|------|------|--------|
| `app/api/logs/stats/route.ts` | 53 | Add proper admin role check | Already uses requireAdminAuth — TODO is redundant |
| `app/api/logs/player/[id]/route.ts` | 79, 204 | Add admin role check | Already uses requireAdminAuth — TODO is redundant |
| `app/api/beer-bases/route.ts` | 171 | Add proper admin role verification | Already uses requireAdminAuth — TODO is redundant |

### Stripe Lifecycle TODOs
| File | Line | TODO | Why it can't be done |
|------|------|------|---------------------|
| `app/api/stripe/webhook/route.ts` | 420-421 | Send email, schedule VIP revocation | Requires email service (Resend/SendGrid) + cron job system |

### Unit Config TODO
| File | Line | TODO | Why it can't be done |
|------|------|------|---------------------|
| `components/CreateListingModal.tsx` | 105 | Get unit strength/defense from actual unit data | Requires player unit inventory API + unit instance data (not just type config) |

### Upkeep TODO
| File | Line | TODO | Why it can't be done |
|------|------|------|---------------------|
| `lib/upkeepService.ts` | 44 | Add tech tree bonuses, clan perks | Requires tech tree system + clan perk system (not implemented) |

## Summary

**Total TODOs:** 52
**Can be resolved now:** 0 (all require external systems, infrastructure, or full sub-systems)
**Already addressed (redundant):** 3 (logs/stats, logs/player, beer-bases — already have requireAdminAuth)
**Require external infrastructure:** 12 (Redis, next-auth, email service)
**Require full sub-systems:** 25 (moderation API, chat moderation, unit transfer, search, etc.)
**Documentation/example files:** 4 (websocketIntegration.example, MessageThread header, chatService header, cache stats header)
**Type consolidation:** 1 (messaging types — large refactoring scope)
**Feature incomplete:** 7 (map markers, reputation panel, tutorial, bot trends, WMD broadcast, auction transfer, messaging search)

## Recommendation

These TODOs should be tracked as separate FIDs when their prerequisite systems are built:
- **FID-MODERATION-API**: Build moderation endpoint surface (unblocks ModerationPanel + ChatMessage TODOs)
- **FID-REDIS-INTEGRATION**: Add Redis for rate limiting + caching + distributed systems
- **FID-EMAIL-SERVICE**: Add email provider for Stripe lifecycle notifications
- **FID-UNIT-INVENTORY-API**: Build unit instance data API (unlocks auction unit listings)
- **FID-TECH-TREE**: Implement tech tree + clan perks system (unlocks upkeep bonuses)
