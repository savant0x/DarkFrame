/**
 * @file lib/auctionService.ts
 * @created 2025-01-17
 * @overview Auction House service for P2P trading system
 */

import { db } from './db/connection';
import { players } from './db/schema';
import { auctions, tradeHistory } from './db/schema/config';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { mapRowToPlayer } from './playerService';
import { AUCTION_DOC_COLUMNS, shapeRowAuctions } from './db/auctionDocBridge';
import { withTransactionRetry, type TreasuryTx } from './db/treasuryLock';
import { calculatePlayerUnitStats } from './armyService';
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
import type { Player, PlayerUnit, InventoryItem } from '@/types/game.types';
import { logger } from './logger';
import { notifyAuctionEvent } from './auctionNotification';
import { planTradeableEscrow, buildDeliveryInstances, buildRefundInstances } from './tradeableEscrow';

/** auction/trade rows use varchar(24) ids — 24-char uuid-hex slice (migration 0008 PK convention). */
function generateRowId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 24);
}

/**
 * FID-20261002-005: a typed refusal raised INSIDE a listing transaction. The
 * tx body validates everything (admission, funds, ownership, clan scope)
 * before any write; a refusal thrown mid-tx rolls the whole transaction back
 * — zero financial writes — and the outer catch converts it to the call's
 * result envelope. Non-refusal errors propagate as SERVER_ERROR.
 */
class AuctionRefusal extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuctionRefusal';
  }
}

function refusalResult(error: unknown): { success: false; message: string; error: string } | null {
  if (error instanceof AuctionRefusal) {
    return { success: false, message: error.message, error: error.code };
  }
  return null;
}

/**
 * SELECT … FOR UPDATE the auction row by domain auctionId inside an existing
 * transaction (FID-20261002-005 plan item 3): every admission check, claim
 * transition and money movement below serializes against concurrent bids,
 * buyouts, cancels and settlement ticks. Returns the shaped domain listing.
 */
async function lockAuctionByAuctionId(
  tx: TreasuryTx,
  auctionId: string
): Promise<AuctionListing | null> {
  const rows = await tx
    .select()
    .from(auctions)
    .where(eq(auctions.auctionId, auctionId))
    .limit(1)
    .for('update');
  const row = rows[0];
  return row ? shapeAuction(row as unknown as Record<string, unknown>) : null;
}

/**
 * Lock every participant's player row in deterministic (sorted-username)
 * order inside one transaction — the FID-003 idiom — so bid/buyout/cancel/
 * settlement wallets never deadlock against each other.
 */
async function lockPlayersSorted(
  tx: TreasuryTx,
  usernames: string[]
): Promise<Map<string, Player>> {
  const locked = new Map<string, Player>();
  for (const username of [...new Set(usernames)].sort()) {
    const rows = await tx
      .select()
      .from(players)
      .where(eq(players.username, username))
      .limit(1)
      .for('update');
    const row = rows[0];
    if (row) locked.set(username, mapRowToPlayer(row));
  }
  return locked;
}

/**
 * Row-partial update payload for the auctions doc-bridge table: mirrored
 * columns (AUCTION_DOC_COLUMNS) also jsonb_set into the stored doc; any
 * non-column key merges into the doc wholesale — the shim's DOC_TABLES
 * updateOne behavior in one place (Law 13: same shape rule, one truth).
 */
function auctionSet(patch: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const docOps: Array<{ path: string; value: unknown }> = [];
  const docMerge: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const mirrored = AUCTION_DOC_COLUMNS.find((m) => m.column === key);
    if (mirrored) {
      if (typeof value === 'boolean') {
        payload[key] = value ? 1 : 0; // pg smallint mirrors
        docOps.push({ path: mirrored.docKey, value }); // doc keeps the boolean
      } else {
        payload[key] = value;
        docOps.push({ path: mirrored.docKey, value });
      }
    } else {
      docMerge[key] = value;
    }
  }
  let docExpr = sql`${auctions.doc}`;
  for (const { path, value } of docOps) {
    docExpr = sql`jsonb_set(${docExpr}, '{${sql.raw(path)}}', ${JSON.stringify(value ?? null)}::jsonb, true)`;
  }
  if (Object.keys(docMerge).length > 0) {
    docExpr = sql`${docExpr} || ${JSON.stringify(docMerge)}::jsonb`;
  }
  payload.doc = docExpr;
  return payload;
}

/** Row → domain overlay through the shared doc-bridge. */
function shapeAuction(row: Record<string, unknown>): AuctionListing {
  return shapeRowAuctions(auctions, row) as unknown as AuctionListing;
}

/** Lookup by the domain auctionId (indexed mirror column). */
async function getAuctionByAuctionId(auctionId: string): Promise<AuctionListing | null> {
  const [row] = await db.select().from(auctions).where(eq(auctions.auctionId, auctionId)).limit(1);
  return row ? shapeAuction(row as unknown as Record<string, unknown>) : null;
}

/** Human-readable item label for notifications. */
function describeAuctionItem(item: AuctionItem): string {
  if (item.itemType === AuctionItemType.Resource) {
    return `${(item.resourceAmount ?? 0).toLocaleString()} ${item.resourceType ?? 'resource'}`;
  }
  if (item.itemType === AuctionItemType.Unit) {
    return `${item.unitType ?? 'unit'} (${item.unitId ?? 'unknown'})`;
  }
  // FID-20260919-009: the escrow snapshot carries the real (procedural) names.
  const snap = item.tradeableSnapshot ?? [];
  const qty = item.tradeableItemQuantity ?? snap.length ?? 1;
  if (snap.length > 0) {
    const names = [...new Set(snap.map((e) => e.name))];
    const label = names.length === 1 ? names[0] : `${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`;
    return `${qty}× ${label}`;
  }
  return `${qty}× tradeable item${qty > 1 ? 's' : ''}`;
}

