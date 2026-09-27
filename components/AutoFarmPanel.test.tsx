/**
 * @file components/AutoFarmPanel.test.tsx
 * @created 2026-09-25
 * @overview Render pins for the AutoFarmPanel "Collected" block
 *   (FID-20260925-005): the session counters and the all-time summary must
 *   render what they are given, and the zero-state must read `0` — not blank.
 *   Host-agnostic by design (FID §8 limitation 3): every asserted figure is
 *   below 1,000 so no locale grouping separator can appear in a match.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutoFarmPanel from './AutoFarmPanel';
import {
  AutoFarmStatus,
  DEFAULT_SESSION_STATS,
  DEFAULT_ALL_TIME_STATS,
  type AutoFarmSessionStats,
  type AutoFarmAllTimeStats,
} from '@/types/autoFarm.types';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

const noop = () => undefined;

function renderPanel(
  sessionStats: AutoFarmSessionStats,
  allTimeStats: AutoFarmAllTimeStats
): ReturnType<typeof render> {
  return render(
    <AutoFarmPanel
      status={AutoFarmStatus.STOPPED}
      currentPosition={{ x: 3, y: 5 }}
      tilesCompleted={12}
      lastAction="Ready"
      isVIP={false}
      sessionStats={sessionStats}
      allTimeStats={allTimeStats}
      onStart={noop}
      onPause={noop}
      onResume={noop}
      onStop={noop}
    />
  );
}

describe('AutoFarmPanel Collected block (FID-20260925-005)', () => {
  it('shows the session figures it is given', () => {
    renderPanel(
      {
        ...DEFAULT_SESSION_STATS,
        metalCollected: 12,
        energyCollected: 4,
        caveItemsFound: 1,
        forestItemsFound: 2,
      },
      { ...DEFAULT_ALL_TIME_STATS }
    );
    expect(screen.getByText('Metal')).toBeInTheDocument();
    expect(screen.getByText('Energy')).toBeInTheDocument();
    expect(screen.getByText('Cave items')).toBeInTheDocument();
    expect(screen.getByText('Forest items')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders the all-time summary line through getStatsSummary', () => {
    renderPanel(
      { ...DEFAULT_SESSION_STATS },
      {
        ...DEFAULT_ALL_TIME_STATS,
        totalTimeElapsed: 2 * 60 * 60 * 1000,
        totalMetalCollected: 10,
        totalEnergyCollected: 20,
        totalSessionsCompleted: 3,
      }
    );
    // getStatsSummary: `${sessions} sessions | ${hours}h | ${resources} resources`
    expect(screen.getByText('3 sessions | 2h | 30 resources')).toBeInTheDocument();
  });

  it('reads 0 in the zero-state — never blank', () => {
    renderPanel({ ...DEFAULT_SESSION_STATS }, { ...DEFAULT_ALL_TIME_STATS });
    // Metal, Energy, Cave items, Forest items — each must render a real 0.
    expect(screen.getAllByText('0')).toHaveLength(4);
    expect(screen.getByText('0 sessions | 0h | 0 resources')).toBeInTheDocument();
  });
});
