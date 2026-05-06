/**
 * WebSocket Authentication — Supabase JWT Verification
 */

import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';
import type { Socket } from 'socket.io';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  level: number;
  clanId?: string;
  clanName?: string;
  role?: string;
}

export interface AuthenticationResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

const SUPABASE_JWT_SECRET = new TextEncoder().encode(
  process.env.SUPABASE_JWT_SECRET || ''
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  });
  return cookies;
}

export async function authenticateSocket(socket: Socket): Promise<AuthenticationResult> {
  try {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const cookies = parseCookies(cookieHeader);

    const supabaseCookieNames = Object.keys(cookies).filter(k => k.startsWith('sb-'));
    let token: string | undefined = undefined;

    for (const name of supabaseCookieNames) {
      if (name.includes('auth-token')) {
        const parts = cookies[name].split('.');
        if (parts.length >= 2) {
          token = `${parts[0]}.${parts[1]}`;
          break;
        }
      }
    }

    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token) {
      return { success: false, error: 'No token provided' };
    }

    const { payload } = await jwtVerify(token, SUPABASE_JWT_SECRET);
    const userId = payload.sub as string;
    const userMetadata = (payload.user_metadata as Record<string, string | number> | undefined) ?? {};
    const username: string = (userMetadata.username as string) || (payload.email as string);
    const level: number = (userMetadata.level as number) ?? 1;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: player } = await supabase
      .from('players')
      .select('username, level, clan_id, clan_name')
      .eq('username', username)
      .maybeSingle();

    return {
      success: true,
      user: {
        userId,
        username,
        level: player?.level ?? level,
        clanId: player?.clan_id ?? undefined,
        clanName: player?.clan_name ?? undefined,
      },
    };
  } catch {
    return { success: false, error: 'Authentication failed' };
  }
}
