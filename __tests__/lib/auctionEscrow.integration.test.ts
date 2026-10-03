// @vitest-environment node
/**
 * @file __tests__/lib/auctionEscrow.integration.test.ts
 * @overview FID-20261002-005 §5 acceptance — the auction escrow + clan
 *           authorization contract on a REAL disposable PostgreSQL. Unit mocks
 *           pin the call shape; they cannot prove row-lock serialization or
 *           rollback atomicity, so the FID's core acceptance criteria run here:
 *
 *  - Whole-instance escrow: listing ONE of three Titan stacks removes exactly
 *    that instance (army totals recounted); the frozen snapshot delivers the
 *    whole stack to the buyer at buyout.
 *  - One-transaction integrity: a refused create/bid/buyout leaves ZERO
 *    committed writes (wallet, army, auctions row).
 *  - Clan authorization fail-closed: outsider bids/buyouts/reads on a
 *    clan-only listing are refused with zero writes; the same-clan member
 *    succeeds; the frozen sellerClan (0% sale fee) is honored.
 *  - Public fee conservation: the 5% sale fee is the ONLY burned metal —
 *    seller receives floor(price × 0.95), buyer pays price, leader escrow is
 *    released exactly once.
 *  - Cancel / expiry refunds return the escrowed goods with recounted totals;
 *    the listing fee is non-refundable.
 *  - Race serialization: concurrent bids (single wallet) and bid-vs-buyout
 *    end in exactly one committed outcome.
 *  - Ambiguous legacy listings (no snapshot, no instance id) refuse new
 *    activity instead of guessing delivery.
 *
 * SAFETY CONTRACT (binding, same as FID-20261002-002/003/004/011):
 *  - Runs ONLY against ECHO_DISPOSABLE_DATABASE_URL or a self-provisioned
 *    embedded cluster (ECHO_AUTO_DISPOSABLE_PG=1). Unset → the suite SKIPS.
 *  - A production-shaped URL is REFUSED with a thrown error — fail-closed.
 *  - The suite seeds its own fixtures and drops its own tables.
 *
 * Run locally:
 *   ECHO_AUTO_DISPOSABLE_PG=1 npx vitest run __tests__/lib/auctionEscrow.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PlayerUnit } from '@/types/game.types';

const EXTERNAL_URL = process.env.ECHO_DISPOSABLE_DATABASE_URL;
const AUTO_PROVISION = process.env.ECHO_AUTO_DISPOSABLE_PG === '1';

/** Fail-closed refusal of any production-shaped target. */
function assertDisposableTarget(url: string): void {
  const productionShaped = /(supabase|pooler|rds\.amazonaws|neon\.tech|render\.com|amazonaws|azure|heroku|elephantsql)/i;
  if (productionShaped.test(url)) {
    throw new Error('Disposable-database URL looks like a PRODUCTION target — refusing.');
  }
}
if (EXTERNAL_URL) assertDisposableTarget(EXTERNAL_URL);

const skipSuite = !EXTERNAL_URL && !AUTO_PROVISION;

function titan(id: string, opts: { strength?: number; quantity?: number } = {}): PlayerUnit {
  return {
    id,
    unitId: 'titan',
    unitType: 'Titan' as never,
    name: 'Titan',
    category: 'STR',
    rarity: 'epic',
    strength: opts.strength ?? 100,
    defense: 50,
    quantity: opts.quantity ?? 3,
    createdAt: new Date('2026-10-01T00:00:00Z'),
  } as PlayerUnit;
}

