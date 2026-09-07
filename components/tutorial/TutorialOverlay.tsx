/**
 * Tutorial Overlay Component
 * Created: 2025-10-25
 * Feature: FID-20251025-101 - Interactive Tutorial Quest System
 * 
 * OVERVIEW:
 * Interactive tutorial overlay using react-joyride for step highlighting
 * and guidance. Displays current step instructions, validates player actions,
 * and progresses through quest chains.
 * 
 * RESPONSIBILITIES:
 * - Display tutorial steps with element highlighting
 * - Validate step completion
 * - Award rewards on completion
 * - Handle skip/dismiss functionality
 * - Show progress indicators
 * 
 * DEPENDENCIES:
 * - react-joyride: UI highlighting and tooltips
 * - tutorialService: Quest chain and progress management
 * - Reward system integration
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Joyride, STATUS, EVENTS, ACTIONS } from 'react-joyride';
import type { Step, EventData } from 'react-joyride';
import type { TutorialQuest, TutorialStep, TutorialProgress, TutorialUIState } from '@/types/tutorial.types';

interface TutorialOverlayProps {
  playerId: string;
  isEnabled?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

/**
 * Main tutorial overlay component
 * Manages tutorial state and integrates with react-joyride
 */
export default function TutorialOverlay({
  playerId,
  isEnabled = true,
  onComplete,
  onSkip,
}: TutorialOverlayProps) {
  const [uiState, setUiState] = useState<TutorialUIState>({
    isActive: false,
    showOverlay: false,
    showQuestPanel: false,
    currentQuest: null,
    currentStep: null,
    progress: null,
    isLoading: true,
    error: null,
  });

  const [progressPercent, setProgressPercent] = useState(0);

  const [joyrideSteps, setJoyrideSteps] = useState<Step[]>([]);
  const [runJoyride, setRunJoyride] = useState(false);

  /**
   * Handle tutorial skip
   */
  const handleSkip = useCallback(async () => {
    try {
      const response = await fetch('/api/tutorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'skip',
          playerId,
          skipType: 'ENTIRE_TUTORIAL',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setUiState(prev => ({ ...prev, isActive: false, showOverlay: false }));
        setRunJoyride(false);
        onSkip?.();
      }
    } catch (error) {
      console.error('Error skipping tutorial:', error);
    }
  }, [playerId, onSkip]);

  /**
   * Load initial tutorial state from server
   */
  const loadTutorialState = useCallback(async () => {
    try {
      const response = await fetch(`/api/tutorial?playerId=${playerId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load tutorial state');
      }

      const data = await response.json();
      const { quest, step, progress } = data;

      if (!quest || !step || progress.tutorialComplete) {
        // Tutorial not active or already complete
        setUiState(prev => ({ 
          ...prev, 
          isActive: false, 
          isLoading: false,
          showOverlay: false,
        }));
        return;
      }

      // Convert tutorial step to joyride format
      const joyrideStep = convertToJoyrideStep(step, quest);

      setUiState({
        isActive: true,
        showOverlay: true,
        showQuestPanel: true,
        currentQuest: quest,
        currentStep: step,
        progress,
        isLoading: false,
        error: null,
      });

      setProgressPercent(calculateProgress(progress));
      setJoyrideSteps([joyrideStep]);
      setRunJoyride(true);

    } catch (error) {
      console.error('Error loading tutorial state:', error);
      setUiState(prev => ({ ...prev, isLoading: false, isActive: false }));
    }
  }, [playerId]);

  useEffect(() => {
    if (!isEnabled) {
      setUiState(prev => ({ ...prev, isActive: false, isLoading: false }));
      return;
    }

    loadTutorialState();
  }, [playerId, isEnabled, loadTutorialState]);

  /**
   * Convert TutorialStep to Joyride Step format
   */
  const convertToJoyrideStep = (step: TutorialStep, quest: TutorialQuest): Step => {
    return {
      target: step.targetElement || 'body',
      content: (
        <div className="tutorial-step-content">
          <div className="quest-title text-sm font-bold text-purple-400 mb-1">
            {quest.title}
          </div>
          <h3 className="step-title text-lg font-bold mb-2">{step.title}</h3>
          <p className="step-instruction text-sm mb-3">{step.instruction}</p>
          {step.detailedHelp && (
            <div className="detailed-help text-xs text-gray-400 mt-2 p-2 bg-gray-800 rounded">
              💡 Tip: {step.detailedHelp}
            </div>
          )}
          {step.reward && (
            <div className="step-reward text-xs text-green-400 mt-2 p-2 bg-green-900/20 rounded">
              🎁 Reward: {step.reward.displayMessage}
            </div>
          )}
          <div className="step-meta flex justify-between items-center mt-3 text-xs text-gray-500">
            <span>Difficulty: {step.difficulty}</span>
            {step.estimatedSeconds && (
              <span>~{step.estimatedSeconds}s</span>
            )}
          </div>
        </div>
      ),
      // FID-20260906-012 P0: joyride 3.x — disableBeacon → skipBeacon, styles are
      // flat Options (no `options` subgroup), styling moved to Joyride-level `options`.
      skipBeacon: true,
      placement: 'auto',
      spotlightPadding: 10,
    };
  };

  /**
   * Calculate overall tutorial progress percentage
   */
  const calculateProgress = (progress: TutorialProgress): number => {
    const totalSteps = progress.totalStepsCompleted;
    const maxSteps = 17; // Total steps across all quests (from service definition)
    return Math.round((totalSteps / maxSteps) * 100);
  };

  /**
   * Handle step completion
   * Validates action and moves to next step
   */
  const handleStepComplete = useCallback(async () => {
    if (!uiState.currentQuest || !uiState.currentStep) return;

    try {
      const response = await fetch('/api/tutorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_step',
          playerId,
          questId: uiState.currentQuest._id,
          stepId: uiState.currentStep.id,
          validationData: {}, // TODO: Collect actual validation data
        }),
      });

      const result = await response.json();

      if (!result.success) {
        console.error('Step validation failed:', result.message);
        return;
      }

      // Show completion message if present
      if (result.message) {
        // TODO: Show toast notification
        console.log('✅', result.message);
      }

      // Check if tutorial is complete
      if (result.tutorialComplete) {
        setUiState(prev => ({ ...prev, isActive: false, showOverlay: false }));
        setRunJoyride(false);
        onComplete?.();
        return;
      }

      // Load next step
      await loadTutorialState();

    } catch (error) {
      console.error('Error completing step:', error);
    }
  }, [uiState.currentQuest, uiState.currentStep, playerId, onComplete, loadTutorialState]);

  /**
   * Handle joyride callback events
   */
  // FID-20260906-012 P0: joyride 3.x renamed the callback payload CallBackProps → EventData
  // and the prop callback → onEvent.
  const handleJoyrideCallback = useCallback(async (data: EventData) => {
    const { status, action, type } = data;

    // Handle tutorial completion
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunJoyride(false);
      
      if (status === STATUS.SKIPPED) {
        await handleSkip();
      }
      return;
    }

    // Handle step completion on "next" click
    if (type === EVENTS.STEP_AFTER && action === ACTIONS.NEXT) {
      await handleStepComplete();
    }

    // Handle step skip
    if (action === ACTIONS.SKIP) {
      await handleSkip();
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- uiState.currentQuest and currentStep are intentionally included for tutorial step tracking
  }, [uiState.currentQuest, uiState.currentStep, handleSkip, handleStepComplete]);

  // Don't render anything if tutorial is not active
  if (!uiState.isActive || uiState.isLoading) {
    return null;
  }

  return (
    <>
      {/* Tutorial Progress Bar (top of screen) — NEON NOIR .nn-banner:
          quiet glass tab under the nav, violet signal, sample .nn-meter. */}
      {uiState.showOverlay && (
        <div className="nn-banner">
          <div className="nn-banner__head">
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="nn-banner__title">Tutorial Progress</span>
              {uiState.currentQuest && (
                <span className="nn-banner__quest">{uiState.currentQuest.title}</span>
              )}
            </div>
            <span className="nn-banner__pct">{progressPercent}% COMPLETE</span>
          </div>
          <div className="nn-meter h-1.5">
            <div
              className="nn-meter__seg nn-meter__seg--vio transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
            <div className="nn-meter__ticks" aria-hidden>
              <i /><i /><i /><i /><i /><i /><i /><i />
            </div>
          </div>
        </div>
      )}

      {/* Joyride Component (v3: per-step styles → component-level options) */}
      <Joyride
        steps={joyrideSteps}
        run={runJoyride}
        continuous
        onEvent={handleJoyrideCallback}
        options={{
          arrowColor: '#141220', /* --nn-deep */
          backgroundColor: '#141220',
          overlayColor: 'rgba(4, 4, 10, 0.78)',
          primaryColor: '#a855f7', /* --nn-violet */
          textColor: '#eceaf4', /* --nn-text-primary */
          zIndex: 10000,
          showProgress: true,
          buttons: ['back', 'skip', 'primary'],
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Complete',
          next: 'Next',
          skip: 'Skip Tutorial',
        }}
      />
    </>
  );
}
