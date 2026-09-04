-- Auctions: bridge the pivot table to the AuctionListing domain shape so
-- lib/auctionService (written against the Mongo API) persists correctly.
-- Mapping: "columnar scalar spine + jsonb document tail" — the shim in lib/mongodb.ts
-- (DOC_TABLES) writes the domain doc's filter/sort fields into real columns AND the
-- whole doc into `doc` jsonb; reads rebuild the domain object from `doc` overlaid
-- with typed column values. Columns are plain (not GENERATED): generated columns
-- reject INSERT/UPDATE writes, and the service writes these fields directly.
-- Idempotent. Table was empty pre-deploy (no auction ever persisted — SCOPE #25).
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "doc" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "auction_id" varchar(64);
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "seller_username" varchar(20);
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "highest_bidder" varchar(20);
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "winner_username" varchar(20);
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "starting_bid" integer;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "reserve_price" integer;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "listing_fee" integer;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "clan_only" smallint NOT NULL DEFAULT 0;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "settled" smallint NOT NULL DEFAULT 0;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "final_price" integer;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "duration_hours" integer;
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "closed_at" timestamp;

-- auctionId is the service's lookup key (findOne({ auctionId })). Partial unique:
-- multiple legacy NULLs are allowed, real ids must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS "auctions_auction_id_uniq" ON "auctions" ("auction_id") WHERE "auction_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "auctions_seller_username_idx" ON "auctions" ("seller_username");
CREATE INDEX IF NOT EXISTS "auctions_status_created_idx" ON "auctions" ("status", "created_at" DESC);

-- Legacy pivot columns were NOT NULL but the domain writer (auctionService via the shim)
-- never supplies them; no reader consumes them. Table is empty — relax safely.
ALTER TABLE "auctions" ALTER COLUMN "seller_id" DROP NOT NULL;
ALTER TABLE "auctions" ALTER COLUMN "item_data" DROP NOT NULL;
ALTER TABLE "auctions" ALTER COLUMN "starting_price" DROP NOT NULL;
ALTER TABLE "auctions" ALTER COLUMN "expires_at" DROP NOT NULL;
ALTER TABLE "auctions" ALTER COLUMN "created_at" DROP NOT NULL;

-- Trade history: real table for the TradeHistory domain shape written at buyout
-- (fields map 1:1 to columns; no doc tail needed).
CREATE TABLE IF NOT EXISTS "trade_history" (
  "id" varchar(24) PRIMARY KEY,
  "trade_id" varchar(40) NOT NULL,
  "auction_id" varchar(64) NOT NULL,
  "seller_username" varchar(20) NOT NULL,
  "buyer_username" varchar(20) NOT NULL,
  "item" jsonb NOT NULL,
  "final_price" integer NOT NULL,
  "sale_fee" integer NOT NULL,
  "seller_received" integer NOT NULL,
  "trade_type" varchar(10) NOT NULL DEFAULT 'buyout',
  "completed_at" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "trade_history_trade_id_idx" ON "trade_history" ("trade_id");
CREATE INDEX IF NOT EXISTS "trade_history_auction_id_idx" ON "trade_history" ("auction_id");
CREATE INDEX IF NOT EXISTS "trade_history_seller_idx" ON "trade_history" ("seller_username");
CREATE INDEX IF NOT EXISTS "trade_history_buyer_idx" ON "trade_history" ("buyer_username");
