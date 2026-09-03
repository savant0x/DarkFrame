# DarkFrame - Technical Decisions

> Important architectural and technical decisions with rationale

---

## 📋 Decision Log

### [DEC-001] Use Lowercase Project Name "darkframe"
**Date:** 2025-10-16  
**Context:** npm naming restrictions prohibit capital letters in package names  
**Decision:** Use "darkframe" instead of "DarkFrame" for directory and package name  
**Rationale:** Compliance with npm standards, avoid build/deployment issues  
**Alternatives Considered:** None (npm requirement)  
**Status:** ✅ Implemented

---

### [DEC-002] React 18.3.1 vs React 19
**Date:** 2025-10-16  
**Context:** Next.js 15.0.2 has peer dependency conflict with React 19  
**Decision:** Use React 18.3.1 for compatibility  
**Rationale:** Ensure stable Next.js operation, avoid potential breaking changes  
**Alternatives Considered:** React 19 with --force flag (risky)  
**Status:** ✅ Implemented

---

### [DEC-003] Tailwind CSS for Styling
**Date:** 2025-10-16  
**Context:** Need styling solution for UI components  
**Decision:** Use Tailwind CSS 3.4.1  
**Rationale:** Utility-first approach, fast development, excellent Next.js integration, user reference shows similar UI patterns  
**Alternatives Considered:** CSS Modules only, Styled Components  
**Status:** ✅ Implemented

---

### [DEC-004] Single-Tile View vs Full Grid Render
**Date:** 2025-10-16  
**Context:** User provided reference screenshot showing single-tile focused view  
**Decision:** Render only current tile with navigation controls (not entire 150×150 grid)  
**Rationale:**  
- Better performance (load 1 tile vs 22,500)
- Matches user's reference UI
- Enables fog-of-war/discovery mechanics later
- Clearer visual focus for gameplay  
**Alternatives Considered:** Full grid minimap (rejected for Phase 1)  
**Status:** ✅ Implemented in design

---

### [DEC-005] MongoDB Atlas vs Local MongoDB
**Date:** 2025-10-16  
**Context:** Need database solution for persistent game state  
**Decision:** Use MongoDB Atlas (cloud-hosted)  
**Rationale:** User specified in requirements, no local setup required, production-ready  
**Alternatives Considered:** None (user requirement)  
**Status:** ✅ Implemented in configuration

---

### [DEC-006] 9-Direction Movement (QWEASDZXC)
**Date:** 2025-10-16  
**Context:** User specified keyboard layout for movement  
**Decision:** Implement QWEASDZXC keyboard mapping with center 'S' as refresh  
**Rationale:**  
- User requirement
- Ergonomic keyboard layout
- 8 directions + refresh action  
**Mapping:**
```
Q W E    [NW] [N]  [NE]
A S D =  [W]  [⟳]  [E]
Z X C    [SW] [S]  [SE]
```
**Alternatives Considered:** Arrow keys, WASD (rejected per user spec)  
**Status:** ✅ Implemented in design

---

### [DEC-007] Edge Wrap-Around (150→1)
**Date:** 2025-10-16  
**Context:** How to handle map boundaries at 150×150 grid  
**Decision:** Implement wrap-around on all edges (moving beyond 150 wraps to 1)  
**Rationale:** User requirement, creates seamless exploration experience  
**Implementation:** Modulo arithmetic for coordinate calculation  
**Alternatives Considered:** Hard boundaries (rejected per user spec)  
**Status:** ✅ Implemented in design

---

### [DEC-008] Image-Based Tiles (Not 3D)
**Date:** 2025-10-16  
**Context:** User reference screenshot appeared to show 3D rendering  
**Decision:** Use 2D image assets provided by user, not 3D rendering  
**Rationale:**  
- User clarified: "tile based, FLAT game"
- User will provide custom terrain images
- Simpler implementation
- Better performance  
**Alternatives Considered:** Three.js 3D rendering (rejected per user spec)  
**Status:** ✅ Implemented in design

---

### [DEC-009] No Mini-Map in Phase 1
**Date:** 2025-10-16  
**Context:** Should we include overview/mini-map?  
**Decision:** No mini-map, single-tile view only  
**Rationale:** User specified "players must discover the map" and "single tile view only"  
**Future Consideration:** Fog-of-war discovery system in later phase  
**Alternatives Considered:** Mini-map with fog (deferred to Phase 2+)  
**Status:** ✅ Implemented in design

---

### [DEC-010] React Context vs External State Library
**Date:** 2025-10-16  
**Context:** Need state management solution for game state  
**Decision:** Use React Context API (built-in)  
**Rationale:**  
- Sufficient for Phase 1 scope
- No external dependencies
- Simple implementation
- Can migrate to Redux/Zustand later if needed  
**Alternatives Considered:** Redux, Zustand, Jotai (unnecessary for Phase 1)  
**Status:** ✅ Implemented in design

