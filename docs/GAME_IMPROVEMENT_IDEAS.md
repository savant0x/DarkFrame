# DarkFrame — Game Improvement Ideas

> Strategic suggestions for improving gameplay, engagement, and economy.
> Created: 2026-05-07 | Updated: 2026-05-07
> NOTE: This document only includes suggestions for features NOT yet fully implemented.
> See `dev/completed.md` for what already exists.

---

## 🎯 Economy & Balance

### Resource Sinks (Partially Implemented)
- **Unit upkeep scaling** ✅ Basic implementation exists. Consider scaling by unit tier (T5 costs more than T1)
- **Factory maintenance** ❌ Not implemented — Factories should cost metal/hour to maintain, scaling with level
- **Territory upkeep** ❌ Basic decay exists, but no active upkeep cost for controlling many tiles
- **Repair costs** ❌ Not implemented — Damaged units should cost resources to repair after combat
- **Market fees** ✅ 5% auction fee exists. Consider increasing to 10% for non-clan auctions

### New Sink Ideas
- **Unit merging** — Combine 3 lower-tier units into 1 higher-tier (costs resources, destroys 2)
- **Territory claiming** — Claiming neutral tiles costs metal, scales with distance from base
- **Scouting** — Revealing fog of war costs energy per tile
- **Mercenary contracts** — Hire AI mercenaries for raids (costs metal, one-time use)
- **Research decay** — Unused tech slowly degrades, requiring maintenance RP

---

## 🔄 Addiction Loops & Engagement

### Daily Loops (Not Implemented)
- **Daily quests** — 3 random objectives per day (harvest X tiles, attack Y factories, explore Z caves)
- **Daily login bonus** — Escalating rewards for consecutive logins (resets weekly)
- **Daily shrine rotation** — Different shrine bonus each day, encourages daily shrine visits
- **Daily leaderboard reset** — Fastest harvester, most attacks, most tiles explored

### Weekly Loops (Not Implemented)
- **Weekly tournaments** — Flag bearer survival, most factories captured, PvP kill streak
- **Clan wars** ✅ Basic implementation exists. Needs UI for declaring/participating
- **Market crash** — Random weekly event where certain resources are worth 2x at the bank
- **Cave exploration bonus** — One random cave per week drops 5x loot

### Monthly Loops (Not Implemented)
- **Season prestige** — Optional reset with permanent cosmetics/titles
- **Map events** — Random territory becomes "hot zone" with 3x resource yields
- **Boss factories** — Special high-level factories spawn periodically with unique loot

---

## 🗺️ Map & Territory

### Map Features (Not Implemented)
- **Discoverable landmarks** — Hidden locations with permanent bonuses when found
- **Resource veins** — Certain map areas have permanently higher yields
- **Danger zones** — High-risk, high-reward areas with stronger enemies
- **Weather system** — Random events that affect tile yields (storms, droughts, abundance)
- **Teleportation network** — Unlock permanent fast-travel between discovered shrines

### PvP Enhancements (Not Implemented)
- **Unit mismatches** — Rock-paper-scissors: infantry > ranged > cavalry > infantry
- **Terrain advantage** — Defending forest tiles gives +20% defense
- **Morale system** — Units that have won recently gain small bonuses
- **Fog of war** — Can't see enemy unit composition before attacking
- **Retreat option** — Lose some units but survive instead of total defeat
- **Prisoners** — Captured units can be ransomed or recruited

---

## 🏰 Clan & Social

### Clan Features (Partially Implemented)
- **Clan bank** ✅ Exists. Consider: shared factory access, clan-wide boosts
- **Clan tech tree** ✅ Exists. Needs more visible progression and rewards
- **Clan territories** ✅ Basic exists. Consider: visual borders on map, territory bonuses
- **Clan perks** ✅ 16 perks exist. Consider: more tiers, unique clan abilities
- **Clan chat** ✅ Exists. Consider: voice channels, pinned messages
- **Clan wars** ⚠️ Types exist in code, but no UI for declaring/participating
- **Alliances** ✅ Types exist. Needs UI for managing alliance contracts

### Social Features (Not Implemented)
- **Player profiles** ✅ Basic exists. Consider: stats, achievements, army showcase
- **Bounty system** ✅ Types exist. Needs UI for placing/accepting bounties
- **Mail system** ✅ Exists. Consider: resource attachments, system notifications
- **Mentor system** — Veterans get bonuses for helping new players
- **Emotes/Flair** — Chat effects and profile decorations

---

## 💰 Monetization

### VIP Tiers (Basic Implementation Exists)
- **VIP 1** ($9.99/mo) — Current: 2x harvest, premium tool
- **VIP 2** ($29.99/mo) — Add: auto-farm boost, +10 inventory slots, custom base skin
- **VIP 3** ($99.99/mo) — Add: territory claim priority, exclusive unit type, clan perks

### Cosmetic Shop (Not Implemented)
- **Base skins** — Visual themes for player bases
- **Unit skins** — Visual customization for army units
- **Flag designs** — Custom flag bearer appearance
- **Territory colors** — Custom colors for controlled tiles
- **Emotes/Flair** — Chat effects and profile decorations

### Battle Pass (Not Implemented)
- **Free track** — Basic rewards for all players
- **Premium track** ($9.99/season) — Exclusive cosmetics, resources, speed boosts
- **Clan track** — Group objectives with shared premium rewards

---

## 🎮 Quality of Life

### UI/UX Improvements (Not Implemented)
- **Action queue** — Queue multiple movements/harvests with one click
- **Tile bookmarks** — Save frequently visited locations
- **Resource alerts** — Notifications when bank is full or units are idle
- **Combat log** — Detailed history of all PvP interactions
- **Minimap** — Overview of explored territory with key locations

### Automation (Partially Implemented)
- **Auto-farm** ✅ Basic exists. Consider: custom routes, priority tiles
- **Auto-harvest** — Automatically harvest when tiles are available
- **Auto-bank** — Automatically deposit resources when inventory is full
- **Auto-upgrade** — Automatically upgrade factories when affordable
- **Auto-bounty** — Automatically accept/complete bounty board tasks

---

## 🏗️ Technical Debt

### Server-Side (Not Implemented)
- Replace polling with WebSocket for real-time updates
- Implement proper job queue for background tasks (slot regen, decay)
- Add rate limiting on all API endpoints
- Implement proper error boundaries and retry logic

### Database (Not Implemented)
- Add proper indexes for all query patterns
- Implement data archival for old battle logs
- Add player activity tracking for analytics
- Consider Redis cache for frequently accessed data

### Testing (Not Implemented)
- Add unit tests for all service modules
- Add integration tests for API routes
- Add end-to-end tests for critical game flows
- Add load testing for concurrent players
