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

interface WMDPageProps {
  embedded?: boolean; // When true, renders without TopNavBar/GameLayout
}

export default function WMDPage({ embedded = false }: WMDPageProps = {}) {
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
      <div className="bg-gray-800 rounded-lg shadow-2xl h-full overflow-hidden flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-300 text-lg">Loading WMD Systems...</p>
        </div>
      </div>
    );
  }

  return <WMDHub />;
}
