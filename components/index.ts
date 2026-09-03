/**
 * @file components/index.ts
 * @created 2025-10-16
 * @overview Barrel export for all components
 */

export { default as GameLayout } from './GameLayout';
export { default as StatsPanel } from './StatsPanel';
export { default as TileRenderer } from './TileRenderer';
export { default as MovementControls } from './MovementControls';
export { default as ControlsPanel } from './ControlsPanel';
export { InventoryPanel } from './InventoryPanel'; // Named export (refactored component)
export { default as HarvestStatus } from './HarvestStatus';
export { default as HarvestModal } from './HarvestModal';
export { default as CaveItemNotification } from './CaveItemNotification';
export { default as FactoryButton } from './FactoryButton';
export { default as BankPanel } from './BankPanel';
export { default as ShrinePanel } from './ShrinePanel';
export { default as UnitBuildPanel } from './UnitBuildPanel';
export { default as BalanceIndicator } from './BalanceIndicator';
export { default as FactoryManagementPanel } from './FactoryManagementPanel';
export { default as XPProgressBar } from './XPProgressBar';
export { default as LevelUpModal } from './LevelUpModal';
export { default as TierUnlockPanel } from './TierUnlockPanel';
export { default as UnitBuildPanelEnhanced } from './UnitBuildPanelEnhanced';
export { default as CombatAttackModal } from './CombatAttackModal';
export { default as BattleResultModal } from './BattleResultModal';
export { default as BattleLogViewer } from './BattleLogViewer';
export { default as BattleLogLinks } from './BattleLogLinks';
export { default as BattleLogModal } from './BattleLogModal';
export { default as BackButton } from './BackButton';
export { default as SpecializationPanel } from './SpecializationPanel';
export { default as MasteryProgressBar } from './MasteryProgressBar';
export { default as DiscoveryNotification } from './DiscoveryNotification';
export { default as DiscoveryLogPanel } from './DiscoveryLogPanel';
export { AchievementNotification } from './AchievementNotification';
export { AchievementPanel } from './AchievementPanel';
export { AuctionHousePanel } from './AuctionHousePanel';
export { AuctionListingCard } from './AuctionListingCard';
export { BidHistoryViewer } from './BidHistoryViewer';
export { CreateListingModal } from './CreateListingModal';
export { default as BotScannerPanel } from './BotScannerPanel';
export { default as BotMagnetPanel } from './BotMagnetPanel';
export { default as BotSummoningPanel } from './BotSummoningPanel';
export { default as BountyBoardPanel } from './BountyBoardPanel';
export { default as BeerBasePanel } from './BeerBasePanel';
export { default as LeaderboardPanel } from './LeaderboardPanel';
export { default as ClanLeaderboardPanel } from './ClanLeaderboardPanel';
export { default as LeaderboardView } from './LeaderboardView';
export { default as ClanLeaderboardView } from './ClanLeaderboardView';
// Stats View Wrapper - 3-tab stats interface (Personal/Game/Economy)
export { default as StatsViewWrapper } from './StatsViewWrapper';

// Clan System Components (Phase 8)
// TEMPORARILY COMMENTED OUT - ClanPerkPanel has missing dependencies (PerkCard.js not found)
// export { default as ClanLevelDisplay } from './clan/ClanLevelDisplay';
// export { default as ClanPerkPanel } from './clan/ClanPerkPanel';
// export { default as ClanXPProgress } from './clan/ClanXPProgress';
// export { default as PerkCard } from './clan/PerkCard';

// Clan UI & Social Features (Phase 8)
// TEMPORARILY COMMENTED OUT - ClanChatPanel causes MongoDB client-side import issues
// export { ClanChatPanel } from './ClanChatPanel';
// export { ClanActivityFeed } from './ClanActivityFeed';
// export { AlliancePanel } from './AlliancePanel';
// export { FundDistributionPanel } from './FundDistributionPanel';
// export { PassiveIncomeDisplay } from './PassiveIncomeDisplay';

// Auto-Farm System Components (FID-20251019-001)
export { default as AutoFarmPanel } from './AutoFarmPanel';
export { default as AutoFarmStatsDisplay } from './AutoFarmStatsDisplay';

// ============================================================================
// TUTORIAL SYSTEM
// ============================================================================

// Re-export tutorial components
export * from './tutorial';

// ============================================================================
// MESSAGING SYSTEM
// ============================================================================

// Re-export messaging components
export * from './messaging';

// ============================================================================
// CHAT SYSTEM
// ============================================================================

// Re-export chat components
export * from './chat';

// ============================================================================
// ADDITIONAL CORE COMPONENTS
// ============================================================================

// Navigation and layout
export { default as TopNavBar } from './TopNavBar';
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';

// Content and display
export { SafeHtmlRenderer } from './SafeHtmlRenderer';

// ============================================================================
// WMD SYSTEM PANELS
// ============================================================================

// WMD system panels (exported individually - no subfolder index)
export { default as WMDMissilePanel } from './WMDMissilePanel';
export { default as WMDDefensePanel } from './WMDDefensePanel';
export { default as WMDIntelligencePanel } from './WMDIntelligencePanel';
export { default as WMDResearchPanel } from './WMDResearchPanel';
export { default as WMDVotingPanel } from './WMDVotingPanel';

// ============================================================================
// ADDITIONAL COMPONENTS
// ============================================================================

// Referral system
export { default as ReferralDashboard } from './ReferralDashboard';
export { default as ReferralLeaderboard } from './ReferralLeaderboard';

// Flag tracking
export { default as FlagTrackerPanel } from './FlagTrackerPanel';

// Hotkey manager
export { default as HotkeyManagerPanel } from './HotkeyManagerPanel';
