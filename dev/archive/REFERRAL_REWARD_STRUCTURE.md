# 🎁 Referral System - Balanced Reward Structure

**Created:** 2024-10-24  
**FID:** FID-20251024-001  
**Status:** Phase 2 Complete - Rewards Balanced

---

## 📊 **REWARD SUMMARY**

### **Base Rewards Per Referral:**
- **Metal:** 100,000 (with 1.05x progressive scaling)
- **Energy:** 100,000 (with 1.05x progressive scaling)
- **Research Points (RP):** 25 (with 1.05x progressive scaling)
- **Experience (XP):** 5,000 (with 1.05x progressive scaling)
- **VIP Days:** 1 day (**capped at 30 days total**)

### **Progressive Scaling:**
Each referral increases rewards by 5%:
- Referral #1: 100k resources, 25 RP, 5k XP, 1 VIP day
- Referral #10: ~155k resources, 38 RP, 7.7k XP, 1 VIP day
- Referral #50: ~1.1M resources, 271 RP, 54k XP, 1 VIP day (if not capped)
- Referral #100: ~11.8M resources, 2,954 RP, 590k XP, 0 VIP days (cap reached)

---

## 🏆 **MILESTONE REWARDS**

### **1st Referral - "First Recruiter"**
- Title: "Recruiter"
- Bonus: 250k Metal + 250k Energy + 50 RP + 10k XP + 2 VIP days
- **Total at Milestone:** 350k Metal/Energy, 75 RP, 15k XP, 3 VIP days cumulative

### **3rd Referral - "Active Recruiter"**
- Bonus: 500k Metal + 500k Energy + 100 RP + 25k XP + 3 VIP days
- Special: 15 Elite Infantry Units
- **Total at Milestone:** ~1.4M Metal/Energy, 250 RP, 60k XP, 7 VIP days cumulative

### **5th Referral - "Talent Scout"**
- Title: "Talent Scout"
- Badge: Bronze Recruiter
- Bonus: 1M Metal + 1M Energy + 250 RP + 50k XP + 5 VIP days
- **Total at Milestone:** ~3M Metal/Energy, 600 RP, 135k XP, 13 VIP days cumulative

### **10th Referral - "Dedicated Recruiter"**
- Bonus: 2.5M Metal + 2.5M Energy + 500 RP + 100k XP + 7 VIP days
- Special: "Recruiter's Squad" Unit + 5% Permanent Resource Bonus
- **Total at Milestone:** ~7M Metal/Energy, 1,500 RP, 350k XP, 21 VIP days cumulative

### **15th Referral - "Elite Recruiter"**
- Title: "Elite Recruiter"
- Badge: Silver Recruiter
- Bonus: 5M Metal + 5M Energy + 1,000 RP + 150k XP + 5 VIP days
- Special: Legendary Unit Pack (3 units)
- **Total at Milestone:** ~14M Metal/Energy, 3,000 RP, 650k XP, 26 VIP days cumulative

### **25th Referral - "Master Recruiter"**
- Title: "Ambassador"
- Bonus: 10M Metal + 10M Energy + 2,500 RP + 300k XP + 2 VIP days
- Special: "Ambassador" Prestige Unit + 10% Permanent XP Bonus
- **Total at Milestone:** ~30M Metal/Energy, 6,500 RP, 1.4M XP, **28 VIP days** (approaching cap)

### **50th Referral - "Legendary Recruiter"**
- Title: "Legendary Recruiter"
- Badge: Gold Recruiter
- Bonus: 25M Metal + 25M Energy + 5,000 RP + 750k XP + **0 VIP days** (cap reached)
- Special: Gold Badge + Permanent 10% Resource Boost + Advanced Research Pack
- **Total at Milestone:** ~80M Metal/Energy, 13,500 RP, 3.2M XP, **30 VIP days** (capped)

### **100th Referral - "Empire Builder"** (ULTIMATE)
- Title: "Empire Builder"
- Badge: Diamond Recruiter
- Bonus: 50M Metal + 50M Energy + 10,000 RP + 2M XP + **0 VIP days** (cap reached)
- Special: "Empire Builder" Ultimate Unit + Diamond Badge + 25% All Bonuses + Custom Profile Frame
- **Total at Milestone:** ~250M Metal/Energy, ~30,000 RP, 8M XP, **30 VIP days** (capped)

---

## 📈 **TOTAL REWARDS AT 100 REFERRALS**

**Base Rewards (1.05x scaling × 100):**
- Metal: ~11.8M
- Energy: ~11.8M
- RP: ~2,954
- XP: ~590k
- VIP: 30 days (capped at ~28th referral)

**Milestone Bonuses:**
- Metal: ~94M
- Energy: ~94M
- RP: ~19,400
- XP: ~3.4M
- VIP: 24 days (applied before cap)

