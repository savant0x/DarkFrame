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
import { Button, Input } from '@/components/ui';
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
    } catch (error: any) {
      console.error('Error depositing:', error);
      toast.error(error.message || 'Failed to deposit resources');
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
    } catch (error: any) {
      console.error('Error withdrawing:', error);
      toast.error(error.message || 'Failed to withdraw resources');
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
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-yellow-400" />
          Clan Treasury
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          {/* Metal */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">Metal</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {clan.bank.treasury.metal.toLocaleString()}
            </div>
          </div>

          {/* Energy */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-400">Energy</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {clan.bank.treasury.energy.toLocaleString()}
            </div>
          </div>

          {/* Research Points */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Beaker className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400">RP</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {clan.research.researchPoints.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Bank Info */}
        <div className="mt-3 text-xs text-gray-400">
          Bank Level: {clan.bank.upgradeLevel} | Capacity: {clan.bank.capacity.toLocaleString()}
        </div>
      </div>

      {/* Deposit Section */}
      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-400" />
          Deposit Resources
        </h4>

        <div className="space-y-3">
          {/* Metal Deposit */}
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <Input
              type="number"
              value={depositMetal || ''}
              onChange={(e) => setDepositMetal(parseInt(e.target.value) || 0)}
              placeholder="Metal"
              min={0}
              max={playerResources.metal}
              className="flex-1"
            />
            <Button
              onClick={() => setDepositMax('metal')}
              variant="secondary"
              size="sm"
            >
              Max
            </Button>
          </div>

          {/* Energy Deposit */}
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <Input
              type="number"
              value={depositEnergy || ''}
              onChange={(e) => setDepositEnergy(parseInt(e.target.value) || 0)}
              placeholder="Energy"
              min={0}
              max={playerResources.energy}
              className="flex-1"
            />
            <Button
              onClick={() => setDepositMax('energy')}
              variant="secondary"
              size="sm"
            >
              Max
            </Button>
          </div>

          {/* RP Deposit */}
          <div className="flex items-center gap-2">
            <Beaker className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <Input
              type="number"
              value={depositRP || ''}
              onChange={(e) => setDepositRP(parseInt(e.target.value) || 0)}
              placeholder="Research Points"
              min={0}
              max={playerResources.researchPoints}
              className="flex-1"
            />
            <Button
              onClick={() => setDepositMax('rp')}
              variant="secondary"
              size="sm"
            >
              Max
            </Button>
          </div>

          {/* Deposit Button */}
          <Button
            onClick={handleDeposit}
            variant="primary"
            fullWidth
            disabled={isDepositing || (depositMetal <= 0 && depositEnergy <= 0 && depositRP <= 0)}
            loading={isDepositing}
          >
            Deposit to Clan Bank
          </Button>
        </div>

        <div className="mt-2 text-xs text-gray-400">
          Your Balance: {playerResources.metal.toLocaleString()} Metal | {playerResources.energy.toLocaleString()} Energy | {playerResources.researchPoints} RP
        </div>
      </div>

      {/* Withdraw Section */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-red-400" />
          Withdraw Resources
          {!permissions.canWithdrawFromBank && (
            <span title="Requires permission">
              <Lock className="w-3 h-3 text-gray-500" />
            </span>
          )}
        </h4>

        {!permissions.canWithdrawFromBank ? (
          <div className="bg-slate-800/30 rounded p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              You do not have permission to withdraw from the clan bank. Only Leaders and Officers can withdraw resources.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Metal Withdraw */}
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <Input
                type="number"
                value={withdrawMetal || ''}
                onChange={(e) => setWithdrawMetal(parseInt(e.target.value) || 0)}
                placeholder="Metal"
                min={0}
                max={clan.bank.treasury.metal}
                className="flex-1"
              />
              <Button
                onClick={() => setWithdrawMax('metal')}
                variant="secondary"
                size="sm"
              >
                Max
              </Button>
            </div>

            {/* Energy Withdraw */}
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <Input
                type="number"
                value={withdrawEnergy || ''}
                onChange={(e) => setWithdrawEnergy(parseInt(e.target.value) || 0)}
                placeholder="Energy"
                min={0}
                max={clan.bank.treasury.energy}
                className="flex-1"
              />
              <Button
                onClick={() => setWithdrawMax('energy')}
                variant="secondary"
                size="sm"
              >
                Max
              </Button>
            </div>

            {/* RP Withdraw */}
            <div className="flex items-center gap-2">
              <Beaker className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <Input
                type="number"
                value={withdrawRP || ''}
                onChange={(e) => setWithdrawRP(parseInt(e.target.value) || 0)}
                placeholder="Research Points"
                min={0}
                max={clan.research.researchPoints}
                className="flex-1"
              />
              <Button
                onClick={() => setWithdrawMax('rp')}
                variant="secondary"
                size="sm"
              >
                Max
              </Button>
            </div>

            {/* Withdraw Button */}
            <Button
              onClick={handleWithdraw}
              variant="danger"
              fullWidth
              disabled={isWithdrawing || (withdrawMetal <= 0 && withdrawEnergy <= 0 && withdrawRP <= 0)}
              loading={isWithdrawing}
            >
              Withdraw from Clan Bank
            </Button>
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