/**
 * ONE transaction: seller row lock → active-listing ceiling → fee funds →
 * authoritative clan membership freeze → whole-instance escrow plan → listing
 * insert → listing fee + escrow + army-totals recompute. Any refusal inside
 * the transaction throws (AuctionRefusal) and rolls EVERYTHING back — the old
 * two-autocommit shape (insert, then fee+escrow) could strand an insert
 * without its wallet write or vice versa.
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
    // Pure request-shape validations BEFORE any database work (zero writes on
    // refusal; the same bounds the schema layer pins).
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

    // Calculate listing fee
    const listingFee = request.duration === 12
      ? AUCTION_CONFIG.LISTING_FEE_12H
      : request.duration === 24
        ? AUCTION_CONFIG.LISTING_FEE_24H
        : AUCTION_CONFIG.LISTING_FEE_48H;

    const auction = await withTransactionRetry('auction:create', () =>
      db.transaction(async (tx): Promise<AuctionListing> => {
        // Lock the seller row FIRST — the active-listing ceiling, the fee
        // funds, the escrow plan and the frozen clan membership all read the
        // locked truth (no check-then-write gap).
        const sellerRows = await tx
          .select()
          .from(players)
          .where(eq(players.username, sellerUsername))
          .limit(1)
          .for('update');
        const seller = sellerRows[0] ? mapRowToPlayer(sellerRows[0]) : null;
        if (!seller) throw new AuctionRefusal('SELLER_NOT_FOUND', 'Seller not found');

        // Active listings limit
        const [activeRow] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(auctions)
          .where(and(eq(auctions.sellerUsername, sellerUsername), eq(auctions.status, AuctionStatus.Active)));
        if ((activeRow?.count ?? 0) >= AUCTION_CONFIG.MAX_ACTIVE_LISTINGS) {
          throw new AuctionRefusal(
            'MAX_LISTINGS_REACHED',
            `Maximum ${AUCTION_CONFIG.MAX_ACTIVE_LISTINGS} active listings reached`
          );
        }

        // Listing fee must be covered BEFORE any escrow plan runs.
        if (seller.resources.metal < listingFee) {
          throw new AuctionRefusal(
            'INSUFFICIENT_FUNDS',
            `Insufficient metal for listing fee (${listingFee} required)`
          );
        }

        // FID-20261002-005 item 4 (R17): clan-only listings freeze the seller's
        // AUTHORITATIVE membership (players.clanId) at creation; an unclanned
        // seller is refused outright — no outsider may hold the 0%-fee path.
        if (request.clanOnly && !seller.clanId) {
          throw new AuctionRefusal('CLAN_REQUIRED', 'Join a clan before creating a clan-only listing');
        }

        // Validate item ownership and plan the whole-instance escrow.
        const itemValidation = validateAndPlanItem(seller, request.item);
        if (!itemValidation.success || !itemValidation.plan) {
          throw new AuctionRefusal(itemValidation.error ?? 'INVALID_ITEM', itemValidation.message);
        }
        const plan = itemValidation.plan;

        // Sale fee persists on the listing: the 0% clan rate exists only on
        // rows that passed the clan admission above.
        const saleFee = request.clanOnly ? AUCTION_CONFIG.CLAN_SALE_FEE : AUCTION_CONFIG.PUBLIC_SALE_FEE;

        const auctionId = `AUC-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + request.duration * 60 * 60 * 1000);

        const listing: AuctionListing = {
          auctionId,
          sellerUsername,
          // FID-20261002-005: the frozen clan id — bid/buyout/read eligibility
          // compares THIS value in-lock; later clan changes cannot widen it.
          ...(request.clanOnly && seller.clanId ? { sellerClan: seller.clanId } : {}),
          item: plan.item,
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

        // Insert auction (doc-bridge: the bridge synthesizes the stored doc and
        // fills the mirrored columns + legacy NOT NULL columns from the payload).
        const insertPayload: Record<string, unknown> = { ...listing, id: generateRowId() };
        const { syncAuctionDocFields } = await import('./db/auctionDocBridge');
        syncAuctionDocFields(auctions as never, insertPayload);
        await tx.insert(auctions).values(insertPayload as never);

        // ONE wallet write carries the listing fee, the escrow removal and the
        // recounted army totals (the shared reducer — escrowed units are NOT
        // deployed power, FID-20261002-005 item 7).
        const totals = calculatePlayerUnitStats(plan.unitsAfter ?? seller.units);
        const metalDelta = -listingFee + (plan.incMetal ?? 0);
        const energyDelta = plan.incEnergy ?? 0;
        const walletWrite: PgUpdateSetSource<typeof players> = {
          totalStrength: totals.totalSTR,
          totalDefense: totals.totalDEF,
        };
        if (plan.unitsAfter) walletWrite.units = plan.unitsAfter;
        if (plan.inventoryAfter) walletWrite.inventoryItems = plan.inventoryAfter;
        if (metalDelta !== 0) walletWrite.resourcesMetal = sql`${players.resourcesMetal} + ${metalDelta}`;
        if (energyDelta !== 0) walletWrite.resourcesEnergy = sql`${players.resourcesEnergy} + ${energyDelta}`;
        await tx.update(players).set(walletWrite).where(eq(players.username, sellerUsername));

        return listing;
      })
    );

    logger.info('Auction created', { auctionId: auction.auctionId, seller: sellerUsername, item: request.item });

    return {
      success: true,
      message: `Auction created! Listing fee: ${listingFee} metal`,
      auction
    };
  } catch (error) {
    const refused = refusalResult(error);
    if (refused) return refused;
    logger.error('Error creating auction', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to create auction',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Validate item ownership and plan the whole-instance escrow (FID-20261002-005
 * plan item 1). Pure over the LOCKED seller snapshot — every returned write is
 * applied inside the caller's transaction. The unit branch selects the EXACT
 * owned instance by id (`unitInstanceId`), escrows the whole stack and removes
 * it from the army exactly once; the blueprint `unitId` stays catalog identity.
 */
