/**
 * @file components/BankPanel.tsx
 * @created 2025-10-17
 * @overview Bank interface for deposits, withdrawals, and resource exchange
 * 
 * OVERVIEW:
 * Modal panel that displays when player is at a Bank tile. Provides three tabs:
 * 1. Deposit - Store resources with 1,000 unit fee
 * 2. Withdraw - Retrieve stored resources (no fee)
 * 3. Exchange - Convert Metal ↔ Energy with 20% fee
 */

'use client';

import { useState } from 'react';
import { BankStorage, Resources } from '@/types';

interface BankPanelProps {
  isOpen: boolean;
  onClose: () => void;
  playerResources: Resources;
  bankStorage: BankStorage;
  bankType: 'metal' | 'energy' | 'exchange';
  onTransaction: () => void;
}

type TabType = 'deposit' | 'withdraw' | 'exchange';

export default function BankPanel({
  isOpen,
  onClose,
  playerResources,
  bankStorage,
  bankType,
  onTransaction
}: BankPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('deposit');
  const [amount, setAmount] = useState('');
  const [resourceType, setResourceType] = useState<'metal' | 'energy'>('metal');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleDeposit = async () => {
    const depositAmount = parseInt(amount);
    if (!depositAmount || depositAmount <= 0) {
      setMessage('Enter a valid amount');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/bank/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType, amount: depositAmount })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        setAmount('');
        onTransaction();
      } else {
        setMessage(data.message || 'Deposit failed');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseInt(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      setMessage('Enter a valid amount');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/bank/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType, amount: withdrawAmount })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        setAmount('');
        onTransaction();
      } else {
        setMessage(data.message || 'Withdrawal failed');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleExchange = async () => {
    const exchangeAmount = parseInt(amount);
    if (!exchangeAmount || exchangeAmount <= 0) {
      setMessage('Enter a valid amount');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/bank/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromResource: resourceType, amount: exchangeAmount })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        setAmount('');
        onTransaction();
      } else {
        setMessage(data.message || 'Exchange failed');
      }
    } catch (error) {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleMaxAmount = () => {
    if (activeTab === 'deposit') {
      const available = playerResources[resourceType];
      const maxDeposit = available > 1000 ? available - 1000 : 0;
      setAmount(maxDeposit.toString());
    } else if (activeTab === 'withdraw') {
      const available = bankStorage[resourceType];
      setAmount(available.toString());
    } else {
      const available = playerResources[resourceType];
      setAmount(available.toString());
    }
  };

  const calculateReceived = () => {
    const inputAmount = parseInt(amount) || 0;
    
    if (activeTab === 'deposit') {
      return inputAmount; // After 1K fee is deducted
    } else if (activeTab === 'withdraw') {
      return inputAmount; // No fee
    } else {
      return Math.floor(inputAmount * 0.80); // 20% exchange fee
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border-2 border-yellow-500 rounded-lg p-6 w-[500px] max-h-[600px] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-400">
            🏦 {bankType === 'metal' ? 'Metal Bank' : bankType === 'energy' ? 'Energy Bank' : 'Exchange Bank'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Bank Info */}
        <div className="bg-gray-700 p-3 rounded mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Inventory</p>
              <p className="text-white">⚙️ {playerResources.metal.toLocaleString()} Metal</p>
              <p className="text-white">⚡ {playerResources.energy.toLocaleString()} Energy</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Bank Storage</p>
              <p className="text-white">⚙️ {bankStorage.metal.toLocaleString()} Metal</p>
              <p className="text-white">⚡ {bankStorage.energy.toLocaleString()} Energy</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-2 px-4 rounded ${
              activeTab === 'deposit'
                ? 'bg-yellow-500 text-black font-bold'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Deposit
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-2 px-4 rounded ${
              activeTab === 'withdraw'
                ? 'bg-yellow-500 text-black font-bold'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Withdraw
          </button>
          {bankType === 'exchange' && (
            <button
              onClick={() => setActiveTab('exchange')}
              className={`flex-1 py-2 px-4 rounded ${
                activeTab === 'exchange'
                  ? 'bg-yellow-500 text-black font-bold'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Exchange
            </button>
          )}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Resource Type Selector */}
          <div>
            <label className="block text-gray-300 mb-2">Resource Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setResourceType('metal')}
                className={`flex-1 py-2 px-4 rounded ${
                  resourceType === 'metal'
                    ? 'bg-gray-600 text-white border-2 border-yellow-500'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                ⚙️ Metal
              </button>
              <button
                onClick={() => setResourceType('energy')}
                className={`flex-1 py-2 px-4 rounded ${
                  resourceType === 'energy'
                    ? 'bg-gray-600 text-white border-2 border-yellow-500'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                ⚡ Energy
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-gray-300 mb-2">Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-yellow-500 focus:outline-none"
                placeholder="Enter amount"
                min="0"
              />
              <button
                onClick={handleMaxAmount}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Preview */}
          {amount && parseInt(amount) > 0 && (
            <div className="bg-gray-700 p-3 rounded">
              <p className="text-gray-400 text-sm mb-2">Transaction Preview:</p>
              {activeTab === 'deposit' && (
                <>
                  <p className="text-white">Will deposit: {parseInt(amount).toLocaleString()}</p>
                  <p className="text-yellow-400">Fee: 1,000 {resourceType}</p>
                  <p className="text-green-400">Bank will receive: {calculateReceived().toLocaleString()}</p>
                </>
              )}
              {activeTab === 'withdraw' && (
                <>
                  <p className="text-white">Will withdraw: {parseInt(amount).toLocaleString()}</p>
                  <p className="text-green-400">No fee</p>
                </>
              )}
              {activeTab === 'exchange' && (
                <>
                  <p className="text-white">Give: {parseInt(amount).toLocaleString()} {resourceType}</p>
                  <p className="text-yellow-400">Exchange fee: 20%</p>
                  <p className="text-green-400">
                    Receive: {calculateReceived().toLocaleString()} {resourceType === 'metal' ? 'Energy' : 'Metal'}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`p-3 rounded ${
              message.includes('success') || message.includes('Deposited') || message.includes('Withdrew') || message.includes('Exchanged')
                ? 'bg-green-900/50 text-green-300'
                : 'bg-red-900/50 text-red-300'
            }`}>
              {message}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={() => {
              if (activeTab === 'deposit') handleDeposit();
              else if (activeTab === 'withdraw') handleWithdraw();
              else handleExchange();
            }}
            disabled={loading || !amount || parseInt(amount) <= 0}
            className={`w-full py-3 px-4 rounded font-bold ${
              loading || !amount || parseInt(amount) <= 0
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-500 hover:bg-yellow-600 text-black'
            }`}
          >
            {loading
              ? 'Processing...'
              : activeTab === 'deposit'
              ? 'Deposit (1,000 fee)'
              : activeTab === 'withdraw'
              ? 'Withdraw'
              : 'Exchange (20% fee)'}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-4 text-gray-400 text-sm">
          {activeTab === 'deposit' && (
            <p>💡 Deposits charge a 1,000 {resourceType} fee. Stored resources are safe.</p>
          )}
          {activeTab === 'withdraw' && (
            <p>💡 Withdrawals are free. No fees charged.</p>
          )}
          {activeTab === 'exchange' && (
            <p>💡 Exchange rate: 1:0.8 (20% fee). Only available at Exchange Banks.</p>
          )}
        </div>
      </div>
    </div>
  );
}
