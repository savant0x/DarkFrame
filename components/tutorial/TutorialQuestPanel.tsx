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

import { useEffect, useState, useRef } from 'react';
import { X, ChevronDown, ChevronUp, Trophy, Gift, CheckCircle2, Target } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { TutorialQuest, TutorialStep, TutorialProgress } from '@/types/tutorial.types';
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
  onMinimize,
}: TutorialQuestPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Fixed position in bottom-right, offset to avoid right sidebar
  // Sidebar is lg:w-72 xl:w-80, so we offset by that amount + margin
  const rightOffset = 'right-2 sm:right-4 lg:right-[19rem] xl:right-[21rem]';
  const [currentQuest, setCurrentQuest] = useState<TutorialQuest | null>(null);
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);
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
    if (currentStep && currentStep.action === 'MOVE_TO_COORDS') {
      // Check if validationData has static coordinates
      const staticTargetX = currentStep.validationData?.targetX;
      const staticTargetY = currentStep.validationData?.targetY;
      
      if (staticTargetX !== undefined && staticTargetY !== undefined) {
        // Static coordinates - set immediately
        setTargetCoords({ x: staticTargetX, y: staticTargetY });
      } else {
        // Dynamic coordinates - poll for them (generated on first move)
        const intervalId = setInterval(async () => {
          try {
            const response = await fetch(`/api/tutorial/tracking?playerId=${playerId}&stepId=${currentStep.id}`);
            if (response.ok) {
              const data = await response.json();
              if (data.targetX !== undefined && data.targetY !== undefined) {
                setTargetCoords({ x: data.targetX, y: data.targetY });
                clearInterval(intervalId); // Stop polling once we have coords
              }
            }
          } catch (error) {
            logger.error('Failed to load target coordinates', error as Error);
          }
        }, 500);

        return () => clearInterval(intervalId);
      }
    } else {
      setTargetCoords(null);
    }
  }, [currentStep, playerId]);

  /**
   * Load current quest data with progress tracking
   */
  useEffect(() => {
    if (!isVisible) return;
    
    loadQuestData();
    
    // Refresh every 1 second for real-time updates
    const interval = setInterval(loadQuestData, 5000); // Poll every 5s, not 1s
    return () => clearInterval(interval);
  }, [playerId, isVisible]);

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
   * Fetch current tutorial state with change detection
   */
  const loadQuestData = async () => {
    try {
      const response = await fetch(`/api/tutorial?playerId=${playerId}`);
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
        // Tutorial complete or not started
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
    } catch (error) {
      logger.error('Error loading quest data', error as Error);
      setIsLoading(false);
    }
  };

  /**
   * Handle skip tutorial request
   */
  const handleSkip = async () => {
    if (confirm('Are you sure you want to skip the tutorial? You can restart it later from settings.')) {
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
        alert(data.error || 'Failed to decline tutorial. Please try again.');
        setShowDeclineModal(false);
      }
    } catch (error) {
      logger.error('Decline error', error as Error);
      alert('Network error. Please try again.');
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

  /**
   * Parse structured help text into sections (WHY, WHEN, HOW)
   * Returns organized sections for clean display
   */
  const parseDetailedHelp = (detailedHelp: string): { why?: string; when?: string[]; how?: string[]; tip?: string } | null => {
    if (!detailedHelp) return null;

    const sections: { why?: string; when?: string[]; how?: string[]; tip?: string } = {};
    
    // Extract WHY section
    const whyMatch = detailedHelp.match(/🎯 WHY:\s*([^\n]+)/);
    if (whyMatch) {
      sections.why = whyMatch[1].trim();
    }

    // Extract WHEN section (bullet points)
    const whenMatch = detailedHelp.match(/🕐 WHEN TO USE:\s*((?:•[^\n]+\n?)+)/);
    if (whenMatch) {
      sections.when = whenMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('•'))
        .map(line => line.replace('•', '').trim());
    }

    // Extract HOW section (bullet points)
    const howMatch = detailedHelp.match(/⚡ HOW TO (?:USE|EXPLORE):\s*((?:•[^\n]+\n?)+)/);
    if (howMatch) {
      sections.how = howMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('•'))
        .map(line => line.replace('•', '').trim());
    }

    // Extract PRO TIP
    const tipMatch = detailedHelp.match(/💡 PRO TIP:\s*([^\n]+)/);
    if (tipMatch) {
      sections.tip = tipMatch[1].trim();
    }

    return Object.keys(sections).length > 0 ? sections : null;
  };

  return (
    <>
      {/* Main Quest Panel - Positioned between right sidebar and chat panel */}
      <div className={`tutorial-quest-panel fixed bottom-2 sm:bottom-4 ${rightOffset} z-[9998] w-72 sm:w-80 space-y-2 transition-all duration-300 max-w-[calc(100vw-1rem)] sm:max-w-none`}>
      <div className={`bg-gradient-to-br from-gray-900 to-gray-800 border rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ${
        stepJustCompleted ? 'border-green-500 shadow-green-500/50 scale-105' : 
        questJustCompleted ? 'border-purple-500 shadow-purple-500/50 scale-105' :
        'border-purple-500/30'
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-purple-500/30 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className={`w-4 h-4 text-purple-400 ${questJustCompleted ? 'animate-bounce' : ''}`} />
              <span className="text-xs font-bold text-purple-300">Tutorial Quest</span>
              {stepJustCompleted && (
                <CheckCircle2 className="w-4 h-4 text-green-400 animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
                title="Skip Tutorial"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Overall Quest Progress Bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-purple-300 mb-1">
              <span>Progress</span>
              <span className="font-bold">{questStepProgress}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500 ease-out"
                style={{ width: `${questProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content (collapsible) */}
        {!isCollapsed && (
          <div className="p-4">
            {/* Quest Title */}
            <div className="mb-3">
              <h3 className={`text-sm font-bold text-white mb-1 transition-all ${
                questJustCompleted ? 'text-green-400' : ''
              }`}>
                {currentQuest.title}
              </h3>
              <p className="text-xs text-gray-400">
                {currentQuest.description}
              </p>
            </div>

            {/* Current Step */}
            <div className={`bg-gray-800/50 rounded-lg p-3 mb-3 border transition-all duration-300 ${
              stepJustCompleted ? 'border-green-500 bg-green-900/20' : 'border-purple-500/20'
            }`}>
              <div className="flex items-start gap-2 mb-2">
                <div className={`mt-1 w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
                  stepJustCompleted ? 'bg-green-500 scale-110' : 'bg-purple-600'
                }`}>
                  {stepJustCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span>{progress?.currentStepIndex !== undefined ? progress.currentStepIndex + 1 : 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-semibold mb-1 break-words transition-colors ${
                    stepJustCompleted ? 'text-green-400' : 'text-white'
                  }`}>
                    {currentStep.title}
                  </h4>
                  <p className="text-xs text-gray-300 break-words">
                    {currentStep.instruction}
                  </p>
                  
                  {/* Show target coordinates for MOVE_TO_COORDS steps */}
                  {currentStep.action === 'MOVE_TO_COORDS' && targetCoords && (
                    <div className="mt-2 px-2 py-1 bg-purple-900/30 border border-purple-500/30 rounded text-center">
                      {currentStep.validationData?.locationName ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-purple-200 font-semibold">
                            🎯 {currentStep.validationData.locationName}
                          </span>
                          <span className="text-xs text-purple-400 font-mono">
                            ({targetCoords.x}, {targetCoords.y})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-purple-300 font-mono">
                          🎯 Target: ({targetCoords.x}, {targetCoords.y})
                        </span>
                      )}
                    </div>
                  )}
                  {currentStep.action === 'MOVE_TO_COORDS' && !targetCoords && (
                    <div className="mt-2 px-2 py-1 bg-gray-900/30 border border-gray-500/30 rounded text-center">
                      <span className="text-xs text-gray-400">
                        Loading target location...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Progress Tracker (for steps with countable actions) */}
              {actionTarget > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      <span>Progress</span>
                    </div>
                    <span className="font-bold text-purple-300">
                      {actionProgress}/{actionTarget} {getActionLabel(currentStep.action)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-300 ease-out"
                      style={{ width: `${actionProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Step Progress */}
              <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                <span>Step {questStepProgress}</span>
                {currentStep.estimatedSeconds && (
                  <span>~{currentStep.estimatedSeconds}s</span>
                )}
              </div>
            </div>

            {/* Help Text - Structured Sections */}
            {currentStep.detailedHelp && (() => {
              const sections = parseDetailedHelp(currentStep.detailedHelp);
              
              if (!sections) {
                // Fallback to simple display if parsing fails
                return (
                  <div className="mt-3 text-xs text-gray-400 border-t border-gray-700 pt-2">
                    <p className="break-words">💡 {currentStep.detailedHelp}</p>
                  </div>
                );
              }

              return (
                <div className="mt-3 border-t border-gray-700 pt-3 space-y-2">
                  {/* WHY Section */}
                  {sections.why && (
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-2">
                      <div className="flex items-start gap-2">
                        <span className="text-purple-400 font-bold text-xs">🎯 WHY:</span>
                        <p className="text-xs text-gray-300 flex-1">{sections.why}</p>
                      </div>
                    </div>
                  )}

                  {/* WHEN Section */}
                  {sections.when && sections.when.length > 0 && (
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-2">
                      <div className="text-blue-400 font-bold text-xs mb-1">🕐 WHEN TO USE:</div>
                      <ul className="space-y-0.5 ml-2">
                        {sections.when.map((item, index) => (
                          <li key={index} className="text-xs text-gray-300 flex items-start gap-1">
                            <span className="text-blue-400">•</span>
                            <span className="flex-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* HOW Section */}
                  {sections.how && sections.how.length > 0 && (
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-2">
                      <div className="text-green-400 font-bold text-xs mb-1">⚡ HOW TO USE:</div>
                      <ul className="space-y-0.5 ml-2">
                        {sections.how.map((item, index) => (
                          <li key={index} className="text-xs text-gray-300 flex items-start gap-1">
                            <span className="text-green-400">•</span>
                            <span className="flex-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* PRO TIP Section */}
                  {sections.tip && (
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-2">
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-400 font-bold text-xs">💡 TIP:</span>
                        <p className="text-xs text-gray-300 flex-1">{sections.tip}</p>
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
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/50"
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
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white truncate flex-1">
                {currentStep.title}
              </h4>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {currentStep.validationData?.locationName && (
                  <div className="flex items-center gap-1 text-purple-300">
                    <span className="text-purple-400">📍</span>
                    <span className="font-medium">{currentStep.validationData.locationName}</span>
                  </div>
                )}
                {targetCoords && (
                  <span className="text-purple-400 font-mono text-xs">
                    ({targetCoords.x}, {targetCoords.y})
                  </span>
                )}
              </div>
              <div className="text-gray-400 flex items-center gap-2">
                <span>Step {progress?.currentStepIndex !== undefined ? progress.currentStepIndex + 1 : 1}/{currentQuest.steps.length}</span>
                {currentStep.estimatedSeconds && (
                  <span>~{currentStep.estimatedSeconds}s</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reward Boxes - Outside main panel */}
      {!isCollapsed && currentStep.reward && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-xs text-green-300 break-words">
              {currentStep.reward.displayMessage}
            </span>
          </div>
        </div>
      )}

      {!isCollapsed && currentQuest.completionReward && (
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-purple-300 mb-1">Quest Completion Reward:</div>
              <div className="text-xs text-gray-300 break-words">{currentQuest.completionReward.displayMessage}</div>
            </div>
          </div>
        </div>
      )}

      {/* Quit Tutorial Button - Separate Box at Bottom */}
      {!isCollapsed && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 shadow-lg">
          <button
            onClick={handleQuitClick}
            className="w-full px-4 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-500/40 hover:border-red-500/60 text-red-400 hover:text-red-300 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Quit Tutorial (Forfeit All Rewards)
          </button>
        </div>
      )}
    </div>

    {/* Decline Confirmation Modal */}
    {showDeclineModal && (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-red-500 rounded-xl p-6 max-w-md w-full shadow-2xl shadow-red-500/20">
          <h3 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            Warning: Permanent Action
          </h3>
          
          <p className="text-gray-300 mb-4 text-sm">
            Quitting the tutorial will <strong className="text-red-400">permanently forfeit</strong> all rewards:
          </p>
          
          <ul className="text-xs text-gray-400 mb-4 space-y-1.5 bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Welcome Package (25,000-50,000 Metal & Energy)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Legendary/Rare Digger item</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>XP Boost (15-25% for 3-7 days)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>VIP Trial (1-3 days)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>"Tutorial Master" Achievement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>All progress rewards (~15,000 Metal)</span>
            </li>
          </ul>
          
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-6">
            <p className="text-red-400 font-semibold text-sm text-center">
              This decision is permanent and cannot be undone.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeclineModal(false)}
              disabled={isProcessingDecline}
              className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDecline}
              disabled={isProcessingDecline}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessingDecline ? 'Processing...' : 'I Understand - Quit Tutorial'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Final Farewell Message */}
    {showFinalMessage && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-yellow-500 rounded-xl p-8 max-w-md w-full shadow-2xl shadow-yellow-500/20 text-center">
          <div className="text-6xl mb-4">👋</div>
          <h3 className="text-2xl font-bold text-yellow-500 mb-4">
            Tutorial Declined
          </h3>
          <p className="text-gray-300 mb-2 text-sm">
            All rewards have been forfeited.
          </p>
          <p className="text-gray-400 text-sm">
            You can now explore the game on your own. Good luck!
          </p>
        </div>
      </div>
    )}
    </>
  );
}
