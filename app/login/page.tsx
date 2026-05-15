/**
 * @file app/login/page.tsx
 * @created 2025-10-16
 * @overview Login page with email/password authentication
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
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
        
        router.push('/game');
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
    <div className="min-h-screen bg-[--void] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-[--electric] mb-2">DARKFRAME</h1>
          <p className="text-white/50 text-lg">Login to Continue Your Journey</p>
        </div>

        <div className="bg-[--card] border border-[--border] rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/60 mb-2">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[--void] border border-[--border] rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[--electric] focus:border-transparent transition-all"
                placeholder="your.email@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/60 mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[--void] border border-[--border] rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[--electric] focus:border-transparent transition-all"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[--electric] bg-[--void] border-[--border] rounded focus:ring-[--electric] focus:ring-2"
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-white/60">Remember me for 30 days</label>
            </div>

            {error && (
              <div className="bg-[--neon-red]/10 border border-[--neon-red]/20 rounded-lg p-3 text-[--neon-red] text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${
                isLoading
                  ? 'bg-white/10 cursor-not-allowed'
                  : 'bg-[--electric]/15 border border-[--electric]/25 text-[--electric] hover:bg-[--electric]/25'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Logging in...
                </span>
              ) : 'LOGIN'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/50 text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-[--electric] hover:text-white font-semibold transition-colors">Register here</Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-white/30 text-xs">Secure authentication with encrypted credentials</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
