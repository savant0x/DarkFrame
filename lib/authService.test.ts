/**
 * authService Tests
 * Created: 2025-10-23
 * 
 * OVERVIEW:
 * Tests authentication service functions including password hashing,
 * verification, and JWT token generation/validation.
 */

import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  type TokenPayload,
} from '@/lib/authService';

describe('authService', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      // Bcrypt adds salt, so same password should produce different hashes
      expect(hash1).not.toBe(hash2);
    });

    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate a valid token', () => {
      const payload: TokenPayload = {
        username: 'testuser',
        email: 'test@example.com',
      };
      
      const token = generateToken(payload.username, payload.email);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate token with rememberMe option', () => {
      const payload: TokenPayload = {
        username: 'testuser',
        email: 'test@example.com',
      };
      
      const token = generateToken(payload.username, payload.email, true);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should include username and email in token payload', () => {
      const username = 'testuser';
      const email = 'test@example.com';
      
      const token = generateToken(username, email);
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      if (decoded) {
        expect(decoded.username).toBe(username);
        expect(decoded.email).toBe(email);
      }
    });
  });

  describe('JWT Token Verification', () => {
    it('should verify a valid token', () => {
      const username = 'testuser';
      const email = 'test@example.com';
      
      const token = generateToken(username, email);
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded?.username).toBe(username);
      expect(decoded?.email).toBe(email);
    });

    it('should reject invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const decoded = verifyToken(invalidToken);
      
      expect(decoded).toBeNull();
    });

    it('should reject malformed token', () => {
      const malformedToken = 'notajwttoken';
      const decoded = verifyToken(malformedToken);
      
      expect(decoded).toBeNull();
    });

    it('should include iat and exp in decoded token', () => {
      const token = generateToken('testuser', 'test@example.com');
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      if (decoded) {
        expect(decoded.iat).toBeDefined();
        expect(decoded.exp).toBeDefined();
        expect(typeof decoded.iat).toBe('number');
        expect(typeof decoded.exp).toBe('number');
        expect(decoded.exp).toBeGreaterThan(decoded.iat!);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty password', async () => {
      const emptyPassword = '';
      const hash = await hashPassword(emptyPassword);
      
      expect(hash).toBeDefined();
      const isValid = await verifyPassword(emptyPassword, hash);
      expect(isValid).toBe(true);
    });

    it('should handle very long password', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await hashPassword(longPassword);
      
      expect(hash).toBeDefined();
      const isValid = await verifyPassword(longPassword, hash);
      expect(isValid).toBe(true);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(specialPassword);
      
      expect(hash).toBeDefined();
      const isValid = await verifyPassword(specialPassword, hash);
      expect(isValid).toBe(true);
    });
  });
});
