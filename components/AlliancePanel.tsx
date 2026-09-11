
/**
 * Alliance Panel Component
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Comprehensive alliance management interface for proposing, accepting, breaking
 * alliances and managing contracts. Displays current alliances, pending proposals,
 * and available alliance types with costs and benefits.
 * 
 * Features:
 * - View active alliances with details
 * - Propose new alliances (4 types: NAP, Trade, Military, Federation)
 * - Accept/reject pending proposals
 * - Break existing alliances
 * - Manage contracts (4 types: Resource Sharing, Defense Pact, War Support, Joint Research)
 * - Alliance cost display
 * - Contract limits per alliance type
 * - Real-time updates
 * 
 * Props:
 * - clanId: Clan identifier
 * - playerId: Current player ID
 * - role: Player's clan role (LEADER/CO_LEADER can manage)
 * - clanName: Current clan name
 * - treasuryMetal: Available metal for alliance costs
 * 
 * @module components/AlliancePanel
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { extractApiError } from '@/lib/apiClient';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface Alliance {
  _id: string;
  clanId1: string;
  clanId2: string;
  clanName1: string;
  clanName2: string;
  type: string;
  status: string;
  contracts: Contract[];
  proposedBy: string;
  proposedAt: string;
  acceptedAt?: string;
  brokenAt?: string;
}

interface Contract {
  type: string;
  addedAt: string;
  percentage?: number;
}

interface AlliancePanelProps {
  clanId: string;
  playerId: string;
  role: string;
  clanName: string;
  treasuryMetal: number;
}

type AllianceType = 'NAP' | 'TRADE_AGREEMENT' | 'MILITARY_PACT' | 'FEDERATION';
type ContractType = 'RESOURCE_SHARING' | 'DEFENSE_PACT' | 'WAR_SUPPORT' | 'JOINT_RESEARCH';

export function AlliancePanel({ clanId, role, treasuryMetal }: AlliancePanelProps) {
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [pendingProposals, setPendingProposals] = useState<Alliance[]>([]);
  const [_isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedAlliance, setSelectedAlliance] = useState<Alliance | null>(null);
  
  const [proposeData, setProposeData] = useState({
    targetClanName: '',
    allianceType: 'NAP' as AllianceType,
  });
  
  const [contractData, setContractData] = useState({
    contractType: 'RESOURCE_SHARING' as ContractType,
    percentage: 10,
  });
  
  const canManage = ['LEADER', 'CO_LEADER'].includes(role);

  const allianceCosts: Record<AllianceType, number> = {
    NAP: 0,
    TRADE_AGREEMENT: 10000,
    MILITARY_PACT: 50000,
    FEDERATION: 200000,
  };

  const allianceDescriptions: Record<AllianceType, string> = {
    NAP: 'Non-Aggression Pact - Cannot declare war on each other',
    TRADE_AGREEMENT: 'Trade Agreement - Share resources with special contracts',
    MILITARY_PACT: 'Military Pact - Can fight together in wars',
    FEDERATION: 'Federation - Strongest alliance with all benefits',
  };

  const contractLimits: Record<AllianceType, ContractType[]> = {
    NAP: [],
    TRADE_AGREEMENT: ['RESOURCE_SHARING'],
    MILITARY_PACT: ['RESOURCE_SHARING', 'DEFENSE_PACT', 'WAR_SUPPORT'],
    FEDERATION: ['RESOURCE_SHARING', 'DEFENSE_PACT', 'WAR_SUPPORT', 'JOINT_RESEARCH'],
  };

  const loadAlliances = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/clan/alliance?clanId=${clanId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(extractApiError(data, response.status));
      }
      
      const active = (data.alliances || []).filter((a: Alliance) => a.status === 'ACTIVE');
      const pending = (data.alliances || []).filter((a: Alliance) => 
        a.status === 'PENDING' && a.clanId2 === clanId
      );
      
      setAlliances(active);
      setPendingProposals(pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsLoading(false);
    }
  }, [clanId]);

  useEffect(() => {
    loadAlliances();
    
    const interval = setInterval(() => {
      loadAlliances();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [clanId, loadAlliances]);

  const proposeAlliance = async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/clan/alliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId,
          targetClanName: proposeData.targetClanName,
          allianceType: proposeData.allianceType,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(extractApiError(data, response.status));
      }
      
      setShowProposeModal(false);
      setProposeData({ targetClanName: '', allianceType: 'NAP' });
      await loadAlliances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const acceptAlliance = async (allianceId: string) => {
    try {
      setError(null);
      
      const response = await fetch('/api/clan/alliance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId,
          allianceId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(extractApiError(data, response.status));
      }
      
      await loadAlliances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const breakAlliance = async (allianceId: string) => {
    if (!(await confirmDialog('Are you sure you want to break this alliance?'))) return;
    
    try {
      setError(null);
      
      const response = await fetch(`/api/clan/alliance?clanId=${clanId}&allianceId=${allianceId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(extractApiError(data, response.status));
      }
      
      await loadAlliances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const addContract = async () => {
    if (!selectedAlliance) return;
    
    try {
      setError(null);
      
      const response = await fetch('/api/clan/alliance/contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanId,
          allianceId: selectedAlliance._id,
          contractType: contractData.contractType,
          percentage: ['RESOURCE_SHARING', 'JOINT_RESEARCH'].includes(contractData.contractType)
            ? contractData.percentage
            : undefined,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(extractApiError(data, response.status));
      }
      
      setShowContractModal(false);
      setSelectedAlliance(null);
      setContractData({ contractType: 'RESOURCE_SHARING', percentage: 10 });
      await loadAlliances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const removeContract = async (allianceId: string, contractType: string) => {
    if (!(await confirmDialog('Are you sure you want to remove this contract?'))) return;
    
    try {
      setError(null);
      
      const response = await fetch(
        `/api/clan/alliance/contract?clanId=${clanId}&allianceId=${allianceId}&contractType=${contractType}`,
        { method: 'DELETE' }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(extractApiError(data, response.status));
      }
      
      await loadAlliances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const getAllyName = (alliance: Alliance): string => {
    return alliance.clanId1 === clanId ? alliance.clanName2 : alliance.clanName1;
  };

  const canAfford = (type: AllianceType): boolean => {
    return treasuryMetal >= allianceCosts[type];
  };

  return (
    <div className="flex flex-col h-full bg-[color-mix(in_oklab,var(--nn-void)_40%,transparent)] rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
        <h2 className="text-xl font-bold">Alliances</h2>
        {canManage && (
          <button
            onClick={() => setShowProposeModal(true)}
            className="px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] rounded-none"
          >
            Propose Alliance
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Pending Proposals */}
        {pendingProposals.length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-2 text-[color:var(--nn-amber)]">Pending Proposals</h3>
            {pendingProposals.map((proposal) => (
              <div key={proposal._id} className="p-4 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none mb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{proposal.clanName1}</p>
                    <p className="text-sm text-[color:var(--nn-text-secondary)]">
                      Proposes {proposal.type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                      {new Date(proposal.proposedAt).toLocaleString()}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptAlliance(proposal._id)}
                        className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] rounded-none text-sm"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => breakAlliance(proposal._id)}
                        className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] rounded-none text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Alliances */}
        <div>
          <h3 className="text-lg font-bold mb-2">Active Alliances ({alliances.length})</h3>
          
          {alliances.length === 0 && (
            <div className="text-center text-[color:var(--nn-text-secondary)] py-8">
              No active alliances
            </div>
          )}
          
          {alliances.map((alliance) => (
            <div key={alliance._id} className="p-4 bg-[color-mix(in_oklab,var(--nn-void)_20%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none mb-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-lg">{getAllyName(alliance)}</p>
                  <p className="text-sm text-[color:var(--nn-cyan)]">{alliance.type.replace(/_/g, ' ')}</p>
                </div>
                {canManage && (
                  <button
                    onClick={() => breakAlliance(alliance._id)}
                    className="px-3 py-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] rounded-none text-sm"
                  >
                    Break Alliance
                  </button>
                )}
              </div>

              {/* Contracts */}
              <div className="mt-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-bold">Contracts ({alliance.contracts.length})</p>
                  {canManage && contractLimits[alliance.type as AllianceType].length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedAlliance(alliance);
                        setShowContractModal(true);
                      }}
                      className="px-2 py-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-xs"
                    >
                      Add Contract
                    </button>
                  )}
                </div>
                
                {alliance.contracts.length === 0 ? (
                  <p className="text-xs text-[color:var(--nn-text-secondary)]">No contracts</p>
                ) : (
                  <div className="space-y-1">
                    {alliance.contracts.map((contract, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-2 rounded-none text-sm">
                        <span>
                          {contract.type.replace(/_/g, ' ')}
                          {contract.percentage && ` (${contract.percentage}%)`}
                        </span>
                        {canManage && (
                          <button
                            onClick={() => removeContract(alliance._id, contract.type)}
                            className="text-xs text-[color:var(--nn-magenta)]"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Propose Alliance Modal */}
      {showProposeModal && (
        <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50">
          <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Propose Alliance</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Target Clan Name</label>
                <input
                  type="text"
                  value={proposeData.targetClanName}
                  onChange={(e) => setProposeData({ ...proposeData, targetClanName: e.target.value })}
                  className="w-full px-3 py-2 bg-[color-mix(in_oklab,var(--nn-void)_40%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none"
                  placeholder="Enter exact clan name..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Alliance Type</label>
                <select
                  value={proposeData.allianceType}
                  onChange={(e) => setProposeData({ ...proposeData, allianceType: e.target.value as AllianceType })}
                  className="w-full px-3 py-2 bg-[color-mix(in_oklab,var(--nn-void)_40%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none"
                >
                  {(Object.keys(allianceCosts) as AllianceType[]).map((type) => (
                    <option key={type} value={type} disabled={!canAfford(type)}>
                      {type.replace(/_/g, ' ')} - {allianceCosts[type].toLocaleString()}M
                      {!canAfford(type) && ' (Cannot afford)'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[color:var(--nn-text-secondary)] mt-1">
                  {allianceDescriptions[proposeData.allianceType]}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={proposeAlliance}
                  disabled={!proposeData.targetClanName || !canAfford(proposeData.allianceType)}
                  className="flex-1 px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] rounded-none disabled:opacity-50"
                >
                  Propose
                </button>
                <button
                  onClick={() => setShowProposeModal(false)}
                  className="flex-1 px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Contract Modal */}
      {showContractModal && selectedAlliance && (
        <div className="fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50">
          <div className="bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Add Contract</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Contract Type</label>
                <select
                  value={contractData.contractType}
                  onChange={(e) => setContractData({ ...contractData, contractType: e.target.value as ContractType })}
                  className="w-full px-3 py-2 bg-[color-mix(in_oklab,var(--nn-void)_40%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none"
                >
                  {contractLimits[selectedAlliance.type as AllianceType].map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {['RESOURCE_SHARING', 'JOINT_RESEARCH'].includes(contractData.contractType) && (
                <div>
                  <label className="block text-sm font-bold mb-2">
                    Percentage ({contractData.contractType === 'RESOURCE_SHARING' ? '1-50%' : '1-30%'})
                  </label>
                  <input
                    type="number"
                    value={contractData.percentage}
                    onChange={(e) => setContractData({ ...contractData, percentage: parseInt(e.target.value) })}
                    min={1}
                    max={contractData.contractType === 'RESOURCE_SHARING' ? 50 : 30}
                    className="w-full px-3 py-2 bg-[color-mix(in_oklab,var(--nn-void)_40%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={addContract}
                  className="flex-1 px-4 py-2 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] rounded-none"
                >
                  Add Contract
                </button>
                <button
                  onClick={() => {
                    setShowContractModal(false);
                    setSelectedAlliance(null);
                  }}
                  className="flex-1 px-4 py-2 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-none bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
