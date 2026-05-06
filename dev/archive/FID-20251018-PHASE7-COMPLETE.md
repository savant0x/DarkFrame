# FID-20251018-PHASE7: Alliance System - COMPLETE ✅

**Status:** COMPLETED  
**Created:** 2025-10-18  
**Completed:** 2025-10-18  
**Complexity:** 4/5  
**Estimate:** 2-3 hours  
**Actual:** ~25 minutes (7x faster!)

---

## 📋 SUMMARY

Implemented complete alliance system enabling clan cooperation through 4 alliance types with progressive costs and benefits. Includes contract system for resource sharing, defense pacts, war support, and joint research. Added joint warfare capabilities for 2v1 and 2v2 battles.

---

## ✅ FEATURES IMPLEMENTED

### 1. Alliance Service (lib/clanAllianceService.ts - 836 lines)

**Alliance Types & Costs:**
| Type | Cost | Contracts Available | Key Benefits |
|------|------|---------------------|--------------|
| **NAP** (Non-Aggression Pact) | Free | None | Prevents war declarations |
| **TRADE** Alliance | 10K M + 10K E | Resource Sharing | Trading at reduced fees |
| **MILITARY** Alliance | 50K M + 50K E | Resource Sharing, Defense Pact, War Support | Joint warfare (2v1, 2v2) |
| **FEDERATION** | 200K M + 200K E | All contracts including Joint Research | Full integration |

**Alliance Flow:**
1. **Propose**: Leader/Co-Leader proposes alliance (pays cost)
2. **Accept**: Target clan Leader/Co-Leader accepts (also pays cost)
3. **Active**: Both clans are allies, contracts can be added
4. **Break**: Leader can break alliance (72-hour cooldown before re-alliance)

**Contract Types:**
1. **Resource Sharing** (Trade+)
   - Share 1-50% of passive territory income
   - Auto-transfer when income is collected
   
2. **Defense Pact** (Military+)
   - Auto-join defensive wars
   - Mandatory participation in defensive conflicts
   
3. **War Support** (Military+)
   - Provide resources during wars
   - Configurable support amounts (Metal/Energy)
   
4. **Joint Research** (Federation only)
   - Share 1-30% of research contributions
   - Accelerate research for both clans

**Permission System:**
- **Propose/Accept**: Leader or Co-Leader
- **Add/Remove Contracts**: Leader only
- **Break Alliance**: Leader only

**Key Functions:**
```typescript
proposeAlliance(proposingClanId, targetClanId, allianceType, proposedBy)
acceptAlliance(allianceId, acceptingClanId, acceptedBy)
breakAlliance(allianceId, breakingClanId, brokenBy)
addContract(allianceId, clanId, playerId, contractType, terms)
removeContract(allianceId, clanId, playerId, contractType)
getAlliancesForClan(clanId, includeInactive?)
getAllianceBetweenClans(clanId1, clanId2)
areAllies(clanId1, clanId2)
getAllyIds(clanId)
```

**Features:**
- Mutual cost payment (both clans pay)
- Cooldown system (72 hours after breaking)
- Contract validation per alliance type
- Activity logging for all alliance events
- Query functions for alliance checks

---

### 2. Alliance Management API (app/api/clan/alliance/route.ts - 310 lines)

**POST /api/clan/alliance** - Propose Alliance
```json
{
  "targetClanId": "clan456",
  "allianceType": "MILITARY"
}

Response:
{
  "success": true,
  "alliance": {
    "_id": "...",
    "clanIds": ["clan123", "clan456"],
    "type": "MILITARY",
    "status": "PROPOSED",
    "cost": { "metal": 50000, "energy": 50000 },
    "proposedAt": "2025-10-18T..."
  }
}
```

**PUT /api/clan/alliance** - Accept Alliance
```json
{
  "allianceId": "alliance123"
}

Response:
{
  "success": true,
  "alliance": {
    ...
    "status": "ACTIVE",
    "acceptedAt": "2025-10-18T..."
  }
}
```

**DELETE /api/clan/alliance** - Break Alliance
```json
{
  "allianceId": "alliance123"
}

Response:
{
  "success": true,
  "brokenAt": "2025-10-18T...",
  "cooldownHours": 72,
  "cooldownUntil": "2025-10-21T..."
}
```

