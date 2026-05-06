# 🚀 WMD System - ECHO-Compliant Implementation Plan

**Feature ID:** FID-20251021-WMD-PLANNING  
**Priority:** HIGH (End-game content)  
**Status:** 📋 Planning Phase  
**Created:** October 21, 2025  
**Estimated Timeline:** 14-16 weeks  
**Complexity:** 5 (Very High)

---

## 🎯 **EXECUTIVE SUMMARY**

**Objective:** Implement comprehensive Weapons of Mass Destruction (WMD) system as clan-exclusive end-game content featuring three interconnected systems: Strategic Missiles, Defense Networks, and Intelligence Operations.

**Approach:**
1. **7-Phase Implementation** - Sequential builds with clear milestones
2. **Database-First Design** - Schema complete before any features
3. **Type-Safe Development** - TypeScript types for all data structures
4. **ECHO Compliance** - Full documentation, error handling, testing
5. **Modular Architecture** - Reusable components and services

**Key Constraints:**
- ✅ Clan-exclusive feature (no solo access)
- ✅ Level-gated access (Level 30+ minimum)
- ✅ Must not break existing economy
- ✅ Comprehensive anti-griefing measures
- ✅ Mobile + desktop optimization

---

## 📂 **FILE STRUCTURE OVERVIEW**

### **Complete File Inventory (84 files)**

```
/types/
├── wmd/
│   ├── missile.types.ts          [NEW] Missile, component, warhead types
│   ├── defense.types.ts          [NEW] Interceptor, battery, defense grid types
│   ├── intelligence.types.ts     [NEW] Spy, mission, intel types
│   ├── research.types.ts         [NEW] Tech tree, node, progress types
│   ├── notification.types.ts     [NEW] Global alerts, leaks, intel reports
│   └── index.ts                  [NEW] Barrel export for all WMD types

/lib/
├── wmd/
│   ├── missileService.ts         [NEW] Assembly, targeting, damage calculations
│   ├── defenseService.ts         [NEW] Interception, battery management
│   ├── spyService.ts             [NEW] Mission execution, success calculations
│   ├── researchService.ts        [NEW] Tech tree logic, unlocks, prerequisites
│   ├── notificationService.ts    [NEW] Global broadcasts, leak detection
│   ├── damageCalculator.ts       [NEW] Damage formulas, distribution logic
│   ├── targetingValidator.ts     [NEW] Eligibility checks, miss chance calculations
│   ├── sabotageEngine.ts         [NEW] Component destruction, research theft
│   └── index.ts                  [NEW] Barrel export for all services

/components/
├── wmd/
│   ├── MissileResearchPanel.tsx       [NEW] Nuclear weapons tech tree UI
│   ├── DefenseResearchPanel.tsx       [NEW] Defense systems tech tree UI
│   ├── IntelligenceResearchPanel.tsx  [NEW] Spy operations tech tree UI
│   ├── MissileAssemblyPanel.tsx       [NEW] Component build queue UI
│   ├── LaunchControlPanel.tsx         [NEW] Targeting, launch confirmation UI
│   ├── DefenseBatteryPanel.tsx        [NEW] Interceptor management UI
│   ├── DefenseGridPanel.tsx           [NEW] Clan-wide defense system UI
│   ├── SpyRecruitmentPanel.tsx        [NEW] Agent recruitment UI
│   ├── MissionControlPanel.tsx        [NEW] Spy mission planning UI
│   ├── IntelligenceDashboard.tsx      [NEW] Threat assessment, reports UI
│   ├── GlobalIntelPanel.tsx           [NEW] Server-wide WMD status UI
│   ├── ClanVotePanel.tsx              [NEW] WMD authorization voting UI
│   ├── CounterOffensivePanel.tsx      [NEW] Opposition, coalition UI
│   ├── MissileNotification.tsx        [NEW] Toast notifications component
│   ├── TechTreeNode.tsx               [NEW] Reusable tech node component
│   ├── ProgressBar.tsx                [NEW] Component assembly progress
│   ├── SiloStatusCard.tsx             [NEW] Individual silo display
│   ├── AgentRosterCard.tsx            [NEW] Spy unit display
│   ├── MissionResultModal.tsx         [NEW] Success/failure results
│   ├── InterceptionAlert.tsx          [NEW] Incoming missile warning
│   └── index.ts                       [NEW] Barrel export

/app/api/wmd/
├── research/
│   ├── route.ts                  [NEW] GET/POST research progress
│   ├── unlock/route.ts           [NEW] POST unlock tech node
│   └── tree/route.ts             [NEW] GET complete tech tree
├── missile/
│   ├── route.ts                  [NEW] GET all user missiles
│   ├── assemble/route.ts         [NEW] POST start component build
│   ├── launch/route.ts           [NEW] POST launch missile
│   ├── target/route.ts           [NEW] GET valid targets
│   └── status/route.ts           [NEW] GET silo status
├── defense/
│   ├── battery/route.ts          [NEW] GET/POST battery management
│   ├── grid/route.ts             [NEW] GET/POST clan defense grid
│   └── intercept/route.ts        [NEW] POST manual intercept attempt
├── intelligence/
│   ├── spy/route.ts              [NEW] GET/POST spy recruitment
│   ├── mission/route.ts          [NEW] POST launch mission
│   ├── report/route.ts           [NEW] GET intel reports
│   └── dashboard/route.ts        [NEW] GET threat assessment
├── notification/
│   ├── route.ts                  [NEW] GET global notifications
│   ├── leak/route.ts             [NEW] GET intelligence leaks
│   └── subscribe/route.ts        [NEW] WebSocket subscription
├── clan/
│   ├── vote/route.ts             [NEW] POST/GET WMD authorization vote
│   ├── opposition/route.ts       [NEW] POST declare opposition
│   └── coalition/route.ts        [NEW] POST/GET coalition management
└── admin/
    ├── override/route.ts         [NEW] Admin disable WMD for player
    └── stats/route.ts            [NEW] GET system-wide statistics

/docs/
├── WEAPONS_OF_MASS_DESTRUCTION_DESIGN.md  [EXISTS] Design specification
├── WMD_IMPLEMENTATION_PLAN.md             [THIS FILE] Implementation plan
├── WMD_DATABASE_SCHEMA.md                 [NEW] Complete schema documentation
├── WMD_API_SPECIFICATION.md               [NEW] API endpoint reference
├── WMD_TESTING_STRATEGY.md                [NEW] QA test plan
└── WMD_BALANCE_CALCULATIONS.md            [NEW] Economy math verification

/dev/
├── planned.md                    [UPDATE] Add WMD feature entry
├── architecture.md               [UPDATE] Add WMD system overview
└── roadmap.md                    [UPDATE] Add WMD milestones
```

