/**
 * @file app/wmd/page.tsx
 * @created 2025-10-22
 * @updated 2026-09-08 (FID-20260908-009: gated nn-spin loader, token void shell)
 * @overview WMD System Main Page
 *
 * OVERVIEW:
 * Main route for the Weapons of Mass Destruction system.
 * Protected by authentication middleware.
 *
 * Dependencies: /components/WMDHub, authentication
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WMDHub from '@/components/WMDHub';
import { useGameContext } from '@/context/GameContext';

export default function WMDPage() {
  const { player } = useGameContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    if (!player) {
      router.push('/login');
      return;
    }

    setLoading(false);
  }, [player, router]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8" style={{ background: 'var(--nn-void)' }}>
        <div className="text-center">
          <span
            className="nn-spin mx-auto mb-4"
            style={{
              width: 28,
              height: 28,
              border: '2px solid color-mix(in oklab, var(--nn-magenta) 40%, transparent)',
              borderBottomColor: 'transparent',
              animation: 'nn-spin 0.9s linear infinite',
              display: 'inline-block',
            }}
            aria-hidden
          />
          <p className="nn-lab">Loading WMD Systems…</p>
        </div>
      </div>
    );
  }

  return <WMDHub />;
}