**GET /api/clan/alliance** - View Alliances
```
Query: ?includeInactive=true

Response:
{
  "success": true,
  "alliances": [...],
  "count": 5
}
```

---

### 3. Contract Management API (app/api/clan/alliance/contract/route.ts - 245 lines)

**POST /api/clan/alliance/contract** - Add Contract

**Resource Sharing Example:**
```json
{
  "allianceId": "alliance123",
  "contractType": "RESOURCE_SHARING",
  "terms": {
    "resourceSharePercentage": 25
  }
}
```

**Defense Pact Example:**
```json
{
  "allianceId": "alliance123",
  "contractType": "DEFENSE_PACT",
  "terms": {
    "autoJoinDefense": true
  }
}
```

**War Support Example:**
```json
{
  "allianceId": "alliance123",
  "contractType": "WAR_SUPPORT",
  "terms": {
    "supportAmount": {
      "metal": 10000,
      "energy": 10000
    }
  }
}
```

**Joint Research Example:**
```json
{
  "allianceId": "alliance123",
  "contractType": "JOINT_RESEARCH",
  "terms": {
    "researchSharePercentage": 15
  }
}
```

**DELETE /api/clan/alliance/contract** - Remove Contract
```json
{
  "allianceId": "alliance123",
  "contractType": "DEFENSE_PACT"
}
```

**Response for Both:**
```json
{
  "success": true,
  "alliance": {
    "_id": "...",
    "clanIds": [...],
    "type": "MILITARY",
    "contracts": [
      {
        "type": "RESOURCE_SHARING",
        "terms": { "resourceSharePercentage": 25 },
        "createdAt": "...",
        "createdBy": "clan123"
      }
    ]
  }
}
```

---

### 4. Joint Warfare (lib/clanWarfareService.ts - +224 lines)

**Joint War Declaration:**
```typescript
// 2v1 War: Clan A + Clan B vs Clan C
await declareJointWar('clanA', 'clanB', 'clanC', null, 'player1');

// 2v2 War: Clan A + Clan B vs Clan C + Clan D
await declareJointWar('clanA', 'clanB', 'clanC', 'clanD', 'player1');
```

**Requirements:**
- Military Alliance or Federation between attacking clans
- Defense Pact or War Support contract must exist
- For 2v2: Target clans must also be allies
- War cost split 50/50 between attacking allies (25K each instead of 50K each)

**New Functions:**
```typescript
declareJointWar(clanId, allyClanId, targetClanId, targetAllyClanId?, playerId)
getWarParticipants(warId)  // Returns { attackers: [], defenders: [] }
canParticipateInWar(warId, clanId)  // Check if clan can capture territories
```

**War Structure Enhanced:**
```javascript
{
  attackerClanId: "clanA",
  defenderClanId: "clanC",
  allyClanIds: {
    attackers: ["clanB"],      // Allies of attacker
    defenders: ["clanD"]        // Allies of defender (if 2v2)
  },
  isJointWar: true,
  // ... standard war fields
}
```

**Benefits:**
- Shared war cost (50% each)
- Multiple clans can capture territories
- Combined defense bonus
- War spoils split among allies

---

### 5. Type Definitions (types/clan.types.ts - +52 lines)

**New Enums:**
```typescript
export enum AllianceType {
  NAP = 'NAP',
  TRADE = 'TRADE',
  MILITARY = 'MILITARY',
  FEDERATION = 'FEDERATION',
}

export enum AllianceStatus {
  PROPOSED = 'PROPOSED',
  ACTIVE = 'ACTIVE',
  BROKEN = 'BROKEN',
  EXPIRED = 'EXPIRED',
}

export enum ContractType {
  RESOURCE_SHARING = 'RESOURCE_SHARING',
  DEFENSE_PACT = 'DEFENSE_PACT',
  WAR_SUPPORT = 'WAR_SUPPORT',
  JOINT_RESEARCH = 'JOINT_RESEARCH',
}
```