---

## 🗄️ **DATABASE SCHEMA DESIGN**

### **New Tables Required (12 tables)**

#### **1. wmd_research**
```sql
CREATE TABLE wmd_research (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tree_type VARCHAR(20) NOT NULL, -- 'nuclear', 'defense', 'intelligence'
    tier INTEGER NOT NULL,
    tech_id VARCHAR(50) NOT NULL, -- e.g., 'nuclear_fission', 'early_warning_radar'
    progress INTEGER DEFAULT 0, -- RP spent on this tech
    required_rp INTEGER NOT NULL, -- RP needed to complete
    unlocked BOOLEAN DEFAULT false,
    unlocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tree_type, tech_id),
    INDEX idx_user_tree (user_id, tree_type),
    INDEX idx_unlocked (user_id, unlocked)
);
```

#### **2. wmd_missiles**
```sql
CREATE TABLE wmd_missiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clan_id INTEGER REFERENCES clans(id) ON DELETE CASCADE,
    silo_number INTEGER NOT NULL, -- 1, 2, 3 (max 3 per player, 4 with VIP)
    warhead_type VARCHAR(20) NOT NULL, -- 'standard', 'emp', 'thermonuclear', 'mirv', 'clan_buster'
    status VARCHAR(20) NOT NULL, -- 'assembly', 'ready', 'launched', 'intercepted', 'hit'
    current_component INTEGER DEFAULT 0, -- 0-5 (0=not started, 5=complete)
    component_progress JSONB, -- {1: 100, 2: 60, 3: 0, 4: 0, 5: 0}
    total_metal_spent INTEGER DEFAULT 0,
    total_energy_spent INTEGER DEFAULT 0,
    assembly_started_at TIMESTAMP,
    assembly_completed_at TIMESTAMP,
    launched_at TIMESTAMP,
    target_user_id INTEGER REFERENCES users(id),
    target_clan_id INTEGER REFERENCES clans(id),
    damage_dealt INTEGER,
    interception_result VARCHAR(20), -- 'none', 'success', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_status (user_id, status),
    INDEX idx_clan_status (clan_id, status),
    INDEX idx_target (target_user_id, launched_at)
);
```

#### **3. wmd_missile_components**
```sql
CREATE TABLE wmd_missile_components (
    id SERIAL PRIMARY KEY,
    missile_id INTEGER NOT NULL REFERENCES wmd_missiles(id) ON DELETE CASCADE,
    component_number INTEGER NOT NULL, -- 1-5
    component_name VARCHAR(50) NOT NULL,
    metal_cost INTEGER NOT NULL,
    energy_cost INTEGER NOT NULL,
    build_time_hours INTEGER NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    progress_percent INTEGER DEFAULT 0,
    sabotaged_at TIMESTAMP,
    sabotaged_by INTEGER REFERENCES users(id),
    INDEX idx_missile (missile_id, component_number)
);
```

#### **4. wmd_defense_batteries**
```sql
CREATE TABLE wmd_defense_batteries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    factory_x INTEGER NOT NULL, -- Converted factory location
    factory_y INTEGER NOT NULL,
    tech_level INTEGER NOT NULL, -- 1-8 (determines intercept chance)
    interceptor_count INTEGER DEFAULT 10, -- Current interceptors available
    max_interceptors INTEGER DEFAULT 10,
    last_regen_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'disabled', 'destroyed'
    metal_spent INTEGER NOT NULL,
    energy_spent INTEGER NOT NULL,
    constructed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    destroyed_at TIMESTAMP,
    INDEX idx_user_active (user_id, status),
    INDEX idx_location (factory_x, factory_y)
);
```

#### **5. wmd_defense_grid**
```sql
CREATE TABLE wmd_defense_grid (
    id SERIAL PRIMARY KEY,
    clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    total_metal_contributed INTEGER DEFAULT 0,
    total_energy_contributed INTEGER DEFAULT 0,
    required_metal INTEGER DEFAULT 10000000,
    required_energy INTEGER DEFAULT 10000000,
    construction_progress_percent INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'planning', -- 'planning', 'construction', 'active', 'damaged', 'inactive'
    activated_at TIMESTAMP,
    last_upkeep_paid TIMESTAMP,
    upkeep_due_date TIMESTAMP,
    interceptor_pool INTEGER DEFAULT 0,
    max_interceptor_pool INTEGER DEFAULT 200,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_clan_status (clan_id, status)
);
```

#### **6. wmd_defense_contributions**
```sql
CREATE TABLE wmd_defense_contributions (
    id SERIAL PRIMARY KEY,
    grid_id INTEGER NOT NULL REFERENCES wmd_defense_grid(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metal_contributed INTEGER DEFAULT 0,
    energy_contributed INTEGER DEFAULT 0,
    contributed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_grid_user (grid_id, user_id)
);
```

#### **7. wmd_spies**
```sql
CREATE TABLE wmd_spies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spy_type VARCHAR(20) NOT NULL, -- 'spy', 'spymaster', 'black_ops', 'counter_intel'
    count INTEGER DEFAULT 0,
    max_count INTEGER NOT NULL, -- Capacity based on tech
    training_queue INTEGER DEFAULT 0, -- How many currently training
    last_recruited_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_type (user_id, spy_type)
);
```

#### **8. wmd_spy_missions**
```sql
CREATE TABLE wmd_spy_missions (
    id SERIAL PRIMARY KEY,
    attacker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mission_type VARCHAR(30) NOT NULL, -- 'reconnaissance', 'sabotage_component', 'nuclear_sabotage', etc.
    spies_sent INTEGER NOT NULL,
    spymasters_sent INTEGER DEFAULT 0,
    black_ops_sent INTEGER DEFAULT 0,
    success_chance_base INTEGER NOT NULL,
    success_chance_modified INTEGER NOT NULL,
    result VARCHAR(20), -- 'pending', 'success', 'failure', 'detected'
    spies_lost INTEGER DEFAULT 0,
    intel_gained JSONB, -- Structured data of what was learned
    damage_dealt JSONB, -- What was destroyed/stolen
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    INDEX idx_attacker_target (attacker_id, target_id, executed_at),
    INDEX idx_target_result (target_id, result, completed_at)
);
```

