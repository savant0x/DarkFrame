/**
 * FID-20260928-009 — RaidTelemetryPanel pins.
 *
 * The card is the visible face of the raid tuning loop (PVP_BASE_RAID_DESIGN
 * §4.6). Pins cover the states an admin can actually hit:
 *   - loading spinner on first fetch
 *   - error row (endpoint refusal / network) — never a crash
 *   - metrics render from a real payload (win rate %, loot, floor averages)
 *   - refusal pairs render attacker → defender with counts and reason
 *   - window switch re-fetches with the new windowHours
 * fetch is mocked at the global level (jsdom has no server); extractApiError
 * is the real implementation so error-path formatting stays honest.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RaidTelemetryPanel from './RaidTelemetryPanel';

const payload = {
  success: true,
  data: {
    windowHours: 168,
    outcomes: {
      totalRaids: 42,
      wins: 25,
      losses: 15,
      draws: 2,
      winRate: 25 / 40,
      lootMetal: 120_000,
      lootEnergy: 80_000,
      avgAttackerLosses: 4.5,
      avgDefenderLosses: 6.25,
      uniqueAttackers: 9,
      uniqueDefenders: 14,
    },
    refusalPairs: [
      { attacker: 'RaiderOne', defender: 'FarmerJoe', total: 7, topReason: 'Target is in an allied clan — the alliance forbids aggression' },
      { attacker: 'Griefer', defender: 'NewbiePat', total: 3, topReason: 'Target is in your clan — bases are not hostile within a clan' },
    ],
  },
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('FID-20260928-009: RaidTelemetryPanel', () => {
  it('renders the headline metrics from the endpoint payload', async () => {
    render(<RaidTelemetryPanel />);
    await waitFor(() => expect(screen.getByText('Raids')).toBeInTheDocument());
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('63%')).toBeInTheDocument(); // 25/40 → 62.5 → 63
    expect(screen.getByText('120,000')).toBeInTheDocument();
    expect(screen.getByText('6.25')).toBeInTheDocument(); // avg defender losses
    expect(screen.getByText('RaiderOne')).toBeInTheDocument();
    expect(screen.getByText('FarmerJoe')).toBeInTheDocument();
    expect(screen.getByText('×7')).toBeInTheDocument();
  });

  it('shows the top refusal reason verbatim (the §2 rule\u2019s own words)', async () => {
    render(<RaidTelemetryPanel />);
    await waitFor(() =>
      expect(screen.getByText(/allied clan — the alliance forbids aggression/)).toBeInTheDocument()
    );
  });

  it('renders the error row when the endpoint refuses (admin gate / server error)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, error: { code: 'ADMIN_ACCESS_REQUIRED', message: 'Admin privileges required' } }),
    });
    render(<RaidTelemetryPanel />);
    await waitFor(() => expect(screen.getByText(/Admin privileges required/i)).toBeInTheDocument());
    expect(screen.queryByText('Raids')).not.toBeInTheDocument();
  });

  it('degrades gracefully when the reader failed (outcomes null) — em-dashes, not a crash', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { windowHours: 168, outcomes: null, refusalPairs: [] } }),
    });
    render(<RaidTelemetryPanel />);
    await waitFor(() => expect(screen.getByText('Raids')).toBeInTheDocument());
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText('No hostility refusals in window.')).toBeInTheDocument();
  });

  it('switching the window re-fetches with the new windowHours', async () => {
    const user = userEvent.setup();
    render(<RaidTelemetryPanel />);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '30d' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/raid-telemetry?windowHours=720&limit=10')
    );
  });

  it('the refresh button re-fetches the current window', async () => {
    const user = userEvent.setup();
    render(<RaidTelemetryPanel />);
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /refresh raid telemetry/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/raid-telemetry?windowHours=168&limit=10')
    );
  });

  it('renders the empty-refusals state', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { ...payload.data, refusalPairs: [] } }),
    });
    render(<RaidTelemetryPanel />);
    await waitFor(() => expect(screen.getByText('No hostility refusals in window.')).toBeInTheDocument());
  });
});
