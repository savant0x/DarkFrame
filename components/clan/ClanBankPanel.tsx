/**
 * @file components/clan/ClanBankPanel.tsx
 * @created 2025-10-19
 * @overview Clan banking interface with deposit/withdraw operations
 * 
 * OVERVIEW:
 * Comprehensive clan bank management providing:
 * - Treasury balance display (Metal, Energy, RP)
 * - Deposit interface for contributing resources
 * - Withdraw interface (leader/officer only)
 * - Transaction history viewer
 * - Tax rate display and settings
 * - Bank capacity and upgrade status
 * 
 * IMPLEMENTATION NOTES:
 * - FID-20251019-001: Phase 2 - Management & Banking UI
 * - Permission-based withdraw access
 * - Input validation for amounts
 * - Real-time balance updates
 */

'use client';

import React, { useState } from 'react';
import { getErrorMessage } from '@/lib/errorMessage';

import {
  Coins,
  Zap,
  Beaker,
  TrendingUp,
  TrendingDown,
  Wallet,
  Lock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { Clan, ClanRole } from '@/types/clan.types';
import { ROLE_PERMISSIONS } from '@/types/clan.types';

interface ClanBankPanelProps {
  clan: Clan;
  currentUserRole: ClanRole;
  playerResources: {
    metal: number;
    energy: number;
    researchPoints: number;
  };
  onRefresh: () => void;
}

export default function ClanBankPanel({
  clan,
  currentUserRole,
  playerResources,
  onRefresh
}: ClanBankPanelProps) {
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  // Deposit amounts
  const [depositMetal, setDepositMetal] = useState(0);
  const [depositEnergy, setDepositEnergy] = useState(0);
  const [depositRP, setDepositRP] = useState(0);
  
  // Withdraw amounts
  const [withdrawMetal, setWithdrawMetal] = useState(0);
  const [withdrawEnergy, setWithdrawEnergy] = useState(0);
  const [withdrawRP, setWithdrawRP] = useState(0);

  // Get current user's permissions
  const permissions = ROLE_PERMISSIONS[currentUserRole];

  /**
   * Handles depositing resources to clan bank
   */
  const handleDeposit = async () => {
    if (depositMetal <= 0 && depositEnergy <= 0 && depositRP <= 0) {
      toast.error('Please enter amount to deposit');
      return;
    }

    if (depositMetal > playerResources.metal) {
      toast.error('Insufficient metal');
      return;
    }

    if (depositEnergy > playerResources.energy) {
      toast.error('Insufficient energy');
      return;
    }

    if (depositRP > playerResources.researchPoints) {
      toast.error('Insufficient research points');
      return;
    }

    setIsDepositing(true);
    try {
      const response = await fetch('/api/clan/bank/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId: clan._id?.toString(),
          metal: depositMetal,
          energy: depositEnergy,
          researchPoints: depositRP
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to deposit');
      }

      toast.success('Resources deposited successfully');
      setDepositMetal(0);
      setDepositEnergy(0);
      setDepositRP(0);
      onRefresh();
    } catch (error) {
      console.error('Error depositing:', error);
      toast.error(getErrorMessage(error) || 'Failed to deposit resources');
    } finally {
      setIsDepositing(false);
    }
  };

  /**
   * Handles withdrawing resources from clan bank
   */
  const handleWithdraw = async () => {
    if (!permissions.canWithdrawFromBank) {
      toast.error('You do not have permission to withdraw');
      return;
    }

    if (withdrawMetal <= 0 && withdrawEnergy <= 0 && withdrawRP <= 0) {
      toast.error('Please enter amount to withdraw');
      return;
    }

    if (withdrawMetal > clan.bank.treasury.metal) {
      toast.error('Insufficient clan metal');
      return;
    }

    if (withdrawEnergy > clan.bank.treasury.energy) {
      toast.error('Insufficient clan energy');
      return;
    }

    if (withdrawRP > clan.research.researchPoints) {
      toast.error('Insufficient clan RP');
      return;
    }

    setIsWithdrawing(true);
    try {
      const response = await fetch('/api/clan/bank/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId: clan._id?.toString(),
          metal: withdrawMetal,
          energy: withdrawEnergy,
          researchPoints: withdrawRP
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to withdraw');
      }

      toast.success('Resources withdrawn successfully');
      setWithdrawMetal(0);
      setWithdrawEnergy(0);
      setWithdrawRP(0);
      onRefresh();
    } catch (error) {
      console.error('Error withdrawing:', error);
      toast.error(getErrorMessage(error) || 'Failed to withdraw resources');
    } finally {
      setIsWithdrawing(false);
    }
  };

  /**
   * Sets deposit amount to max available
   */
  const setDepositMax = (resource: 'metal' | 'energy' | 'rp') => {
    switch (resource) {
      case 'metal':
        setDepositMetal(playerResources.metal);
        break;
      case 'energy':
        setDepositEnergy(playerResources.energy);
        break;
      case 'rp':
        setDepositRP(playerResources.researchPoints);
        break;
    }
  };

  /**
   * Sets withdraw amount to max available
   */
  const setWithdrawMax = (resource: 'metal' | 'energy' | 'rp') => {
    switch (resource) {
      case 'metal':
        setWithdrawMetal(clan.bank.treasury.metal);
        break;
      case 'energy':
        setWithdrawEnergy(clan.bank.treasury.energy);
        break;
      case 'rp':
        setWithdrawRP(clan.research.researchPoints);
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Treasury Overview */}
      <div>
        <h3 className="text-lg font-bold text-[color:var(--nn-text-primary)] flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-[color:var(--nn-amber)]" />
          Clan Treasury
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          {/* Metal */}
          <div className="nn-surface rounded-none p-4 border border-[color:var(--nn-glass-border)]">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 nn-text-secondary" />
              <span className="text-xs nn-text-secondary">Metal</span>
            </div>
            <div className="text-2xl font-bold text-[color:var(--nn-text-primary)]">
              {clan.bank.treasury.metal.toLocaleString()}
            </div>
          </div>

          {/* Energy */}
          <div className="nn-surface rounded-none p-4 border border-[color:var(--nn-glass-border)]">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-[color:var(--nn-cyan)]" />
              <span className="text-xs nn-text-secondary">Energy</span>
            </div>
            <div className="text-2xl font-bold text-[color:var(--nn-text-primary)]">
              {clan.bank.treasury.energy.toLocaleString()}
            </div>
          </div>

          {/* Research Points */}
          <div className="nn-surface rounded-none p-4 border border-[color:var(--nn-glass-border)]">
            <div className="flex items-center gap-2 mb-2">
              <Beaker className="w-4 h-4 text-[color:var(--nn-violet)]" />
              <span className="text-xs nn-text-secondary">RP</span>
            </div>
            <div className="text-2xl font-bold text-[color:var(--nn-text-primary)]">
              {clan.research.researchPoints.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Bank Info */}
        <div className="mt-3 text-xs nn-text-secondary">
          Bank Level: {clan.bank.upgradeLevel} | Capacity: {clan.bank.capacity.toLocaleString()}
        </div>
      </div>

      {/* Deposit Section */}
      <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-4">
        <h4 className="text-sm font-semibold text-[color:var(--nn-text-primary)] flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[color:var(--nn-green)]" />
          Deposit Resources
        </h4>

        <div className="space-y-3">
          {/* Metal Deposit */}
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 nn-text-secondary flex-shrink-0" />
            <input
              type="number"
              value={depositMetal || ''}
              onChange={(e) => setDepositMetal(parseInt(e.target.value) || 0)}
              placeholder="Metal"
              min={0}
              max={playerResources.metal}
              className="nn-input flex-1"
             />
            <button className="nn-btn"
              onClick={() => setDepositMax('metal')} >
              Max
            </button>
          </div>

          {/* Energy Deposit */}
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[color:var(--nn-cyan)] flex-shrink-0" />
            <input
              type="number"
              value={depositEnergy || ''}
              onChange={(e) => setDepositEnergy(parseInt(e.target.value) || 0)}
              placeholder="Energy"
              min={0}
              max={playerResources.energy}
              className="nn-input flex-1"
             />
            <button className="nn-btn"
              onClick={() => setDepositMax('energy')} >
              Max
            </button>
          </div>

          {/* RP Deposit */}
          <div className="flex items-center gap-2">
            <Beaker className="w-4 h-4 text-[color:var(--nn-violet)] flex-shrink-0" />
            <input
              type="number"
              value={depositRP || ''}
              onChange={(e) => setDepositRP(parseInt(e.target.value) || 0)}
              placeholder="Research Points"
              min={0}
              max={playerResources.researchPoints}
              className="nn-input flex-1"
             />
            <button className="nn-btn"
              onClick={() => setDepositMax('rp')} >
              Max
            </button>
          </div>

          {/* Deposit Button */}
          <button className="nn-btn nn-btn--primary"
            onClick={handleDeposit} disabled={isDepositing || (depositMetal <= 0 && depositEnergy <= 0 && depositRP <= 0)} >
            Deposit to Clan Bank
          </button>
        </div>

        <div className="mt-2 text-xs nn-text-secondary">
          Your Balance: {playerResources.metal.toLocaleString()} Metal | {playerResources.energy.toLocaleString()} Energy | {playerResources.researchPoints} RP
        </div>
      </div>

      {/* Withdraw Section */}
      <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4">
        <h4 className="text-sm font-semibold text-[color:var(--nn-text-primary)] flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-[color:var(--nn-magenta)]" />
          Withdraw Resources
          {!permissions.canWithdrawFromBank && (
            <span title="Requires permission">
              <Lock className="w-3 h-3 nn-text-secondary" />
            </span>
          )}
        </h4>

        {!permissions.canWithdrawFromBank ? (
          <div className="nn-surface rounded-none p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[color:var(--nn-amber)] flex-shrink-0 mt-0.5" />
            <p className="text-xs nn-text-secondary">
              You do not have permission to withdraw from the clan bank. Only Leaders and Officers can withdraw resources.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Metal Withdraw */}
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 nn-text-secondary flex-shrink-0" />
              <input
                type="number"
                value={withdrawMetal || ''}
                onChange={(e) => setWithdrawMetal(parseInt(e.target.value) || 0)}
                placeholder="Metal"
                min={0}
                max={clan.bank.treasury.metal}
                className="nn-input flex-1"
               />
              <button className="nn-btn"
                onClick={() => setWithdrawMax('metal')} >
                Max
              </button>
            </div>

            {/* Energy Withdraw */}
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[color:var(--nn-cyan)] flex-shrink-0" />
              <input
                type="number"
                value={withdrawEnergy || ''}
                onChange={(e) => setWithdrawEnergy(parseInt(e.target.value) || 0)}
                placeholder="Energy"
                min={0}
                max={clan.bank.treasury.energy}
                className="nn-input flex-1"
               />
              <button className="nn-btn"
                onClick={() => setWithdrawMax('energy')} >
                Max
              </button>
            </div>

            {/* RP Withdraw */}
            <div className="flex items-center gap-2">
              <Beaker className="w-4 h-4 text-[color:var(--nn-violet)] flex-shrink-0" />
              <input
                type="number"
                value={withdrawRP || ''}
                onChange={(e) => setWithdrawRP(parseInt(e.target.value) || 0)}
                placeholder="Research Points"
                min={0}
                max={clan.research.researchPoints}
                className="nn-input flex-1"
               />
              <button className="nn-btn"
                onClick={() => setWithdrawMax('rp')} >
                Max
              </button>
            </div>

            {/* Withdraw Button */}
            <button className="nn-btn nn-btn--danger"
              onClick={handleWithdraw} disabled={isWithdrawing || (withdrawMetal <= 0 && withdrawEnergy <= 0 && withdrawRP <= 0)} >
              Withdraw from Clan Bank
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * - Deposit available to all members with canContributeResources permission
 * - Withdraw restricted to canWithdrawFromBank permission (Leaders/Officers)
 * - Input validation prevents over-contribution/over-withdrawal
 * - Max buttons for convenience
 * - Real-time balance display
 * - Toast notifications for user feedback
 * 
 * FUTURE ENHANCEMENTS (Phase 2 continuation):
 * - Transaction history viewer with pagination
 * - Tax rate management interface
 * - Bank upgrade controls
 * - Fund distribution modal integration
 * - Contribution leaderboard (top contributors)
 */
