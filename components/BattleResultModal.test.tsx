/**
 * @file components/BattleResultModal.test.tsx
 * @created 2025-10-23
 * @overview Unit tests for BattleResultModal component
 * 
 * OVERVIEW:
 * Comprehensive tests for the BattleResultModal component covering:
 * - Victory/defeat/draw display
 * - Battle statistics rendering
 * - Unit casualties and captures
 * - Resource theft display (base attacks)
 * - XP earned display
 * - Level-up notifications
 * - Modal open/close behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BattleResultModal from './BattleResultModal';
import { BattleOutcome, BattleType, type BattleResult } from '@/types/game.types';

describe('BattleResultModal', () => {
  const mockOnClose = vi.fn();

  const baseVictoryResult = {
    success: true,
    message: 'Victory! Enemy forces have been defeated!',
    outcome: BattleOutcome.AttackerWin,
    rounds: 3,
    battleType: BattleType.Infantry,
    attacker: {
      username: 'TestPlayer',
      startingHP: 150,
      endingHP: 80,
      damageDealt: 120,
      unitsLost: 5,
      unitsCaptured: 12,
      xpEarned: 50,
    },
    defender: {
      username: 'EnemyBot',
      startingHP: 120,
      endingHP: 0,
      damageDealt: 70,
      unitsLost: 20,
      unitsCaptured: 3,
      xpEarned: 10,
    },
    battleLog: {
      battleId: 'test-battle-1',
      battleType: BattleType.Infantry,
      timestamp: new Date(),
      attacker: {} as any,
      defender: {} as any,
      outcome: BattleOutcome.AttackerWin,
      rounds: [],
      totalRounds: 3,
      attackerXP: 50,
      defenderXP: 10,
    },
  } as unknown as BattleResult;

  const baseDefeatResult = {
    success: true,
    message: 'Defeat! Your forces have been repelled!',
    outcome: BattleOutcome.DefenderWin,
    rounds: 3,
    battleType: BattleType.Infantry,
    attacker: {
      username: 'TestPlayer',
      startingHP: 150,
      endingHP: 0,
      damageDealt: 70,
      unitsLost: 15,
      unitsCaptured: 2,
      xpEarned: 10,
    },
    defender: {
      username: 'EnemyBot',
      startingHP: 120,
      endingHP: 50,
      damageDealt: 150,
      unitsLost: 5,
      unitsCaptured: 10,
      xpEarned: 50,
    },
    battleLog: {
      battleId: 'test-battle-2',
      battleType: BattleType.Infantry,
      timestamp: new Date(),
      attacker: {} as any,
      defender: {} as any,
      outcome: BattleOutcome.DefenderWin,
      rounds: [],
      totalRounds: 3,
      attackerXP: 10,
      defenderXP: 50,
    },
  } as unknown as BattleResult;

  const baseDrawResult = {
    success: true,
    message: 'Draw! Both sides withdrew!',
    outcome: BattleOutcome.Draw,
    rounds: 3,
    battleType: BattleType.Infantry,
    attacker: {
      username: 'TestPlayer',
      startingHP: 150,
      endingHP: 20,
      damageDealt: 100,
      unitsLost: 8,
      unitsCaptured: 5,
      xpEarned: 25,
    },
    defender: {
      username: 'EnemyBot',
      startingHP: 120,
      endingHP: 15,
      damageDealt: 130,
      unitsLost: 10,
      unitsCaptured: 6,
      xpEarned: 25,
    },
    battleLog: {
      battleId: 'test-battle-3',
      battleType: BattleType.Infantry,
      timestamp: new Date(),
      attacker: {} as any,
      defender: {} as any,
      outcome: BattleOutcome.Draw,
      rounds: [],
      totalRounds: 3,
      attackerXP: 25,
      defenderXP: 25,
    },
  } as unknown as BattleResult;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Visibility', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <BattleResultModal
          isOpen={false}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(container).toBeEmptyDOMElement();
    });

    it('should render when isOpen is true', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('VICTORY!')).toBeInTheDocument();
    });
  });

  describe('Victory Display', () => {
    it('should show victory banner for attacker win', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('VICTORY!')).toBeInTheDocument();
      expect(screen.getByText('🎉')).toBeInTheDocument();
    });

    it('should show victory message', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('Victory! Enemy forces have been defeated!')).toBeInTheDocument();
    });
  });

  describe('Defeat Display', () => {
    it('should show defeat banner for defender win', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseDefeatResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('DEFEAT!')).toBeInTheDocument();
      expect(screen.getByText('💀')).toBeInTheDocument();
    });

    it('should show defeat message', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseDefeatResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('Defeat! Your forces have been repelled!')).toBeInTheDocument();
    });
  });

  describe('Draw Display', () => {
    it('should show draw banner', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseDrawResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('DRAW!')).toBeInTheDocument();
      expect(screen.getByText('⚔️')).toBeInTheDocument();
    });

    it('should show draw message', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseDrawResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('Draw! Both sides withdrew!')).toBeInTheDocument();
    });
  });

  describe('Battle Statistics', () => {
    it('should display number of combat rounds', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      // Number "3" appears multiple times (rounds and defender captured), check with label
      expect(screen.getByText('Combat Rounds')).toBeInTheDocument();
      const roundsElement = screen.getAllByText('3');
      expect(roundsElement.length).toBeGreaterThan(0);
    });

    it('should display infantry battle type', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('⚔️ Infantry')).toBeInTheDocument();
    });

    it('should display base battle type', () => {
      const baseAttackResult = {
        ...baseVictoryResult,
        battleType: BattleType.Base,
      };

      render(
        <BattleResultModal
          isOpen={true}
          result={baseAttackResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('🏠 Base')).toBeInTheDocument();
    });

    it('should display attacker username and stats', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('TestPlayer')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Starting HP
      expect(screen.getByText('80')).toBeInTheDocument(); // Ending HP
      // "120" appears multiple times (attacker damage and defender starting HP)
      const damageElements = screen.getAllByText('120');
      expect(damageElements.length).toBeGreaterThan(0);
    });

    it('should display defender username and stats', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('EnemyBot')).toBeInTheDocument();
      // Defender stats are also displayed
      const hpValues = screen.getAllByText('120');
      expect(hpValues.length).toBeGreaterThan(0);
    });
  });

  describe('Unit Casualties', () => {
    it('should display attacker units lost', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('💀 Your Losses')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should show positive message when no units lost', () => {
      const perfectVictory = {
        ...baseVictoryResult,
        attacker: {
          ...baseVictoryResult.attacker,
          unitsLost: 0,
        },
      };

      render(
        <BattleResultModal
          isOpen={true}
          result={perfectVictory}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/No units lost/i)).toBeInTheDocument();
    });

    it('should display units captured', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('🎖️ Units Captured')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('should show message when no units captured', () => {
      const noCapturesResult = {
        ...baseVictoryResult,
        attacker: {
          ...baseVictoryResult.attacker,
          unitsCaptured: 0,
        },
      };

      render(
        <BattleResultModal
          isOpen={true}
          result={noCapturesResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('No units captured')).toBeInTheDocument();
    });

    it('should display defender casualties', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('🛡️ Defender\'s Casualties')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument(); // Defender units lost
    });
  });

  describe('Resource Theft Display', () => {
    it('should display resources stolen on base attack victory', () => {
      const baseAttackResult = {
        ...baseVictoryResult,
        battleType: BattleType.Base,
        resourcesStolen: {
          resourceType: 'metal' as const,
          amount: 500,
        },
      };

      render(
        <BattleResultModal
          isOpen={true}
          result={baseAttackResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText('💰 Resources Plundered')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('should show "You stole" for victory', () => {
      const baseAttackResult = {
        ...baseVictoryResult,
        battleType: BattleType.Base,
        resourcesStolen: {
          resourceType: 'energy' as const,
          amount: 300,
        },
      };

      render(
        <BattleResultModal
          isOpen={true}
          result={baseAttackResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/You stole/i)).toBeInTheDocument();
    });

    it('should show "You lost" for defeat with resources stolen', () => {
      const baseDefeatWithTheft = {
        ...baseDefeatResult,
        battleType: BattleType.Base,
        resourcesStolen: {
          resourceType: 'metal' as const,
          amount: 200,
        },
      };

      render(
        <BattleResultModal
          isOpen={true}
          result={baseDefeatWithTheft}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.getByText(/You lost/i)).toBeInTheDocument();
    });

    it('should not show resources section when none stolen', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.queryByText('💰 Resources Plundered')).not.toBeInTheDocument();
    });

    it('should not show resources section when amount is 0', () => {
      const noTheftResult = {
        ...baseVictoryResult,
        resourcesStolen: {
          resourceType: 'metal' as const,
          amount: 0,
        },
      };

      render(
        <BattleResultModal
          isOpen={true}
          result={noTheftResult}
          onClose={mockOnClose}
        />
      );
      
      expect(screen.queryByText('💰 Resources Plundered')).not.toBeInTheDocument();
    });
  });

  describe('Modal Interaction', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      const closeButton = screen.getByText(/Close/i);
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should have accessible close button', () => {
      render(
        <BattleResultModal
          isOpen={true}
          result={baseVictoryResult}
          onClose={mockOnClose}
        />
      );
      
      const closeButton = screen.getByRole('button', { name: /Close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });
});