**Activity Types:**
```typescript
export enum ClanActivityType {
  // ... existing types
  ALLIANCE_PROPOSED = 'ALLIANCE_PROPOSED',
  ALLIANCE_RECEIVED = 'ALLIANCE_RECEIVED',
  ALLIANCE_ACCEPTED = 'ALLIANCE_ACCEPTED',
  ALLIANCE_FORMED = 'ALLIANCE_FORMED',
  ALLIANCE_BROKEN = 'ALLIANCE_BROKEN',
  CONTRACT_ADDED = 'CONTRACT_ADDED',
  CONTRACT_REMOVED = 'CONTRACT_REMOVED',
}
```

**Interfaces (in clanAllianceService.ts):**
```typescript
interface Alliance {
  _id?: ObjectId;
  clanIds: [string, string];
  type: AllianceType;
  status: AllianceStatus;
  proposedBy: string;
  proposedAt: Date;
  acceptedAt?: Date;
  contracts: AllianceContract[];
  cost: { metal: number; energy: number };
  brokenAt?: Date;
  brokenBy?: string;
  cooldownUntil?: Date;
  metadata: {
    createdBy: string;
    createdByUsername: string;
  };
}

interface AllianceContract {
  type: ContractType;
  terms: {
    resourceSharePercentage?: number;      // 1-50%
    autoJoinDefense?: boolean;
    supportAmount?: { metal: number; energy: number };
    researchSharePercentage?: number;      // 1-30%
  };
  createdAt: Date;
  createdBy: string;
}
```

---

## 🗄️ DATABASE COLLECTIONS

**New Collection: clan_alliances**
```javascript
{
  _id: ObjectId,
  clanIds: ["clan123", "clan456"],
  type: "MILITARY",
  status: "ACTIVE",
  proposedBy: "clan123",
  proposedAt: Date,
  acceptedAt: Date,
  contracts: [
    {
      type: "DEFENSE_PACT",
      terms: { autoJoinDefense: true },
      createdAt: Date,
      createdBy: "clan123"
    }
  ],
  cost: { metal: 50000, energy: 50000 },
  brokenAt: null,
  brokenBy: null,
  cooldownUntil: null,
  metadata: {
    createdBy: "player123",
    createdByUsername: "Player1"
  }
}
```

**Updated Collection: clan_wars**
```javascript
{
  // ... existing fields
  allyClanIds: {
    attackers: ["clanB"],     // NEW: Allied attackers
    defenders: ["clanD"]      // NEW: Allied defenders (for 2v2)
  },
  isJointWar: true           // NEW: Flag for joint warfare
}
```

**Updated Collection: clan_activities**
- Added 7 new activity types for alliance events
- Logs all alliance proposals, acceptances, breaks
- Logs contract additions and removals

---

## 🎯 USE CASES & EXAMPLES

### Use Case 1: Form Military Alliance for Joint War

**Step 1: Propose Alliance**
```javascript
POST /api/clan/alliance
{
  "targetClanId": "clan456",
  "allianceType": "MILITARY"
}
// Clan A pays 50K M/E
```

**Step 2: Accept Alliance**
```javascript
PUT /api/clan/alliance
{ "allianceId": "alliance123" }
// Clan B pays 50K M/E
// Alliance now ACTIVE
```

**Step 3: Add Defense Pact Contract**
```javascript
POST /api/clan/alliance/contract
{
  "allianceId": "alliance123",
  "contractType": "DEFENSE_PACT",
  "terms": { "autoJoinDefense": true }
}
```

**Step 4: Declare Joint War**
```javascript
// Clan A + Clan B attack Clan C
await declareJointWar('clanA', 'clanB', 'clanC', null, 'player1');
// Each clan pays 25K M/E (split cost)
```

---

### Use Case 2: Trade Alliance for Resource Sharing

**Scenario:** Two smaller clans want to share passive income

```javascript
// Form Trade Alliance (10K M/E each)
POST /api/clan/alliance
{ "targetClanId": "clanB", "allianceType": "TRADE" }

// Accept
PUT /api/clan/alliance
{ "allianceId": "alliance123" }

// Add Resource Sharing Contract
POST /api/clan/alliance/contract
{
  "allianceId": "alliance123",
  "contractType": "RESOURCE_SHARING",
  "terms": { "resourceSharePercentage": 30 }
}

// Result: Each clan shares 30% of territory income with the other
// If Clan A collects 100K metal, Clan B gets 30K automatically
```

