/**
 * Clan XP Progress Component
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Animated XP progress bar with real-time updates, level up notifications,
 * and milestone alerts. Provides visual feedback for XP gains with smooth
 * animations and celebratory effects for level ups and milestones.
 * 
 * Features:
 * - Smooth animated progress bar with gradient
 * - Real-time XP gain detection
 * - Level up notification toast with confetti effect
 * - Milestone achievement alert modal
 * - XP gain floating animation (+100 XP)
 * - Percentage display
 * - Next level preview
 * 
 * Props:
 * - currentXP: Current XP within level
 * - totalXP: Total XP to next level
 * - level: Current level
 * - onLevelUp: Callback when level up detected
 * - onMilestone: Callback when milestone reached
 * - showAnimations: Enable/disable animations
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { formatNumberAbbreviated } from '@/utils/formatting';

interface ClanXPProgressProps {
  currentXP: number;
  totalXP: number;
  level: number;
  onLevelUp?: (newLevel: number) => void;
  onMilestone?: (milestone: any) => void;
  showAnimations?: boolean;
}

export default function ClanXPProgress({
  currentXP,
  totalXP,
  level,
  onLevelUp,
  onMilestone,
  showAnimations = true,
}: ClanXPProgressProps) {
  const [progress, setProgress] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [xpGains, setXpGains] = useState<{ id: number; amount: number }[]>([]);
  const previousLevelRef = useRef(level);
  const previousXPRef = useRef(currentXP);
  const xpGainIdRef = useRef(0);

  // Calculate progress percentage
  useEffect(() => {
    const percentage = totalXP > 0 ? Math.min((currentXP / totalXP) * 100, 100) : 0;
    setProgress(percentage);
  }, [currentXP, totalXP]);

  // Detect level up
  useEffect(() => {
    if (level > previousLevelRef.current) {
      if (showAnimations) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 5000);
      }
      onLevelUp?.(level);

      // Check if milestone
      const milestones = [5, 10, 15, 20, 25, 30, 40, 50];
      if (milestones.includes(level)) {
        if (showAnimations) {
          setShowMilestone(true);
          setTimeout(() => setShowMilestone(false), 7000);
        }
        onMilestone?.({ level });
      }
    }
    previousLevelRef.current = level;
  }, [level, onLevelUp, onMilestone, showAnimations]);

  // Detect XP gain
  useEffect(() => {
    const xpDiff = currentXP - previousXPRef.current;
    if (xpDiff > 0 && showAnimations) {
      const id = xpGainIdRef.current++;
      setXpGains((prev) => [...prev, { id, amount: xpDiff }]);
      setTimeout(() => {
        setXpGains((prev) => prev.filter((gain) => gain.id !== id));
      }, 2000);
    }
    previousXPRef.current = currentXP;
  }, [currentXP, showAnimations]);

  return (
    <div className="relative">
      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">
            {formatNumberAbbreviated(currentXP)} / {formatNumberAbbreviated(totalXP)} XP
          </span>
          <span className="text-cyan-400 font-bold">{progress.toFixed(1)}%</span>
        </div>

        <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden shadow-inner">
          {/* Animated progress fill */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>

          {/* Progress text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-sm drop-shadow-lg">
              Level {level}
            </span>
          </div>
        </div>
      </div>

      {/* XP Gain Floating Animations */}
      {xpGains.map((gain) => (
        <div
          key={gain.id}
          className="absolute top-0 right-0 text-green-400 font-bold text-lg animate-float-up pointer-events-none"
        >
          +{formatNumberAbbreviated(gain.amount)} XP
        </div>
      ))}

      {/* Level Up Notification */}
      {showLevelUp && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-in">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-8 py-4 rounded-lg shadow-2xl border-4 border-yellow-300">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <div className="text-2xl font-bold">LEVEL UP!</div>
              <div className="text-xl">Clan Level {level}</div>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Achievement */}
      {showMilestone && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-gradient-to-b from-purple-900 to-gray-900 border-4 border-purple-500 rounded-lg p-8 max-w-md shadow-2xl animate-scale-in">
            <div className="text-center space-y-4">
              <div className="text-6xl">🏆</div>
              <div className="text-3xl font-bold text-yellow-400">
                MILESTONE REACHED!
              </div>
              <div className="text-2xl text-white">Level {level}</div>
              <div className="text-gray-300">
                Your clan has reached a major milestone!
              </div>
              <button
                onClick={() => setShowMilestone(false)}
                className="px-6 py-3 bg-purple-700 hover:bg-purple-600 text-white rounded-lg font-bold transition mt-4"
              >
                Awesome!
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-50px);
          }
        }

        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: translate(-50%, -100px) scale(0.5);
          }
          50% {
            transform: translate(-50%, 10px) scale(1.1);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-float-up {
          animation: float-up 2s ease-out forwards;
        }

        .animate-bounce-in {
          animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
      `}</style>
    </div>
  );
}

