/**
 * @file __tests__/components/PlayerLogPanel.test.tsx
 * @created 2026-09-17
 * @overview Component tests for PlayerLogPanel (FID-20260917-004) —
 *   first client consumer of GET /api/logs/player/[id].
 * @pins Route contract: PLAIN JSON response (no success envelope),
 *   { activityLogs?, battleLogs?, combatStats?, pagination }.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerLogPanel from '@/components/PlayerLogPanel';

global.fetch = vi.fn();
const mockFetch = global.fetch as Mock;

const ACTIVITY_ENTRY = {
  _id: 'act1',
  actionType: 'factory_collect',
  timestamp: '2026-09-17T10:00:00.000Z',
  success: true,
};

const BATTLE_ENTRY = {
  _id: 'bat1',
  battleId: 'b-1',
  timestamp: '2026-09-17T11:00:00.000Z',
  attackerUsername: 'player1',
  defenderUsername: 'rival',
  tileX: 5,
  tileY: 7,
  outcome: 'attacker_win',
  winner: 'player1',
};

function jsonResponse(data: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 403,
    json: vi.fn().mockResolvedValue(data),
  };
}

describe('PlayerLogPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an activity entry from the plain-JSON route response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      playerId: 'player1',
      activityLogs: [ACTIVITY_ENTRY],
      activityCount: 1,
      pagination: { limit: 100, offset: 0 },
    }));

    render(<PlayerLogPanel username="player1" />);

    await waitFor(() => {
      expect(screen.getByText(/factory collect/i)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/logs/player/player1?type=all&limit=100',
    );
  });

  it('renders a battle entry with its outcome', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      playerId: 'player1',
      battleLogs: [BATTLE_ENTRY],
      battleCount: 1,
      combatStats: { totalBattles: 1, battlesWon: 1, battlesLost: 0 },
      pagination: { limit: 100, offset: 0 },
    }));

    render(<PlayerLogPanel username="player1" />);

    await waitFor(() => {
      expect(screen.getByText(/player1 vs rival/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/attacker won/i)).toBeInTheDocument();
    // Combat stats wells: battles=1, won=1, lost=0 — assert via labeled scopes.
    expect(screen.getByText(/battles/i, { selector: '.nn-stat__lab' })).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // the distinct lost count
  });

  it('renders the failed-activity error code path', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      playerId: 'player1',
      activityLogs: [{ ...ACTIVITY_ENTRY, _id: 'act2', success: false, errorCode: 'INSUFFICIENT_RESOURCES' }],
      activityCount: 1,
      pagination: { limit: 100, offset: 0 },
    }));

    render(<PlayerLogPanel username="player1" />);

    await waitFor(() => {
      expect(screen.getByText(/INSUFFICIENT_RESOURCES/)).toBeInTheDocument();
    });
  });

  it('renders the error state on non-OK responses', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'You can only view your own logs' }, false));

    render(<PlayerLogPanel username="rival" />);

    await waitFor(() => {
      expect(screen.getByText(/you can only view your own logs/i)).toBeInTheDocument();
    });
  });

  it('renders the empty state when both halves are absent', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      playerId: 'player1',
      pagination: { limit: 100, offset: 0 },
    }));

    render(<PlayerLogPanel username="player1" />);

    await waitFor(() => {
      expect(screen.getByText(/no log entries recorded yet/i)).toBeInTheDocument();
    });
  });

  it('refetches when the log type tab changes', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue(jsonResponse({
      playerId: 'player1',
      activityLogs: [ACTIVITY_ENTRY],
      activityCount: 1,
      pagination: { limit: 100, offset: 0 },
    }));

    render(<PlayerLogPanel username="player1" />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'battle' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/logs/player/player1?type=battle&limit=100');
    });
  });
});
