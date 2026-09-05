-- Migration 0009b: auctions doc-bridge parity + trade_history (FID-20260904-005 §5.2e / SCOPE #25).
--
-- WHY THIS EXISTS: migration 0008_auction_domain.sql was edited after it had already been
-- applied to the live database, so the DB holds the pre-edit auctions shape (plain columns
-- only, no `doc` jsonb, no domain columns) and trade_history was never created. Migrations
-- do not re-run by name, so the schema/DB divergence persisted until the auction doc-bridge
-- failed live (my-bids: column "doc" does not exist). LESSON RECORDED IN FID §7: migrations
-- are immutable once applied — corrections go in a NEW file.
--
-- auctions is empty (live count 0 — verified 2026-09-04), so REBUILD is lossless.

DROP TABLE IF EXISTS auctions;

CREATE TABLE auctions (
  id               varchar(24) PRIMARY KEY,
  seller_id        varchar(20) NOT NULL,
  item_data        jsonb NOT NULL,
  starting_price   integer NOT NULL,
  current_bid      integer,
  current_bidder   varchar(20),
  buyout_price     integer,
  expires_at       timestamp NOT NULL,
  status           varchar(20) NOT NULL DEFAULT 'active',
  created_at       timestamp NOT NULL,
  -- Domain bridge: full AuctionListing document; plain columns mirror filtered/sorted fields.
  doc              jsonb NOT NULL DEFAULT '{}'::jsonb,
  auction_id       varchar(64),
  seller_username  varchar(20),
  highest_bidder   varchar(20),
  winner_username  varchar(20),
  starting_bid     integer,
  reserve_price    integer,
  listing_fee      integer,
  clan_only        smallint NOT NULL DEFAULT 0,
  settled          smallint NOT NULL DEFAULT 0,
  final_price      integer,
  duration_hours   integer,
  closed_at        timestamp
);

CREATE UNIQUE INDEX auctions_auction_id_uniq ON auctions (auction_id) WHERE auction_id IS NOT NULL;
CREATE INDEX auctions_seller_username_idx ON auctions (seller_username);
CREATE INDEX auctions_status_created_idx ON auctions (status, created_at);

CREATE TABLE IF NOT EXISTS trade_history (
  id            varchar(24) PRIMARY KEY,
  trade_id      varchar(40) NOT NULL,
  auction_id    varchar(64) NOT NULL,
  seller_username varchar(20) NOT NULL,
  buyer_username  varchar(20) NOT NULL,
  item          jsonb NOT NULL,
  final_price   integer NOT NULL,
  sale_fee      integer NOT NULL,
  seller_received integer NOT NULL,
  trade_type    varchar(10) NOT NULL DEFAULT 'buyout',
  completed_at  timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS trade_history_auction_id_idx ON trade_history (auction_id);
CREATE INDEX IF NOT EXISTS trade_history_buyer_idx ON trade_history (buyer_username);
