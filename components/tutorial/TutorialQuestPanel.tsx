/**
 * Tutorial Quest Panel Component
 * Created: 2025-10-25
 * Feature: FID-20251025-101 - Interactive Tutorial Quest System
 * Enhanced: 2025-10-25 - Real-time tracking, progress bars, confetti celebrations
 * 
 * OVERVIEW:
 * Compact mini-quest tracker that stays visible in bottom-right corner
 * showing current tutorial objective, progress, and rewards.
 * 
 * RESPONSIBILITIES:
 * - Display current quest and step with real-time updates
 * - Show animated progress bars
 * - Visual success cues (confetti, animations)
 * - Real-time action tracking (moves, harvests, etc.)
 * - Allow quest skip/minimize
 * - Display upcoming rewards
 * 
 * DESIGN:
 * - Fixed position bottom-right corner
 * - Collapsible to minimize distraction
 * - Auto-hide on tutorial completion
 * - Animated transitions and celebrations
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { showError } from '@/lib/toastService';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { X, ChevronDown, ChevronUp, Trophy, Gift, CheckCircle2, Target, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { TutorialQuest, TutorialStep, TutorialProgress } from '@/types/tutorial.types';
import { parseDetailedHelp } from '@/lib/tutorialHelpParser';
import { logger } from '@/lib/logger';

interface TutorialQuestPanelProps {
  playerId: string;
  isVisible?: boolean;
  onSkip?: () => void;
  onMinimize?: () => void;
}

/**
 * Mini quest tracker panel component
 */
