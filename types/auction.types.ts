/**
 * @file types/auction.types.ts
 * @created 2025-01-17
 * @overview Auction House type definitions for P2P trading system
 */

import { UnitType } from './game.types';

/**
 * Types of items that can be auctioned
 */
export enum AuctionItemType {
  Unit = 'unit',
  Resource = 'resource',
  TradeableItem = 'tradeable_item'
}

/**
 * Auction listing status
 */
export enum AuctionStatus {
  Active = 'active',           // Currently accepting bids
  Sold = 'sold',               // Successfully sold
  Cancelled = 'cancelled',     // Cancelled by seller
  Expired = 'expired'          // Expired with no bids
}

/**
 * Resource types for trading
 */
export enum ResourceType {
  Metal = 'metal',
  Energy = 'energy'
}

/**
 * Item being auctioned
 */
export interface AuctionItem {
  itemType: AuctionItemType;
  
  // For units
  unitType?: UnitType;
  unitId?: string;
  unitStrength?: number;
  unitDefense?: number;
  
  // For resources
  resourceType?: ResourceType;
  resourceAmount?: number;
  
  // For tradeable items
  tradeableItemQuantity?: number;
}

/**
 * Bid placed on an auction
 */
export interface AuctionBid {
  bidId: string;
  auctionId: string;
  bidderUsername: string;
  bidAmount: number;
  bidTime: Date;
  isWinning: boolean; // Current highest bid
}

/**
 * Auction listing
 */
export interface AuctionListing {
  auctionId: string;
  sellerUsername: string;
  sellerClan?: string; // For clan-only auctions (0% fee)
  
  item: AuctionItem;
  
  // Pricing
  startingBid: number;
  currentBid: number;
  buyoutPrice?: number; // Optional instant buy price
  reservePrice?: number; // Minimum price to sell (hidden from buyers)
  
  // Bidding
  bids: AuctionBid[];
  highestBidder?: string;
  
  // Timing
  createdAt: Date;
  expiresAt: Date;
  duration: number; // Duration in hours (12, 24, 48)
  
  // Status
  status: AuctionStatus;
  closedAt?: Date;
  
  // Fees
  listingFee: number; // Paid upfront when creating listing
  saleFee: number; // 5% of final price (0% for clan-only)
  clanOnly: boolean; // Only clan members can bid
  
  // Settlement
  settled: boolean;
  settledAt?: Date;
  finalPrice?: number;
  winnerUsername?: string;
}

/**
 * Trade history record
 */
export interface TradeHistory {
  tradeId: string;
  auctionId: string;
  
  sellerUsername: string;
  buyerUsername: string;
  
  item: AuctionItem;
  
  finalPrice: number;
  saleFee: number;
  sellerReceived: number; // finalPrice - saleFee
  
  tradeType: 'auction' | 'buyout';
  
  completedAt: Date;
}

/**
 * Market statistics for an item type
 */
export interface MarketStats {
  itemType: AuctionItemType;
  unitType?: UnitType;
  resourceType?: ResourceType;
  
  // Price statistics
  averagePrice: number;
  medianPrice: number;
  lowestPrice: number;
  highestPrice: number;
  
  // Volume statistics
  totalSales: number;
  totalVolume: number; // Total resources/units/items traded
  
  // Recent activity
  last24Hours: {
    sales: number;
    averagePrice: number;
  };
  
  lastUpdated: Date;
}

/**
 * Auction notification for users
 */
export interface AuctionNotification {
  notificationId: string;
  username: string;
  auctionId: string;
  
  type: 'outbid' | 'won' | 'sold' | 'expired' | 'cancelled';
  
  message: string;
  createdAt: Date;
  read: boolean;
}

/**
 * Auction search filters
 */
export interface AuctionSearchFilters {
  itemType?: AuctionItemType;
  unitType?: UnitType;
  resourceType?: ResourceType;
  
  minPrice?: number;
  maxPrice?: number;
  
  hasBuyout?: boolean;
  clanOnly?: boolean;
  
  sellerUsername?: string;
  
  sortBy?: 'price_asc' | 'price_desc' | 'ending_soon' | 'newly_listed';
  
  page?: number;
  limit?: number;
}

/**
 * Auction creation request
 */
export interface CreateAuctionRequest {
  item: AuctionItem;
  startingBid: number;
  buyoutPrice?: number;
  reservePrice?: number;
  duration: 12 | 24 | 48; // Hours
  clanOnly?: boolean;
}

/**
 * Auction bid request
 */
export interface PlaceBidRequest {
  auctionId: string;
  bidAmount: number;
}

/**
 * Auction buyout request
 */
export interface BuyoutAuctionRequest {
  auctionId: string;
}

/**
 * Auction listing fees configuration
 */
export const AUCTION_CONFIG = {
  // Listing fees (paid upfront, non-refundable)
  LISTING_FEE_12H: 100,
  LISTING_FEE_24H: 150,
  LISTING_FEE_48H: 200,
  
  // Sale fees (% of final price)
  PUBLIC_SALE_FEE: 0.05, // 5% for public auctions
  CLAN_SALE_FEE: 0.00,   // 0% for clan-only auctions
  
  // Bid increment (minimum increase over current bid)
  MIN_BID_INCREMENT: 100,
  
  // Price limits
  MIN_STARTING_BID: 100,
  MAX_STARTING_BID: 1000000,
  
  // Duration options (hours)
  DURATIONS: [12, 24, 48] as const,
  
  // Maximum active listings per player
  MAX_ACTIVE_LISTINGS: 10,
  
  // Maximum bids per player per auction
  MAX_BIDS_PER_AUCTION: 1, // Only one active bid per player (can be outbid)
  
  // Settlement grace period (minutes after auction ends)
  SETTLEMENT_GRACE_PERIOD: 60
};

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Listing fees are paid upfront and non-refundable
// - Sale fees are deducted from final price when auction closes
// - Clan-only auctions have 0% sale fee to encourage internal trading
// - Buyout allows instant purchase at fixed price
// - Reserve price is hidden minimum; auction fails if not met
// - Bids are binding; winner must complete purchase
// - Auto-settlement after grace period if winner doesn't claim
// ============================================================
// END OF FILE
// ============================================================