function validateAndPlanItem(
  player: Player,
  item: AuctionItem
): {
  success: boolean;
  message: string;
  error?: string;
  plan?: {
    /** The stored item (escrow snapshot merged in). */
    item: AuctionItem;
    /** Seller army after escrow (written as `units` when the item is a unit). */
    unitsAfter?: PlayerUnit[];
    /** Seller inventory after escrow (written as `inventoryItems`). */
    inventoryAfter?: InventoryItem[];
    /** Relative resource escrow (resource listings). */
    incMetal?: number;
    incEnergy?: number;
  };
} {
  if (item.itemType === AuctionItemType.Unit) {
    // The instance id identifies the EXACT owned stack to escrow (FID-005 R16:
    // the old blueprint `unitId` match removed ALL matching entries while
    // escrowing one — three singleton Titans became two lost units).
    if (!item.unitInstanceId) {
      return {
        success: false,
        message: 'Select the exact unit instance to list',
        error: 'UNIT_INSTANCE_REQUIRED'
      };
    }

    const unit = player.units.find((u) => u.id === item.unitInstanceId);
    if (!unit) {
      return {
        success: false,
        message: 'Unit not found (it may have been listed, lost, or your army changed — refresh and retry)',
        error: 'UNIT_NOT_FOUND'
      };
    }

    // Blueprint consistency: a stale catalog id alongside a real instance id
    // is a fabrication attempt, not a listing.
    if (item.unitId && item.unitId !== unit.unitId) {
      return {
        success: false,
        message: 'Unit instance does not match the selected unit type',
        error: 'UNIT_MISMATCH'
      };
    }

    const unitsAfter = player.units.filter((u) => u.id !== item.unitInstanceId);
    return {
      success: true,
      message: 'Unit validated and escrowed',
      plan: {
        item: {
          ...item,
          unitType: unit.unitType,
          unitStrength: unit.strength,
          unitDefense: unit.defense,
          // ESCROW SNAPSHOT: the whole stack leaves the seller's army at
          // listing time; this frozen copy is the source of truth for delivery
          // AND refunds (server-derived — clients cannot inject stats).
          unitSnapshot: unit,
        },
        unitsAfter,
      },
    };
  }

  if (item.itemType === AuctionItemType.Resource) {
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
      plan: {
        item,
        ...(item.resourceType === 'energy' ? { incEnergy: -item.resourceAmount } : { incMetal: -item.resourceAmount }),
      },
    };
  }

  if (item.itemType === AuctionItemType.TradeableItem) {
    // Whole-instance escrow (FID-20260919-009, unchanged contract): the
    // seller's selected instances leave the inventory at listing time.
    const escrowPlan = planTradeableEscrow(player.inventory.items, item);
    if (!escrowPlan.ok) {
      return {
        success: false,
        message: escrowPlan.message ?? 'Tradeable items not found',
        error: escrowPlan.error
      };
    }
    return {
      success: true,
      message: 'Tradeable items validated and escrowed',
      plan: {
        item: {
          ...item,
          tradeableItemQuantity: escrowPlan.escrowed.length,
          tradeableSnapshot: escrowPlan.escrowed.map((it) => ({
            itemId: it.id,
            name: it.name,
            rarity: it.rarity,
            description: it.description,
            // Full-instance fields: delivery/refund rebuild InventoryItems
            // from these entries (FID-20260919-009 probe lessons).
            type: it.type,
            bonusPercent: it.bonusPercent,
            foundAt: it.foundAt,
            foundDate: it.foundDate,
          })),
        },
        inventoryAfter: escrowPlan.remaining,
      },
    };
  }

  return { success: false, message: 'Invalid item type', error: 'INVALID_ITEM_TYPE' };
}


