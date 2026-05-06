/**
 * @file hooks/useWMDNotifications.ts
 * @created 2025-10-22
 * @overview WMD WebSocket Notifications Hook
 * 
 * OVERVIEW:
 * React hook for listening to real-time WMD events via WebSocket.
 * Provides toast notifications and callback handlers for WMD system events.
 * 
 * Features:
 * - Auto-subscribes to all WMD events on mount
 * - Toast notifications for important events
 * - Optional callback handlers for custom behavior
 * - Automatic cleanup on unmount
 * 
 * Usage:
 * ```tsx
 * useWMDNotifications({
 *   onMissileLaunched: (data) => console.log('Missile launched!', data),
 *   showToasts: true
 * });
 * ```
 */

'use client';

import { useEffect } from 'react';
import { useWebSocketContext } from '@/context/WebSocketContext';
import type {
  WMDMissileLaunchedPayload,
  WMDIncomingMissilePayload,
  WMDMissileInterceptedPayload,
  WMDInterceptionSuccessPayload,
  WMDMissileImpactPayload,
  WMDResearchCompletePayload,
  WMDSpyMissionCompletePayload,
  WMDVoteUpdatePayload,
  WMDBatteryDeployedPayload,
  WMDSpyRecruitedPayload,
  WMDCounterIntelAlertPayload,
} from '@/types/websocket';

interface WMDNotificationHandlers {
  onMissileLaunched?: (data: WMDMissileLaunchedPayload) => void;
  onIncomingMissile?: (data: WMDIncomingMissilePayload) => void;
  onMissileIntercepted?: (data: WMDMissileInterceptedPayload) => void;
  onInterceptionSuccess?: (data: WMDInterceptionSuccessPayload) => void;
  onMissileImpact?: (data: WMDMissileImpactPayload) => void;
  onResearchComplete?: (data: WMDResearchCompletePayload) => void;
  onSpyMissionComplete?: (data: WMDSpyMissionCompletePayload) => void;
  onVoteUpdate?: (data: WMDVoteUpdatePayload) => void;
  onBatteryDeployed?: (data: WMDBatteryDeployedPayload) => void;
  onSpyRecruited?: (data: WMDSpyRecruitedPayload) => void;
  onCounterIntelAlert?: (data: WMDCounterIntelAlertPayload) => void;
  showToasts?: boolean;
}

/**
 * Hook for subscribing to WMD WebSocket notifications
 */
export function useWMDNotifications(handlers: WMDNotificationHandlers = {}) {
  const { socket, isConnected } = useWebSocketContext();
  const { showToasts = true } = handlers;

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Helper to show toast notification
    const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      if (!showToasts) return;
      
      // Use browser notification API if available
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('WMD Alert', { body: message });
      }
      
      // Fallback: could integrate with a toast library here
      console.log(`[WMD ${type.toUpperCase()}]`, message);
    };

    // Missile Launched
    const handleMissileLaunched = (data: WMDMissileLaunchedPayload) => {
      showToast(data.message, 'success');
      handlers.onMissileLaunched?.(data);
    };

    // Incoming Missile
    const handleIncomingMissile = (data: WMDIncomingMissilePayload) => {
      showToast(data.message, 'warning');
      handlers.onIncomingMissile?.(data);
    };

    // Missile Intercepted
    const handleMissileIntercepted = (data: WMDMissileInterceptedPayload) => {
      showToast(data.message, 'info');
      handlers.onMissileIntercepted?.(data);
    };

    // Interception Success
    const handleInterceptionSuccess = (data: WMDInterceptionSuccessPayload) => {
      showToast(data.message, 'success');
      handlers.onInterceptionSuccess?.(data);
    };

    // Missile Impact
    const handleMissileImpact = (data: WMDMissileImpactPayload) => {
      showToast(data.message, 'error');
      handlers.onMissileImpact?.(data);
    };

    // Research Complete
    const handleResearchComplete = (data: WMDResearchCompletePayload) => {
      showToast(data.message, 'success');
      handlers.onResearchComplete?.(data);
    };

    // Spy Mission Complete
    const handleSpyMissionComplete = (data: WMDSpyMissionCompletePayload) => {
      showToast(data.message, data.success ? 'success' : 'warning');
      handlers.onSpyMissionComplete?.(data);
    };

    // Vote Update
    const handleVoteUpdate = (data: WMDVoteUpdatePayload) => {
      showToast(data.message, 'info');
      handlers.onVoteUpdate?.(data);
    };

    // Battery Deployed
    const handleBatteryDeployed = (data: WMDBatteryDeployedPayload) => {
      showToast(data.message, 'success');
      handlers.onBatteryDeployed?.(data);
    };

    // Spy Recruited
    const handleSpyRecruited = (data: WMDSpyRecruitedPayload) => {
      showToast(data.message, 'success');
      handlers.onSpyRecruited?.(data);
    };

    // Counter-Intel Alert
    const handleCounterIntelAlert = (data: WMDCounterIntelAlertPayload) => {
      showToast(data.message, data.spiesDetected.length > 0 ? 'warning' : 'success');
      handlers.onCounterIntelAlert?.(data);
    };

    // Register all event listeners
    socket.on('wmd:missile_launched', handleMissileLaunched);
    socket.on('wmd:incoming_missile', handleIncomingMissile);
    socket.on('wmd:missile_intercepted', handleMissileIntercepted);
    socket.on('wmd:interception_success', handleInterceptionSuccess);
    socket.on('wmd:missile_impact', handleMissileImpact);
    socket.on('wmd:research_complete', handleResearchComplete);
    socket.on('wmd:spy_mission_complete', handleSpyMissionComplete);
    socket.on('wmd:vote_update', handleVoteUpdate);
    socket.on('wmd:battery_deployed', handleBatteryDeployed);
    socket.on('wmd:spy_recruited', handleSpyRecruited);
    socket.on('wmd:counter_intel_alert', handleCounterIntelAlert);

    // Cleanup on unmount
    return () => {
      socket.off('wmd:missile_launched', handleMissileLaunched);
      socket.off('wmd:incoming_missile', handleIncomingMissile);
      socket.off('wmd:missile_intercepted', handleMissileIntercepted);
      socket.off('wmd:interception_success', handleInterceptionSuccess);
      socket.off('wmd:missile_impact', handleMissileImpact);
      socket.off('wmd:research_complete', handleResearchComplete);
      socket.off('wmd:spy_mission_complete', handleSpyMissionComplete);
      socket.off('wmd:vote_update', handleVoteUpdate);
      socket.off('wmd:battery_deployed', handleBatteryDeployed);
      socket.off('wmd:spy_recruited', handleSpyRecruited);
      socket.off('wmd:counter_intel_alert', handleCounterIntelAlert);
    };
  }, [socket, isConnected, handlers, showToasts]);
}
