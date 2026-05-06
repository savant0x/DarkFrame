# 🚀 Next Development Session - Quick Start Guide

**Last Updated:** October 20, 2025  
**Current Status:** VIP System 100% Complete | Ready for Payment Integration  
**Priority:** Admin Authentication → Stripe Integration → Automation

---

## ⚡ **IMMEDIATE ACTION ITEMS**

### **1. [FID-20251020-002] Admin API Authentication** ⚠️ CRITICAL SECURITY
**Estimate:** 1-1.5 hours | **Priority:** 🔴 MUST DO FIRST

**Why Critical:** VIP API routes currently unprotected - anyone can grant/revoke VIP status

**Quick Implementation:**
```typescript
// Create: lib/middleware/adminAuth.ts
export async function verifyAdmin(request: Request) {
  const session = await getSession(request);
  if (!session || !session.player.isAdmin) {
    throw new Error('Unauthorized');
  }
  return session.player;
}

// Update: app/api/admin/vip/grant/route.ts
import { verifyAdmin } from '@/lib/middleware/adminAuth';

export async function POST(request: Request) {
  try {
    await verifyAdmin(request); // Add this line
    // ... existing grant logic
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

**Files to Modify:**
- `app/api/admin/vip/list/route.ts`
- `app/api/admin/vip/grant/route.ts`
- `app/api/admin/vip/revoke/route.ts`

**Testing:**
- ✅ Admin user can grant/revoke VIP
- ✅ Non-admin user gets 401 Unauthorized
- ✅ No session returns 401

---

### **2. [FID-20251020-003] Stripe Payment Integration** 💰 HIGH VALUE
**Estimate:** 4-6 hours | **Priority:** 🔴 CRITICAL FOR REVENUE

**Setup Steps:**
1. Create Stripe account: https://dashboard.stripe.com/register
2. Get test API keys: Dashboard → Developers → API keys
3. Install package: `npm install stripe @stripe/stripe-js`
4. Add to `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

**Implementation Checklist:**
- [ ] Create `lib/stripe.ts` (Stripe client)
- [ ] Create `app/api/stripe/create-checkout/route.ts` (3 pricing tiers)
- [ ] Create `app/api/stripe/webhook/route.ts` (subscription events)
- [ ] Update `app/game/vip-upgrade/page.tsx` (replace "Coming Soon")
- [ ] Create `app/game/vip-success/page.tsx` (payment confirmation)
- [ ] Test checkout flow with Stripe test cards
- [ ] Set up webhook in Stripe dashboard

**Pricing Tiers:**
- Weekly: $4.99 (7 days)
- Monthly: $14.99 (30 days) ⭐ Best Value
- Yearly: $99.99 (365 days)

**Webhook Events:**
- `checkout.session.completed` → Grant VIP
- `customer.subscription.updated` → Update expiration
- `customer.subscription.deleted` → Revoke VIP

---

### **3. [FID-20251020-004] VIP Expiration Automation** ⏰ HIGH PRIORITY
**Estimate:** 1.5-2 hours | **Priority:** 🟡 HIGH

**Quick Implementation:**
```typescript
// Create: lib/cron/vipExpiration.ts
import cron from 'node-cron';
import { connectDB } from '@/lib/mongodb';

export function startVIPExpirationCheck() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    const db = await connectDB();
    const now = new Date();
    
    const expired = await db.collection('players')
      .find({ isVIP: true, vipExpiresAt: { $lt: now } })
      .toArray();
    
    for (const player of expired) {
      await db.collection('players').updateOne(
        { _id: player._id },
        { $set: { isVIP: false }, $unset: { vipExpiresAt: "" } }
      );
      // TODO: Send expiration email
      console.log(`[VIP Expiration] Revoked VIP for ${player.username}`);
    }
  });
}
```

**Files to Create:**
- `lib/cron/vipExpiration.ts` (cron logic)
- `lib/email/vipNotifications.ts` (email templates)
- `app/api/cron/check-vip-expiration/route.ts` (manual trigger)

**Files to Modify:**
- `server.ts` (initialize cron on startup)

---

## 📋 **CURRENT PROJECT STATE**

**Completed (100%):**
- ✅ Core game (Phases 1-11)
- ✅ Auto-farm system with keypress simulation
- ✅ VIP system foundation (database, engine, APIs)
- ✅ VIP UI integration (navigation, admin panel)

**Ready for Implementation:**
- ⏳ Admin authentication (1-1.5hr)
- ⏳ Stripe payments (4-6hr)
- ⏳ Expiration automation (1.5-2hr)

**Total Estimated Time for Next Phase:** ~7-10 hours

---

## 🎯 **SUCCESS CRITERIA**

**After completing these 3 features:**
- ✅ VIP system fully secured (admin auth)
- ✅ Self-service VIP purchases (Stripe)
- ✅ Automated subscription management (expiration)
- ✅ Zero manual admin intervention needed
- ✅ Production-ready monetization system

---

## 📚 **REFERENCE DOCUMENTATION**

- **Feature Details:** See `dev/planned.md` (lines 1-200)
- **VIP System Specs:** See `dev/completed_archive_2025-10-20.md`
- **Admin Panel Code:** See `app/admin/page.tsx` (lines 598-760)
- **VIP API Routes:** See `app/api/admin/vip/` folder

---

## 🔗 **USEFUL LINKS**

- **Stripe Documentation:** https://stripe.com/docs/payments/checkout
- **Stripe Webhooks:** https://stripe.com/docs/webhooks
- **Stripe Test Cards:** https://stripe.com/docs/testing
- **Node Cron:** https://www.npmjs.com/package/node-cron
- **Nodemailer:** https://nodemailer.com/about/

---

## ⚡ **QUICK START COMMAND**

```bash
# Start development server
npm run dev

# Open admin panel
# Navigate to: http://localhost:3000/admin

# Test VIP features
# 1. Register test user
# 2. Manually set isAdmin=true in database
# 3. Grant VIP via admin panel
# 4. Test auto-farm speed difference
```

---

## 🚨 **CRITICAL REMINDERS**

1. ⚠️ **SECURITY FIRST:** Complete admin auth (FID-20251020-002) before anything else
2. 💰 **TEST MODE:** Use Stripe test keys during development
3. 🔐 **NEVER COMMIT:** Add `.env.local` to `.gitignore`
4. 📧 **EMAIL SETUP:** Configure SMTP before enabling expiration emails
5. ✅ **VERIFY ZERO ERRORS:** Run `npx tsc --noEmit` after each feature

---

**Next Action:** Review `dev/planned.md` for FID-20251020-002, then start coding!  
**Estimated Session Time:** 1.5 hours (admin auth) → 5 hours (Stripe) → 2 hours (expiration)  
**Total:** ~8.5 hours for complete payment system 🚀