/**
 * Place a bid on an auction (FID-20261002-005 plan item 3).
 *
 * ONE transaction under the auction-row lock: admission (status, expiry,
 * self-bid, clan scope, ambiguous-legacy refusal, funds) → bidder escrow
 * debit → previous-leader release → guarded leader-claim patch. The bidder's
 * and leader's player rows are locked in sorted-username order; ANY refusal
 * throws inside the transaction and rolls everything back — zero financial
 * writes. Outbid notification fires post-commit.
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
    const { outbid, itemName } = await withTransactionRetry('auction:bid', () =>
      db.transaction(async (tx) => {
        // Lock the auction row FIRST — bids serialize against buyout, cancel
        // and settlement ticks, which all take the same lock.
        const auction = await lockAuctionByAuctionId(tx, request.auctionId);
        if (!auction) throw new AuctionRefusal('AUCTION_NOT_FOUND', 'Auction not found');
        if (auction.status !== AuctionStatus.Active) {
          throw new AuctionRefusal('AUCTION_NOT_ACTIVE', 'Auction is not active');
        }
        if (new Date() > auction.expiresAt) {
          throw new AuctionRefusal('AUCTION_EXPIRED', 'Auction has expired');
        }
        if (bidderUsername === auction.sellerUsername) {
          throw new AuctionRefusal('SELF_BID', 'Cannot bid on own auction');
        }

        // Ambiguous legacy records (FID-005 item 6): a unit listing with NO
        // escrow snapshot and NO instance id cannot be honestly delivered —
        // new activity on it is refused, not guessed from a blueprint.
        assertListingDeliverable(auction);

        // Lock bidder + current leader (deterministic order) before any
        // wallet read/write.
        const leader = auction.highestBidder;
        const locked = await lockPlayersSorted(
          tx,
          [bidderUsername, ...(leader ? [leader] : [])]
        );
        const bidder = locked.get(bidderUsername);
        if (!bidder) throw new AuctionRefusal('BIDDER_NOT_FOUND', 'Bidder not found');

        // FID-005 item 4: clan-only bids compare the bidder's CURRENT
        // membership to the FROZEN clan id, in-lock. A clan-only row with no
        // frozen sellerClan is ambiguous — fail closed. Later seller clan
        // changes cannot widen eligibility (the id is frozen, not the name).
        if (auction.clanOnly) {
          if (!auction.sellerClan || bidder.clanId !== auction.sellerClan) {
            throw new AuctionRefusal('CLAN_ONLY', 'This is a clan-only auction');
          }
        }

        // Validate bid amount
        const minBid = auction.currentBid + AUCTION_CONFIG.MIN_BID_INCREMENT;
        if (request.bidAmount < minBid) {
          throw new AuctionRefusal(
            'BID_TOO_LOW',
            `Bid must be at least ${minBid} (current bid + ${AUCTION_CONFIG.MIN_BID_INCREMENT})`
          );
        }

        // Check bidder has enough resources
        if (bidder.resources.metal < request.bidAmount) {
          throw new AuctionRefusal('INSUFFICIENT_FUNDS', 'Insufficient metal for bid');
        }

        // ESCROW: deduct the bid from the bidder immediately (FID-20260912-065).
        await tx
          .update(players)
          .set({ resourcesMetal: sql`${players.resourcesMetal} - ${request.bidAmount}` })
          .where(eq(players.username, bidderUsername));

        // Outbid release: refund the previous leader's escrowed bid exactly
        // once (under the row lock this runs once per outbid event).
        if (leader && leader !== bidderUsername && auction.currentBid > 0) {
          await tx
            .update(players)
            .set({ resourcesMetal: sql`${players.resourcesMetal} + ${auction.currentBid}` })
            .where(eq(players.username, leader));
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

        // Leader claim: the guarded UPDATE remains a defense-in-depth gate —
        // under the row lock it cannot legitimately return 0 rows; if it does,
        // the transaction throws and every write above rolls back.
        const claimRows = await tx
          .update(auctions)
          .set(auctionSet({ currentBid: request.bidAmount, highestBidder: bidderUsername, bids: updatedBids }))
          .where(
            and(
              eq(auctions.auctionId, request.auctionId),
              eq(auctions.status, AuctionStatus.Active)
            )
          )
          .returning({ id: auctions.id });
        if (claimRows.length === 0) {
          throw new AuctionRefusal('AUCTION_NOT_ACTIVE', 'Auction is no longer active');
        }

        return {
          outbid: leader && leader !== bidderUsername && auction.currentBid > 0
            ? { username: leader, amount: request.bidAmount, counterparty: bidderUsername }
            : null,
          itemName: describeAuctionItem(auction.item),
        };
      })
    );

    // Post-commit notification (never inside the tx).
    if (outbid) {
      await notifyAuctionEvent('outbid', outbid.username, {
        auctionId: request.auctionId,
        itemName,
        amount: outbid.amount,
        counterparty: outbid.counterparty,
      });
    }

    const updatedAuction = await getAuctionByAuctionId(request.auctionId);

    logger.info('Bid placed', { auctionId: request.auctionId, bidder: bidderUsername, amount: request.bidAmount });

    return {
      success: true,
      message: `Bid placed successfully! You are the highest bidder at ${request.bidAmount} metal`,
      auction: updatedAuction!
    };
  } catch (error) {
    const refused = refusalResult(error);
    if (refused) return refused;
    logger.error('Error placing bid', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to place bid',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Instant buyout of an auction (FID-20261002-005 plan item 3).
 *
 * ONE transaction under the auction-row lock: admission (buyout price,
 * status, self-purchase, clan scope, funds) → claim-first close → goods
 * delivery → money movement → trade history. Delivery failure THROWS, rolling
 * back the close and every monetary write (no best-effort compensation).
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
    const result = await withTransactionRetry('auction:buyout', () =>
      db.transaction(
        async (
          tx
        ): Promise<{
          auction: AuctionListing;
          buyoutPrice: number;
          sellerReceives: number;
          buyerCharge: number;
          leaderRefund: { username: string; amount: number } | null;
          trade: TradeHistory;
        }> => {
          const auction = await lockAuctionByAuctionId(tx, auctionId);
          if (!auction) throw new AuctionRefusal('AUCTION_NOT_FOUND', 'Auction not found');
          if (!auction.buyoutPrice) {
            throw new AuctionRefusal('NO_BUYOUT', 'This auction has no buyout price');
          }
          if (auction.status !== AuctionStatus.Active) {
            throw new AuctionRefusal('AUCTION_NOT_ACTIVE', 'Auction is not active');
          }
          if (buyerUsername === auction.sellerUsername) {
            throw new AuctionRefusal('SELF_PURCHASE', 'Cannot buy own auction');
          }

          assertListingDeliverable(auction);

          // Lock ALL participants (buyer, seller, current leader) in
          // deterministic order before any wallet moves.
          const leader = auction.highestBidder;
          const leaderAmount = auction.currentBid;
          const locked = await lockPlayersSorted(tx, [
            buyerUsername,
            auction.sellerUsername,
            ...(leader ? [leader] : []),
          ]);
          const buyer = locked.get(buyerUsername);
          if (!buyer) throw new AuctionRefusal('BUYER_NOT_FOUND', 'Buyer not found');
          if (auction.clanOnly) {
            if (!auction.sellerClan || buyer.clanId !== auction.sellerClan) {
              throw new AuctionRefusal('CLAN_ONLY', 'This is a clan-only auction');
            }
          }

          const buyoutPrice = auction.buyoutPrice;

          if (buyer.resources.metal < buyoutPrice) {
            throw new AuctionRefusal('INSUFFICIENT_FUNDS', 'Insufficient metal for buyout');
          }

          // CLAIM-FIRST CLOSE (FID-20260914-003, now rollback-safe): flip
          // status Active→Sold before money or goods move. Under the row lock
          // the claim cannot legitimately lose; a lost claim refuses without
          // any writes.
          const claimRows = await tx
            .update(auctions)
            .set(
              auctionSet({
                status: AuctionStatus.Sold,
                closedAt: new Date(),
                settled: true,
                settledAt: new Date(),
                finalPrice: buyoutPrice,
                winnerUsername: buyerUsername,
              })
            )
            .where(and(eq(auctions.auctionId, auctionId), eq(auctions.status, AuctionStatus.Active)))
            .returning({ id: auctions.id });
          if (claimRows.length === 0) {
            throw new AuctionRefusal('AUCTION_NOT_ACTIVE', 'Auction is not active');
          }

          // Fees (persisted sale fee — clan 0% only on admitted clan rows).
          const saleFeeAmount = Math.floor(buyoutPrice * auction.saleFee);
          const sellerReceives = buyoutPrice - saleFeeAmount;

          // Delivery INSIDE the transaction: a failure throws → the close,
          // the delivery and every monetary write roll back together.
          const transferResult = await transferAuctionItem(
            tx,
            auction.sellerUsername,
            buyerUsername,
            auction.item
          );
          if (!transferResult.success) {
            throw new AuctionRefusal(
              transferResult.error ?? 'TRANSFER_FAILED',
              transferResult.message
            );
          }

          // Leader resolution (FID-20260914-003, now rollback-safe):
          // - Different player → their escrowed bid is refunded.
          // - Leader IS the buyer → their escrow IS the payment; charge only
          //   the remainder.
          let leaderRefund: { username: string; amount: number } | null = null;
          if (leader && leader !== buyerUsername && leaderAmount > 0) {
            await tx
              .update(players)
              .set({ resourcesMetal: sql`${players.resourcesMetal} + ${leaderAmount}` })
              .where(eq(players.username, leader));
            leaderRefund = { username: leader, amount: leaderAmount };
          }
          const buyerCharge =
            leader === buyerUsername ? buyoutPrice - leaderAmount : buyoutPrice;
          if (buyerCharge > 0) {
            await tx
              .update(players)
              .set({ resourcesMetal: sql`${players.resourcesMetal} - ${buyerCharge}` })
              .where(eq(players.username, buyerUsername));
          }

          // Seller receives price minus fee.
          await tx
            .update(players)
            .set({ resourcesMetal: sql`${players.resourcesMetal} + ${sellerReceives}` })
            .where(eq(players.username, auction.sellerUsername));

          // Trade history rides the same transaction.
          const tradeId = `TRD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
          const trade: TradeHistory = {
            tradeId,
            auctionId,
            sellerUsername: auction.sellerUsername,
            buyerUsername,
            item: auction.item,
            finalPrice: buyoutPrice,
            saleFee: saleFeeAmount,
            sellerReceived: sellerReceives,
            tradeType: 'buyout',
            completedAt: new Date()
          };
          await tx.insert(tradeHistory).values({
            id: generateRowId(),
            tradeId,
            auctionId,
            sellerUsername: auction.sellerUsername,
            buyerUsername,
            item: auction.item as unknown as Record<string, unknown>,
            finalPrice: buyoutPrice,
            saleFee: saleFeeAmount,
            sellerReceived: sellerReceives,
            tradeType: 'buyout',
            completedAt: new Date()
          });

          return { auction, buyoutPrice, trade, sellerReceives, buyerCharge, leaderRefund };
        }
      )
    );

    // Post-commit notifications.
    void notifyAuctionEvent('sold_seller', result.auction.sellerUsername, {
      auctionId,
      itemName: describeAuctionItem(result.auction.item),
      amount: result.sellerReceives,
      counterparty: buyerUsername,
    });
    void notifyAuctionEvent('sold_winner', buyerUsername, {
      auctionId,
      itemName: describeAuctionItem(result.auction.item),
      amount: result.buyoutPrice,
      counterparty: result.auction.sellerUsername,
    });

    logger.info('Auction bought out', { auctionId, buyer: buyerUsername, price: result.buyoutPrice });

    return {
      success: true,
      message: `Successfully purchased! Paid ${result.buyoutPrice} metal`,
      trade: result.trade
    };
  } catch (error) {
    const refused = refusalResult(error);
    if (refused) return refused;
    logger.error('Error buying out auction', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to complete buyout',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Transfer auction item from seller to buyer — transaction-aware
 * (FID-20261002-005): every write runs on the caller's `tx` so a delivery
 * failure rolls back the settlement that requested it.
 */
