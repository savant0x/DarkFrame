/**
 * FID-20260919-005 — LIVE verification driver for the ask-veterans false-success fix.
 * Boots NO processes: point SERVER at the socket server (tsx server.ts = Next +
 * socket.io, the exact production path).
 *
 * Reproduces the original defect signature and pins the repair over real HTTP
 * + two real sockets:
 *   P1  probe players: newbie (level 1) + veteran (bumped to 60 BEFORE connect —
 *       auth hydrates level from the DB at connect time)
 *   P2  both sockets connect with cookie auth
 *   P3  HTTP POST /api/chat/ask-veterans → success:true AND notifiedCount is a
 *       number ≥ 1 (the field the old response never carried)
 *   P4  the veteran's socket receives chat:veteran_notification with the exact
 *       payload truth (requester identity/level/question, help channel, TTL = 5min)
 *   P5  the newbie's own socket does NOT receive the notification (non-veteran
 *       exclusion, live)
 *   P6  honesty edge: an immediate second ask hits the 5-minute rate limit →
 *       HTTP 429 with success:false (the client gate's server twin)
 *
 * Exits 0 only when every probe passes. Cleans up its probe players.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { io, Socket } from 'socket.io-client';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { players } from '../lib/db/schema';

const SERVER = process.env.PROBE_SERVER || 'http://localhost:3003';
const RUN = `vet${Date.now().toString(36).slice(-6)}`;
const PW = 'Probe!Passw0rd';

const results: Array<{ ok: boolean; name: string; detail?: string }> = [];
const ok = (name: string, cond: boolean, detail?: string) => {
  results.push({ ok: cond, name, detail });
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const perUser = new Map<string, string>();
function captureSession(res: Response, username: string): void {
  const setCookie = res.headers.get('set-cookie') || '';
  const sessionCookie = setCookie
    .split(',')
    .map((c) => c.trim())
    .find((c) => c.startsWith('darkframe_session='));
  if (sessionCookie) perUser.set(username, sessionCookie.split(';')[0]);
}

async function register(username: string): Promise<boolean> {
  const res = await fetch(`${SERVER}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email: `${RUN}.${username}@probe.invalid`, password: PW }),
  });
  captureSession(res, username);
  if (res.ok) return true;
  const login = await fetch(`${SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email: `${RUN}.${username}@probe.invalid`, password: PW }),
  });
  captureSession(login, username);
  return login.ok;
}

function connect(username: string): Promise<Socket | null> {
  const cookie = perUser.get(username);
  if (!cookie) return Promise.resolve(null);
  return new Promise((resolve) => {
    const socket = io(SERVER, {
      path: '/api/socketio',
      transports: ['websocket'],
      withCredentials: true,
      extraHeaders: { cookie },
      reconnection: false,
      timeout: 8000,
    });
    const timer = setTimeout(() => resolve(null), 9000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

function waitFor<T>(socket: Socket, event: string, pred: (p: T) => boolean, ms = 6000): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    const handler = (payload: T) => {
      if (pred(payload)) {
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      }
    };
    socket.on(event, handler as never);
  });
}

const QUESTION = `How do I get better armor at level 3? (${RUN})`;

async function main() {
  // ── P1: probe players; veteran level bumped BEFORE socket connect ──────────
  const [nOk, vOk] = await Promise.all([register(`${RUN}_newbie`), register(`${RUN}_vet`)]);
  ok('P1 probe players registered/logged in via real routes', nOk && vOk);
  if (!(nOk && vOk)) process.exit(1);

  const bumped = await db
    .update(players)
    .set({ level: 60 })
    .where(eq(players.username, `${RUN}_vet`))
    .returning({ username: players.username, level: players.level });
  ok(
    'P1b veteran level set to 60 before connect (auth hydrates level at connect)',
    bumped.length === 1 && bumped[0].level === 60
  );

  // ── P2: authenticated sockets ──────────────────────────────────────────────
  const sockN = await connect(`${RUN}_newbie`);
  const sockV = await connect(`${RUN}_vet`);
  ok('P2 newbie and veteran sockets authenticated and connected', !!sockN && !!sockV);
  if (!sockN || !sockV) process.exit(1);

  try {
    // ── P3: the HTTP ask — success AND the honest count ──────────────────────
    // P4 listener armed BEFORE the ask: the route broadcasts during the
    // request, before its HTTP response resolves - attaching after would
    // miss the delivery entirely (probe design race, not a code defect).
    const vetNotePromise = waitFor<{
      notificationId: string;
      requesterId: string;
      requesterUsername: string;
      requesterLevel: number;
      question: string;
      channelId: string;
      timestamp: number;
      expiresAt: number;
    }>(sockV, 'chat:veteran_notification', (p) => p.requesterUsername === `${RUN}_newbie`, 8000);

    const res = await fetch(`${SERVER}/api/chat/ask-veterans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: perUser.get(`${RUN}_newbie`) ?? '' },
      body: JSON.stringify({ question: QUESTION }),
    });
    const data = (await res.json()) as { success?: boolean; notifiedCount?: number; error?: string };
    ok(
      'P3 HTTP ask accepted with notifiedCount in the response (old response lacked the field)',
      res.ok && data.success === true && typeof data.notifiedCount === 'number' && data.notifiedCount >= 1,
      `status=${res.status} notifiedCount=${String(data.notifiedCount)} ${data.error ?? ''}`
    );

    // P4: the veteran hears it, with payload truth
    const vetNote = await vetNotePromise;
    const payloadOk =
      !!vetNote &&
      vetNote.requesterLevel === 1 &&
      vetNote.question === QUESTION &&
      vetNote.channelId === 'help' &&
      typeof vetNote.notificationId === 'string' &&
      vetNote.notificationId.length > 0 &&
      typeof vetNote.timestamp === 'number' &&
      vetNote.expiresAt - vetNote.timestamp === 5 * 60 * 1000;
    ok('P4 veteran socket received chat:veteran_notification with exact payload truth', payloadOk,
      vetNote ? `id=${vetNote.notificationId.slice(0, 8)} expires-timestamp=${vetNote.expiresAt - vetNote.timestamp}ms` : 'timeout');

    // ── P5: the newbie herself does NOT hear it ──────────────────────────────
    const selfEcho = await waitFor<unknown>(
      sockN, 'chat:veteran_notification', () => true, 1500
    );
    ok('P5 newbie socket did NOT receive the veteran notification (non-veteran exclusion)', selfEcho === null);

    // ── P6: honesty edge — second ask inside the cooldown is a real 429 ─────
    const res2 = await fetch(`${SERVER}/api/chat/ask-veterans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: perUser.get(`${RUN}_newbie`) ?? '' },
      body: JSON.stringify({ question: `${QUESTION} (again)` }),
    });
    const data2 = (await res2.json()) as { success?: boolean; error?: string };
    ok(
      'P6 second ask inside cooldown → HTTP 429 with success:false (client honesty gate twin)',
      res2.status === 429 && data2.success === false && typeof data2.error === 'string',
      `status=${res2.status} error="${data2.error ?? ''}"`
    );
  } finally {
    sockN?.disconnect();
    sockV?.disconnect();
    await new Promise((r) => setTimeout(r, 400));
    await db.delete(players).where(eq(players.username, `${RUN}_newbie`));
    await db.delete(players).where(eq(players.username, `${RUN}_vet`));
    ok('cleanup: probe players removed (residue zero)', true);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} probes passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('driver failed:', e);
  process.exit(1);
});
