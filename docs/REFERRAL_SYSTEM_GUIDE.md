# 🎁 DarkFrame Referral System - Complete Guide

**Version:** 1.0  
**Created:** 2025-10-24  
**Feature ID:** FID-20251024-001  

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [Reward Structure](#reward-structure)
3. [User Features](#user-features)
4. [Admin Features](#admin-features)
5. [API Endpoints](#api-endpoints)
6. [Technical Architecture](#technical-architecture)
7. [Setup & Deployment](#setup--deployment)
8. [Testing Guide](#testing-guide)
9. [Troubleshooting](#troubleshooting)

---

## 📊 Overview

The DarkFrame Referral System rewards players for inviting friends to join the game. It features:

- **Progressive rewards** that scale with referral count
- **Milestone bonuses** at 1, 3, 5, 10, 15, 25, 50, and 100 referrals
- **Anti-abuse protection** via IP tracking and validation requirements
- **Comprehensive admin tools** for fraud detection and manual intervention
- **Automated validation** via daily cron job

### Key Statistics

| Metric | Value | Notes |
|--------|-------|-------|
| **Total Resources (100 referrals)** | ~5M metal/energy | Equals 2-3 hours of active farming |
| **Total RP (100 referrals)** | ~15,000 RP | 0.55% of complete WMD tree (2.7M RP) |
| **VIP Days Cap** | 30 days maximum | Hard capped to prevent exploitation |
| **Progressive Cap** | 2.0x at 15 referrals | Prevents late-game escalation |
| **Welcome Package** | 50k/50k + bonuses | Generous new player onboarding |

---

## 🎯 Reward Structure

### Base Rewards (Per Validated Referral)

```
Metal:     10,000 × progressive multiplier
Energy:    10,000 × progressive multiplier  
RP:        15 (flat, no multiplier)
XP:        2,000 (flat)
VIP Days:  1 day (capped at 30 total)
```

### Progressive Scaling

- **Formula:** `multiplier = min(1.05^referralCount, 2.0)`
- **Cap Reached:** 15th referral (2.0x multiplier)
- **Example:** 15th referral gives 20,000 metal + 20,000 energy

### Milestone Bonuses

| Referral | Metal | Energy | Bonuses |
|----------|-------|--------|---------|
| **1st** | 25,000 | 25,000 | "Recruiter" title |
| **3rd** | 50,000 | 50,000 | 5 Elite Infantry |
| **5th** | 100,000 | 100,000 | Bronze Badge + "Talent Scout" |
| **10th** | 250,000 | 250,000 | Special Unit + 5% resource bonus |
| **15th** | 500,000 | 500,000 | Silver Badge + 2 Legendary Units + "Elite Recruiter" |
| **25th** | 750,000 | 750,000 | "Ambassador" + Prestige Unit + 10% XP bonus |
| **50th** | 625,000 | 625,000 | Gold Badge + 10% resource boost + "Legendary Recruiter" |
| **100th** | 150,000 | 150,000 | Diamond Badge + 25% all bonuses + 3,000 RP + "Empire Builder" |

**Total Milestone Bonuses:** ~2.45M metal + ~2.45M energy

### Welcome Package (New Player)

When a player registers with a referral code, they receive:

```
✅ 50,000 Metal
✅ 50,000 Energy
✅ 1 Legendary Digger (+15% gathering bonus)
✅ 3-day VIP trial
✅ 25% XP boost for 7 days
✅ "Recruit" title
```

---

## 👤 User Features

### 1. Referral Dashboard

**Location:** `/referrals` or click "Invite Friends" in game StatsPanel

**Features:**
- Unique referral code and shareable link
- Copy-to-clipboard with success feedback
- Social media share buttons (X, Facebook)
- Stats overview (validated/pending/total)
- Progress bar to next milestone
- Total rewards earned breakdown
- Recent referrals list with validation status
- Badges and titles display

### 2. Leaderboard

**Location:** `/referrals` → Leaderboard tab

**Features:**
- Top 50 recruiters (load more for top 100)
- Rank medals for top 3 (🥇🥈🥉)
- Current player's rank highlighted
- Badges and titles for each player
- Milestone achievements reference

### 3. How It Works Guide

**Location:** `/referrals` → How It Works tab

**Content:**
- Step-by-step getting started
- Complete reward structure explanation
- Milestone bonuses breakdown
- FAQ (6 common questions)
- Pro tips for maximizing rewards

### 4. Profile Integration

**Location:** `/profile`

**Features:**
- Referral stats card with validated count
- Badges and titles display
- Next milestone indicator
- Quick link to full dashboard

### 5. Main Leaderboard Column

**Location:** `/game` → Leaderboard view

**Features:**
- "Referrals" column showing validated count
- Sortable by referral count
- Integrated with main player leaderboard

---

## 🛡️ Admin Features

### Admin Panel

**Location:** `/admin/referrals`  
**Access:** Requires `isAdmin: true` on player account

#### Dashboard View

**Stats Cards:**
- Total referrals
- Pending referrals
- Validated referrals
- Invalid referrals
- Flagged referrals (abuse detection)

#### Search & Filter

- Search by username or email
- Filter by status: all | pending | validated | invalid | flagged
- Real-time search results

#### Referral Table

**Columns:**
- Status badge (with flagged indicator)
- Referrer username
- Referred player (username + email)
- Login count (X / 4)
- Created date/time
- Action buttons

**Actions:**
- **Details:** Full referral record modal
- **Validate:** Manually validate and distribute rewards
- **Flag:** Mark as suspicious with reason
- **Unflag:** Remove flag
- **Invalidate:** Permanently mark as invalid

#### Details Modal

**Information Displayed:**
- Status and flag status
- Referrer and referred usernames
- Email address
- Referral code
- IP address (anti-abuse)
- Login count and last login
- Created and validated timestamps
- Flag reason (if flagged)
- Rewards distribution status

---

## 🔌 API Endpoints

### User Endpoints

#### `POST /api/referral/generate`
Generate a referral code for the current user.

**Auth:** Required  
**Request:** None  
**Response:**
```json
{
  "success": true,
  "code": "ABC123XYZ",
  "link": "https://darkframe.com/register?ref=ABC123XYZ"
}
```

#### `GET /api/referral/validate?code=ABC123XYZ`
Validate if a referral code exists and is active.

**Auth:** None  
**Query:** `code` (string)  
**Response:**
```json
{
  "success": true,
  "valid": true,
  "referrerUsername": "PlayerName"
}
```

#### `GET /api/referral/stats`
Get current user's referral statistics.

**Auth:** Required  
**Response:**
```json
{
  "success": true,
  "totalReferrals": 15,
  "validatedReferrals": 12,
  "pendingReferrals": 3,
  "code": "ABC123XYZ",
  "link": "...",
  "recentReferrals": [...],
  "totalRewards": {
    "metal": 500000,
    "energy": 500000,
    "rp": 180,
    "xp": 24000,
    "vipDays": 12
  },
  "nextMilestone": { ... },
  "progress": 80,
  "badges": ["bronze_recruiter"],
  "titles": ["Recruiter", "Talent Scout"]
}
```

#### `GET /api/referral/leaderboard?limit=50`
Get top recruiters leaderboard.

**Auth:** Optional (for current player rank)  
**Query:** `limit` (number, default: 50), `username` (string, optional)  
**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "username": "TopRecruiter",
      "totalReferrals": 100,
      "validatedReferrals": 95,
      "badges": ["diamond_recruiter"],
      "titles": ["Empire Builder"],
      "isCurrentPlayer": false
    }
  ],
  "currentPlayerRank": 15,
  "totalPlayers": 250
}
```

### Admin Endpoints

#### `GET /api/admin/referrals?status=pending&search=username`
Get all referrals with optional filters.

**Auth:** Admin required  
**Query:** `status` (string), `search` (string)  
**Response:**
```json
{
  "success": true,
  "referrals": [...],
  "total": 150,
  "stats": {
    "totalReferrals": 150,
    "pendingReferrals": 30,
    "validatedReferrals": 100,
    "invalidReferrals": 15,
    "flaggedReferrals": 5
  }
}
```

#### `POST /api/admin/referrals/flag`
Flag or unflag a referral.

**Auth:** Admin required  
**Body:**
```json
{
  "referralId": "507f1f77bcf86cd799439011",
  "flagged": true,
  "reason": "Same IP as referrer"
}
```

#### `POST /api/admin/referrals/validate`
Manually validate a referral.

**Auth:** Admin required  
**Body:**
```json
{
  "referralId": "507f1f77bcf86cd799439011"
}
```

#### `POST /api/admin/referrals/invalidate`
Manually invalidate a referral.

**Auth:** Admin required  
**Body:**
```json
{
  "referralId": "507f1f77bcf86cd799439011"
}
```

---

## 🏗️ Technical Architecture

### Database Schema

#### `referrals` Collection

```typescript
{
  _id: ObjectId,
  referrerPlayerId: ObjectId,
  referrerUsername: string,
  newPlayerUsername: string,
  newPlayerEmail: string,
  referralCode: string,
  validated: boolean,
  validationDate?: Date,
  flagged?: boolean,
  flagReason?: string,
  ipAddress?: string,
  validationDetails: {
    loginCount: number,
    lastLogin?: Date
  },
  rewardsData: {
    metal: number,
    energy: number,
    rp: number,
    xp: number,
    vipDays: number
  },
  rewardsClaimed: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### Player Schema Extensions

```typescript
{
  referralCode?: string,
  referredBy?: string,
  totalReferrals?: number,
  pendingReferrals?: number,
  validatedReferrals?: number,
  referralTitles?: string[],
  referralBadges?: string[],
  referralMilestonesReached?: number[],
  referralRewardsEarned?: {
    metal: number,
    energy: number,
    rp: number,
    xp: number,
    vipDays: number
  },
  lastReferralValidated?: Date
}
```

### Validation Logic

**Criteria for Validation:**
1. ✅ 7 days have passed since registration
2. ✅ Player has logged in 4+ times
3. ✅ Referral not flagged by admin
4. ✅ Rewards not already distributed

**Process Flow:**
1. Player A shares referral code `XYZ123`
2. Player B registers with code
3. Player B receives **welcome package**
4. Referral record created with `status: 'pending'`
5. Player B's logins are tracked
6. After 7 days + 4 logins → Auto-validated via cron
7. Player A receives **progressive rewards + milestone bonuses**
8. Stats updated, badges/titles awarded

### Anti-Abuse Measures

1. **IP Tracking:** Store registration IP, flag same-IP referrals
2. **Email Validation:** Require verified email addresses
3. **Login Requirement:** 4 logins within 7 days proves active player
4. **Admin Flagging:** Manual review of suspicious patterns
5. **VIP Cap:** 30-day hard limit prevents infinite farming
6. **Progressive Cap:** 2.0x maximum prevents exponential growth

---

## 🚀 Setup & Deployment

### 1. Database Setup

Ensure MongoDB indexes for performance:

```javascript
db.referrals.createIndex({ referrerPlayerId: 1 });
db.referrals.createIndex({ newPlayerEmail: 1 });
db.referrals.createIndex({ referralCode: 1 }, { unique: true });
db.referrals.createIndex({ createdAt: 1 });
db.referrals.createIndex({ validated: 1 });
```

### 2. Environment Variables

```bash
MONGODB_URI=mongodb://localhost:27017/darkframe
```

### 3. Cron Job Setup

**Manual Run:**
```bash
npm run validate-referrals
```

**Scheduled (Crontab):**
```bash
# Run daily at 3:00 AM UTC
0 3 * * * cd /path/to/darkframe && npm run validate-referrals >> /var/log/darkframe-cron.log 2>&1
```

**Production (Vercel Cron):**

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/validate-referrals",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Create `app/api/cron/validate-referrals/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { validateReferral } from '@/lib/referralService';
// ... cron logic here
```

### 4. Frontend Integration

Already complete! Features integrated:

- ✅ `/referrals` page (dashboard, leaderboard, guide)
- ✅ `/profile` referral stats section
- ✅ Leaderboard referral column
- ✅ StatsPanel "Invite Friends" button
- ✅ `/admin/referrals` admin panel

---

## 🧪 Testing Guide

### Unit Tests

Test the referral service functions:

```typescript
import { calculateReferralReward, getNextMilestone } from '@/lib/referralService';

// Test progressive scaling
test('Progressive reward scaling', () => {
  const reward1 = calculateReferralReward(1, 1.0, 0);
  expect(reward1.metal).toBe(10500); // 10k × 1.05

  const reward15 = calculateReferralReward(15, 1.0, 0);
  expect(reward15.metal).toBe(20000); // 10k × 2.0 (capped)
});

// Test VIP cap
test('VIP day cap', () => {
  const reward = calculateReferralReward(10, 1.0, 29);
  expect(reward.vipDays).toBe(1); // Can still add 1 more

  const rewardCapped = calculateReferralReward(10, 1.0, 30);
  expect(rewardCapped.vipDays).toBe(0); // Already at cap
});
```

### Integration Tests

Test API endpoints:

```typescript
// Test code generation
const response = await fetch('/api/referral/generate', {
  method: 'POST',
  headers: { 'Cookie': `authToken=${token}` }
});
expect(response.ok).toBe(true);
const data = await response.json();
expect(data.code).toMatch(/^[A-Z0-9]{8}$/);

// Test validation
const validateResponse = await fetch(`/api/referral/validate?code=${data.code}`);
const validateData = await validateResponse.json();
expect(validateData.valid).toBe(true);
```

### Manual Testing Checklist

#### User Flow
- [ ] Generate referral code
- [ ] Copy code to clipboard (success toast)
- [ ] Share via social media buttons
- [ ] View stats dashboard
- [ ] Check milestone progress
- [ ] View leaderboard ranking
- [ ] Read "How It Works" guide
- [ ] Check profile integration

#### Admin Flow
- [ ] Access admin panel (requires `isAdmin: true`)
- [ ] Search for referrals
- [ ] Filter by status
- [ ] View referral details
- [ ] Flag suspicious referral
- [ ] Manually validate referral
- [ ] Invalidate failed referral
- [ ] Verify stats dashboard

#### Registration Flow
- [ ] Register with referral code
- [ ] Receive welcome package
- [ ] Verify referral appears in referrer's pending list
- [ ] Login 4 times over 7 days
- [ ] Verify auto-validation (check after cron runs)
- [ ] Verify rewards distributed to referrer

---

## 🔧 Troubleshooting

### Issue: Referral not validating

**Symptoms:** Referral stuck in "pending" status after 7 days

**Checks:**
1. Verify player has 4+ logins: Check `validationDetails.loginCount` in database
2. Check if flagged: Look for `flagged: true` field
3. Run cron manually: `npm run validate-referrals`
4. Check cron logs: `/var/log/darkframe-cron.log`

**Solution:**
- Admin can manually validate via `/admin/referrals`
- Or update login count and wait for next cron run

### Issue: Rewards not distributed

**Symptoms:** Validation shows as complete but rewards missing

**Checks:**
1. Check `rewardsClaimed` field in referral record
2. Verify `referralRewardsEarned` on referrer's player record
3. Check for errors in cron log

**Solution:**
- Admin manual validation will retry reward distribution
- Check `validateReferral()` function for errors

### Issue: Same IP flagging

**Symptoms:** Legitimate referral flagged as abuse

**Checks:**
1. Check `ipAddress` field on referral record
2. Verify if players are actually different people (shared household, etc.)

**Solution:**
- Admin can unflag via `/admin/referrals`
- Then manually validate if criteria met

### Issue: VIP not extending

**Symptoms:** VIP days awarded but expiration not updating

**Checks:**
1. Check current `vipExpiration` on player record
2. Verify `referralRewardsEarned.vipDays` count
3. Check if VIP cap (30 days) reached

**Solution:**
- VIP cap is intentional at 30 days
- Milestone 50 and 100 give 0 VIP for this reason

---

## 📊 Monitoring & Analytics

### Key Metrics to Track

1. **Conversion Rate:** Registrations with referral code / Total registrations
2. **Validation Rate:** Validated referrals / Total referrals
3. **Fraud Rate:** Flagged referrals / Total referrals
4. **Average Referrals per User:** Total referrals / Active recruiters
5. **Milestone Distribution:** How many players reach each milestone

### Recommended Queries

**Top 10 Recruiters:**
```javascript
db.players.find(
  { validatedReferrals: { $gte: 1 } }
).sort({ validatedReferrals: -1 }).limit(10);
```

**Pending Validations:**
```javascript
db.referrals.count({ validated: false, flagged: { $ne: true } });
```

**Flagged Referrals:**
```javascript
db.referrals.find({ flagged: true });
```

**Validation Success Rate:**
```javascript
db.referrals.aggregate([
  {
    $group: {
      _id: "$validated",
      count: { $sum: 1 }
    }
  }
]);
```

---

## 📈 Future Enhancements

### Potential Improvements

1. **Referral Leaderboard Rewards**
   - Monthly top recruiter bonus (e.g., exclusive unit)
   - Seasonal competitions with special prizes

2. **Advanced Analytics**
   - Player-specific conversion tracking
   - Geographic distribution of referrals
   - Retention rates by referral source

3. **Social Features**
   - Share referral milestones to social media
   - Referral chains visualization (tree view)
   - Referrer-referee bonding system (both get bonus when referee hits milestones)

4. **Dynamic Balancing**
   - Adjust rewards based on server population
   - Seasonal multipliers during growth campaigns
   - A/B testing different reward structures

5. **Enhanced Anti-Abuse**
   - Machine learning fraud detection
   - Device fingerprinting
   - Behavioral analysis (play patterns)

---

## 📝 Changelog

### v1.0 (2025-10-24)
- ✅ Initial release
- ✅ Progressive reward system with 2.0x cap
- ✅ 8 milestone bonuses
- ✅ Welcome package (50k/50k)
- ✅ VIP cap at 30 days
- ✅ RP balanced at 15k total (~0.55% WMD tree)
- ✅ Admin panel with flagging and manual validation
- ✅ Daily auto-validation cron job
- ✅ Complete UI integration (dashboard, leaderboard, profile)
- ✅ Anti-abuse measures (IP tracking, login requirements)

---

## 🆘 Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review [API Endpoints](#api-endpoints) documentation
- Contact development team via Discord/Slack
- Submit bug reports via GitHub Issues

---

**End of Document** 🎁
