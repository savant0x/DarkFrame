# 🚀 Weapons of Mass Destruction (WMD) System - Design Document

**Feature ID:** FID-20251021-WMD  
**Priority:** HIGH (End-game content)  
**Status:** 📋 Design Phase  
**Created:** October 21, 2025

---

## 🎯 **EXECUTIVE SUMMARY**

A sophisticated end-game system introducing **three new strategic dimensions** for high-level players:

1. **🚀 Strategic Missiles** - Offensive superweapons requiring research, assembly, and launch
2. **🛡️ Defense Systems** - Interceptor networks to counter missile threats
3. **🕵️ Intelligence Operations** - Espionage, sabotage, and reconnaissance

**Core Goal:** Redirect high-level player resources into strategic arms race, creating rock-paper-scissors balance and evening the playing field for mid-tier players.

---

## 📊 **STRATEGIC OVERVIEW**

### **Player Specialization Paths**

```
Traditional Builder ──┐
                      ├──> Balanced Clan Strategy
Nuclear Engineer   ───┤
                      │
Intelligence Agent ───┘
```

**Philosophy:** No single path dominates. Each specialization counters another:
- 🚀 **Missiles** destroy traditional armies
- 🕵️ **Spies** sabotage missiles and steal intel
- 🛡️ **Defense** intercepts missiles
- ⚔️ **Traditional Units** overwhelm specialized players

---

## 🚀 **SYSTEM 1: STRATEGIC MISSILE PROGRAM**

### **Concept Refinement**

Instead of generic "mines," we have **Strategic Missile Systems** - precision weapons requiring:
1. **Research** - Unlock nuclear/ballistic technologies
2. **Assembly** - Build missile components over time
3. **Targeting** - Calibrate for specific threats
4. **Launch** - Deploy against qualified targets

### **🏛️ CLAN OWNERSHIP REQUIREMENT**

**CRITICAL CHANGE:** WMD systems are **CLAN-EXCLUSIVE** features.

**Rationale:**
- Prevents solo players from griefing
- Forces clan-level decision making
- Creates clan vs clan arms races
- Encourages diplomacy and alliances

**Requirements to Access WMD:**
- ✅ Must be in a clan (minimum 5 members)
- ✅ Clan must be Level 5+ (established, not brand new)
- ✅ Clan leader must **authorize WMD program** (clan vote)
- ✅ Individual player Level 30+ (personal requirement)

**Clan Authorization Vote:**
```
Clan Leader initiates "WMD Program" proposal
↓
All clan members vote (72h voting period)
↓
Requires 60% approval to pass
↓
If approved: ALL clan members gain WMD research access
If rejected: Locked for 2 weeks, can re-propose
```

**Consequences of Authorization:**
- 🚨 **Global notification:** "[ClanName] has initiated a Weapons of Mass Destruction program!"
- ⚠️ **Clan reputation:** -1,000 reputation (flagged as nuclear power)
- 🎯 **Political target:** Other clans can declare opposition
- 💰 **Economic boost:** +10% Metal/Energy production (war economy)

---

### **📚 Missile Research Tree**

**Tech Tree:** `Nuclear Weapons Program` (separate from main tech tree)

| Tier | Technology | Cost (RP) | Unlocks | Prerequisites |
|------|-----------|-----------|---------|---------------|
| **T1** | Nuclear Fission | 50,000 | Basic Warhead | Player Level 30+ |
| **T2** | Uranium Enrichment | 100,000 | Enhanced Yield | T1 Complete |
| **T3** | Plutonium Refinement | 200,000 | Advanced Warhead | T2 Complete |
| **T4** | Ballistic Guidance | 150,000 | Accuracy +50% | T1 Complete |
| **T5** | MIRV Technology | 250,000 | Multi-target | T3 + T4 Complete |
| **T6** | Hypersonic Delivery | 300,000 | Intercept Evasion +40% | T5 Complete |
| **T7** | EMP Warhead | 200,000 | Disables Defenses | T3 Complete |
| **T8** | Thermonuclear Fusion | 400,000 | Max Damage | T6 Complete |
| **T9** | Stealth Coating | 350,000 | Intercept Evasion +60% | T6 Complete |
| **T10** | Quantum Targeting | 500,000 | Perfect Accuracy | T8 + T9 Complete |

**Total Research Cost:** 2,500,000 RP (full tree)

---

### **🔨 Missile Assembly System**

Each missile consists of **5 critical components** that must be assembled sequentially:

#### **Component Breakdown:**

| Component | Metal Cost | Energy Cost | Build Time | Description |
|-----------|-----------|-------------|------------|-------------|
| 1️⃣ **Plutonium Core** | 500,000 | 250,000 | 12 hours | Fissile material (requires T3 Plutonium Refinement) |
| 2️⃣ **Detonation System** | 200,000 | 400,000 | 8 hours | Precision triggering mechanism |
| 3️⃣ **Guidance Computer** | 150,000 | 500,000 | 6 hours | Navigation and targeting AI |
| 4️⃣ **Ballistic Shell** | 600,000 | 150,000 | 10 hours | Aerodynamic casing with heat shielding |
| 5️⃣ **Propulsion System** | 400,000 | 600,000 | 14 hours | Multi-stage rocket engines |
| **TOTAL** | **1,850,000** | **1,900,000** | **50 hours** | **Complete Strategic Missile** |

