import { useEffect, useState } from 'react';

/** Battle summary from /api/stats/battles (FID-20260908-021). */
interface BattleStats {
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalBattles: number;
}

/** Recent battle record — shape matches lib/battleTrackingService's BattleRecord. */
interface RecentBattle {
  attacker: string;
  defender: string;
  winner: string;
  factoryLocation: { x: number; y: number };
  attackerPower: number;
  defenderPower: number;
  factoryCaptured: boolean;
  timestamp: Date;
  details: unknown;
}

export function useBattleStats(username: string) {
  const [stats, setStats] = useState<BattleStats>({ wins: 0, losses: 0, draws: 0, winRate: 0, totalBattles: 0 });
  const [recent, setRecent] = useState<RecentBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stats/battles?username=${encodeURIComponent(username)}`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setError('Failed to load stats'));
    fetch(`/api/stats/battles`)
      .then(res => res.json())
      .then(data => setRecent(data))
      .catch(() => setError('Failed to load recent battles'));
  }, [username]);

  return { stats, recent, loading, error };
}