#### **9. wmd_intelligence_reports**
```sql
CREATE TABLE wmd_intelligence_reports (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id INTEGER REFERENCES users(id),
    report_type VARCHAR(30) NOT NULL, -- 'leak', 'reconnaissance', 'global_event'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    structured_data JSONB, -- Additional machine-readable data
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    INDEX idx_owner_read (owner_id, read, created_at),
    INDEX idx_severity (severity, created_at)
);
```

#### **10. wmd_global_notifications**
```sql
CREATE TABLE wmd_global_notifications (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(30) NOT NULL, -- 'first_test', 'launch', 'strike', 'intercept', 'milestone'
    actor_id INTEGER REFERENCES users(id),
    actor_clan_id INTEGER REFERENCES clans(id),
    target_id INTEGER REFERENCES users(id),
    target_clan_id INTEGER REFERENCES clans(id),
    message TEXT NOT NULL,
    icon VARCHAR(10), -- Emoji for toast notification
    broadcast_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    INDEX idx_broadcast (broadcast_at),
    INDEX idx_actor (actor_id, broadcast_at)
);
```

#### **11. wmd_clan_votes**
```sql
CREATE TABLE wmd_clan_votes (
    id SERIAL PRIMARY KEY,
    clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    vote_type VARCHAR(30) NOT NULL, -- 'authorize_wmd', 'launch_clan_buster', 'declare_opposition'
    initiated_by INTEGER NOT NULL REFERENCES users(id),
    description TEXT,
    required_approval_percent INTEGER NOT NULL,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    abstain_votes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'passed', 'failed', 'expired'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    voting_ends_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    INDEX idx_clan_status (clan_id, status, voting_ends_at)
);
```

#### **12. wmd_clan_vote_records**
```sql
CREATE TABLE wmd_clan_vote_records (
    id SERIAL PRIMARY KEY,
    vote_id INTEGER NOT NULL REFERENCES wmd_clan_votes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_choice VARCHAR(10) NOT NULL, -- 'yes', 'no', 'abstain'
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vote_id, user_id),
    INDEX idx_vote (vote_id, vote_choice)
);
```

---

## 📊 **TYPE DEFINITIONS**

### **/types/wmd/missile.types.ts**

```typescript
/**
 * Missile Types and Interfaces
 * 
 * OVERVIEW:
 * Complete type definitions for missile system including warheads,
 * components, assembly, targeting, and damage calculations.
 */

export type WarheadType = 
  | 'standard'        // T1-T3: Basic nuclear warhead
  | 'emp'             // T7: Electromagnetic pulse
  | 'thermonuclear'   // T8: Maximum yield
  | 'mirv'            // T5: Multiple independent targets
  | 'clan_buster';    // T10: Clan-wide damage

export type MissileStatus =
  | 'assembly'        // Being built
  | 'ready'           // Complete, can launch
  | 'launched'        // In flight
  | 'intercepted'     // Destroyed by defense
  | 'hit'             // Successfully impacted target
  | 'sabotaged';      // Destroyed by spies

export interface MissileComponent {
  componentNumber: 1 | 2 | 3 | 4 | 5;
  componentName: string;
  metalCost: number;
  energyCost: number;
  buildTimeHours: number;
  progressPercent: number;
  startedAt?: Date;
  completedAt?: Date;
  sabotagedAt?: Date;
  sabotagedBy?: number;
}

export interface Missile {
  id: number;
  userId: number;
  clanId?: number;
  siloNumber: 1 | 2 | 3 | 4;
  warheadType: WarheadType;
  status: MissileStatus;
  currentComponent: 0 | 1 | 2 | 3 | 4 | 5;
  componentProgress: Record<number, number>; // {1: 100, 2: 60, 3: 0, 4: 0, 5: 0}
  totalMetalSpent: number;
  totalEnergySpent: number;
  assemblyStartedAt?: Date;
  assemblyCompletedAt?: Date;
  launchedAt?: Date;
  targetUserId?: number;
  targetClanId?: number;
  damageDealt?: number;
  interceptionResult?: 'none' | 'success' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface MissileAssemblyRequest {
  userId: number;
  warheadType: WarheadType;
  siloNumber: 1 | 2 | 3 | 4;
}

export interface MissileLaunchRequest {
  missileId: number;
  userId: number;
  targetUserId: number;
  targetClanId?: number;
  confirmationCode: string; // User must type "LAUNCH" to confirm
}

export interface MissileLaunchResult {
  success: boolean;
  missileId: number;
  targetUserId: number;
  estimatedImpactTime: Date;
  interceptionChance: number;
  estimatedDamageRange: [number, number];
  globalNotificationId: number;
}

export interface DamageDistribution {
  primaryTargetDamage: number;
  unitsDestroyed: number;
  factoriesDamaged: number;
  resourcesLost: number;
  secondaryTargets?: Array<{
    userId: number;
    damage: number;
  }>;
  clanWideEffects?: {
    productionDebuff: number;
    resourceLoss: number;
    moraleDebuff: number;
  };
}

export interface TargetEligibility {
  eligible: boolean;
  reason?: string;
  playerLevel: number;
  militaryPower: number;
  territoryControl: number;
  pvpActivity: number;
  isFlagHolder: boolean;
  isClanWar: boolean;
  missChance: number;
}
```

### **/types/wmd/defense.types.ts**