describe.skipIf(skipSuite)('FID-20261002-005 — auction instance escrow + clan authorization (disposable PostgreSQL)', () => {
  let adminPool: Pool;
  let embedded: { stop: () => Promise<void> } | null = null;

  beforeAll(async () => {
    let url: string;
    if (EXTERNAL_URL) {
      url = EXTERNAL_URL;
    } else {
      rmSync(resolve('dev/tmp/echo-pg-data-005'), { recursive: true, force: true });
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      const instance = new EmbeddedPostgres({
        databaseDir: resolve('dev/tmp/echo-pg-data-005'),
        user: 'postgres',
        password: 'disposable',
        port: 55437,
        persistent: false,
        postgresFlags: [
          '-c', 'ssl=on',
          '-c', `ssl_cert_file=${resolve('dev/tmp/pg-certs/server.crt')}`,
          '-c', `ssl_key_file=${resolve('dev/tmp/pg-certs/server.key')}`,
        ],
      });
      await instance.initialise();
      await instance.start();
      embedded = instance;
      url = 'postgresql://postgres:disposable@localhost:55437/postgres';
    }
    assertDisposableTarget(url);
    adminPool = new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: false } });
    // Point the app's lazy pool at the disposable target BEFORE its first query.
    process.env.DATABASE_URL = url;

    await adminPool.query(`
      -- Full players shape: the auction transactions lock whole rows
      -- (select() with no projection), so the fixture carries every column
      -- the drizzle schema declares.
      CREATE TABLE IF NOT EXISTS players (
        username varchar(20) PRIMARY KEY,
        _id varchar(24),
        email varchar(255) NOT NULL DEFAULT 'probe@example.test',
        password varchar(255) NOT NULL DEFAULT 'x',
        base_x integer NOT NULL DEFAULT 0,
        base_y integer NOT NULL DEFAULT 0,
        current_position_x integer NOT NULL DEFAULT 0,
        current_position_y integer NOT NULL DEFAULT 0,
        resources_metal integer NOT NULL DEFAULT 0,
        resources_energy integer NOT NULL DEFAULT 0,
        bank_metal integer NOT NULL DEFAULT 0,
        bank_energy integer NOT NULL DEFAULT 0,
        bank_last_deposit timestamptz,
        rank integer DEFAULT 1,
        inventory_items jsonb NOT NULL DEFAULT '[]',
        inventory_capacity integer NOT NULL DEFAULT 2000,
        inventory_metal_digger_count integer NOT NULL DEFAULT 0,
        inventory_energy_digger_count integer NOT NULL DEFAULT 0,
        gathering_bonus_metal_bonus numeric(5,2) NOT NULL DEFAULT 0,
        gathering_bonus_energy_bonus numeric(5,2) NOT NULL DEFAULT 0,
        active_boosts_gathering_boost numeric(5,2),
        active_boosts_expires_at timestamptz,
        shrine_boosts jsonb NOT NULL DEFAULT '[]',
        units jsonb NOT NULL DEFAULT '[]',
        total_strength integer NOT NULL DEFAULT 0,
        total_defense integer NOT NULL DEFAULT 0,
        balance_effects jsonb,
        xp integer NOT NULL DEFAULT 0,
        level integer NOT NULL DEFAULT 10,
        research_points integer NOT NULL DEFAULT 0,
        unlocked_tiers jsonb NOT NULL DEFAULT '[]',
        unlocked_techs jsonb,
        concentration_zones jsonb,
        last_bot_summon timestamptz,
        fast_travel_waypoints jsonb,
        last_fast_travel timestamptz,
        daily_bounties jsonb,
        specialization jsonb,
        discoveries jsonb,
        achievements jsonb,
        stats jsonb,
        factory_count integer DEFAULT 0,
        last_xp_award timestamptz,
        last_level_up timestamptz,
        rp_history jsonb,
        base_greeting varchar(500),
        battle_stats jsonb,
        is_bot smallint DEFAULT 0,
        is_special_base smallint DEFAULT 0,
        bot_config jsonb,
        autofarm_run jsonb,
        clan_id varchar(24),
        clan_name varchar(30),
        clan_role varchar(20),
        clan_level integer,
        is_admin smallint DEFAULT 0,
        vip smallint DEFAULT 0,
        vip_expiration timestamptz,
        vip_tier varchar(20),
        stripe_customer_id varchar(255),
        stripe_subscription_id varchar(255),
        vip_last_updated timestamptz,
        last_login_date timestamptz,
        login_streak integer DEFAULT 0,
        last_streak_reward timestamptz,
        current_hp integer DEFAULT 1000,
        max_hp integer DEFAULT 1000,
        permanent_harvest_bonus smallint NOT NULL DEFAULT 0,
        last_flag_attack timestamptz,
        referral_code varchar(20),
        referral_link varchar(255),
        referred_by varchar(20),
        referred_by_username varchar(20),
        referral_validated smallint,
        referral_validated_at timestamptz,
        total_referrals integer DEFAULT 0,
        pending_referrals integer DEFAULT 0,
        referral_rewards_metal integer,
        referral_rewards_energy integer,
        referral_rewards_rp integer,
        referral_rewards_xp integer,
        referral_rewards_vip_days integer,
        referral_titles jsonb,
        referral_badges jsonb,
        referral_multiplier numeric(3,1) DEFAULT '1.0',
        last_referral_validated timestamptz,
        referral_milestones_reached jsonb,
        signup_ip varchar(45),
        protection_until timestamptz,
        created_at timestamptz DEFAULT NOW(),
        banned smallint DEFAULT 0,
        ban_reason text,
        banned_at timestamptz,
        banned_by varchar(20),
        ban_expires_at timestamptz
      );
      CREATE TABLE IF NOT EXISTS auctions (
        id varchar(24) PRIMARY KEY,
        seller_id varchar(20) NOT NULL,
        item_data jsonb NOT NULL,
        starting_price integer NOT NULL,
        current_bid integer,
        current_bidder varchar(20),
        buyout_price integer,
        expires_at timestamptz NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL,
        doc jsonb NOT NULL DEFAULT '{}'::jsonb,
        auction_id varchar(64),
        seller_username varchar(20),
        highest_bidder varchar(20),
        winner_username varchar(20),
        starting_bid integer,
        reserve_price integer,
        listing_fee integer,
        clan_only smallint NOT NULL DEFAULT 0,
        settled smallint NOT NULL DEFAULT 0,
        final_price integer,
        duration_hours integer,
        closed_at timestamptz
      );
      CREATE UNIQUE INDEX IF NOT EXISTS auctions_auction_id_uniq ON auctions (auction_id) WHERE auction_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS trade_history (
        id varchar(24) PRIMARY KEY,
        trade_id varchar(40) NOT NULL,
        auction_id varchar(64) NOT NULL,
        seller_username varchar(20) NOT NULL,
        buyer_username varchar(20) NOT NULL,
        item jsonb NOT NULL,
        final_price integer NOT NULL,
        sale_fee integer NOT NULL,
        seller_received integer NOT NULL,
        trade_type varchar(10) NOT NULL DEFAULT 'buyout',
        completed_at timestamptz NOT NULL
      );
    `);
  }, 120000);

  afterAll(async () => {
    if (adminPool) {
      await adminPool.query(`DROP TABLE IF EXISTS players, auctions, trade_history CASCADE`);
      await adminPool.end();
    }
    try {
      const { db } = await import('@/lib/db');
      const appPool = (db as unknown as { $client?: Pool }).$client;
      if (appPool) await appPool.end();
    } catch { /* pool may not exist */ }
    if (embedded) await embedded.stop();
  }, 30000);

  async function seedPlayer(
    username: string,
    opts: { metal?: number; units?: PlayerUnit[]; clanId?: string } = {}
  ): Promise<void> {
    const units = opts.units ?? [];
    const strength = units.reduce((s, u) => s + u.strength * u.quantity, 0);
    const defense = units.reduce((s, u) => s + u.defense * u.quantity, 0);
    await adminPool.query(
      `INSERT INTO players (username, resources_metal, units, total_strength, total_defense, clan_id)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       ON CONFLICT (username) DO UPDATE SET resources_metal = $2, units = $3::jsonb,
         total_strength = $4, total_defense = $5, clan_id = $6`,
      [username, opts.metal ?? 0, JSON.stringify(units), strength, defense, opts.clanId ?? null],
    );
  }

  async function playerState(username: string): Promise<{
    metal: number; units: PlayerUnit[]; totalStrength: number; totalDefense: number; clanId: string | null;
  }> {
    const r = await adminPool.query(
      `SELECT resources_metal, units, total_strength, total_defense, clan_id FROM players WHERE username = $1`,
      [username]
    );
    const row = r.rows[0];
    return {
      metal: row?.resources_metal ?? 0,
      units: row?.units ?? [],
      totalStrength: row?.total_strength ?? 0,
      totalDefense: row?.total_defense ?? 0,
      clanId: row?.clan_id ?? null,
    };
  }

  async function auctionRow(auctionId: string): Promise<Record<string, unknown> | null> {
    const r = await adminPool.query(`SELECT * FROM auctions WHERE auction_id = $1`, [auctionId]);
    return r.rows[0] ?? null;
  }

  const LIST_FEE = 100; // LISTING_FEE_12H

  it('whole-instance escrow: one of three Titan stacks is listed, army recounted; buyout delivers the frozen whole stack and conserves metal at the 5% public fee', async () => {
    await seedPlayer('esc_seller', { metal: 10000, units: [titan('T1'), titan('T2'), titan('T3')] });
    await seedPlayer('esc_buyer', { metal: 5000 });

    const { createAuctionListing, buyoutAuction } = await import('@/lib/auctionService');

    const created = await createAuctionListing('esc_seller', {
      item: { itemType: 'unit' as never, unitInstanceId: 'T1', unitId: 'titan' } as never,
      startingBid: 500,
      buyoutPrice: 2000,
      duration: 12,
    });
    expect(created.success).toBe(true);
    const auctionId = created.auction!.auctionId;

    // Exactly the listed instance left the army; totals recounted (900 → 600).
    const afterList = await playerState('esc_seller');
    expect(afterList.units.map((u) => u.id).sort()).toEqual(['T2', 'T3']);
    expect(afterList.totalStrength).toBe(600);
    expect(afterList.metal).toBe(10000 - LIST_FEE); // listing fee only — goods escrowed, not metal

    const bought = await buyoutAuction('esc_buyer', auctionId);
    expect(bought.success).toBe(true);
    // The public envelope exposes the trade record; the 5% public fee rides it.
    expect(bought.trade!.sellerReceived).toBe(1900); // 2000 − floor(5%)
    expect(bought.trade!.saleFee).toBe(100);

    // The FROZEN snapshot (whole stack, qty 3) is the delivered truth.
    const buyer = await playerState('esc_buyer');
    expect(buyer.units).toHaveLength(1);
    expect(buyer.units[0].id).toBe('T1');
    expect(buyer.units[0].quantity).toBe(3);
    expect(buyer.units[0].strength).toBe(100);
    expect(buyer.totalStrength).toBe(300);
    expect(buyer.metal).toBe(5000 - 2000);

    // Conservation: the 5% fee is the only burned metal.
    const seller = await playerState('esc_seller');
    expect(seller.metal).toBe(9900 + 1900);
    const burned = 10000 + 5000 - (seller.metal + buyer.metal);
    expect(burned).toBe(LIST_FEE + (2000 - 1900)); // listing fee + 5% sale fee are the only burns

    const row = await auctionRow(auctionId);
    expect(row!.status).toBe('sold');
    expect(row!.winner_username).toBe('esc_buyer');
    expect(row!.settled).toBe(1);
    const trade = await adminPool.query(`SELECT * FROM trade_history WHERE auction_id = $1`, [auctionId]);
    expect(trade.rows).toHaveLength(1);
    expect(trade.rows[0].seller_received).toBe(1900);
    expect(trade.rows[0].sale_fee).toBe(100);
  });

  it('refused listing leaves ZERO writes (unknown instance id)', async () => {
    await seedPlayer('ref_seller', { metal: 10000, units: [titan('R1')] });

    const { createAuctionListing } = await import('@/lib/auctionService');
    const refused = await createAuctionListing('ref_seller', {
      item: { itemType: 'unit' as never, unitInstanceId: 'GHOST', unitId: 'titan' } as never,
      startingBid: 500,
      duration: 12,
    });
    expect(refused.success).toBe(false);
    expect(refused.error).toBe('UNIT_NOT_FOUND');

    const state = await playerState('ref_seller');
    expect(state.metal).toBe(10000);
    expect(state.units).toHaveLength(1);
    expect(state.totalStrength).toBe(300);
    const count = await adminPool.query(`SELECT count(*)::int AS c FROM auctions WHERE seller_username = 'ref_seller'`);
    expect(count.rows[0].c).toBe(0);
  });

  it('clan-only: outsider bid/buyout fail closed with zero writes; same-clan member succeeds; reads fail closed without membership', async () => {
    await seedPlayer('cln_seller', { metal: 10000, units: [titan('C1')], clanId: 'CLANA' });
    await seedPlayer('cln_kin', { metal: 5000, clanId: 'CLANA' });
    await seedPlayer('cln_out', { metal: 5000 });

    const { createAuctionListing, placeBid, buyoutAuction, getAuctions } = await import('@/lib/auctionService');
    const created = await createAuctionListing('cln_seller', {
      item: { itemType: 'unit' as never, unitInstanceId: 'C1', unitId: 'titan' } as never,
      startingBid: 500,
      buyoutPrice: 1500,
      duration: 12,
      clanOnly: true,
    });
    expect(created.success).toBe(true);
    const auctionId = created.auction!.auctionId;

    // The frozen seller clan rides the stored doc.
    const row = await auctionRow(auctionId);
    expect((row!.doc as Record<string, unknown>).sellerClan).toBe('CLANA');

    // Outsider bid → CLAN_ONLY, zero wallet writes.
    const outBid = await placeBid('cln_out', { auctionId, bidAmount: 600 });
    expect(outBid.success).toBe(false);
    expect(outBid.error).toBe('CLAN_ONLY');
    expect((await playerState('cln_out')).metal).toBe(5000);

    // Outsider buyout → CLAN_ONLY, zero wallet writes, still active.
    const outBuy = await buyoutAuction('cln_out', auctionId);
    expect(outBuy.success).toBe(false);
    expect(outBuy.error).toBe('CLAN_ONLY');
    expect((await playerState('cln_out')).metal).toBe(5000);
    expect((await auctionRow(auctionId))!.status).toBe('active');

    // Reads fail closed: anonymous and non-member viewers see nothing.
    const anon = await getAuctions({ status: 'active' } as never);
    expect(anon.auctions.map((a) => a.auctionId)).not.toContain(auctionId);
    const outsider = await getAuctions({ viewerUsername: 'cln_out', status: 'active' } as never);
    expect(outsider.auctions.map((a) => a.auctionId)).not.toContain(auctionId);
    // The seller (and clan kin) DO see it.
    const seller = await getAuctions({ viewerUsername: 'cln_seller', status: 'active' } as never);
    expect(seller.auctions.map((a) => a.auctionId)).toContain(auctionId);
    const kin = await getAuctions({ viewerUsername: 'cln_kin', status: 'active' } as never);
    expect(kin.auctions.map((a) => a.auctionId)).toContain(auctionId);

    // Same-clan member buyout succeeds at the 0% clan sale fee.
    const kinBuy = await buyoutAuction('cln_kin', auctionId);
    expect(kinBuy.success).toBe(true);
    expect(kinBuy.trade!.sellerReceived).toBe(1500); // 0% clan sale fee
    expect(kinBuy.trade!.saleFee).toBe(0);
    expect((await playerState('cln_kin')).metal).toBe(5000 - 1500);
    expect((await playerState('cln_seller')).metal).toBe(9900 + 1500);
  });

  it('concurrent bids from a single wallet serialize under the row lock: exactly one escrow commits', async () => {
    await seedPlayer('race_seller', { metal: 10000, units: [titan('K1')] });
    await seedPlayer('race_bidder', { metal: 1200 });

    const { createAuctionListing, placeBid } = await import('@/lib/auctionService');
    const created = await createAuctionListing('race_seller', {
      item: { itemType: 'unit' as never, unitInstanceId: 'K1', unitId: 'titan' } as never,
      startingBid: 100,
      duration: 12,
    });
    expect(created.success).toBe(true);
    const auctionId = created.auction!.auctionId;

    // The wallet covers exactly ONE 1200 bid — the loser must not debit.
    const results = await Promise.allSettled([
      placeBid('race_bidder', { auctionId, bidAmount: 1200 }),
      placeBid('race_bidder', { auctionId, bidAmount: 1200 }),
    ]);
    const outcomes = results.map((r) => (r.status === 'fulfilled' ? r.value : { success: false }));
    expect(outcomes.filter((o) => o.success)).toHaveLength(1);

    const bidder = await playerState('race_bidder');
    expect(bidder.metal).toBe(0); // one escrow, not two
    const row = await auctionRow(auctionId);
    expect(row!.highest_bidder).toBe('race_bidder');
    expect(row!.current_bid).toBe(1200);
    const bids = ((row!.doc as Record<string, unknown>).bids as unknown[]) ?? [];
    expect(bids).toHaveLength(1);
  });

  it('bid vs buyout race: exactly one committed outcome, wallet invariants hold', async () => {
    await seedPlayer('bv_seller', { metal: 10000, units: [titan('V1')] });
    await seedPlayer('bv_bidder', { metal: 5000 });
    await seedPlayer('bv_buyer', { metal: 5000 });

    const { createAuctionListing, placeBid, buyoutAuction } = await import('@/lib/auctionService');
    const created = await createAuctionListing('bv_seller', {
      item: { itemType: 'unit' as never, unitInstanceId: 'V1', unitId: 'titan' } as never,
      startingBid: 100,
      buyoutPrice: 2000,
      duration: 12,
    });
    const auctionId = created.auction!.auctionId;

    const [bidRes, buyRes] = await Promise.all([
      placeBid('bv_bidder', { auctionId, bidAmount: 500 }),
      buyoutAuction('bv_buyer', auctionId),
    ]);

    const row = await auctionRow(auctionId);
    if (buyRes.success) {
      // Buyout closed the auction. The bidder either lost the lock race
      // (never escrowed) or bid first and was refunded as leader — either way
      // their wallet ends untouched.
      expect(row!.status).toBe('sold');
      expect(row!.winner_username).toBe('bv_buyer');
      expect((await playerState('bv_buyer')).metal).toBe(3000);
      expect((await playerState('bv_bidder')).metal).toBe(5000); // never escrowed or fully released
    } else {
      // Bid won: the buyout was refused (AUCTION_NOT_ACTIVE or lost claim).
      expect(bidRes.success).toBe(true);
      expect(row!.highest_bidder).toBe('bv_bidder');
      expect((await playerState('bv_bidder')).metal).toBe(4500); // escrow held
      expect((await playerState('bv_buyer')).metal).toBe(5000);  // untouched
      expect(row!.status).toBe('active');
    }
  });

  it('cancel refunds the escrowed unit with recounted army totals; the listing fee stays burned', async () => {
    await seedPlayer('cx_seller', { metal: 10000, units: [titan('X1')] });

    const { createAuctionListing, cancelAuction } = await import('@/lib/auctionService');
    const created = await createAuctionListing('cx_seller', {
      item: { itemType: 'unit' as never, unitInstanceId: 'X1', unitId: 'titan' } as never,
      startingBid: 500,
      duration: 12,
    });
    const auctionId = created.auction!.auctionId;

    const cancelled = await cancelAuction('cx_seller', auctionId);
    expect(cancelled.success).toBe(true);

    const state = await playerState('cx_seller');
    expect(state.units.map((u) => u.id)).toEqual(['X1']);
    expect(state.totalStrength).toBe(300);
    expect(state.totalDefense).toBe(150);
    expect(state.metal).toBe(10000 - LIST_FEE); // fee non-refundable, goods back

    const row = await auctionRow(auctionId);
    expect(row!.status).toBe('cancelled');
    expect(row!.settled).toBe(1);
  });

  it('settlement: expired-no-bids refunds goods; expired-with-bids pays the seller 95% and delivers the winner', async () => {
    await seedPlayer('set_seller', { metal: 10000, units: [titan('S1'), titan('S2')] });
    await seedPlayer('set_winner', { metal: 5000 });

    const { createAuctionListing, placeBid, settleExpiredAuctions } = await import('@/lib/auctionService');

    const noBids = await createAuctionListing('set_seller', {
      item: { itemType: 'unit' as never, unitInstanceId: 'S1', unitId: 'titan' } as never,
      startingBid: 500,
      duration: 12,
    });
    const withBids = await createAuctionListing('set_seller', {
      item: { itemType: 'unit' as never, unitInstanceId: 'S2', unitId: 'titan' } as never,
      startingBid: 500,
      duration: 12,
    });
    const bid = await placeBid('set_winner', { auctionId: withBids.auction!.auctionId, bidAmount: 1000 });
    expect(bid.success).toBe(true);

    // Force both past expiry (the settlement claim re-reads the mirror column).
    await adminPool.query(
      `UPDATE auctions SET expires_at = NOW() - INTERVAL '1 hour' WHERE auction_id IN ($1, $2)`,
      [noBids.auction!.auctionId, withBids.auction!.auctionId]
    );

    const settled = await settleExpiredAuctions();
    expect(settled.sold).toBe(1);
    expect(settled.expired).toBe(1);

    // S1 refunded with recounted totals (S2 gone → 300).
    const seller = await playerState('set_seller');
    expect(seller.units.map((u) => u.id)).toEqual(['S1']);
    expect(seller.totalStrength).toBe(300);
    // 10000 − 200 fees + 950 (hammer price minus 5%).
    expect(seller.metal).toBe(10000 - 2 * LIST_FEE + 950);

    // Winner: escrowed at bid time, delivered S2 at settlement.
    const winner = await playerState('set_winner');
    expect(winner.metal).toBe(5000 - 1000);
    expect(winner.units.map((u) => u.id)).toEqual(['S2']);
    expect(winner.totalStrength).toBe(300);

    const rows = await adminPool.query(
      `SELECT status, final_price FROM auctions WHERE auction_id IN ($1, $2) ORDER BY status`,
      [noBids.auction!.auctionId, withBids.auction!.auctionId]
    );
    const statuses = rows.rows.map((r) => r.status).sort();
    expect(statuses).toEqual(['expired', 'sold']);
  });

  it('ambiguous legacy listing (no snapshot, no instance id) refuses new bids and buyouts', async () => {
    await seedPlayer('leg_seller', { metal: 10000, units: [titan('L1')] });
    await seedPlayer('leg_buyer', { metal: 5000 });

    // Insert a pre-escrow-era row exactly as the old stack wrote it.
    const legacyDoc = {
      auctionId: 'AUC-LEGACY-1',
      sellerUsername: 'leg_seller',
      item: { itemType: 'unit', unitType: 'Titan', unitId: 'titan' },
      startingBid: 500,
      currentBid: 500,
      buyoutPrice: 2000,
      bids: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      duration: 12,
      status: 'active',
      listingFee: 100,
      saleFee: 0.05,
      clanOnly: false,
      settled: false,
    };
    await adminPool.query(
      `INSERT INTO auctions (id, seller_id, item_data, starting_price, current_bid, buyout_price, expires_at, status, created_at,
        doc, auction_id, seller_username, starting_bid, listing_fee)
       VALUES ('legacyrow00000000000001', 'leg_seller', $1::jsonb, 500, 500, 2000, NOW() + INTERVAL '1 hour', 'active', NOW(),
        $2::jsonb, 'AUC-LEGACY-1', 'leg_seller', 500, 100)`,
      [JSON.stringify(legacyDoc.item), JSON.stringify(legacyDoc)]
    );

    const { placeBid, buyoutAuction } = await import('@/lib/auctionService');
    const bid = await placeBid('leg_buyer', { auctionId: 'AUC-LEGACY-1', bidAmount: 600 });
    expect(bid.success).toBe(false);
    expect(bid.error).toBe('AMBIGUOUS_LEGACY_LISTING');
    const buy = await buyoutAuction('leg_buyer', 'AUC-LEGACY-1');
    expect(buy.success).toBe(false);
    expect(buy.error).toBe('AMBIGUOUS_LEGACY_LISTING');

    // Zero writes anywhere.
    expect((await playerState('leg_buyer')).metal).toBe(5000);
    expect((await playerState('leg_seller')).metal).toBe(10000);
    expect((await auctionRow('AUC-LEGACY-1'))!.status).toBe('active');
    expect(((await auctionRow('AUC-LEGACY-1'))!.doc as Record<string, unknown>).bids).toEqual([]);
  });
});
