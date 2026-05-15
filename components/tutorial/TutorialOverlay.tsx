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
import Joyride, { Step, CallBackProps, STATUS, EVENTS, ACTIONS } from 'react-joyride';
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
   * Load initial tutorial state from server
   */
  useEffect(() => {
    if (!isEnabled) {
      setUiState(prev => ({ ...prev, isActive: false, isLoading: false }));
      return;
    }

    loadTutorialState();
  }, [playerId, isEnabled]);

  /**
   * Fetch current tutorial state from API
   */
  const loadTutorialState = async () => {
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

      setProgressPercent(calculateProgress(progress, quest));
      setJoyrideSteps([joyrideStep]);
      setRunJoyride(true);

    } catch (error) {
      console.error('Error loading tutorial state:', error);
      setUiState(prev => ({ ...prev, isLoading: false, isActive: false }));
    }
  };

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
      disableBeacon: true,
      placement: 'auto',
      spotlightPadding: 10,
      styles: {
        options: {
          arrowColor: '#1f2937',
          backgroundColor: '#1f2937',
          overlayColor: 'rgba(0, 0, 0, 0.7)',
          primaryColor: '#8b5cf6',
          textColor: '#f3f4f6',
          width: 'auto',
          zIndex: 1000,
        },
        tooltip: {
          borderRadius: 8,
          maxWidth: 380,
          fontSize: 14,
          padding: 16,
        },
      },
    };
  };

  /**
   * Calculate overall tutorial progress percentage
   */
  const calculateProgress = (progress: TutorialProgress, currentQuest?: TutorialQuest | null): number => {
    if (currentQuest && currentQuest.steps.length > 0) {
      return Math.round(((progress.currentStepIndex || 0) / currentQuest.steps.length) * 100);
    }
    const totalSteps = progress.totalStepsCompleted;
    const maxSteps = 22;
    return Math.round((totalSteps / maxSteps) * 100);
  };

  /**
   * Handle joyride callback events
   */
  const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
    const { status, action, type, index } = data;

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

  }, [uiState.currentQuest, uiState.currentStep]);

  /**
   * Handle step completion
   * Validates action and moves to next step
   */
  const handleStepComplete = async () => {
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
  };

  /**
   * Handle tutorial skip
   */
  const handleSkip = async () => {
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
  };

  // Don't render anything if tutorial is not active
  if (!uiState.isActive || uiState.isLoading) {
    return null;
  }

  return (
    <>
      {/* Tutorial Progress Bar (top of screen) */}
      {uiState.showOverlay && (
        <div className="tutorial-progress-bar fixed top-14 left-80 right-80 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-purple-500/30 rounded-b-lg">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-purple-400">Tutorial Progress</span>
                {uiState.currentQuest && (
                  <span className="text-xs text-gray-400">
                    {uiState.currentQuest.title}
                  </span>
                )}
              </div>
              <span className="text-xs font-mono text-gray-400">
                {progressPercent}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Joyride Component */}
      <Joyride
        steps={joyrideSteps}
        run={runJoyride}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
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
