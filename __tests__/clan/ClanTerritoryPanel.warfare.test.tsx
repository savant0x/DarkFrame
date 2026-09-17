/**
 * @file __tests__/clan/ClanTerritoryPanel.warfare.test.tsx
 * @created 2026-09-17
 * @overview Component pins for FID-20260916-013 §5.3 — the War Captures
 *            section of ClanTerritoryPanel: multi-war rendering (no war
 *            hidden), officer+ presentational gate, capture POST body
 *            contract, verbatim server toasts, daily-cap button disable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClanTerritoryPanel from '@/components/clan/ClanTerritoryPanel';
import { ClanRole } from '@/types/clan.types';
import { toast } from 'sonner';

const fetchMock = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const CLAN = {
  _id: 'clanA',
  name: 'Alpha',
  tag: 'AAA',
} as never; // panel reads only _id (+name/tag for display)

function targetsOk() {
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/clan/warfare/capture/targets')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          activeWars: [
            {
              warId: 'war-1',
              defenderClanId: 'clanB',
              defenderTag: 'BBB',
              capturesToday: 1,
              capturesCap: 3,
              targets: [
                { tileX: 5, tileY: 5, defenseBonus: 10 },
                { tileX: 7, tileY: 7, defenseBonus: 0 },
              ],
            },
            {
              warId: 'war-2',
              defenderClanId: 'clanC',
              defenderTag: 'CCC',
              capturesToday: 3,
              capturesCap: 3,
              targets: [{ tileX: 9, tileY: 9, defenseBonus: 0 }],
            },
          ],
        }),
      });
    }
    // territory list (existing section)
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ territories: [] }),
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  // FID §5 contract: capture is confirm-then-fire (treasury fee paid win or lose).
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  targetsOk();
});

describe('ClanTerritoryPanel — War Captures (FID-20260916-013)', () => {
  it('renders EVERY outgoing war — multiple wars are never collapsed to one', async () => {
    render(<ClanTerritoryPanel clan={CLAN} currentUserRole={ClanRole.LEADER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByText(/vs \[BBB\]/)).toBeInTheDocument());
    expect(screen.getByText(/vs \[CCC\]/)).toBeInTheDocument();
    // Per-war capture counters surface the daily cap.
    expect(screen.getByText(/Captures today: 1\/3/)).toBeInTheDocument();
    expect(screen.getByText(/Captures today: 3\/3/)).toBeInTheDocument();
  });

  it('shows guidance, not an error, when the clan has no outgoing wars', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/clan/warfare/capture/targets')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, activeWars: [] }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ territories: [] }) });
    });
    render(<ClanTerritoryPanel clan={CLAN} currentUserRole={ClanRole.LEADER} onRefresh={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText(/No active wars. Declare war/i)).toBeInTheDocument()
    );
  });

  it('hides capture buttons from non-officers but still shows the war', async () => {
    render(<ClanTerritoryPanel clan={CLAN} currentUserRole={ClanRole.MEMBER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByText(/vs \[BBB\]/)).toBeInTheDocument());
    // One note per rendered war — members see wars, just not capture buttons.
    expect(screen.getAllByText(/Only Officers and above can capture/i).length).toBeGreaterThan(0);
    expect(screen.queryByTitle(/Capture \(5, 5\)/)).not.toBeInTheDocument();
  });

  it('disables tile buttons once the daily capture cap is reached', async () => {
    render(<ClanTerritoryPanel clan={CLAN} currentUserRole={ClanRole.OFFICER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByTitle(/Capture \(9, 9\)/)).toBeInTheDocument());
    expect(screen.getByTitle(/Capture \(9, 9\)/)).toBeDisabled();
    // Under-cap war stays interactive.
    expect(screen.getByTitle(/Capture \(5, 5\)/)).toBeEnabled();
  });

  it('sends the capture POST contract and surfaces the server message verbatim', async () => {
    render(<ClanTerritoryPanel clan={CLAN} currentUserRole={ClanRole.OFFICER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByTitle(/Capture \(5, 5\)/)).toBeInTheDocument());

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          territory: { tileX: 5, tileY: 5, clanId: 'clanA' },
          defenseBonus: 10,
          message: 'Territory (5, 5) captured!',
        }),
      })
    );

    fireEvent.click(screen.getByTitle(/Capture \(5, 5\)/));

    // Confirm-then-fire: the win-or-lose fee requires explicit confirmation.
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('paid win or lose'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Territory (5, 5) captured!'));
    const post = fetchMock.mock.calls.find(
      ([url]) => url === '/api/clan/warfare/capture'
    );
    expect(post).toBeTruthy();
    const init = (post as unknown[])[1] as { body: string };
    expect(JSON.parse(init.body)).toMatchObject({
      targetClanId: 'clanB',
      tileX: 5,
      tileY: 5,
    });
  });

  it('toasts a repel as an error with the verbatim server message (A2 surface honesty)', async () => {
    render(<ClanTerritoryPanel clan={CLAN} currentUserRole={ClanRole.OFFICER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByTitle(/Capture \(5, 5\)/)).toBeInTheDocument());

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          defenseBonus: 40,
          message: 'Capture repelled — defense bonus 40% (attempt 2/3 today).',
        }),
      })
    );

    fireEvent.click(screen.getByTitle(/Capture \(5, 5\)/));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Capture repelled — defense bonus 40% (attempt 2/3 today).'
      )
    );
  });
});
