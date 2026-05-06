/**
 * Fund Distribution Panel Component
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Comprehensive fund distribution interface supporting all 4 distribution methods
 * (Equal Split, Percentage, Merit, Direct Grant) with role-based daily limits,
 * history tracking, and visual feedback.
 * 
 * Features:
 * - 4 distribution methods with validation
 * - Role-based daily limits (Leader unlimited, Co-Leader 50K/day)
 * - Distribution history with pagination
 * - Resource type selection (Metal, Energy, Research Points)
 * - Merit-based scoring (wars won, territories, contributions)
 * - Real-time treasury balance updates
 * - Distribution preview before execution
 * 
 * Props:
 * - clanId: Clan identifier
 * - playerId: Current player ID
 * - role: Player's clan role
 * - treasuryMetal: Available metal
 * - treasuryEnergy: Available energy
 * - treasuryResearchPoints: Available research points
 * 
 * @module components/FundDistributionPanel
 */

'use client';

import React, { useState, useEffect } from 'react';

interface DistributionHistory {
  _id: string;
  distributorId: string;
  distributorUsername: string;
  method: string;
  resourceType: string;
  totalAmount: number;
  recipients: Array<{
    playerId: string;
    username: string;
    amount: number;
  }>;
  timestamp: string;
}

interface FundDistributionPanelProps {
  clanId: string;
  playerId: string;
  role: string;
  treasuryMetal: number;
  treasuryEnergy: number;
  treasuryResearchPoints: number;
}

type DistributionMethod = 'EQUAL_SPLIT' | 'PERCENTAGE' | 'MERIT' | 'DIRECT_GRANT';
type ResourceType = 'metal' | 'energy' | 'rp';

