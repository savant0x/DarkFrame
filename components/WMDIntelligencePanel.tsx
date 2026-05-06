/**
 * @file components/WMDIntelligencePanel.tsx
 * @created 2025-10-22
 * @overview WMD Spy Network & Intelligence Operations Panel
 * 
 * OVERVIEW:
 * Manage spy network, launch intelligence missions, execute sabotage,
 * and track mission results. Includes spy recruitment, training, and
 * counter-intelligence operations.
 * 
 * Features:
 * - Spy roster with rank and specialization
 * - Mission launcher with 10 mission types
 * - Sabotage targeting interface
 * - Counter-intelligence sweeps
 * - Mission history and results
 * 
 * Dependencies: /api/wmd/intelligence, /types/wmd/intelligence.types
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { showSuccess, showError, showInfo, showWarning } from '@/lib/toastService';

interface Spy {
  spyId: string;
  codename: string;
  rank: string;
  specialization: string;
  status: string;
  experience: number;
  missionHistory: string[];
}

interface Mission {
  missionId: string;
  spyId: string;
  missionType: string;
  targetId: string;
  status: string;
  startedAt: Date;
  completesAt?: Date;
}

export default function WMDIntelligencePanel() {
  const [spies, setSpies] = useState<Spy[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'spies' | 'missions'>('spies');
  const [selectedSpec, setSelectedSpec] = useState('SURVEILLANCE');
  const [targetId, setTargetId] = useState('');
  const { socket, isConnected } = useWebSocketContext();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [view]);

  // WebSocket event subscriptions
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleMissionComplete = (payload: any) => {
      showInfo(`Mission complete: ${payload.missionType}`);
      fetchData();
    };

    socket.on('wmd:spy_mission_complete', handleMissionComplete);

    return () => {
      socket.off('wmd:spy_mission_complete', handleMissionComplete);
    };
  }, [socket, isConnected]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/wmd/intelligence?type=${view}`);
      const data = await res.json();
      if (data.success) {
        if (view === 'spies') setSpies(data.spies);
        else setMissions(data.missions);
      }
    } catch (error) {
      console.error('Failed to fetch intelligence data:', error);
    } finally {
      setLoading(false);
    }
  };

  const recruitSpy = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recruit', specialization: selectedSpec }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Recruited ${selectedSpec} spy!`);
        await fetchData();
      } else {
        showError(data.error || 'Failed to recruit spy');
      }
    } catch (error) {
      showError('Error recruiting spy');
      console.error('Error recruiting spy:', error);
    } finally {
      setLoading(false);
    }
  };

  const startMission = async (spyId: string, missionType: string) => {
    if (!targetId.trim()) {
      showError('Please enter a target player username');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'mission', 
          spyId, 
          missionType,
          targetId: targetId.trim() 
        }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Mission started: ${missionType}`);
        setTargetId('');
        await fetchData();
      } else {
        showError(data.error || 'Failed to start mission');
      }
    } catch (error) {
      showError('Error starting mission');
      console.error('Error starting mission:', error);
    } finally {
      setLoading(false);
    }
  };

  const runCounterIntel = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wmd/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'counterIntel' }),
      });
      const data = await res.json();
      if (data.success) {
        showInfo(`Counter-Intel: ${data.threatsDetected} threats, ${data.spiesDetected.length} spies detected`);
      } else {
        showError(data.error || 'Counter-intel failed');
      }
    } catch (error) {
      showError('Error running counter-intel');
      console.error('Error running counter-intel:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-600';
      case 'ON_MISSION': return 'bg-blue-600';
      case 'COMPROMISED': return 'bg-red-600';
      case 'RETIRED': return 'bg-gray-600';
      default: return 'bg-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg">
        <p className="text-gray-300">Loading intelligence data...</p>
      </div>
    );
  }

  const availableSpies = spies.filter(s => s.status === 'AVAILABLE').length;

  return (
    <div className="p-6 bg-gray-800 rounded-lg space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-purple-400">Intelligence Network</h2>
          <p className="text-sm text-gray-400">
            {spies.length} spies | {availableSpies} available
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setView('spies')}
            variant={view === 'spies' ? 'primary' : 'secondary'}
            size="sm"
          >
            Spies
          </Button>
          <Button
            onClick={() => setView('missions')}
            variant={view === 'missions' ? 'primary' : 'secondary'}
            size="sm"
          >
            Missions
          </Button>
          <Button
            onClick={runCounterIntel}
            className="bg-orange-600 hover:bg-orange-700"
            size="sm"
          >
            Counter-Intel
          </Button>
        </div>
      </div>

      {/* Spies View */}
      {view === 'spies' && (
        <>
          {/* Recruitment */}
          <Card className="p-4 bg-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white mb-2">Recruit Spy</h3>
                <div className="flex gap-2">
                  {['SURVEILLANCE', 'SABOTAGE', 'INFILTRATION', 'CYBER'].map(spec => (
                    <Button
                      key={spec}
                      onClick={() => setSelectedSpec(spec)}
                      variant={selectedSpec === spec ? 'primary' : 'secondary'}
                      size="sm"
                    >
                      {spec}
                    </Button>
                  ))}
                </div>
              </div>
              <Button onClick={recruitSpy} className="bg-purple-600 hover:bg-purple-700">
                + Recruit
              </Button>
            </div>
          </Card>

          {/* Spy Roster */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spies.map((spy) => (
              <Card key={spy.spyId} className="p-4 bg-gray-700 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white">{spy.codename}</h3>
                    <p className="text-xs text-gray-400">{spy.rank}</p>
                  </div>
                  <Badge className={getStatusColor(spy.status)}>
                    {spy.status}
                  </Badge>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Specialization:</span>
                    <span className="text-purple-400">{spy.specialization}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Experience:</span>
                    <span className="text-green-400">{spy.experience} XP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Missions:</span>
                    <span className="text-blue-400">{spy.missionHistory.length}</span>
                  </div>
                </div>

                {spy.status === 'AVAILABLE' && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Target username..."
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="bg-gray-600 text-white text-sm"
                    />
                    <Button
                      onClick={() => startMission(spy.spyId, 'RECONNAISSANCE')}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      size="sm"
                    >
                      Start Mission
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Missions View */}
      {view === 'missions' && (
        <div className="space-y-4">
          {missions.map((mission) => (
            <Card key={mission.missionId} className="p-4 bg-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white">{mission.missionType}</h3>
                  <p className="text-sm text-gray-400">Target: {mission.targetId}</p>
                </div>
                <Badge className={mission.status === 'ACTIVE' ? 'bg-blue-600' : 'bg-gray-600'}>
                  {mission.status}
                </Badge>
              </div>
            </Card>
          ))}
          {missions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No active missions</p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {view === 'spies' && spies.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No spies in network</p>
          <p className="text-gray-500 text-sm">Recruit your first spy to begin operations</p>
        </div>
      )}
    </div>
  );
}