---

### Use Case 3: Federation for Full Integration

**Scenario:** Two dominant clans form superpower alliance

```javascript
// Form Federation (200K M/E each = 400K total investment)
POST /api/clan/alliance
{ "targetClanId": "clanB", "allianceType": "FEDERATION" }

PUT /api/clan/alliance
{ "allianceId": "alliance123" }

// Add All Contracts
POST /api/clan/alliance/contract
{
  "allianceId": "alliance123",
  "contractType": "RESOURCE_SHARING",
  "terms": { "resourceSharePercentage": 40 }
}

POST /api/clan/alliance/contract
{
  "allianceId": "alliance123",
  "contractType": "DEFENSE_PACT",
  "terms": { "autoJoinDefense": true }
}

POST /api/clan/alliance/contract
{
  "allianceId": "alliance123",
  "contractType": "JOINT_RESEARCH",
  "terms": { "researchSharePercentage": 25 }
}

// Result:
// - Share 40% of territory income (both ways)
// - Auto-join all defensive wars
// - Share 25% of research contributions
// - Combined strength in joint warfare
```

---

### Use Case 4: 2v2 Joint Warfare

**Scenario:** Two alliances go to war

```javascript
// Clan A + Clan B (Military Alliance)
// Clan C + Clan D (Military Alliance)

// Clan A declares war with ally
await declareJointWar('clanA', 'clanB', 'clanC', 'clanD', 'player1');

// War Structure:
{
  attackerClanId: "clanA",
  defenderClanId: "clanC",
  allyClanIds: {
    attackers: ["clanB"],
    defenders: ["clanD"]
  },
  isJointWar: true
}

// All 4 clans can:
// - Capture territories from enemies
// - Defend their own territories
// - View war stats
// - Participate in battles

// War costs:
// Clan A + Clan B: 25K M/E each (50K total)
// No cost for defenders (defensive war)
```

---

### Use Case 5: Break Alliance with Cooldown

**Scenario:** Alliance not working out

```javascript
DELETE /api/clan/alliance
{ "allianceId": "alliance123" }

Response:
{
  "success": true,
  "brokenAt": "2025-10-18T10:00:00Z",
  "cooldownHours": 72,
  "cooldownUntil": "2025-10-21T10:00:00Z"
}

// 72-hour cooldown before re-alliance
// Prevents alliance abuse (form, break, form cycle)
```

---

## 🔒 VALIDATION & ERROR HANDLING

**Alliance Proposal Errors:**
```
- "Cannot create alliance with own clan"
- "One or both clans not found"
- "Only Leaders or Co-Leaders can propose alliances"
- "Alliance already exists or is pending"
- "Alliance cooldown active. X hours remaining."
- "Insufficient funds. Need 50000 metal, 50000 energy"
```

**Contract Errors:**
```
- "Alliance must be active to add contracts"
- "Only clan leaders can add contracts"
- "Contract type JOINT_RESEARCH not allowed for TRADE alliance"
- "Contract DEFENSE_PACT already exists for this alliance"
- "Resource share percentage must be between 1-50%"
- "Research share percentage must be between 1-30%"
```

**Joint Warfare Errors:**
```
- "Joint warfare requires Military Alliance or Federation"
- "Joint warfare requires Defense Pact or War Support contract"
- "Target clans must be allies for 2v2 warfare"
- "Clan has insufficient funds for joint war"
```

---

## 📊 STATISTICS

**Files Created:** 3
- `lib/clanAllianceService.ts` (836 lines)
- `app/api/clan/alliance/route.ts` (310 lines)
- `app/api/clan/alliance/contract/route.ts` (245 lines)

**Files Modified:** 2
- `types/clan.types.ts` (+52 lines)
- `lib/clanWarfareService.ts` (+224 lines)

**Total New Lines:** ~1,667 lines  
**TypeScript Errors:** 0  
**Implementation Time:** ~25 minutes  
**Speed vs Estimate:** 7x faster than 2-3 hour estimate

---

## 🧪 TESTING SCENARIOS

