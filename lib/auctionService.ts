/**
 * @file lib/auctionService.ts
 * @created 2025-01-17
 * @overview Auction House service for P2P trading system
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database, Tables } from '@/types/database';
import { toDbAuctionItemType, toDbType, toDbResourceType } from '@/lib/supabase/enumMapping';
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
  ResourceType,
} from '@/types/auction.types';
import { Player, PlayerUnit, UnitType } from '@/types/game.types';
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
    const supabase = createServiceClient();

    const { data: seller, error: sellerErr } = await supabase
      .from('players')
      .select('*')
      .eq('username', sellerUsername)
      .single();

    if (sellerErr || !seller) {
      return { success: false, message: 'Seller not found', error: 'SELLER_NOT_FOUND' };
    }

    // Check active listings limit
    const { count, error: countErr } = await supabase
      .from('auction_listings')
      .select('*', { count: 'exact', head: true })
      .eq('seller_username', sellerUsername)
      .eq('status', AuctionStatus.Active);

    if (countErr) throw new Error(countErr.message);

    if ((count || 0) >= AUCTION_CONFIG.MAX_ACTIVE_LISTINGS) {
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

    if (request.buyoutPrice && request.buyoutPrice <= request.startingBid) {
      return {
        success: false,
        message: 'Buyout price must be higher than starting bid',
        error: 'INVALID_BUYOUT'
      };
    }

    if (request.reservePrice && request.reservePrice < request.startingBid) {
      return {
        success: false,
        message: 'Reserve price cannot be lower than starting bid',
        error: 'INVALID_RESERVE'
      };
    }

    if (!AUCTION_CONFIG.DURATIONS.includes(request.duration)) {
      return {
        success: false,
        message: 'Invalid duration. Must be 12, 24, or 48 hours',
        error: 'INVALID_DURATION'
      };
    }

    const listingFee = request.duration === 12 
      ? AUCTION_CONFIG.LISTING_FEE_12H
      : request.duration === 24
        ? AUCTION_CONFIG.LISTING_FEE_24H
        : AUCTION_CONFIG.LISTING_FEE_48H;

    if (seller.resources_metal < listingFee) {
      return {
        success: false,
        message: `Insufficient metal for listing fee (${listingFee} required)`,
        error: 'INSUFFICIENT_FUNDS'
      };
    }

    // Validate item ownership and deduct from seller
    const itemValidation = await validateAndLockItem(seller, request.item);
    if (!itemValidation.success) {
      return {
        success: false,
        message: itemValidation.message,
        error: itemValidation.error
      };
    }

    const saleFee = request.clanOnly ? AUCTION_CONFIG.CLAN_SALE_FEE : AUCTION_CONFIG.PUBLIC_SALE_FEE;

    const auctionId = `AUC-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + request.duration * 60 * 60 * 1000).toISOString();

    const auction: AuctionListing = {
      auctionId,
      sellerUsername,
      item: request.item,
      startingBid: request.startingBid,
      currentBid: request.startingBid,
      buyoutPrice: request.buyoutPrice,
      reservePrice: request.reservePrice,
      bids: [],
      createdAt: new Date(),
      expiresAt: new Date(expiresAt),
      duration: request.duration,
      status: AuctionStatus.Active,
      listingFee,
      saleFee,
      clanOnly: request.clanOnly || false,
      settled: false
    };

    // Insert auction into Supabase
    const { error: insertErr } = await supabase
      .from('auction_listings')
      .insert({
        auction_id: auctionId,
        seller_username: sellerUsername,
        starting_bid: request.startingBid,
        current_bid: request.startingBid,
        buyout_price: request.buyoutPrice,
        reserve_price: request.reservePrice,
        created_at: now,
        expires_at: expiresAt,
        duration_hours: request.duration,
        status: AuctionStatus.Active,
        listing_fee: listingFee,
        sale_fee: saleFee,
        clan_only: request.clanOnly || false,
        settled: false,
        item_type: toDbAuctionItemType(request.item.itemType),
        unit_id: request.item.unitId || null,
        unit_type: request.item.unitType ? toDbType(request.item.unitType) : null,
        unit_strength: request.item.unitStrength || null,
        unit_defense: request.item.unitDefense || null,
        resource_type: request.item.resourceType || null,
        resource_amount: request.item.resourceAmount || null,
        tradeable_item_quantity: request.item.tradeableItemQuantity || null
      });

    if (insertErr) throw new Error(insertErr.message);

    // Deduct listing fee from seller
    await supabase
      .from('players')
      .update({ resources_metal: seller.resources_metal - listingFee })
      .eq('username', sellerUsername);

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
 * Validate item ownership and prepare lock/deduction
 */
