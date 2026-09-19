/**
 * @file __tests__/api/rpCheckout.test.ts
 * @created 2026-09-19
 * @overview Pins for FID-20260919-010 (RP packages checkout): the package-map
 *            invariants, the one-time session contract (server-owned amount),
 *            grantRpPackage username-keying, and the webhook RP branch's
 *            false-success law (throw on failed grant, ledger only after grant,
 *            idempotent replay) with the VIP dispatch guard.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_pins';
});

vi.mock('@/lib/stripe/subscriptionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe/subscriptionService')>();
  return {
    ...actual,
    grantVIP: vi.fn(),
    recordPaymentTransaction: vi.fn(),
    grantRpPackage: vi.fn(),
    hasRpTransactionForSession: vi.fn(),
  };
});

vi.mock('stripe', () => {
  const createMock = vi.fn();
  const MockStripe = class {
    checkout = { sessions: { create: createMock } };
    webhooks = {};
  };
  return { default: MockStripe, __createMock: createMock };
});

import { handleCheckoutCompleted } from '@/lib/stripe/webhookHandlers';
import {
  grantVIP,
  recordPaymentTransaction,
  grantRpPackage,
  hasRpTransactionForSession,
} from '@/lib/stripe/subscriptionService';
import { createRpCheckoutSession, getStripe } from '@/lib/stripe/stripeService';
import { RP_PACKAGES, getRPPackage } from '@/lib/stripe/rpPackages';
import type Stripe from 'stripe';

const mockedGrantVip = vi.mocked(grantVIP);
const mockedRecord = vi.mocked(recordPaymentTransaction);
const mockedGrantRp = vi.mocked(grantRpPackage);
const mockedHasRp = vi.mocked(hasRpTransactionForSession);

function rpEvent(overrides: Record<string, unknown> = {}, metadata: Record<string, string> = {}): Stripe.Event {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_rp_1',
        payment_status: 'paid',
        customer: 'cus_test',
        subscription: null,
        amount_total: 999,
        metadata: {
          kind: 'rp_package',
          userId: 'probe_user',
          username: 'probe_user',
          packageId: 'boost',
          rp: '5000',
          ...metadata,
        },
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGrantVip.mockResolvedValue(true);
  mockedRecord.mockResolvedValue('txn_1');
  mockedGrantRp.mockResolvedValue(true);
  mockedHasRp.mockResolvedValue(false);
});

describe('rpPackages — the single-source map', () => {
  it('carries the five shop packages with unique ids, positive rp and cents', () => {
    expect(RP_PACKAGES).toHaveLength(5);
    const ids = RP_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(5);
    for (const p of RP_PACKAGES) {
      expect(p.rp).toBeGreaterThan(0);
      expect(p.priceCents).toBeGreaterThan(0);
      expect(Number.isInteger(p.priceCents)).toBe(true);
    }
  });

  it('resolves by id and returns undefined for unknown ids (the injection dead-end)', () => {
    expect(getRPPackage('boost')?.rp).toBe(5000);
    expect(getRPPackage('boost')?.priceCents).toBe(999);
    expect(getRPPackage('make_me_rich')).toBeUndefined();
  });
});

describe('createRpCheckoutSession — the one-time session contract', () => {
  it('creates mode=payment with the SERVER price and rp metadata (client cannot set amounts)', async () => {
    const stripe = getStripe() as unknown as {
      checkout: { sessions: { create: ReturnType<typeof vi.fn> } };
    };
    (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'cs_live_1',
      url: 'https://checkout.stripe.com/c/pay/cs_live_1',
    });

    const result = await createRpCheckoutSession({
      userId: 'probe_user',
      username: 'probe_user',
      email: 'probe@invalid',
      packageId: 'boost',
    });

    expect(result.success).toBe(true);
    const args = (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(args.mode).toBe('payment');
    expect(args.line_items[0].price_data.unit_amount).toBe(999); // server-owned
    expect(args.line_items[0].price_data.currency).toBe('usd');
    expect(args.metadata).toMatchObject({
      kind: 'rp_package',
      userId: 'probe_user',
      username: 'probe_user',
      packageId: 'boost',
      rp: '5000',
    });
    expect(args.success_url).toContain('/shop/rp-packages');
  });

  it('refuses unknown package ids before touching Stripe', async () => {
    const result = await createRpCheckoutSession({
      userId: 'probe_user',
      username: 'probe_user',
      email: 'probe@invalid',
      packageId: 'make_me_rich',
    });
    expect(result.success).toBe(false);
  });
});

describe('webhook RP branch — the false-success law', () => {
  it('grants from the SERVER map (metadata rp is informational) and records the ledger row', async () => {
    // Metadata lies about rp; the server map must win.
    await handleCheckoutCompleted(rpEvent({}, { rp: '999999999' }));
    expect(mockedGrantRp).toHaveBeenCalledWith({ userId: 'probe_user', rp: 5000 });
    expect(mockedRecord).toHaveBeenCalledTimes(1);
    expect(mockedRecord.mock.calls[0][0]).toMatchObject({
      userId: 'probe_user',
      username: 'probe_user',
      tier: 'rp:boost',
      amount: 999,
      status: 'completed',
      stripeSessionId: 'cs_test_rp_1',
    });
  });

  it('grant-before-ledger: a failed grant THROWS and records nothing', async () => {
    mockedGrantRp.mockResolvedValue(false); // 0-row update
    await expect(handleCheckoutCompleted(rpEvent())).rejects.toThrow(/RP grant failed/);
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('idempotent replay: an already-processed session neither grants nor records', async () => {
    mockedHasRp.mockResolvedValue(true);
    await handleCheckoutCompleted(rpEvent());
    expect(mockedGrantRp).not.toHaveBeenCalled();
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('unknown packageId in metadata throws (no silent no-op)', async () => {
    await expect(
      handleCheckoutCompleted(rpEvent({}, { packageId: 'make_me_rich' }))
    ).rejects.toThrow(/Unknown RP packageId/);
    expect(mockedGrantRp).not.toHaveBeenCalled();
  });

  it('missing RP metadata throws (integrity fault, not a silent skip)', async () => {
    await expect(
      handleCheckoutCompleted(rpEvent({}, { packageId: '' }))
    ).rejects.toThrow(/Missing required metadata/);
  });

  it('VIP dispatch guard: kind=rp_package WITH a tier still takes the VIP path (backward compat)', async () => {
    await handleCheckoutCompleted(
      rpEvent(
        { amount_total: 1499 },
        { kind: 'rp_package', tier: 'MONTHLY', packageId: '' }
      )
    );
    expect(mockedGrantVip).toHaveBeenCalled();
    expect(mockedGrantRp).not.toHaveBeenCalled();
  });
});
