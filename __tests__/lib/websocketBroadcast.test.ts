// @vitest-environment node
/**
 * FID-20260912-079 — websocket broadcast `this`-binding regression test.
 *
 * emitTyped used to extract `io.to(room).emit` into a variable and invoke it
 * detached. A detached function call loses `this`, and socket.io's
 * BroadcastOperator.emit reads `this.adapter` — so every broadcast in the app
 * (player-online pings, tile updates, clan/global events) died with
 * "Cannot read properties of undefined (reading 'adapter')" and was swallowed
 * by the surrounding try/catch. Reproduced against a real socket.io Server.
 *
 * This test pins the fix: broadcasts through the real broadcast module must
 * reach room members and never hit the adapter error. (jsdom breaks
 * socket.io-client, hence the node environment pragma above.)
 */
import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import { io as Client } from 'socket.io-client';

import {
  broadcastToAll,
  broadcastToLocation,
} from '@/lib/websocket/broadcast';

type TestServer = {
  port: number;
  close: () => void;
};

function startServer(joinRoom: (s: import('socket.io').Socket) => void): Promise<TestServer & { io: IOServer }> {
  return new Promise((resolve) => {
    const httpServer = http.createServer();
    const io = new IOServer(httpServer, { transports: ['websocket'] });
    // Room join is registered BEFORE any client connects (no race).
    io.on('connection', (s) => void joinRoom(s));
    httpServer.listen(() => {
      const port = (httpServer.address() as { port: number }).port;
      resolve({
        port,
        io,
        close: () => {
          io.close();
          httpServer.close();
        },
      });
    });
  });
}

function connect(port: number): Promise<ReturnType<typeof Client>> {
  return new Promise((resolve, reject) => {
    const c = Client(`http://localhost:${port}`, { transports: ['websocket'] });
    c.on('connect', () => resolve(c));
    c.on('connect_error', reject);
  });
}

describe('websocket broadcasts reach clients (FID-20260912-079)', () => {
  it('broadcastToAll delivers to a connected client (no adapter crash)', async () => {
    const srv = await startServer((s) => void s.join('global'));
    const client = await connect(srv.port);

    const received = new Promise<Record<string, unknown>>((resolve) => {
      client.on('game:player_online', (payload: Record<string, unknown>) => resolve(payload));
    });

    // The pre-fix code THREW here (swallowed by the broadcast's own
    // try/catch) and nothing ever arrived.
    await broadcastToAll(srv.io as never, 'game:player_online', {
      userId: 'u1',
      username: 'fame',
      level: 18,
      x: 60,
      y: 2,
    } as never);

    expect(await withTimeout(received)).toMatchObject({ username: 'fame' });
    client.close();
    srv.close();
  }, 15_000);

  it('broadcastToLocation delivers to room members (the player-online path)', async () => {
    const srv = await startServer((s) => void s.join('location:60:2'));
    const client = await connect(srv.port);

    const received = new Promise<Record<string, unknown>>((resolve) => {
      client.on('game:player_online', (payload: Record<string, unknown>) => resolve(payload));
    });

    await broadcastToLocation(srv.io as never, 60, 2, 'game:player_online', {
      userId: 'u2',
      username: 'nearby_player',
      level: 10,
      x: 60,
      y: 2,
    } as never);

    expect(await withTimeout(received)).toMatchObject({ username: 'nearby_player' });
    client.close();
    srv.close();
  }, 15_000);
});

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('event never received')), 5000)),
  ]);
}
