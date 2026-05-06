# DarkFrame Discord Roles & Arcane Level Mapping

Overview

This document provides a tailored Discord roles system for DarkFrame. It maps Arcane leveling tiers to community and gameplay roles, includes core moderation roles, clan roles, and event/temporary roles. The roles emphasize progression, in-game responsibilities (Auction House, Factories, Tech Research, Bot Hunting), and community engagement.

Principles

- Reward activity with Arcane levels (XP = play/engagement). Use Arcane "Level Roles" and role gating for perks.
- Mirror in-game systems with roles to promote specialization and clarity.
- Keep moderator/admin roles separate and tightly permissioned.
- Provide clear paths for clan role integration and event roles for short-term campaigns.

Arcane Level Roles (Progression)

- Novice (Level 1) — Default role. Basic access to public channels and help.
- Explorer (Level 3) — Access to resource/trading channels, auction watcher.
- Apprentice (Level 6) — Access to event channels and crafting tips.
- Specialist (Level 10) — Access to Factory & Tech channels. Perk: "Factory Owner" role eligibility.
- Veteran (Level 15) — Auction House perks (priority listing notifications, dedicated auction channels).
- Arcane (Level 20) — Access to competitive event channels, higher-level clan perms.
- Elite Arcane (Level 25) — Recognized contributors: Discord badge and nomination for moderator trial.
- Legendary (Level 30+) — Permanent recognition, custom role color, access to dev playtest channels.

Core Server Roles

- Owner — Full permissions, server settings, and the only Admin & Developer. This user is the sole person with elevated access to production systems, developer channels, and server configuration.
- Moderator — Moderate chat, handle appeals, and manage day-to-day enforcement. Assign only to trusted users.
- Bot — Role for automation (Arcane, reaction role bot accounts).

Gameplay Roles (Specialized)

These roles are tied to in-game systems and can be assigned manually or via Arcane thresholds + role reactions.

- Auctioneer — Players who regularly post/manage auctions. Perks: auction announcement channel posting.
- Trader — Stable traders with a history of honorable deals. Perks: access to Trader lounge.
- Factory Owner — Players that own and operate factories. Access: Factory management channel; role eligibility starts at Specialist (Lvl 10).
- Shipbuilder / Engineer — Players who build and upgrade units. Access: Build & Workshop channels.
- Researcher — Players active in the Tech Tree. Access: Tech lab channels and beta test invites.
- Bot Hunter — Players specializing in bot content (PvE, bot hunting). Perks: Bot Hunter leaderboards & event invites.
- Scout — Players focused on exploration and resources. Access: Resource scouting channels.

Clan Roles

- Clan Leader — Clan top role. Access to clan management channels, private clan planning voice channels.
- Clan Officer — Support leaders in clan management. Can moderate clan chat.
- Clan Member — Default clan role within the server.
- Clan Recruit — Probationary role for new clan arrivals.
- Clan Trader — Dedicated to inter-clan trades; access to cross-clan marketplace.

Event & Temporary Roles

- Event Organizer — For event staff and trusted users.
- Event Participant — Auto-assigned during events.
- Tournament Champion — Awarded to winners with a special color for a season.
- Seasonal Roles (e.g., Spring Festival 2025) — Time-limited and cosmetic.

Role Assignment & Automation Recommendations

- Use Arcane's Level Roles to auto-assign progression-based roles.
- Use a reaction-role bot (Sesh, YAGPDB, or Arcane's built-in features) for opt-in roles like Trader, Scout, and Bot Hunter.
- Use webhooks and server bots to announce auction listings and factory events to specific channels. Map these announcements to roles (e.g., @Auctioneer gets pinged for top bids).
- Sync clan roles with in-game clan membership via a bot if possible (securely). Use role claim for clan leaders (manual verification or auto with a clan-owner API token).

Perks & Channel Access Suggestions

- Auction Channels
  - #auction-house — Public listings and browsing.
  - #auction-bids — Active bid discussions (visible to Explorer+).
  - #auction-official — Auctioneer / Admin only announcements.

- Factory & Builds
  - #factory-hub — Factory events, build queues, and help (Specialist+).
  - #workshop — Sharing build tips & schematics (Shipbuilder/Engineer+).

- Tech & Research
  - #tech-lab — Research discussions and prerelease research (Researcher+).
  - #strategy-discussion — General strategy; access at higher arcane levels.

- Clan Spaces
  - #clan-lounge — Private per-clan channels for Leader/Officer/Member.
  - #clan-market — Cross-clan business (public, but pinned for Clan Trader role).

- Events & PvP
  - #event-announcements — All users; pings to Event Organizer & Event Participant.
  - #tournaments — Tournament registration & updates.

Moderation & Security Notes

- The Owner is the only Admin & Developer. Do not assign Admin or Developer privileges to other accounts. Use the Owner account and a secure process for deployments/patches.
- Reserve Moderator roles to trusted users and require 2FA on their accounts where possible.
- Keep Bot role strictly controlled. For automation and webhooks, use dedicated bot accounts with minimal permissions.
- For auto-role assignment via bots, ensure the bot has only necessary permissions and is rate-limited.

Implementation Checklist

- [ ] Create Arcane Level Roles in Arcane dashboard with thresholds above.
- [ ] Set up reaction-role bot for opt-in roles (Trader, Scout, Bot Hunter).
- [ ] Create role-specific channels and set role-based permissions.
- [ ] Implement webhooks or an in-server bot to announce auction & factory events.
- [ ] Optionally integrate clan membership via secure bot for auto role mapping.

References (project files with feature evidence)

- Auction House: components/AuctionHousePanel.tsx, components/AuctionListingCard.tsx, types/auction.types.ts
- Factories: components/FactoryButton.tsx, components/FactoryManagementPanel.tsx, UnitBuildPanelEnhanced.tsx, lib/factoryUpgradeService.ts
- Tech Tree: app/tech-tree/page.tsx, app/api/research
- Bots & AI: types/botConfig.types.ts, app/api/admin/bot-spawn, bot-regen, bot-stats
- Clan Systems: COMPLETE_CLAN_SYSTEM_PLAN.md, components/ClanChatPanel.tsx

Next Steps

- If this draft looks good, I'll commit it to docs/DISCORD_ROLES.md and update the todo list.
- I can also generate example Arcane dashboard values and channel permission snippets.

-- End of Document