```typescript
/**
 * Defense System Types
 * 
 * OVERVIEW:
 * Type definitions for interceptor batteries, clan defense grids,
 * and interception mechanics.
 */

export type BatteryStatus =
  | 'active'          // Operational
  | 'disabled'        // Temporarily offline
  | 'destroyed';      // Destroyed by attack

export type DefenseGridStatus =
  | 'planning'        // Vote not yet complete
  | 'construction'    // Collecting contributions
  | 'active'          // Fully operational
  | 'damaged'         // Hit by attack, needs repair
  | 'inactive';       // Upkeep unpaid

export interface DefenseBattery {
  id: number;
  userId: number;
  factoryX: number;
  factoryY: number;
  techLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  interceptorCount: number;
  maxInterceptors: number;
  lastRegenAt: Date;
  status: BatteryStatus;
  metalSpent: number;
  energySpent: number;
  constructedAt: Date;
  destroyedAt?: Date;
}

export interface DefenseGrid {
  id: number;
  clanId: number;
  totalMetalContributed: number;
  totalEnergyContributed: number;
  requiredMetal: number;
  requiredEnergy: number;
  constructionProgressPercent: number;
  status: DefenseGridStatus;
  activatedAt?: Date;
  lastUpkeepPaid?: Date;
  upkeepDueDate?: Date;
  interceptorPool: number;
  maxInterceptorPool: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DefenseContribution {
  id: number;
  gridId: number;
  userId: number;
  metalContributed: number;
  energyContributed: number;
  contributedAt: Date;
}

export interface InterceptionAttempt {
  missileId: number;
  defenderId: number;
  baseInterceptChance: number;
  modifiers: {
    defenseGridBonus?: number;
    stealthPenalty?: number;
    hypersonicPenalty?: number;
    quantumJammingBonus?: number;
  };
  finalInterceptChance: number;
  interceptorsUsed: number;
  result: 'success' | 'failure';
  rolledValue: number;
}
```

### **/types/wmd/intelligence.types.ts**

```typescript
/**
 * Intelligence Operations Types
 * 
 * OVERVIEW:
 * Type definitions for spy system, missions, intel reports,
 * and sabotage operations.
 */

export type SpyType =
  | 'spy'             // Basic operative
  | 'spymaster'       // Advanced operative
  | 'black_ops'       // Elite operative
  | 'counter_intel';  // Defensive agent

export type MissionType =
  | 'reconnaissance'
  | 'poison_supply'
  | 'resource_theft'
  | 'sabotage_component'
  | 'disable_factory'
  | 'assassination'
  | 'nuclear_sabotage'
  | 'research_theft'
  | 'facility_raid'
  | 'deep_cover'
  | 'wmd_reconnaissance'
  | 'lockdown_protocol'
  | 'double_agent'
  | 'purge'
  | 'mole_hunt';

export type MissionResult =
  | 'pending'         // Mission in progress
  | 'success'         // Mission succeeded
  | 'failure'         // Mission failed
  | 'detected';       // Spies caught

export interface SpyForce {
  id: number;
  userId: number;
  spyType: SpyType;
  count: number;
  maxCount: number;
  trainingQueue: number;
  lastRecruitedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpyMission {
  id: number;
  attackerId: number;
  targetId: number;
  missionType: MissionType;
  spiesSent: number;
  spymastersSent: number;
  blackOpsSent: number;
  successChanceBase: number;
  successChanceModified: number;
  result?: MissionResult;
  spiesLost: number;
  intelGained?: Record<string, any>;
  damageDealt?: Record<string, any>;
  executedAt: Date;
  completedAt?: Date;
}

export interface IntelligenceReport {
  id: number;
  ownerId: number;
  targetId?: number;
  reportType: 'leak' | 'reconnaissance' | 'global_event' | 'sabotage_result';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  content: string;
  structuredData?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ThreatAssessment {
  nuclearThreatLevel: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  knownNuclearPowers: Array<{
    userId: number;
    username: string;
    missilesReady: number;
    techLevel: number;
  }>;
  underConstruction: Array<{
    userId: number;
    username: string;
    progress: string; // "Component 3/5"
  }>;
  defenseNetworks: Array<{
    userId: number;
    username: string;
    batteries: number;
    interceptChance: number;
  }>;
  espionageActivity: Array<{
    userId: number;
    username: string;
    spyCount: number;
    counterIntelCount: number;
  }>;
}
```

### **/types/wmd/research.types.ts**

```typescript
/**
 * Research System Types
 * 
 * OVERVIEW:
 * Type definitions for tech trees, research progress,
 * prerequisites, and unlock logic.
 */

export type TreeType = 'nuclear' | 'defense' | 'intelligence';

export interface TechNode {
  techId: string;
  tier: number;
  name: string;
  description: string;
  requiredRP: number;
  prerequisites: string[];
  unlocks: string[];
  benefits: string[];
  treeType: TreeType;
}

export interface ResearchProgress {
  id: number;
  userId: number;
  treeType: TreeType;
  tier: number;
  techId: string;
  progress: number;
  requiredRP: number;
  unlocked: boolean;
  unlockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TechTree {
  treeType: TreeType;
  totalRP: number;
  nodes: TechNode[];
  userProgress: Map<string, ResearchProgress>;
}

export interface ResearchUnlockRequest {
  userId: number;
  treeType: TreeType;
  techId: string;
  rpToSpend: number;
}

export interface ResearchUnlockResult {
  success: boolean;
  newProgress: number;
  unlocked: boolean;
  message: string;
  nextUnlock?: string;
}
```

### **/types/wmd/notification.types.ts**

```typescript
/**
 * Notification System Types
 * 
 * OVERVIEW:
 * Type definitions for global notifications, intelligence leaks,
 * and real-time alerts.
 */

export type GlobalEventType =
  | 'first_test'
  | 'launch'
  | 'strike'
  | 'intercept'
  | 'milestone'
  | 'clan_authorization'
  | 'coalition_formed'
  | 'un_resolution';

export interface GlobalNotification {
  id: number;
  eventType: GlobalEventType;
  actorId?: number;
  actorClanId?: number;
  targetId?: number;
  targetClanId?: number;
  message: string;
  icon: string; // Emoji
  broadcastAt: Date;
  expiresAt?: Date;
}

export interface IntelligenceLeak {
  targetId: number;
  targetUsername: string;
  leakType: 'research' | 'assembly' | 'missile_ready' | 'defense_installation' | 'spy_network';
  leakProbability: number;
  triggered: boolean;
  details: string;
  recipients: number[]; // User IDs who receive notification
}

export interface WebSocketNotification {
  type: 'wmd_global' | 'wmd_intel' | 'wmd_attack' | 'wmd_defense';
  priority: 'low' | 'medium' | 'high' | 'critical';
  data: GlobalNotification | IntelligenceReport | InterceptionAttempt;
  timestamp: Date;
}
```

---

## 🔧 **SERVICE LAYER ARCHITECTURE**

### **/lib/wmd/missileService.ts**

