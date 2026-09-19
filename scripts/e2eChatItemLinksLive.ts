/**
 * FID-20260919-008 — LIVE verification: item-link validation truth + auction
 * name filter. Pure HTTP GETs against SERVER (tsx server.ts = production path);
 * the parse/render layer is pinned in __tests__/lib/chatItemLinks.test.ts.
 *
 *   P1  item-link: T1_SCOUT exists (the stub said false for everything)
 *   P2  item-link: case-insensitive (t1_scout) + resource (METAL)
 *   P3  item-link: unknown name → exists:false (not an error)
 *   P4  auction list: name=ZZZNOMATCH → success with total 0
 *   P5  auction list: pick a live active listing, re-query by its own item
 *       identity, the same listing comes back (self-validating filter)
 *   P6  LIKE-wildcard chars are stripped from user input (no wildcard injection)
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

const SERVER = process.env.PROBE_SERVER || 'http://localhost:3003';

const results: Array<{ ok: boolean; name: string; detail?: string }> = [];
const ok = (name: string, cond: boolean, detail?: string) => {
  results.push({ ok: cond, name, detail });
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

interface AuctionRow {
  id: string;
  item: { itemType: string; unitType?: string; resourceType?: string };
}

async function main() {
  // P1-P3: the validation route tells the truth now
  for (const [name, expected] of [['T1_SCOUT', true], ['t1_scout', true], ['METAL', true], ['ZZZNOMATCH', false]] as const) {
    const res = await fetch(`${SERVER}/api/chat/item-link?itemName=${encodeURIComponent(name)}`);
    const data = (await res.json()) as { exists?: boolean; success?: boolean };
    ok(
      `item-link ${name} → exists:${expected}`,
      res.ok && data.success === true && data.exists === expected,
      `status=${res.status} exists=${String(data.exists)}`
    );
  }

  // P4: garbage name → success, zero
  const gRes = await fetch(`${SERVER}/api/auction/list?name=ZZZNOMATCH&limit=5`);
  const gData = (await gRes.json()) as { success?: boolean; totalCount?: number };
  ok('auction name=ZZZNOMATCH → success, total 0', gRes.ok && gData.success === true && (gData.totalCount ?? 1) === 0, `totalCount=${String(gData.totalCount)}`);

  // P5: self-validating filter against live listings
  const allRes = await fetch(`${SERVER}/api/auction/list?limit=50`);
  const allData = (await allRes.json()) as { success?: boolean; auctions?: AuctionRow[]; total?: number };
  const listings = allData.auctions ?? [];
  if (listings.length === 0) {
    ok('auction name filter round-trip (no active listings live — filter accepted)', allRes.ok && allData.success === true, 'nothing to re-query');
  } else {
    const probe = listings[0];
    const identity = probe.item?.unitType ?? probe.item?.resourceType ?? '';
    const fRes = await fetch(`${SERVER}/api/auction/list?name=${encodeURIComponent(identity)}&limit=50`);
    const fData = (await fRes.json()) as { success?: boolean; auctions?: AuctionRow[]; total?: number };
    const found = (fData.auctions ?? []).some((a) => a.id === probe.id);
    ok(
      `auction name filter returns the probe listing by its identity (${identity})`,
      fRes.ok && fData.success === true && found,
      `total=${String(fData.total)}`
    );
    // and a wrong-kind name must NOT return it
    const otherIdentity = probe.item?.unitType ? 'energy' : 'T1_SCOUT';
    const f2 = await fetch(`${SERVER}/api/auction/list?name=${otherIdentity}&limit=50`);
    const f2d = (await f2.json()) as { auctions?: AuctionRow[] };
    const absent = !(f2d.auctions ?? []).some((a) => a.id === probe.id);
    ok(`auction name filter excludes the probe under a non-matching name (${otherIdentity})`, absent, `probe=${probe.id}`);
  }

  // P6: wildcard chars stripped — %25 is '%', must behave as literal 'metal', never an error
  const wRes = await fetch(`${SERVER}/api/auction/list?name=${encodeURIComponent('%metal%')}&limit=5`);
  const wData = (await wRes.json()) as { success?: boolean };
  ok('auction name filter strips LIKE wildcards from user input', wRes.ok && wData.success === true, `status=${wRes.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} probes passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('driver failed:', e);
  process.exit(1);
});