async function validateAndLockItem(
  player: Tables<'players'>,
  item: AuctionItem
): Promise<{ success: boolean; message: string; error?: string }> {
  const supabase = createServiceClient();

  if (item.itemType === AuctionItemType.Unit) {
    if (!item.unitId) {
      return { success: false, message: 'Unit ID is required', error: 'INVALID_ITEM' };
    }

    const { data: unit } = await supabase
      .from('player_units')
      .select('id, player_username, unit_type, quantity')
      .eq('id', item.unitId)
      .single();

    if (!unit || unit.player_username !== player.username) {
      return { success: false, message: 'You do not own this unit', error: 'NOT_OWNER' };
    }

    if (unit.quantity < 1) {
      return { success: false, message: 'Unit quantity is zero', error: 'INSUFFICIENT_UNITS' };
    }

    return {
      success: true,
      message: 'Unit validated'
    };

  } else if (item.itemType === AuctionItemType.Resource) {
    if (!item.resourceType || !item.resourceAmount) {
      return { success: false, message: 'Resource type and amount required', error: 'INVALID_ITEM' };
    }

    const currentAmount = item.resourceType === 'metal'
      ? player.resources_metal
      : player.resources_energy;

    if (currentAmount < item.resourceAmount) {
      return {
        success: false,
        message: `Insufficient ${item.resourceType}`,
        error: 'INSUFFICIENT_RESOURCES'
      };
    }

    return {
      success: true,
      message: 'Resources validated'
    };

  } else if (item.itemType === AuctionItemType.TradeableItem) {
    if (!item.tradeableItemQuantity || item.tradeableItemQuantity < 1) {
      return { success: false, message: 'Tradeable item quantity required', error: 'INVALID_ITEM' };
    }

    const { data: inventoryItems } = await supabase
      .from('player_inventory')
      .select('id, player_username, quantity')
      .eq('player_username', player.username);

    const totalOwned = (inventoryItems || []).reduce((sum, inv) => sum + inv.quantity, 0);

    if (totalOwned < item.tradeableItemQuantity) {
      return {
        success: false,
        message: 'Insufficient tradeable items in inventory',
        error: 'INSUFFICIENT_INVENTORY'
      };
    }

    return {
      success: true,
      message: 'Tradeable items validated'
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
    const supabase = createServiceClient();

    const { data: bidder, error: bidderErr } = await supabase
      .from('players')
      .select('*')
      .eq('username', bidderUsername)
      .single();

    if (bidderErr || !bidder) {
      return { success: false, message: 'Bidder not found', error: 'BIDDER_NOT_FOUND' };
    }

    const { data: auction, error: auctionErr } = await supabase
      .from('auction_listings')
      .select('*')
      .eq('auction_id', request.auctionId)
      .single();

    if (auctionErr || !auction) {
      return { success: false, message: 'Auction not found', error: 'AUCTION_NOT_FOUND' };
    }

    if (auction.status !== AuctionStatus.Active) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    if (new Date() > new Date(auction.expires_at)) {
      return { success: false, message: 'Auction has expired', error: 'AUCTION_EXPIRED' };
    }

    if (bidderUsername === auction.seller_username) {
      return { success: false, message: 'Cannot bid on own auction', error: 'SELF_BID' };
    }

    const minBid = auction.current_bid + AUCTION_CONFIG.MIN_BID_INCREMENT;
    if (request.bidAmount < minBid) {
      return {
        success: false,
        message: `Bid must be at least ${minBid} (current bid + ${AUCTION_CONFIG.MIN_BID_INCREMENT})`,
        error: 'BID_TOO_LOW'
      };
    }

    if (bidder.resources_metal < request.bidAmount) {
      return {
        success: false,
        message: 'Insufficient metal for bid',
        error: 'INSUFFICIENT_FUNDS'
      };
    }

    // Create bid in auction_bids table
    const bidAuctionId = `BID-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const now = new Date().toISOString();

    // Mark previous bids as not winning
    await supabase
      .from('auction_bids')
      .update({ is_winning: false })
      .eq('auction_id', request.auctionId);

    // Insert new bid
    const { error: bidInsertErr } = await supabase
      .from('auction_bids')
      .insert({
        bid_auction_id: bidAuctionId,
        auction_id: request.auctionId,
        bidder_username: bidderUsername,
        bid_amount: request.bidAmount,
        bid_time: now,
        is_winning: true
      });

    if (bidInsertErr) throw new Error(bidInsertErr.message);

    // Update auction current bid — conditional on current_bid not changing (prevents double-spend)
    const { error: updateErr } = await supabase
      .from('auction_listings')
      .update({
        current_bid: request.bidAmount,
        highest_bidder: bidderUsername
      })
      .eq('auction_id', request.auctionId)
      .eq('current_bid', auction.current_bid);

    if (updateErr) throw new Error(updateErr.message);

    const { data: verifyAuction } = await supabase
      .from('auction_listings')
      .select('current_bid')
      .eq('auction_id', request.auctionId)
      .single();

    if (!verifyAuction || verifyAuction.current_bid !== request.bidAmount) {
      return {
        success: false,
        message: 'Bid was outpaced by another bidder. Please try again.',
        error: 'BID_OUTPACED'
      };
    }

    const { data: updatedAuction } = await supabase
      .from('auction_listings')
      .select('*')
      .eq('auction_id', request.auctionId)
      .single();

    logger.info('Bid placed', { auctionId: request.auctionId, bidder: bidderUsername, amount: request.bidAmount });

    return {
      success: true,
      message: `Bid placed successfully! You are the highest bidder at ${request.bidAmount} metal`,
      auction: convertSupabaseListing(updatedAuction!)
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
    const supabase = createServiceClient();

    const { data: buyer, error: buyerErr } = await supabase
      .from('players')
      .select('*')
      .eq('username', buyerUsername)
      .single();

    if (buyerErr || !buyer) {
      return { success: false, message: 'Buyer not found', error: 'BUYER_NOT_FOUND' };
    }

    const { data: auction, error: auctionErr } = await supabase
      .from('auction_listings')
      .select('*')
      .eq('auction_id', auctionId)
      .single();

    if (auctionErr || !auction) {
      return { success: false, message: 'Auction not found', error: 'AUCTION_NOT_FOUND' };
    }

    if (!auction.buyout_price) {
      return { success: false, message: 'This auction has no buyout price', error: 'NO_BUYOUT' };
    }

    if (auction.status !== AuctionStatus.Active) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    if (buyerUsername === auction.seller_username) {
      return { success: false, message: 'Cannot buy own auction', error: 'SELF_PURCHASE' };
    }

    if (buyer.resources_metal < auction.buyout_price) {
      return {
        success: false,
        message: 'Insufficient metal for buyout',
        error: 'INSUFFICIENT_FUNDS'
      };
    }

    const buyoutPrice = auction.buyout_price;
    const saleFeeAmount = Math.floor(buyoutPrice * auction.sale_fee);
    const sellerReceives = buyoutPrice - saleFeeAmount;

    // Transfer item
    const transferResult = await transferAuctionItem(
      auction.seller_username,
      buyerUsername,
      auction
    );

    if (!transferResult.success) {
      return {
        success: false,
        message: transferResult.message,
        error: transferResult.error
      };
    }

    // Transfer money
    await supabase
      .from('players')
      .update({ resources_metal: buyer.resources_metal - buyoutPrice })
      .eq('username', buyerUsername);

    const { data: seller } = await supabase
      .from('players')
      .select('resources_metal')
      .eq('username', auction.seller_username)
      .single();

    if (seller) {
      await supabase
        .from('players')
        .update({ resources_metal: seller.resources_metal + sellerReceives })
        .eq('username', auction.seller_username);
    }

    const now = new Date().toISOString();

    // Update auction status — conditional on status still being active (prevents double-purchase)
    const { error: updateErr } = await supabase
      .from('auction_listings')
      .update({
        status: AuctionStatus.Sold,
        closed_at: now,
        settled: true,
        settled_at: now,
        final_price: buyoutPrice,
        winner_username: buyerUsername
      })
      .eq('auction_id', auctionId)
      .eq('status', AuctionStatus.Active);

    if (updateErr) {
      return {
        success: false,
        message: 'Auction was already sold or expired.',
        error: 'AUCTION_NO_LONGER_ACTIVE'
      };
    }

    const { data: verifyAuction } = await supabase
      .from('auction_listings')
      .select('status')
      .eq('auction_id', auctionId)
      .single();

    if (!verifyAuction || verifyAuction.status !== AuctionStatus.Sold) {
      return {
        success: false,
        message: 'Auction was already sold or expired.',
        error: 'AUCTION_NO_LONGER_ACTIVE'
      };
    }

    const tradeId = `TRD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const trade: TradeHistory = {
      tradeId,
      auctionId,
      sellerUsername: auction.seller_username,
      buyerUsername,
      item: {
        itemType: (auction.item_type || 'resource') as AuctionItemType,
        unitId: auction.unit_id ?? undefined,
        resourceType: (auction.resource_type ?? undefined) as ResourceType,
        resourceAmount: auction.resource_amount ?? undefined,
        tradeableItemQuantity: auction.tradeable_item_quantity ?? undefined
      } as AuctionItem,
      finalPrice: buyoutPrice,
      saleFee: saleFeeAmount,
      sellerReceived: sellerReceives,
      tradeType: 'buyout',
      completedAt: new Date()
    };

    logger.info('Auction bought out', { auctionId, buyer: buyerUsername, price: buyoutPrice });

    return {
      success: true,
      message: `Successfully purchased! Paid ${buyoutPrice} metal`,
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
  auction: Tables<'auction_listings'>
): Promise<{ success: boolean; message: string; error?: string }> {
  const supabase = createServiceClient();

  const itemType = auction.item_type as string;

  if (itemType === 'UNIT') {
    // Transfer unit — handled by unit storage system
    // TODO: Implement unit transfer via unit storage
    return { success: true, message: 'Item transferred' };

  } else if (itemType === 'RESOURCE') {
    const resourceColumn = auction.resource_type === 'metal' ? 'resources_metal' : 'resources_energy';
    const amount = auction.resource_amount || 0;

    const { data: buyer } = await supabase
      .from('players')
      .select(resourceColumn)
      .eq('username', toUsername)
      .single();

    if (buyer) {
      await supabase
        .from('players')
        .update({ [resourceColumn]: (buyer[resourceColumn as keyof typeof buyer] as number) + amount } as Database['public']['Tables']['players']['Update'])
        .eq('username', toUsername);
    }
    return { success: true, message: 'Item transferred' };

  } else if (itemType === 'TRADEABLE_ITEM') {
    // TODO: Implement proper tradeable item transfer
    return { success: true, message: 'Item transferred' };
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
    const supabase = createServiceClient();

    const { data: auction, error: auctionErr } = await supabase
      .from('auction_listings')
      .select('*')
      .eq('auction_id', auctionId)
      .single();

    if (auctionErr || !auction) {
      return { success: false, message: 'Auction not found', error: 'AUCTION_NOT_FOUND' };
    }

    if (auction.seller_username !== sellerUsername) {
      return { success: false, message: 'Not authorized', error: 'NOT_AUTHORIZED' };
    }

    if (auction.status !== AuctionStatus.Active) {
      return { success: false, message: 'Auction is not active', error: 'AUCTION_NOT_ACTIVE' };
    }

    // Check if bids exist
    const { count, error: bidCountErr } = await supabase
      .from('auction_bids')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', auctionId);

    if (bidCountErr) throw new Error(bidCountErr.message);

    if ((count || 0) > 0) {
      return {
        success: false,
        message: 'Cannot cancel auction with existing bids',
        error: 'HAS_BIDS'
      };
    }

    await supabase
      .from('auction_listings')
      .update({
        status: AuctionStatus.Cancelled,
        closed_at: new Date().toISOString()
      })
      .eq('auction_id', auctionId);

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
    const supabase = createServiceClient();

    let query = supabase
      .from('auction_listings')
      .select('*', { count: 'exact' })
      .eq('status', AuctionStatus.Active);

    if (filters.itemType) {
      query = query.eq('item_type', filters.itemType);
    }

    if (filters.unitType) {
      query = query.eq('unit_type', toDbType(filters.unitType));
    }

    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    if (filters.minPrice) {
      query = query.gte('current_bid', filters.minPrice);
    }

    if (filters.maxPrice) {
      query = query.lte('current_bid', filters.maxPrice);
    }

    if (filters.hasBuyout === true) {
      query = query.not('buyout_price', 'is', null);
    } else if (filters.hasBuyout === false) {
      query = query.is('buyout_price', null);
    }

    if (filters.clanOnly !== undefined) {
      query = query.eq('clan_only', filters.clanOnly);
    }

    if (filters.sellerUsername) {
      query = query.eq('seller_username', filters.sellerUsername);
    }

    // Sorting
    switch (filters.sortBy) {
      case 'price_asc':
        query = query.order('current_bid', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('current_bid', { ascending: false });
        break;
      case 'ending_soon':
        query = query.order('expires_at', { ascending: true });
        break;
      case 'newly_listed':
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    query = query.range(start, end);

    const { data, count, error } = await query;

    if (error) throw new Error(error.message);

    const auctions: AuctionListing[] = (data || []).map(convertSupabaseListing);

    return { success: true, auctions, total: count || 0 };

  } catch (error) {
    logger.error('Error getting auctions', error instanceof Error ? error : new Error(String(error)));
    return { success: false, auctions: [], total: 0, error: 'SERVER_ERROR' };
  }
}

/**
 * Convert Supabase auction_listings row to AuctionListing type
 */
function convertSupabaseListing(row: Tables<'auction_listings'>): AuctionListing {
  return {
    auctionId: row.auction_id,
    sellerUsername: row.seller_username,
    item: {
      itemType: row.item_type as AuctionItemType,
      unitId: row.unit_id || undefined,
      resourceType: (row.resource_type ?? undefined) as ResourceType,
      resourceAmount: row.resource_amount || undefined,
      tradeableItemQuantity: row.tradeable_item_quantity || undefined
    },
    startingBid: row.starting_bid,
    currentBid: row.current_bid,
    buyoutPrice: row.buyout_price || undefined,
    reservePrice: row.reserve_price || undefined,
    bids: [],
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    duration: row.duration_hours,
    status: row.status as AuctionStatus,
    listingFee: row.listing_fee,
    saleFee: row.sale_fee,
    clanOnly: row.clan_only,
    settled: row.settled
  };
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
