/**
 * VIP Upgrade Cancellation Page
 * 
 * OVERVIEW:
 * Displayed when user cancels Stripe checkout process before completing payment.
 * Provides reassurance, highlights VIP benefits, and offers easy path to retry
 * or return to game. Designed to reduce purchase anxiety and encourage conversion.
 * 
 * KEY FEATURES:
 * - Friendly cancellation message (no shame/pressure)
 * - Benefits reminder to encourage reconsideration
 * - Easy return to upgrade page
 * - Navigation back to game
 * - No session verification needed (just redirect)
 * 
 * USER FLOW:
 * 1. User clicks "Back" or "Cancel" during Stripe checkout
 * 2. Stripe redirects to this page
 * 3. User sees friendly cancellation message
 * 4. User can return to upgrade page or game
 * 
 * Created: 2025-10-24
 * Feature: FID-20251024-STRIPE
 * Author: ECHO v5.1
 */

'use client';

import Link from 'next/link';

/**
 * VIP Upgrade Cancellation Page
 * 
 * Static page (no server data needed) that reassures users after checkout
 * cancellation and provides clear navigation options.
 * 
 * @returns {JSX.Element} Cancellation page component
 */
export default function VIPUpgradeCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-2xl w-full bg-gray-800 border-2 border-yellow-500 rounded-lg shadow-2xl p-8">
        {/* Cancel Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
        
        {/* Cancellation Message */}
        <h1 className="text-4xl font-bold text-yellow-400 text-center mb-4">
          Checkout Cancelled
        </h1>
        
        <p className="text-xl text-gray-300 text-center mb-8">
          No worries! Your payment was not processed.
        </p>
        
        {/* Reassurance Notice */}
        <div className="bg-gray-700 border border-gray-600 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-300 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            What Happened?
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            You cancelled the checkout process before completing your payment. No charges
            were made to your account.
          </p>
          <p className="text-gray-300 text-sm leading-relaxed">
            You can return to the VIP upgrade page anytime you're ready to unlock premium
            features and join our VIP community!
          </p>
        </div>
        
        {/* Benefits Reminder */}
        <div className="bg-gradient-to-br from-purple-900 to-blue-900 bg-opacity-30 border border-purple-500 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            You're Missing Out On:
          </h3>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li className="flex items-start">
              <span className="text-purple-400 mr-2">★</span>
              <span><strong>Automated Resource Farming</strong> - Never manually farm again</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-400 mr-2">★</span>
              <span><strong>2x Resource Multiplier</strong> - Double your production efficiency</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-400 mr-2">★</span>
              <span><strong>Advanced Battle Analytics</strong> - Dominate with data-driven strategies</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-400 mr-2">★</span>
              <span><strong>Exclusive VIP Shop</strong> - Access premium items and gear</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-400 mr-2">★</span>
              <span><strong>Priority Support</strong> - Get help from our team faster</span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-400 mr-2">★</span>
              <span><strong>VIP Chat Badge</strong> - Stand out in the community</span>
            </li>
          </ul>
        </div>
        
        {/* Pricing Quick Reference */}
        <div className="bg-gray-700 rounded-lg p-4 mb-8">
          <p className="text-gray-300 text-sm text-center mb-2">
            Pricing starts at just <span className="text-green-400 font-bold">$9.99/week</span>
          </p>
          <p className="text-gray-400 text-xs text-center">
            Save up to <span className="text-yellow-400 font-semibold">33% with yearly subscription</span> ($199.99/year)
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Link
            href="/game/vip-upgrade"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Try Again - View VIP Plans
          </Link>
          <Link
            href="/game"
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors"
          >
            Return to Game
          </Link>
        </div>
        
        {/* FAQ / Concerns */}
        <div className="bg-gray-700 bg-opacity-50 rounded-lg p-6 mb-6">
          <h3 className="text-md font-semibold text-gray-300 mb-3">Common Concerns:</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-blue-300 font-semibold mb-1">Is my payment information secure?</p>
              <p className="text-gray-400">
                Absolutely. We use Stripe, a PCI-compliant payment processor trusted by millions.
                We never store your card details.
              </p>
            </div>
            <div>
              <p className="text-blue-300 font-semibold mb-1">Can I cancel my subscription anytime?</p>
              <p className="text-gray-400">
                Yes! Cancel anytime from your profile page. You'll keep VIP benefits until the
                end of your billing period.
              </p>
            </div>
            <div>
              <p className="text-blue-300 font-semibold mb-1">What if I have issues with VIP features?</p>
              <p className="text-gray-400">
                VIP members get priority support. Contact us through the help center and we'll
                resolve any issues quickly.
              </p>
            </div>
          </div>
        </div>
        
        {/* Support Link */}
        <div className="pt-6 border-t border-gray-700 text-center">
          <p className="text-gray-400 text-sm mb-2">
            Have questions before purchasing?
          </p>
          <Link
            href="/help"
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Contact Support - We're Here to Help
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * IMPLEMENTATION NOTES
 * ============================================================================
 * 
 * DESIGN PHILOSOPHY:
 * - Non-judgmental, friendly tone (no shame for cancelling)
 * - Emphasize benefits without being pushy
 * - Address common concerns that cause cancellation
 * - Make it easy to retry OR return to game
 * 
 * NO SESSION DATA NEEDED:
 * - Unlike success page, no session_id parameter required
 * - User just cancelled, no transaction to track
 * - Static content, fast load time
 * 
 * CONVERSION OPTIMIZATION:
 * - Benefits reminder highlights missed value
 * - Pricing reminder shows affordability
 * - FAQ addresses common objections (security, cancellation policy)
 * - Clear CTA to return to upgrade page
 * 
 * COLOR SCHEME:
 * - Yellow/purple theme (warning but not error)
 * - Purple gradient matches VIP branding
 * - Softer than red (which implies error/failure)
 * 
 * FUTURE ENHANCEMENTS:
 * - Track cancellation reasons via query params
 * - Show limited-time discount offer to encourage retry
 * - A/B test different messaging strategies
 * - Add testimonials from satisfied VIP users
 * - Offer live chat for immediate question answering
 */