```typescript
/**
 * Missile Service
 * Created: 2025-10-21
 * 
 * OVERVIEW:
 * Handles all missile-related operations including assembly queue management,
 * component build progress, targeting validation, launch mechanics, and
 * damage calculation. Integrates with defense and notification services.
 * 
 * KEY RESPONSIBILITIES:
 * - Component assembly progression (5-stage build)
 * - Resource validation and consumption
 * - Launch eligibility checks
 * - Damage distribution calculations
 * - Interception coordination
 * 
 * DEPENDENCIES:
 * - defenseService (interception checks)
 * - notificationService (global broadcasts)
 * - damageCalculator (damage formulas)
 * - targetingValidator (eligibility verification)
 */

import type { 
  Missile, 
  MissileComponent, 
  MissileAssemblyRequest, 
  MissileLaunchRequest,
  MissileLaunchResult,
  DamageDistribution,
  WarheadType 
} from '@/types/wmd/missile.types';

/**
 * Initiates assembly of a new strategic missile
 * @param request - Assembly parameters including warhead type and silo
 * @returns Created missile with initial component status
 * @throws Error if resources insufficient or prerequisites not met
 * 
 * @example
 * const missile = await startMissileAssembly({
 *   userId: 123,
 *   warheadType: 'thermonuclear',
 *   siloNumber: 1
 * });
 */
export async function startMissileAssembly(
  request: MissileAssemblyRequest
): Promise<Missile> {
  // Implementation details...
}

/**
 * Advances component build progress based on elapsed time
 * @param missileId - Missile to update
 * @returns Updated missile with new progress
 * 
 * @example
 * const updated = await updateComponentProgress(456);
 * console.log(`Component ${updated.currentComponent}: ${updated.componentProgress[updated.currentComponent]}%`);
 */
export async function updateComponentProgress(
  missileId: number
): Promise<Missile> {
  // Implementation details...
}

/**
 * Launches a completed missile at target
 * @param request - Launch parameters including target and confirmation
 * @returns Launch result with impact estimates and notification ID
 * @throws Error if missile not ready or target invalid
 * 
 * @example
 * const result = await launchMissile({
 *   missileId: 789,
 *   userId: 123,
 *   targetUserId: 456,
 *   confirmationCode: 'LAUNCH'
 * });
 */
export async function launchMissile(
  request: MissileLaunchRequest
): Promise<MissileLaunchResult> {
  // Implementation details...
}

/**
 * Calculates damage distribution for missile impact
 * @param missile - Missile that hit target
 * @param interceptionAttempt - Defense system response
 * @returns Detailed damage breakdown
 * 
 * @example
 * const damage = calculateDamage(missile, interception);
 * console.log(`Units destroyed: ${damage.unitsDestroyed}`);
 */
export async function calculateDamage(
  missile: Missile,
  interceptionAttempt: InterceptionAttempt
): Promise<DamageDistribution> {
  // Implementation details...
}

// Additional functions...
export async function getMissilesForUser(userId: number): Promise<Missile[]>;
export async function getSiloStatus(userId: number): Promise<SiloStatus[]>;
export async function cancelMissileAssembly(missileId: number): Promise<void>;
export async function getValidTargets(userId: number): Promise<TargetEligibility[]>;
```

---

## 🎨 **UI COMPONENT ARCHITECTURE**

### **/components/wmd/MissileAssemblyPanel.tsx**

```typescript
/**
 * Missile Assembly Panel Component
 * Created: 2025-10-21
 * 
 * OVERVIEW:
 * Displays active missile assembly queue with 5-component progression.
 * Shows real-time build progress, resource requirements, and allows
 * cancellation or VIP speed-up. Updates via WebSocket for live sync.
 * 
 * FEATURES:
 * - 5-stage component visualization with progress bars
 * - Resource cost breakdown per component
 * - Time remaining estimates
 * - Sabotage alert notifications
 * - Cancel/Speed-up controls
 * 
 * PROPS:
 * @param userId - Current user's ID
 * @param missiles - Array of user's missiles in assembly
 * @param onCancel - Callback when user cancels assembly
 * @param onSpeedUp - Callback when VIP user uses speed-up
 */

'use client';

import { useState, useEffect } from 'react';
import { Panel } from '@/components/ui/Panel';
import { ProgressBar } from '@/components/wmd/ProgressBar';
import { useWebSocket } from '@/context/WebSocketContext';
import type { Missile, MissileComponent } from '@/types/wmd/missile.types';

interface MissileAssemblyPanelProps {
  userId: number;
  missiles: Missile[];
  onCancel: (missileId: number) => Promise<void>;
  onSpeedUp: (missileId: number) => Promise<void>;
}

export function MissileAssemblyPanel({
  userId,
  missiles,
  onCancel,
  onSpeedUp
}: MissileAssemblyPanelProps) {
  const [activeMissile, setActiveMissile] = useState<Missile | null>(null);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    // Subscribe to assembly updates
    const unsubscribe = subscribe('wmd_assembly_update', (data) => {
      if (data.userId === userId) {
        // Update progress in real-time
      }
    });

    return () => unsubscribe();
  }, [userId, subscribe]);

  const COMPONENTS: MissileComponent[] = [
    {
      componentNumber: 1,
      componentName: 'Plutonium Core',
      metalCost: 500000,
      energyCost: 250000,
      buildTimeHours: 12,
      progressPercent: 0
    },
    // ... rest of components
  ];

  return (
    <Panel
      title="🚀 Missile Assembly"
      collapsible
      className="w-full max-w-2xl"
    >
      {/* Assembly queue UI */}
      <div className="space-y-4">
        {missiles.filter(m => m.status === 'assembly').map(missile => (
          <div key={missile.id} className="border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">
              Strategic Missile #{missile.siloNumber}
            </h3>

            {/* Component progress */}
            <div className="space-y-2">
              {COMPONENTS.map((comp, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className={`text-sm ${
                    missile.currentComponent > comp.componentNumber ? 'text-green-400' :
                    missile.currentComponent === comp.componentNumber ? 'text-yellow-400' :
                    'text-gray-500'
                  }`}>
                    {comp.componentName}
                  </span>
                  <ProgressBar
                    current={missile.componentProgress[comp.componentNumber] || 0}
                    max={100}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-400">
                    {missile.componentProgress[comp.componentNumber] || 0}%
                  </span>
                </div>
              ))}
            </div>

            {/* Resource costs for next component */}
            {missile.currentComponent < 5 && (
              <div className="mt-4 p-3 bg-gray-800 rounded">
                <p className="text-sm font-medium mb-1">
                  Next Component: {COMPONENTS[missile.currentComponent].componentName}
                </p>
                <div className="flex gap-4 text-xs text-gray-300">
                  <span>Metal: {COMPONENTS[missile.currentComponent].metalCost.toLocaleString()}</span>
                  <span>Energy: {COMPONENTS[missile.currentComponent].energyCost.toLocaleString()}</span>
                  <span>Time: {COMPONENTS[missile.currentComponent].buildTimeHours}h</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onCancel(missile.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                Cancel Build
              </button>
              {/* VIP Speed-up button */}
              <button
                onClick={() => onSpeedUp(missile.id)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
              >
                🔥 Speed Up (VIP)
              </button>
            </div>
          </div>
        ))}

        {missiles.filter(m => m.status === 'assembly').length === 0 && (
          <p className="text-center text-gray-400 py-8">
            No missiles currently in assembly
          </p>
        )}
      </div>
    </Panel>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * - WebSocket connection required for real-time progress updates
 * - Progress bars update every 10 seconds automatically
 * - Sabotage alerts show red flash animation
 * - Cancel requires confirmation modal (separate component)
 * - Speed-up only available if user has VIP status
 */
```

