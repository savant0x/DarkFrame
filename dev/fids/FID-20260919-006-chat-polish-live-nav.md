# FID-20260919-006 — Chat polish: live profile nav; the "two tiny gaps" were one gap and a corpse

**Status:** `created`
**Session:** 2026-09-19 (060)
**Origin:** Operator directive after FID-20260919-005: "knock out the two tiny chat
polish gaps — wire ChatPanel's onProfileClick to /profile/[username] and make
ChatMessage's item click navigate to the auction house." Both cited premises
failed grounding; the honest scope is below.

## 1. Ground-truth corrections (Law 16)

1. **ChatMessage.tsx is dead code.** Zero importers — the survey's
   `onProfileClick`/`handleItemClick` TODOs (ChatMessage:267/:304) live in a
   component rendered by nothing. The live message renderer is ChatPanel's own
   inline nn-msg block. Same defect class as the FID-003 archive, missed by that
   census because ChatMessage looked "live" behind the chat barrel re-export —
   and the barrel itself (`components/chat/index.ts`) is imported by nothing.
2. **The item-click gap doesn't exist as described.** No live path renders
   `[ItemName]` chat links at all — link parsing, the `/api/chat/item-link`
   fetch, and the validation cache lived only in the dead component. There is
   no click to wire; the *feature* (chat item linking) is the actual gap.
3. **"Navigate to the auction house" has no destination pre-wired.** The auction
   house is a game-page modal (`showAuctionHouse`), not a route, and
   `AuctionHousePanel` has no name-search state (seller/price/type filters only)
   — so "click item → filtered market view" is a feature build (panel search
   state + game-page deep-link), not polish. Recorded, not built under this FID.

## 2. Scope (implemented)

- **Live profile nav**: ChatPanel's inline message header username becomes a
  real `<button>` → `router.push('/profile/<username>')` (page exists and is
  live-verified). Own-username clicks navigate like any other — the profile
  page is the canonical self-view too.
- **Corpse annex**: ChatMessage.tsx (655 lines) + chat/index.ts moved to
  `dev/archives/2026-09-19-dead-ui/` with README annex + manifest refresh
  (census re-probed fresh before the move).

## 3. Out of scope (recorded product calls, not silently dropped)

- **Chat item linking (feature)**: restore `[ItemName]` parsing + validation in
  the *live* renderer, and give AuctionHousePanel a name-search + game-page
  deep-link so a click can land somewhere useful. Needs a small FID of its own.
- AuctionHousePanel name-search/deep-link as a standalone convenience.

## 4. Acceptance

- Clicking a message sender's username in any channel navigates to
  `/profile/<username>` (client-router navigation, no page reload).
- ChatMessage + chat barrel: zero live references; census pinned in the archive
  README; tsc/eslint/suite green.
