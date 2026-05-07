# DarkFrame — Game Improvement Ideas

> Strategic suggestions for improving gameplay, engagement, and economy.
> Created: 2026-05-07

---

## 🎯 Economy & Balance

### Resource Sinks (Missing)
- **Unit upkeep scaling** — Already implemented, but consider scaling by unit tier (T5 costs more than T1)
- **Factory maintenance** — Factories should cost metal/hour to maintain, scaling with level
- **Territory upkeep** — Controlling many tiles costs resources, preventing map hoarding
- **Repair costs** — Damaged units cost resources to repair after combat
- **Market fees** — Auction house tax (5-10%) that burns resources from the economy

### Faucet Reductions (Already Done)
- Base harvest reduced 2x ✅
- Digger drop rate reduced ~10x ✅
- XP curve polynomial ✅
- Tier unlocks hybrid cost ✅

### New Sink Ideas
- **Unit merging** — Combine 3 lower-tier units into 1 higher-tier (costs resources, destroys 2)
- **Territory claiming** — Claiming neutral tiles costs metal, scales with distance from base
- **Scouting** — Revealing fog of war costs energy per tile
- **Mercenary contracts** — Hire AI mercenaries for raids (costs metal, one-time use)
- **Research decay** — Unused tech slowly degrades, requiring maintenance RP

---

## 🔄 Addiction Loops & Engagement

### Daily Loops
- **Daily quests** — 3 random objectives per day (harvest X tiles, attack Y factories, explore Z caves)
- **Daily login bonus** — Escalating rewards for consecutive logins (resets weekly)
- **Daily shrine rotation** — Different shrine bonus each day, encourages daily shrine visits
- **Daily leaderboard reset** — Fastest harvester, most attacks, most tiles explored

### Weekly Loops
- **Weekly tournaments** — Flag bearer survival, most factories captured, PvP kill streak
- **Clan wars** — Weekly clan vs clan events with shared rewards
- **Market crash** — Random weekly event where certain resources are worth 2x at the bank
- **Cave exploration bonus** — One random cave per week drops 5x loot

### Monthly Loops
- **Season prestige** — Optional reset with permanent cosmetics/titles
- **Map events** — Random territory becomes "hot zone" with 3x resource yields
- **Boss factories** — Special high-level factories spawn periodically with unique loot

---

## 🗺️ Map & Territory

### Territory Control
- **Territory decay** ✅ (implemented) — Uncontested tiles revert after 14 days
- **Border friction** — Moving through enemy territory costs extra actions
- **Territory bonuses** — Controlling adjacent tiles of same type gives yield bonus
- **Choke points** — Natural terrain features that block movement, strategic value
- **Weather system** — Random events that affect tile yields (storms, droughts, abundance)

### Map Features
- **Discoverable landmarks** — Hidden locations with permanent bonuses when found
- **Resource veins** — Certain map areas have permanently higher yields
- **Danger zones** — High-risk, high-reward areas with stronger enemies
- **Teleportation network** — Unlock permanent fast-travel between discovered shrines

---

## ⚔️ PvP & Combat

### Combat Depth
- **Unit mismatches** — Rock-paper-scissors: infantry > ranged > cavalry > infantry
- **Terrain advantage** — Defending forest tiles gives +20% defense
- **Morale system** — Units that have won recently gain small bonuses
- **Fog of war** — Can't see enemy unit composition before attacking
- **Retreat option** — Lose some units but survive instead of total defeat
- **Prisoners** — Captured units can be ransomed or recruited

### Flag Bearer Enhancements
- **Flag decay** — Flag bearer becomes weaker over time (increasing upkeep)
- **Flag upgrades** — Spend resources to improve flag bonuses while held
- **Multi-flag** — Multiple flags on map simultaneously at higher levels
- **Flag duels** — Flag bearers can challenge each other directly (1v1 combat mode)

---

## 🏰 Clan & Social

### Clan Features (Post-MVP)
- **Clan bank** — Shared resources for clan projects
- **Clan tech tree** — Unlock bonuses by contributing RP as a clan
- **Clan territories** — Shared map control with visual borders
- **Clan chat** — Dedicated real-time chat channel
- **Clan perks** — Small bonuses for active clan members
- **Clan challenges** — Group objectives that reward all participants

### Social Features
- **Player profiles** — View stats, achievements, army composition
- **Alliances** — Formal agreements between clans with shared defense
- **Bounty system** — Place bounties on specific players (paid by attacker if successful)
- **Mail system** — Send messages and resources to other players
- **Mentor system** — Veterans get bonuses for helping new players

---

## 🎮 Quality of Life

### UI/UX Improvements
- **Action queue** — Queue multiple movements/harvests with one click
- **Tile bookmarks** — Save frequently visited locations
- **Resource alerts** — Notifications when bank is full or units are idle
- **Combat log** — Detailed history of all PvP interactions
- **Minimap** — Overview of explored territory with key locations

### Automation
- **Auto-harvest** — Automatically harvest when tiles are available
- **Auto-farm patterns** — Customizable farming routes
- **Auto-upgrade** — Automatically upgrade factories when affordable
- **Auto-bank** — Automatically deposit resources when inventory is full

---

## 💰 Monetization Opportunities

### VIP Tiers (Beyond Current)
- **VIP 1** ($9.99/mo) — Current: 2x harvest, premium tool
- **VIP 2** ($29.99/mo) — Adds: auto-farm boost, +10 inventory slots, custom base skin
- **VIP 3** ($99.99/mo) — Adds: territory claim priority, exclusive unit type, clan perks

### Cosmetic Shop
- **Base skins** — Visual themes for player bases
- **Unit skins** — Visual customization for army units
- **Flag designs** — Custom flag bearer appearance
- **Territory colors** — Custom colors for controlled tiles
- **Emotes/Flair** — Chat effects and profile decorations

### Battle Pass (Seasonal)
- **Free track** — Basic rewards for all players
- **Premium track** ($9.99/season) — Exclusive cosmetics, resources, speed boosts
- **Clan track** — Group objectives with shared premium rewards

---

## 🏗️ Technical Debt for Future

### Server-Side
- Replace polling with WebSocket for real-time updates
- Implement proper job queue for background tasks (slot regen, decay)
- Add rate limiting on all API endpoints
- Implement proper error boundaries and retry logic

### Database
- Add proper indexes for all query patterns
- Implement data archival for old battle logs
- Add player activity tracking for analytics
- Consider Redis cache for frequently accessed data

### Testing
- Add unit tests for all service modules
- Add integration tests for API routes
- Add end-to-end tests for critical game flows
- Add load testing for concurrent players

---

## 📊 Metrics to Track

### Economy Health
- Total resources in circulation vs burned
- Average player resource count growth rate
- Resource sink effectiveness (how much is burned vs earned)
- Digger distribution across player levels

### Engagement
- Daily/Monthly active users
- Average session length
- Action rate per session (harvests, attacks, moves)
- Retention curves (D1, D7, D30)

### Balance
- Win rate by army composition
- Flag bearer hold duration distribution
- Factory capture frequency by level
- Resource distribution Gini coefficient
