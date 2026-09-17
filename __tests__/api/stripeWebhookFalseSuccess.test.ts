/**
 * @file __tests__/api/stripeWebhookFalseSuccess.test.ts
 * @created 2026-09-17
 * @overview Webhook behavioral pins for FID-20260917-009 — the false-success
 *            regression class the audit found: a FAILED grant must THROW (→
 *            non-2xx → Stripe retries) and must NOT record the payment
 *            transaction; a successful grant records exactly one transaction.
 *            Same pins apply to renewal-extend and cancellation-revoke paths
 *            (previously their false returns were swallowed by catch blocks —
 *            the fix moved the handlers to lib/stripe/webhookHandlers.ts and
 *            made every false money-mutation throw).
 *
 * The subscription service is partial-mocked (real module, overridden
 * functions) because the handlers captured their bindings at import time —
 * spying on the namespace cannot rebind an already-resolved import. Lives in
 * its own file so the service-layer pins (stripeVipKeying.test.ts) keep
 * exercising the REAL functions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VIPTier } from '@/types/stripe.types';

vi.mock('@/lib/stripe/subscriptionService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe/subscriptionService')>();
  return {
    ...actual,
    grantVIP: vi.fn(),
    revokeVIP: vi.fn(),
    recordPaymentTransaction: vi.fn(),
  };
});

import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from '@/lib/stripe/webhookHandlers';
import {
  grantVIP,
  revokeVIP,
  recordPaymentTransaction,
} from '@/lib/stripe/subscriptionService';

const mockedGrant = vi.mocked(grantVIP);
const mockedRevoke = vi.mocked(revokeVIP);
const mockedRecord = vi.mocked(recordPaymentTransaction);

function checkoutEvent(userId = 'fame'): Parameters<typeof handleCheckoutCompleted>[0] {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        customer: 'cus_test',
        subscription: 'sub_test',
        amount_total: 1499,
        metadata: { userId, username: userId, tier: VIPTier.MONTHLY },
      },
    },
  } as unknown as Parameters<typeof handleCheckoutCompleted>[0];
}

function subscriptionEvent(
  type: 'customer.subscription.updated' | 'customer.subscription.deleted',
  userId = 'fame',
): Parameters<typeof handleSubscriptionUpdated>[0] {
  return {
    type,
    data: {
      object: {
        id: 'sub_test',
        status: type === 'customer.subscription.updated' ? 'active' : 'canceled',
        customer: 'cus_test',
        metadata: { userId, username: userId, tier: VIPTier.MONTHLY },
      },
    },
  } as unknown as Parameters<typeof handleSubscriptionUpdated>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FID-20260917-009: webhook false-success regression', () => {
  it('checkout with grant=false → THROWS and does NOT record the payment transaction', async () => {
    mockedGrant.mockResolvedValue(false);

    await expect(handleCheckoutCompleted(checkoutEvent())).rejects.toThrow(/VIP grant failed/);
    expect(mockedRecord).not.toHaveBeenCalled();
  });

  it('checkout with grant=true → records exactly one payment transaction', async () => {
    mockedGrant.mockResolvedValue(true);
    mockedRecord.mockResolvedValue('1');

    await expect(handleCheckoutCompleted(checkoutEvent())).resolves.toBeUndefined();
    expect(mockedRecord).toHaveBeenCalledTimes(1);
    expect(mockedRecord).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'fame', status: 'completed', tier: VIPTier.MONTHLY }),
    );
  });

  it('renewal with grant=false → THROWS (previously swallowed by catch)', async () => {
    mockedGrant.mockResolvedValue(false);

    await expect(
      handleSubscriptionUpdated(subscriptionEvent('customer.subscription.updated')),
    ).rejects.toThrow(/VIP renewal grant failed/);
  });

  it('cancellation with revoke=false → THROWS (previously swallowed by catch)', async () => {
    mockedRevoke.mockResolvedValue(false);

    await expect(
      handleSubscriptionDeleted(subscriptionEvent('customer.subscription.deleted')),
    ).rejects.toThrow(/VIP revocation failed/);
  });

  it('cancellation with revoke=true → resolves without recording a transaction', async () => {
    mockedRevoke.mockResolvedValue(true);

    await expect(
      handleSubscriptionDeleted(subscriptionEvent('customer.subscription.deleted')),
    ).resolves.toBeUndefined();
    expect(mockedRecord).not.toHaveBeenCalled();
  });
});