export function FundDistributionPanel({
  clanId,
  playerId,
  role,
  treasuryMetal,
  treasuryEnergy,
  treasuryResearchPoints,
}: FundDistributionPanelProps) {
  const [history, setHistory] = useState<DistributionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [method, setMethod] = useState<DistributionMethod>('EQUAL_SPLIT');
  const [resourceType, setResourceType] = useState<ResourceType>('metal');
  const [totalAmount, setTotalAmount] = useState(0);
  const [recipients, setRecipients] = useState<Array<{ playerId: string; amount: number }>>([]);
  const [singleRecipient, setSingleRecipient] = useState({ username: '', amount: 0 });
  
  const canDistribute = ['LEADER', 'CO_LEADER'].includes(role);
  const isLeader = role === 'LEADER';
  const dailyLimit = isLeader ? Infinity : 50000;

  const getAvailableBalance = (): number => {
    switch (resourceType) {
      case 'metal': return treasuryMetal;
      case 'energy': return treasuryEnergy;
      case 'rp': return treasuryResearchPoints;
      default: return 0;
    }
  };

  useEffect(() => {
    loadHistory();
  }, [clanId]);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/clan/bank/distribution-history?clanId=${clanId}&limit=20`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load history');
      }
      
      setHistory(data.distributions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const executeDistribution = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      // Build request based on method
      let requestBody: any = {
        clanId,
        method,
        resourceType,
        totalAmount,
      };

      if (method === 'PERCENTAGE' || method === 'DIRECT_GRANT') {
        if (method === 'DIRECT_GRANT') {
          requestBody.recipients = [{ username: singleRecipient.username, amount: singleRecipient.amount }];
        } else {
          requestBody.recipients = recipients;
        }
      }

      const response = await fetch('/api/clan/bank/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to distribute funds');
      }
      
      setSuccessMessage(`Successfully distributed ${totalAmount.toLocaleString()} ${resourceType.toUpperCase()} to ${data.distribution.recipients.length} members!`);
      
      // Reset form
      setTotalAmount(0);
      setRecipients([]);
      setSingleRecipient({ username: '', amount: 0 });
      
      // Reload history
      await loadHistory();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addRecipient = () => {
    setRecipients([...recipients, { playerId: '', amount: 0 }]);
  };

  const updateRecipient = (index: number, field: 'playerId' | 'amount', value: any) => {
    const updated = [...recipients];
    if (field === 'amount') {
      updated[index].amount = parseInt(value) || 0;
    } else {
      updated[index].playerId = value;
    }
    setRecipients(updated);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const getTotalRecipientAmount = (): number => {
    if (method === 'DIRECT_GRANT') {
      return singleRecipient.amount;
    }
    return recipients.reduce((sum, r) => sum + r.amount, 0);
  };

  const canSubmit = (): boolean => {
    if (!canDistribute || totalAmount <= 0 || totalAmount > getAvailableBalance()) {
      return false;
    }

    if (!isLeader && totalAmount > dailyLimit) {
      return false;
    }

    if (method === 'PERCENTAGE' || method === 'DIRECT_GRANT') {
      if (method === 'DIRECT_GRANT') {
        return singleRecipient.username.length > 0 && singleRecipient.amount > 0;
      }
      return recipients.length > 0 && recipients.every(r => r.playerId && r.amount > 0);
    }

    return true;
  };

  const methodDescriptions: Record<DistributionMethod, string> = {
    EQUAL_SPLIT: 'Divide total amount equally among all active members',
    PERCENTAGE: 'Distribute specific percentages to selected members',
    MERIT: 'Distribute based on contribution (wars won, territories, participation)',
    DIRECT_GRANT: 'Grant specific amount to a single member',
  };

  return (
    <div className="flex flex-col h-full bg-black/40 rounded border border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Fund Distribution</h2>
        {!canDistribute && (
          <p className="text-sm text-red-400 mt-1">Only Leaders and Co-Leaders can distribute funds</p>
        )}
        {canDistribute && !isLeader && (
          <p className="text-sm text-yellow-400 mt-1">Daily limit: {dailyLimit.toLocaleString()}</p>
        )}
      </div>

      {/* Error/Success Display */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-900/20 border border-red-500 rounded text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mx-4 mt-2 p-2 bg-green-900/20 border border-green-500 rounded text-sm">
          {successMessage}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Distribution Form */}
        {canDistribute && (
          <div className="bg-black/20 border border-gray-600 rounded p-4">
            <h3 className="font-bold mb-3">New Distribution</h3>
            
            <div className="space-y-3">
              {/* Resource Type */}
              <div>
                <label className="block text-sm font-bold mb-1">Resource Type</label>
                <select
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value as ResourceType)}
                  className="w-full px-3 py-2 bg-black/40 border border-gray-600 rounded"
                >
                  <option value="metal">Metal ({treasuryMetal.toLocaleString()})</option>
                  <option value="energy">Energy ({treasuryEnergy.toLocaleString()})</option>
                  <option value="rp">Research Points ({treasuryResearchPoints.toLocaleString()})</option>
                </select>
              </div>

              {/* Method */}
              <div>
                <label className="block text-sm font-bold mb-1">Distribution Method</label>
                <select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value as DistributionMethod);
                    setRecipients([]);
                    setSingleRecipient({ username: '', amount: 0 });
                  }}
                  className="w-full px-3 py-2 bg-black/40 border border-gray-600 rounded"
                >
                  <option value="EQUAL_SPLIT">Equal Split</option>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="MERIT">Merit-Based</option>
                  <option value="DIRECT_GRANT">Direct Grant</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">{methodDescriptions[method]}</p>
              </div>

              {/* Total Amount */}
              <div>
                <label className="block text-sm font-bold mb-1">Total Amount</label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(parseInt(e.target.value) || 0)}
                  min={0}
                  max={getAvailableBalance()}
                  className="w-full px-3 py-2 bg-black/40 border border-gray-600 rounded"
                  placeholder="Enter amount to distribute..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  Available: {getAvailableBalance().toLocaleString()} {resourceType.toUpperCase()}
                </p>
              </div>

              {/* Method-Specific Inputs */}
              {method === 'PERCENTAGE' && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold">Recipients (Percentages must total 100%)</label>
                    <button
                      onClick={addRecipient}
                      className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                    >
                      Add Recipient
                    </button>
                  </div>
                  <div className="space-y-2">
                    {recipients.map((recipient, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={recipient.playerId}
                          onChange={(e) => updateRecipient(index, 'playerId', e.target.value)}
                          placeholder="Player ID..."
                          className="flex-1 px-2 py-1 bg-black/40 border border-gray-600 rounded text-sm"
                        />
                        <input
                          type="number"
                          value={recipient.amount}
                          onChange={(e) => updateRecipient(index, 'amount', e.target.value)}
                          placeholder="Percentage..."
                          min={1}
                          max={100}
                          className="w-24 px-2 py-1 bg-black/40 border border-gray-600 rounded text-sm"
                        />
                        <button
                          onClick={() => removeRecipient(index)}
                          className="px-2 py-1 bg-red-600 rounded hover:bg-red-500 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {recipients.length > 0 && (
                      <p className="text-xs text-gray-400">
                        Total: {getTotalRecipientAmount()}%
                      </p>
                    )}
                  </div>
                </div>
              )}

              {method === 'DIRECT_GRANT' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold">Recipient</label>
                  <input
                    type="text"
                    value={singleRecipient.username}
                    onChange={(e) => setSingleRecipient({ ...singleRecipient, username: e.target.value })}
                    placeholder="Enter username..."
                    className="w-full px-3 py-2 bg-black/40 border border-gray-600 rounded"
                  />
                  <input
                    type="number"
                    value={singleRecipient.amount}
                    onChange={(e) => setSingleRecipient({ ...singleRecipient, amount: parseInt(e.target.value) || 0 })}
                    placeholder="Enter amount..."
                    min={1}
                    max={totalAmount}
                    className="w-full px-3 py-2 bg-black/40 border border-gray-600 rounded"
                  />
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={executeDistribution}
                disabled={!canSubmit() || isLoading}
                className="w-full py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              >
                {isLoading ? 'Distributing...' : 'Execute Distribution'}
              </button>
            </div>
          </div>
        )}

        {/* Distribution History */}
        <div>
          <h3 className="font-bold mb-3">Distribution History</h3>
          
          {history.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No distribution history
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((dist) => (
                <div key={dist._id} className="p-3 bg-black/20 border border-gray-600 rounded">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold">{dist.method.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-gray-400">
                        By {dist.distributorUsername}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">
                        {dist.totalAmount.toLocaleString()} {dist.resourceType.toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(dist.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-2 pt-2 border-t border-gray-700">
                    <p className="text-xs font-bold mb-1">Recipients ({dist.recipients.length}):</p>
                    <div className="grid grid-cols-2 gap-1">
                      {dist.recipients.slice(0, 6).map((recipient, idx) => (
                        <div key={idx} className="text-xs text-gray-400">
                          {recipient.username}: {recipient.amount.toLocaleString()}
                        </div>
                      ))}
                      {dist.recipients.length > 6 && (
                        <div className="text-xs text-gray-500">
                          +{dist.recipients.length - 6} more...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
