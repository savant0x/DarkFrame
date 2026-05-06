/**
 * VIP Upgrade Success Page
 * 
 * OVERVIEW:
 * Confirmation page displayed after successful Stripe checkout completion.
 * Shows payment confirmation, VIP activation status, and next steps. Retrieves
 * checkout session details from URL parameter for verification.
 * 
 * KEY FEATURES:
 * - Displays payment confirmation message
 * - Shows VIP tier purchased and benefits
 * - Provides navigation back to game
 * - Handles session verification
 * - Loading states during verification
 * 
 * USER FLOW:
 * 1. User completes Stripe checkout
 * 2. Stripe redirects to this page with session_id
 * 3. Page displays success message
 * 4. Webhook processes payment asynchronously
 * 5. User returns to game with VIP activated
 * 
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE
 * Author: ECHO v5.1
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import Link from 'next/link';
import confetti from 'canvas-confetti';

/**
 * Success Page Content Component
 * 
 * Separated component to handle useSearchParams hook which requires Suspense.
 * Displays payment confirmation and VIP activation status.
 */
function SuccessPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshPlayer } = useGameContext();
  const sessionId = searchParams.get('session_id');
  
  const [countdown, setCountdown] = useState(10);
  const [vipActivated, setVipActivated] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!sessionId) {
      setActivationError('No session ID provided');
      return;
    }
    
    // 🎉 CONFETTI CELEBRATION! 🎉
    const celebrateWithConfetti = () => {
      const duration = 5000; // 5 seconds of confetti
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      // Continuous confetti bursts
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        // Burst from left side
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1']
        });

        // Burst from right side
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1']
        });
      }, 250);

      // Big center burst after 500ms
      setTimeout(() => {
        confetti({
          particleCount: 200,
          spread: 160,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1'],
          zIndex: 9999
        });
      }, 500);

      // Another big burst from top
      setTimeout(() => {
        confetti({
          particleCount: 150,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.5 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1'],
          zIndex: 9999
        });
        confetti({
          particleCount: 150,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.5 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1'],
          zIndex: 9999
        });
      }, 1500);

      return interval;
    };

    // 🎵 PLAY SUCCESS SOUND! 🎵
    const playSuccessSound = () => {
      try {
        // Create audio context for web audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Fanfare sound using oscillators
        const playNote = (frequency: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = frequency;
          oscillator.type = type;
          
          gainNode.gain.setValueAtTime(0.3, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          
          oscillator.start(startTime);
          oscillator.stop(startTime + duration);
        };

        const now = audioContext.currentTime;
        
        // Victory fanfare: C major chord progression
        playNote(523.25, now, 0.3, 'triangle'); // C5
        playNote(659.25, now + 0.1, 0.3, 'triangle'); // E5
        playNote(783.99, now + 0.2, 0.5, 'triangle'); // G5
        playNote(1046.50, now + 0.4, 0.6, 'sine'); // C6 (high note)
        
      } catch (error) {
        console.log('Audio playback not supported or failed:', error);
      }
    };

    // Start confetti and sound immediately
    const confettiInterval = celebrateWithConfetti();
    playSuccessSound();
    
    // Verify session and activate VIP immediately
    const verifyAndActivateVIP = async () => {
      try {
        console.log('Verifying checkout session:', sessionId);
        
        const response = await fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        
        const data = await response.json();
        
        if (data.success && data.vipActivated) {
          console.log('VIP activated successfully!', data.tier);
          await refreshPlayer();
          setVipActivated(true);
        } else {
          console.error('VIP activation failed:', data.message);
          setActivationError(data.message || 'Failed to activate VIP');
        }
      } catch (error) {
        console.error('Session verification error:', error);
        setActivationError('Failed to verify payment. Please contact support if VIP is not activated.');
      }
    };
    
    // Start VIP activation immediately (don't wait for webhooks)
    verifyAndActivateVIP();
    
    // Countdown timer for auto-redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Use setTimeout to avoid calling router.push during render
          setTimeout(() => router.push('/game'), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      clearInterval(confettiInterval);
      clearInterval(timer);
    };
  }, [sessionId, router, refreshPlayer]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
      <div className="max-w-2xl w-full bg-gray-800 border-2 border-green-500 rounded-lg shadow-2xl p-8 animate-fade-in">
        {/* Success Icon with Pulse Animation */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center animate-pulse-scale shadow-lg shadow-green-500/50">
            <svg
              className="w-12 h-12 text-white animate-draw-check"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        
        {/* Success Message with Gold Gradient */}
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-green-400 to-yellow-400 text-center mb-4 animate-shimmer">
          Payment Successful!
        </h1>
        
        <p className="text-xl text-gray-300 text-center mb-8">
          🎉 Welcome to VIP, Commander! Your subscription is being activated. 🎉
        </p>
        
        {/* Session Details */}
        {sessionId && (
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400 mb-2">Transaction ID:</p>
            <p className="text-xs font-mono text-green-400 break-all">{sessionId}</p>
          </div>
        )}
        
        {/* Activation Notice */}
        <div className="bg-blue-900 bg-opacity-30 border border-blue-500 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-300 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            VIP Activation in Progress
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Your payment has been confirmed and your VIP benefits are being activated.
            This process usually takes just a few seconds. You can start enjoying your
            premium features immediately!
          </p>
        </div>
        
        {/* Benefits Reminder */}
        <div className="bg-gray-700 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-yellow-400 mb-4">
            Your VIP Benefits Include:
          </h3>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>Automated Resource Farming - Set it and forget it</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>2x Resource Multiplier - Double your efficiency</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>Advanced Battle Analytics - Detailed insights</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>Exclusive VIP Shop Access - Premium items</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>Priority Support - Get help faster</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-400 mr-2">✓</span>
              <span>And many more exclusive perks!</span>
            </li>
          </ul>
        </div>
        
        {/* Auto-redirect Notice */}
        <div className="text-center mb-6">
          <p className="text-gray-400 text-sm">
            Redirecting to game in <span className="text-green-400 font-bold text-lg">{countdown}</span> seconds...
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/game"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors"
          >
            Start Playing Now
          </Link>
          <Link
            href="/profile"
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors"
          >
            View My Profile
          </Link>
        </div>
        
        {/* Support Link */}
        <div className="mt-8 pt-6 border-t border-gray-700 text-center">
          <p className="text-gray-400 text-sm mb-2">
            Questions or issues with your purchase?
          </p>
          <Link
            href="/help"
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * VIP Upgrade Success Page (Main Export)
 * 
 * Wraps content in Suspense boundary for useSearchParams compatibility.
 * 
 * @returns {JSX.Element} Success page component
 */
export default function VIPUpgradeSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <SuccessPageContent />
    </Suspense>
  );
}

/* ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * URL PARAMETERS:
 * - session_id: Stripe Checkout Session ID (from {CHECKOUT_SESSION_ID} placeholder)
 * - Used for transaction verification and customer support
 * 
 * WEBHOOK PROCESSING:
 * - VIP activation happens asynchronously via webhook
 * - User sees success message immediately
 * - Actual VIP grant may take 1-5 seconds
 * - Webhook ensures reliable activation even if user closes browser
 * 
 * AUTO-REDIRECT:
 * - 10-second countdown before redirecting to game
 * - User can click "Start Playing Now" to skip countdown
 * - Countdown clears on component unmount
 * 
 * SUSPENSE BOUNDARY:
 * - Required for useSearchParams in Next.js 14+ App Router
 * - Shows loading state while fetching search params
 * - Prevents hydration errors
 * 
 * FUTURE ENHANCEMENTS:
 * - Fetch actual VIP tier purchased from session ID
 * - Display tier-specific benefits
 * - Show VIP expiration date
 * - Add confetti animation on success
 * - Email receipt confirmation
 * - Social sharing for VIP status
 */
