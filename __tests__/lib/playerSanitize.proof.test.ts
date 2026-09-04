import { describe, it, expect } from 'vitest';
import { sanitizePlayer, sanitizePlayerRows } from '@/lib/playerSanitize';

const leakyRow = {
  username: 'fame',
  password: '$2b$10$HASH',
  email: 'a@b.c',
  signupIp: '1.2.3.4',
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_1',
  referredBy: 'other',
  referredByUsername: 'other',
  baseX: 12,
  baseY: 30,
  currentPosition: { x: 12, y: 30 },
  resources: { metal: 100, energy: 50 },
  bank: { metal: 5, energy: 1 },
  level: 7,
  rank: 9,
  vip: true,
  clanName: 'TEST',
  totalReferrals: 3,
  createdAt: '2026-09-04T00:00:00Z',
};

describe('sanitizePlayer allowlist (FID-20260904-005 §5.0)', () => {
  it('drops every sensitive field proven live in the FID', () => {
    const pub = sanitizePlayer(leakyRow)!;
    for (const forbidden of [
      'password',
      'email',
      'signupIp',
      'stripeCustomerId',
      'stripeSubscriptionId',
      'referredBy',
      'referredByUsername',
    ]) {
      expect(pub, forbidden).not.toHaveProperty(forbidden);
    }
  });

  it('keeps the public fields the client actually renders', () => {
    const pub = sanitizePlayer(leakyRow)!;
    expect(pub.username).toBe('fame');
    expect(pub.level).toBe(7);
    expect(pub.rank).toBe(9);
    expect((pub as Record<string, unknown>).resources).toEqual({ metal: 100, energy: 50 });
    expect((pub as Record<string, unknown>).currentPosition).toEqual({ x: 12, y: 30 });
    expect(pub.totalReferrals).toBe(3); // referral aggregate allowed
    expect(pub.clanName).toBe('TEST');
  });

  it('is future-proof: a NEW sensitive column cannot leak (allowlist semantics)', () => {
    const futureRow = { ...leakyRow, someFutureSecretColumn: 'secret-value-2027' };
    const pub = sanitizePlayer(futureRow)!;
    expect(pub).not.toHaveProperty('someFutureSecretColumn');
  });

  it('handles arrays and null safely', () => {
    const rows = sanitizePlayerRows([leakyRow, leakyRow]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toHaveProperty('password');
    expect(sanitizePlayer(null)).toBeNull();
    expect(sanitizePlayer(undefined)).toBeNull();
  });
});
