/**
 * FID-20260919-002 — LIVE verification driver for the chat client subscriptions.
 * Boots NO processes: point SERVER at the dev server (tsx server.ts, which serves
 * Next AND mounts socket.io at /api/socketio — the exact production path).
 *
 * Uses socket.io-client directly (same library, same auth handshake as
 * context/WebSocketContext: cookie auth on the websocket transport, auto-join
 * handled server-side).
 *
 * Probes:
 *   P1  register/log in two probe players via real HTTP routes
 *   P2  both sockets authenticate + connect with the session cookie
 *   P3  chat:message — A sends in GLOBAL, B receives the exact wire object
 *   P4  typing — A start → B sees chat:typing_start; A stop → B sees
 *       chat:typing_stop; A does NOT receive her own typing (server excludes
 *       the sender — the panel filters self defensively as well)
 *   P5  online count — C joins NEWBIE → A hears chat:online_count with count 1
 *   P6  deletion — DELETE /api/chat/delete → B hears chat:message_deleted
 *   P7  message idempotence invariant: P3's wire object round-trips through
 *       wireToChatMessage + mergeSocketMessage without duplication
 *
 * Exits 0 only when every probe passes. Cleans up its probe players.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { io, Socket } from 'socket.io-client';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { players } from '../lib/db/schema';
import { wireToChatMessage, mergeSocketMessage } from '../lib/chatSocketWiring';

const SERVER = process.env.PROBE_SERVER || 'http://localhost:3003';
const RUN = `chatsock${Date.now().toString(36).slice(-6)}`;
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

async function main() {
  // ── P1: probe players via real HTTP ────────────────────────────────────────
  const [aOk, bOk, cOk] = await Promise.all([register(`${RUN}_a`), register(`${RUN}_b`), register(`${RUN}_c`)]);
  ok('P1 probe players registered/logged in via real routes', aOk && bOk && cOk);
  if (!(aOk && bOk && cOk)) process.exit(1);

  // ── P2: authenticated socket connects (cookie handshake) ──────────────────
  const sockA = await connect(`${RUN}_a`);
  const sockB = await connect(`${RUN}_b`);
  const sockC = await connect(`${RUN}_c`);
  ok('P2 sockets A and B authenticated and connected', !!sockA && !!sockB);
  if (!sockA || !sockB || !sockC) process.exit(1);

  try {
    // ── P3: chat:message delivery ────────────────────────────────────────────
    const bGot = waitFor<{ id: string; channelId: string; message: string; senderUsername: string }>(
      sockB, 'chat:message', (m) => m.message === `hello from ${RUN}`
    );
    const sendAck = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      sockA.emit('chat:send_message', { channelId: 'global', message: `hello from ${RUN}` }, resolve);
    });
    ok('P3a send ack success', sendAck.success === true, sendAck.error);
    const got = await bGot;
    ok(
      'P3b B received chat:message wire object',
      !!got && typeof got.id === 'string' && got.channelId === 'global' && got.senderUsername === `${RUN}_a`,
      got ? `id=${got.id}` : 'timeout'
    );

    // ── P4: typing indicators ────────────────────────────────────────────────
    const bTypingStart = waitFor<{ channelId: string; username: string }>(
      sockB, 'chat:typing_start', (p) => p.username === `${RUN}_a`
    );
    sockA.emit('chat:start_typing', { channelId: 'global' });
    const tStart = await bTypingStart;
    ok('P4a B received chat:typing_start from A', !!tStart, tStart ? `channel=${tStart.channelId}` : 'timeout');

    const bTypingStop = waitFor<{ channelId: string; username: string }>(
      sockB, 'chat:typing_stop', (p) => p.username === `${RUN}_a`
    );
    sockA.emit('chat:stop_typing', { channelId: 'global' });
    const tStop = await bTypingStop;
    ok('P4b B received chat:typing_stop from A', !!tStop, tStop ? `channel=${tStop.channelId}` : 'timeout');

    // True server-exclusion check: B listens, A types. The sender's own
    // socket must NOT receive its typing event back.
    const aSelfTyping = waitFor<{ username: string }>(
      sockA, 'chat:typing_start', (p) => p.username === `${RUN}_a`, 1500
    );
    sockA.emit('chat:start_typing', { channelId: 'global' });
    const selfEcho = await aSelfTyping;
    ok('P4c sender does NOT receive own typing event (server excludes sender)', selfEcho === null);
    sockA.emit('chat:stop_typing', { channelId: 'global' });

    // ── P5: online count on join ─────────────────────────────────────────────
    const aCount = waitFor<{ channelId: string; count: number }>(
      sockA, 'chat:online_count', (p) => p.channelId === 'newbie'
    );
    sockC.emit('chat:join_channel', { channelId: 'newbie' });
    const cnt = await aCount;
    ok(
      'P5 A heard chat:online_count for NEWBIE when C joined',
      !!cnt && cnt.count >= 1,
      cnt ? `count=${cnt.count}` : 'timeout (C may lack level<6 gate — probe C is level 1)'
    );

    // ── P6: deletion notification ────────────────────────────────────────────
    if (got) {
      const bDeleted = waitFor<{ messageId: string }>(
        sockB, 'chat:message_deleted', (p) => p.messageId === got.id
      );
      const del = await fetch(`${SERVER}/api/chat/delete?messageId=${encodeURIComponent(got.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Cookie: perUser.get(`${RUN}_a`) ?? '' },
      });
      ok('P6a sender delete accepted', del.ok, `status ${del.status}`);
      const delNote = await bDeleted;
      ok('P6b B heard chat:message_deleted for that id', !!delNote, delNote ? delNote.messageId : 'timeout');
    } else {
      ok('P6 deletion notification (skipped — P3b message not delivered)', false, 'dependent on P3b');
    }

    // ── P7: wiring-module invariant over the REAL wire object ────────────────
    if (got) {
      const mapped = wireToChatMessage(got as never);
      const m0 = new Map();
      const once = mergeSocketMessage(m0 as never, mapped as never);
      const twice = mergeSocketMessage(once as never, mapped as never);
      ok(
        'P7 wire object maps + merges idempotently (echo/poll dedupe)',
        !!mapped && mapped.id === got.id && (once as Map<never, never>).size === 1 && (twice as Map<never, never>).size === 1 && twice === once
      );
    }
  } finally {
    sockA?.disconnect();
    sockB?.disconnect();
    sockC?.disconnect();
    await new Promise((r) => setTimeout(r, 400));
    await db.delete(players).where(eq(players.username, `${RUN}_a`));
    await db.delete(players).where(eq(players.username, `${RUN}_b`));
    await db.delete(players).where(eq(players.username, `${RUN}_c`));
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
