# Stripe Payment Integration - Local Testing Guide

> **Quick setup guide for testing Stripe webhooks locally**

## 🎯 Prerequisites

- ✅ Stripe account (test mode)
- ✅ Stripe CLI installed at `C:\stripe\stripe.exe`
- ✅ All environment variables configured in `.env.local`

---

## 🚀 QUICK START (Recommended)

### **One Command to Rule Them All:**
```powershell
npm run dev:stripe
```

This automatically:
- ✅ Starts your development server
- ✅ Starts Stripe webhook listener
- ✅ Shows both outputs side-by-side with color coding
- ✅ Automatically updates `.env.local` with webhook secret (first run)

**That's it!** Your server and webhook listener are now running together.

---

## 📋 Other Useful Scripts

### Trigger Test Webhook Events:
```powershell
# Simulate a successful checkout
npm run stripe:trigger:checkout

# Simulate subscription renewal
npm run stripe:trigger:subscription-update

# Simulate subscription cancellation
npm run stripe:trigger:subscription-cancel
```

### Manual Stripe Listener (if needed):
```powershell
npm run stripe:listen
```

---

## 📦 Step 1: Install Stripe CLI (If Not Installed)

### Windows (PowerShell):
```powershell
# Using Scoop package manager
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Or download directly from:
# https://github.com/stripe/stripe-cli/releases/latest
```

### Verify Installation:
```powershell
stripe --version
```

---

## 🔐 Step 2: Authenticate Stripe CLI

```powershell
# Login to your Stripe account
stripe login

# This will:
# 1. Open browser for authentication
# 2. Generate API key pairing
# 3. Save credentials locally
```

**Expected output:**
```
Your pairing code is: word-word-word
Press Enter to open the browser (^C to quit)
```

---

## 🚀 Step 3: Start Local Development Server

**Terminal 1 (Keep this running):**
```powershell
cd D:\dev\DarkFrame
npm run dev
```

**Expected output:**
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000
```

---

## 🔔 Step 4: Forward Webhooks to Localhost

**Terminal 2 (New PowerShell window):**
```powershell
cd D:\dev\DarkFrame

# Forward all webhook events to local endpoint
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Expected output:**
```
> Ready! Your webhook signing secret is whsec_1234567890abcdef...
  (^C to quit)

> Listening for webhook events on http://localhost:3000/api/stripe/webhook
```

**⚠️ IMPORTANT:** Copy the webhook signing secret!

---

## 🔑 Step 5: Update .env.local with Webhook Secret

Open `.env.local` and update:
```bash
# Replace the placeholder with the actual secret from Step 4
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

**Restart your dev server** (Terminal 1) after updating:
```powershell
# Press Ctrl+C to stop
# Then restart:
npm run dev
```

---

## 🧪 Step 6: Test Webhook Events

**Terminal 3 (New PowerShell window):**
```powershell
cd D:\dev\DarkFrame

# Test checkout completion event
stripe trigger checkout.session.completed

# Test subscription update event
stripe trigger customer.subscription.updated

# Test subscription deletion event
stripe trigger customer.subscription.deleted
```

**Watch Terminal 2 (webhook listener):**
```
[200] POST /api/stripe/webhook [checkout.session.completed]
```

**Watch Terminal 1 (dev server logs):**
```
Webhook event received: checkout.session.completed
VIP granted successfully: {...}
```

---

## 🛒 Step 7: Test Real Purchase Flow

### 7.1 Navigate to VIP Upgrade Page
```
http://localhost:3000/game/vip-upgrade
```

### 7.2 Click "Get VIP" on any tier
- This creates a checkout session
- Redirects to Stripe checkout

### 7.3 Use Stripe Test Card
```
Card Number:  4242 4242 4242 4242
Expiry:       Any future date (e.g., 12/34)
CVC:          Any 3 digits (e.g., 123)
ZIP:          Any 5 digits (e.g., 12345)
```

### 7.4 Complete Payment
- Click "Pay" button
- Stripe processes payment
- Sends webhook to Terminal 2 listener
- Webhook forwards to your local app
- App grants VIP automatically
- Redirects to success page

### 7.5 Verify VIP Granted

**Check Terminal 1 logs:**
```
Webhook event received: checkout.session.completed
Processing checkout completion: {...}
VIP granted successfully: {...}
Payment transaction recorded: {...}
```

**Check MongoDB:**
```javascript
// In MongoDB Compass or mongosh
db.users.findOne({ username: "yourUsername" })
// Should show:
// - vip: true
// - vipExpiration: <date>
// - vipTier: "MONTHLY" (or selected tier)
// - stripeCustomerId: "cus_..."
// - stripeSubscriptionId: "sub_..."
```

**Check Game UI:**
- Navigate to `/game` or `/profile`
- Should show VIP badge
- VIP features unlocked (2x multiplier, etc.)

---

## 📊 Step 8: Monitor Webhook Activity

**Terminal 2 shows all webhook events:**
```
[200] POST /api/stripe/webhook [checkout.session.completed]
[200] POST /api/stripe/webhook [customer.subscription.updated]
[200] POST /api/stripe/webhook [invoice.payment_succeeded]
```

**Check Stripe Dashboard:**
```
https://dashboard.stripe.com/test/webhooks
```
- View webhook delivery attempts
- See event payloads
- Debug failed webhooks

---

## 🐛 Troubleshooting

### Problem: Webhook signature verification fails
**Solution:**
- Ensure webhook secret in `.env.local` matches Terminal 2 output
- Restart dev server after updating `.env.local`
- Check for extra spaces or quotes in secret

### Problem: VIP not granted after payment
**Solution:**
- Check Terminal 1 for error logs
- Verify metadata in checkout session (userId, tier, username)
- Check MongoDB connection is active
- Ensure grantVIP() function has no errors

### Problem: Stripe CLI not forwarding events
**Solution:**
```powershell
# Kill existing listeners
Get-Process | Where-Object {$_.Name -eq "stripe"} | Stop-Process

# Restart listener
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Problem: "stripe: command not found"
**Solution:**
- Reinstall Stripe CLI
- Add to PATH if manually installed
- Restart PowerShell after installation

---

## ✅ Verification Checklist

- [ ] Stripe CLI installed and authenticated
- [ ] Dev server running on localhost:3000
- [ ] Webhook listener forwarding to localhost
- [ ] Webhook secret in .env.local
- [ ] Test events trigger successfully
- [ ] Real purchase flow completes
- [ ] VIP granted in database
- [ ] Success page displays
- [ ] User profile shows VIP status
- [ ] Logs show successful processing

---

## 🔄 Typical Development Workflow

**Every time you start working:**

```powershell
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start webhook listener
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Terminal 3: Available for testing/commands
# (stripe trigger, database queries, etc.)
```

**Keep Terminals 1 & 2 running while developing!**

---

## 🚀 Next Steps After Local Testing

Once local testing works perfectly:

1. **Deploy to production/staging**
2. **Configure production webhook** in Stripe Dashboard
3. **Update environment variables** with production secrets
4. **Test production webhook** with real endpoint
5. **Monitor production payments** in Stripe Dashboard

---

## 📞 Support Resources

- **Stripe CLI Docs:** https://stripe.com/docs/stripe-cli
- **Webhook Testing:** https://stripe.com/docs/webhooks/test
- **Test Cards:** https://stripe.com/docs/testing

---

**Happy testing! 🎉**
