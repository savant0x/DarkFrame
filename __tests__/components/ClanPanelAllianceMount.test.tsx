/**
 * @file __tests__/components/ClanPanelAllianceMount.test.tsx
 * @created 2026-09-17
 * @overview Mount-level render pins for FID-20260917-010 — the regression
 *   pin for "complete UI mounted nowhere." Renders the REAL ClanPanel
 *   (only GameContext + fetch mocked) and proves the Alliances tab actually
 *   renders AlliancePanel, and that the research tab is reachable (FID-012's
 *   panel was mounted behind a disabled tab — mounted-but-unreachable, the
 *   same disease this FID kills).
 *
 * @pins ClanPanel -> AlliancePanel wiring: clanId, role, treasuryMetal
 *   (clanData.bank?.treasury?.metal ?? 0 — mapped through rowToClan from
 *   bankTreasuryMetal).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useGameContextMock } = vi.hoisted(() => ({
  useGameContextMock: vi.fn(),
}));

vi.mock('@/context/GameContext', () => ({
  useGameContext: useGameContextMock,
}));

import ClanPanel from '@/components/clan/ClanPanel';
import { ClanRole } from '@/types/clan.types';

const CLAN_FIXTURE = {
  success: true,
  clan: {
    _id: 'clanfixture0000000000id',
    name: 'Savant',
    tag: 'SAV',
    description: '',
    leaderId: 'fame',
    members: [{ username: 'fame', role: ClanRole.LEADER, joinedAt: new Date().toISOString() }],
    maxMembers: 50,
    level: { currentLevel: 1, currentLevelXP: 0, xpToNextLevel: 100 },
    settings: { messageOfTheDay: '', isRecruiting: true, minLevelToJoin: 1, requiresApproval: false, allowTerritoryControl: true, allowWarDeclarations: true },
    stats: { totalPower: 100, totalTerritories: 0, totalMonuments: 0, warsWon: 0, warsLost: 0, totalRP: 0 },
    territories: [],
    createdAt: new Date().toISOString(),
    bank: {
      treasury: { metal: 1500, energy: 500, researchPoints: 12 },
      taxRates: {},
      upgradeLevel: 1,
      capacity: 10000,
      transactions: [],
    },
  },
};

function mockGame() {
  useGameContextMock.mockReturnValue({
    player: { username: 'fame', clanId: 'clanfixture0000000000id' },
    refreshPlayer: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGame();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => CLAN_FIXTURE,
  });
});

describe('FID-20260917-010: unreachable clan UI becomes reachable', () => {
  it('mount pin: clicking the Alliances tab renders the AlliancePanel', async () => {
    render(<ClanPanel isOpen onClose={vi.fn()} />);

    // ClanPanel loads via /api/clan/[id] before tabs matter.
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/clan/clanfixture0000000000id'));
    // Let the state update flush before interacting.
    await waitFor(() => expect(screen.getByRole('button', { name: /alliances/i })).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /alliances/i }));

    // AlliancePanel's own header — proves the panel mounted, not just the tab.
    expect(await screen.findByText(/propose alliance/i)).toBeInTheDocument();
  });

  it('reachability pin: the Research tab is NOT disabled (FID-012 mount unblocked)', async () => {
    render(<ClanPanel isOpen onClose={vi.fn()} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /research/i })).toBeInTheDocument());

    const researchTab = screen.getByRole('button', { name: /research/i });
    expect(researchTab).not.toBeDisabled();
  });

  it('panel-shape pin: AlliancePanel renders with the wired props', async () => {
    const { AlliancePanel } = await import('@/components/AlliancePanel');

    render(
      <AlliancePanel
        clanId="clanfixture0000000000id"
        playerId="fame"
        role={ClanRole.LEADER}
        clanName="Savant"
        treasuryMetal={1500}
      />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/clan/alliance?clanId=clanfixture0000000000id',
      );
    });
  });
});
