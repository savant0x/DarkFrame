# 🔍 WMD System - Complete Codebase Integration Review

**Feature:** FID-20251021-WMD-PLANNING  
**Created:** 2025-10-21  
**Purpose:** Full code review showing where every WMD component integrates with existing systems

---

## 📋 TABLE OF CONTENTS

1. [Database Integration](#database-integration)
2. [Research System Integration](#research-system-integration)
3. [Clan System Integration](#clan-system-integration)
4. [Notification & WebSocket Integration](#notification--websocket-integration)
5. [API Layer Integration](#api-layer-integration)
6. [UI Component Integration](#ui-component-integration)
7. [Security & Permissions Integration](#security--permissions-integration)
8. [Testing Integration Points](#testing-integration-points)

---

## 🗄️ DATABASE INTEGRATION

### **Existing Collections We'll Use:**

#### **1. `players` Collection**
**Location:** MongoDB Atlas cluster  
**Current Schema:** `/types/game.types.ts` (line 2264+)  
**WMD Additions Needed:**
```typescript
// ADD TO Player interface:
wmd?: {
  authorizedProgram: boolean;              // Clan voted to authorize
  programAuthorizedAt?: Date;
  research: {
    missile: WMDResearchProgress;
    defense: WMDResearchProgress;
    intelligence: WMDResearchProgress;
  };
  spies: {
    spy: number;
    spymaster: number;
    blackOps: number;
    counterIntel: number;
  };
  lastMissionAt?: Date;
  reputationPenalty: number;               // -1000 for authorizing
}
```

**Integration Points:**
- ✅ Player RP system already functional (`/lib/xpService.ts` line 413-450)
- ✅ Player activity logging exists (`PlayerActivity` collection)
- ✅ Player level and XP tracking operational

#### **2. `clans` Collection**
**Location:** MongoDB Atlas cluster  
**Current Schema:** `/types/clan.types.ts` (line 540-600)  
**WMD Additions Needed:**
```typescript
// ADD TO Clan interface:
wmd?: {
  programAuthorized: boolean;
  authorizedAt?: Date;
  voteId?: string;                         // Reference to wmd_clan_votes
  defenseGrid?: {
    active: boolean;
    metalContributed: number;
    energyContributed: number;
    contributors: Array<{
      playerId: string;
      metal: number;
      energy: number;
    }>;
  };
  activeMissiles: number;
  activeBatteries: number;
  totalLaunches: number;
  oppositionDeclared: string[];            // Clan IDs opposing this clan
}
```

**Integration Points:**
- ✅ Clan member management exists (`/lib/clanService.ts`)
- ✅ Clan permissions system operational (`ROLE_PERMISSIONS` - line 149-330)
- ✅ Clan voting system exists (can adapt for WMD authorization)
- ✅ Clan activity logging functional (`/lib/clanActivityService.ts`)

#### **3. New Collections to Create:**

##### **`wmd_research`**
```typescript
interface WMDResearch {
  _id: ObjectId;
  userId: string;                          // Player username
  treeType: 'missile' | 'defense' | 'intelligence';
  tier: number;                            // 1-10
  techId: string;                          // Unique tech node ID
  progress: number;                        // RP spent so far
  requiredRP: number;                      // Total RP needed
  unlocked: boolean;
  unlockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```
**Indexes:**
- `{ userId: 1, treeType: 1 }` - Query user's research by tree
- `{ techId: 1 }` - Tech node lookups

##### **`wmd_missiles`**
```typescript
interface WMDMissile {
  _id: ObjectId;
  ownerId: string;                         // Player username
  clanId: string;                          // Owner's clan ID
  warheadType: 'tactical' | 'strategic' | 'neutron' | 'cluster' | 'clan_buster';
  status: 'assembling' | 'ready' | 'launched' | 'intercepted' | 'detonated';
  components: {
    warhead: boolean;
    propulsion: boolean;
    guidance: boolean;
    payload: boolean;
    stealth: boolean;
  };
  targetId?: string;                       // Target player/clan
  launchedAt?: Date;
  impactAt?: Date;
  createdAt: Date;
}
```
**Indexes:**
- `{ ownerId: 1, status: 1 }` - Query player's missiles
- `{ clanId: 1, status: 1 }` - Clan missile inventory
- `{ targetId: 1, impactAt: 1 }` - Incoming missile alerts

##### **`wmd_spy_missions`**
```typescript
interface WMDSpyMission {
  _id: ObjectId;
  attackerId: string;                      // Player username
  targetId: string;
  missionType: 'reconnaissance' | 'sabotage_component' | 'nuclear_sabotage' | etc.;
  spiesSent: number;
  spymastersSent: number;
  blackOpsSent: number;
  successChanceBase: number;
  successChanceModified: number;
  result?: 'pending' | 'success' | 'failure' | 'detected';
  spiesLost: number;
  intelGained?: Record<string, any>;       // What was learned
  damageDealt?: Record<string, any>;       // What was destroyed
  executedAt: Date;
  resolvedAt?: Date;
}
```
**Indexes:**
- `{ attackerId: 1, executedAt: -1 }` - Mission history
- `{ targetId: 1, resolvedAt: 1 }` - Defense alerts

##### **`wmd_global_notifications`**
```typescript
interface WMDGlobalNotification {
  _id: ObjectId;
  eventType: 'first_test' | 'launch' | 'strike' | 'intercept' | 'clan_authorization';
  actorId?: string;                        // Player username
  actorClanId?: string;
  targetId?: string;
  targetClanId?: string;
  message: string;                         // "The [DARK] clan has authorized WMD development!"
  icon: string;                            // "☢️" or "🚀"
  broadcastAt: Date;
  expiresAt?: Date;
}
```
**Indexes:**
- `{ broadcastAt: -1 }` - Recent notifications
- `{ expiresAt: 1 }` - Cleanup expired

##### **`wmd_clan_votes`**
```typescript
interface WMDClanVote {
  _id: ObjectId;
  clanId: string;
  voteType: 'authorize_wmd' | 'launch_clan_buster' | 'declare_opposition';
  initiatedBy: string;                     // Player username
  description: string;
  requiredApprovalPercent: number;         // 60%
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  voters: Array<{
    playerId: string;
    vote: 'yes' | 'no' | 'abstain';
    votedAt: Date;
  }>;
  status: 'active' | 'passed' | 'failed' | 'expired';
  createdAt: Date;
  votingEndsAt: Date;
  resolvedAt?: Date;
}
```
**Indexes:**
- `{ clanId: 1, status: 1 }` - Active votes
- `{ votingEndsAt: 1 }` - Expire old votes

---

## 🔬 RESEARCH SYSTEM INTEGRATION

### **Existing Research Infrastructure:**

#### **1. RP Spending System**
**Location:** `/lib/xpService.ts` (line 413-450)  
**Function:** `spendResearchPoints(playerId, amount, reason)`  
**Status:** ✅ Fully functional

**Integration Plan:**
```typescript
// WMD research will use this existing function:
import { spendResearchPoints } from '@/lib/xpService';

// In researchService.ts:
export async function unlockWMDTech(
  userId: string,
  treeType: TreeType,
  techId: string
): Promise<ResearchUnlockResult> {
  const tech = TECH_TREES[treeType].find(t => t.techId === techId);
  
  // Use existing RP spending system
  const rpResult = await spendResearchPoints(
    userId,
    tech.requiredRP,
    `WMD Research: ${tech.name}`
  );
  
  if (!rpResult.success) {
    throw new Error(rpResult.message);
  }
  
  // Continue with tech unlock...
}
```

#### **2. Tech Tree UI**
**Location:** `/app/tech-tree/page.tsx` (line 257-526)  
**Status:** ✅ Operational tech tree with prerequisites, costs, and unlock logic

**Integration Plan:**
- Create separate `/app/wmd-research/page.tsx` following same pattern
- Reuse `TechnologyCard` component structure
- Add locked/unlocked state management
- Implement prerequisite validation (same logic)

**Code Pattern to Reuse:**
```typescript
// From existing tech tree (line 330-350):
const canResearch = (tech: Technology): boolean => {
  if (!player) return false;
  if (tech.unlocked || tech.researching) return false;
  if (player.resources.metal < tech.cost) return false;
  
  // Check prerequisites
  for (const prereqId of tech.prerequisites) {
    const prereq = technologies.find(t => t.id === prereqId);
    if (!prereq?.unlocked) return false;
  }
  
  return true;
};

// WMD version will be nearly identical:
const canUnlockWMDTech = (tech: TechNode): boolean => {
  if (!player) return false;
  if (isUnlocked(tech.techId)) return false;
  if (player.researchPoints < tech.requiredRP) return false;
  
  // Check prerequisites (same pattern)
  for (const prereqId of tech.prerequisites) {
    if (!isUnlocked(prereqId)) return false;
  }
  
  return true;
};
```

#### **3. Clan Research System**
**Location:** `/lib/clanResearchService.ts` (line 299-427)  
**Function:** `unlockResearch(clanId, playerId, researchId)`  
**Status:** ✅ Full clan research tree with 4 branches

**Integration Opportunity:**
- WMD authorization vote triggers clan-level research unlock
- Use same permission system (`hasPermission(role, 'canManageResearch')`)
- Adapt RP contribution system for clan defense grid

**Permission Check Pattern:**
```typescript
// From clanResearchService.ts (line 319-325):
const { hasPermission } = await import('@/types/clan.types');
if (!hasPermission(member.role, 'canManageResearch')) {
  throw new Error('Insufficient permissions');
}

// WMD will use same check for voting initiation:
if (!hasPermission(member.role, 'canManageWars')) {
  throw new Error('Only Leader/Co-Leader/Officer can initiate WMD vote');
}
```

---

## 🏛️ CLAN SYSTEM INTEGRATION

### **Existing Clan Infrastructure:**

#### **1. Clan Voting System (To Adapt)**
**Current:** Implicit (no formal voting yet)  
**Location:** `/lib/clanService.ts` (clan management functions)  
**Need:** Create explicit voting system for WMD authorization

**New Voting Service:**
```typescript
// NEW FILE: /lib/clanVotingService.ts
export async function initiateWMDVote(
  clanId: string,
  initiatorId: string,
  voteType: 'authorize_wmd' | 'launch_clan_buster'
): Promise<{ voteId: string }> {
  // 1. Check permissions
  const clan = await getClan(clanId);
  const member = clan.members.find(m => m.playerId === initiatorId);
  
  if (!hasPermission(member.role, 'canManageWars')) {
    throw new Error('Only Leader/Co-Leader/Officer can initiate vote');
  }
  
  // 2. Check clan requirements
  if (clan.level.level < 5) {
    throw new Error('Clan must be Level 5+');
  }
  
  if (clan.members.length < 5) {
    throw new Error('Clan must have 5+ members');
  }
  
  // 3. Create vote
  const vote = await db.collection('wmd_clan_votes').insertOne({
    clanId,
    voteType,
    initiatedBy: initiatorId,
    description: `Authorize WMD program (requires 60% approval)`,
    requiredApprovalPercent: 60,
    yesVotes: 0,
    noVotes: 0,
    abstainVotes: 0,
    voters: [],
    status: 'active',
    createdAt: new Date(),
    votingEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
  });
  
  // 4. Notify clan members (use existing broadcast system)
  await broadcastToClan(io, clanId, 'clan:wmd_vote_started', {
    voteId: vote.insertedId.toString(),
    voteType,
    initiator: member.username,
  });
  
  return { voteId: vote.insertedId.toString() };
}
```

#### **2. Clan Permissions**
**Location:** `/types/clan.types.ts` (line 149-330)  
**Status:** ✅ Complete 6-role permission matrix

**WMD Permission Additions:**
```typescript
// ADD TO ClanPermissions interface (line 155-185):
export interface ClanPermissions {
  // ... existing 21 permissions
  canInitiateWMDVote: boolean;            // Start WMD authorization vote
  canVoteOnWMD: boolean;                  // Cast vote (all members)
  canLaunchMissile: boolean;              // Authorize missile launch
  canDeclareOpposition: boolean;          // Declare opposition to WMD clan
}

// ADD TO ROLE_PERMISSIONS (line 187-330):
[ClanRole.LEADER]: {
  // ... existing permissions
  canInitiateWMDVote: true,
  canVoteOnWMD: true,
  canLaunchMissile: true,
  canDeclareOpposition: true,
},
[ClanRole.CO_LEADER]: {
  // ... existing permissions
  canInitiateWMDVote: true,
  canVoteOnWMD: true,
  canLaunchMissile: true,
  canDeclareOpposition: true,
},
[ClanRole.OFFICER]: {
  // ... existing permissions
  canInitiateWMDVote: true,
  canVoteOnWMD: true,
  canLaunchMissile: false,
  canDeclareOpposition: true,
},
[ClanRole.ELITE]: {
  // ... existing permissions
  canInitiateWMDVote: false,
  canVoteOnWMD: true,
  canLaunchMissile: false,
  canDeclareOpposition: false,
},
[ClanRole.MEMBER]: {
  // ... existing permissions
  canInitiateWMDVote: false,
  canVoteOnWMD: true,
  canLaunchMissile: false,
  canDeclareOpposition: false,
},
[ClanRole.RECRUIT]: {
  // ... existing permissions
  canInitiateWMDVote: false,
  canVoteOnWMD: false,                    // Recruits can't vote
  canLaunchMissile: false,
  canDeclareOpposition: false,
},
```

#### **3. Clan Activity Logging**
**Location:** `/lib/clanActivityService.ts` (exists, used in clanService.ts)  
**Status:** ✅ Operational activity feed

**WMD Activity Types to Add:**
```typescript
// ADD TO ClanActivityType enum in clan.types.ts:
export enum ClanActivityType {
  // ... existing types
  WMD_VOTE_STARTED = 'WMD_VOTE_STARTED',
  WMD_VOTE_PASSED = 'WMD_VOTE_PASSED',
  WMD_VOTE_FAILED = 'WMD_VOTE_FAILED',
  WMD_PROGRAM_AUTHORIZED = 'WMD_PROGRAM_AUTHORIZED',
  WMD_TECH_UNLOCKED = 'WMD_TECH_UNLOCKED',
  WMD_MISSILE_ASSEMBLED = 'WMD_MISSILE_ASSEMBLED',
  WMD_MISSILE_LAUNCHED = 'WMD_MISSILE_LAUNCHED',
  WMD_DEFENSE_GRID_ACTIVE = 'WMD_DEFENSE_GRID_ACTIVE',
  WMD_SPY_MISSION_LAUNCHED = 'WMD_SPY_MISSION_LAUNCHED',
  WMD_SABOTAGE_SUFFERED = 'WMD_SABOTAGE_SUFFERED',
}
```

**Usage:**
```typescript
// In missileService.ts:
import { logClanActivity } from '@/lib/clanActivityService';

await logClanActivity({
  clanId: player.clanId,
  activityType: ClanActivityType.WMD_MISSILE_LAUNCHED,
  playerId: userId,
  metadata: {
    missileId: missile._id.toString(),
    warheadType: missile.warheadType,
    targetClan: targetClan.name,
  },
});
```

---

## 📡 NOTIFICATION & WEBSOCKET INTEGRATION

### **Existing WebSocket Infrastructure:**

#### **1. Broadcast System**
**Location:** `/lib/websocket/broadcast.ts` (line 1-600)  
**Status:** ✅ Complete broadcasting infrastructure

**Available Broadcast Functions:**
```typescript
// Global broadcasts (line 57-85):
broadcastToAll(io, event, payload)              // Server-wide announcements

// Clan broadcasts (line 187-230):
broadcastToClan(io, clanId, event, payload)     // All clan members
broadcastToClans(io, clanIds[], event, payload) // Multiple clans

// User-specific (line 113-135):
broadcastToUser(io, userId, event, payload)     // Individual notifications

// Location-based (line 479-540):
broadcastToLocation(io, x, y, event, payload)   // Nearby players
broadcastToArea(io, centerX, centerY, radius)   // Area of effect
```

**WMD Integration:**
```typescript
// NEW FUNCTIONS to add to broadcast.ts:

/**
 * Broadcasts WMD authorization to entire server
 */
export async function broadcastWMDAuthorization(
  io: Server,
  payload: {
    clanId: string;
    clanName: string;
    clanTag: string;
    authorizedAt: Date;
  }
): Promise<void> {
  await broadcastToAll(io, 'system:wmd_authorized', {
    type: 'critical',
    title: '☢️ WMD PROGRAM AUTHORIZED',
    message: `The [${payload.clanTag}] clan has authorized weapons of mass destruction development!`,
    clanId: payload.clanId,
    clanName: payload.clanName,
    timestamp: payload.authorizedAt.getTime(),
  });
  
  // Also log to global notifications
  await createGlobalNotification({
    eventType: 'clan_authorization',
    actorClanId: payload.clanId,
    message: `[${payload.clanTag}] authorized WMD program`,
    icon: '☢️',
  });
}

/**
 * Broadcasts missile launch to affected clans
 */
export async function broadcastMissileLaunch(
  io: Server,
  payload: {
    attackerClan: string;
    targetClan: string;
    warheadType: string;
    impactTime: Date;
  }
): Promise<void> {
  // Notify both clans
  await broadcastToClans(io, [payload.attackerClan, payload.targetClan], 
    'clan:wmd_launch', payload);
  
  // Global notification
  await broadcastToAll(io, 'system:missile_launched', {
    type: 'warning',
    title: '🚀 MISSILE LAUNCHED',
    message: `Strategic missile inbound to ${payload.targetClan}`,
    timestamp: Date.now(),
  });
}

/**
 * Broadcasts intelligence leak (probabilistic)
 */
export async function broadcastIntelligenceLeak(
  io: Server,
  targetId: string,
  leakData: {
    targetUsername: string;
    leakType: string;
    revealedInfo: string;
  }
): Promise<void> {
  // Global leak announcement (everyone sees it)
  await broadcastToAll(io, 'system:intelligence_leak', {
    type: 'info',
    title: '🕵️ INTELLIGENCE LEAK',
    message: `${leakData.targetUsername}'s ${leakData.leakType}: ${leakData.revealedInfo}`,
    timestamp: Date.now(),
  });
  
  // Private notification to target (you've been leaked)
  await broadcastToUser(io, targetId, 'system:leak_alert', {
    type: 'warning',
    title: '⚠️ INTELLIGENCE COMPROMISED',
    message: `Your ${leakData.leakType} information has been leaked!`,
    timestamp: Date.now(),
  });
}
```

#### **2. WebSocket Event Types**
**Location:** `/types/websocket.ts` (line 1-490)  
**Status:** ✅ Comprehensive type system

**WMD Event Types to Add:**
```typescript
// ADD TO ServerToClientEvents interface (line 350-385):
export interface ServerToClientEvents {
  // ... existing events
  
  // WMD System Events
  'system:wmd_authorized': (payload: {
    type: 'critical';
    title: string;
    message: string;
    clanId: string;
    clanName: string;
    timestamp: number;
  }) => void;
  
  'system:missile_launched': (payload: {
    type: 'warning';
    title: string;
    message: string;
    timestamp: number;
  }) => void;
  
  'system:intelligence_leak': (payload: {
    type: 'info';
    title: string;
    message: string;
    timestamp: number;
  }) => void;
  
  'clan:wmd_vote_started': (payload: {
    voteId: string;
    voteType: string;
    initiator: string;
  }) => void;
  
  'clan:wmd_launch': (payload: {
    attackerClan: string;
    targetClan: string;
    warheadType: string;
    impactTime: Date;
  }) => void;
  
  'system:leak_alert': (payload: {
    type: 'warning';
    title: string;
    message: string;
    timestamp: number;
  }) => void;
}
```

#### **3. WebSocket Rooms**
**Location:** `/lib/websocket/rooms.ts` (line 49-150)  
**Status:** ✅ Room management system

**WMD Rooms Usage:**
```typescript
// Use existing room functions:
import { 
  joinUserRoom,      // User-specific notifications
  joinClanRoom,      // Clan WMD updates
  joinGlobalRoom,    // Global WMD events
} from '@/lib/websocket/rooms';

// On user connection:
socket.on('connection', async (socket) => {
  const user = await authenticateSocket(socket);
  
  // Join personal room (spy mission alerts)
  await joinUserRoom(socket, user.userId);
  
  // Join clan room if in clan (WMD votes, launches)
  if (user.clanId) {
    await joinClanRoom(socket, user.clanId);
  }
  
  // Join global room (WMD authorizations)
  await joinGlobalRoom(socket);
});
```

---

## 🔌 API LAYER INTEGRATION

### **Existing API Patterns:**

#### **1. Authentication Middleware**
**Location:** `/middleware.ts`  
**Status:** ✅ JWT authentication operational

**All WMD APIs will use existing auth:**
```typescript
// In /app/api/wmd/[endpoint]/route.ts:
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function POST(request: NextRequest) {
  // Authentication handled by middleware.ts
  const token = request.cookies.get('darkframe-token')?.value;
  
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')
  );
  
  const userId = payload.userId as string;
  
  // Continue with WMD logic...
}
```

#### **2. API Error Handling Pattern**
**Location:** Consistent across `/app/api/**/route.ts` files  
**Pattern to Follow:**
```typescript
// Standard pattern from /app/api/research/route.ts (line 83-120):
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const token = request.cookies.get('darkframe-token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // 2. Parse request
    const body = await request.json();
    const { technologyId } = body;
    
    if (!technologyId) {
      return NextResponse.json({ success: false, error: 'Missing technologyId' }, { status: 400 });
    }
    
    // 3. Validate with database
    const db = await connectToDatabase();
    const player = await db.collection('players').findOne({ username: userId });
    
    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }
    
    // 4. Business logic
    const result = await unlockTechnology(userId, technologyId);
    
    // 5. Success response
    return NextResponse.json({ success: true, data: result }, { status: 200 });
    
  } catch (error) {
    console.error('Research API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**WMD APIs will follow this EXACT pattern:**
```typescript
// /app/api/wmd/research/unlock/route.ts
export async function POST(request: NextRequest) {
  try {
    // Auth
    const userId = await authenticate(request);
    
    // Parse
    const { treeType, techId } = await request.json();
    
    // Validate
    if (!['missile', 'defense', 'intelligence'].includes(treeType)) {
      return NextResponse.json({ error: 'Invalid tree type' }, { status: 400 });
    }
    
    // Execute
    const result = await unlockWMDTech(userId, treeType, techId);
    
    // Respond
    return NextResponse.json({ success: true, data: result }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### **3. Existing Clan API Patterns**
**Location:** `/app/api/clan/**/route.ts` (multiple files)  
**Reference:** `/app/api/clan/research/unlock/route.ts`

**Permission Check Pattern:**
```typescript
// From clan research unlock API (line 50-70):
const clan = await db.collection('clans').findOne({ _id: new ObjectId(clanId) });
const member = clan.members.find((m: any) => m.playerId === userId);

if (!member) {
  return NextResponse.json(
    { success: false, error: 'Not a member of this clan' },
    { status: 403 }
  );
}

const allowedRoles = ['LEADER', 'CO_LEADER', 'OFFICER'];
if (!allowedRoles.includes(member.role)) {
  return NextResponse.json(
    { success: false, error: 'Insufficient permissions' },
    { status: 403 }
  );
}

// WMD vote API will use same pattern:
if (!hasPermission(member.role, 'canInitiateWMDVote')) {
  return NextResponse.json(
    { success: false, error: 'Only Leader/Co-Leader/Officer can initiate WMD votes' },
    { status: 403 }
  );
}
```

---

## 🎨 UI COMPONENT INTEGRATION

### **Existing UI Patterns:**

#### **1. Panel Component System**
**Location:** `/components/ui/Panel.tsx`  
**Status:** ✅ Collapsible panel system with event bubbling fix

**WMD Panels Will Use This:**
```typescript
import { Panel } from '@/components/ui';

export default function MissileResearchPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  return (
    <Panel
      title="☢️ Missile Research"
      collapsible
      defaultCollapsed={false}
      className="bg-red-900/20 border-red-500/30"
    >
      {/* Research tree content */}
    </Panel>
  );
}
```

#### **2. Tech Tree UI Pattern**
**Location:** `/app/tech-tree/page.tsx` (line 370-526)  
**Pattern:** Technology cards with prerequisites, costs, and unlock buttons

**WMD Research Panels Will Adapt This:**
```typescript
// Tech card layout from existing tech tree:
<div className="bg-gray-800/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6">
  {/* Icon */}
  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20">
    {/* Tech icon */}
  </div>
  
  {/* Title */}
  <h3 className="text-xl font-bold text-cyan-400 text-center mb-2">
    {tech.name}
  </h3>
  
  {/* Description */}
  <p className="text-sm text-white/70 text-center mb-4">
    {tech.description}
  </p>
  
  {/* Effects */}
  <div className="space-y-2 mb-4">
    {tech.effects.map((effect, i) => (
      <div key={i} className="flex items-center gap-2 text-xs text-white/60">
        <Zap className="w-3 h-3 text-yellow-400" />
        <span>{effect}</span>
      </div>
    ))}
  </div>
  
  {/* Prerequisites */}
  {tech.prerequisites.length > 0 && (
    <div className="mb-4">
      <p className="text-xs text-white/50 mb-1">Requires:</p>
      {/* Prereq badges */}
    </div>
  )}
  
  {/* Cost and Action */}
  <div className="flex items-center justify-between pt-4 border-t border-white/10">
    <div>
      <p className="text-xs text-white/50">Cost</p>
      <p className="text-lg font-bold text-yellow-400">{tech.cost.toLocaleString()}</p>
    </div>
    <button
      onClick={() => handleResearch(tech.id)}
      disabled={!canResearch(tech)}
      className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-4 py-2 rounded"
    >
      Research
    </button>
  </div>
</div>

// WMD version will be nearly identical (just change colors):
<div className="bg-gray-800/50 backdrop-blur-sm border border-red-500/30 rounded-lg p-6">
  {/* Same structure, red theme */}
</div>
```

#### **3. Clan Panel Integration**
**Location:** `/components/clan/ClanPanel.tsx` (line 312-400)  
**Pattern:** Tabbed interface with role-based visibility

**WMD Tab to Add:**
```typescript
// Add to ClanTab type (line 18):
type ClanTab = 'overview' | 'members' | 'research' | 'bank' | 'wmd';

// Add tab button (line 350):
<button
  onClick={() => setActiveTab('wmd')}
  className={`px-4 py-2 rounded-t-lg ${
    activeTab === 'wmd'
      ? 'bg-red-600 text-white'
      : 'bg-gray-700/50 text-white/60 hover:bg-gray-700'
  }`}
>
  ☢️ WMD
</button>

// Add tab content (line 400):
{activeTab === 'wmd' && (
  <ClanWMDPanel
    clan={clanData}
    playerRole={playerRole}
    onRefresh={onRefresh}
  />
)}
```

#### **4. Notification System**
**Location:** Uses `sonner` toast library  
**Pattern:** `toast.success()`, `toast.error()`, `toast.info()`

**WMD Notifications:**
```typescript
import { toast } from 'sonner';

// Vote started
toast.info('☢️ WMD Authorization Vote Started', {
  description: `${initiatorName} has initiated a vote. Check clan panel to vote.`,
  duration: 10000,
});

// Vote passed
toast.success('☢️ WMD PROGRAM AUTHORIZED', {
  description: `Your clan can now develop weapons of mass destruction.`,
  duration: 15000,
});

// Incoming missile
toast.error('🚀 INCOMING MISSILE', {
  description: `Strategic warhead will impact in ${timeRemaining}. Activate defense grid!`,
  duration: 30000,
});

// Sabotage suffered
toast.warning('🕵️ SABOTAGE DETECTED', {
  description: `Nuclear Sabotage destroyed all missile components!`,
  duration: 10000,
});
```

---

## 🔒 SECURITY & PERMISSIONS INTEGRATION

### **Existing Security Patterns:**

#### **1. OWASP Top 10 Compliance**
**Current State:** Project follows OWASP guidelines  
**WMD Compliance:**

**A01:2021 - Broken Access Control**
```typescript
// Always check permissions before WMD operations:
export async function launchMissile(userId: string, missileId: string) {
  // 1. Verify ownership
  const missile = await db.collection('wmd_missiles').findOne({ _id: new ObjectId(missileId) });
  if (missile.ownerId !== userId) {
    throw new Error('Not authorized to launch this missile');
  }
  
  // 2. Verify clan membership
  const player = await db.collection('players').findOne({ username: userId });
  if (!player.clanId) {
    throw new Error('Must be in clan to launch missiles');
  }
  
  // 3. Verify clan authorization
  const clan = await db.collection('clans').findOne({ _id: new ObjectId(player.clanId) });
  if (!clan.wmd?.programAuthorized) {
    throw new Error('Clan has not authorized WMD program');
  }
  
  // 4. Verify role permissions
  const member = clan.members.find(m => m.playerId === userId);
  if (!hasPermission(member.role, 'canLaunchMissile')) {
    throw new Error('Insufficient permissions to launch missiles');
  }
  
  // Proceed with launch...
}
```

**A03:2021 - Injection**
```typescript
// Always use parameterized queries:
const mission = await db.collection('wmd_spy_missions').findOne({
  _id: new ObjectId(missionId),  // SAFE: ObjectId validation
  attackerId: userId              // SAFE: Direct string comparison
});

// NEVER do this:
// const query = `SELECT * FROM missions WHERE id = '${missionId}'`;  ❌ SQL INJECTION
```

**A05:2021 - Security Misconfiguration**
```typescript
// Never expose sensitive data in logs:
console.log('Missile launched:', {
  missileId: missile._id.toString(),
  warheadType: missile.warheadType,
  // ❌ DON'T LOG: targetCoordinates, exact damage, stealth level
});

// Never return sensitive intel in API responses:
return NextResponse.json({
  success: true,
  intelligence: {
    targetHasMissiles: true,
    estimatedCount: '5-10',       // ✅ Vague estimate
    // ❌ DON'T RETURN: exactMissileIds, componentDetails, launchCodes
  }
});
```

#### **2. Rate Limiting**
**Pattern:** Add rate limits to WMD APIs to prevent abuse

```typescript
// /app/api/wmd/intelligence/mission/route.ts
const RATE_LIMITS = {
  reconnaissance: 5,      // 5 per hour
  sabotage: 2,           // 2 per hour
  nuclear_sabotage: 1,   // 1 per day
};

export async function POST(request: NextRequest) {
  const userId = await authenticate(request);
  const { missionType } = await request.json();
  
  // Check rate limit
  const recentMissions = await db.collection('wmd_spy_missions').countDocuments({
    attackerId: userId,
    missionType,
    executedAt: { $gte: new Date(Date.now() - 3600000) }, // Last hour
  });
  
  if (recentMissions >= RATE_LIMITS[missionType]) {
    return NextResponse.json(
      { error: 'Mission rate limit exceeded. Try again later.' },
      { status: 429 }
    );
  }
  
  // Proceed...
}
```

#### **3. Input Validation**
**Pattern:** Validate all user inputs

```typescript
export async function POST(request: NextRequest) {
  const { targetId, missionType, spiesSent } = await request.json();
  
  // Type validation
  if (typeof targetId !== 'string') {
    return NextResponse.json({ error: 'Invalid targetId type' }, { status: 400 });
  }
  
  // Enum validation
  const validMissions = ['reconnaissance', 'sabotage_component', 'nuclear_sabotage'];
  if (!validMissions.includes(missionType)) {
    return NextResponse.json({ error: 'Invalid mission type' }, { status: 400 });
  }
  
  // Range validation
  if (spiesSent < 1 || spiesSent > 100) {
    return NextResponse.json({ error: 'Must send 1-100 spies' }, { status: 400 });
  }
  
  // Proceed...
}
```

---

## 🧪 TESTING INTEGRATION POINTS

### **Existing Testing Infrastructure:**

#### **1. Unit Test Pattern**
**Location:** None yet (need to create `/tests` folder)  
**Framework:** Jest (already in package.json)

**WMD Unit Tests:**
```typescript
// /tests/lib/wmd/researchService.test.ts
import { unlockWMDTech } from '@/lib/wmd/researchService';
import { spendResearchPoints } from '@/lib/xpService';

jest.mock('@/lib/xpService');
jest.mock('@/lib/mongodb');

describe('WMD Research Service', () => {
  describe('unlockWMDTech()', () => {
    it('should unlock tech when prerequisites met', async () => {
      const mockPlayer = {
        username: 'testUser',
        researchPoints: 1000,
      };
      
      (spendResearchPoints as jest.Mock).mockResolvedValue({
        success: true,
        newBalance: 500,
      });
      
      const result = await unlockWMDTech('testUser', 'missile', 'tier_1_warhead');
      
      expect(result.success).toBe(true);
      expect(result.unlocked).toBe(true);
      expect(spendResearchPoints).toHaveBeenCalledWith('testUser', 500, expect.any(String));
    });
    
    it('should reject when insufficient RP', async () => {
      (spendResearchPoints as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Insufficient RP',
      });
      
      await expect(
        unlockWMDTech('testUser', 'missile', 'tier_1_warhead')
      ).rejects.toThrow('Insufficient RP');
    });
    
    it('should reject when prerequisites not met', async () => {
      // Test prerequisite validation logic
    });
  });
});
```

#### **2. Integration Test Pattern**
**Framework:** Playwright (if we add it)

**Critical WMD Flows to Test:**
```typescript
// /tests/integration/wmd/authorization.spec.ts
test('Clan WMD Authorization Flow', async ({ page }) => {
  // 1. Login as clan leader
  await page.goto('/login');
  await page.fill('[name="username"]', 'clanLeader');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  // 2. Navigate to clan panel
  await page.press('body', 'c');
  await page.waitForSelector('.clan-panel');
  
  // 3. Click WMD tab
  await page.click('button:has-text("☢️ WMD")');
  
  // 4. Initiate vote
  await page.click('button:has-text("Initiate WMD Vote")');
  await page.waitForSelector('.vote-modal');
  
  // 5. Confirm vote
  await page.click('button:has-text("Start Vote")');
  
  // 6. Verify toast notification
  await expect(page.locator('.sonner-toast')).toContainText('WMD Authorization Vote Started');
  
  // 7. Vote YES
  await page.click('button:has-text("Vote YES")');
  
  // 8. Verify vote recorded
  await expect(page.locator('.vote-count')).toContainText('1 YES');
});

test('Missile Launch Flow', async ({ page }) => {
  // Test missile assembly, targeting, and launch
});

test('Spy Mission Flow', async ({ page }) => {
  // Test spy recruitment, mission launch, and results
});
```

#### **3. Manual Testing Checklist**
**Location:** `/docs/WMD_TESTING_PLAN.md` (to create)

**Phase 1: Research System**
- [ ] Unlock Tier 1 tech with RP
- [ ] Verify prerequisite validation
- [ ] Test insufficient RP rejection
- [ ] Confirm tech tree UI updates

**Phase 2: Clan Voting**
- [ ] Initiate WMD vote as Leader
- [ ] Verify Officer can initiate
- [ ] Confirm Member cannot initiate
- [ ] Test voting (YES/NO/ABSTAIN)
- [ ] Verify 60% threshold
- [ ] Confirm 72-hour expiration

**Phase 3: Missile System**
- [ ] Assemble missile (5 components)
- [ ] Target selection validation
- [ ] Launch authorization check
- [ ] Impact time calculation
- [ ] Damage distribution (Clan Buster)

**Phase 4: Defense System**
- [ ] Deploy defense battery
- [ ] Activate clan defense grid
- [ ] Test interception logic
- [ ] Verify grid contribution pooling

**Phase 5: Intelligence System**
- [ ] Recruit spies (3 types)
- [ ] Launch reconnaissance mission
- [ ] Test sabotage success/failure
- [ ] Verify Nuclear Sabotage destruction
- [ ] Confirm intelligence leak probability

**Phase 6: Notifications**
- [ ] Global WMD authorization broadcast
- [ ] Clan missile launch notification
- [ ] Personal sabotage alert
- [ ] Intelligence leak announcement
- [ ] WebSocket real-time updates

---

## 📊 INTEGRATION SUMMARY

### **Systems We're Building On:**

✅ **Research Points (RP) System**  
- Location: `/lib/xpService.ts`
- Status: Fully functional
- Integration: Direct reuse via `spendResearchPoints()`

✅ **Clan Management System**  
- Location: `/lib/clanService.ts`, `/types/clan.types.ts`
- Status: Complete 6-role permission system
- Integration: Extend permissions, adapt voting

✅ **WebSocket Broadcasting**  
- Location: `/lib/websocket/broadcast.ts`
- Status: Full broadcast infrastructure
- Integration: Add WMD-specific broadcast functions

✅ **Tech Tree UI Pattern**  
- Location: `/app/tech-tree/page.tsx`
- Status: Operational with prerequisites
- Integration: Clone pattern for WMD research panels

✅ **API Authentication**  
- Location: `/middleware.ts`
- Status: JWT auth operational
- Integration: Reuse for all WMD APIs

✅ **Database Connection**  
- Location: `/lib/mongodb.ts`
- Status: MongoDB Atlas connected
- Integration: Add 6 new collections

✅ **Activity Logging**  
- Location: `/lib/clanActivityService.ts`
- Status: Clan activity feed operational
- Integration: Add WMD activity types

### **New Systems to Build:**

🆕 **WMD Research Service** (`/lib/wmd/researchService.ts`)  
- Wraps existing RP system
- Implements tech tree logic
- Validates prerequisites

🆕 **Missile Management Service** (`/lib/wmd/missileService.ts`)  
- Assembly tracking
- Launch authorization
- Damage calculation

🆕 **Defense Service** (`/lib/wmd/defenseService.ts`)  
- Battery deployment
- Interception logic
- Clan defense grid pooling

🆕 **Spy Operations Service** (`/lib/wmd/spyService.ts`)  
- Mission success calculation
- Sabotage effects engine
- Intelligence leak probability

🆕 **Notification Service** (`/lib/wmd/notificationService.ts`)  
- Global event broadcasting
- Intelligence leak system
- WebSocket integration

🆕 **Clan Voting Service** (`/lib/clanVotingService.ts`)  
- WMD authorization votes
- Launch approval votes
- Opposition declarations

### **Integration Confidence Levels:**

🟢 **HIGH CONFIDENCE (90%+)**  
- RP spending integration
- Clan permission system
- WebSocket broadcasting
- Database schema design
- API authentication

🟡 **MEDIUM CONFIDENCE (70-90%)**  
- Clan voting system (new, but adapting existing patterns)
- UI component integration (new panels, but existing patterns)
- Damage calculation logic (new formulas)

🔴 **LOWER CONFIDENCE (50-70%)**  
- Balance tuning (costs, success rates, damage values)
- Intelligence leak probability (needs playtesting)
- Performance under high load (concurrent missile launches)

### **Critical Dependencies:**

**Must Complete Before Phase 1:**
1. ✅ Review existing RP system (DONE - fully functional)
2. ✅ Review clan permission system (DONE - operational)
3. ✅ Review WebSocket infrastructure (DONE - complete)
4. 🔄 Create database migration scripts (IN PLANNING)

**Must Complete Before Phase 2:**
1. 🔄 Implement clan voting service (NEW SYSTEM)
2. 🔄 Add WMD permissions to clan.types.ts
3. 🔄 Create vote API endpoints

**Must Complete Before Phase 3:**
1. 🔄 Research system fully operational
2. 🔄 Clan authorization system complete
3. 🔄 Global notification system live

---

## ✅ APPROVAL CHECKLIST

Before proceeding to implementation:

- [ ] **Database Schema Review:** All 12 tables reviewed and approved
- [ ] **Type System Review:** All 5 type files reviewed for completeness
- [ ] **Service Layer Review:** All 9 services mapped to existing systems
- [ ] **API Design Review:** All 32 endpoints follow existing patterns
- [ ] **Component Architecture Review:** All 20 components follow UI patterns
- [ ] **Permission System Review:** Clan permission extensions approved
- [ ] **WebSocket Integration Review:** Broadcast functions compatible
- [ ] **Testing Strategy Review:** Unit + integration tests planned
- [ ] **Balance Review:** Costs, timelines, and success rates approved
- [ ] **Timeline Review:** 15-week, 7-phase plan realistic

---

## 🚀 NEXT STEPS

Once this code review is approved:

1. **Phase 1 - Foundation (Weeks 1-3)**
   - Create database migration scripts
   - Write all TypeScript type definitions
   - Set up service layer scaffolding
   
2. **Phase 2 - Research System (Weeks 4-5)**
   - Implement research service (wraps existing RP system)
   - Build research UI panels
   - Create research API endpoints

3. **Phase 3 - Missile System (Weeks 6-8)**
   - Implement missile service
   - Build assembly and launch UI
   - Create missile API endpoints

---

**END OF CODE REVIEW**