async function transferAuctionItem(
  tx: TreasuryTx,
  fromUsername: string,
  toUsername: string,
  item: AuctionItem
): Promise<{ success: boolean; message: string; error?: string }> {
  if (item.itemType === AuctionItemType.Unit) {
    // Deliver the ESCROWED unit. With escrow the goods left the seller at
    // listing time — delivery is a buyer-side jsonb append of the snapshotted
    // whole stack. Legacy (pre-escrow) listings can still find the unit in
    // the seller's army (admission refuses NEW activity on ambiguous records;
    // already-active legacy bids settle under their admission record).
    let seller: Player | null = null;
    if (!item.unitSnapshot) {
      const rows = await tx.select().from(players).where(eq(players.username, fromUsername)).limit(1);
      seller = rows[0] ? mapRowToPlayer(rows[0]) : null;
    }
    const unit: PlayerUnit | undefined =
      item.unitSnapshot ?? seller?.units.find((u) => u.unitId === item.unitId);

    if (!unit) {
      return { success: false, message: 'Unit not found', error: 'UNIT_NOT_FOUND' };
    }

    if (!item.unitSnapshot && seller) {
      // Legacy unescrowed fallback: remove from the seller's army once.
      const remaining = seller.units.filter((u) => u.unitId !== item.unitId);
      const totals = calculatePlayerUnitStats(remaining);
      await tx
        .update(players)
        .set({ units: remaining, totalStrength: totals.totalSTR, totalDefense: totals.totalDEF })
        .where(eq(players.username, fromUsername));
    }

    // Add to buyer (atomic jsonb append) and recount THEIR army totals —
    // delivered escrow becomes deployed power at the moment of ownership.
    const buyerRows = await tx.select().from(players).where(eq(players.username, toUsername)).limit(1);
    const buyerRow = buyerRows[0] ? mapRowToPlayer(buyerRows[0]) : null;
    const buyerUnits = [...(buyerRow?.units ?? []), unit];
    const buyerTotals = calculatePlayerUnitStats(buyerUnits);
    await tx
      .update(players)
      .set({
        units: buyerUnits,
        totalStrength: buyerTotals.totalSTR,
        totalDefense: buyerTotals.totalDEF,
      })
      .where(eq(players.username, toUsername));

  } else if (item.itemType === AuctionItemType.Resource) {
    // Resources were escrowed from the seller at listing time — credit the buyer.
    const amount = item.resourceAmount ?? 0;
    if (item.resourceType === 'energy') {
      await tx
        .update(players)
        .set({ resourcesEnergy: sql`${players.resourcesEnergy} + ${amount}` })
        .where(eq(players.username, toUsername));
    } else {
      await tx
        .update(players)
        .set({ resourcesMetal: sql`${players.resourcesMetal} + ${amount}` })
        .where(eq(players.username, toUsername));
    }

  } else if (item.itemType === AuctionItemType.TradeableItem) {
    // Deliver the ESCROWED instances to the buyer — fresh instance ids,
    // identities preserved. A missing snapshot is an integrity fault: fail
    // the settlement so it retries rather than eat goods.
    const escrowed = item.tradeableSnapshot;
    if (!escrowed || escrowed.length === 0) {
      return {
        success: false,
        message: 'Tradeable listing has no escrow snapshot',
        error: 'TRADEABLE_SNAPSHOT_MISSING'
      };
    }
    const delivery = buildDeliveryInstances(escrowed as never);
    await tx
      .update(players)
      .set({
        inventoryItems: sql`coalesce(${players.inventoryItems}, '[]'::jsonb) || ${JSON.stringify(delivery)}::jsonb`,
      })
      .where(eq(players.username, toUsername));
  }

  return { success: true, message: 'Item transferred' };
}