export default function TutorialQuestPanel({
  playerId,
  isVisible = true,
  onSkip,
}: TutorialQuestPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // FID-20260906-012 P2: the tutorial is a fixed OVERLAY docked against the
  // right sidebar's inner edge — mirroring the chat panel on the left. It
  // must NOT live inside the rail's DOM: the rail's backdrop-filter creates
  // a containing block that turns position:fixed into rail-relative, which
  // is what made the panel render deep inside the rail's scroll flow.
  // Mounted as a direct child of the layout root instead (GameLayout).
  const wrapperClasses =
    'nn-tutorial-dock w-[19rem] max-w-[calc(100vw-2rem)] space-y-2 transition-all duration-300';
  const [currentQuest, setCurrentQuest] = useState<TutorialQuest | null>(null);
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);
  // FID-20260909-037 egress fix: once the server reports no active quest
  // (completed / skipped / declined), the poller STOPS instead of firing
  // /api/tutorial every 3s forever (pg_stat_statements: 128K progress reads +
  // 130K action-tracking reads in one week from this single loop). Any action
  // handler that restarts or re-enters the tutorial clears this flag.
  const [pollTerminal, setPollTerminal] = useState(false);
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stepJustCompleted, setStepJustCompleted] = useState(false);
  const [questJustCompleted, setQuestJustCompleted] = useState(false);
  const [actionProgress, setActionProgress] = useState(0); // For tracking partial progress (e.g., 3/5 moves)
  const [actionTarget, setActionTarget] = useState(0); // Target count for action
  const [targetCoords, setTargetCoords] = useState<{ x: number; y: number } | null>(null); // For MOVE_TO_COORDS
  const [showDeclineModal, setShowDeclineModal] = useState(false); // Decline confirmation modal
  const [showFinalMessage, setShowFinalMessage] = useState(false); // Final farewell message
  const [isProcessingDecline, setIsProcessingDecline] = useState(false); // Processing decline request
  const previousStepRef = useRef<string | null>(null);
  const previousQuestRef = useRef<string | null>(null);
  // REMOVED: Client-side auto-complete timer (now handled server-side)
  // const autoCompleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  // REMOVED: Auto-complete timer effect (unreliable - server now handles this)

  /**
   * Load target coordinates for MOVE_TO_COORDS steps
   */
  useEffect(() => {
    // MOVE_TO_COORDS steps and MOVE steps with a coordinate target (the
    // tutorial's cave step — FID-20260909-025 §4.3) both carry resolved
    // targetX/targetY on validationData once the server resolves/persists them.
    if (currentStep && (currentStep.action === 'MOVE_TO_COORDS' || (currentStep.action === 'MOVE' && !!currentStep.targetCoordinates))) {
      // Check if validationData has static coordinates
      const staticTargetX = currentStep.validationData?.targetX;
      const staticTargetY = currentStep.validationData?.targetY;
      
      if (staticTargetX !== undefined && staticTargetY !== undefined) {
        // Static coordinates - set immediately
        setTargetCoords({ x: staticTargetX, y: staticTargetY });
      } else {
        // Dynamic coordinates - poll for them (generated on first move)
        // Self-scheduling poll for dynamically generated coords (created on
        // first move). 500ms starts; backs off to 2s while the coords don't
        // exist yet, so a slow step doesn't hammer the endpoint.
        let coordDelay = 500;
        let coordTimer: ReturnType<typeof setTimeout> | null = null;
        let coordCancelled = false;

        const pollCoords = async () => {
          if (coordCancelled) return;
          try {
            // FID-20260909-023 §3.1b: identity is session-derived server-side;
            // no playerId on the wire.
            const response = await fetch(`/api/tutorial/tracking?stepId=${currentStep.id}`);
            if (coordCancelled) return;
            if (response.ok) {
              const data = await response.json();
              if (data.targetX !== undefined && data.targetY !== undefined) {
                setTargetCoords({ x: data.targetX, y: data.targetY });
                return; // Stop polling once we have coords
              }
            }
          } catch (error) {
            logger.error('Failed to load target coordinates', error as Error);
          }
          coordDelay = Math.min(coordDelay * 2, 2000);
          coordTimer = setTimeout(pollCoords, coordDelay);
        };

        void pollCoords();

        return () => {
          coordCancelled = true;
          if (coordTimer) clearTimeout(coordTimer);
        };
      }
    } else {
      setTargetCoords(null);
    }
  }, [currentStep, playerId]);

  /**
   * Load current quest data with progress tracking
   */
  const loadQuestData = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tutorial?playerId=${playerId}`);
      if (!response.ok) {
        // Transient server error: leave state untouched, let the poller back off.
        logger.warn(`Tutorial state fetch failed (${response.status})`);
        return false;
      }
      const data = await response.json();

      if (data.quest && data.step) {
        // Detect step completion
        if (previousStepRef.current && previousStepRef.current !== data.step.id) {
          logger.info('Tutorial step completed', { completedStep: previousStepRef.current, nextStep: data.step.id });
          setStepJustCompleted(true);
          triggerConfetti('step');
          setTimeout(() => setStepJustCompleted(false), 2000);
        }

        // Detect quest completion
        if (previousQuestRef.current && previousQuestRef.current !== data.quest._id) {
          logger.info('Tutorial quest completed', { completedQuest: previousQuestRef.current, nextQuest: data.quest._id });
          setQuestJustCompleted(true);
          triggerConfetti('quest');
          setTimeout(() => setQuestJustCompleted(false), 3000);
        }

        previousStepRef.current = data.step.id;
        previousQuestRef.current = data.quest._id;

        setCurrentQuest(data.quest);
        setCurrentStep(data.step);
        setProgress(data.progress);

        // Parse action progress from validation data
        if (data.step.validationData) {
          const { currentCount, targetCount } = data.step.validationData;
          if (currentCount !== undefined && targetCount !== undefined) {
            setActionProgress(currentCount);
            setActionTarget(targetCount);
          } else {
            setActionProgress(0);
            setActionTarget(0);
          }
        } else {
          setActionProgress(0);
          setActionTarget(0);
        }
      } else {
        // Tutorial complete or not started — terminal state: stop polling.
        setPollTerminal(true);
        if (previousQuestRef.current) {
          // Just completed final quest
          setQuestJustCompleted(true);
          triggerConfetti('quest');
          setTimeout(() => {
            setCurrentQuest(null);
            setCurrentStep(null);
            setQuestJustCompleted(false);
          }, 3000);
        } else {
          setCurrentQuest(null);
          setCurrentStep(null);
        }
        previousStepRef.current = null;
        previousQuestRef.current = null;
      }

      setIsLoading(false);
      return true;
    } catch (error) {
      logger.error('Error loading quest data', error as Error);
      setIsLoading(false);
      return false;
    }
  }, [playerId]);

  useEffect(() => {
    if (!isVisible || pollTerminal) return;

    // Self-scheduling poll (same pattern as usePolling flood-fix): one request
    // in flight, next scheduled only after completion, exponential backoff on
    // failures. The old setInterval(…, 1000) fired a request every second no
    // matter what — overlapping serverless cold-starts and pile-ups on slow
    // networks (and a 500 body was parsed as data since response.ok was never
    // checked).
    let cancelled = false;
    let delay = 1000;
    const MAX_DELAY = 5000;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      const ok = await loadQuestData();
      if (cancelled) return;
      delay = ok ? 3000 : Math.min(delay * 2, MAX_DELAY); // 3s steady cadence, backoff to 5s on errors
      timer = setTimeout(tick, delay);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // pollTerminal in deps: flipping to true re-runs this effect, which exits
    // immediately (polling stops); flipping back to false on a tutorial
    // restart resumes the loop (FID-20260909-037).
  }, [playerId, isVisible, loadQuestData, pollTerminal]);

  /**
   * Trigger confetti celebration with error handling
   */
  const triggerConfetti = (type: 'step' | 'quest') => {
    try {
      if (type === 'step') {
        // Step completion - dramatic burst from center
        const duration = 2000;
        const animationEnd = Date.now() + duration;
        const defaults = { 
          startVelocity: 30, 
          spread: 360, 
          ticks: 60, 
          zIndex: 10000,
          colors: ['#9333ea', '#ec4899', '#fbbf24', '#34d399']
        };

        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        };

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }

          const particleCount = 50 * (timeLeft / duration);

          // Fire from center
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.4, 0.6), y: randomInRange(0.5, 0.7) }
          });
        }, 250);

      } else {
        // Quest completion - MEGA celebration from all sides
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const colors = ['#9333ea', '#ec4899', '#fbbf24', '#34d399', '#3b82f6', '#ef4444'];

        const frame = () => {
          // Fire from bottom corners
          confetti({
            particleCount: 7,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 1 },
            colors: colors,
            zIndex: 10000,
          });
          confetti({
            particleCount: 7,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 1 },
            colors: colors,
            zIndex: 10000,
          });

          // Fire from top corners
          confetti({
            particleCount: 5,
            angle: 300,
            spread: 55,
            origin: { x: 0, y: 0 },
            colors: colors,
            zIndex: 10000,
          });
          confetti({
            particleCount: 5,
            angle: 240,
            spread: 55,
            origin: { x: 1, y: 0 },
            colors: colors,
            zIndex: 10000,
          });

          // Center explosion
          if (Math.random() > 0.7) {
            confetti({
              particleCount: 10,
              spread: 360,
              origin: { x: 0.5, y: 0.5 },
              colors: colors,
              zIndex: 10000,
            });
          }

          if (Date.now() < animationEnd) {
            requestAnimationFrame(frame);
          }
        };

        frame();
      }
    } catch (error) {
      // Confetti library is non-critical, log error and continue
      logger.warn('Confetti celebration failed', { error, type });
    }
  };

  /**
   * Handle skip tutorial request
   */
  const handleSkip = async () => {
    if (await confirmDialog({ message: 'Are you sure you want to skip the tutorial? You can restart it later from settings.', danger: true, confirmLabel: 'Skip tutorial' })) {
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

        if (response.ok) {
          onSkip?.();
          setCurrentQuest(null);
          setCurrentStep(null);
        }
      } catch (error) {
        logger.error('Error skipping tutorial', error as Error);
      }
    }
  };

  /**
   * Handle quit button click - opens confirmation modal
   */
  const handleQuitClick = () => {
    setShowDeclineModal(true);
  };

  /**
   * Handle confirmed decline - permanent quit with forfeit
   */
  const handleConfirmDecline = async () => {
    setIsProcessingDecline(true);
    
    try {
      const response = await fetch('/api/tutorial/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          playerId,
          confirmed: true 
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Close modal and show final message
        setShowDeclineModal(false);
        setShowFinalMessage(true);
        
        // Disappear after 3 seconds
        setTimeout(() => {
          setShowFinalMessage(false);
          setCurrentQuest(null);
          setCurrentStep(null);
          onSkip?.(); // Trigger parent cleanup
        }, 3000);
      } else {
        // Show error
        showError(data.error || 'Failed to decline tutorial. Please try again.');
        setShowDeclineModal(false);
      }
    } catch (error) {
      logger.error('Decline error', error as Error);
      showError('Network error. Please try again.');
      setShowDeclineModal(false);
    } finally {
      setIsProcessingDecline(false);
    }
  };

  /**
   * Handle next button click to advance tutorial
   */
  const handleNext = async () => {
    if (!currentStep) {
      return;
    }

    try {
      const requestBody = {
        action: 'complete_step',
        playerId,
        questId: currentQuest?._id,
        stepId: currentStep.id,
      };

      const response = await fetch('/api/tutorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        await loadQuestData();
      } else {
        const error = await response.json();
        logger.error('Failed to complete tutorial step', error as Error);
      }
    } catch (error) {
      logger.error('Error advancing tutorial', error as Error);
    }
  };

  // Don't render if not visible, loading, or no quest
  if (!isVisible || isLoading || !currentQuest || !currentStep) {
    return null;
  }

  // Calculate quest progress percentage
  const questProgressPercent = progress
    ? ((progress.currentStepIndex + 1) / currentQuest.steps.length) * 100
    : 0;

  // Calculate quest progress text
  const questStepProgress = progress
    ? `${progress.currentStepIndex + 1}/${currentQuest.steps.length}`
    : '1/1';

  // Calculate action progress percentage (for steps with countable actions)
  const actionProgressPercent = actionTarget > 0
    ? (actionProgress / actionTarget) * 100
    : 0;

  // Get action type label
  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      MOVE: 'moves',
      HARVEST: 'harvests',
      ATTACK: 'attacks',
      RESEARCH: 'researches',
      CLICK_BUTTON: 'clicks',
      OPEN_PANEL: 'panels opened',
    };
    return labels[action] || 'actions';
  };

  /* FID-20260909-022: structured-help parsing moved to lib/tutorialHelpParser.ts —
     the same sections render in the quest panel and the joyride step windows. */

  return (
    <>
      {/* Main Quest Panel - docked inside the controls rail on lg+, floating below lg */}
      <div className={`tutorial-quest-panel ${wrapperClasses}`}>
      <div className={`nn-panel nn-panel--tut overflow-hidden transition-all duration-300 ${
        stepJustCompleted ? '!border-[color:var(--nn-green)] shadow-[0_0_24px_color-mix(in_oklab,var(--nn-green)_30%,transparent)] scale-105' : 
        questJustCompleted ? '!border-[color:var(--nn-violet)] shadow-[0_0_24px_color-mix(in_oklab,var(--nn-violet)_30%,transparent)] scale-105' :
        ''
      }`} style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}>
        {/* Corner controls — pinned to the panel's top-right edge (§04),
            outside the header flow so the header stays title + progress. */}
        <div className="nn-tut-ctl">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            aria-label={isCollapsed ? 'Expand tutorial' : 'Collapse tutorial'}
          >
            {isCollapsed ? (
              <ChevronUp />
            ) : (
              <ChevronDown />
            )}
          </button>
          <button
            onClick={handleSkip}
            title="Skip Tutorial"
            aria-label="Skip tutorial"
          >
            <X />
          </button>
        </div>
        {/* Header */}
        <div className="nn-panel__header px-4 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Trophy className={`nn-panel__icon ${questJustCompleted ? 'animate-bounce' : ''}`} />
              <span className="nn-panel__title">Tutorial Quest</span>
              {stepJustCompleted && (
                <CheckCircle2 className="w-4 h-4 text-[color:var(--nn-green)] nn-pulse" />
              )}
            </div>
          
            {/* Overall Quest Progress Bar */}
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="nn-lab">Progress</span>
                <span className="nn-num text-[color:var(--nn-violet)]">{questStepProgress}</span>
              </div>
              <div className="nn-meter h-2">
                <div 
                  className="nn-meter__fill transition-all duration-500 ease-out"
                  style={{ width: `${questProgressPercent}%`, background: 'var(--nn-violet)', boxShadow: '0 0 8px color-mix(in oklab, var(--nn-violet) 50%, transparent)' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content (collapsible) */}
        {!isCollapsed && (
          <div className="p-4">
            {/* Quest Title — quiet violet label; the step well carries the emphasis */}
            <div className="mb-3">
              <h3 className={`nn-lab !text-[color:var(--nn-violet)] !text-[10px] mb-1 ${
                questJustCompleted ? '!text-[color:var(--nn-green)]' : ''
              }`}>
                {currentQuest.title}
              </h3>
              <p className="text-xs text-[color:var(--nn-text-secondary)]">
                {currentQuest.description}
              </p>
            </div>

            {/* Current Step — FID-20260909-022: a vertical stack (step header →
                action-progress meter → deck footer). `.nn-well` is the HUD's
                flex-ROW primitive (label/value + side margins); stacking its
                three children as row siblings crushed them side-by-side and
                pushed the 13/15 progress span out of the panel. Plain tokens
                instead of the well + three inline flex-direction overrides. */}
            <div className={`mb-3 rounded-none border bg-[color-mix(in_oklab,var(--nn-void)_55%,transparent)] p-3 transition-all duration-300 ${
              stepJustCompleted ? 'border-[color-mix(in_oklab,var(--nn-green)_45%,transparent)]' : 'border-[color-mix(in_oklab,var(--nn-violet)_20%,transparent)]'
            }`}>
              <div className="mb-2 flex items-start gap-2">
                <div className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  stepJustCompleted 
                    ? 'scale-110 text-[color:var(--nn-green)]' 
                    : 'text-[color:var(--nn-violet)]'
                }`} style={stepJustCompleted ? { background: 'color-mix(in oklab, var(--nn-green) 18%, transparent)', boxShadow: '0 0 10px color-mix(in oklab, var(--nn-green) 35%, transparent)' } : { background: 'color-mix(in oklab, var(--nn-violet) 18%, transparent)' }}>
                  {stepJustCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span>{progress?.currentStepIndex !== undefined ? progress.currentStepIndex + 1 : 1}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className={`mb-1 break-words text-sm font-semibold transition-colors ${
                    stepJustCompleted ? 'text-[color:var(--nn-green)]' : 'text-[color:var(--nn-text-primary)]'
                  }`}>
                    {currentStep.title}
                  </h4>
                  <p className="break-words text-xs text-[color:var(--nn-text-secondary)]">
                    {currentStep.instruction}
                  </p>
                  
                  {/* Show target coordinates for MOVE_TO_COORDS steps and
                      coordinate-target MOVE steps (cave step) */}
                  {(currentStep.action === 'MOVE_TO_COORDS' || (currentStep.action === 'MOVE' && !!currentStep.targetCoordinates)) && targetCoords && (
                    <div className="mt-2 rounded-none border px-2 py-1 text-center" style={{ borderColor: 'color-mix(in oklab, var(--nn-violet) 30%, transparent)', background: 'color-mix(in oklab, var(--nn-violet) 10%, transparent)' }}>
                      {currentStep.validationData?.locationName ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-[color:var(--nn-text-primary)]">
                            {currentStep.validationData.locationName}
                          </span>
                          <span className="nn-num text-xs text-[color:var(--nn-violet)]">
                            ({targetCoords.x}, {targetCoords.y})
                          </span>
                        </div>
                      ) : (
                        <span className="nn-num text-xs text-[color:var(--nn-violet)]">
                          Target: ({targetCoords.x}, {targetCoords.y})
                        </span>
                      )}
                    </div>
                  )}
                  {(currentStep.action === 'MOVE_TO_COORDS' || (currentStep.action === 'MOVE' && !!currentStep.targetCoordinates)) && !targetCoords && (
                    <div className="mt-2 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_12%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_30%,transparent)] px-2 py-1 text-center">
                      <span className="nn-lab">
                        Loading target location…
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Progress Tracker (for steps with countable actions) */}
              {actionTarget > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <div className="nn-lab flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      <span>Progress</span>
                    </div>
                    <span className="nn-num font-bold text-[color:var(--nn-violet)]">
                      {actionProgress}/{actionTarget} {getActionLabel(currentStep.action)}
                    </span>
                  </div>
                  <div className="nn-meter h-2">
                    <div 
                      className="nn-meter__fill transition-all duration-300 ease-out"
                      style={{ width: `${actionProgressPercent}%`, background: 'var(--nn-green)', boxShadow: '0 0 8px color-mix(in oklab, var(--nn-green) 40%, transparent)' }}
                    />
                  </div>
                </div>
              )}

              {/* Step Progress — deck footer: violet meter row + ETA chip */}
              <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: 'color-mix(in oklab, var(--nn-violet) 16%, transparent)' }}>
                <span className="nn-lab" style={{ color: 'var(--nn-violet)' }}>
                  STEP {questStepProgress}
                </span>
                {currentStep.estimatedSeconds && (
                  <span
                    className="nn-num"
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      color: 'var(--nn-text-secondary)',
                      border: '1px solid color-mix(in oklab, var(--nn-violet) 25%, transparent)',
                      background: 'color-mix(in oklab, var(--nn-void) 40%, transparent)',
                      padding: '1px 6px',
                    }}
                  >
                    ETA {currentStep.estimatedSeconds}s
                  </span>
                )}
              </div>
            </div>

            {/* Help Text - Structured Sections */}
            {currentStep.detailedHelp && (() => {
              const sections = parseDetailedHelp(currentStep.detailedHelp);
              
              if (!sections) {
                // Fallback to simple display if parsing fails
                return (
                  <div className="mt-3 border-t border-[color-mix(in_oklab,var(--nn-violet)_16%,transparent)] pt-2">
                    <p className="break-words text-xs text-[color:var(--nn-text-secondary)]">{currentStep.detailedHelp}</p>
                  </div>
                );
              }

              return (
                <div className="mt-3 space-y-2 border-t border-[color-mix(in_oklab,var(--nn-violet)_16%,transparent)] pt-3">
                  {/* WHY Section — neutral well tokens, semantic label */}
                  {sections.why && (
                    <div className="rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_55%,transparent)] p-2.5">
                      <div className="flex items-start gap-2">
                        <span className="nn-lab" style={{ color: 'var(--nn-violet)' }}>WHY:</span>
                        <p className="flex-1 text-xs text-[color:var(--nn-text-secondary)]">{sections.why}</p>
                      </div>
                    </div>
                  )}

                  {/* WHEN Section */}
                  {sections.when && sections.when.length > 0 && (
                    <div className="rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_55%,transparent)] p-2.5">
                      <div className="nn-lab mb-1" style={{ color: 'var(--nn-cyan)' }}>WHEN TO USE:</div>
                      <ul className="ml-2 space-y-0.5">
                        {sections.when.map((item, index) => (
                          <li key={index} className="flex items-start gap-1 text-xs text-[color:var(--nn-text-secondary)]">
                            <span className="text-[color:var(--nn-cyan)]">•</span>
                            <span className="flex-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* HOW Section */}
                  {sections.how && sections.how.length > 0 && (
                    <div className="rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_55%,transparent)] p-2.5">
                      <div className="nn-lab mb-1" style={{ color: 'var(--nn-green)' }}>HOW TO USE:</div>
                      <ul className="ml-2 space-y-0.5">
                        {sections.how.map((item, index) => (
                          <li key={index} className="flex items-start gap-1 text-xs text-[color:var(--nn-text-secondary)]">
                            <span className="text-[color:var(--nn-green)]">•</span>
                            <span className="flex-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* PRO TIP Section */}
                  {sections.tip && (
                    <div className="rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_55%,transparent)] p-2.5">
                      <div className="flex items-start gap-2">
                        <span className="nn-lab" style={{ color: 'var(--nn-amber)' }}>TIP:</span>
                        <p className="flex-1 text-xs text-[color:var(--nn-text-secondary)]">{sections.tip}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Next Button (for read/info steps or manual progression) */}
            {(currentStep.action === 'READ_INFO' || currentStep.action === 'COLLECT_REWARD') && (
              <div className="mt-3">
                <button
                  onClick={handleNext}
                  className="nn-btn nn-btn--primary w-full px-4 py-2"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Collapsed State - Minimal Info Display */}
        {isCollapsed && (
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex-1 truncate text-sm font-semibold text-[color:var(--nn-text-primary)]">
                {currentStep.title}
              </h4>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {currentStep.validationData?.locationName && (
                  <div className="flex items-center gap-1 text-[color:var(--nn-violet)]">
                    <MapPin className="h-3 w-3" />
                    <span className="font-medium">{currentStep.validationData.locationName}</span>
                  </div>
                )}
                {targetCoords && (
                  <span className="nn-num text-xs text-[color:var(--nn-violet)]">
                    ({targetCoords.x}, {targetCoords.y})
                  </span>
                )}
              </div>
              <div className="nn-lab flex items-center gap-2">
                <span>STEP {progress?.currentStepIndex !== undefined ? progress.currentStepIndex + 1 : 1}/{currentQuest.steps.length}</span>
                {currentStep.estimatedSeconds && (
                  <span>ETA {currentStep.estimatedSeconds}s</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reward Boxes - Outside main panel (§04: neutral well + signal rail) */}
      {!isCollapsed && currentStep.reward && (
        <div className="nn-tut-reward" style={{ '--nn-accent': 'var(--nn-green)' } as React.CSSProperties}>
          <Gift />
          <div className="min-w-0">
            <div className="nn-tut-reward__lab">Step Reward</div>
            <div className="nn-tut-reward__text">{currentStep.reward.displayMessage}</div>
          </div>
        </div>
      )}

      {!isCollapsed && currentQuest.completionReward && (
        <div className="nn-tut-reward" style={{ '--nn-accent': 'var(--nn-violet)' } as React.CSSProperties}>
          <Trophy />
          <div className="min-w-0">
            <div className="nn-tut-reward__lab">Quest Completion</div>
            <div className="nn-tut-reward__text">{currentQuest.completionReward.displayMessage}</div>
          </div>
        </div>
      )}

      {/* Quit Tutorial Button - Separate Box at Bottom (§04 well) */}
      {!isCollapsed && (
        <div className="nn-tut-reward" style={{ '--nn-accent': 'var(--nn-magenta)' } as React.CSSProperties}>
          <button
            onClick={handleQuitClick}
            className="nn-btn nn-btn--danger"
          >
            <X />
            Quit Tutorial (Forfeit All Rewards)
          </button>
        </div>
      )}
    </div>

    {/* Decline Confirmation Modal */}
    {showDeclineModal && (
      <div className="fixed inset-0 flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] p-4 backdrop-blur-sm z-[9999]">
        <div className="w-full max-w-md rounded-none border p-6" style={{ borderColor: 'color-mix(in oklab, var(--nn-magenta) 55%, transparent)', background: 'oklch(0.13 0.03 265)', boxShadow: '0 0 40px color-mix(in oklab, var(--nn-magenta) 20%, transparent)' }}>
          <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-[color:var(--nn-magenta)]">
            Warning: Permanent Action
          </h3>
          
          <p className="mb-4 text-sm text-[color:var(--nn-text-secondary)]">
            Quitting the tutorial will <strong className="text-[color:var(--nn-magenta)]">permanently forfeit</strong> all rewards:
          </p>
          
          <ul className="mb-4 space-y-1.5 rounded-none border border-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_50%,transparent)] p-3 text-xs text-[color:var(--nn-text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[color:var(--nn-magenta)]">•</span>
              <span>Welcome Package (25,000-50,000 Metal & Energy)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[color:var(--nn-magenta)]">•</span>
              <span>Legendary/Rare Digger item</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[color:var(--nn-magenta)]">•</span>
              <span>XP Boost (15-25% for 3-7 days)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[color:var(--nn-magenta)]">•</span>
              <span>VIP Trial (1-3 days)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[color:var(--nn-magenta)]">•</span>
              <span>&quot;Tutorial Master&quot; Achievement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[color:var(--nn-magenta)]">•</span>
              <span>All progress rewards (~15,000 Metal)</span>
            </li>
          </ul>
          
          <div className="mb-6 rounded-none border p-3" style={{ borderColor: 'color-mix(in oklab, var(--nn-magenta) 30%, transparent)', background: 'color-mix(in oklab, var(--nn-magenta) 8%, transparent)' }}>
            <p className="text-center text-sm font-semibold text-[color:var(--nn-magenta)]">
              This decision is permanent and cannot be undone.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeclineModal(false)}
              disabled={isProcessingDecline}
              className="nn-btn nn-btn--ghost flex-1 px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDecline}
              disabled={isProcessingDecline}
              className="nn-btn nn-btn--danger flex-1 px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessingDecline ? 'Processing…' : 'I Understand - Quit Tutorial'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Final Farewell Message */}
    {showFinalMessage && (
      <div className="fixed inset-0 flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] p-4 backdrop-blur-sm z-[9999]">
        <div className="w-full max-w-md rounded-none border p-8 text-center" style={{ borderColor: 'color-mix(in oklab, var(--nn-amber) 50%, transparent)', background: 'oklch(0.13 0.03 265)', boxShadow: '0 0 40px color-mix(in oklab, var(--nn-amber) 20%, transparent)' }}>
          <h3 className="nn-panel__title mb-4 !text-lg !text-[color:var(--nn-amber)]">
            Tutorial Declined
          </h3>
          <p className="mb-2 text-sm text-[color:var(--nn-text-secondary)]">
            All rewards have been forfeited.
          </p>
          <p className="text-sm text-[color:var(--nn-text-secondary)]">
            You can now explore the game on your own. Good luck!
          </p>
        </div>
      </div>
    )}
    </>
  );
}