**Assembly Rules:**
- ✅ Components must be built **sequentially** (1→2→3→4→5)
- ✅ Each component has **individual build timer** (can't rush)
- ✅ Sabotage can **destroy in-progress components** (resets progress)
- ✅ Completed missiles stored in **Missile Silo** (max 3 silos, 1 missile each)
- ✅ VIP players get **-20% build time** (40 hours total)

---

### **🎯 Targeting & Launch Mechanics**

#### **Target Eligibility Rules**

To prevent griefing newbies, missiles can ONLY target players who meet **ANY** of these criteria:

| Criterion | Threshold | Reasoning |
|-----------|-----------|-----------|
| **Player Level** | Level 40+ | High-level threats only |
| **Military Power** | 100,000+ total strength | Significant army size |
| **Territory Control** | Owns 10+ factories | Economic powerhouse |
| **PvP Activity** | 20+ attacks in last 7 days | Active aggressor |
| **Flag Holder** | Currently holds flag | High-value target |
| **Clan War Status** | Clan is at war | Strategic warfare |

**Smart Calibration System:**
- Missiles are "calibrated" based on YOUR power level
- **Miss Chance Formula:** `Base 10% + ((Target Level - Your Level) × 5%)`
- Example: Level 50 attacks Level 35 → 10% + (50-35)×5% = **85% miss chance**
- Example: Level 45 attacks Level 50 → 10% + (45-50)×5% = **-15% miss = 0% miss**
- **Result:** Nearly impossible to hit significantly weaker players

---

### **💥 Damage Calculation**

#### **Base Damage Formula:**

```typescript
Base Damage = Tech Level × 50,000 + Warhead Type Bonus

Warhead Types:
- Standard (T1-T3): +0 bonus, destroys 20-40% of units
- EMP (T7): +25,000 bonus, disables factories for 48h, destroys 10% units
- Thermonuclear (T8): +100,000 bonus, destroys 50-70% of units
- MIRV (T5): Splits into 3 targets in same clan, 30% damage each
- CLAN BUSTER (T10): +200,000 bonus, damages ENTIRE CLAN (see below)

Final Damage = (Base Damage × Accuracy) - (Interceptor Defense Value)
```

#### **Damage Distribution:**

When missile hits:
1. **70%** → Destroys target's military units (random types)
2. **20%** → Damages factories (random 1-3 factories, reduces production for 24-72h)
3. **10%** → Destroys resources (random % of Metal + Energy)

**Critical Hit (5% chance):** Double all damage percentages

---

### **☢️ CLAN BUSTER WARHEAD (T10 Quantum Targeting)**

**Concept:** Ultimate weapon that damages **ENTIRE CLAN**, not just one player.

**Requirements:**
- ✅ Complete T10 Quantum Targeting research (500,000 RP)
- ✅ Clan vote approval (80% required - very serious)
- ✅ Double resource cost: 3,700,000 Metal + 3,800,000 Energy
- ✅ Double build time: 100 hours
- ✅ Can only target clans with 10+ members

**Damage Distribution:**
```typescript
Total Damage Pool = 1,000,000 (base) + Tech Bonuses

Distribution:
- 50% → Primary Target (chosen player)
- 30% → Top 3 power players in clan (10% each)
- 20% → Random 5 clan members (4% each)

Example with 1,000,000 damage:
- Primary Target: 500,000 damage (destroys ~60% of army)
- Top 3 Players: 100,000 each (destroys ~20% of armies)
- 5 Random Players: 40,000 each (destroys ~8% of armies)
```

**Clan-Wide Effects (All Members):**
- 🏭 **Factory Disruption:** All factories -20% production for 72h
- 💰 **Economic Shock:** All members lose 10% of banked resources
- 🛡️ **Morale Penalty:** All units -10% defense for 48h
- 🚫 **Recruitment Block:** Can't recruit new members for 1 week
- ⚠️ **Reputation Hit:** Clan reputation -5,000 (severe)

**Global Consequences:**
- 🌍 Broadcast to entire server: "☢️ [AttackerClan] has devastated [DefenderClan] with a Clan Buster strike!"
- 📊 Leaderboards updated immediately
- 🎯 Attacker clan flagged as "Nuclear Aggressor" for 2 weeks
- 💀 Defender clan gets "Victim of Nuclear Attack" buff: +20% recovery rate for 1 week

**Launch Restrictions:**
- 📅 7-day cooldown PER CLAN (can't spam multiple clans)
- 💰 50% resource penalty (costs 50% MORE resources on launch)
- 🗳️ Can trigger UN Security Council emergency session
- ⚖️ Automatic war declaration (clans enter official war state)

---

### **📍 Launch UI/UX Flow**

**Location:** New building type - **Missile Command Center**

**UI Panels:**

1. **Research Panel** - Tech tree (similar to existing Research UI)
2. **Assembly Panel** - Component build queue with progress bars
3. **Silo Status** - Shows ready missiles (max 3)
4. **Targeting Panel** - Select target, shows eligibility status
5. **Launch Confirmation** - Final checks, countdown (30 seconds, cancellable)

**Launch Sequence:**
```
Player selects target → System checks eligibility → Shows preview damage range →
Player confirms → 30s countdown → Missile launches → 
Travel time (5 minutes) → Defense interception chance → Impact →
Battle report generated
```

---

## 🛡️ **SYSTEM 2: INTERCEPTOR DEFENSE NETWORK**

### **Concept**

**Iron Dome-style system** that passively protects against incoming missiles.

---

### **📚 Defense Research Tree**

**Tech Tree:** `Missile Defense Program` (separate from WMD tree)

| Tier | Technology | Cost (RP) | Benefit | Prerequisites |
|------|-----------|-----------|---------|---------------|
| **T1** | Early Warning Radar | 60,000 | Detect incoming missiles | Player Level 35+ |
| **T2** | Interceptor Missiles | 120,000 | 20% intercept chance | T1 Complete |
| **T3** | Tracking Systems | 180,000 | 35% intercept chance | T2 Complete |
| **T4** | Multi-Layer Defense | 250,000 | 50% intercept chance | T3 Complete |
| **T5** | Laser Point Defense | 350,000 | 65% intercept chance | T4 Complete |
| **T6** | AI Prediction | 450,000 | 75% intercept chance | T5 Complete |
| **T7** | Quantum Jamming | 400,000 | +10% vs Stealth | T6 Complete |
| **T8** | Railgun Interceptors | 550,000 | 85% intercept chance | T6 Complete |

**Total Research Cost:** 2,360,000 RP

---

### **🏗️ Defense Installation**

**Building:** `Interceptor Battery` (factory terrain converted to defense installation)

| Component | Metal Cost | Energy Cost | Build Time | Effect |
|-----------|-----------|-------------|------------|--------|
| **Radar Array** | 300,000 | 200,000 | 8 hours | Enables detection |
| **Missile Silo (10 interceptors)** | 400,000 | 300,000 | 12 hours | Active defense |
| **Command Bunker** | 200,000 | 150,000 | 6 hours | Coordinates response |
| **Power Generator** | 250,000 | 400,000 | 8 hours | Powers systems |
| **TOTAL (Per Battery)** | **1,150,000** | **1,050,000** | **34 hours** | **Full Defense** |

**Defense Rules:**
- Each battery protects **YOU ONLY** (not clan members)
- Max **2 batteries** per player
- Each battery has **10 interceptor missiles**
- Each incoming missile consumes **1 interceptor** (hit or miss)
- Interceptors **regenerate slowly** (1 per 24 hours, or instant-buy for 50,000 Metal + 50,000 Energy)

---

### **🎲 Interception Calculation**

```typescript
Base Intercept Chance = Defense Tech Level × 10% (max 85%)

Modifiers:
- Attacker has Stealth Coating (T9): -30% intercept chance
- Attacker has Hypersonic (T6): -20% intercept chance
- Defender has Quantum Jamming (T7): +10% vs Stealth
- No interceptors left: 0% intercept chance

Final Roll: Random(0-100) < Modified Intercept Chance → SUCCESS

Success: Missile destroyed, attacker loses missile and resources
Failure: Missile hits, damage calculation proceeds
```

---

## 🕵️ **SYSTEM 3: INTELLIGENCE OPERATIONS**

### **Concept**

**Espionage network** for reconnaissance, sabotage, and counter-intelligence.

---

### **📚 Intelligence Research Tree**

**Tech Tree:** `Intelligence Agency` (separate tree)

| Tier | Technology | Cost (RP) | Unlocks | Prerequisites |
|------|-----------|-----------|---------|---------------|
| **T1** | Basic Espionage | 40,000 | Recruit Spies | Player Level 25+ |
| **T2** | Reconnaissance | 80,000 | View unit counts | T1 Complete |
| **T3** | Counter-Intelligence | 100,000 | Defend vs spies | T1 Complete |
| **T4** | Resource Intel | 120,000 | View resources | T2 Complete |
| **T5** | Sabotage Training | 150,000 | Poison units (-20% power, 12h) | T2 Complete |
| **T6** | Master Spies | 200,000 | Promote to Spymaster | T5 + T3 Complete |
| **T7** | Nuclear Sabotage | 250,000 | Destroy missile components | T6 Complete |
| **T8** | Deep Cover | 300,000 | Can't be detected | T6 Complete |
| **T9** | Double Agent | 350,000 | Feed false intel | T8 + T3 Complete |
| **T10** | Black Ops | 500,000 | Assassinate (temp disable player, 6h) | T9 Complete |

**Total Research Cost:** 2,090,000 RP

---

### **🕵️ Spy Mechanics**

#### **Recruitment:**

| Unit Type | Metal | Energy | Build Time | Power |
|-----------|-------|--------|------------|-------|
| **Spy** | 10,000 | 15,000 | 2 hours | 1 |
| **Spymaster** (T6) | 50,000 | 75,000 | 8 hours | 5 |
| **Black Ops Agent** (T10) | 150,000 | 200,000 | 24 hours | 15 |

**Max Capacity:** 100 spies + 20 spymasters + 5 black ops agents

---

### **🎯 Mission Types**

| Mission | Spy Cost | Success Threshold | Effect on Success | Cooldown |
|---------|----------|-------------------|-------------------|----------|
| **Reconnaissance** | 5 spies | 60% | Reveal units, resources, factories | 6 hours |
| **Poison Supply** | 10 spies | 55% | Target's units -20% power for 12h | 12 hours |
| **Resource Theft** | 15 spies | 50% | Steal 5-10% of target's resources | 24 hours |
| **Sabotage Missile Component** | 20 spies | 45% | Destroy 1 random component (reset to 0%) | 24 hours |
| **Disable Factory** | 10 spies | 50% | Stop production for 8 hours | 12 hours |
| **Assassination** (T10) | 3 black ops | 40% | Target can't play for 6 hours | 72 hours |
| **Nuclear Sabotage** (T7) | 25 spies | 35% | Destroy ALL missile components + research setback | 48 hours |
| **Research Theft** (T6) | 20 spies + 1 spymaster | 40% | Steal 15% of target's WMD research progress | 36 hours |
| **Facility Raid** (T8) | 30 spies + 2 spymasters | 30% | Destroy ready missile + disable silo for 72h | 72 hours |
| **Deep Cover Infiltration** (T9) | 2 black ops | 25% | Corrupt research data (all WMD research -20%) | 96 hours |

---

### **🛡️ Counter-Intelligence**

**Defense:** Recruit **Counter-Intelligence Agents** (same cost as spies)

```typescript
Mission Success Chance = Base Chance × (Attacker Spies / (Attacker Spies + Defender Counter-Intel))

Example:
- Attacker: 20 spies
- Defender: 10 counter-intel agents
- Base: 45% (sabotage missile)
- Modified: 45% × (20 / (20 + 10)) = 45% × 0.667 = 30%

Failure Results:
- Mission fails
- 50% of attacker's spies are caught and killed
- Defender receives notification with attacker's name
```

**Counter-Intelligence Special Actions:**

| Action | Counter-Intel Cost | Effect | Cooldown |
|--------|-------------------|--------|----------|
| **Lockdown Protocol** | 50 agents | All sabotage attempts -50% success for 24h | 48h |
| **Double Agent Operation** | 30 agents + 1 spymaster | Feed false intel (attacker thinks you have no WMD) | 72h |
| **Purge** | 100 agents | Kill ALL enemy spies in your territory (50% success) | 1 week |
| **Mole Hunt** | 20 agents | Reveal identity of spy network owner | 36h |

---

## 🚫 **AGGRESSIVE COUNTER-MEASURES (Stopping WMD Development)**

### **Concept**

**Sabotage must be DEVASTATING** - Give defenders real power to **cripple or destroy** WMD programs.

---

### **💣 Enhanced Sabotage Mechanics**

#### **1. Component Sabotage (Basic)**
- **Effect:** Destroys 1 component in assembly queue
- **Result:** Component resets to 0% progress
- **Resources:** Lost (not refunded)
- **Time:** Lost (must restart component)
- **Example:** Component 4 at 80% → Sabotaged → Back to Component 4 at 0%

#### **2. Nuclear Sabotage (Advanced - T7 Required)**
- **Effect:** CATASTROPHIC damage to WMD program
- **Success Rate:** 35% (low, but devastating)
- **Results:**
  - ❌ Destroys **ALL in-progress components** (entire missile project)
  - ❌ Research setback: Lose **10% of all WMD research progress**
  - ❌ Silo contamination: Can't build missiles for **48 hours**
  - ❌ Resource loss: 50% of spent resources wasted
- **Cost:** 25 spies (expensive, but worth it)
- **Cooldown:** 48 hours

**Example Impact:**
```
BEFORE SABOTAGE:
- Player has spent 1,850,000 Metal + 1,900,000 Energy
- Component 4/5 complete (40 hours invested)
- Research: T8 Thermonuclear Fusion complete

AFTER NUCLEAR SABOTAGE:
- ALL 4 components destroyed
- Must restart from Component 1
- Loses 10% research: T8 → T7.2 (need 80,000 RP to regain)
- 48h lockout before can rebuild
- 925,000 Metal + 950,000 Energy wasted
- Total setback: ~1 week of progress
```

#### **3. Research Theft (T6 Required)**
- **Effect:** Steal enemy's research progress FOR YOURSELF
- **Success Rate:** 40%
- **Results:**
  - Target loses **15% WMD research progress** (all 3 trees)
  - YOU gain **50% of stolen research** (incentivizes offense)
- **Example:** Target has 500,000 RP in Nuclear tree
  - Target loses 75,000 RP → Down to 425,000
  - You gain 37,500 RP in Nuclear tree

**Strategic Value:** Cripple enemy while advancing your own program

#### **4. Facility Raid (T8 Required)**
- **Effect:** Destroy COMPLETED missiles
- **Success Rate:** 30% (very difficult)
- **Results:**
  - Destroys 1 **ready missile** in silo
  - Damages silo: Can't build/store missiles there for **72 hours**
  - Target loses **ALL resources invested** in that missile
  - Target gets -10% accuracy on all missiles for 48h (panic/morale)
- **Strategic Value:** Remove immediate threat before launch

#### **5. Deep Cover Infiltration (T9 Required - Black Ops)**
- **Effect:** Long-term program corruption
- **Success Rate:** 25% (extremely difficult, extremely devastating)
- **Results:**
  - **ALL WMD research reduced by 20%** (across all 3 trees)
  - Ongoing sabotage: **5% research decay per week** for 4 weeks
  - Cannot be detected until too late (no notification)
  - Requires extensive counter-intel purge to remove moles
- **Example Impact:** Player with 2M RP across trees loses 400k immediately, then 100k/week for 4 weeks = 800k total loss

**Counter:** Target must spend 100 counter-intel agents + 72 hours to "Debug Systems" (remove moles)

---

### **⚔️ Military Counter-Measures**

#### **6. Commando Raid (Traditional Units)**
- **Requirement:** Attack Missile Command Center with 50,000+ strength
- **Effect:** If successful in battle:
  - Destroy **1 random component** (if in assembly)
  - Destroy **1 random missile** (if completed)
  - Loot 20% of spent resources
  - Capture territory (if tile undefended)
- **Risk:** Defender gets notification, can defend with units
- **Cooldown:** None (traditional combat rules apply)

#### **7. Preemptive Strike (Missiles vs Missiles)**
- **Concept:** Launch missile at Missile Command Center itself
- **Effect:** If missile hits:
  - Destroys **ALL missiles** in target's silos
  - Destroys **ALL in-progress components**
  - Disables all silos for **1 week**
  - Target loses 50% of WMD research (facility destroyed)
- **Cost:** Uses your own missile (expensive deterrent)
- **Miss Chance:** Normal missile mechanics apply
- **Interception:** Can be intercepted (70%+ with good defense)

**Strategic Balance:** Mutually Assured Destruction - both sides lose if escalation occurs

---

### **🛡️ Defensive Hardening (Counter to Sabotage)**

**New Defense Tier:** `Security Measures` (Intelligence Tree branch)

| Tier | Technology | Cost (RP) | Benefit | Prerequisites |
|------|-----------|-----------|---------|---------------|
| **SEC-1** | Facility Security | 80,000 | Sabotage success -10% | T3 Counter-Intel |
| **SEC-2** | Redundant Systems | 150,000 | Component sabotage only destroys 50% progress | SEC-1 |
| **SEC-3** | Encrypted Research | 200,000 | Research theft steals 50% less | SEC-1 |
| **SEC-4** | Bunker Architecture | 250,000 | Nuclear Sabotage can't destroy all components (max 3) | SEC-2 |
| **SEC-5** | AI Security Protocols | 350,000 | Deep Cover Infiltration -10% success | SEC-3 + SEC-4 |
| **SEC-6** | Quantum Encryption | 500,000 | All sabotage attempts -20% success | SEC-5 |

**Total Cost:** 1,530,000 RP (expensive, but protects 2.5M RP investment in WMD)

**With Max Security:**
- Nuclear Sabotage: 35% → 15% success, only destroys 3 components max
- Research Theft: Steals 7.5% instead of 15%
- Deep Cover: 25% → 15% success
- Component Sabotage: Only destroys 50% of component progress

**Trade-off:** Invest in security OR faster WMD development, not both

---

### **⚖️ Deterrence Balance**

**Offensive Investment (To Build 1 Missile):**
- 1,850,000 Metal + 1,900,000 Energy
- 2,500,000 RP research
- 50 hours build time
- **TOTAL: ~5M value**

**Defensive Counter-Investment (To Stop It):**
- 25 spies × (10k Metal + 15k Energy) = 625k resources
- 2,090,000 RP research (Intelligence tree to T7)
- 35% success rate for Nuclear Sabotage
- **TOTAL: ~2.7M value with 35% success = ~7.7M expected cost**

**Analysis:** Offense is cheaper than defense, BUT:
- One successful sabotage = weeks of setback
- Multiple sabotage attempts likely (attacker paranoia)
- Defender can combine: Spies + Military raids + Preemptive strikes
- **Result:** Building WMD attracts proportional response

---

### **🎯 Counter-Measure Strategy Guide**

**Early Detection (Level 25-30):**
1. Research Intelligence T1-T2
2. Recruit 20+ spies
3. Run WMD Reconnaissance every 48h on threats
4. Build 30+ counter-intel agents for defense

**Active Sabotage (Level 35-40):**
1. Complete Intelligence T7 (Nuclear Sabotage unlock)
2. Identify targets with leaks (Component 3+ detected)
3. Launch Nuclear Sabotage (35% success)
4. If fail, follow up with Component Sabotage (45% success)
5. Repeat every 48h until target abandons program

**Clan Coordination (Level 40+):**
1. 3+ clan members research Intelligence T7
2. Coordinate sabotage waves (3 attempts in 24h = 75% chance of success)
3. Commando raid backup (50k units attack Missile Command)
4. Preemptive strike if target reaches Component 5/5

**Expected Result:** Target faces:
- 3 sabotage attempts per day (probability of at least 1 success = ~75%)
- Constant military pressure
- Resource drain defending
- **Decision:** Abandon WMD or go bankrupt trying

---

## ⚖️ **GAME BALANCE CONSIDERATIONS**

### **Resource Sink Analysis**

**Problem:** High-level players hoard resources, dominate through sheer numbers.

**Solution:** WMD systems redirect resources into expensive, specialized builds.

#### **Cost Comparison (Full Systems):**

| System | Metal | Energy | Time | RP Cost |
|--------|-------|--------|------|---------|
| **Missile Program** (1 missile) | 1,850,000 | 1,900,000 | 50h | 2,500,000 |
| **Defense System** (2 batteries) | 2,300,000 | 2,100,000 | 68h | 2,360,000 |
| **Intelligence** (full network) | 1,500,000 | 2,000,000 | 120h | 2,090,000 |
| **Traditional Army** (5000 T4 units) | 2,500,000 | 2,500,000 | 100h | 0 |

**Observation:** WMD systems are comparable in cost to traditional armies but offer strategic advantages.

---

### **Newbie Protection**

**Multi-Layered Protection:**

1. **Level Gating:** Can't research WMD until Level 30+
2. **Target Filtering:** Can't target players below threshold
3. **Miss Chance Scaling:** 85%+ miss rate vs significantly weaker players
4. **Clan Protection:** Can't attack clan members (prevents internal abuse)
5. **Cooldown Periods:** 7-day cooldown after launching missile
6. **Cost Deterrent:** Losing missile + resources on intercept

---

### **Clan Warfare Integration**

**Specialization Roles:**

```
Clan War Strategy:

Traditional Builders (60%) ──> Frontline offense/defense
Nuclear Engineers (20%)   ──> Strategic strikes on enemy strongholds
Intelligence Agents (20%) ──> Intel gathering, sabotage, counter-ops
```

**Clan Missions:**
- **Nuclear Retaliation:** Launch coordinated missile strikes (3+ missiles in 1 hour window)
- **Intel Blackout:** Mass sabotage to disable enemy missile programs
- **Total Defense:** Pool resources to build clan-wide interceptor network

**Clan War Mechanics:**
- Missiles/spies can target enemy clan members freely
- Clan rankings include "Nuclear Capability" and "Intelligence Power"

---

### **🛡️ CLAN-WIDE DEFENSE SYSTEMS**

**Concept:** Clans can pool resources to build **shared defense networks** that protect ALL members.

**Clan Defense Building:** `Collective Defense Grid`

**Construction Requirements:**
- 🏗️ Clan Leader initiates construction
- 💰 **Pooled Resources:** All members can donate (goal: 10M Metal + 10M Energy)
- ⏱️ **Build Time:** 7 days (cannot be rushed)
- 👥 **Minimum Participation:** 70% of clan members must contribute
- 📊 **Contribution Tracking:** Shows who donated what (encourages fairness)

**Defense Grid Benefits (When Active):**
```
ALL CLAN MEMBERS GAIN:
- 🛡️ +15% base missile interception chance
- 📡 Early warning system (5-minute alert before missile impact)
- 🔄 Shared interceptor pool (200 interceptors for entire clan)
- 🚫 Clan Buster damage reduced by 30%
- 💪 Morale boost: All units +5% defense during war
```

**Grid Maintenance:**
- 💰 **Upkeep Cost:** 500k Metal + 500k Energy per week
- ⚠️ **If upkeep unpaid:** Grid deactivates after 48h grace period
- 🔧 **Repair Required:** If hit by Clan Buster, costs 3M Metal + 3M Energy to repair

**Strategic Depth:**
- Clans must decide: Invest in offense (missiles) OR defense (grid)
- Grid maintenance requires active, coordinated clan participation
- Grid can be **sabotaged** by spies (see Intelligence section)

---

### **⚔️ CLAN COUNTER-OFFENSIVE OPTIONS**

**When Clan B detects Clan A building WMD, Clan B can:**

#### **1. Diplomatic Opposition**
```
Clan Leader declares "Opposition to [Clan A] WMD Program"
↓
Global notification: "[Clan B] opposes [Clan A]'s nuclear program!"
↓
Effects:
- Enables all Clan B members to sabotage Clan A WMD projects (no war declaration needed)
- Other clans can join opposition (coalition building)
- +500 reputation for Clan B (peacekeeper status)
- -500 reputation for Clan A (aggressor status)
```

#### **2. Coordinated Sabotage Campaign**
```
Clan Strategy: "Operation Shutdown"

Phase 1: Intelligence Gathering (Week 1)
- All members with T2+ Intelligence run WMD Reconnaissance
- Goal: Identify which Clan A members are building missiles

Phase 2: Sabotage Waves (Week 2-4)
- 5+ members launch Nuclear Sabotage missions daily
- Target: Destroy all in-progress missile components
- Expected result: 75-90% chance of at least 1 success per day

Phase 3: Military Pressure (Ongoing)
- Commando raids on Missile Command Centers
- Factory attacks to drain Clan A resources
- Maintain constant pressure until program abandoned
```

#### **3. Arms Race Response**
```
Clan B Decision: "Counter-Program"

Action: Initiate own WMD program
Goal: Build faster than Clan A, launch first
Strategy: All-in resource commitment

Timeline:
- Week 1-4: Rush research (split RP across 10 members)
- Week 5-6: 3 members build missiles simultaneously
- Week 7: Launch preemptive strikes on Clan A's silos

Risk: Expensive, both clans drain resources
Reward: First strike advantage
```

#### **4. Coalition Building**
```
Clan B Action: "Form Anti-Nuclear Coalition"

Step 1: Diplomatic outreach to 5+ neutral clans
Step 2: Propose UN Resolution: "Arms Embargo on [Clan A]"
Step 3: If passed (majority vote):
  - Clan A can't research WMD for 1 week
  - All coalition members can attack Clan A without reputation loss
  - Economic sanctions: Clan A factories -30% production

Strategic Value: Turn entire server against aggressor
```

#### **5. Clan Buster Deterrence**
```
Clan B Message: "Mutual Assured Destruction Pact"

Declaration: "If you launch Clan Buster at us, we launch back"

Requirements:
- Clan B must ALSO have T10 Quantum Targeting research
- Clan B must have ready Clan Buster missile
- Public announcement (creates Cold War standoff)

Effect:
- Both clans hesitate to launch (lose-lose scenario)
- Encourages diplomacy over war
- Creates tense political situation
```

---

## 🎨 **UI/UX DESIGN**

### **New Buildings**

1. **🚀 Missile Command Center**
   - Terrain Type: New special terrain (like Bank/Shrine)
   - Location: Random spawns on map (3-5 total)
   - Functionality: Access WMD research, assembly, launch

2. **🛡️ Interceptor Battery**
   - Built on owned Factory tiles
   - Converts factory → defense installation (irreversible)
   - Visual: Radar dishes + missile silos

3. **🕵️ Intelligence Agency**
   - New building at player base (Shrine-like single location)
   - Location: (1, 75) - opposite corner from Shrine
   - Functionality: Spy recruitment, mission planning

---

### **New UI Panels**

#### **1. WMD Research Panel**
```
├─ Nuclear Weapons [Tab]
│  ├─ Tech Tree (10 nodes)
│  └─ Total Progress: X / 2,500,000 RP
├─ Missile Defense [Tab]
│  ├─ Tech Tree (8 nodes)
│  └─ Total Progress: X / 2,360,000 RP
└─ Intelligence [Tab]
   ├─ Tech Tree (10 nodes)
   └─ Total Progress: X / 2,090,000 RP
```

#### **2. Missile Assembly Panel**
```
Current Project: Strategic Missile #1

[====------] Component 1: Plutonium Core (60% - 5h remaining)
[----------] Component 2: Detonation System (Locked)
[----------] Component 3: Guidance Computer (Locked)
[----------] Component 4: Ballistic Shell (Locked)
[----------] Component 5: Propulsion System (Locked)

Resources Required (Component 2):
Metal: 200,000 | Energy: 400,000

[Cancel Build] [Speed Up (VIP)]
```

#### **3. Launch Control Panel**
```
╔═══════════════════════════════════════╗
║  🚀 MISSILE SILO STATUS               ║
╠═══════════════════════════════════════╣
║  Silo 1: [Ready] Thermonuclear        ║
║  Silo 2: [Assembly - 12h] Standard    ║
║  Silo 3: [Empty]                      ║
╚═══════════════════════════════════════╝

╔═══════════════════════════════════════╗
║  🎯 TARGET SELECTION                  ║
╠═══════════════════════════════════════╣
║  Player: [Search...]                  ║
║  Status: ⚠️ Target too weak (85% miss)║
║  Estimated Damage: 20,000 - 50,000    ║
║  Interception Risk: 65%               ║
╚═══════════════════════════════════════╝

[SELECT TARGET] [LAUNCH MISSILE]
```

#### **4. Intelligence Operations Panel**
```
╔══════════════════════════════════════╗
║  👥 AGENT ROSTER                     ║
╠══════════════════════════════════════╣
║  Spies: 45 / 100                     ║
║  Spymasters: 8 / 20                  ║
║  Black Ops: 2 / 5                    ║
║  Counter-Intel: 30 / 100             ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════╗
║  📋 ACTIVE MISSIONS                  ║
╠══════════════════════════════════════╣
║  Reconnaissance on PlayerX (4h left) ║
║  Sabotage vs PlayerY (FAILED)        ║
╚══════════════════════════════════════╝

[NEW MISSION] [RECRUIT AGENTS]
```

---

## 📈 **PROGRESSION TIMELINE**

### **Typical Player Journey:**

**Level 30-35:** Unlock WMD research, begin Intelligence tree (cheapest)  
**Level 35-40:** Complete basic spy network, start Missile research  
**Level 40-45:** Build first missile, establish defense (1 battery)  
**Level 45-50:** Specialize - choose Nuclear, Defense, or Intelligence focus  
**Level 50+:** Max out chosen specialization, support clan warfare

**Estimated Time to First Missile:** 
- Research: ~4-6 weeks (casual play, 6,000 RP/day)
- Assembly: 50 hours build time
- **Total: 1-2 months** of dedicated effort

---

## 🔄 **INTEGRATION WITH EXISTING SYSTEMS**

### **Tech Tree Integration**

**Prerequisite:** Must complete **Tier 3** of main Tech Tree before accessing WMD trees.

**Reason:** Ensures player has solid foundation before pursuing end-game content.

---

### **Factory System Integration**

**Missile Command Centers:**
- New terrain type (like Bank/Shrine)
- Capturable via factory attack mechanics
- Controlling Missile Command grants +10% missile accuracy

**Interceptor Batteries:**
- Built on owned factories
- Sacrifice production for defense
- Can be destroyed by traditional attacks

---

### **Clan System Integration**

**Clan Bonuses:**
- **Nuclear Arsenal:** +5% missile damage per clan member with T8+
- **Intelligence Network:** Share spy intel across clan
- **Total Defense:** Clan leader can activate emergency intercept boost (+15% for 24h)

**Clan War Mechanics:**
- Missiles/spies can target enemy clan members freely
- Clan rankings include "Nuclear Capability" and "Intelligence Power"

---

### **Flag System Integration**

**Flag Bearer Vulnerability:**
- Flag bearer is **ALWAYS** valid target (regardless of level)
- Holding flag attracts WMD attacks
- Flag bearer gets +1 free interceptor battery while holding

---

### **Economy Integration**

**Auto-Farm Impact:**
- WMD research consumes RP (alternative RP sink to Flag Tier 4)
- Balances economy by giving players choice: traditional progression vs WMD power

**VIP Benefits:**
- -20% build times (missiles, batteries, spies)
- +10% spy mission success rate
- 1 extra silo slot (4 total instead of 3)

---

## � **GLOBAL INTELLIGENCE & NOTIFICATION SYSTEM**

### **Concept**

**Strategic transparency through espionage** - Players can't hide WMD programs forever. Intelligence leaks create political tension and preemptive opportunities.

---

### **🌍 Automatic Global Notifications**

**Triggered Events** (broadcast to ALL players):

| Event | Trigger | Notification | Visibility |
|-------|---------|--------------|------------|
| **🚀 First Nuclear Test** | Player completes first T3+ missile | "�🚨 [PlayerName] has successfully tested a nuclear weapon!" | Global |
| **🏗️ Missile Launch Detected** | Any missile launches | "⚠️ [PlayerName] has launched a strategic missile at [TargetName]!" | Global |
| **💥 Nuclear Strike Success** | Missile hits target | "☢️ [PlayerName]'s missile devastated [TargetName]'s forces!" | Global |
| **🛡️ Successful Interception** | Defense system destroys missile | "🎯 [TargetName] intercepted [PlayerName]'s missile attack!" | Global |
| **🏛️ Arms Race Milestone** | Player maxes any WMD tree | "⚡ [PlayerName] has achieved [Nuclear/Defense/Intelligence] supremacy!" | Global |

**UI Implementation:**
- Toast notification (top-right corner, 10s display)
- Archive in **Global News Feed** panel (accessible from main menu)
- Clickable → View player profile

---

### **🕵️ Intelligence Leak System**

**Concept:** Spies can uncover WMD programs before they're ready, giving advance warning.

#### **Leak Triggers (Probabilistic):**

| WMD Activity | Base Leak Chance | Spy Boost | Effect |
|--------------|------------------|-----------|--------|
| **Research in Progress** | 5% per week | +10% per enemy spy | "🔍 Intel suggests [PlayerName] is researching WMD technology" |
| **Component Assembly** | 10% per component | +15% per enemy spy | "⚠️ [PlayerName] is assembling a strategic missile (Component X/5)" |
| **Missile Ready** | 25% daily | +20% per enemy spy | "🚨 [PlayerName] has a fully armed missile in Silo X!" |
| **Defense Installation** | 15% on completion | +10% per enemy spy | "🛡️ [PlayerName] has constructed an Interceptor Battery" |
| **Spy Network Expansion** | 8% per 20 spies | +5% per counter-intel failure | "👥 [PlayerName] is building a large espionage network" |

**Leak Recipients:**
- **Clan Members:** Always notified (100% chance)
- **Allied Clans:** 50% chance
- **Neutral Players:** Base chance only
- **Enemy Clans:** Base + Spy Boost chance

---

### **📊 Intelligence Dashboard**

**New UI Panel:** `Global Intelligence Center`

**Location:** Accessible from main menu or Intelligence Agency building

#### **Panel Sections:**

**1. WMD Threat Assessment**
```
╔════════════════════════════════════════╗
║  ☢️ NUCLEAR THREAT LEVEL: MODERATE    ║
╠════════════════════════════════════════╣
║  Known Nuclear Powers:                 ║
║  • PlayerA (3 missiles ready)          ║
║  • PlayerB (1 missile, T8 tech)        ║
║                                        ║
║  Under Construction (Intel):           ║
║  • PlayerC (Component 3/5)             ║
║  • PlayerD (Research: T5)              ║
╚════════════════════════════════════════╝
```

**2. Defense Network Status**
```
╔════════════════════════════════════════╗
║  🛡️ KNOWN INTERCEPTOR NETWORKS        ║
╠════════════════════════════════════════╣
║  • PlayerA: 2 batteries (85% intercept)║
║  • PlayerE: 1 battery (50% intercept)  ║
║  • YOU: 0 batteries (VULNERABLE)       ║
╚════════════════════════════════════════╝
```

**3. Espionage Activity**
```
╔════════════════════════════════════════╗
║  🕵️ INTELLIGENCE OPERATIONS            ║
╠════════════════════════════════════════╣
║  Active Threats:                       ║
║  • PlayerF: 50 spies (Counter: 10)     ║
║  • PlayerG: 30 spies (Counter: 25)     ║
║                                        ║
║  Your Network:                         ║
║  • Spies: 45 | Counter-Intel: 30       ║
╚════════════════════════════════════════╝
```

**4. Recent Intelligence Reports**
```
╔════════════════════════════════════════╗
║  📰 INTEL BRIEFING (Last 24h)         ║
╠════════════════════════════════════════╣
║  [2h ago] PlayerC assembly detected    ║
║  [5h ago] PlayerA launched at PlayerB  ║
║  [8h ago] PlayerD research leak (T6)   ║
║  [12h ago] You were spied on by PlayerF║
╚════════════════════════════════════════╝
```

---

### **🎯 Spy Mission: Intelligence Gathering**

**New Mission Type:** `WMD Reconnaissance`

| Mission | Spy Cost | Success Rate | Intel Revealed | Cooldown |
|---------|----------|--------------|----------------|----------|
| **Basic Recon** | 5 spies | 65% | Current research tier only | 12h |
| **Deep Dive** | 15 spies | 50% | Research + assembly progress | 24h |
| **Silo Surveillance** | 20 spies | 40% | Ready missiles + locations | 48h |
| **Defense Analysis** | 10 spies | 55% | Interceptor count + specs | 24h |
| **Full Profile** | 30 spies + 2 spymasters | 30% | Complete WMD status | 72h |

**Success Result:**
- Detailed report in Intelligence Dashboard
- Update threat assessment for target player
- Leak notification sent to your clan

**Critical Success (10% chance):**
- Steal research data: Gain 10% of target's RP spent on WMD research
- Sabotage bonus: Can follow-up with sabotage mission at +20% success rate

---

### **⚠️ Notification Opt-Out (For Victims)**

**Problem:** Getting constantly notified is annoying.

**Solution:** Players can **suppress specific notification types** in settings:

**Settings Panel:**
```
╔════════════════════════════════════════╗
║  🔔 WMD NOTIFICATION PREFERENCES       ║
╠════════════════════════════════════════╣
║  [✓] Global missile launches           ║
║  [✓] Nuclear strikes (success/fail)    ║
║  [✓] Arms race milestones              ║
║  [✓] Your intel leaks (cannot disable) ║
║  [ ] Other players' research           ║
║  [ ] Enemy clan WMD activity           ║
╚════════════════════════════════════════╝
```

**Cannot Disable:**
- Leaks about YOUR OWN programs (security alerts)
- Direct attacks against YOU (missile incoming)
- Spy missions targeting YOU (counter-intel alerts)

---

### **🌐 Political Pressure System**

**Concept:** Global community reacts to nuclear proliferation.

#### **Reputation Impact:**

| Action | Reputation Change | Effect |
|--------|-------------------|--------|
| **First Missile Built** | -500 reputation | "Nuclear Pariah" |
| **Missile Launch** | -1,000 reputation | "Warmonger" |
| **Nuclear Strike Kills 50%+ units** | -2,000 reputation | "War Criminal" |
| **Intercept Enemy Missile** | +500 reputation | "Defender" |
| **Sabotage Enemy WMD** | +300 reputation | "Peacekeeper" |
| **Max Defense Tree** | +200 reputation | "Guardian" |

**Reputation Effects:**
- **Negative Reputation:**
  - Other players get +10% damage vs you in combat
  - Can't join clans with positive reputation
  - Higher chance of being targeted by spies
  - Bounty Board automatically lists you
  
- **Positive Reputation:**
  - Reduced spy mission success vs you (+10% counter-intel)
  - Can call for "UN Sanctions" vote against attackers
  - Access to "Peace Treaty" mechanic (mutual non-aggression)

---

### **🗳️ UN Security Council (Clan-Level)**

**Concept:** Clan leaders can propose **resolutions** against WMD proliferation.

**Resolution Types:**

| Resolution | Requirement | Effect | Duration |
|-----------|-------------|--------|----------|
| **Arms Embargo** | 3 clans vote yes | Target can't research WMD | 72 hours |
| **Sanctions** | 5 clans vote yes | Target's Metal/Energy production -30% | 48 hours |
| **Peacekeeping Force** | 7 clans vote yes | All voters can attack target without reputation loss | 96 hours |
| **Nuclear Non-Proliferation** | 10 clans vote yes | Global: WMD research cost +50% RP | 1 week |

**Voting Mechanics:**
- Clan leaders vote once per resolution
- Voting period: 24 hours
- Abstain = default vote
- Veto Power: Top 3 clans by power can veto any resolution

**Counter-Strategy:**
- Spies can **bribe voters** (spend resources to flip votes)
- Missiles can **intimidate voters** (threaten retaliation)

---

## 🚨 **ANTI-GRIEFING MEASURES**

1. **Cooldown Enforcement:** 7-day cooldown between launches (per target)
2. **Resource Penalty:** Launching missile costs 50% of build cost again (can't spam)
3. **Revenge Window:** Victim gets 48h "revenge launch" window (can target attacker regardless of level)
4. **Reputation System:** Excessive attacking lowers reputation → higher miss chance
5. **Admin Override:** Admins can disable WMD for specific players (abuse prevention)
6. **Intelligence Transparency:** Leaks prevent surprise first strikes on unprepared players
7. **Global Notifications:** Community awareness discourages bullying behavior

---

## 📊 **SUCCESS METRICS**

**Track These KPIs:**

1. **Adoption Rate:** % of Level 30+ players researching WMD
2. **Resource Diversion:** % of high-level resources spent on WMD vs traditional
3. **Balance Indicator:** Win rate distribution (should stabilize across levels)
4. **Engagement:** Daily logins increase as players check missile status
5. **Clan Activity:** Clan wars increase due to strategic depth

**Target Goals:**
- 40% adoption rate among eligible players (Level 30+)
- 30% of high-level resources diverted to WMD systems
- Win rate variance reduces by 20%

---

## 🛠️ **IMPLEMENTATION PHASES**

### **Phase 1: Foundation (2-3 weeks)**
- ✅ Create new terrain types (Missile Command, Defense Battery)
- ✅ Build database schemas (missiles, components, spies, missions)
- ✅ Design UI mockups (all 4 new panels)
- ✅ Create tech tree JSON configs

### **Phase 2: Research System (2 weeks)**
- ✅ Implement WMD research trees (3 separate trees)
- ✅ Add RP costs and unlock logic
- ✅ Build Research UI panel

### **Phase 3: Missile System (3 weeks)**
- ✅ Assembly mechanics (component queue, timers)
- ✅ Targeting logic (eligibility checks, miss chance)
- ✅ Damage calculation engine
- ✅ Launch UI + battle reports

### **Phase 4: Defense System (2 weeks)**
- ✅ Interceptor battery building
- ✅ Interception calculation
- ✅ Defense UI

### **Phase 5: Intelligence System (2 weeks)**
- ✅ Spy recruitment mechanics
- ✅ Mission success/failure logic
- ✅ Counter-intelligence
- ✅ Spy UI

### **Phase 6: Integration & Balance (2 weeks)**
- ✅ Clan warfare integration
- ✅ Flag system integration
- ✅ Anti-griefing measures
- ✅ Extensive balance testing

### **Phase 7: Polish & Launch (1 week)**
- ✅ Battle reports, notifications
- ✅ Achievements (e.g., "Nuclear Engineer", "Master Spy")
- ✅ Documentation, tutorial
- ✅ Beta test with select players

**Total Timeline: 14-16 weeks**

---

## 💡 **FUTURE EXPANSION IDEAS**

1. **Biological Weapons:** Spread plague to enemy factories (tick damage over time)
2. **Cyber Warfare:** Hack factories to steal production or redirect units
3. **Space Weapons:** Orbital platforms for global strikes (require multiple players to build)
4. **Dirty Bombs:** Cheaper missiles with lower damage but irradiate tile (unusable for 48h)
5. **Decoy Missiles:** Launch fake missiles to bait interceptors

---

## 📝 **NARRATIVE FLAVOR**

**Lore Integration:**

> "As commanders ascended to unprecedented power, conventional warfare proved insufficient. The Great Clans turned to forbidden sciences—nuclear physics, bioengineering, shadow operations. The Strategic Arms Initiative began not as an act of aggression, but of deterrence. Yet deterrence requires capability, and capability breeds ambition. Today, the wasteland trembles not only beneath marching armies, but beneath the shadow of annihilation itself."

**Achievement Names:**
- 🏆 "Oppenheimer's Heir" - Launch first missile
- 🏆 "Iron Dome" - Intercept 10 missiles
- 🏆 "Master of Shadows" - Complete 100 spy missions
- 🏆 "Nuclear Triad" - Max all three WMD trees
- 🏆 "Mutually Assured Destruction" - Launch and receive missile same day

---

## ✅ **APPROVAL CHECKLIST**

Before proceeding to implementation:

- [ ] **Balance Review:** Confirm costs don't break economy
- [ ] **UI/UX Design:** Mockups approved by design lead
- [ ] **Database Schema:** Reviewed by backend team
- [ ] **Anti-Griefing:** Measures vetted by community manager
- [ ] **Timeline:** Engineering estimates confirmed
- [ ] **Feature Flag:** Can be disabled if issues arise post-launch
- [ ] **Beta Plan:** Select 50 high-level players for closed beta

---

## 🎯 **NEXT STEPS**

1. **Review this document** with stakeholders
2. **Refine balance numbers** based on current economy data
3. **Create UI mockups** for all 4 panels
4. **Break into user stories** for sprint planning
5. **Schedule kickoff meeting** with dev team

---

**Status:** 📋 **Awaiting Approval**  
**Estimated Effort:** 14-16 weeks (full team)  
**Dependencies:** None (standalone feature)  
**Risk Level:** Medium (complex systems, requires extensive balance testing)

---

**Document Version:** 1.0  
**Last Updated:** October 21, 2025  
**Author:** Development Team  
**Next Review:** Pending stakeholder feedback
