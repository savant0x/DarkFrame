'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WMDHub from '@/components/WMDHub';
import { useGameContext } from '@/context/GameContext';
import GameLayout from '@/components/GameLayout';
import { StatsPanel, ControlsPanel, TopNavBar } from '@/components';

interface WMDPageProps {
  embedded?: boolean;
}

export default function WMDPage({ embedded = false }: WMDPageProps = {}) {
  const { player } = useGameContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!player) {
      router.push('/login');
      return;
    }
    setLoading(false);
  }, [player, router]);

  if (loading) {
    return (
      <div className="bg-[--card] rounded-lg h-full overflow-hidden flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[--neon-pink] mx-auto mb-4"></div>
          <p className="text-white/60 text-lg">Loading WMD Systems...</p>
        </div>
      </div>
    );
  }

  if (embedded) {
    return <WMDHub />;
  }

  return (
    <>
      <TopNavBar onFriendsClick={() => {}} />
      <GameLayout
        statsPanel={<StatsPanel />}
        controlsPanel={<ControlsPanel />}
        tileView={
          <div className="h-full w-full overflow-auto bg-[--void]">
            <WMDHub />
          </div>
        }
      />
    </>
  );
}
