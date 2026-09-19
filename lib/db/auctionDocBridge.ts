/**
 * Auction doc-bridge (shared truth).
 *
 * Extracted verbatim from the Mongo shim (lib/mongodb.ts) so BOTH the shim and
 * pg-native routes (auction/my-bids) use the identical row⇄domain mapping —
 * one function, one truth (Law 13). The `auctions` table mirrors scalar fields
 * of the AuctionListing document (migration 0008) so SQL indexes stay usable,
 * while the full doc lives in `doc` jsonb.
 *
 * Writes (syncAuctionDocFields): on any auction row payload, store the doc and
 * fill the mirrored columns the doc carries (never overwriting explicit flat
 * keys). Reads (shapeRowAuctions): rebuild the domain doc by overlaying
 * non-null columns onto `doc` (column values win — they are the indexed truth).
 */
import { getTableName, getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

/** Doc fields mirrored onto indexed auctions columns. */
export const AUCTION_DOC_COLUMNS: Array<{ docKey: string; column: string }> = [
  { docKey: 'auctionId', column: 'auctionId' },
  { docKey: 'sellerUsername', column: 'sellerUsername' },
  { docKey: 'startingBid', column: 'startingBid' },
  { docKey: 'currentBid', column: 'currentBid' },
  { docKey: 'buyoutPrice', column: 'buyoutPrice' },
  { docKey: 'reservePrice', column: 'reservePrice' },
  { docKey: 'listingFee', column: 'listingFee' },
  { docKey: 'clanOnly', column: 'clanOnly' },
  { docKey: 'settled', column: 'settled' },
  { docKey: 'finalPrice', column: 'finalPrice' },
  { docKey: 'winnerUsername', column: 'winnerUsername' },
  { docKey: 'highestBidder', column: 'highestBidder' },
  { docKey: 'status', column: 'status' },
  { docKey: 'createdAt', column: 'createdAt' },
  { docKey: 'expiresAt', column: 'expiresAt' },
  { docKey: 'closedAt', column: 'closedAt' },
  { docKey: 'duration', column: 'durationHours' },
];

export function isAuctionsTable(table: PgTable): boolean {
  return getTableName(table) === 'auctions';
}

export function syncAuctionDocFields(table: PgTable, payload: Record<string, unknown>): void {
  if (!isAuctionsTable(table)) return;
  const columns = getTableColumns(table);
  // (i) Synthesize the stored document when the caller passes the AuctionListing domain
  // doc directly (createAuctionListing's insertOne) — there is no explicit `doc` key,
  // every top-level payload key IS a document field.
  if (columns.doc && (payload.doc === undefined || payload.doc === null)) {
    const synthesized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k === 'id' || k === '_id') continue;
      synthesized[k] = v;
    }
    payload.doc = synthesized;
  }
  const docValue = payload.doc;
  if (docValue === undefined || docValue === null || typeof docValue !== 'object' || Array.isArray(docValue)) return;
  const doc = docValue as Record<string, unknown>;
  // (ii) Legacy NOT NULL mirrors from the pre-#25 columns the domain service never
  // writes (seller_id/item_data/starting_price) — without these every insert 500s.
  if (payload.itemData === undefined) {
    const item = doc.item !== undefined ? doc.item : payload.item;
    if (item !== undefined) payload.itemData = item;
  }
  if (payload.sellerId === undefined) {
    const seller = doc.sellerUsername !== undefined ? doc.sellerUsername : payload.sellerUsername;
    if (seller !== undefined) payload.sellerId = seller;
  }
  if (payload.startingPrice === undefined) {
    const start = doc.startingBid !== undefined ? doc.startingBid : payload.startingBid;
    if (start !== undefined) payload.startingPrice = start;
  }
  // (iii) Mirror doc fields the indexed columns exist for.
  for (const { docKey, column } of AUCTION_DOC_COLUMNS) {
    if (doc[docKey] === undefined) continue;
    if (payload[column] !== undefined) continue; // explicit flat key wins
    const value = doc[docKey];
    if (value instanceof Date) {
      payload[column] = value;
    } else if (typeof value === 'boolean') {
      payload[column] = value ? 1 : 0; // pg smallint mirrors
    } else if (docKey === 'duration' && typeof value === 'number') {
      payload[column] = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      payload[column] = value;
    }
    // nested/other shapes stay doc-only
  }
}

export function shapeRowAuctions(table: PgTable, row: Record<string, unknown>): Record<string, unknown> {
  if (!isAuctionsTable(table)) return row;
  const doc = (row.doc && typeof row.doc === 'object' && !Array.isArray(row.doc) ? { ...(row.doc as Record<string, unknown>) } : {});
  for (const { docKey, column } of AUCTION_DOC_COLUMNS) {
    const colValue = row[column];
    if (colValue === undefined || colValue === null) continue;
    // column is the indexed truth — overlay onto the doc
    if (docKey === 'clanOnly' || docKey === 'settled') {
      doc[docKey] = colValue === 1;
    } else if (docKey === 'duration') {
      doc.duration = colValue;
    } else {
      doc[docKey] = colValue;
    }
  }
  // Legacy read-back: the domain `item` lives only in the pre-#25 item_data column
  // when the doc copy predates the bridge.
  if (doc.item === undefined && row.itemData !== undefined && row.itemData !== null) {
    doc.item = row.itemData;
  }
  return { ...row, ...doc, doc };
}
