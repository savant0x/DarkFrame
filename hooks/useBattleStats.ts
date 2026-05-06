import { useEffect, useState } from 'react';

export function useBattleStats(username: string) {
  const [stats, setStats] = useState<any>({ wins: 0, losses: 0, draws: 0, winRate: 0, totalBattles: 0 });
  const [recent, setRecent] = useState<any[]>([]);
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
