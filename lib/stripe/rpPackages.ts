/**
 * FID-20260919-010: the RP package catalog — single source of truth.
 *
 * The shop page (app/shop/rp-packages) imports this map for display, and the
 * server imports it for charging + granting. The client sends only `packageId`
 * — the RP amount and price are always resolved server-side from this map, so
 * no client-supplied amount ever exists in the API surface.
 */
export interface RPPackage {
  id: string;
  name: string;
  rp: number;
  /** Price in USD cents (Stripe unit_amount). */
  priceCents: number;
}

export const RP_PACKAGES: RPPackage[] = [
  { id: 'starter', name: 'Starter Pack', rp: 1_000, priceCents: 299 },
  { id: 'boost', name: 'Progress Boost', rp: 5_000, priceCents: 999 },
  { id: 'power', name: 'Power Pack', rp: 15_000, priceCents: 2499 },
  { id: 'mega', name: 'Mega Bundle', rp: 50_000, priceCents: 5999 },
  { id: 'legendary', name: 'Legendary Bundle', rp: 100_000, priceCents: 9999 },
];

export function getRPPackage(id: string): RPPackage | undefined {
  return RP_PACKAGES.find((p) => p.id === id);
}
