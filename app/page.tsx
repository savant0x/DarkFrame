/**
 * @file app/page.tsx
 * @created 2025-10-16
 * @overview Homepage - redirects to login or game
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';

export default function HomePage() {
  const { player, isLoading } = useGameContext();
  const router = useRouter();

  useEffect(() => {
    // Wait for session check to complete before redirecting
    if (isLoading) {
      return; // Still checking session, don't redirect yet
    }
    
    if (player) {
      router.push('/game');
    } else {
      router.push('/login');
    }
  }, [player, isLoading, router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-400 mb-2">DarkFrame</h1>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
