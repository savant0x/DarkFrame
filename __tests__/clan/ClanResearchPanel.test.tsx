/**
 * @file __tests__/clan/ClanResearchPanel.test.tsx
 * @created 2026-09-16
 * @overview Component pins for the FID-20260916-012 research panel: fund
 *            header, node states, presentational role gate, verbatim server
 *            errors, contribute request-body contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ClanResearchPanel from '@/components/clan/ClanResearchPanel';
import { ClanRole } from '@/types/clan.types';
import { showError } from '@/lib/toastService';

const fetchMock = vi.fn();

const NODE_UNLOCKED = {
  id: 'mil_tactics_1',
  name: 'Advanced Tactics',
  description: 'Coordinated unit maneuvers',
  branch: 'MILITARY',
  tier: 2,
  cost: 12000,
  requiredLevel: 8,
  prerequisites: ['mil_combat_1'],
  bonuses: [{ type: 'defense', value: 4 }],
  unlocked: true,
  available: false,
};

const NODE_AVAILABLE = {
  id: 'mil_combat_1',
  name: 'Combat Training',
  description: 'Basic combat drills improve attack effectiveness',
  branch: 'MILITARY',
  tier: 1,
  cost: 5000,
  requiredLevel: 5,
  prerequisites: [],
  bonuses: [{ type: 'attack', value: 5 }],
  unlocked: false,
  available: true,
};

const NODE_LOCKED = {
  id: 'mil_warmachine',
  name: 'War Machine',
  description: 'Heavy siege doctrine',
  branch: 'MILITARY',
  tier: 3,
  cost: 30000,
  requiredLevel: 12,
  prerequisites: ['mil_tactics_1'],
  bonuses: [{ type: 'attack', value: 10 }],
  unlocked: false,
  available: false,
};

const TREE = {
  INDUSTRIAL: [],
  MILITARY: [NODE_UNLOCKED, NODE_AVAILABLE, NODE_LOCKED],
  ECONOMIC: [],
  SOCIAL: [],
  clanLevel: 6,
  researchPoints: 7500,
};

function stateOk() {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ success: true, tree: TREE }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

vi.mock('@/lib/toastService', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

describe('ClanResearchPanel', () => {
  it('renders the fund header and all three node states', async () => {
    stateOk();
    render(<ClanResearchPanel clanId="clan_1" currentUserRole={ClanRole.LEADER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Fund: 7500 RP/)).toBeInTheDocument());
    expect(screen.getByText('Combat Training')).toBeInTheDocument();
    expect(screen.getByText('UNLOCKED')).toBeInTheDocument();
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
    expect(screen.getByText('LOCKED')).toBeInTheDocument();
  });

  it('shows an unlock button only on available nodes and disables it for non-officers', async () => {
    stateOk();
    render(<ClanResearchPanel clanId="clan_1" currentUserRole={ClanRole.MEMBER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByText('Combat Training')).toBeInTheDocument());

    const buttons = screen.getAllByRole('button', { name: /Unlock/ });
    expect(buttons).toHaveLength(1); // only the AVAILABLE node
    expect(buttons[0]).toBeDisabled(); // MEMBER cannot unlock (presentational)
  });

  it('enables unlock for officers and POSTs the researchId, then refreshes', async () => {
    stateOk();
    const onRefresh = vi.fn();
    render(<ClanResearchPanel clanId="clan_1" currentUserRole={ClanRole.OFFICER} onRefresh={onRefresh} />);
    await waitFor(() => expect(screen.getByText('Combat Training')).toBeInTheDocument());

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'Successfully unlocked Advanced Tactics' }),
    });
    stateOk(); // the post-unlock tree refresh

    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());

    const post = fetchMock.mock.calls.find((c) => c[0] === '/api/clan/research/unlock');
    expect(post).toBeDefined();
    expect(JSON.parse(post![1].body)).toEqual({ researchId: 'mil_combat_1' });
  });

  it('surfaces server refusals verbatim through the toast channel', async () => {
    stateOk();
    render(<ClanResearchPanel clanId="clan_1" currentUserRole={ClanRole.LEADER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByText('Combat Training')).toBeInTheDocument());

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: 'Insufficient research points' }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith('Insufficient research points'));
  });

  it('contribute POSTs a positive numeric amount as a number', async () => {
    stateOk();
    render(<ClanResearchPanel clanId="clan_1" currentUserRole={ClanRole.MEMBER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Fund: 7500 RP/)).toBeInTheDocument());

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'Successfully contributed 500 RP to clan research fund' }),
    });
    stateOk(); // post-contribute refresh

    fireEvent.change(screen.getByPlaceholderText('RP amount…'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Contribute' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => c[0] === '/api/clan/research/contribute');
      expect(post).toBeDefined();
      expect(JSON.parse(post![1].body)).toEqual({ amount: 500 });
    });
  });

  it('rejects non-positive contribution input client-side without a network call', async () => {
    stateOk();
    render(<ClanResearchPanel clanId="clan_1" currentUserRole={ClanRole.MEMBER} onRefresh={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Fund: 7500 RP/)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('RP amount…'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Contribute' }));

    expect(fetchMock.mock.calls.find((c) => c[0] === '/api/clan/research/contribute')).toBeUndefined();
  });
});
