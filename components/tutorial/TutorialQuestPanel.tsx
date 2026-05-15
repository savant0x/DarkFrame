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

function parseDetailedHelp(text: string) {
  if (!text) return null;
  const sections: { why?: string; when?: string[]; how?: string[]; tip?: string } = {};
  const parts = text.split(/\[(\w+)\]/);
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i].toLowerCase();
    const content = parts[i + 1]?.trim();
    if (!content) continue;
    if (key === 'why') sections.why = content;
    else if (key === 'when') sections.when = content.split('\n').map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    else if (key === 'how') sections.how = content.split('\n').map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    else if (key === 'tip') sections.tip = content;
  }
  return Object.keys(sections).length > 0 ? sections : null;
}

function getActionLabel(action: string) {
  if (action.includes('MOVE')) return 'moves';
  if (action.includes('HARVEST')) return 'harvests';
  if (action.includes('BUILD')) return 'builds';
  return 'actions';
}

export default function TutorialQuestPanel({
  playerId,
  isVisible = true,
  onSkip,
  onMinimize,
}: TutorialQuestPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const rightOffset = 'right-2 sm:right-4 lg:right-[19rem] xl:right-[21rem]';
  const [currentQuest, setCurrentQuest] = useState<TutorialQuest | null>(null);
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stepJustCompleted, setStepJustCompleted] = useState(false);
  const [questJustCompleted, setQuestJustCompleted] = useState(false);
  const [actionProgress, setActionProgress] = useState(0);
  const [actionTarget, setActionTarget] = useState(0);
  const [targetCoords, setTargetCoords] = useState<{ x: number; y: number } | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showFinalMessage, setShowFinalMessage] = useState(false);
  const [isProcessingDecline, setIsProcessingDecline] = useState(false);
  const previousStepRef = useRef<string | null>(null);
  const previousQuestRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentStep && currentStep.action === 'MOVE_TO_COORDS') {
      const staticTargetX = currentStep.validationData?.targetX;
      const staticTargetY = currentStep.validationData?.targetY;
      if (staticTargetX !== undefined && staticTargetY !== undefined) {
        setTargetCoords({ x: staticTargetX, y: staticTargetY });
      } else {
        const intervalId = setInterval(async () => {
          try {
            const response = await fetch(`/api/tutorial/tracking?playerId=${playerId}&stepId=${currentStep.id}`);
            if (response.ok) {
              const data = await response.json();
              if (data.targetX !== undefined && data.targetY !== undefined) {
                setTargetCoords({ x: data.targetX, y: data.targetY });
                clearInterval(intervalId);
              }
            }
          } catch (error) {
            logger.error('Failed to load target coordinates', error as Error);
          }
        }, 2000);
        return () => clearInterval(intervalId);
      }
    }
  }, [currentStep, playerId]);

  useEffect(() => {
    if (!isVisible || !playerId) return;
    const loadProgress = async () => {
      try {
        const response = await fetch(`/api/tutorial?playerId=${playerId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.quest && data.step) {
            setCurrentQuest(data.quest);
            setCurrentStep(data.step);
            setProgress(data.progress);
            setActionProgress(data.progress?.actionProgress || 0);
            setActionTarget(data.currentStep?.actionTarget || 0);
          } else {
            setCurrentQuest(null);
            setCurrentStep(null);
            setProgress(null);
          }
        }
      } catch (error) {
        logger.error('Failed to load tutorial progress', error as Error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProgress();
    const interval = setInterval(loadProgress, 5000);
    return () => clearInterval(interval);
  }, [isVisible, playerId]);

  useEffect(() => {
    if (currentStep && previousStepRef.current !== currentStep.id) {
      if (previousStepRef.current) {
        setStepJustCompleted(true);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        setTimeout(() => setStepJustCompleted(false), 2000);
      }
      previousStepRef.current = currentStep.id;
    }
  }, [currentStep?.id]);

  useEffect(() => {
    if (currentQuest && previousQuestRef.current !== (currentQuest.id || currentQuest._id)) {
      if (previousQuestRef.current) {
        setQuestJustCompleted(true);
        confetti({ particleCount: 100, spread: 100, origin: { y: 0.6 } });
        setTimeout(() => setQuestJustCompleted(false), 3000);
      }
      previousQuestRef.current = currentQuest.id || currentQuest._id || null;
    }
  }, [currentQuest?.id, currentQuest?._id]);

  const handleNext = async () => {
    try {
      await fetch('/api/tutorial/complete-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, stepId: currentStep?.id }),
      });
    } catch (error) {
      logger.error('Failed to complete step', error as Error);
    }
  };

  const handleSkip = () => { setShowDeclineModal(true); };
  const handleQuitClick = () => { setShowDeclineModal(true); };

  const handleConfirmDecline = async () => {
    setIsProcessingDecline(true);
    try {
      await fetch('/api/tutorial/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      setShowDeclineModal(false);
      setShowFinalMessage(true);
      setTimeout(() => { setShowFinalMessage(false); onSkip?.(); }, 3000);
    } catch (error) {
      logger.error('Failed to decline tutorial', error as Error);
    } finally {
      setIsProcessingDecline(false);
    }
  };

  if (!isVisible || isLoading) return null;
  if (!currentQuest || !currentStep) return null;

  const questProgressPercent = progress ? Math.round(((progress.currentStepIndex || 0) / currentQuest.steps.length) * 100) : 0;
  const actionProgressPercent = actionTarget > 0 ? Math.round((actionProgress / actionTarget) * 100) : 0;
  const questStepProgress = `${progress?.currentStepIndex !== undefined ? progress.currentStepIndex + 1 : 1}/${currentQuest.steps.length}`;

  return (
    <>
      <div className={`tutorial-quest-panel fixed bottom-2 sm:bottom-4 ${rightOffset} z-[9998] w-72 sm:w-80 space-y-2 transition-all duration-300 max-w-[calc(100vw-1rem)] sm:max-w-none`}>
        <div className={`bg-[--card] border rounded-lg overflow-hidden transition-all duration-300 ${
          stepJustCompleted ? 'border-[--synth] scale-105' :
          questJustCompleted ? 'border-[--neon-pink] scale-105' :
          'border-[--neon-pink]/20'
        }`}>
          <div className="bg-[--neon-pink]/5 border-b border-[--neon-pink]/20 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className={`w-4 h-4 text-[--neon-pink] ${questJustCompleted ? 'animate-bounce' : ''}`} />
                <span className="text-xs font-bold text-[--neon-pink]">Tutorial Quest</span>
                {stepJustCompleted && <CheckCircle2 className="w-4 h-4 text-[--synth] animate-pulse" />}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsCollapsed(!isCollapsed)} className="text-white/40 hover:text-white p-1 rounded transition-colors">
                  {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button onClick={handleSkip} className="text-white/40 hover:text-[--neon-red] p-1 rounded transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-[--neon-pink] mb-1">
                <span>Progress</span>
                <span className="font-bold">{questStepProgress}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div className="bg-[--neon-pink] h-full transition-all duration-500 ease-out" style={{ width: `${questProgressPercent}%` }} />
              </div>
            </div>
          </div>

          {!isCollapsed && (
            <div className="p-4">
              <div className="mb-3">
                <h3 className={`text-sm font-bold text-white mb-1 transition-all ${questJustCompleted ? 'text-[--synth]' : ''}`}>
                  {currentQuest.title}
                </h3>
                <p className="text-xs text-white/40">{currentQuest.description}</p>
              </div>

              <div className={`bg-white/[0.03] rounded-lg p-3 mb-3 border transition-all duration-300 ${
                stepJustCompleted ? 'border-[--synth] bg-[--synth]/5' : 'border-[--neon-pink]/15'
              }`}>
                <div className="flex items-start gap-2 mb-2">
                  <div className={`mt-1 w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
                    stepJustCompleted ? 'bg-[--synth] scale-110' : 'bg-[--neon-pink]/15 border border-[--neon-pink]/25'
                  }`}>
                    {stepJustCompleted ? <CheckCircle2 className="w-4 h-4" /> : <span>{progress?.currentStepIndex !== undefined ? progress.currentStepIndex + 1 : 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-semibold mb-1 break-words transition-colors ${stepJustCompleted ? 'text-[--synth]' : 'text-white'}`}>
                      {currentStep.title}
                    </h4>
                    <p className="text-xs text-white/50 break-words">{currentStep.instruction}</p>
                    {currentStep.action === 'MOVE_TO_COORDS' && targetCoords && (
                      <div className="mt-2 px-2 py-1 bg-[--neon-pink]/5 border border-[--neon-pink]/15 rounded text-center">
                        {currentStep.validationData?.locationName ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[--neon-pink] font-semibold">🎯 {currentStep.validationData.locationName}</span>
                            <span className="text-xs text-[--neon-pink] font-mono">({targetCoords.x}, {targetCoords.y})</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[--neon-pink] font-mono">🎯 Target: ({targetCoords.x}, {targetCoords.y})</span>
                        )}
                      </div>
                    )}
                    {currentStep.action === 'MOVE_TO_COORDS' && !targetCoords && (
                      <div className="mt-2 px-2 py-1 bg-white/[0.03] border border-[--border] rounded text-center">
                        <span className="text-xs text-white/30">Loading target location...</span>
                      </div>
                    )}
                  </div>
                </div>

                {actionTarget > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-white/40 mb-1">
                      <div className="flex items-center gap-1"><Target className="w-3 h-3" /><span>Progress</span></div>
                      <span className="font-bold text-[--neon-pink]">{actionProgress}/{actionTarget} {getActionLabel(currentStep.action)}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div className="bg-[--synth] h-full transition-all duration-300 ease-out" style={{ width: `${actionProgressPercent}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-white/40 mt-2">
                  <span>Step {questStepProgress}</span>
                  {currentStep.estimatedSeconds && <span>~{currentStep.estimatedSeconds}s</span>}
                </div>
              </div>

              {currentStep.detailedHelp && (() => {
                const sections = parseDetailedHelp(currentStep.detailedHelp);
                if (!sections) {
                  return (
                    <div className="mt-3 text-xs text-white/40 border-t border-[--border] pt-2">
                      <p className="break-words">💡 {currentStep.detailedHelp}</p>
                    </div>
                  );
                }
                return (
                  <div className="mt-3 border-t border-[--border] pt-3 space-y-2">
                    {sections.why && (
                      <div className="bg-[--neon-pink]/5 border border-[--neon-pink]/15 rounded-lg p-2">
                        <div className="flex items-start gap-2">
                          <span className="text-[--neon-pink] font-bold text-xs">🎯 WHY:</span>
                          <p className="text-xs text-white/50 flex-1">{sections.why}</p>
                        </div>
                      </div>
                    )}
                    {sections.when && sections.when.length > 0 && (
                      <div className="bg-[--electric]/5 border border-[--electric]/15 rounded-lg p-2">
                        <div className="text-[--electric] font-bold text-xs mb-1">🕐 WHEN TO USE:</div>
                        <ul className="space-y-0.5 ml-2">
                          {sections.when.map((item, index) => (
                            <li key={index} className="text-xs text-white/50 flex items-start gap-1">
                              <span className="text-[--electric]">•</span>
                              <span className="flex-1">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {sections.how && sections.how.length > 0 && (
                      <div className="bg-[--synth]/5 border border-[--synth]/15 rounded-lg p-2">
                        <div className="text-[--synth] font-bold text-xs mb-1">⚡ HOW TO USE:</div>
                        <ul className="space-y-0.5 ml-2">
                          {sections.how.map((item, index) => (
                            <li key={index} className="text-xs text-white/50 flex items-start gap-1">
                              <span className="text-[--synth]">•</span>
                              <span className="flex-1">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {sections.tip && (
                      <div className="bg-[--neon-yellow]/5 border border-[--neon-yellow]/15 rounded-lg p-2">
                        <div className="flex items-start gap-2">
                          <span className="text-[--neon-yellow] font-bold text-xs">💡 TIP:</span>
                          <p className="text-xs text-white/50 flex-1">{sections.tip}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(currentStep.action === 'READ_INFO' || currentStep.action === 'COLLECT_REWARD') && (
                <div className="mt-3">
                  <button onClick={handleNext}
                    className="w-full bg-[--neon-pink]/15 border border-[--neon-pink]/25 text-[--neon-pink] font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:bg-[--neon-pink]/25">
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {isCollapsed && (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-white truncate flex-1">{currentStep.title}</h4>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {currentStep.validationData?.locationName && (
                    <div className="flex items-center gap-1 text-[--neon-pink]">
                      <span className="text-[--neon-pink]">📍</span>
                      <span className="font-medium">{currentStep.validationData.locationName}</span>
                    </div>
                  )}
                  {targetCoords && <span className="text-[--neon-pink] font-mono text-xs">({targetCoords.x}, {targetCoords.y})</span>}
                </div>
                <div className="text-white/40 flex items-center gap-2">
                  <span>Step {progress?.currentStepIndex !== undefined ? progress.currentStepIndex + 1 : 1}/{currentQuest.steps.length}</span>
                  {currentStep.estimatedSeconds && <span>~{currentStep.estimatedSeconds}s</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {!isCollapsed && currentStep.reward && (
          <div className="bg-[--synth]/5 border border-[--synth]/15 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-[--synth] flex-shrink-0" />
              <span className="text-xs text-[--synth] break-words">{currentStep.reward.displayMessage}</span>
            </div>
          </div>
        )}

        {!isCollapsed && currentQuest.completionReward && (
          <div className="bg-[--neon-pink]/5 border border-[--neon-pink]/15 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[--neon-pink] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[--neon-pink] mb-1">Quest Completion Reward:</div>
                <div className="text-xs text-white/50 break-words">{currentQuest.completionReward.displayMessage}</div>
              </div>
            </div>
          </div>
        )}

        {!isCollapsed && (
          <div className="bg-[--neon-red]/5 border border-[--neon-red]/15 rounded-lg p-3">
            <button onClick={handleQuitClick}
              className="w-full px-4 py-2 bg-[--neon-red]/10 hover:bg-[--neon-red]/20 border border-[--neon-red]/20 hover:border-[--neon-red]/30 text-[--neon-red] hover:text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2">
              <X className="w-4 h-4" />
              Quit Tutorial (Forfeit All Rewards)
            </button>
          </div>
        )}
      </div>

      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-[--card] border-2 border-[--neon-red] rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-[--neon-red] mb-4 flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              Warning: Permanent Action
            </h3>
            <p className="text-white/60 mb-4 text-sm">
              Quitting the tutorial will <strong className="text-[--neon-red]">permanently forfeit</strong> all rewards:
            </p>
            <ul className="text-xs text-white/40 mb-4 space-y-1.5 bg-white/[0.03] rounded-lg p-3 border border-[--border]">
              <li className="flex items-start gap-2"><span className="text-[--neon-red] mt-0.5">•</span><span>Welcome Package (25,000-50,000 Metal & Energy)</span></li>
              <li className="flex items-start gap-2"><span className="text-[--neon-red] mt-0.5">•</span><span>Legendary/Rare Digger item</span></li>
              <li className="flex items-start gap-2"><span className="text-[--neon-red] mt-0.5">•</span><span>XP Boost (15-25% for 3-7 days)</span></li>
              <li className="flex items-start gap-2"><span className="text-[--neon-red] mt-0.5">•</span><span>VIP Trial (1-3 days)</span></li>
              <li className="flex items-start gap-2"><span className="text-[--neon-red] mt-0.5">•</span><span>"Tutorial Master" Achievement</span></li>
              <li className="flex items-start gap-2"><span className="text-[--neon-red] mt-0.5">•</span><span>All progress rewards (~15,000 Metal)</span></li>
            </ul>
            <div className="bg-[--neon-red]/5 border border-[--neon-red]/15 rounded-lg p-3 mb-6">
              <p className="text-[--neon-red] font-semibold text-sm text-center">This decision is permanent and cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeclineModal(false)} disabled={isProcessingDecline}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Cancel
              </button>
              <button onClick={handleConfirmDecline} disabled={isProcessingDecline}
                className="flex-1 px-4 py-2.5 bg-[--neon-red]/15 hover:bg-[--neon-red]/25 border border-[--neon-red]/25 text-[--neon-red] rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isProcessingDecline ? 'Processing...' : 'I Understand - Quit Tutorial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFinalMessage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
          <div className="bg-[--card] border-2 border-[--neon-yellow] rounded-xl p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">👋</div>
            <h3 className="text-2xl font-bold text-[--neon-yellow] mb-4">Tutorial Declined</h3>
            <p className="text-white/60 mb-2 text-sm">All rewards have been forfeited.</p>
            <p className="text-white/40 text-sm">You can now explore the game on your own. Good luck!</p>
          </div>
        </div>
      )}
    </>
  );
}