---

## 🔗 **API ENDPOINT SPECIFICATIONS**

### **POST /api/wmd/missile/assemble**

**Purpose:** Start assembly of a new strategic missile

**Request Body:**
```typescript
{
  userId: number;
  warheadType: 'standard' | 'emp' | 'thermonuclear' | 'mirv' | 'clan_buster';
  siloNumber: 1 | 2 | 3 | 4;
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  missile: {
    id: number;
    siloNumber: number;
    warheadType: string;
    status: 'assembly';
    currentComponent: 0;
    componentProgress: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    totalMetalSpent: 0;
    totalEnergySpent: 0;
    assemblyStartedAt: string; // ISO date
  };
  message: 'Missile assembly initiated';
}
```

**Error Responses:**
```typescript
// 400 Bad Request
{ success: false, error: 'Silo already occupied' }
{ success: false, error: 'Insufficient resources' }
{ success: false, error: 'Research prerequisite not met: T3 Plutonium Refinement required' }

// 401 Unauthorized
{ success: false, error: 'Must be in clan to build WMD' }
{ success: false, error: 'Clan has not authorized WMD program' }

// 403 Forbidden
{ success: false, error: 'Player level too low (minimum: 30)' }
```

**Validation Logic:**
1. Check user is in clan (5+ members, Level 5+)
2. Verify clan has passed WMD authorization vote
3. Verify user Level 30+
4. Check research prerequisite (T3 for Plutonium Core)
5. Validate silo number (1-3, or 1-4 if VIP)
6. Check silo is empty
7. Deduct resources for Component 1
8. Create missile record
9. Trigger global notification (if first missile)
10. Calculate leak probability and trigger if needed

---

## 📝 **IMPLEMENTATION PHASES**

### **PHASE 1: Foundation (Weeks 1-3)**

**Goal:** Database schema, types, and basic infrastructure

**Tasks:**
1. ✅ Create all 12 database tables with indexes
2. ✅ Write database migration scripts
3. ✅ Create all TypeScript type definitions (6 files)
4. ✅ Set up barrel exports (index.ts files)
5. ✅ Create base service layer structure (8 files)
6. ✅ Write JSDoc for all types and interfaces
7. ✅ Create database seed data for testing
8. ✅ Write unit tests for type validation

**Deliverables:**
- Complete database schema deployed to dev environment
- All TypeScript types with 100% JSDoc coverage
- Service layer scaffolding with method signatures
- Test database with sample WMD data

**Acceptance Criteria:**
- All migrations run successfully
- TypeScript compilation: 0 errors
- 100% type coverage (no `any` types)
- All service methods have JSDoc with @example

---

### **PHASE 2: Research System (Weeks 4-5)**

**Goal:** Implement WMD research trees and RP spending logic

**Tasks:**
1. ✅ Create tech tree JSON configs (3 trees × 10 tiers)
2. ✅ Implement `researchService.ts` with unlock logic
3. ✅ Build research API endpoints (3 routes)
4. ✅ Create `MissileResearchPanel` component
5. ✅ Create `DefenseResearchPanel` component
6. ✅ Create `IntelligenceResearchPanel` component
7. ✅ Create reusable `TechTreeNode` component
8. ✅ Implement prerequisite validation
9. ✅ Write integration tests for research flow

**Deliverables:**
- 3 fully functional research trees
- UI panels with interactive tech nodes
- RP deduction and progress tracking
- Visual tech tree with dependency lines

**Acceptance Criteria:**
- Users can unlock techs with RP
- Prerequisites block progression correctly
- UI updates in real-time after unlock
- All 28 tech nodes render correctly
- Error handling for insufficient RP

---

### **PHASE 3: Missile System (Weeks 6-8)**

**Goal:** Complete missile assembly, targeting, and launch mechanics

**Tasks:**
1. ✅ Implement `missileService.ts` (full implementation)
2. ✅ Create `damageCalculator.ts` with all formulas
3. ✅ Create `targetingValidator.ts` with eligibility checks
4. ✅ Build missile API endpoints (5 routes)
5. ✅ Create `MissileAssemblyPanel` component
6. ✅ Create `LaunchControlPanel` component
7. ✅ Create `ProgressBar` component
8. ✅ Create `SiloStatusCard` component
9. ✅ Implement WebSocket updates for assembly progress
10. ✅ Create launch confirmation modal
11. ✅ Write battle report generator
12. ✅ Integration tests for full missile lifecycle

**Deliverables:**
- Complete missile assembly system (5 components)
- Targeting system with eligibility filters
- Launch UI with confirmation flow
- Damage calculation engine
- Real-time progress updates

**Acceptance Criteria:**
- Users can start assembly and track progress
- Component sabotage properly resets progress
- Targeting shows valid targets only
- Launch confirmation requires typing "LAUNCH"
- Damage distribution follows specification
- Battle reports generated correctly

---

### **PHASE 4: Defense System (Weeks 9-10)**

**Goal:** Implement interceptor batteries and clan defense grid

