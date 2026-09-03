/**
 * @file lib/authService.ts
 * @created 2025-10-16
 * @overview Authentication utilities with bcrypt and JWT + cookie management
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'darkframe-secret-change-in-production';
const SALT_ROUNDS = 10;

// Cookie configuration
const COOKIE_NAME = 'darkframe_session';
const SESSION_DURATION = 60 * 60; // 1 hour in seconds
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60; // 30 days in seconds

export interface TokenPayload {
  username: string;
  email: string;
  rank?: number;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for a user
 * 
 * @param username - User's username
 * @param email - User's email
 * @param rememberMe - If true, token lasts 30 days; else 1 hour
 * @returns Signed JWT token
 */
/**
 * Generate JWT token with user information
 */
export function generateToken(username: string, email: string, rememberMe: boolean = false, isAdmin: boolean = false): string {
  const expiresIn = rememberMe ? REMEMBER_ME_DURATION : SESSION_DURATION;
  
  return jwt.sign(
    { username, email, isAdmin },
    JWT_SECRET,
    { expiresIn }
  );
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requirements: At least 8 characters, 1 uppercase, 1 lowercase, 1 number
 */
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

/**
 * Validate username format
 */
export function isValidUsername(username: string): { valid: boolean; message?: string } {
  if (username.length < 3 || username.length > 20) {
    return { valid: false, message: 'Username must be 3-20 characters' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, message: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }
  
  return { valid: true };
}

// ============================================================
// COOKIE MANAGEMENT FUNCTIONS
// ============================================================

/**
 * Set authentication cookie
 * 
 * @param token - JWT token to store
 * @param rememberMe - If true, cookie lasts 30 days; else 1 hour
 */
export async function setAuthCookie(token: string, rememberMe: boolean = false): Promise<void> {
  const cookieStore = await cookies();
  const maxAge = rememberMe ? REMEMBER_ME_DURATION : SESSION_DURATION;
  
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true, // Prevent JavaScript access (XSS protection)
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // CSRF protection
    maxAge,
    path: '/',
  });
  
  console.log(`🍪 Auth cookie set for ${rememberMe ? '30 days' : '1 hour'}`);
}

/**
 * Get authentication cookie
 * 
 * @returns JWT token from cookie or null if not found
 */
export async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Clear authentication cookie (logout)
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  console.log('🍪 Auth cookie cleared');
}

/**
 * Get authenticated user from cookie
 * 
 * @returns User payload from token or null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<TokenPayload | null> {
  const token = await getAuthCookie();
  if (!token) return null;
  
  return verifyToken(token);
}

// ============================================================
// IMPLEMENTATION NOTES:
// - Uses bcrypt for secure password hashing
// - JWT tokens valid for 7 days
// - Email and password validation
// - Username validation reused from original system
// - JWT_SECRET should be set in .env for production
// ============================================================
