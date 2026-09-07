/**
 * @file app/login/page.tsx
 * @created 2025-10-16
 * @overview Login page with email/password authentication
 */

'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Login successful, redirecting to game...');
        
        // Cookie handles authentication persistence
        // No need to save to localStorage - GameContext reads from JWT cookie
        
        // Hard navigation, not router.push: GameContext (mounted in the root layout)
        // runs its session check exactly once per mount. A soft push would reuse the
        // pre-login "no session" state and bounce straight back to /login.
        window.location.href = '/game';
      } else {
        // Extract message from error object (API returns {code, message, timestamp, stack})
        const errorMessage = typeof data.error === 'object' && data.error?.message 
          ? data.error.message 
          : (typeof data.error === 'string' ? data.error : 'Login failed');
        setError(errorMessage);
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[color:var(--nn-cyan)] to-[color:var(--nn-violet)] mb-2">
            DARKFRAME
          </h1>
          <p className="text-[color:var(--nn-text-secondary)] text-lg">
            Login to Continue Your Journey
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] backdrop-blur-sm border border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] rounded-none p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[color:var(--nn-text-secondary)] mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-[color:var(--nn-text-primary)] placeholder-[color:var(--nn-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] focus:border-transparent transition-all"
                placeholder="your.email@example.com"
                disabled={isLoading}
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[color:var(--nn-text-secondary)] mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-[color:var(--nn-void)] border border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none text-[color:var(--nn-text-primary)] placeholder-[color:var(--nn-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] focus:border-transparent transition-all"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[color:var(--nn-cyan)] bg-[color:var(--nn-void)] border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] rounded-none focus:ring-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] focus:ring-2"
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-[color:var(--nn-text-secondary)]">
                Remember me for 30 days
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-3 text-[color:var(--nn-magenta)] text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-none font-semibold text-[color:var(--nn-text-primary)] transition-all ${
                isLoading
                  ? 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] cursor-not-allowed'
                  : 'bg-gradient-to-r from-[color:var(--nn-cyan)] to-[color:var(--nn-violet)] hover:from-[color:var(--nn-cyan)] hover:to-[color:var(--nn-violet)] shadow-lg hover:shadow-[0_0_20px_color-mix(in_oklab,var(--nn-cyan)_40%,transparent)]'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Logging in...
                </span>
              ) : (
                'LOGIN'
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-[color:var(--nn-text-secondary)] text-sm">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="text-[color:var(--nn-cyan)] font-semibold transition-colors"
              >
                Register here
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[color:var(--nn-text-secondary)] text-xs">
            Secure authentication with encrypted credentials
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