**Tasks:**
1. ✅ Implement `defenseService.ts`
2. ✅ Create defense API endpoints (3 routes)
3. ✅ Create `DefenseBatteryPanel` component
4. ✅ Create `DefenseGridPanel` component
5. ✅ Implement interception calculation logic
6. ✅ Create `InterceptionAlert` component
7. ✅ Build clan contribution tracking UI
8. ✅ Implement interceptor regeneration system
9. ✅ Write integration tests for interception

**Deliverables:**
- Battery construction on factory tiles
- Clan-wide defense grid system
- Pooled resource contributions
- Interception calculation engine
- Real-time alerts for incoming missiles

**Acceptance Criteria:**
- Batteries can be built on owned factories
- Grid construction requires 70% clan participation
- Interception rolls use correct probability
- Alerts show 5 minutes before impact
- Upkeep system deactivates unpaid grids

---

### **PHASE 5: Intelligence System (Weeks 11-12)**

**Goal:** Implement spy operations and sabotage mechanics

**Tasks:**
1. ✅ Implement `spyService.ts`
2. ✅ Create `sabotageEngine.ts` with all mission types
3. ✅ Create intelligence API endpoints (4 routes)
4. ✅ Create `SpyRecruitmentPanel` component
5. ✅ Create `MissionControlPanel` component
6. ✅ Create `IntelligenceDashboard` component
7. ✅ Create `AgentRosterCard` component
8. ✅ Create `MissionResultModal` component
9. ✅ Implement intelligence leak system
10. ✅ Write integration tests for all mission types

**Deliverables:**
- Spy recruitment system
- 10 mission types fully functional
- Counter-intelligence mechanics
- Intelligence dashboard with threat assessment
- Sabotage engine with component destruction

**Acceptance Criteria:**
- All mission types calculate success correctly
- Nuclear Sabotage destroys all components
- Research theft transfers RP properly
- Counter-intel reduces success rates
- Leak system triggers probabilistically
- Dashboard shows accurate threat levels

---

### **PHASE 6: Integration & Balance (Weeks 13-14)**

**Goal:** Clan warfare features, notifications, and balance testing

**Tasks:**
1. ✅ Implement clan vote system
2. ✅ Create `ClanVotePanel` component
3. ✅ Create `CounterOffensivePanel` component
4. ✅ Implement global notification system
5. ✅ Create `MissileNotification` toast component
6. ✅ Create `GlobalIntelPanel` component
7. ✅ Implement intelligence leak detection
8. ✅ Build UN Security Council voting system
9. ✅ Implement reputation system integration
10. ✅ Create admin override controls
11. ✅ Balance testing (all formulas and costs)
12. ✅ Performance optimization (database queries)
13. ✅ Write comprehensive integration tests

**Deliverables:**
- Clan authorization voting
- Global notification broadcasts
- Intelligence leak system
- UN resolution voting
- Reputation impact mechanics
- Admin controls

**Acceptance Criteria:**
- Clan votes require 60% approval
- Global notifications broadcast to all players
- Leaks trigger based on spy presence
- UN resolutions affect WMD programs
- Reputation affects missile miss chance
- Admins can disable WMD for specific players
- All systems perform under load (100 concurrent users)

---

### **PHASE 7: Polish & Launch (Week 15)**

**Goal:** Final testing, documentation, and deployment

**Tasks:**
1. ✅ Create achievement system integration
2. ✅ Write user documentation/tutorial
3. ✅ Create admin documentation
4. ✅ Comprehensive QA testing (all features)
5. ✅ Security audit (SQL injection, XSS, etc.)
6. ✅ Performance testing (stress test with 500 users)
7. ✅ Bug fixes from QA
8. ✅ Beta test with 50 high-level players
9. ✅ Collect feedback and iterate
10. ✅ Production deployment
11. ✅ Post-launch monitoring

**Deliverables:**
- Achievement system (8 new achievements)
- In-game tutorial for WMD systems
- Admin dashboard for monitoring
- Complete QA test results
- Security audit report
- Beta feedback summary
- Production-ready deployment

**Acceptance Criteria:**
- All QA tests pass (0 critical bugs)
- Security audit finds no vulnerabilities
- Performance test: <2s response time under load
- Beta feedback: 80%+ positive sentiment
- Tutorial completion rate: 70%+
- Deployment completes with 0 downtime

---

## 🧪 **TESTING STRATEGY**

### **Unit Tests (Jest + TypeScript)**

**Coverage Target:** 80%+

**Test Files:**
```
/tests/unit/
├── wmd/
│   ├── missileService.test.ts      // Assembly, launch, damage
│   ├── defenseService.test.ts      // Interception, batteries
│   ├── spyService.test.ts          // Missions, sabotage
│   ├── researchService.test.ts     // Tech unlocks
│   ├── damageCalculator.test.ts    // Damage formulas
│   ├── targetingValidator.test.ts  // Eligibility checks
│   └── sabotageEngine.test.ts      // Component destruction
```

**Example Test Case:**
```typescript
describe('missileService.calculateDamage', () => {
  it('should distribute Clan Buster damage correctly', () => {
    const missile: Missile = {
      warheadType: 'clan_buster',
      // ... other properties
    };
    
    const result = calculateDamage(missile, mockInterception);
    
    expect(result.primaryTargetDamage).toBe(500000); // 50% of 1M
    expect(result.secondaryTargets).toHaveLength(8); // 3 top + 5 random
    expect(result.clanWideEffects?.productionDebuff).toBe(20);
  });

  it('should apply critical hit multiplier (5% chance)', () => {
    // Mock RNG to trigger critical hit
    jest.spyOn(Math, 'random').mockReturnValue(0.03); // 3% < 5%
    
    const result = calculateDamage(standardMissile, mockInterception);
    
    expect(result.unitsDestroyed).toBeGreaterThan(
      standardDamage.unitsDestroyed * 1.9 // Should be ~2x
    );
  });
});
```

---

### **Integration Tests (Playwright)**

**Test Scenarios:**
```
/tests/integration/
├── wmd/
│   ├── missile-lifecycle.spec.ts   // Assembly → Launch → Impact
│   ├── defense-interception.spec.ts // Battery intercepts missile
│   ├── spy-sabotage.spec.ts        // Nuclear Sabotage destroys components
│   ├── clan-vote.spec.ts           // Clan authorizes WMD program
│   ├── research-unlock.spec.ts     // Unlock tech with prerequisites
│   └── notifications.spec.ts       // Global notifications broadcast
```

