/**
 * FID-20260917-012 - LIVE verification of the chat honesty flow. Invokes the
 * REAL route handlers (same code the server runs) with real minted JWT cookies
 * against the real dev DB - the e2eClanDetail pattern. Server-independent:
 * shares no fate with the parallel session's dev process.
 *
 * Scenario (three real sessions):
 *   A = fame      (blocker / reporter)
 *   B = <player>  (sender who gets reported and blocked)
 *   C = <player>  (bystander - must STILL see B's rows after the block)
 *
 * Probes:
 *   1. SEND      - B posts a real global message via POST handler.
 *   2. BASELINE  - A's GET contains it.
 *   3. REPORT    - 201 + pg row (reporter/reported/status=open); self-report refused.
 *   4. BLOCK     - 200; pg row; idempotent re-block keeps exactly ONE row.
 *   5. ENFORCED  - A's GET no longer contains B's message (server-side filter).
 *   6. OTHERS    - C's GET still contains it (global means global).
 *   7. UNBLOCK   - DELETE 200; A sees B again.
 *
 * Cleanup: exactly the probe's artifacts (message by exact marker, report row
 * by message id, block pair). One-shot; exits explicitly.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { SignJWT } from 'jose';
import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { db } from '../lib/db';
import { players } from '../lib/db/schema';
import { chatMessages } from '../lib/db/schema/chat';
import { chatReports, blockedUsers } from '../lib/db/schema/moderation';
import { JOSE_SECRET } from '../lib/jwt';

import { GET as chatGET, POST as chatPOST } from '../app/api/chat/route';
import { POST as reportPOST } from '../app/api/chat/report/route';
import { POST as blockPOST, DELETE as blockDELETE } from '../app/api/chat/block/route';

const A = 'fame';
const STAMP = Date.now().toString(36);
const MARKER = `FID012-probe ${STAMP}`;

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log(`  PASS  ${msg}`);
  else { failures += 1; console.error(`  FAIL  ${msg}`); }
}

async function cookieFor(username: string): Promise<string> {
  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JOSE_SECRET);
  return `darkframe_session=${token}`;
}

function req(url: string, init?: { method?: string; cookie?: string; body?: unknown }): NextRequest {
  return new NextRequest(`http://probe.local${url}`, {
    method: init?.method ?? 'GET',
    ...(init?.cookie ? { headers: { cookie: init.cookie, ...(init.body ? { 'content-type': 'application/json' } : {}) } } : {}),
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  }) as NextRequest;
}

async function json(res: Response): Promise<any> {
  try { return await res.json(); } catch { return null; }
}

async function main(): Promise<void> {
  const rows = await db.select({ username: players.username }).from(players).limit(80);
  const others = rows.map((r) => r.username).filter((u) => u && u !== A);
  if (others.length < 2) throw new Error('need two extra players');
  const [B, C] = others;
  console.log(`actors: blocker=${A} sender=${B} bystander=${C}`);

  const cookieA = await cookieFor(A);
  const cookieB = await cookieFor(B);
  const cookieC = await cookieFor(C);
  let probeMessageId: string | null = null;

  try {
    // ---- 1. SEND (B posts through the real POST handler)
    const sent = await json(await chatPOST(req('/api/chat', { method: 'POST', cookie: cookieB, body: { channelId: 'global', message: MARKER } })));
    assert(sent?.success === true, `B posts to global chat (${JSON.stringify(sent)?.slice(0, 80)})`);

    // ---- 2. BASELINE (A sees it)
    const before = await json(await chatGET(req('/api/chat?channelId=global&limit=100', { cookie: cookieA })));
    const baselineMsg = (before?.messages ?? []).find((m: any) => m.message === MARKER);
    assert(!!baselineMsg, 'A sees the message before the block');
    assert(baselineMsg?.senderId === B, `message senderId is B (${baselineMsg?.senderId})`);
    probeMessageId = baselineMsg?.id ?? null;

    // ---- 3. REPORT
    const rep = await json(await reportPOST(req('/api/chat/report', { method: 'POST', cookie: cookieA, body: { messageId: probeMessageId, channelId: 'global', reportedUserId: B, reason: 'spam' } })));
    assert(rep?.success === true, `report accepted (repId=${rep?.reportId})`);
    const repRow = (await db.select().from(chatReports).where(eq(chatReports.messageId, probeMessageId!)))[0];
    assert(!!repRow, 'chat_reports row persisted');
    assert(repRow?.reporterId === A && repRow?.reportedUserId === B && repRow?.status === 'open',
      `report row: reporter=${repRow?.reporterId} reported=${repRow?.reportedUserId} status=${repRow?.status}`);
    const selfRep = await json(await reportPOST(req('/api/chat/report', { method: 'POST', cookie: cookieB, body: { messageId: probeMessageId, channelId: 'global', reportedUserId: B, reason: 'spam' } })));
    assert(selfRep === null || selfRep?.success !== true, 'self-report refused');

    // ---- 4. BLOCK (idempotent)
    const blk1 = await json(await blockPOST(req('/api/chat/block', { method: 'POST', cookie: cookieA, body: { userId: B } })));
    assert(blk1?.success === true, `block POST success (${blk1?.message ?? JSON.stringify(blk1)})`);
    const blk2 = await json(await blockPOST(req('/api/chat/block', { method: 'POST', cookie: cookieA, body: { userId: B } })));
    assert(blk2?.success === true, 're-block stays success (idempotent, onConflictDoNothing)');
    const blockRows = await db.select().from(blockedUsers).where(and(eq(blockedUsers.blockerId, A), eq(blockedUsers.blockedId, B)));
    assert(blockRows.length === 1, `exactly one blocked_users row (got ${blockRows.length})`);

    // ---- 5. ENFORCED for the blocker
    const after = await json(await chatGET(req('/api/chat?channelId=global&limit=100', { cookie: cookieA })));
    const hidden = !(after?.messages ?? []).some((m: any) => m.message === MARKER);
    assert(hidden, 'B\u2019s message GONE from the blocker\u2019s GET (server-side filter)');

    // ---- 6. OTHERS still see it (global means global)
    const bystander = await json(await chatGET(req('/api/chat?channelId=global&limit=100', { cookie: cookieC })));
    const visible = (bystander?.messages ?? []).some((m: any) => m.message === MARKER);
    assert(visible, 'bystander C still sees B\u2019s message');

    // ---- 7. UNBLOCK restores visibility
    const unblk = await json(await blockDELETE(req('/api/chat/block', { method: 'DELETE', cookie: cookieA, body: { userId: B } })));
    assert(unblk?.success === true, `unblock DELETE success (${unblk?.message ?? ''})`);
    const restored = await json(await chatGET(req('/api/chat?channelId=global&limit=100', { cookie: cookieA })));
    const back = (restored?.messages ?? []).some((m: any) => m.message === MARKER);
    assert(back, 'after unblock, A sees B\u2019s message again');
  } finally {
    // ---- Cleanup: EXACTLY the probe's artifacts (never blanket deletes on
    // real moderation data)
    await db.delete(chatMessages).where(eq(chatMessages.message, MARKER));
    if (probeMessageId) {
      await db.delete(chatReports).where(eq(chatReports.messageId, probeMessageId));
    }
    await db.delete(blockedUsers).where(and(eq(blockedUsers.blockerId, A), eq(blockedUsers.blockedId, B)));
    const leftoverMsgs = await db.select().from(chatMessages).where(eq(chatMessages.message, MARKER));
    console.log(`cleanup: message/report/block rows removed (residual probe messages: ${leftoverMsgs.length})`);
  }
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`LIVE PROBE FAILED: ${failures} assertion(s)`);
      process.exit(1);
    }
    console.log('LIVE PROBE GREEN: all assertions passed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('LIVE PROBE ERROR:', err);
    process.exit(1);
  });
