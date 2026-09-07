/**
 * @file app/wmd/page.tsx
 * @created 2025-10-22
 * @overview WMD System Main Page
 * 
 * OVERVIEW:
 * Main route for the Weapons of Mass Destruction system.
 * Protected by authentication middleware.
 * 
 * Features:
 * - Full-screen WMD Hub interface
 * - Authentication requirement
 * - Error boundary protection
 * - Loading states
 * - Metadata for SEO
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

    // Check minimum level requirement (optional - adjust as needed)
    // if (player.level < 10) {
    //   alert('You must be level 10 or higher to access WMD systems');
    //   router.push('/game');
    //   return;
    // }

    setLoading(false);
  }, [player, router]);

  if (loading) {
    return (
      <div className="nn-panel flex h-full items-center justify-center overflow-hidden p-8">
        <div className="text-center">
          <div className="animate-spin mx-auto mb-4 h-14 w-14 rounded-none border-2 border-t-0 border-[color-mix(in_oklab,var(--nn-magenta)_45%,transparent)]"></div>
          <p className="nn-lab">Loading WMD Systems...</p>
        </div>
      </div>
    );
  }

  return <WMDHub />;
}
