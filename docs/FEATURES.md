DarkFrame: Comprehensive Feature Implementation Summary
Architecture Overview
DarkFrame is a Next.js (React) browser-based strategy game with a MongoDB backend, using Supabase for authentication. The game features a 150x150 tile map with resource gathering, combat, clans, and a complex WMD (Weapons of Mass Destruction) system. The codebase is TypeScript throughout.
---
1. CORE GAME SYSTEMS
1.1 Map & Movement
- Status: FULLY IMPLEMENTED
- 150x150 grid (22,500 tiles) with 9 terrain types: Metal, Energy, Cave, Forest, Factory, Wasteland, Bank, Shrine, AuctionHouse
- 9-directional movement (QWEASDZXC, Numpad, Arrow keys)
- Terrain distribution defined in GAME_CONSTANTS
- Key files: types/game.types.ts, app/api/move/route.ts, app/api/tile/route.ts, lib/mapGeneration.ts, lib/mapService.ts, components/ControlsPanel.tsx
1.2 Resource Harvesting
- Status: FULLY IMPLEMENTED
- Metal/Energy tiles: harvest for resources (400-750 base range)
- Cave/Forest tiles: 2.5% item drop rate (80% tradeable items, 20% digger items)
- Harvest cooldown system with reset periods (midnight/noon)
- Digger items provide permanent gathering bonuses with diminishing returns (5 tiers)
- Key files: app/api/harvest/route.ts (implied from page.tsx fetch), lib/harvestService.ts, components/HarvestButton.tsx, components/HarvestStatus.tsx, components/TileHarvestStatus.tsx
1.3 Player System
- Status: FULLY IMPLEMENTED
- Registration/login via Supabase auth (app/api/auth/register/route.ts, app/api/auth/login/route.ts, app/api/auth/session/route.ts)
- Player stats: level, XP, research points, resources (metal/energy), bank storage, inventory
- Army system with totalStrength/totalDefense calculations
- Balance effects system (CRITICAL/IMBALANCED/BALANCED/OPTIMAL) affecting power, damage, gathering
- VIP subscription system with Stripe integration
- Key files: types/game.types.ts (Player interface), lib/authService.ts, lib/authMiddleware.ts, lib/balanceService.ts, lib/xpService.ts, context/GameContext.tsx
1.4 Unit System
- Status: FULLY IMPLEMENTED (types/configs); building via API
- 5 standard tiers x 8 units = 40 base units (each with STR or DEF specialization)
- 15 specialized units across 3 doctrines (Offensive/Defensive/Tactical) unlocked at Level 15+
- 10 prestige units unlocked via achievements
- Full cost/stats configuration in UNIT_CONFIGS (metalCost, energyCost, slotCost, STR, DEF values)
- Unit building at factories, unit upgrades
- Key files: types/game.types.ts (UnitType enum, UnitConfig, UNIT_CONFIGS), app/api/player/build-unit/route.ts, app/api/player/upgrade-unit/route.ts, components/UnitBuildPanelEnhanced.tsx
1.5 Factory System
- Status: FULLY IMPLEMENTED
- Factories can be claimed, upgraded (levels 1-10), and attacked
- Slot-based unit production with regeneration
- Factory management panel for owners
- Attack system with power vs defense calculations
- Key files: types/game.types.ts (Factory interface), app/api/factory/status/route.ts, app/api/factory/attack/route.ts, app/api/factory/upgrade/route.ts, app/api/factory/produce/route.ts, app/api/factory/release/route.ts, app/api/factory/list/route.ts, lib/factoryService.ts, lib/factoryUpgradeService.ts, components/FactoryManagementPanel.tsx
1.6 Tier/Research Unlock System
- Status: FULLY IMPLEMENTED
- Research Points (RP) earned and spent to unlock unit tiers
- Tier 1 (free), Tier 2 (5 RP), Tier 3 (15 RP), Tier 4 (30 RP), Tier 5 (50 RP)
- Tech tree unlocks for features (bot-hunter, bot-magnet, etc.)
- Key files: app/api/tier/unlock/route.ts, app/api/research/route.ts, lib/tierUnlockService.ts, components/TierUnlockPanel.tsx
---
2. ECONOMY SYSTEMS
2.1 Bank System
- Status: FULLY IMPLEMENTED
- 3 bank types: metal, energy, exchange
- Deposit/withdraw/exchange resources
- Bank storage separate from player resources (safe keeping)
- Key files: app/api/bank/deposit/route.ts, app/api/bank/withdraw/route.ts, app/api/bank/exchange/route.ts, components/BankPanel.tsx
2.2 Shrine System
- Status: FULLY IMPLEMENTED
- Located at fixed position (1,1)
- Trade items for temporary shrine boosts (+25% resource yield)
- 4 boost tiers: spade, heart, diamond, club
- Active boosts displayed in shrine status panel
- Key files: components/ShrinePanel.tsx, components/ShrineStatusPanel.tsx
2.3 Auction House
- Status: FULLY IMPLEMENTED
- P2P trading of units, resources, and tradeable items
- Bidding system with optional buyout
- 5% sale fee (0% for clan-only auctions)
- 12/24/48 hour auction durations
- Market statistics and search/filter
- Key files: types/auction.types.ts, app/api/auction/my-listings/route.ts, app/api/auction/my-bids/route.ts, lib/auctionService.ts, components/AuctionHousePanel.tsx, components/CreateListingModal.tsx, components/AuctionListingCard.tsx, components/BidHistoryViewer.tsx
2.4 Inventory System
- Status: FULLY IMPLEMENTED
- Item types: Metal Digger, Energy Digger, Universal Digger, Tradeable Item
- 5 rarity tiers: Common, Uncommon, Rare, Epic, Legendary
- Default capacity: 2000 items
- Items found in caves/forests
- Key files: types/game.types.ts (PlayerInventory, InventoryItem), app/api/inventory/route.ts, app/api/player/inventory/route.ts, components/InventoryPanel.tsx, components/CaveItemNotification.tsx
---
3. COMBAT SYSTEMS
3.1 Bot System (PvE)
- Status: FULLY IMPLEMENTED
- 6 bot specializations: Hoarder, Fortress, Raider, Ghost, Balanced, Boss
- Full Permanence Model: bots stay on map, regenerate resources hourly
- 3 resource tiers per bot
- Reputation system: Unknown, Notorious, Infamous, Legendary (with loot bonuses)
- Beer Bases: special bots with 3x resources, weekly respawn
- Bot nests (8 locations, 15-20 bots each)
- Weekly migration system (30% of bots move)
- Phase-out system for gradual bot removal as player base grows
- Key files: types/botConfig.types.ts, types/game.types.ts (BotConfig), lib/botService.ts, lib/botGrowthEngine.ts, lib/botCombatService.ts, lib/botNestService.ts, lib/botMigrationService.ts, lib/beerBaseService.ts, lib/beerBaseAnalytics.ts
3.2 Bot Scanner
- Status: FULLY IMPLEMENTED
- Scan radius: 50 tiles (base) / 100 tiles (upgraded)
- Cooldown: 60 min (base) / 30 min (upgraded)
- Key files: app/api/bot-scanner/route.ts, lib/botScannerService.ts, components/BotScannerPanel.tsx
3.3 Bot Magnet
- Status: FULLY IMPLEMENTED
- Deploy to attract bots to a location (75 tile radius)
- 20-50 bots attracted over 48 hours
- 14-day cooldown
- Key files: app/api/bot-magnet/route.ts, lib/botMagnetService.ts, components/BotMagnetPanel.tsx
3.4 Bot Summoning Circle
- Status: FULLY IMPLEMENTED
- Summon 5 bots at player location (20 tile radius)
- 7-day cooldown
- Costs 25K metal + 25K energy
- Key files: app/api/bot-summoning/route.ts, lib/botSummoningService.ts, components/BotSummoningPanel.tsx
3.5 Bounty Board
- Status: FULLY IMPLEMENTED
- Daily bot defeat bounties (3 per day)
- Easy/Medium/Hard difficulties
- Metal and energy rewards
- Key files: app/api/bounty-board/route.ts, lib/bountyBoardService.ts, components/BountyBoardPanel.tsx
3.6 Infantry Combat (PvP)
- Status: FULLY IMPLEMENTED
- Direct player vs player combat
- Attack logs tracked
- Key files: app/api/combat/infantry/route.ts, app/api/combat/attack/route.ts, app/api/combat/base/route.ts, app/api/combat/logs/route.ts, lib/battleService.ts, lib/battleTrackingService.ts, lib/battleLogService.ts, components/CombatAttackModal.tsx, components/BattleResultModal.tsx, components/BattleLogViewer.tsx, components/BattleStatsPanel.tsx
3.7 Fast Travel
- Status: FULLY IMPLEMENTED
- Up to 5 waypoints per player
- 12-hour cooldown per waypoint
- Costs 5K metal + 5K energy per trip
- Key files: app/api/fast-travel/route.ts, lib/fastTravelService.ts
---
4. FLAG BEARER SYSTEM (King of the Hill)
- Status: FULLY IMPLEMENTED
- Claim the flag and hold it to earn session earnings (metal/energy)
- 2x harvest multiplier, 2x XP, 1.5x cave drop rate, 1.5x auto-farm speed
- Challenge system: attack the bearer within 15 tile range
- Flee system: bearer can flee at increasing costs (up to 5 flees)
- 12-hour max hold time, then flag drops
- 1-hour grace period after claiming
- Golden particle trail lingers for 8 minutes
- Flag respawns after 30 minutes
- Key files: types/flag.types.ts, app/api/flag/route.ts, app/api/flag/claim/route.ts, app/api/flag/init/route.ts, app/api/flag/release/route.ts, lib/flagService.ts, lib/flagBotService.ts, components/FlagTrackerPanel.tsx, components/FlagBearerPanel.tsx
---
5. CLAN SYSTEM
5.1 Clan Management
- Status: FULLY IMPLEMENTED (types/services); UI components exist
- Clan creation (1.5M metal + 1.5M energy)
- 6 roles: Leader, Co-Leader, Officer, Elite, Member, Recruit
- Full role-based permissions matrix (22 distinct permissions)
- Clan settings: recruitment, MOTD, min level, approval required
- Key files: types/clan.types.ts, lib/clanService.ts, components/ClanManagementView.tsx, components/ClanLeaderboardView.tsx, components/ClanLeaderboardPanel.tsx
5.2 Clan Research
- Status: FULLY IMPLEMENTED
- 3 branches: Strength (+attack), Defense (+defense), Economic (+resources)
- 9 research nodes with prerequisites
- Shared RP pool contributed by members
- Key files: types/clan.types.ts (RESEARCH_TREE), lib/clanResearchService.ts
5.3 Clan Banking
- Status: FULLY IMPLEMENTED
- Shared treasury (metal, energy, RP)
- Tax system (0-50% on harvests, RP gains)
- 6 upgrade levels with increasing capacity
- Transaction history (last 100)
- Key files: types/clan.types.ts (ClanBank), lib/clanBankService.ts
5.4 Clan Perks
- Status: FULLY IMPLEMENTED
- 16 perks across 4 tiers (Bronze/Silver/Gold/Legendary)
- 4 categories: Combat, Economic, Social, Strategic
- Max 4 active perks at once
- Key files: types/clan.types.ts (CLAN_PERK_CATALOG), lib/clanPerkService.ts
5.5 Clan Leveling
- Status: FULLY IMPLEMENTED
- 50 clan levels with exponential XP curve
- Milestone rewards at levels 5, 10, 15, 20, 25, 30, 40, 50
- XP from: harvesting, combat, research, building, territory, monuments
- Key files: types/clan.types.ts (CLAN_MILESTONES, CLAN_XP_RATES), lib/clanLevelService.ts
5.6 Clan Territory
- Status: FULLY IMPLEMENTED
- Claim tiles adjacent to existing territory (500 metal + 500 energy per tile)
- +10% defense bonus per adjacent clan tile (max +50%)
- Territory can be captured during wars
- Key files: types/clan.types.ts (ClanTerritory), lib/territoryService.ts
5.7 Clan Warfare
- Status: FULLY IMPLEMENTED (types/services)
- War declaration (2000 metal + 2000 energy)
- War lifecycle: DECLARED -> ACTIVE -> ENDED/TRUCE
- Territory capture during active wars
- War statistics tracking
- Key files: types/clan.types.ts (ClanWar), app/api/clan/warfare/declare/route.ts, app/api/clan/wars/route.ts, lib/clanWarfareService.ts
5.8 Clan Monuments
- Status: FULLY IMPLEMENTED (types/configs)
- 5 monument types at fixed locations (3x3 tile control required)
- Ancient Forge (+5% metal), War Memorial (+10% attack), Market Plaza (-5% auction fees), Research Lab (+15% RP), Grand Temple (+5% XP)
- Key files: types/clan.types.ts (MONUMENTS, MonumentType)
5.9 Clan Alliances
- Status: FULLY IMPLEMENTED (types)
- 4 alliance types: NAP (free), Trade (10K), Military (50K), Federation (200K)
- Contract types: Resource Sharing, Defense Pact, War Support, Joint Research
- Key files: types/clan.types.ts (AllianceType, ContractType), lib/clanAllianceService.ts
5.10 Clan Chat
- Status: FULLY IMPLEMENTED
- 3 channels: general, officer, leader
- 100 message history, 7-day retention
- Key files: types/clan.types.ts (ClanChatMessage), lib/clanChatService.ts, components/ClanChatPanel.tsx, components/ClanActivityFeed.tsx
5.11 Fund Distribution
- Status: FULLY IMPLEMENTED (types)
- 4 methods: Equal Split, Percentage, Merit, Direct Grant
- Key files: types/clan.types.ts (DistributionMethod), components/FundDistributionPanel.tsx
---
6. WMD (WEAPONS OF MASS DESTRUCTION) SYSTEM
6.1 Missile System
- Status: FULLY IMPLEMENTED
- Multiple warhead types with different damage profiles
- Component-based missile assembly (acquire components, assemble, launch)
- Target validation system
- Missile inventory management
- Key files: types/wmd/missile.types.ts, app/api/wmd/missiles/route.ts, lib/wmd/missileService.ts, lib/wmd/damageCalculator.ts, lib/wmd/targetingValidator.ts, components/WMDMissilePanel.tsx
6.2 Defense System
- Status: FULLY IMPLEMENTED
- Defense batteries with interception chances
- Radar installations for missile detection
- Clan defense grid (shared defense pooling)
- Battery repair system
- Key files: types/wmd/defense.types.ts, app/api/wmd/defense/route.ts, lib/wmd/defenseService.ts, components/WMDDefensePanel.tsx
6.3 Intelligence System
- Status: FULLY IMPLEMENTED
- Spy missions with multiple types (reconnaissance, sabotage, etc.)
- Spy ranks with progression
- Counter-intelligence detection
- Intelligence leak system
- Sabotage damage engine
- Key files: types/wmd/intelligence.types.ts, app/api/wmd/intelligence/route.ts, lib/wmd/spyService.ts, lib/wmd/sabotageEngine.ts, components/WMDIntelligencePanel.tsx
6.4 WMD Research
- Status: FULLY IMPLEMENTED
- 3 research tracks: Missile, Defense, Intelligence
- Tech tree with prerequisites
- RP-based unlocks
- Key files: types/wmd/research.types.ts, app/api/wmd/research/route.ts, lib/wmd/researchService.ts, components/WMDResearchPanel.tsx
6.5 WMD Voting
- Status: FULLY IMPLEMENTED
- Clan voting system for WMD-related decisions
- Vote expiration/cleanup jobs
- Key files: app/api/wmd/voting/route.ts, lib/wmd/clanVotingService.ts, components/WMDVotingPanel.tsx
6.6 WMD Notifications
- Status: FULLY IMPLEMENTED
- Event-based notification system
- Priority levels and scopes
- Notification preferences per player
- Key files: types/wmd/notification.types.ts, app/api/wmd/notifications/route.ts, lib/wmd/notificationService.ts, components/WMDNotificationsPanel.tsx
6.7 WMD Hub & Status
- Status: FULLY IMPLEMENTED
- Central WMD dashboard (WMDHub)
- Mini status widget in sidebar
- Clan treasury WMD integration
- Clan consequences service
- Key files: components/WMDHub.tsx, components/WMDMiniStatus.tsx, lib/wmd/clanTreasuryWMDService.ts, lib/wmd/clanConsequencesService.ts
6.8 WMD Background Jobs
- Status: FULLY IMPLEMENTED
- Missile tracker (move missiles toward targets)
- Spy mission completer
- Defense repair completer
- Vote expiration cleaner
- Beer base respawner
- Key files: lib/wmd/jobs/missileTracker.ts, lib/wmd/jobs/spyMissionCompleter.ts, lib/wmd/jobs/defenseRepairCompleter.ts, lib/wmd/jobs/voteExpirationCleaner.ts, lib/wmd/jobs/beerBaseRespawner.ts, lib/wmd/jobs/scheduler.ts
---
7. SOCIAL SYSTEMS
7.1 Global Chat
- Status: FULLY IMPLEMENTED
- Channel-based architecture
- Real-time WebSocket messaging
- Item linking and @mentions
- Message editing/deletion
- Typing indicators
- Rate limiting and spam detection
- Profanity filtering
- Key files: app/api/chat/route.ts, app/api/chat/typing/route.ts, app/api/chat/online/route.ts, app/api/chat/heartbeat/route.ts, app/api/chat/edit/route.ts, app/api/chat/delete/route.ts, app/api/chat/item-link/route.ts, lib/chatService.ts, lib/channelService.ts
7.2 Direct Messages (DM)
- Status: FULLY IMPLEMENTED
- 1-on-1 private messaging
- Conversation management
- Read receipts
- Typing indicators
- Key files: app/api/dm/route.ts, app/api/dm/[id]/route.ts, app/api/dm/[id]/read/route.ts, app/api/messages/route.ts, app/api/messages/conversations/route.ts, app/api/messages/read/route.ts, lib/dmService.ts, lib/messagingService.ts
7.3 Friend System
- Status: FULLY IMPLEMENTED
- Friend requests (send/accept/decline)
- Block/unblock functionality
- Online status tracking (online/away/offline/invisible)
- Player search for friend discovery
- Max 100 friends, max 50 pending requests
- Key files: types/friend.ts, lib/friendService.ts, components/friends/FriendsList.tsx, components/friends/FriendRequestsPanel.tsx, components/friends/AddFriendModal.tsx, components/friends/FriendActionsMenu.tsx
7.4 Referral System
- Status: FULLY IMPLEMENTED
- Unique referral codes per player (e.g., "DF-A7K9X2M5")
- 7-day validation period
- Progressive reward scaling with milestones
- Anti-abuse detection (IP tracking, email domain blocking)
- Welcome package for new referred players
- Referral leaderboard
- Key files: types/referral.types.ts, app/api/referral/generate/route.ts, app/api/referral/validate/route.ts, app/api/referral/stats/route.ts, app/api/referral/leaderboard/route.ts, lib/referralService.ts, app/referrals/page.tsx
---
8. PROGRESSION SYSTEMS
8.1 Specialization System
- Status: FULLY IMPLEMENTED
- 3 doctrines: Offensive, Defensive, Tactical
- Unlocked at Level 15+ with 25 RP
- 5 mastery levels per doctrine (0%, 25%, 75%, 100% thresholds)
- Respec with cooldown and cost
- Doctrine-specific unit unlocks
- Key files: types/game.types.ts (Specialization, SpecializationDoctrine), app/api/specialization/switch/route.ts, components/SpecializationPanel.tsx
8.2 Discovery System
- Status: FULLY IMPLEMENTED
- Ancient technology discoveries in caves
- 3 categories: Industrial, Combat, Strategic
- Discovery notifications and log
- Key files: types/game.types.ts (Discovery, DiscoveryCategory), app/api/discoveries/route.ts, lib/discoveryService.ts, components/DiscoveryNotification.tsx, components/DiscoveryLogPanel.tsx
8.3 Achievement System
- Status: FULLY IMPLEMENTED
- 4 categories: Combat, Economic, Exploration, Progression
- 4 rarity tiers: Common, Rare, Epic, Legendary
- Prestige unit rewards
- Achievement notifications and panel
- Key files: types/game.types.ts (Achievement, AchievementCategory, AchievementRarity), lib/achievementService.ts, components/AchievementNotification.tsx, components/AchievementPanel.tsx
8.4 Tutorial System
- Status: FULLY IMPLEMENTED
- 15-20 progressive quests with multiple steps
- Step types: MOVE, HARVEST, ATTACK, JOIN_CLAN, RESEARCH, CLICK_BUTTON, OPEN_PANEL, etc.
- UI highlighting for guided elements
- Skip functionality with confirmation
- 50% bonus reward for full completion
- Key files: types/tutorial.types.ts, app/api/tutorial/route.ts, app/api/tutorial/tracking/route.ts, app/api/tutorial/track-action/route.ts, app/api/tutorial/complete/route.ts, app/api/tutorial/decline/route.ts, lib/tutorialService.ts, components/tutorial/TutorialOverlay.tsx, components/tutorial/TutorialQuestPanel.tsx
8.5 Daily Login System
- Status: FULLY IMPLEMENTED
- Login streak tracking
- Streak rewards
- Key files: lib/dailyLoginService.ts
---
9. LEADERBOARD & STATS
9.1 Player Leaderboard
- Status: FULLY IMPLEMENTED
- Ranked by various metrics
- Key files: app/api/leaderboard/route.ts, components/LeaderboardView.tsx
9.2 Clan Leaderboard
- Status: FULLY IMPLEMENTED
- 8 ranking categories: Power, Members, Territory, Monuments, Research, Wars Won, RP Contributed, Avg Member Level
- Key files: types/clan.types.ts (ClanRankingType), components/ClanLeaderboardView.tsx
9.3 Player Stats
- Status: FULLY IMPLEMENTED
- Battle statistics (attacks, defenses, wins/losses)
- Resource gathering stats
- Profile page with embedded stats view
- Key files: app/api/player/stats/route.ts, app/api/stats/route.ts, app/api/stats/battles/route.ts, components/StatsViewWrapper.tsx, app/profile/page.tsx
---
10. ADMIN SYSTEM
10.1 Admin Panel
- Status: FULLY IMPLEMENTED
- Tile inspector modal
- Player detail modal
- Factory inspector modal
- Clan inspector modal
- Battle logs viewer
- Achievement stats
- Moderation panel
- System reset modal
- WebSocket console
- Bot population trend charts
- Resource gains charts
- Flag breakdown charts
- Activity timeline charts
- Session distribution charts
- VIP grant/revoke/list
- Admin WMD controls
- Warfare config
- Key files: app/admin/page.tsx, components/admin/TileInspectorModal.tsx, components/admin/PlayerDetailModal.tsx, components/admin/FactoryInspectorModal.tsx, components/admin/ClanInspectorModal.tsx, components/admin/BattleLogsModal.tsx, components/admin/AchievementStatsModal.tsx, components/admin/ModerationPanel.tsx, components/admin/SystemResetModal.tsx, components/admin/WebSocketConsoleModal.tsx, components/admin/charts/*.tsx, app/api/admin/wmd/route.ts, app/api/admin/warfare/config/route.ts, app/api/admin/vip/grant/route.ts, app/api/admin/vip/revoke/route.ts, app/api/admin/vip/list/route.ts, app/api/admin/tiles/route.ts
---
11. TECHNOLOGY & INFRASTRUCTURE
11.1 WebSocket System
- Status: FULLY IMPLEMENTED
- Full type-safe event system (100+ events)
- Server-to-client and client-to-server event maps
- Room-based architecture (global, user, clan, chat, battle, location)
- Real-time game updates, chat, combat notifications
- Key files: types/websocket.ts, lib/websocket.ts (exported from lib/index.ts)
11.2 Activity Logging
- Status: FULLY IMPLEMENTED
- 50+ action types across 15 categories
- Security metadata (IP, user-agent, execution time)
- Battle log with detailed combat analytics
- Log retention policies
- Key files: types/activityLog.types.ts, lib/activityLogService.ts, app/api/logs/activity/route.ts, app/api/logs/battle/route.ts, app/api/logs/stats/route.ts, app/api/logs/cleanup/route.ts, app/api/logs/player/[id]/route.ts
11.3 Background Jobs
- Status: FULLY IMPLEMENTED
- Scheduled job system
- Flag respawner
- WMD jobs (missile tracker, spy completer, defense repair, vote cleanup, beer base respawn)
- Key files: lib/jobs/index.ts, lib/jobs/flagRespawner.ts, lib/wmd/jobs/scheduler.ts
11.4 Caching
- Status: FULLY IMPLEMENTED
- Redis-based caching
- Cache warming
- Cache key management
- Key files: lib/cacheService.ts, lib/cacheKeys.ts, lib/cacheWarming.ts
11.5 Rate Limiting
- Status: FULLY IMPLEMENTED
- Per-endpoint rate limit configurations
- Preset rate limiters
- Key files: lib/middleware/rateLimiter.ts, lib/middleware/rateLimitConfig.ts
11.6 Stripe Integration
- Status: FULLY IMPLEMENTED
- Checkout session creation
- Webhook handling
- Session verification
- VIP subscription management
- Key files: app/api/stripe/create-checkout-session/route.ts, app/api/stripe/webhook/route.ts, app/api/stripe/verify-session/route.ts, types/stripe.types.ts
---
12. UI COMPONENTS (Key Inventory)
Layout & Navigation
- GameLayout.tsx - Three-panel layout (stats, center view, controls)
- TopNavBar.tsx - Navigation between views
- ControlsPanel.tsx - Movement controls
- StatsPanel.tsx - Player stats display
- ErrorBoundary.tsx - Error handling
Game Views (Center Panel)
- TileRenderer.tsx - Main tile display with terrain, harvest, combat
- LeaderboardView.tsx - Player rankings
- ClanLeaderboardView.tsx - Clan rankings
- ClanManagementView.tsx - Clan management
- StatsViewWrapper.tsx - Player statistics
- TechTreePage.tsx - Tech tree (embedded)
- ProfilePage.tsx - Player profile (embedded)
- AdminPage.tsx - Admin panel (embedded)
- WMDHub.tsx - WMD dashboard
- ReferralsPage.tsx - Referral dashboard
Panels & Modals
- BankPanel.tsx - Banking interface
- ShrinePanel.tsx - Shrine trading
- UnitBuildPanelEnhanced.tsx - Unit construction
- FactoryManagementPanel.tsx - Factory management
- TierUnlockPanel.tsx - Tier unlocking
- AuctionHousePanel.tsx - Auction house
- InventoryPanel.tsx - Inventory display
- BotScannerPanel.tsx - Bot scanning
- BotMagnetPanel.tsx - Bot magnet deployment
- BotSummoningPanel.tsx - Bot summoning
- BountyBoardPanel.tsx - Daily bounties
- BeerBasePanel.tsx - Beer base interactions
- AutoFarmPanel.tsx - Auto-farm controls
- AutoFarmStatsDisplay.tsx - Auto-farm statistics
- FlagTrackerPanel.tsx - Flag bearer tracking
- FlagBearerPanel.tsx - Flag bearer actions
- ShrineStatusPanel.tsx - Active shrine boosts
- WMDMiniStatus.tsx - WMD sidebar widget
- AchievementPanel.tsx - Achievement display
- AchievementNotification.tsx - Achievement popups
- DiscoveryNotification.tsx - Discovery popups
- DiscoveryLogPanel.tsx - Discovery history
- SpecializationPanel.tsx - Specialization selection
- CombatAttackModal.tsx - Combat interface
- BattleResultModal.tsx - Battle results
- BattleLogViewer.tsx - Battle log viewer
- BattleLogModal.tsx - Battle log modal
- BattleLogLinks.tsx - Battle log links
- HarvestModal.tsx - Harvest results
- HarvestButton.tsx - Harvest action button
- FundDistributionPanel.tsx - Clan fund distribution
- AlliancePanel.tsx - Clan alliance management
- HotkeyManagerPanel.tsx - Hotkey configuration
WMD Components
- WMDMissilePanel.tsx - Missile assembly/launch
- WMDDefensePanel.tsx - Defense battery management
- WMDIntelligencePanel.tsx - Spy operations
- WMDResearchPanel.tsx - WMD research tree
- WMDVotingPanel.tsx - WMD clan voting
- WMDNotificationsPanel.tsx - WMD notifications
Social Components
- FriendsList.tsx - Friend list
- FriendRequestsPanel.tsx - Friend request management
- AddFriendModal.tsx - Add friend interface
- FriendActionsMenu.tsx - Friend action menu
- ClanChatPanel.tsx - Clan chat
- ClanActivityFeed.tsx - Clan activity feed
- ClanLeaderboardPanel.tsx - Clan leaderboard sidebar
UI Primitives
- Panel.tsx, Badge.tsx, Button.tsx, StatCard.tsx, Skeleton.tsx, RichTextEditor.tsx, ProgressBar.tsx, Input.tsx, IconButton.tsx, Divider.tsx, Card.tsx, Alert.tsx, XPProgressBar.tsx, BalanceIndicator.tsx
Transition Components
- StaggerChildren.tsx, PageTransition.tsx, LoadingSpinner.tsx
---
13. PAGES (Next.js Routes)
- app/game/page.tsx - Main game page (1231 lines, the central hub)
- app/tech-tree/page.tsx - Tech tree page
- app/profile/page.tsx - Player profile page
- app/admin/page.tsx - Admin panel page
- app/referrals/page.tsx - Referrals page
---
14. SYSTEMS MARKED AS "COMING SOON" IN UI
From app/game/page.tsx, two center views are explicitly placeholder:
- BATTLE_LOG (line 1058): Shows "Battle Log View - Coming Soon"
- INVENTORY (line 1073): Shows "Inventory View - Coming Soon"
Note: These are only the embedded center panel views. The InventoryPanel and BattleLogLinks components exist and function as sidebar/overlay elements.
---
15. SUMMARY: WHAT EXISTS vs WHAT NEEDS BUILDING
Fully Implemented and Functional:
1. Map generation and movement (150x150, 9 terrains)
2. Resource harvesting (metal, energy, caves, forests)
3. Player auth (Supabase), progression (XP, levels, RP)
4. Unit system (40 base + 15 specialized + 10 prestige = 65 unit types)
5. Factory system (claim, upgrade, produce, attack)
6. Bank system (deposit, withdraw, exchange)
7. Shrine system (trade items for boosts)
8. Auction house (full P2P trading)
9. Bot system (6 types, permanence, regeneration, nests, beer bases)
10. Bot interaction tools (scanner, magnet, summoning, bounties)
11. Flag bearer system (King of the Hill with flee/challenge)
12. Clan system (full: creation, roles, research, banking, perks, leveling, territory, warfare, monuments, alliances, chat, fund distribution)
13. WMD system (missiles, defense, intelligence, research, voting, notifications, background jobs)
14. Combat system (PvE bot attacks, PvP infantry, factory attacks)
15. Social systems (global chat, DMs, friends, referrals)
16. Progression systems (tutorial, achievements, discoveries, specializations, daily login)
17. Leaderboards (player and clan)
18. Admin panel (comprehensive: tiles, players, factories, clans, battles, WMD, VIP, moderation)
19. Infrastructure (WebSocket, activity logging, caching, rate limiting, Stripe, background jobs)
20. Auto-farm system (automated map traversal with session/all-time stats)
Partially Implemented / Placeholder:
1. Battle Log - Full battle log viewer exists as modal (BattleLogModal.tsx, BattleLogViewer.tsx), but the embedded center panel view shows "Coming Soon"
2. Inventory - InventoryPanel.tsx exists as a sidebar component, but the embedded center panel view shows "Coming Soon"
Not Yet Implemented (despite type definitions):
1. Concentration Zones - Types and service exist (lib/concentrationZoneService.ts, app/api/concentration-zones/route.ts), but no dedicated UI component in the main game page
2. Tool Durability - lib/toolDurabilityService.ts exists but no UI integration visible
3. Upkeep System - lib/upkeepService.ts exists but no UI integration visible
4. Territory Decay - lib/territoryDecayService.ts exists but no UI integration visible
5. PixiJS Interactive Map - Types fully defined in types/map.types.ts (zoom levels, viewport, player markers, WebSocket events), but the actual PixiJS rendering implementation appears to be a future feature (types and utilities exist, but no PixiJS canvas component found)