# 🚀 DarkFrame - Quick Start Guide for Next Session

**Last Updated:** 2025-10-19  
**Current Status:** VIP System Live, Payment Integration Ready

---

## ⚡ WHAT'S WORKING NOW

### ✅ Auto-Farm System (FID-20251019-003)
- **Location:** `/game` page → Auto-Farm panel
- **Features:** 
  - Snake pattern traversal (150×150 map)
  - Keypress simulation (QWEASDZXC movement, 'g'/'f' harvest)
  - Real-time statistics tracking
  - Combat integration with rank filtering
  - Settings page with configuration options
  
### ✅ VIP Monetization System (FID-20251019-004)
- **Admin Panel:** `/admin/vip`
  - Search users, grant VIP (7/30/365 days), revoke VIP
  - Stats dashboard showing VIP/Basic counts
  
- **VIP Upgrade Page:** `/game/vip-upgrade`
  - Marketing page with pricing ($4.99-$99.99)
  - Feature comparison, FAQ, contact admin CTA
  
- **VIP Speed:**
  - VIP: 5.6 hour map completion (2x speed)
  - Basic: 11.6 hour map completion (standard)

---

## 🎯 IMMEDIATE PRIORITIES FOR NEXT SESSION

### 1. Admin Authentication (HIGH PRIORITY - 1 hour)
**Files to modify:**
- `types/game.types.ts` - Add `isAdmin?: boolean` to Player interface
- `app/api/admin/vip/list/route.ts` - Verify isAdmin before listing
- `app/api/admin/vip/grant/route.ts` - Verify isAdmin before granting
- `app/api/admin/vip/revoke/route.ts` - Verify isAdmin before revoking

**Implementation:**
```typescript
// Get username from request (cookie/header)
const username = request.cookies.get('username')?.value;
if (!username) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

// Verify admin status
const playersCollection = await getCollection('players');
const admin = await playersCollection.findOne({ username });
if (!admin?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

### 2. Stripe Payment Integration (MEDIUM PRIORITY - 3-4 hours)

**Setup Required:**
1. Create Stripe account at https://stripe.com
2. Get API keys (Publishable + Secret)
3. Add to `.env.local`:
   ```
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

**Files to create:**
- `app/api/stripe/create-checkout/route.ts` - Create checkout session
- `app/api/stripe/webhook/route.ts` - Handle subscription events
- `app/api/stripe/portal/route.ts` - Customer portal for cancellations

**Implementation Steps:**
1. Install Stripe: `npm install stripe @stripe/stripe-js`
2. Create checkout session API
3. Add payment buttons to VIP upgrade page
4. Set up webhook handler for subscription lifecycle
5. Test with Stripe test cards

### 3. VIP Expiration Automation (LOW PRIORITY - 1 hour)

**Option A: API Route (Simpler)**
- Create `/api/cron/expire-vip/route.ts`
- Call periodically from client or external cron service
- Check `vipExpiresAt < Date.now()` and revoke

**Option B: Vercel Cron (Production)**
- Use Vercel cron jobs (Pro plan required)
- Set up `vercel.json` with cron schedule
- Runs automatically in background

---

## 📁 KEY FILE LOCATIONS

### Auto-Farm System:
```
utils/autoFarmEngine.ts          - Core engine (959 lines)
types/autoFarm.types.ts          - Type definitions (183 lines)
components/AutoFarmPanel.tsx     - UI panel (266 lines)
app/game/auto-farm-settings/page.tsx - Settings page
```

### VIP System:
```
types/game.types.ts              - Player.isVIP, Player.vipExpiresAt
app/admin/vip/page.tsx           - Admin management (345 lines)
app/game/vip-upgrade/page.tsx    - Marketing page (346 lines)
app/api/admin/vip/list/route.ts  - List users API
app/api/admin/vip/grant/route.ts - Grant VIP API
app/api/admin/vip/revoke/route.ts - Revoke VIP API
```

---

## 🧪 TESTING CHECKLIST

### Before Next Development Session:
- [ ] Auto-farm starts and moves correctly
- [ ] Harvest keypresses trigger ('g', 'f')
- [ ] VIP badge shows in AutoFarmPanel
- [ ] Admin panel loads at `/admin/vip`
- [ ] VIP upgrade page loads at `/game/vip-upgrade`
- [ ] Grant VIP works (check expiration in DB)
- [ ] Revoke VIP works (check isVIP = false)

