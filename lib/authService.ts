/**
 * Supabase-Aware Auth Service
 * 
 * Validation helpers retained. Auth operations delegated to Supabase client.
 * Cookie management handled by @supabase/ssr middleware.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';

type PlayerRow = Tables<'players'>;

// ============================================================================
// TYPES
// ============================================================================

export interface TokenPayload {
  username: string;
  email: string;
  id: string;
  rank?: number;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

export function isValidUsername(username: string): { valid: boolean; message?: string } {
  if (username.length < 3 || username.length > 20) {
    return { valid: false, message: 'Username must be 3-20 characters' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, message: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }
  return { valid: true };
}

// ============================================================================
// SUPABASE AUTH WRAPPERS
// ============================================================================

export async function signUpWithEmail(email: string, password: string, username: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  return { data, error };
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const supabase = createServiceClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getAuthenticatedUser(): Promise<TokenPayload | null> {
  const supabase = createServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const username = (user.user_metadata?.username as string) ?? user.email!;
  const { data: player } = await supabase
    .from('players')
    .select('is_admin, rank')
    .eq('username', username)
    .maybeSingle();

  return {
    id: user.id,
    username,
    email: user.email!,
    isAdmin: Boolean(player?.is_admin),
    rank: player?.rank ?? 1,
  };
}

export async function getAuthenticatedPlayer() {
  const auth = await getAuthenticatedUser();
  if (!auth) return null;

  const supabase = createServiceClient();
  const { data: player, error } = await supabase
    .from('players')
    .select('*')
    .eq('username', auth.username)
    .single();

  if (error || !player) return null;

  return {
    username: player.username,
    email: player.email,
    player,
    isAdmin: player.is_admin,
  };
}

// ============================================================================
// BACKWARD COMPATIBILITY (deprecated, replaced by Supabase Auth)
// ============================================================================

export const getCurrentUser = getAuthenticatedUser;
export const loginUser = signInWithEmail;
export const registerUser = signUpWithEmail;

export function generateToken(_username: string, _email: string, _rememberMe: boolean = false, _isAdmin: boolean = false): string {
  return '';
}
export function verifyToken(_token: string): TokenPayload | null {
  return null;
}
export async function hashPassword(_password: string): Promise<string> {
  return 'supabase_auth';
}
export async function verifyPassword(_password: string, _hash: string): Promise<boolean> {
  return true;
}
export async function setAuthCookie(_token: string, _rememberMe: boolean = false): Promise<void> {}
export async function getAuthCookie(): Promise<string | null> {
  return null;
}
export async function clearAuthCookie(): Promise<void> {}