/**
 * Refund escrowed goods to a username inside a transaction, and recount their
 * army totals when units return (escrow is not deployed power; the returned
 * stack is). Used by cancel and expired-no-bid settlement.
 */
async function refundEscrowedGoods(
  tx: TreasuryTx,
  username: string,
  item: AuctionItem
): Promise<void> {
  if (item.itemType === AuctionItemType.Resource && (item.resourceAmount ?? 0) > 0) {
    const refundWrite: PgUpdateSetSource<typeof players> = {};
    if (item.resourceType === 'energy') {
      refundWrite.resourcesEnergy = sql`${players.resourcesEnergy} + ${item.resourceAmount ?? 0}`;
    } else {
      refundWrite.resourcesMetal = sql`${players.resourcesMetal} + ${item.resourceAmount ?? 0}`;
    }
    await tx.update(players).set(refundWrite).where(eq(players.username, username));
  }
  if (item.itemType === AuctionItemType.Unit && item.unitSnapshot) {
    const rows = await tx.select().from(players).where(eq(players.username, username)).limit(1);
    const owner = rows[0] ? mapRowToPlayer(rows[0]) : null;
    const units = [...(owner?.units ?? []), item.unitSnapshot];
    const totals = calculatePlayerUnitStats(units);
    await tx
      .update(players)
      .set({ units, totalStrength: totals.totalSTR, totalDefense: totals.totalDEF })
      .where(eq(players.username, username));
  }
  if (item.itemType === AuctionItemType.TradeableItem && (item.tradeableSnapshot?.length ?? 0) > 0) {
    const refundItems = buildRefundInstances(item.tradeableSnapshot as never);
    await tx
      .update(players)
      .set({
        inventoryItems: sql`coalesce(${players.inventoryItems}, '[]'::jsonb) || ${JSON.stringify(refundItems)}::jsonb`,
      })
      .where(eq(players.username, username));
  }
}

/**
 * Cancel an auction (seller only, no bids) — FID-20261002-005 plan item 3.
 * ONE transaction: ownership + state checks under the auction-row lock, claim
 * close, escrow refunds with army recount. Refusal rolls everything back.
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
    const itemName = await withTransactionRetry('auction:cancel', () =>
      db.transaction(async (tx) => {
        const auction = await lockAuctionByAuctionId(tx, auctionId);
        if (!auction) {
          throw new AuctionRefusal('AUCTION_NOT_FOUND', 'Auction not found');
        }
        if (auction.sellerUsername !== sellerUsername) {
          throw new AuctionRefusal('NOT_AUTHORIZED', 'Not authorized');
        }
        if (auction.status !== AuctionStatus.Active) {
          throw new AuctionRefusal('AUCTION_NOT_ACTIVE', 'Auction is not active');
        }
        if (auction.bids.length > 0) {
          throw new AuctionRefusal('HAS_BIDS', 'Cannot cancel auction with existing bids');
        }

        // Claim the close; refunds below run only for the writer that flipped
        // the row (under the lock this is exactly us — the guard remains
        // defense in depth).
        const claimRows = await tx
          .update(auctions)
          .set(
            auctionSet({
              status: AuctionStatus.Cancelled,
              closedAt: new Date(),
              settled: true,
              settledAt: new Date(),
            })
          )
          .where(and(eq(auctions.auctionId, auctionId), eq(auctions.status, AuctionStatus.Active)))
          .returning({ id: auctions.id });
        if (claimRows.length === 0) {
          throw new AuctionRefusal('AUCTION_NOT_ACTIVE', 'Auction is not active');
        }

        // Refund escrowed goods to the seller (listing fee non-refundable).
        await refundEscrowedGoods(tx, sellerUsername, auction.item);
        return describeAuctionItem(auction.item);
      })
    );

    void notifyAuctionEvent('refund_seller', sellerUsername, {
      auctionId,
      itemName,
    });

    logger.info('Auction cancelled', { auctionId, seller: sellerUsername });

    return {
      success: true,
      message: 'Auction cancelled successfully. Listing fee is non-refundable.'
    };
  } catch (error) {
    const refused = refusalResult(error);
    if (refused) return refused;
    logger.error('Error cancelling auction', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      message: 'Failed to cancel auction',
      error: 'SERVER_ERROR'
    };
  }
}

/**
 * Legacy/ambiguity gate (FID-20261002-005 item 6): a unit listing that
 * carries NEITHER an escrow snapshot NOR an instance id cannot be honestly
 * delivered — new bids and buyouts on it are refused instead of guessing a
 * unit from a nonunique blueprint.
 */