**Example Integration Test:**
```typescript
test('Complete missile lifecycle', async ({ page }) => {
  // 1. Research prerequisite
  await page.goto('/game/research/wmd');
  await page.click('[data-tech="plutonium_refinement"]');
  await expect(page.locator('.tech-unlocked')).toBeVisible();

  // 2. Start assembly
  await page.goto('/game/wmd/missile');
  await page.click('button:text("Build Missile")');
  await page.selectOption('select[name="warhead"]', 'thermonuclear');
  await page.click('button:text("Start Assembly")');
  
  // 3. Verify component progress
  const progress = page.locator('.component-progress-1');
  await expect(progress).toHaveText('0%');
  
  // Fast-forward time (admin control for testing)
  await page.evaluate(() => window.testFastForward('12h'));
  await expect(progress).toHaveText('100%');

  // 4. Complete all components
  await page.evaluate(() => window.testFastForward('50h'));
  await expect(page.locator('.missile-ready')).toBeVisible();

  // 5. Launch missile
  await page.click('button:text("Launch")');
  await page.fill('input[name="confirmation"]', 'LAUNCH');
  await page.click('button:text("Confirm Launch")');

  // 6. Verify notification
  await expect(page.locator('.toast-notification')).toContainText('launched a strategic missile');

  // 7. Wait for impact (5 minutes = 300s)
  await page.evaluate(() => window.testFastForward('5m'));
  
  // 8. Verify battle report
  await page.goto('/game/reports');
  await expect(page.locator('.battle-report')).toContainText('Missile Strike');
});
```

---

## ⚖️ **BALANCE CALCULATIONS**

### **Economic Impact Analysis**

**Full WMD Investment (Single Player):**
```
Nuclear Tree Research:    2,500,000 RP
Defense Tree Research:    2,360,000 RP
Intelligence Tree:        2,090,000 RP
TOTAL RESEARCH:           6,950,000 RP

1 Missile Build:          1,850,000 Metal + 1,900,000 Energy
2 Defense Batteries:      2,300,000 Metal + 2,100,000 Energy
50 Spies:                   500,000 Metal +   750,000 Energy
TOTAL RESOURCES:          4,650,000 Metal + 4,750,000 Energy

At 6,000 RP/day: 1,158 days (3.2 years) for full research
At 100k Metal+Energy/day: 93 days (3 months) for resources

REALISTIC TIMELINE: 4-6 months for single specialization
```

**Clan-Level Investment (10 Members):**
```
If 10 members specialize:
- 4 Nuclear Engineers:   10M RP, 7.4M Metal, 7.6M Energy
- 3 Defense Specialists: 7M RP, 6.9M Metal, 6.3M Energy
- 3 Intelligence Agents: 6.3M RP, 1.5M Metal, 2.25M Energy
TOTAL CLAN:              23.3M RP, 15.8M Metal, 16.15M Energy

Defense Grid:            10M Metal + 10M Energy (pooled)
GRAND TOTAL:             23.3M RP, 25.8M Metal, 26.15M Energy

At 60k RP/day (10 players): 388 days (13 months)
At 1M resources/day (10 players): 52 days (1.75 months)

REALISTIC CLAN TIMELINE: 2-3 months for basic capability
```

**Counter-Measure Costs:**
```
OFFENSE (Build 1 Missile):
- 2.5M RP + 1.85M Metal + 1.9M Energy = ~6.25M value

DEFENSE (Stop It via Nuclear Sabotage):
- 2.09M RP (Intelligence T7) + 25 spies (625k resources) = ~2.7M value
- Success rate: 35% per attempt
- Expected cost: 2.7M / 0.35 = ~7.7M value

CONCLUSION: Offense slightly cheaper than defense, BUT:
- Multiple attempts likely (attacker paranoia)
- Clans can coordinate (3 attempts = 75% success)
- Military raids add pressure
- RESULT: Building WMD attracts proportional response
```

---

## 📋 **ACCEPTANCE CHECKLIST**

Before proceeding to Phase 1 implementation:

- [ ] **Database Schema Review**
  - [ ] All 12 tables defined with proper indexes
  - [ ] Foreign keys cascade correctly
  - [ ] JSONB fields have proper structure
  - [ ] Migration scripts tested on dev environment

- [ ] **Type System Review**
  - [ ] All types use strict TypeScript (no `any`)
  - [ ] 100% JSDoc coverage on exported types
  - [ ] Barrel exports configured correctly
  - [ ] Type definitions match database schema

- [ ] **Service Layer Review**
  - [ ] All service methods have JSDoc with @example
  - [ ] Error handling strategy defined
  - [ ] Logging strategy defined (what to log, where)
  - [ ] Database connection pooling configured

- [ ] **Component Architecture Review**
  - [ ] All components follow Panel/glassmorphism pattern
  - [ ] Mobile responsiveness considered
  - [ ] WebSocket integration planned
  - [ ] Error boundary implementation

- [ ] **API Design Review**
  - [ ] RESTful conventions followed
  - [ ] Authentication/authorization strategy defined
  - [ ] Rate limiting planned (prevent spam)
  - [ ] Input validation on all endpoints

- [ ] **Balance Review**
  - [ ] All costs verified against current economy
  - [ ] Formula calculations peer-reviewed
  - [ ] Edge cases identified (e.g., 0 spies, max level player)
  - [ ] Playtesting plan defined

- [ ] **Timeline Review**
  - [ ] 15-week estimate realistic for team size
  - [ ] Dependencies identified (e.g., clan system updates)
  - [ ] Buffer time included for bug fixes
  - [ ] Beta testing period scheduled

---

## 🎯 **NEXT STEPS**

1. **Stakeholder Review** - Present this plan to dev team and get approval
2. **Environment Setup** - Create dev branch `feature/wmd-system`
3. **Database Migration** - Write migration scripts for all 12 tables
4. **Type Generation** - Create all TypeScript type files
5. **Service Scaffolding** - Build service layer structure with method signatures
6. **Kickoff Meeting** - Assign tasks to team members, set sprint goals

---

**Status:** 📋 **Awaiting Approval**  
**Risk Level:** Medium (complex systems, requires extensive testing)  
**Dependencies:** Clan system must support voting (may need updates)  
**Blockers:** None identified  

---

**Document Version:** 1.0  
**Last Updated:** October 21, 2025  
**Next Review:** After stakeholder approval  
**Implementation Start:** TBD (pending approval)