---

### [DEC-011] Idempotent Map Generation
**Date:** 2025-10-16  
**Context:** How to ensure map doesn't regenerate on every restart  
**Decision:** Check for existing tiles before generation, skip if map exists  
**Rationale:**  
- User requirement: "static and consistent across restarts"
- Prevent data loss
- Safe initialization  
**Implementation:** Count tiles in DB, only generate if count === 0  
**Alternatives Considered:** Flag-based approach (more complex)  
**Status:** ✅ Implemented in design

---

### [DEC-012] Exact Terrain Distribution
**Date:** 2025-10-16  
**Context:** User specified exact tile counts per terrain type  
**Decision:** Use Fisher-Yates shuffle with pre-allocated array matching exact counts  
**Rationale:**  
- Guarantees exact distribution (no randomness in counts)
- User requirement: Metal: 4,500, Energy: 4,500, Cave: 2,250, Factory: 2,250, Wasteland: 9,000  
**Implementation:** Create array with exact counts, shuffle positions  
**Alternatives Considered:** Random assignment (rejected - wouldn't guarantee exact counts)  
**Status:** ✅ Implemented in design

---

### [DEC-013] jose Library for Edge Runtime JWT
**Date:** 2025-10-17  
**Context:** Next.js middleware crashed with `jsonwebtoken` due to native module dependencies (node-gyp-build → bcrypt)  
**Decision:** Use `jose` library for JWT operations in Edge Runtime middleware  
**Rationale:**  
- Edge Runtime cannot use native Node.js modules (bcrypt, crypto, fs)
- `jose` is pure JavaScript, built specifically for Edge/Web Crypto API
- `jose` is the recommended JWT library for Next.js middleware per official docs
- Async-first design is more secure and follows modern standards  
**Implementation:**  
- Middleware (`lib/authMiddleware.ts`): Uses `jose` for JWT verification
- API Routes (`lib/authService.ts`): Continues using `jsonwebtoken` + `bcrypt` (Node.js runtime)
- Both use same JWT_SECRET for token compatibility  
**Alternatives Considered:**  
1. Configure middleware to use Node.js runtime (rejected - performance overhead)
2. Find alternative auth method (rejected - JWT industry standard)  
**Migration Notes:** Changed `verifyToken()` from sync to async (jose requirement)  
**Status:** ✅ Implemented (FID-20251017-005)

---

### [DEC-014] Multiple Movement Control Schemes
**Date:** 2025-10-17  
**Context:** Improve accessibility and cater to different user preferences  
**Decision:** Support three complete keyboard control schemes for movement  
**Rationale:**  
- **QWEASDZXC:** Original grid layout (familiar to gamers)
- **Numpad 1-9:** Matches physical numpad grid (intuitive for number pad users)
- **Arrow Keys:** Cardinal directions only (beginner-friendly, standard navigation)  
**Implementation:**  
- Extended `KeyToDirection` Record in `types/game.types.ts`
- No code changes needed in event handling (already generic)
- All three schemes work simultaneously
- Total 26 key mappings (18 QWEASDZXC + 9 numpad + 4 arrows - 5 overlaps)  
**Alternatives Considered:**  
1. Single scheme only (rejected - limits accessibility)
2. Configurable bindings (rejected - unnecessary complexity for Phase 1)  
**Benefits:**  
- Zero performance impact (simple Record lookup)
- Improved accessibility (players use preferred input)
- No breaking changes (original keys preserved)  
**Status:** ✅ Implemented (FID-20251017-006)

---

### [DEC-015] Stripe for Payment Processing
**Date:** 2025-10-24  
**Context:** Need payment processor for VIP subscriptions and monetization  
**Decision:** Use Stripe as primary payment processor  
**Rationale:**  
- Industry-standard payment platform (trusted by millions)
- Excellent developer experience with comprehensive SDKs
- Built-in subscription management (recurring billing, proration, etc.)
- Webhook system for automated event handling
- PCI compliance handled by Stripe (reduces liability)
- Customer portal for self-service cancellation/management
- Supports multiple currencies and payment methods  
**Implementation:**  
- `stripe` SDK v17.5.0 for server-side operations
- `@stripe/stripe-js` v5.1.0 for client-side checkout
- Webhook endpoint with signature verification
- 5 pricing tiers (Weekly to Yearly)  
**Alternatives Considered:**  
1. PayPal (rejected - inferior subscription management)
2. Square (rejected - focused on physical retail)
3. Paddle (rejected - higher fees, less flexible)
4. Manual payment handling (rejected - PCI compliance nightmare)  
**Business Benefits:**  
- Automated subscription management (zero manual intervention)
- Professional checkout UX
- Reduced churn with customer portal
- Comprehensive analytics in Stripe Dashboard  
**Status:** ✅ Implemented (FID-20251024-STRIPE)

---

### [DEC-016] Tiered VIP Pricing Strategy
**Date:** 2025-10-24  
**Context:** Determine optimal pricing structure for VIP subscriptions  
**Decision:** Implement 5-tier pricing with increasing value propositions  
**Pricing Structure:**  
- Weekly: $9.99 (all VIP benefits)
- Monthly: $19.99 (all + 2x RP multiplier)
- Quarterly: $49.99 (all + 2x RP + 10% resource boost)
- Biannual: $89.99 (all + 2x RP + 15% boost + exclusive units)
- Yearly: $199.99 (all + 3x RP + 25% boost + exclusive units + cosmetics)  
**Rationale:**  
- **Price Anchoring:** Weekly plan makes monthly feel reasonable
- **Volume Discounts:** Longer subscriptions have better $/day value
- **Progressive Benefits:** Higher tiers unlock exclusive features (units, cosmetics)
- **Psychological Pricing:** $X.99 pricing proven to increase conversions
- **Flexibility:** Caters to casual (weekly) and hardcore (yearly) players  
**Value Calculation:**  
- Weekly: $1.43/day
- Monthly: $0.67/day (53% savings vs weekly)
- Quarterly: $0.55/day (61% savings)
- Biannual: $0.50/day (65% savings)
- Yearly: $0.55/day (61% savings) + exclusive benefits  
**Alternatives Considered:**  
1. Single monthly price (rejected - leaves money on table)
2. Free tier with limited benefits (rejected - devalues VIP)
3. Usage-based pricing (rejected - too complex)  
**Status:** ✅ Implemented (FID-20251024-STRIPE)

---

### [DEC-017] Referral System - Progressive Rewards with VIP Cap
**Date:** 2025-10-24  
**Context:** Design referral reward structure that incentivizes recruiting without breaking economy  
**Decision:** Progressive scaling with hard caps and milestone bonuses  
**Reward Structure:**  
- **Base:** 10k metal/energy, 15 RP, 2k XP, 1 VIP day per referral
- **Progressive:** 1.05x multiplier per referral (caps at 2.0x on 15th)
- **VIP Cap:** 30 days total lifetime (prevents subscription cannibalization)
- **Milestones:** 8 bonuses at 1, 3, 5, 10, 15, 25, 50, 100 referrals
- **Total Value (100 referrals):** ~5M resources, ~15k RP, 30 VIP days  
**Rationale:**  
- **Progressive Scaling:** Encourages continued recruiting (each referral worth more)
- **VIP Cap:** Protects subscription revenue (can't earn unlimited free VIP)
- **RP Balance:** 15k RP = 0.55% of WMD tree (meaningful but not game-breaking)
- **Milestones:** Create psychological hooks ("just 2 more for next milestone")
- **Anti-Abuse:** 7-day + 4 login validation prevents fake accounts  
**Economic Impact Analysis:**  
- **Best Case (100 referrals):** ~5M resources ≈ 1 week of active farming
- **RP Impact:** 15k ≈ 2-3 mid-tier WMD techs (significant but not overpowered)
- **VIP Value:** 30 days ≈ $20 value (acceptable CAC for organic users)  
**Alternatives Considered:**  
1. Flat rewards (rejected - no incentive for volume)
2. Unlimited VIP (rejected - kills subscription revenue)
3. Cash rewards (rejected - legal complications)  
**Anti-Abuse Measures:**  
- IP tracking (max 3 accounts per IP per code)
- 7-day + 4 login validation requirement
- Admin flagging and manual review
- Temporary email domain blocking  
**Status:** ✅ Implemented (FID-20251024-001)

---

### [DEC-018] Daily Cron Validation vs Real-Time
**Date:** 2025-10-24  
**Context:** When should referrals be validated and rewards distributed?  
**Decision:** Daily automated cron job for validation (not real-time)  
**Rationale:**  
- **Fraud Prevention:** 7-day delay allows time to detect abuse patterns
- **Server Load:** Batch processing more efficient than real-time checks
- **Database Consistency:** Single daily process reduces race conditions
- **Admin Review:** Flagged referrals can be reviewed before rewards distributed  
**Implementation:**  
- Cron script runs daily at 3 AM server time
- Validates referrals older than 7 days with 4+ logins
- Auto-invalidates failed referrals
- Comprehensive logging for audit trail  
**Alternatives Considered:**  
1. Real-time validation on 4th login (rejected - abuse window)
2. Manual admin validation only (rejected - too labor intensive)
3. Instant rewards on signup (rejected - fraud risk)  
**Status:** ✅ Implemented (FID-20251024-001)

---

**Last Updated:** 2025-10-26