**Grand Total:**
- **Metal:** ~105M
- **Energy:** ~105M
- **Research Points:** ~22,000 RP (≈0.8% of total WMD tree)
- **Experience:** ~4M XP
- **VIP Days:** 30 (hard cap enforced)
- **Special Rewards:** 8 titles, 4 badges, 5+ unique units, permanent bonuses

---

## 🎯 **RP ANALYSIS: WMD PROGRESSION**

### **RP Costs in DarkFrame:**

**Unit Tier Unlocks:**
- Tier 2: 5 RP
- Tier 3: 15 RP
- Tier 4: 30 RP
- Tier 5: 50 RP
- **Total:** 100 RP ✅ Easily unlocked with referrals

**WMD Research System:**
- 3 Tracks: Missile, Defense, Intelligence
- 10 Tiers per track
- **Total RP Required:** 2,700,000 RP
- Individual tech costs: 10k - 300k RP each

**Referral RP at 100 Referrals:**
- ~22,000 RP total
- **Coverage:** 0.8% of full WMD tree
- **Equivalent to:** ~2-3 mid-tier WMD techs OR multiple low-tier techs
- **Impact:** Meaningful early progression without breaking economy

---

## 🔒 **VIP CAP ENFORCEMENT**

### **Implementation:**
1. **Tracking:** `referralRewardsEarned.vipDays` field stores VIP days earned from referrals
2. **Cap Check:** Before awarding VIP, system checks if player has reached 30-day limit
3. **Partial Awards:** If player at 27 days and earns 5 days, only 3 are awarded
4. **Zero Awards:** Once at 30 days, all future VIP rewards = 0
5. **Alternative Rewards:** Milestones 50+ give resources/RP instead of VIP

### **VIP Timeline:**
- Referrals 1-10: 21 VIP days
- Referrals 11-15: 5 VIP days (total: 26)
- Referrals 16-25: 2 VIP days (total: 28)
- Referrals 26+: Remaining 2 days awarded, then 0 VIP days
- **Cap Reached:** Around 28th referral (varies by validation timing)

---

## 💡 **NEW PLAYER WELCOME PACKAGE**

When signing up with referral code, new players receive:
- **Metal:** 25,000
- **Energy:** 25,000
- **Unit:** 1 Legendary Digger (+15% gathering bonus)
- **XP Boost:** 25% for 7 days
- **VIP Trial:** 3 days free
- **Title:** "Recruit"

**Value:** Jumpstart package worth ~$5-10 equivalent, encouraging engagement without breaking economy.

---

## 🛡️ **ANTI-ABUSE MEASURES**

1. **IP Tracking:** Max 3 accounts per IP per referral code
2. **Email Validation:** Blocks temporary email domains
3. **7-Day Validation:** Rewards only after 7 days + 4 logins
4. **Risk Assessment:** Low/Medium/High flagging system
5. **Admin Tools:** Manual review and flagging capabilities

---

## 🎮 **GAME ECONOMY IMPACT**

### **Resource Balance:**
- 100M resources at 100 referrals = equivalent to ~3-4 weeks of active farming
- Doesn't break economy but provides meaningful acceleration
- Encourages organic growth through community building

### **RP Balance:**
- 22k RP at 100 referrals = 0.8% of WMD tree
- Allows players to unlock all unit tiers + starter WMD techs
- Still requires significant farming/gameplay for high-tier content
- Maintains long-term progression curve

### **VIP Balance:**
- 30-day cap prevents subscription cannibalization
- Meaningful reward without "lifetime VIP" abuse
- Encourages continued recruiting for resource/RP rewards
- Alternative rewards at high milestones maintain motivation

---

## ✅ **IMPLEMENTATION STATUS**

**Completed:**
- ✅ Type definitions (`types/referral.types.ts`)
- ✅ Core service logic (`lib/referralService.ts`)
- ✅ API endpoints (generate, validate, stats, leaderboard)
- ✅ Registration integration
- ✅ VIP cap enforcement
- ✅ RP balancing (25 base + milestones)
- ✅ Enhanced milestone rewards

**Pending:**
- ❌ UI Components (ReferralDashboard, ReferralLeaderboard)
- ❌ Referral dashboard page (`/app/referrals/page.tsx`)
- ❌ Main leaderboard integration
- ❌ Admin panel referral management
- ❌ Daily cron job for validation checks
- ❌ Email notifications (optional)

---

## 📋 **NEXT STEPS**

1. Create referral dashboard UI components
2. Build `/referrals` page for players to track progress
3. Integrate referral stats into profile page
4. Add referral management to admin panel
5. Implement daily cron job for auto-validation
6. Test complete referral flow end-to-end
7. Monitor and adjust reward values based on player behavior

---

**Document Version:** 1.0  
**Last Updated:** 2024-10-24  
**Approved By:** User  
**Balance Status:** ✅ Approved - VIP capped, RP balanced, resources scaled