### After Admin Auth Implementation:
- [ ] Non-admin users cannot access `/admin/vip`
- [ ] API routes return 403 for non-admins
- [ ] Admin users can grant/revoke VIP

### After Stripe Integration:
- [ ] Checkout button works on VIP upgrade page
- [ ] Test card payment succeeds (4242 4242 4242 4242)
- [ ] Webhook updates player.isVIP to true
- [ ] Subscription renewal extends vipExpiresAt
- [ ] Cancellation sets isVIP to false after period ends

---

## 💾 DATABASE QUERIES (Quick Reference)

### Check VIP Status:
```javascript
db.players.findOne({ username: "testuser" }, { isVIP: 1, vipExpiresAt: 1 })
```

### Manually Grant VIP:
```javascript
db.players.updateOne(
  { username: "testuser" },
  { 
    $set: { 
      isVIP: true, 
      vipExpiresAt: new Date(Date.now() + 30*24*60*60*1000) // 30 days
    }
  }
)
```

### Count VIP Users:
```javascript
db.players.countDocuments({ isVIP: true })
```

### Find Expired VIPs:
```javascript
db.players.find({ isVIP: true, vipExpiresAt: { $lt: new Date() } })
```

---

## 🐛 KNOWN ISSUES / TODOS

### Admin Panel:
- ❌ No authentication (anyone can access `/admin/vip`)
- ❌ No audit logging (who granted/revoked VIP when)
- ❌ No pagination (all users loaded at once)

### VIP System:
- ❌ No payment integration (buttons disabled)
- ❌ No automatic expiration (manual revoke required)
- ❌ No analytics tracking (grants, revokes, revenue)

### Auto-Farm:
- ⚠️ Occasional cooldown violations on VIP tier (acceptable)
- ⚠️ No pause/resume between sessions (restarts from beginning)

---

## 📊 VIP PRICING STRUCTURE

| Tier    | Price   | Days | Daily Cost | Savings |
|---------|---------|------|------------|---------|
| Weekly  | $4.99   | 7    | $0.71      | -       |
| Monthly | $14.99  | 30   | $0.50      | 25%     |
| Yearly  | $99.99  | 365  | $0.27      | 44%     |

**Value Proposition:**
- VIP: 5.6 hour map completion
- Basic: 11.6 hour map completion
- **Savings: 5.8 hours per run (2x speed)**

---

## 🔑 ENVIRONMENT VARIABLES NEEDED

**Current (Working):**
```
MONGODB_URI=mongodb://...
JWT_SECRET=...
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Add for Stripe (Next Session):**
```
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_WEEKLY=price_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_YEARLY=price_...
```

---

## 📞 SUPPORT COMMANDS

### Start Development Server:
```powershell
npm run dev
```

### Check TypeScript Errors:
```powershell
npx tsc --noEmit
```

### View MongoDB Data:
```powershell
mongosh "your-connection-string"
```

### Test Stripe Webhooks Locally:
```powershell
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## 🎯 SUCCESS CRITERIA FOR NEXT SESSION

**Minimum Viable Product:**
- [x] VIP system foundation (DONE)
- [ ] Admin authentication (1 hour)
- [ ] Stripe checkout integration (3-4 hours)
- [ ] VIP expiration automation (1 hour)

**Stretch Goals:**
- [ ] Analytics dashboard for admin
- [ ] Email notifications for VIP expiration
- [ ] Additional VIP perks (exclusive units, badges)
- [ ] Promotional codes system

---

## 📚 HELPFUL RESOURCES

### Stripe Integration:
- Stripe Docs: https://stripe.com/docs/payments/checkout
- Next.js + Stripe: https://github.com/vercel/nextjs-subscription-payments
- Test Cards: https://stripe.com/docs/testing#cards

### Next.js API Routes:
- Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Middleware: https://nextjs.org/docs/app/building-your-application/routing/middleware

### MongoDB:
- Node.js Driver: https://www.mongodb.com/docs/drivers/node/current/
- Query Operators: https://www.mongodb.com/docs/manual/reference/operator/query/

---

**Ready to start next session! 🚀**

**Recommended Order:**
1. Test current VIP system (admin panel, grant/revoke)
2. Implement admin authentication (1 hour)
3. Set up Stripe account and get API keys
4. Integrate Stripe checkout (3-4 hours)
5. Test end-to-end payment flow
6. Deploy and celebrate! 🎉
