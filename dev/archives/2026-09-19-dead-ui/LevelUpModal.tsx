/**
 * Level-Up Modal Component
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Celebration modal displayed when player gains a level.
 * Shows level-up animation, rewards earned (Research Points),
 * and new unlocks available at the new level.
 * 
 * FEATURES:
 * - Animated level-up celebration
 * - RP rewards display
 * - New unlocks notification
 * - Confetti/particle effects
 * - Auto-dismiss or manual close
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface LevelUpModalProps {
  newLevel: number;
  levelsGained: number;
  rpAwarded: number;
  totalRP: number;
  onClose: () => void;
  autoCloseDelay?: number; // Auto-close after N milliseconds (0 = manual only)
}

export default function LevelUpModal({
  newLevel,
  levelsGained,
  rpAwarded,
  totalRP,
  onClose,
  autoCloseDelay = 5000
}: LevelUpModalProps) {
  
  const [visible, setVisible] = useState(true);
  
  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 300); // Wait for fade-out animation
  }, [onClose]);
  
  // Auto-close timer
  useEffect(() => {
    if (autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [autoCloseDelay, handleClose]);
  
  // Check for level-based unlocks
  const getUnlocks = (level: number): string[] => {
    const unlocks: string[] = [];
    
    if (level === 5) unlocks.push('🔓 Tier 2 Units Available (Spend 5 RP to unlock)');
    if (level === 10) unlocks.push('🔓 Tier 3 Units Available (Spend 15 RP to unlock)');
    if (level === 20) unlocks.push('🔓 Tier 4 Units Available (Spend 30 RP to unlock)');
    if (level === 30) unlocks.push('🔓 Tier 5 Units Available (Spend 50 RP to unlock)');
    
    // Research features (future)
    if (level === 5) unlocks.push('🔬 Research system unlocked');
    if (level === 10) unlocks.push('🏆 Advanced combat tactics available');
    if (level === 15) unlocks.push('🎖️ Elite commander abilities');
    
    return unlocks;
  };
  
  const unlocks = getUnlocks(newLevel);
  
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--nn-void)_70%,transparent)] transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative bg-gradient-to-br from-[color:var(--nn-amber)] via-[color:var(--nn-amber)] to-[color:var(--nn-amber)] border-4 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-8 max-w-md w-full shadow-2xl transform transition-all duration-300 ${
          visible ? 'scale-100' : 'scale-75'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Stars Background */}
        <div className="absolute inset-0 overflow-hidden rounded-none pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute text-[color:var(--nn-amber)] animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                fontSize: `${Math.random() * 1 + 0.5}rem`
              }}
            >
              ⭐
            </div>
          ))}
        </div>
        
        {/* Content */}
        <div className="relative z-10">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-5xl font-bold text-[color:var(--nn-amber)] mb-2 animate-bounce">
              LEVEL UP!
            </h1>
            <div className="text-3xl font-bold text-[color:var(--nn-text-primary)]">
              Level {newLevel}
              {levelsGained > 1 && (
                <span className="text-xl text-[color:var(--nn-amber)] ml-2">
                  (+{levelsGained} levels!)
                </span>
              )}
            </div>
          </div>
          
          {/* Rewards */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_30%,transparent)] rounded-none p-4 mb-4">
            <h3 className="text-center text-[color:var(--nn-amber)] font-bold mb-3">
              🎁 Rewards Earned
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] rounded-none p-3">
                <span className="text-[color:var(--nn-violet)]">Research Points:</span>
                <span className="text-2xl font-bold text-[color:var(--nn-violet)]">
                  +{rpAwarded} RP
                </span>
              </div>
              <div className="text-center text-sm text-[color:var(--nn-text-secondary)]">
                Total RP: {totalRP}
              </div>
            </div>
          </div>
          
          {/* Unlocks */}
          {unlocks.length > 0 && (
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_30%,transparent)] rounded-none p-4 mb-4">
              <h3 className="text-center text-[color:var(--nn-green)] font-bold mb-3">
                🔓 New Unlocks Available
              </h3>
              <ul className="space-y-2">
                {unlocks.map((unlock, index) => (
                  <li
                    key={index}
                    className="text-sm text-[color:var(--nn-green)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] rounded-none p-2 border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)]"
                  >
                    {unlock}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="w-full bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] font-bold py-3 px-6 rounded-none transition-colors transform hover:scale-105"
          >
            Awesome! ✨
          </button>
          
          {/* Auto-close indicator */}
          {autoCloseDelay > 0 && (
            <div className="text-center text-xs text-[color:var(--nn-text-secondary)] mt-2">
              Auto-closing in {Math.ceil(autoCloseDelay / 1000)}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Visual Effects:
 *    - Twinkling stars animation
 *    - Gradient background (yellow/orange theme)
 *    - Bounce animation on "LEVEL UP!" text
 *    - Hover effects on close button
 *    - Smooth fade-in/out transitions
 * 
 * 2. Auto-Close:
 *    - Default 5 seconds (configurable)
 *    - Set to 0 for manual close only
 *    - Countdown indicator for UX clarity
 *    - Can still close manually before timer
 * 
 * 3. Unlock System:
 *    - Level-based checks for unit tiers
 *    - Future: Research features, abilities
 *    - Visual distinction (green theme for unlocks)
 *    - Clear messaging on requirements (RP cost)
 * 
 * 4. Accessibility:
 *    - Click outside to close
 *    - Stop propagation on modal content
 *    - Keyboard navigation support (future: ESC key)
 *    - Screen reader friendly text
 * 
 * 5. Future Enhancements:
 *    - Confetti particle system (canvas animation)
 *    - Sound effects for level-up
 *    - Fireworks animation
 *    - Social sharing button
 *    - Level-up streak tracking
 *    - Special animations for milestone levels (10, 25, 50, 100)
 */

// CSS for twinkle animation (add to global styles)
const _styles = `
@keyframes twinkle {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.5); }
}

.animate-twinkle {
  animation: twinkle 2s ease-in-out infinite;
}
`;
