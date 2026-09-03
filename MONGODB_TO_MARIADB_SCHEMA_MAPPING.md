# DarkFrame MongoDB → MariaDB/Drizzle ORM Schema Mapping

> ⚠️ **STATUS: SUPERSEDED / HISTORICAL REFERENCE — marked 2026-09-02 (SESSION-2026-09-02-002).**
>
> This document describes the **abandoned intermediate direction** of the database migration
> (MongoDB → MariaDB/SkySQL via Drizzle, MySQL dialect). It is retained as a mapping reference only.
> It does **not** describe the current tree:
>
> - `lib/db/connection.ts` now uses the **Postgres** driver (`drizzle-orm/node-postgres` + `pg`), while
>   the 14 schema files in `lib/db/schema/` are still MySQL dialect — the migration is split mid-pivot
>   (audited 2026-09-01/02; see `SCOPE.md` item #7).
> - The claimed "TypeScript: 0 errors ✅" state no longer holds: `npx tsc --noEmit` = 2,043 errors.
> - Credentials referenced here as `.env.local` connection strings are now `DB_*` env vars
>   (remediated 2026-09-02; provider rotation still pending).
>
> Do not treat any table definition in this document as current ground truth. Verify against
> `lib/db/schema/` and the audit trail in `dev/session-summaries/` before relying on it.

## Overview

This document maps all MongoDB collections used in the DarkFrame project to MariaDB table schemas suitable for Drizzle ORM definitions. The DarkFrame project uses **username as the primary key** for players (not ObjectId), with ObjectId used only for auto-generated `_id` fields on some collections.

---

## Collection Inventory (23 Collections)

| # | Collection | Primary Key | Description |
|---|-----------|-------------|-------------|
| 1 | `players` | `username` (string) | Player accounts, inventory, units, stats |
| 2 | `tiles` | Composite `(x, y)` | Game map tiles with terrain and harvest tracking |
| 3 | `factories` | Composite `(x, y)` | Factory buildings with ownership and production |
| 4 | `clans` | `_id` (ObjectId) | Clan/guild entities |
| 5 | `clan_invitations` | `_id` (ObjectId) | Clan join invitations |
| 6 | `clan_activities` | `_id` (ObjectId) | Clan activity/event log |
| 7 | `clan_chat` | `_id` (ObjectId) | Clan chat messages |
| 8 | `clan_messages` | `_id` (ObjectId) | Clan messages (websocket) |
| 9 | `clan_territories` | `_id` (ObjectId) | Clan territory claims |
| 10 | `clan_wars` | `_id` (ObjectId) | Clan warfare records |
| 11 | `friends` | `_id` (ObjectId) | Friend relationships and blocks |
| 12 | `friendRequests` | `_id` (ObjectId) | Friend request workflow |
| 13 | `conversations` | `_id` (ObjectId) | Private message conversations |
| 14 | `messages` | `_id` (ObjectId) | Private message content |
| 15 | `chat_messages` | `_id` (ObjectId) | Global/channel chat messages |
| 16 | `chat_read_status` | (varies) | Chat read tracking |
| 17 | `battleLogs` | `battleId` (string) | Battle/combat history |
| 18 | `tutorial_progress` | `_id` (ObjectId) | Player tutorial progress |
| 19 | `tutorial_action_tracking` | `_id` (ObjectId) | Tutorial step action tracking |
| 20 | `referrals` | `_id` (ObjectId) | Referral tracking records |
| 21 | `missiles` | `_id` (ObjectId) | WMD missile entities |
| 22 | `player_research` | `_id` (ObjectId) | WMD research progress |
| 23 | `flags` | singleton (single doc) | Flag Bearer game state |

### Additional Collections (referenced but less critical)
| # | Collection | Description |
|---|-----------|-------------|
| 24 | `word_blacklist` | Profanity filter words |
| 25 | `items` | Game item definitions |
| 26 | `playerSessions` | Authentication sessions |
| 27 | `playerActivity` | Anti-cheat activity tracking |
| 28 | `playerFlags` | Anti-cheat flags |
| 29 | `gameConfig` | Game configuration (beer base settings, etc.) |
| 30 | `botConfig` | Bot spawning configuration |
| 31 | `shrine_blessings` | Active shrine blessings |
| 32 | `achievements` | Player achievement unlocks |
| 33 | `auctions` | Auction house listings |
| 34 | `migrations` | Database migration tracking |
| 35 | `typing_indicators` | Chat typing state (TTL) |
| 36 | `user_presence` | Online presence (TTL) |
| 37 | `mutes` | Moderation mutes |
| 38 | `bans` | Moderation bans |
| 39 | `mod_log` | Moderation audit log |
| 40 | `warnings` | Player warnings |

---

## 1. `players` Collection

**Primary Key:** `username` (VARCHAR(20))
**Unique Indexes:** `username`, `email`

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | YES | Auto-generated, rarely used |
| `username` | string | VARCHAR(20) | NO | **PRIMARY KEY**, unique |
| `email` | string | VARCHAR(255) | NO | Unique, login credential |
| `password` | string | VARCHAR(255) | NO | bcrypt hash |
| `base.x` | number | INT | NO | Base X coordinate (1-150) |
| `base.y` | number | INT | NO | Base Y coordinate (1-150) |
| `currentPosition.x` | number | INT | NO | Current map X |
| `currentPosition.y` | number | INT | NO | Current map Y |
| `resources.metal` | number | BIGINT | NO | Default 0 |
| `resources.energy` | number | BIGINT | NO | Default 0 |
| `bank.metal` | number | BIGINT | NO | Default 0 |
| `bank.energy` | number | BIGINT | NO | Default 0 |
| `bank.lastDeposit` | Date/null | DATETIME | YES | |
| `rank` | number | INT | YES | Default 1 |
| `inventory.items` | array | JSON | NO | Array of InventoryItem |
| `inventory.capacity` | number | INT | NO | Default 2000 |
| `inventory.metalDiggerCount` | number | INT | NO | Default 0 |
| `inventory.energyDiggerCount` | number | INT | NO | Default 0 |
| `gatheringBonus.metalBonus` | number | DECIMAL(5,2) | NO | Default 0 |
| `gatheringBonus.energyBonus` | number | DECIMAL(5,2) | NO | Default 0 |
| `activeBoosts.gatheringBoost` | number/null | DECIMAL(5,2) | YES | DEPRECATED |
| `activeBoosts.expiresAt` | Date/null | DATETIME | YES | DEPRECATED |
| `shrineBoosts` | array | JSON | NO | Array of ShrineBoost |
| `units` | array | JSON | NO | Array of PlayerUnit |
| `totalStrength` | number | INT | NO | Default 0 |
| `totalDefense` | number | INT | NO | Default 0 |
| `balanceEffects` | object | JSON | YES | BalanceEffects |
| `xp` | number | INT | NO | Default 0 |
| `level` | number | INT | NO | Default 1 |
| `researchPoints` | number | INT | NO | Default 0 |
| `unlockedTiers` | array | JSON | NO | Array of UnitTier (1-5) |
| `unlockedTechs` | array | JSON | YES | Array of string |
| `concentrationZones` | array | JSON | YES | Array of zone objects |
| `lastBotSummon` | Date | DATETIME | YES | 7-day cooldown |
| `fastTravelWaypoints` | array | JSON | YES | Max 5 waypoints |
| `lastFastTravel` | Date | DATETIME | YES | 12-hour cooldown |
| `dailyBounties` | object | JSON | YES | Daily bounty state |
| `specialization` | object | JSON | YES | Specialization object |
| `discoveries` | array | JSON | YES | Array of Discovery |
| `achievements` | array | JSON | YES | Array of Achievement |
| `stats` | object | JSON | YES | PlayerStats |
| `factoryCount` | number | INT | YES | Default 0 |
| `lastXPAward` | Date | DATETIME | YES | |
| `lastLevelUp` | Date | DATETIME | YES | |
| `rpHistory` | array | JSON | YES | Array of RP transactions |
| `baseGreeting` | string | VARCHAR(500) | YES | Max 500 chars |
| `battleStats` | object | JSON | YES | BattleStatistics |
| `isBot` | boolean | TINYINT(1) | YES | Default false |
| `isSpecialBase` | boolean | TINYINT(1) | YES | Beer Base flag |
| `botConfig` | object | JSON | YES | BotConfig (if isBot) |
| `clanId` | string | VARCHAR(24) | YES | FK → clans._id |
| `clanName` | string | VARCHAR(30) | YES | Denormalized |
| `clanRole` | string | VARCHAR(20) | YES | ClanRole enum |
| `clanLevel` | number | INT | YES | Denormalized |
| `isAdmin` | boolean | TINYINT(1) | YES | Default false |
| `vip` | boolean | TINYINT(1) | YES | Default false |
| `vipExpiration` | Date | DATETIME | YES | |
| `vipTier` | string | VARCHAR(20) | YES | VIP tier enum |
| `stripeCustomerId` | string | VARCHAR(255) | YES | |
| `stripeSubscriptionId` | string | VARCHAR(255) | YES | |
| `vipLastUpdated` | Date | DATETIME | YES | |
| `lastLoginDate` | Date | DATETIME | YES | |
| `loginStreak` | number | INT | YES | Default 0 |
| `lastStreakReward` | Date | DATETIME | YES | |
| `currentHP` | number | INT | YES | Default 1000 |
| `maxHP` | number | INT | YES | Default 1000 |
| `lastFlagAttack` | Date | DATETIME | YES | 60s cooldown |
| `referralCode` | string | VARCHAR(20) | YES | Unique code |
| `referralLink` | string | VARCHAR(255) | YES | Full URL |
| `referredBy` | string/null | VARCHAR(20) | YES | Referral code |
| `referredByUsername` | string/null | VARCHAR(20) | YES | Referrer username |
| `referralValidated` | boolean | TINYINT(1) | YES | |
| `referralValidatedAt` | Date/null | DATETIME | YES | |
| `totalReferrals` | number | INT | YES | Default 0 |
| `pendingReferrals` | number | INT | YES | Default 0 |
| `referralRewardsEarned.metal` | number | BIGINT | YES | |
| `referralRewardsEarned.energy` | number | BIGINT | YES | |
| `referralRewardsEarned.rp` | number | INT | YES | |
| `referralRewardsEarned.xp` | number | INT | YES | |
| `referralRewardsEarned.vipDays` | number | INT | YES | |
| `referralTitles` | array | JSON | YES | Array of string |
| `referralBadges` | array | JSON | YES | Array of string |
| `referralMultiplier` | number | DECIMAL(3,1) | YES | Default 1.0 |
| `lastReferralValidated` | Date/null | DATETIME | YES | |
| `referralMilestonesReached` | array | JSON | YES | Array of number |
| `signupIP` | string | VARCHAR(45) | YES | IPv4/IPv6 |
| `createdAt` | Date | DATETIME | YES | Auto-set |

### Indexes
- UNIQUE `username`
- UNIQUE `email`
- `clanId, clanRole` (compound)
- `level DESC` (leaderboard)
- `totalKills DESC` (if field exists)

### Relationships
- `clanId` → `clans._id` (Many-to-One)
- `referredBy` → `players.referralCode` (Self-reference)

---

## 2. `tiles` Collection

**Primary Key:** Composite `(x, y)`

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `x` | number | SMALLINT | NO | 1-150, part of PK |
| `y` | number | SMALLINT | NO | 1-150, part of PK |
| `terrain` | string (enum) | VARCHAR(20) | NO | TerrainType enum |
| `occupiedByBase` | boolean | TINYINT(1) | YES | |
| `baseOwner` | string | VARCHAR(20) | YES | FK → players.username |
| `baseGreeting` | string | VARCHAR(500) | YES | |
| `lastHarvestedBy` | array | JSON | YES | Array of HarvestRecord |
| `bankType` | string | VARCHAR(20) | YES | 'metal'\|'energy'\|'exchange' |
| `hasFlagBearer` | boolean | TINYINT(1) | YES | |
| `hasTrail` | boolean | TINYINT(1) | YES | |
| `trailTimestamp` | Date | DATETIME | YES | |
| `trailExpiresAt` | Date | DATETIME | YES | |

### Indexes
- UNIQUE `(x, y)` (compound primary key)

### Relationships
- `baseOwner` → `players.username` (Many-to-One)

---

## 3. `factories` Collection

**Primary Key:** Composite `(x, y)`

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `x` | number | SMALLINT | NO | 1-150, part of PK |
| `y` | number | SMALLINT | NO | 1-150, part of PK |
| `owner` | string/null | VARCHAR(20) | YES | FK → players.username |
| `defense` | number | INT | NO | Default value |
| `level` | number | INT | NO | 1-10, default 1 |
| `slots` | number | INT | NO | Available slots |
| `usedSlots` | number | INT | NO | Occupied slots |
| `productionRate` | number | DECIMAL(5,2) | NO | Units/hour |
| `lastSlotRegen` | Date | DATETIME | NO | |
| `lastResourceGeneration` | Date | DATETIME | YES | Passive income timestamp |
| `lastAttackedBy` | string/null | VARCHAR(20) | YES | |
| `lastAttackTime` | Date/null | DATETIME | YES | |

### Indexes
- UNIQUE `(x, y)`
- `owner` (player factories lookup)
- `clanId` (if present)

### Relationships
- `owner` → `players.username` (Many-to-One)

---

## 4. `clans` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `name` | string | VARCHAR(30) | NO | Unique |
| `tag` | string | VARCHAR(6) | NO | Unique, uppercase |
| `description` | string | TEXT | NO | |
| `leaderId` | string | VARCHAR(20) | NO | FK → players.username |
| `members` | array | JSON | NO | Array of ClanMember |
| `maxMembers` | number | INT | NO | Default 20 |
| `level.currentLevel` | number | INT | NO | 1-50 |
| `level.totalXP` | number | INT | NO | |
| `level.currentLevelXP` | number | INT | NO | |
| `level.xpToNextLevel` | number | INT | NO | |
| `level.featuresUnlocked` | array | JSON | NO | Array of string |
| `level.milestonesCompleted` | array | JSON | NO | Array of milestone objects |
| `level.lastLevelUp` | Date | DATETIME | YES | |
| `createdAt` | Date | DATETIME | NO | |
| `settings.messageOfTheDay` | string | VARCHAR(500) | NO | |
| `settings.isRecruiting` | boolean | TINYINT(1) | NO | |
| `settings.minLevelToJoin` | number | INT | NO | |
| `settings.requiresApproval` | boolean | TINYINT(1) | NO | |
| `settings.allowTerritoryControl` | boolean | TINYINT(1) | NO | |
| `settings.allowWarDeclarations` | boolean | TINYINT(1) | NO | |
| `stats.totalPower` | number | INT | NO | |
| `stats.totalTerritories` | number | INT | NO | |
| `stats.totalMonuments` | number | INT | NO | |
| `stats.warsWon` | number | INT | NO | |
| `stats.warsLost` | number | INT | NO | |
| `stats.totalRP` | number | INT | NO | |
| `research.researchPoints` | number | INT | NO | |
| `research.unlockedTechs` | array | JSON | NO | Array of string |
| `research.activeResearch` | string/null | VARCHAR(50) | YES | |
| `bank.treasury.metal` | number | BIGINT | NO | |
| `bank.treasury.energy` | number | BIGINT | NO | |
| `bank.treasury.researchPoints` | number | INT | NO | |
| `bank.taxRates.metal` | number | DECIMAL(5,2) | NO | 0-50% |
| `bank.taxRates.energy` | number | DECIMAL(5,2) | NO | 0-50% |
| `bank.taxRates.researchPoints` | number | DECIMAL(5,2) | NO | 0-50% |
| `bank.upgradeLevel` | number | INT | NO | 1-6 |
| `bank.capacity` | number | BIGINT | NO | |
| `bank.transactions` | array | JSON | NO | Last 100 transactions |
| `activePerks` | array | JSON | NO | Array of ClanPerk |
| `territories` | array | JSON | NO | Array of ClanTerritory |
| `monuments` | array | JSON | NO | Array of MonumentType enum |
| `wars.active` | array | JSON | NO | Array of ClanWar |
| `wars.history` | array | JSON | NO | Array of ClanWar |

### Indexes
- UNIQUE `name`
- UNIQUE `tag`
- `level DESC, power DESC` (leaderboard)
- `power DESC`
- `territoryCount DESC`
- `totalWealth DESC`

### Relationships
- `leaderId` → `players.username` (Many-to-One)
- Members embedded as JSON array (normalization target below)

---

## 5. `clan_invitations` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `clanId` | string | VARCHAR(24) | NO | FK → clans._id |
| `clanName` | string | VARCHAR(30) | NO | Denormalized |
| `inviterId` | string | VARCHAR(20) | NO | FK → players.username |
| `inviterUsername` | string | VARCHAR(20) | NO | |
| `inviteeId` | string | VARCHAR(20) | NO | FK → players.username |
| `inviteeUsername` | string | VARCHAR(20) | NO | |
| `createdAt` | Date | DATETIME | NO | |
| `expiresAt` | Date | DATETIME | NO | 7 days from creation |
| `status` | string | VARCHAR(20) | NO | pending/accepted/expired |
| `acceptedAt` | Date | DATETIME | YES | |

### Indexes
- `clanId`
- `inviteeId, status` (compound)
- `expiresAt` (for cleanup)

### Relationships
- `clanId` → `clans._id` (Many-to-One)
- `inviterId` → `players.username` (Many-to-One)
- `inviteeId` → `players.username` (Many-to-One)

---

## 6. `clan_activities` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `clanId` | string | VARCHAR(24) | NO | FK → clans._id |
| `activityType` | string (enum) | VARCHAR(40) | NO | ClanActivityType |
| `playerId` | string | VARCHAR(20) | YES | FK → players.username |
| `metadata` | object | JSON | NO | Activity-specific details |
| `timestamp` | Date | DATETIME | NO | |

### Indexes
- `clanId, timestamp DESC` (compound)

### Relationships
- `clanId` → `clans._id` (Many-to-One)
- `playerId` → `players.username` (Many-to-One)

---

## 7. `clan_chat` / `clan_messages` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `clanId` | string | VARCHAR(24) | NO | FK → clans._id |
| `senderId` | string | VARCHAR(20) | NO | FK → players.username |
| `senderUsername` | string | VARCHAR(20) | NO | |
| `message` | string | TEXT | NO | Max 500 chars |
| `timestamp` | Date | DATETIME | NO | |
| `channel` | string | VARCHAR(20) | YES | general/officer/leader |

### Indexes
- `clanId, timestamp DESC` (compound)

---

## 8. `friends` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `userId` | string | VARCHAR(20) | NO | FK → players.username (initiator) |
| `friendId` | string | VARCHAR(20) | NO | FK → players.username (acceptor) |
| `status` | string (enum) | VARCHAR(20) | NO | accepted/blocked |
| `initiatedBy` | string | VARCHAR(20) | NO | Who sent the request |
| `createdAt` | Date | DATETIME | NO | |
| `updatedAt` | Date | DATETIME | NO | |
| `isBlocked` | boolean | TINYINT(1) | YES | |
| `blockedBy` | string | VARCHAR(20) | YES | Who blocked |

### Indexes
- UNIQUE `(userId, friendId, status)` (compound)
- `(friendId, userId, status)` (reverse lookup)
- `(status, createdAt DESC)` (for listing)

### Relationships
- `userId` → `players.username` (Many-to-One)
- `friendId` → `players.username` (Many-to-One)

---

## 9. `friendRequests` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `from` | string | VARCHAR(20) | NO | FK → players.username |
| `to` | string | VARCHAR(20) | NO | FK → players.username |
| `status` | string (enum) | VARCHAR(20) | NO | pending/accepted/declined/cancelled |
| `message` | string | VARCHAR(200) | YES | Max 200 chars |
| `createdAt` | Date | DATETIME | NO | |
| `respondedAt` | Date | DATETIME | YES | |
| `expiresAt` | Date | DATETIME | YES | 30 days from creation |

### Indexes
- UNIQUE `(from, to, status)` for pending (compound)
- `(to, status, createdAt DESC)` (received requests)
- `(from, status)` (sent requests)
- `expiresAt` (TTL/cleanup)

### Relationships
- `from` → `players.username` (Many-to-One)
- `to` → `players.username` (Many-to-One)

---

## 10. `conversations` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `participants` | array[2] | JSON | NO | Exactly 2 player IDs |
| `participantDetails` | object | JSON | YES | Per-participant metadata |
| `lastMessage.content` | string | VARCHAR(1000) | YES | |
| `lastMessage.senderId` | string | VARCHAR(20) | YES | |
| `lastMessage.createdAt` | Date | DATETIME | YES | |
| `lastMessage.status` | string | VARCHAR(20) | YES | |
| `unreadCount` | object | JSON | NO | Per-participant counts |
| `createdAt` | Date | DATETIME | NO | |
| `updatedAt` | Date | DATETIME | NO | Last activity |
| `isArchived` | object | JSON | YES | Per-participant |
| `isPinned` | object | JSON | YES | Per-participant |
| `metadata.totalMessages` | number | INT | YES | |
| `metadata.firstMessageAt` | Date | DATETIME | YES | |
| `metadata.muteUntil` | object | JSON | YES | Per-participant |

### Indexes
- `participants` (array index, needs normalization for SQL)
- `updatedAt DESC` (recent conversations)

### Relationships
- Participants → `players.username` (Many-to-Many via junction)

---

## 11. `messages` Collection (Private Messages)

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `conversationId` | ObjectId | VARCHAR(24) | NO | FK → conversations._id |
| `senderId` | string | VARCHAR(20) | NO | FK → players.username |
| `recipientId` | string | VARCHAR(20) | NO | FK → players.username |
| `content` | string | VARCHAR(1000) | NO | |
| `contentType` | string (enum) | VARCHAR(20) | NO | text/system/notification |
| `status` | string (enum) | VARCHAR(20) | NO | sending/sent/delivered/read/failed |
| `createdAt` | Date | DATETIME | NO | |
| `readAt` | Date | DATETIME | YES | |
| `editedAt` | Date | DATETIME | YES | |
| `deletedAt` | Date | DATETIME | YES | Soft delete |
| `metadata.originalContent` | string | VARCHAR(1000) | YES | Before profanity filter |
| `metadata.editHistory` | array | JSON | YES | Array of edits |
| `metadata.systemType` | string | VARCHAR(20) | YES | achievement/battle/trade |
| `metadata.relatedEntityId` | string | VARCHAR(50) | YES | |

### Indexes
- `conversationId, createdAt DESC` (compound)
- `recipientId, status` (unread messages)
- `deletedAt` (soft delete filter)

### Relationships
- `conversationId` → `conversations._id` (Many-to-One)
- `senderId` → `players.username` (Many-to-One)
- `recipientId` → `players.username` (Many-to-One)

---

## 12. `chat_messages` Collection (Global Chat)

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `channelId` | string (enum) | VARCHAR(30) | NO | ChannelType |
| `clanId` | string | VARCHAR(24) | YES | FK → clans._id, sparse |
| `senderId` | string | VARCHAR(20) | NO | FK → players.username |
| `senderUsername` | string | VARCHAR(20) | NO | |
| `senderLevel` | number | INT | NO | |
| `isVIP` | boolean | TINYINT(1) | NO | |
| `isNewbie` | boolean | TINYINT(1) | NO | Level 1-5 |
| `message` | string | VARCHAR(1000) | NO | |
| `itemLinks` | array | JSON | NO | Array of string |
| `mentions` | array | JSON | NO | Array of string |
| `timestamp` | Date | DATETIME | NO | |
| `monthCategory` | string | VARCHAR(7) | NO | "YYYY-MM" format |
| `edited` | boolean | TINYINT(1) | NO | Default false |
| `editedAt` | Date | DATETIME | YES | |
| `deleted` | boolean | TINYINT(1) | NO | Default false |
| `deletedBy` | string | VARCHAR(20) | YES | Admin username |
| `deletionReason` | string | VARCHAR(255) | YES | |

### Indexes
- `(channelId, timestamp DESC)` (compound)
- `monthCategory` (for cleanup)
- `senderId` (user history)
- `clanId` (sparse, clan channels)

### Relationships
- `senderId` → `players.username` (Many-to-One)
- `clanId` → `clans._id` (Many-to-One)

---

## 13. `battleLogs` Collection

**Primary Key:** `battleId` (string, generated)

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `battleId` | string | VARCHAR(50) | NO | **PRIMARY KEY** |
| `battleType` | string (enum) | VARCHAR(20) | NO | Infantry/Base/Factory |
| `timestamp` | Date | DATETIME | NO | |
| `attacker.username` | string | VARCHAR(20) | NO | FK → players.username |
| `attacker.units` | array | JSON | NO | Array of Unit objects |
| `attacker.totalSTR` | number | INT | NO | |
| `attacker.totalDEF` | number | INT | NO | |
| `attacker.initialHP` | number | INT | NO | |
| `attacker.finalHP` | number | INT | NO | |
| `attacker.unitsLost` | number | INT | NO | |
| `attacker.unitsCaptured` | number | INT | NO | |
| `attacker.startingHP` | number | INT | NO | Alias for initialHP |
| `attacker.endingHP` | number | INT | NO | Alias for finalHP |
| `attacker.damageDealt` | number | INT | NO | |
| `attacker.xpEarned` | number | INT | NO | |
| `defender.username` | string | VARCHAR(20) | NO | FK → players.username |
| `defender.units` | array | JSON | NO | Array of Unit objects |
| `defender.totalSTR` | number | INT | NO | |
| `defender.totalDEF` | number | INT | NO | |
| `defender.initialHP` | number | INT | NO | |
| `defender.finalHP` | number | INT | NO | |
| `defender.unitsLost` | number | INT | NO | |
| `defender.unitsCaptured` | number | INT | NO | |
| `defender.startingHP` | number | INT | NO | Alias |
| `defender.endingHP` | number | INT | NO | Alias |
| `defender.damageDealt` | number | INT | NO | |
| `defender.xpEarned` | number | INT | NO | |
| `outcome` | string (enum) | VARCHAR(20) | NO | AttackerWin/DefenderWin/Draw |
| `rounds` | array | JSON | NO | Array of CombatRound |
| `totalRounds` | number | INT | NO | |
| `unitsCaptured.attackerCaptured` | array | JSON | YES | Array of Unit |
| `unitsCaptured.defenderCaptured` | array | JSON | YES | Array of Unit |
| `attackerXP` | number | INT | NO | |
| `defenderXP` | number | INT | NO | |
| `resourcesStolen.resourceType` | string | VARCHAR(20) | YES | metal/energy |
| `resourcesStolen.amount` | number | BIGINT | YES | |
| `location.x` | number | SMALLINT | YES | |
| `location.y` | number | SMALLINT | YES | |

### Indexes
- `(attacker.username, timestamp DESC)` (compound)
- `(defender.username, timestamp DESC)` (compound)
- `timestamp DESC` (recent battles)

### Relationships
- `attacker.username` → `players.username` (Many-to-One)
- `defender.username` → `players.username` (Many-to-One)

---

## 14. `tutorial_progress` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `playerId` | string | VARCHAR(20) | NO | FK → players.username, UNIQUE |
| `currentQuestId` | string | VARCHAR(50) | YES | |
| `currentStepIndex` | number | INT | NO | 0-indexed |
| `completedQuests` | array | JSON | NO | Array of string |
| `completedSteps` | array | JSON | NO | Array of string |
| `skippedQuests` | array | JSON | NO | Array of string |
| `claimedRewards` | array | JSON | NO | Array of string |
| `tutorialSkipped` | boolean | TINYINT(1) | NO | |
| `tutorialDeclined` | boolean | TINYINT(1) | YES | |
| `tutorialComplete` | boolean | TINYINT(1) | NO | |
| `startedAt` | Date | DATETIME | NO | |
| `currentStepStartedAt` | Date | DATETIME | YES | |
| `completedAt` | Date | DATETIME | YES | |
| `declinedAt` | Date | DATETIME | YES | |
| `lastUpdated` | Date | DATETIME | NO | |
| `totalStepsCompleted` | number | INT | NO | |
| `totalTimeSpent` | number | INT | NO | Seconds |

### Indexes
- UNIQUE `playerId`
- `(tutorialComplete, completedAt DESC)`
- `(currentQuestId, tutorialSkipped)`

### Relationships
- `playerId` → `players.username` (One-to-One)

---

## 15. `tutorial_action_tracking` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `playerId` | string | VARCHAR(20) | NO | FK → players.username |
| `stepId` | string | VARCHAR(50) | NO | |
| `actionType` | string | VARCHAR(30) | NO | TutorialStepAction |
| `completed` | boolean | TINYINT(1) | NO | |
| `lastUpdated` | Date | DATETIME | NO | |

### Indexes
- UNIQUE `(playerId, stepId)` (compound)
- `lastUpdated` (stale cleanup)

### Relationships
- `playerId` → `players.username` (Many-to-One)

---

## 16. `referrals` Collection

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `referrerCode` | string | VARCHAR(20) | NO | |
| `referrerUsername` | string | VARCHAR(20) | NO | FK → players.username |
| `referrerPlayerId` | ObjectId | VARCHAR(24) | NO | FK → players._id |
| `newPlayerUsername` | string | VARCHAR(20) | NO | FK → players.username |
| `newPlayerEmail` | string | VARCHAR(255) | NO | |
| `newPlayerIP` | string | VARCHAR(45) | NO | |
| `signupDate` | Date | DATETIME | NO | |
| `validationDate` | Date/null | DATETIME | YES | |
| `validated` | boolean | TINYINT(1) | NO | |
| `loginCount` | number | INT | NO | |
| `lastLogin` | Date/null | DATETIME | YES | |
| `daysActive` | number | INT | NO | |
| `rewardsClaimed` | boolean | TINYINT(1) | NO | |
| `rewardsData.metal` | number | BIGINT | NO | |
| `rewardsData.energy` | number | BIGINT | NO | |
| `rewardsData.rp` | number | INT | NO | |
| `rewardsData.xp` | number | INT | NO | |
| `rewardsData.vipDays` | number | INT | NO | |
| `rewardsData.specialReward` | string | VARCHAR(100) | YES | |
| `rewardsData.milestone` | number | INT | YES | |
| `welcomePackageGiven` | boolean | TINYINT(1) | NO | |
| `flaggedForAbuse` | boolean | TINYINT(1) | NO | |
| `flagReason` | string/null | VARCHAR(255) | YES | |
| `adminNotes` | string/null | TEXT | YES | |
| `createdAt` | Date | DATETIME | NO | |
| `updatedAt` | Date | DATETIME | NO | |

### Indexes
- `referrerUsername, validated` (compound)
- `newPlayerUsername` (lookup)
- `signupDate` (analytics)
- `validated, validationDate` (pending validation)

### Relationships
- `referrerUsername` → `players.username` (Many-to-One)
- `newPlayerUsername` → `players.username` (Many-to-One)

---

## 17. `missiles` Collection (WMD)

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `ownerId` | string | VARCHAR(20) | NO | FK → players.username |
| `ownerClanId` | string | VARCHAR(24) | NO | FK → clans._id |
| `warheadType` | string (enum) | VARCHAR(20) | NO | WarheadType |
| `status` | string (enum) | VARCHAR(20) | NO | MissileStatus |
| `components.warhead` | boolean | TINYINT(1) | NO | |
| `components.propulsion` | boolean | TINYINT(1) | NO | |
| `components.guidance` | boolean | TINYINT(1) | NO | |
| `components.payload` | boolean | TINYINT(1) | NO | |
| `components.stealth` | boolean | TINYINT(1) | NO | |
| `targetId` | string | VARCHAR(20) | YES | Target player/clan |
| `targetType` | string | VARCHAR(10) | YES | player/clan |
| `secondaryTargets` | array | JSON | YES | Array of string |
| `launchedAt` | Date | DATETIME | YES | |
| `launchedBy` | string | VARCHAR(20) | YES | |
| `impactAt` | Date | DATETIME | YES | |
| `flightTime` | number | INT | YES | Milliseconds |
| `interceptAttempts` | number | INT | YES | |
| `interceptedBy` | string | VARCHAR(50) | YES | |
| `interceptedAt` | Date | DATETIME | YES | |
| `damageDealt` | object | JSON | YES | DamageDistribution |
| `createdAt` | Date | DATETIME | NO | |
| `completedAt` | Date | DATETIME | YES | |
| `updatedAt` | Date | DATETIME | NO | |

### Indexes
- `ownerId, status` (compound)
- `ownerClanId` (clan missiles)
- `status` (active missiles)
- `createdAt DESC` (recent)

### Relationships
- `ownerId` → `players.username` (Many-to-One)
- `ownerClanId` → `clans._id` (Many-to-One)

---

## 18. `player_research` Collection (WMD Research)

**Primary Key:** `_id` (ObjectId → VARCHAR(24))

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `playerId` | string | VARCHAR(20) | NO | FK → players.username, UNIQUE |
| `playerUsername` | string | VARCHAR(20) | NO | Denormalized |
| `clanId` | string | VARCHAR(24) | YES | FK → clans._id |
| `completedTechs` | array | JSON | NO | Array of techId strings |
| `availableTechs` | array | JSON | NO | Array of techId strings |
| `lockedTechs` | array | JSON | NO | Array of techId strings |
| `currentResearch.techId` | string | VARCHAR(50) | YES | |
| `currentResearch.startedAt` | Date | DATETIME | YES | |
| `currentResearch.rpSpent` | number | INT | YES | |
| `currentResearch.rpRequired` | number | INT | YES | |
| `currentResearch.progress` | number | DECIMAL(5,2) | YES | 0-100 |
| `missileTier` | number | INT | NO | 0-10 |
| `defenseTier` | number | INT | NO | 0-10 |
| `intelligenceTier` | number | INT | NO | 0-10 |
| `totalRPSpent` | number | INT | NO | |
| `totalTechsUnlocked` | number | INT | NO | |
| `clanResearchBonus` | number | DECIMAL(5,2) | NO | Percentage |
| `updatedAt` | Date | DATETIME | NO | |

### Indexes
- UNIQUE `playerId`
- `clanId` (clan research overview)

### Relationships
- `playerId` → `players.username` (One-to-One)
- `clanId` → `clans._id` (Many-to-One)

---

## 19. `flags` Collection (Singleton)

**Primary Key:** Single document (no meaningful key)

### Fields

| Field | MongoDB Type | MariaDB Type | Nullable | Notes |
|-------|-------------|--------------|----------|-------|
| `_id` | ObjectId | VARCHAR(24) | NO | **PRIMARY KEY** |
| `currentHolder` | ObjectId | VARCHAR(24) | YES | FK → players._id |
| `currentHolder.username` | string | VARCHAR(20) | YES | Denormalized |
| `lastCapturedAt` | Date | DATETIME | YES | |
| `lastCapturedBy` | string | VARCHAR(20) | YES | Username |
| `totalCaptures` | number | INT | NO | |

### Indexes
- Single document, no additional indexes needed

---

## 20-23. Additional Collections

### `word_blacklist`
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `word` | VARCHAR(100) | UNIQUE |

### `items`
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `name` | VARCHAR(100) | |
| `type` | VARCHAR(30) | ItemType |
| `rarity` | VARCHAR(20) | ItemRarity |

### `playerSessions`
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `userId` | VARCHAR(20) | FK → players.username |
| `token` | VARCHAR(255) | Session token |
| `expiresAt` | DATETIME | |
| `createdAt` | DATETIME | |

### `playerActivity`
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `playerId` | VARCHAR(20) | FK → players.username |
| `action` | VARCHAR(50) | |
| `timestamp` | DATETIME | |
| `details` | JSON | |

### `typing_indicators` (TTL)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `channelId` | VARCHAR(30) | |
| `userId` | VARCHAR(20) | |
| `expiresAt` | DATETIME | TTL index (5s expiry) |

### `user_presence` (TTL)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `userId` | VARCHAR(20) | UNIQUE |
| `lastSeen` | DATETIME | |
| `expiresAt` | DATETIME | TTL index (60s expiry) |

### `gameConfig`
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `type` | VARCHAR(30) | Config type key |
| `config` | JSON | Configuration data |

### `botConfig`
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `spawnRate` | INT | Bots per zone |
| `totalBots` | INT | Target count |
| `lastSpawn` | DATETIME | |

---

## Normalization Recommendations for MariaDB

### Tables to Extract from Embedded Arrays

The following MongoDB embedded arrays should become separate tables in MariaDB:

1. **`clan_members`** - Extract from `clans.members` array
   - `clanId` (FK), `playerId` (FK), `role`, `joinedAt`, `lastActive`

2. **`clan_bank_transactions`** - Extract from `clans.bank.transactions`
   - `clanId` (FK), `transactionId`, `type`, `playerId`, `amount_metal`, `amount_energy`, `amount_rp`, `timestamp`, `description`

3. **`clan_territories`** - Extract from `clans.territories` (already a separate collection)
   - Already defined as separate collection

4. **`harvest_records`** - Extract from `tiles.lastHarvestedBy`
   - `tileX`, `tileY` (FK), `playerId` (FK), `timestamp`, `resetPeriod`

5. **`rp_history`** - Extract from `players.rpHistory`
   - `playerId` (FK), `amount`, `reason`, `timestamp`, `balance`

6. **`shrine_boosts`** - Extract from `players.shrineBoosts`
   - `playerId` (FK), `tier`, `expiresAt`, `yieldBonus`

7. **`player_units`** - Extract from `players.units`
   - `playerId` (FK), `unitType`, `quantity`, `createdAt`

8. **`inventory_items`** - Extract from `players.inventory.items`
   - `playerId` (FK), `itemId`, `type`, `name`, `rarity`, `bonusPercent`, `quantity`, `foundAtX`, `foundAtY`, `foundDate`

9. **`battle_rounds`** - Extract from `battleLogs.rounds`
   - `battleId` (FK), `roundNumber`, `attackerDamage`, `defenderDamage`, `attackerHP`, `defenderHP`, `attackerUnitsLost`, `defenderUnitsLost`

10. **`conversation_participants`** - Normalize conversations
    - `conversationId` (FK), `playerId` (FK), `unreadCount`, `isArchived`, `isPinned`

---

## Enum Mappings

All MongoDB string enums should become MariaDB ENUM types or lookup tables:

| Enum | Values |
|------|--------|
| `TerrainType` | Metal, Energy, Cave, Forest, Factory, Wasteland, Bank, Shrine, AuctionHouse |
| `ClanRole` | LEADER, CO_LEADER, OFFICER, ELITE, MEMBER, RECRUIT |
| `FriendStatus` | pending, accepted, blocked, declined, cancelled |
| `FriendRequestStatus` | pending, accepted, declined, cancelled |
| `OnlineStatus` | online, offline, away, invisible |
| `MessageStatus` | sending, sent, delivered, read, failed |
| `MessageContentType` | text, system, notification |
| `BattleType` | Infantry, Base, Factory |
| `BattleOutcome` | AttackerWin, DefenderWin, Draw |
| `WarheadType` | TACTICAL, STRATEGIC, NEUTRON, CLUSTER, CLAN_BUSTER |
| `MissileStatus` | ASSEMBLING, READY, LAUNCHED, INTERCEPTED, DETONATED, DISMANTLED |
| `ResearchCategory` | MISSILE, DEFENSE, INTELLIGENCE |
| `ResearchStatus` | LOCKED, AVAILABLE, RESEARCHING, COMPLETED |
| `ClanActivityType` | (40+ values - see clan.types.ts) |
| `MonumentType` | ANCIENT_FORGE, WAR_MEMORIAL, MARKET_PLAZA, RESEARCH_LAB, GRAND_TEMPLE |
| `ClanWarStatus` | DECLARED, ACTIVE, ENDED, TRUCE |
| `UnitTier` | 1, 2, 3, 4, 5 |
| `SpecializationDoctrine` | none, offensive, defensive, tactical |
| `DiscoveryCategory` | industrial, combat, strategic |
| `AchievementCategory` | combat, economic, exploration, progression |
| `AchievementRarity` | common, rare, epic, legendary |
| `BotSpecialization` | hoarder, fortress, raider, ghost, balanced, boss |
| `BotReputation` | unknown, notorious, infamous, legendary |
| `ShrineBoostTier` | spade, heart, diamond, club |
| `ItemType` | METAL_DIGGER, ENERGY_DIGGER, UNIVERSAL_DIGGER, TRADEABLE_ITEM |
| `ItemRarity` | COMMON, UNCOMMON, RARE, EPIC, LEGENDARY |
| `BankType` | metal, energy, exchange |
| `BalanceStatus` | CRITICAL, IMBALANCED, BALANCED, OPTIMAL |

---

## Special Patterns

### TTL Indexes (MongoDB) → MariaDB Event Scheduler
| Collection | Field | Expiry | MariaDB Equivalent |
|-----------|-------|--------|-------------------|
| `typing_indicators` | `expiresAt` | 5 seconds | Event: DELETE every minute |
| `user_presence` | `expiresAt` | 60 seconds | Event: DELETE every minute |
| `friendRequests` | `expiresAt` | 30 days | Event: DELETE daily |
| `chat_messages` | `timestamp` | 1 year | Event: DELETE monthly |

### Compound Indexes
| Collection | Fields | Purpose |
|-----------|--------|---------|
| `clans` | level DESC, power DESC | Clan leaderboard |
| `clan_territories` | clanId, x, y | Territory lookup |
| `clan_wars` | status, endDate | Active wars |
| `battleLogs` | attacker.username, timestamp DESC | Player battle history |
| `battleLogs` | defender.username, timestamp DESC | Player defense history |
| `players` | clanId, role | Clan member lookup |
| `friends` | userId, friendId, status | Friendship lookup |
| `friendRequests` | from, to, status | Request uniqueness |
| `chat_messages` | channelId, timestamp DESC | Channel history |
| `tutorial_progress` | playerId | Unique player progress |
| `tutorial_action_tracking` | playerId, stepId | Unique step tracking |

### JSON Fields (Keep as JSON in MariaDB)
The following fields are complex enough to justify keeping as JSON in MariaDB 10.5+:
- `players.inventory.items` (if not normalized)
- `players.units` (if not normalized)
- `players.shrineBoosts`
- `players.rpHistory`
- `players.balanceEffects`
- `players.specialization`
- `players.discoveries`
- `players.achievements`
- `players.stats`
- `players.dailyBounties`
- `players.fastTravelWaypoints`
- `players.concentrationZones`
- `players.botConfig`
- `clans.members` (if not normalized)
- `clans.bank.transactions` (if not normalized)
- `clans.activePerks`
- `clans.territories` (if not normalized)
- `clans.wars`
- `battleLogs.rounds`
- `battleLogs.attacker.units`
- `battleLogs.defender.units`
- `battleLogs.unitsCaptured`
- `missiles.damageDealt`
- `chat_messages.itemLinks`
- `chat_messages.mentions`
- `conversations.participants`
- `conversations.unreadCount`
- `messages.metadata`

---

## Cross-Collection Relationships Summary

| From Collection | Field | To Collection | Type |
|----------------|-------|--------------|------|
| `players` | `clanId` | `clans._id` | Many-to-One |
| `players` | `referredBy` | `players.referralCode` | Self-ref |
| `factories` | `owner` | `players.username` | Many-to-One |
| `tiles` | `baseOwner` | `players.username` | Many-to-One |
| `clan_invitations` | `clanId` | `clans._id` | Many-to-One |
| `clan_invitations` | `inviterId` | `players.username` | Many-to-One |
| `clan_invitations` | `inviteeId` | `players.username` | Many-to-One |
| `clan_activities` | `clanId` | `clans._id` | Many-to-One |
| `clan_activities` | `playerId` | `players.username` | Many-to-One |
| `clan_chat` | `clanId` | `clans._id` | Many-to-One |
| `clan_chat` | `senderId` | `players.username` | Many-to-One |
| `friends` | `userId` | `players.username` | Many-to-One |
| `friends` | `friendId` | `players.username` | Many-to-One |
| `friendRequests` | `from` | `players.username` | Many-to-One |
| `friendRequests` | `to` | `players.username` | Many-to-One |
| `conversations` | participants[] | `players.username` | Many-to-Many |
| `messages` | `conversationId` | `conversations._id` | Many-to-One |
| `messages` | `senderId` | `players.username` | Many-to-One |
| `messages` | `recipientId` | `players.username` | Many-to-One |
| `chat_messages` | `senderId` | `players.username` | Many-to-One |
| `chat_messages` | `clanId` | `clans._id` | Many-to-One |
| `battleLogs` | `attacker.username` | `players.username` | Many-to-One |
| `battleLogs` | `defender.username` | `players.username` | Many-to-One |
| `tutorial_progress` | `playerId` | `players.username` | One-to-One |
| `tutorial_action_tracking` | `playerId` | `players.username` | Many-to-One |
| `referrals` | `referrerUsername` | `players.username` | Many-to-One |
| `referrals` | `newPlayerUsername` | `players.username` | Many-to-One |
| `missiles` | `ownerId` | `players.username` | Many-to-One |
| `missiles` | `ownerClanId` | `clans._id` | Many-to-One |
| `player_research` | `playerId` | `players.username` | One-to-One |
| `player_research` | `clanId` | `clans._id` | Many-to-One |
| `flags` | `currentHolder` | `players._id` | One-to-One |

---

## Notes for Drizzle ORM Migration

1. **Primary Key Strategy**: Use `username` (VARCHAR(20)) as the primary key for the `players` table instead of auto-increment integers. This avoids needing to maintain a mapping between ObjectId and integer IDs.

2. **ObjectId Handling**: Convert all MongoDB ObjectId strings (24-char hex) to VARCHAR(24) in MariaDB. Alternatively, create a mapping table if you prefer integer foreign keys.

3. **JSON Columns**: MariaDB 10.5+ supports JSON type. Use it for complex nested objects that don't need to be queried individually. For fields that need indexing/querying, extract to separate tables.

4. **ENUM Types**: Use MariaDB ENUM types for fixed-value fields. For enums with many values (like ClanActivityType with 40+), consider a lookup table instead.

5. **Soft Deletes**: Implement soft deletes using `deletedAt DATETIME` columns, matching the MongoDB pattern of setting `deletedAt` instead of removing documents.

6. **TTL Replacement**: Replace MongoDB TTL indexes with MariaDB Event Scheduler jobs that run periodically to clean up expired records.

7. **Array Fields**: MongoDB arrays stored as JSON should either remain as JSON (if not queried individually) or be normalized into child tables with foreign keys.

8. **Denormalized Fields**: The `players` table has denormalized clan fields (`clanName`, `clanRole`, `clanLevel`). Keep these for read performance but maintain consistency via triggers or application logic.

9. **Timestamps**: All MongoDB `Date` types map to MariaDB `DATETIME`. Use `DEFAULT CURRENT_TIMESTAMP` and `ON UPDATE CURRENT_TIMESTAMP` where appropriate.

10. **Transaction Support**: MariaDB supports transactions. Use them for operations that span multiple tables (e.g., clan creation + player update + activity log).