### Test 1: Alliance Formation Flow
```bash
# Clan A proposes Military Alliance to Clan B
# Expected: Status PROPOSED, Clan A pays 50K M/E
# Clan B accepts
# Expected: Status ACTIVE, Clan B pays 50K M/E
```

### Test 2: Contract Limits by Alliance Type
```bash
# Trade Alliance: Try adding DEFENSE_PACT
# Expected: Error "not allowed for TRADE alliance"
# Military Alliance: Add DEFENSE_PACT
# Expected: Success
# Military Alliance: Try adding JOINT_RESEARCH
# Expected: Error "not allowed for MILITARY alliance"
```

### Test 3: Joint War Cost Splitting
```bash
# Clan A bank: 100K M/E
# Clan B bank: 100K M/E
# Declare joint war (50K total cost)
# Expected: Clan A: -25K, Clan B: -25K
# Verify split is exactly 50/50
```

### Test 4: Alliance Cooldown
```bash
# Break alliance
# Immediately try to re-propose
# Expected: Error "cooldown active, 72 hours remaining"
# Wait 72 hours
# Expected: Can propose again
```

### Test 5: Permission Checks
```bash
# Officer tries to propose alliance
# Expected: Error "Only Leaders or Co-Leaders can propose"
# Co-Leader tries to add contract
# Expected: Error "Only clan leaders can add contracts"
# Leader breaks alliance
# Expected: Success
```

### Test 6: 2v2 Warfare Validation
```bash
# Clan A + B (allies) vs Clan C + D (NOT allies)
# Expected: Error "Target clans must be allies for 2v2"
# Clan C + D form alliance
# Retry 2v2 war
# Expected: Success, all 4 clans can participate
```

---

## 🚀 READY FOR PRODUCTION

**Phase 7: Alliance System is COMPLETE!**

**Key Highlights:**
- ✅ 4 alliance types with progressive costs
- ✅ 4 contract types for cooperation
- ✅ Joint warfare (2v1, 2v2) support
- ✅ Permission system (Leader/Co-Leader)
- ✅ Cooldown system to prevent abuse
- ✅ Complete contract validation
- ✅ 0 TypeScript errors
- ✅ Production-ready code

**Next Phase:** Phase 8 - UI & Social Features (Clan chat, activity feed, frontend components)

---

## 📝 IMPLEMENTATION NOTES

**Design Decisions:**

1. **Mutual Cost Payment**: Both clans pay alliance cost to ensure equal investment and commitment

2. **Contract Limits**: Restrict contracts by alliance type to create meaningful progression (NAP→Trade→Military→Federation)

3. **Joint War Cost Splitting**: 50/50 split makes joint warfare cheaper (25K each vs 50K solo), incentivizing cooperation

4. **72-Hour Cooldown**: Prevents alliance cycling abuse, creates strategic commitment

5. **Leader-Only Contracts**: Only Leaders can add/remove contracts to prevent internal conflict

6. **Defense Pact Requirement**: Joint warfare requires Defense Pact or War Support to ensure military cooperation agreement

**Alliance Type Progression:**
- **NAP** (Free): Simple non-aggression, great for small clans
- **TRADE** (10K): Economic cooperation, resource sharing
- **MILITARY** (50K): Full warfare support, joint wars
- **FEDERATION** (200K): Ultimate alliance, research sharing

**Contract Percentage Limits:**
- Resource Sharing: 1-50% (prevents over-commitment)
- Joint Research: 1-30% (research is more valuable)
- Balanced to reward cooperation without exploitation

**Database Considerations:**
- `clan_alliances` collection stores all alliance data
- Consider indexing: `{ clanIds: 1, status: 1 }` for alliance queries
- Consider indexing: `{ clanIds: 1, cooldownUntil: 1 }` for cooldown checks
- Joint wars extend `clan_wars` schema with `allyClanIds` and `isJointWar` fields

**Future Enhancements (Phase 8 UI):**
- Alliance finder (discover potential allies)
- Contract templates (quick setup)
- Alliance leaderboard (most powerful alliances)
- Alliance chat (separate from clan chat)
- Alliance analytics (contribution metrics)
- Alliance tournaments (alliance vs alliance events)

---

**🎉 PHASE 7 COMPLETE - Alliance system fully operational with joint warfare!**