function assertListingDeliverable(auction: AuctionListing): void {
  if (auction.item.itemType !== AuctionItemType.Unit) return;
  if (!auction.item.unitSnapshot && !auction.item.unitInstanceId) {
    throw new AuctionRefusal(
      'AMBIGUOUS_LEGACY_LISTING',
      'This legacy listing cannot accept new activity (its escrow record is incomplete)'
    );
  }
}

/**
 * Get active auctions with filters (FID-20261002-005 item 5).
 *
 * Clan-only listings are visible ONLY to viewers whose CURRENT clan matches
 * the listing's frozen `sellerClan` (and to the listing's own seller).
 * Unidentified callers — including direct service calls with no viewer —
 * fail closed: they see public listings only, and never the clan scope of
 * what they cannot see.
 *
 * @param filters - Search and filter options
 * @returns List of auctions
 */
export async function getAuctions(
  filters: AuctionSearchFilters
): Promise<{ success: boolean; auctions: AuctionListing[]; total: number; error?: string }> {
  try {
    // Resolve the viewer's CURRENT membership (authorization rides live
    // membership; the listing's clan scope itself is the frozen id).
    let viewerClanId: string | null = null;
    if (filters.viewerUsername) {
      const [viewerRow] = await db
        .select({ clanId: players.clanId })
        .from(players)
        .where(eq(players.username, filters.viewerUsername))
        .limit(1);
      viewerClanId = viewerRow?.clanId ?? null;
    }

    // Build conditions (auctions schema has direct columns: status, item type, seller)
    const conditions: SQL[] = [eq(auctions.status, AuctionStatus.Active)];

    // Clan-only visibility gate. doc->>'sellerClan' rides the stored doc (no
    // indexed column needed at this table scale). No viewer → public only.
    if (filters.viewerUsername) {
      conditions.push(
        sql`(${auctions.clanOnly} = 0 OR ${auctions.doc}->>'sellerClan' = ${viewerClanId ?? ''} OR ${auctions.sellerUsername} = ${filters.viewerUsername})`
      );
    } else {
      conditions.push(sql`${auctions.clanOnly} = 0`);
    }

    if (filters.itemType) {
      conditions.push(sql`${auctions.doc}->'item'->>'itemType' = ${filters.itemType}`);
    }

    if (filters.unitType) {
      conditions.push(sql`${auctions.doc}->'item'->>'unitType' = ${filters.unitType}`);
    }

    if (filters.resourceType) {
      conditions.push(sql`${auctions.doc}->'item'->>'resourceType' = ${filters.resourceType}`);
    }

    // FID-20260919-008: name search over the listing doc's item identity —
    // itemData carries no flat name column; unitType/resourceType ARE the name.
    if (filters.name) {
      const pattern = `%${filters.name}%`;
      // FID-20260919-009: tradeable instances match by their procedural name
      // in the escrow snapshot (jsonb array element scan).
      conditions.push(
        sql`(${auctions.doc}->'item'->>'unitType' ILIKE ${pattern} OR ${auctions.doc}->'item'->>'resourceType' ILIKE ${pattern} OR EXISTS (SELECT 1 FROM jsonb_array_elements(${auctions.doc}->'item'->'tradeableSnapshot') AS t WHERE t->>'name' ILIKE ${pattern}))`
      );
    }

    if (filters.minPrice) {
      conditions.push(gte(auctions.currentBid, filters.minPrice));
    }

    if (filters.maxPrice) {
      conditions.push(lte(auctions.currentBid, filters.maxPrice));
    }

    if (filters.hasBuyout !== undefined) {
      conditions.push(
        filters.hasBuyout ? isNotNull(auctions.buyoutPrice) : isNull(auctions.buyoutPrice)
      );
    }

    if (filters.clanOnly !== undefined) {
      conditions.push(eq(auctions.clanOnly, filters.clanOnly ? 1 : 0));
    }

    if (filters.sellerUsername) {
      conditions.push(eq(auctions.sellerUsername, filters.sellerUsername));
    }

    // Sorting
    let orderBy: SQL | ReturnType<typeof asc> | ReturnType<typeof desc> = desc(auctions.createdAt);
    switch (filters.sortBy) {
      case 'price_asc':
        orderBy = asc(auctions.currentBid);
        break;
      case 'price_desc':
        orderBy = desc(auctions.currentBid);
        break;
      case 'ending_soon':
        orderBy = asc(auctions.expiresAt);
        break;
      case 'newly_listed':
      default:
        orderBy = desc(auctions.createdAt);
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    const where = and(...conditions);

    // Get total count
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .where(where);
    const total = countRow?.count ?? 0;

    // Get auctions (rows shaped through the shared doc-bridge)
    const rows = await db
      .select()
      .from(auctions)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(skip);
    const shaped = rows.map((row) => shapeAuction(row as unknown as Record<string, unknown>));

    return { success: true, auctions: shaped, total };

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
// - Clan-only auctions have 0% fees (clan scope frozen + enforced)
// - Reserve price is hidden from buyers
// - FID-20261002-005: every money/goods move is one transaction under the
//   auction-row lock; refusals roll back with zero financial writes
// ============================================================
// END OF FILE
// ============================================================

// ============================================================
// FID-20260912-065 — Settlement engine (expired auctions)
// FID-20261002-005 — rewritten transactional: claim, delivery, payouts and
// trade history are ONE transaction per auction; a delivery failure throws
// and rolls the row back to Active (the next tick retries; nothing is
// stranded half-paid).
// ============================================================

/**
 * Settle a single expired auction and return the outcome.
 *
 * Called by the auctionSettlementManager job (every 5 min). An auction is
 * settle-eligible when status is Active AND expiresAt has passed. Outcomes:
 * - With bids  → Sold to highest bidder: the escrowed item is delivered, the
 *   seller credited (finalPrice − sale fee); the winner's bid was escrowed at
 *   placeBid and their admission record stands even if they later left the
 *   clan (ratified policy: existing valid bids retain eligibility).
 * - No bids    → Expired: escrowed goods return to the seller.
 *
 * Guarded by the auction-row lock plus the conditional claim so concurrent
 * job ticks or a job + a live bid/buyout racing the expiry boundary cannot
 * double-settle. Delivery failure throws INSIDE the transaction: the claim,
 * delivery and payouts roll back together — no stranded escrow, no partial
 * refund, and the row stays Active for an honest retry.
 */
async function settleExpiredAuction(
  auctionId: string
): Promise<{ auctionId: string; outcome: 'sold' | 'expired'; error?: string }> {
  try {
    return await withTransactionRetry('auction:settle', () =>
      db.transaction(
        async (
          tx
        ): Promise<{ auctionId: string; outcome: 'sold' | 'expired'; error?: string }> => {
          const auction = await lockAuctionByAuctionId(tx, auctionId);
          // Lost the race (already settled/cancelled, or a bid/buyout flipped
          // status first) — or the row is no longer actually overdue.
          if (!auction || auction.status !== AuctionStatus.Active) {
            return { auctionId, outcome: 'expired', error: 'CLAIM_LOST' };
          }
          if (new Date() <= auction.expiresAt) {
            return { auctionId, outcome: 'expired', error: 'CLAIM_LOST' };
          }

          const hasBids = auction.bids.length > 0 && !!auction.highestBidder;

          if (!hasBids) {
            // Expired unsold: refund escrowed goods (with army recount), mark
            // settled — one commit.
            await refundEscrowedGoods(tx, auction.sellerUsername, auction.item);
            await tx
              .update(auctions)
              .set(
                auctionSet({
                  status: AuctionStatus.Expired,
                  closedAt: new Date(),
                  settled: true,
                  settledAt: new Date(),
                })
              )
              .where(eq(auctions.auctionId, auctionId));
            return { auctionId, outcome: 'expired' };
          }

          // Sold at hammer: deliver goods, credit seller, record trade.
          const winner = auction.highestBidder!;
          const finalPrice = auction.currentBid;
          const saleFeeAmount = Math.floor(finalPrice * auction.saleFee);
          const sellerReceives = finalPrice - saleFeeAmount;

          const transferResult = await transferAuctionItem(
            tx,
            auction.sellerUsername,
            winner,
            auction.item
          );
          if (!transferResult.success) {
            // Delivery failed: throw → the WHOLE transaction rolls back (row
            // stays Active, winner's escrow untouched, goods stay escrowed).
            throw new AuctionRefusal(
              transferResult.error ?? 'TRANSFER_FAILED',
              transferResult.message
            );
          }

          // Winner's metal already left their wallet at bid time — pay seller.
          await tx
            .update(players)
            .set({ resourcesMetal: sql`${players.resourcesMetal} + ${sellerReceives}` })
            .where(eq(players.username, auction.sellerUsername));

          await tx
            .update(auctions)
            .set(
              auctionSet({
                status: AuctionStatus.Sold,
                settled: true,
                settledAt: new Date(),
                closedAt: new Date(),
                finalPrice,
                winnerUsername: winner,
              })
            )
            .where(eq(auctions.auctionId, auctionId));

          const tradeId = `TRD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
          await tx.insert(tradeHistory).values({
            id: generateRowId(),
            tradeId,
            auctionId,
            sellerUsername: auction.sellerUsername,
            buyerUsername: winner,
            item: auction.item as unknown as Record<string, unknown>,
            finalPrice,
            saleFee: saleFeeAmount,
            sellerReceived: sellerReceives,
            tradeType: 'auction',
            completedAt: new Date()
          });

          return { auctionId, outcome: 'sold' };
        }
      )
    );
  } catch (error) {
    if (error instanceof AuctionRefusal && error.code === 'TRANSFER_FAILED') {
      return { auctionId, outcome: 'expired', error: 'TRANSFER_FAILED' };
    }
    throw error;
  }
}

/**
 * Settle every overdue auction. Idempotent and race-safe (row-lock + claim).
 * @returns per-run counters for the jobs-status panel.
 */
export async function settleExpiredAuctions(): Promise<{
  success: boolean;
  checked: number;
  sold: number;
  expired: number;
  errors: number;
  message: string;
}> {
  try {
    const overdue = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.status, AuctionStatus.Active), lt(auctions.expiresAt, new Date())))
      .limit(100);

    let sold = 0;
    let expired = 0;
    let errors = 0;
    for (const row of overdue) {
      const auctionId = (row as unknown as Record<string, unknown>).auctionId;
      if (typeof auctionId !== 'string') continue;
      try {
        const result = await settleExpiredAuction(auctionId);
        if (result.error === 'CLAIM_LOST') continue;
        if (result.outcome === 'sold') {
          sold += 1;
          const shaped = shapeAuction(row as unknown as Record<string, unknown>);
          void notifyAuctionEvent('sold_seller', shaped.sellerUsername, {
            auctionId,
            itemName: describeAuctionItem(shaped.item),
            amount: shaped.currentBid,
            counterparty: shaped.highestBidder ?? '',
          });
          void notifyAuctionEvent('won_settlement', shaped.highestBidder ?? '', {
            auctionId,
            itemName: describeAuctionItem(shaped.item),
            amount: shaped.currentBid,
            counterparty: shaped.sellerUsername,
          });
        } else {
          expired += 1;
          if (result.error === 'TRANSFER_FAILED') {
            errors += 1;
          } else {
            const shaped = shapeAuction(row as unknown as Record<string, unknown>);
            void notifyAuctionEvent('expired_seller', shaped.sellerUsername, {
              auctionId,
              itemName: describeAuctionItem(shaped.item),
            });
          }
        }
      } catch (err) {
        errors += 1;
        logger.error('Settlement failed for auction', err instanceof Error ? err : new Error(String(err)));
      }
    }

    return {
      success: true,
      checked: overdue.length,
      sold,
      expired,
      errors,
      message: `Settled ${overdue.length} overdue auction(s): ${sold} sold, ${expired} expired`
    };
  } catch (error) {
    logger.error('Error running auction settlement', error instanceof Error ? error : new Error(String(error)));
    return {
      success: false,
      checked: 0,
      sold: 0,
      expired: 0,
      errors: 1,
      message: 'Settlement run failed'
    };
  }
}
