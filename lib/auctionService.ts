/**
 * @file lib/auctionService.ts
 * @created 2025-01-17
 * @overview Auction House service for P2P trading system
 */

import { getCollection, type MongoFilter, type MongoUpdate, type SortSpec } from './mongodb';
import { 
  AuctionListing, 
  AuctionBid, 
  AuctionStatus, 
  AuctionItem,
  AuctionItemType,
  TradeHistory,
  CreateAuctionRequest,
  PlaceBidRequest,
  AUCTION_CONFIG,
  AuctionSearchFilters,
} from '@/types/auction.types';
import { Player } from '@/types/game.types';
import { logger } from './logger';

/**
 * Create a new auction listing
 * 
 * @param sellerUsername - Username of the seller
 * @param request - Auction creation details
 * @returns Created auction listing
 */
export async function createAuctionListing(
  sellerUsername: string,
  request: CreateAuctionRequest
): Promise<{ success: boolean; message: string; auction?: AuctionListing; error?: string }> {
  try {
    const playersCollection = await getCollection<Player>('players');
    const auctionsCollection = await getCollection<AuctionListing>('auctions');

    // Get seller
    const seller = await playersCollection.findOne({ username: sellerUsername });
    if (!seller) {
      return { success: false, message: 'Seller not found', error: 'SELLER_NOT_FOUND' };
    }

    // Check active listings limit
    const activeListings = await auctionsCollection.countDocuments({
      sellerUsername,
      status: AuctionStatus.Active
    });

    if (activeListings >= AUCTION_CONFIG.MAX_ACTIVE_LISTINGS) {
      return {
        success: false,
        message: `Maximum ${AUCTION_CONFIG.MAX_ACTIVE_LISTINGS} active listings reached`,
        error: 'MAX_LISTINGS_REACHED'
      };
    }

    // Validate starting bid
    if (request.startingBid < AUCTION_CONFIG.MIN_STARTING_BID) {
      return {
        success: false,
        message: `Starting bid must be at least ${AUCTION_CONFIG.MIN_STARTING_BID}`,
        error: 'BID_TOO_LOW'
      };
    }

    if (request.startingBid > AUCTION_CONFIG.MAX_STARTING_BID) {
      return {
        success: false,
        message: `Starting bid cannot exceed ${AUCTION_CONFIG.MAX_STARTING_BID}`,
        error: 'BID_TOO_HIGH'
      };
    }

    // Validate buyout price
    if (request.buyoutPrice && request.buyoutPrice <= request.startingBid) {
      return {
        success: false,
        message: 'Buyout price must be higher than starting bid',
        error: 'INVALID_BUYOUT'
      };
    }

    // Validate reserve price
    if (request.reservePrice && request.reservePrice < request.startingBid) {
      return {
        success: false,
        message: 'Reserve price cannot be lower than starting bid',
        error: 'INVALID_RESERVE'
      };
    }

    // Validate duration
    if (!AUCTION_CONFIG.DURATIONS.includes(request.duration)) {
      return {
        success: false,
        message: 'Invalid duration. Must be 12, 24, or 48 hours',
        error: 'INVALID_DURATION'
      };
    }

    // Calculate listing fee
    const listingFee = request.duration === 12 
      ? AUCTION_CONFIG.LISTING_FEE_12H
      : request.duration === 24
        ? AUCTION_CONFIG.LISTING_FEE_24H
        : AUCTION_CONFIG.LISTING_FEE_48H;

    // Check seller has enough resources for listing fee
    if (seller.resources.metal < listingFee) {
      return {
        success: false,
        message: `Insufficient metal for listing fee (${listingFee} required)`,
        error: 'INSUFFICIENT_FUNDS'
      };
    }

    // Validate item ownership and lock item
    const itemValidation = await validateAndLockItem(seller, request.item);
    if (!itemValidation.success) {
      return {
        success: false,
        message: itemValidation.message,
        error: itemValidation.error
      };
    }

    // Calculate sale fee (will be deducted when auction closes)
    const saleFee = request.clanOnly ? AUCTION_CONFIG.CLAN_SALE_FEE : AUCTION_CONFIG.PUBLIC_SALE_FEE;

    // Create auction listing
    const auctionId = `AUC-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + request.duration * 60 * 60 * 1000);

    const auction: AuctionListing = {
      auctionId,
      sellerUsername,
      // sellerClan: seller.clan, // TODO: Enable in Phase 5 when clans are implemented
      item: request.item,
      startingBid: request.startingBid,
      currentBid: request.startingBid,
      buyoutPrice: request.buyoutPrice,
      reservePrice: request.reservePrice,
      bids: [],
      createdAt: now,
      expiresAt,
      duration: request.duration,
      status: AuctionStatus.Active,
      listingFee,
      saleFee,
      clanOnly: request.clanOnly || false,
      settled: false
    };

    // Insert auction
    await auctionsCollection.insertOne(auction);

    // Deduct listing fee and lock item
    // Merge the listing fee into the item-lock $inc (fee + locked amount share the
    // resources_metal column). Spreading lockUpdate OVER $inc REPLACED the fee entry,
    // so sellers never actually paid the listing fee (live-verified: 10 metal refund).
    const lockInc = (itemValidation.lockUpdate?.$inc ?? {}) as Record<string, number>;
    await playersCollection.updateOne(
      { username: sellerUsername },
      {
        $inc: { resources_metal: -listingFee, ...lockInc }
      }
    );

    logger.info('Auction created', { auctionId, seller: sellerUsername, item: request.item });

    return {
      success: true,
      message: `Auction created! Listing fee: ${listingFee} metal`,
      auction
    };

  } catch (error) {
    logger.error('Error creating auction', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to create auction',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Validate item ownership and prepare lock update
 */
async function validateAndLockItem(
  player: Player,
  item: AuctionItem
): Promise<{ success: boolean; message: string; error?: string; lockUpdate?: MongoUpdate }> {
  
  if (item.itemType === AuctionItemType.Unit) {
    // Validate unit ownership
    if (!item.unitId) {
      return { success: false, message: 'Unit ID is required', error: 'INVALID_ITEM' };
    }

    const unit = player.units.find((u) => u.unitId === item.unitId);
    if (!unit) {
      return { success: false, message: 'Unit not found', error: 'UNIT_NOT_FOUND' };
    }

    // TODO: Check if unit is already locked in another auction or battle
    
    return {
      success: true,
      message: 'Unit validated',
      lockUpdate: {
        $set: { [`units.$[unit].locked`]: true }
      },
      // Note: In production, implement proper array filter for specific unit
    };

  } else if (item.itemType === AuctionItemType.Resource) {
    // Validate resource amount
    if (!item.resourceType || !item.resourceAmount) {
      return { success: false, message: 'Resource type and amount required', error: 'INVALID_ITEM' };
    }

    const currentAmount = item.resourceType === 'metal' 
      ? player.resources.metal 
      : player.resources.energy;

    if (currentAmount < item.resourceAmount) {
      return {
        success: false,
        message: `Insufficient ${item.resourceType}`,
        error: 'INSUFFICIENT_RESOURCES'
      };
    }

    return {
      success: true,
      message: 'Resources validated',
      lockUpdate: {
        $inc: { [`resources.${item.resourceType}`]: -item.resourceAmount }
      }
    };

  } else if (item.itemType === AuctionItemType.TradeableItem) {
    // Validate tradeable items
    if (!item.tradeableItemQuantity) {
      return { success: false, message: 'Tradeable item quantity required', error: 'INVALID_ITEM' };
    }

    const tradeableItems = player.inventory?.items.filter((i) => i.type === 'TRADEABLE_ITEM') || [];
    const totalCount = tradeableItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

    if (totalCount < item.tradeableItemQuantity) {
      return {
        success: false,
        message: 'Insufficient tradeable items',
        error: 'INSUFFICIENT_ITEMS'
      };
    }

    // TODO: Implement proper tradeable item locking
    return {
      success: true,
      message: 'Tradeable items validated',
      lockUpdate: {}
    };
  }

  return { success: false, message: 'Invalid item type', error: 'INVALID_ITEM_TYPE' };
}

/**
 * Place a bid on an auction
 * 
 * @param bidderUsername - Username of the bidder
 * @param request - Bid details
 * @returns Bid result
 */
export async function placeBid(
  bidderUsername: string,
  request: PlaceBidRequest
): Promise<{ success: boolean; message: string; auction?: AuctionListing; error?: string }> {
  try {
    const playersCollection = await getCollection<Player>('players');
    const auctionsCollection = await getCollection<AuctionListing>('auctions');

    // Get bidder
    const bidder = await playersCollection.findOne({ username: bidderUsername });
    if (!bidder) {
      return { success: false, message: 'Bidder not found', error: 'BIDDER_NOT_FOUND' };
    }

    // Get auction
    const auction = await auctionsCollection.findOne({ auctionId: request.auctionId });
    if (!auction) {
      return { success: false, message: 'Auction not found', error: 'AUCTION_NOT_FOUND' };
    }

    // Validate auction status
    if (auction.status !== AuctionStatus.Active) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    // Check if expired
    if (new Date() > auction.expiresAt) {
      return { success: false, message: 'Auction has expired', error: 'AUCTION_EXPIRED' };
    }

    // Check if bidder is seller
    if (bidderUsername === auction.sellerUsername) {
      return { success: false, message: 'Cannot bid on own auction', error: 'SELF_BID' };
    }

    // Check clan-only restriction (TODO: Enable in Phase 5)
    // if (auction.clanOnly && bidder.clan !== auction.sellerClan) {
    //   return { success: false, message: 'This is a clan-only auction', error: 'CLAN_ONLY' };
    // }

    // Validate bid amount
    const minBid = auction.currentBid + AUCTION_CONFIG.MIN_BID_INCREMENT;
    if (request.bidAmount < minBid) {
      return {
        success: false,
        message: `Bid must be at least ${minBid} (current bid + ${AUCTION_CONFIG.MIN_BID_INCREMENT})`,
        error: 'BID_TOO_LOW'
      };
    }

    // Check bidder has enough resources
    if (bidder.resources.metal < request.bidAmount) {
      return {
        success: false,
        message: 'Insufficient metal for bid',
        error: 'INSUFFICIENT_FUNDS'
      };
    }

    // Create bid
    const bidId = `BID-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const newBid: AuctionBid = {
      bidId,
      auctionId: request.auctionId,
      bidderUsername,
      bidAmount: request.bidAmount,
      bidTime: new Date(),
      isWinning: true
    };

    // Mark previous winning bid as not winning
    const updatedBids = auction.bids.map((b: AuctionBid) => ({ ...b, isWinning: false }));
    updatedBids.push(newBid);

    // Update auction
    await auctionsCollection.updateOne(
      { auctionId: request.auctionId },
      {
        $set: {
          currentBid: request.bidAmount,
          highestBidder: bidderUsername,
          bids: updatedBids
        }
      }
    );

    // TODO: Create notification for previous highest bidder (outbid)
    // TODO: Lock bidder's resources

    const updatedAuction = await auctionsCollection.findOne({ auctionId: request.auctionId });

    logger.info('Bid placed', { auctionId: request.auctionId, bidder: bidderUsername, amount: request.bidAmount });

    return {
      success: true,
      message: `Bid placed successfully! You are the highest bidder at ${request.bidAmount} metal`,
      auction: updatedAuction!
    };

  } catch (error) {
    logger.error('Error placing bid', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to place bid',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Instant buyout of an auction
 * 
 * @param buyerUsername - Username of the buyer
 * @param auctionId - Auction ID
 * @returns Buyout result
 */
export async function buyoutAuction(
  buyerUsername: string,
  auctionId: string
): Promise<{ success: boolean; message: string; trade?: TradeHistory; error?: string }> {
  try {
    const playersCollection = await getCollection<Player>('players');
    const auctionsCollection = await getCollection<AuctionListing>('auctions');
    const tradesCollection = await getCollection<TradeHistory>('tradeHistory');

    // Get buyer
    const buyer = await playersCollection.findOne({ username: buyerUsername });
    if (!buyer) {
      return { success: false, message: 'Buyer not found', error: 'BUYER_NOT_FOUND' };
    }

    // Get auction
    const auction = await auctionsCollection.findOne({ auctionId });
    if (!auction) {
      return { success: false, message: 'Auction not found', error: 'AUCTION_NOT_FOUND' };
    }

    // Validate buyout available
    if (!auction.buyoutPrice) {
      return { success: false, message: 'This auction has no buyout price', error: 'NO_BUYOUT' };
    }

    // Validate auction status
    if (auction.status !== AuctionStatus.Active) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    // Check if buyer is seller
    if (buyerUsername === auction.sellerUsername) {
      return { success: false, message: 'Cannot buy own auction', error: 'SELF_PURCHASE' };
    }

    // Check clan-only restriction (TODO: Enable in Phase 5)
    // if (auction.clanOnly && buyer.clan !== auction.sellerClan) {
    //   return { success: false, message: 'This is a clan-only auction', error: 'CLAN_ONLY' };
    // }

    // Check buyer has enough resources
    if (buyer.resources.metal < auction.buyoutPrice) {
      return {
        success: false,
        message: 'Insufficient metal for buyout',
        error: 'INSUFFICIENT_FUNDS'
      };
    }

    // Calculate fees
    const saleFeeAmount = Math.floor(auction.buyoutPrice * auction.saleFee);
    const sellerReceives = auction.buyoutPrice - saleFeeAmount;

    // Transfer item and resources
    const transferResult = await transferAuctionItem(
      auction.sellerUsername,
      buyerUsername,
      auction.item
    );

    if (!transferResult.success) {
      return {
        success: false,
        message: transferResult.message,
        error: transferResult.error
      };
    }

    // Transfer money (buyer pays, seller receives minus fee)
    await playersCollection.updateOne(
      { username: buyerUsername },
      { $inc: { resources_metal: -auction.buyoutPrice } }
    );

    await playersCollection.updateOne(
      { username: auction.sellerUsername },
      { $inc: { resources_metal: sellerReceives } }
    );

    // Update auction status
    await auctionsCollection.updateOne(
      { auctionId },
      {
        $set: {
          status: AuctionStatus.Sold,
          closedAt: new Date(),
          settled: true,
          settledAt: new Date(),
          finalPrice: auction.buyoutPrice,
          winnerUsername: buyerUsername
        }
      }
    );

    // Create trade history
    const tradeId = `TRD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const trade: TradeHistory = {
      tradeId,
      auctionId,
      sellerUsername: auction.sellerUsername,
      buyerUsername,
      item: auction.item,
      finalPrice: auction.buyoutPrice,
      saleFee: saleFeeAmount,
      sellerReceived: sellerReceives,
      tradeType: 'buyout',
      completedAt: new Date()
    };

    await tradesCollection.insertOne(trade);

    logger.info('Auction bought out', { auctionId, buyer: buyerUsername, price: auction.buyoutPrice });

    return {
      success: true,
      message: `Successfully purchased! Paid ${auction.buyoutPrice} metal`,
      trade
    };

  } catch (error) {
    logger.error('Error buying out auction', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to complete buyout',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Transfer auction item from seller to buyer
 */
async function transferAuctionItem(
  fromUsername: string,
  toUsername: string,
  item: AuctionItem
): Promise<{ success: boolean; message: string; error?: string }> {
  const playersCollection = await getCollection<Player>('players');

  if (item.itemType === AuctionItemType.Unit) {
    // Transfer unit
    const seller = await playersCollection.findOne({ username: fromUsername });
    const unit = seller?.units.find((u) => u.unitId === item.unitId);
    
    if (!unit) {
      return { success: false, message: 'Unit not found', error: 'UNIT_NOT_FOUND' };
    }

    // Remove from seller
    await playersCollection.updateOne(
      { username: fromUsername },
      { $pull: { units: { unitId: item.unitId } } }
    );

    // Add to buyer
    await playersCollection.updateOne(
      { username: toUsername },
      { $push: { units: unit } }
    );

  } else if (item.itemType === AuctionItemType.Resource) {
    // Resources already locked/deducted, just transfer to buyer
    // ($inc dot-paths into the jsonb resources object are not supported by the seam;
    // resource transfer happens through the explicit metal/energy branch below)
    const resourceField = item.resourceType === 'metal' ? 'metal' : 'energy';
    const amount = item.resourceAmount ?? 0;
    await playersCollection.updateOne(
      { username: toUsername },
      { $inc: { [resourceField]: amount } }
    );

  } else if (item.itemType === AuctionItemType.TradeableItem) {
    // Transfer tradeable items
    // TODO: Implement proper tradeable item transfer
  }

  return { success: true, message: 'Item transferred' };
}

/**
 * Cancel an auction (seller only, no bids)
 * 
 * @param sellerUsername - Username of the seller
 * @param auctionId - Auction ID
 * @returns Cancellation result
 */
export async function cancelAuction(
  sellerUsername: string,
  auctionId: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const auctionsCollection = await getCollection<AuctionListing>('auctions');

    // Get auction
    const auction = await auctionsCollection.findOne({ auctionId });
    if (!auction) {
      return { success: false, message: 'Auction not found', error: 'AUCTION_NOT_FOUND' };
    }

    // Verify ownership
    if (auction.sellerUsername !== sellerUsername) {
      return { success: false, message: 'Not authorized', error: 'NOT_AUTHORIZED' };
    }

    // Check if active
    if (auction.status !== AuctionStatus.Active) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    // Check if bids exist
    if (auction.bids.length > 0) {
      return {
        success: false,
        message: 'Cannot cancel auction with existing bids',
        error: 'HAS_BIDS'
      };
    }

    // Update status
    await auctionsCollection.updateOne(
      { auctionId },
      {
        $set: {
          status: AuctionStatus.Cancelled,
          closedAt: new Date()
        }
      }
    );

    // Return item to seller (unlock or return resources)
    // TODO: Implement proper item unlocking/return

    logger.info('Auction cancelled', { auctionId, seller: sellerUsername });

    return {
      success: true,
      message: 'Auction cancelled successfully. Listing fee is non-refundable.'
    };

  } catch (error) {
    logger.error('Error cancelling auction', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to cancel auction',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Get active auctions with filters
 * 
 * @param filters - Search and filter options
 * @returns List of auctions
 */
export async function getAuctions(
  filters: AuctionSearchFilters
): Promise<{ success: boolean; auctions: AuctionListing[]; total: number; error?: string }> {
  try {
    const auctionsCollection = await getCollection<AuctionListing>('auctions');

    // Build query (auctions schema has direct columns: status, item type, seller)
    const query: MongoFilter = { status: AuctionStatus.Active };

    if (filters.itemType) {
      query['item.itemType'] = filters.itemType;
    }

    if (filters.unitType) {
      query['item.unitType'] = filters.unitType;
    }

    if (filters.resourceType) {
      query['item.resourceType'] = filters.resourceType;
    }

    if (filters.minPrice) {
      query.currentBid = { ...(query.currentBid as Record<string, unknown> | undefined), $gte: filters.minPrice };
    }

    if (filters.maxPrice) {
      query.currentBid = { ...(query.currentBid as Record<string, unknown> | undefined), $lte: filters.maxPrice };
    }

    if (filters.hasBuyout !== undefined) {
      query.buyoutPrice = filters.hasBuyout ? { $exists: true, $ne: null } : { $exists: false };
    }

    if (filters.clanOnly !== undefined) {
      query.clanOnly = filters.clanOnly;
    }

    if (filters.sellerUsername) {
      query.sellerUsername = filters.sellerUsername;
    }

    // Sorting
    let sort: SortSpec = { createdAt: -1 };
    switch (filters.sortBy) {
      case 'price_asc':
        sort = { currentBid: 1 };
        break;
      case 'price_desc':
        sort = { currentBid: -1 };
        break;
      case 'ending_soon':
        sort = { expiresAt: 1 };
        break;
      case 'newly_listed':
      default:
        sort = { createdAt: -1 };
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await auctionsCollection.countDocuments(query);

    // Get auctions
    const auctions = await auctionsCollection
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return { success: true, auctions, total };

  } catch (error) {
    logger.error('Error getting auctions', error instanceof Error ? error : new Error(String(error)));
    return { success: false, auctions: [], total: 0, error: 'SERVER_ERROR' };
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Listing fees are non-refundable to prevent spam
// - Sale fees are deducted from final price when auction closes
// - Items are locked when listed (removed from inventory/units)
// - Bids lock buyer's resources until outbid or auction ends
// - Auto-settlement closes auction after grace period
// - Clan-only auctions have 0% fees
// - Reserve price is hidden from buyers
// ============================================================
// END OF FILE
// ============================================================
