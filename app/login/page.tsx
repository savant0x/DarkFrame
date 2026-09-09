/**
 * @file app/login/page.tsx
 * @created 2025-10-16
 * @updated 2026-09-08 (FID-20260908-006 §9.5: NEON NOIR redesign — HUD panel,
 * nn-input fields, nn-switch remember toggle; see rubric evidence in the FID)
 * @overview Login page with email/password authentication
 */

'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Mail, Lock, ShieldCheck } from 'lucide-react';

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
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--nn-void)' }}>
      <div className="w-full max-w-md">
        {/* Header — section instrument */}
        <div className="mb-8 text-center">
          <h1 className="nn-sec__title" style={{ fontSize: 26, letterSpacing: '0.3em' }}>
            DARK<span style={{ color: 'var(--nn-violet)' }}>FRAME</span>
          </h1>
          <p className="nn-lab" style={{ marginTop: 8, fontSize: 11 }}>
            Login to Continue Your Journey
          </p>
        </div>

        {/* Login Form — HUD panel with scanline header */}
        <div
          className="nn-panel nn-panel--x-pad"
          style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}
        >
          <div className="nn-panel__header nn-panel__header--bleed">
            <span className="nn-panel__icon"><ShieldCheck /></span>
            <h2 className="nn-panel__title">Authentication</h2>
            <span className="nn-panel__meta">Secure ▸ Encrypted</span>
          </div>

          <form onSubmit={handleSubmit} style={{ paddingTop: 18 }}>
            {/* Email Input */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="email" className="nn-lab" style={{ display: 'block', marginBottom: 6 }}>
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--nn-text-tertiary)' }}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="nn-input w-full"
                  style={{ paddingLeft: '2.25rem', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
                  placeholder="your.email@example.com"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="password" className="nn-lab" style={{ display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--nn-text-tertiary)' }}
                />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="nn-input w-full"
                  style={{ paddingLeft: '2.25rem', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Remember Me — square HUD switch (token component) */}
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <span className="nn-lab">Stay logged in for 30 days</span>
              <button
                type="button"
                role="switch"
                aria-checked={rememberMe}
                aria-label="Stay logged in for 30 days"
                onClick={() => setRememberMe(!rememberMe)}
                className={`nn-switch ${rememberMe ? 'nn-switch--on' : ''}`}
                disabled={isLoading}
              >
                <span className="nn-switch__knob" />
              </button>
            </div>

            {/* Error Message — semantic advisory strip */}
            {error && (
              <div className="nn-note" style={{ marginBottom: 16 }} role="alert">
                {error}
              </div>
            )}

            {/* Submit Button — outline instrument per sample §02 */}
            <button
              type="submit"
              disabled={isLoading}
              className="nn-btn nn-btn--primary"
              style={{ width: '100%', padding: '13px 20px' }}
            >
              {isLoading ? (
                <>
                  <span
                    className="nn-spin"
                    style={{
                      width: 14,
                      height: 14,
                      border: '2px solid color-mix(in oklab, var(--nn-cyan) 40%, transparent)',
                      borderBottomColor: 'transparent',
                      animation: 'nn-spin 0.9s linear infinite',
                      display: 'inline-block',
                    }}
                    aria-hidden
                  />
                  Authenticating…
                </>
              ) : (
                'LOGIN'
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="nn-row" style={{ justifyContent: 'center', paddingTop: 12 }}>
            <span className="nn-row__label">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="nn-link" style={{ marginLeft: 4 }}>
                Register here
              </Link>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="nn-lab">Secure authentication with encrypted credentials</p>
        </div>
      </div>
    </div>
  );
}
