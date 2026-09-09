/**
 * @file app/register/page.tsx
 * @created 2025-10-16
 * @updated 2026-09-08 (FID-20260908-007: NEON NOIR redesign — nn-panel Enlistment
 * console, nn-input fields, nn-meter strength gauge; logic byte-preserved)
 * @overview Registration page with email/password authentication
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Lock, ShieldCheck, KeyRound } from 'lucide-react';

// Strength tiers — semantic signal mapping (weak=magenta … strong=green).
// glow only on strong per the glow discipline.
const STRENGTH_TIERS = [
  { label: 'Weak', color: 'var(--nn-magenta)', glow: false },
  { label: 'Fair', color: 'var(--nn-amber)', glow: false },
  { label: 'Good', color: 'var(--nn-cyan)', glow: false },
  { label: 'Strong', color: 'var(--nn-green)', glow: true },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Password strength indicator (1-4; logic unchanged)
  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return { strength: 0, label: '', color: '' };
    if (pwd.length < 8) return { strength: 1, label: 'Weak', color: 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]' };

    let strength = 1;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    if (strength <= 2) return { strength: 1, label: 'Weak', color: 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]' };
    if (strength === 3) return { strength: 2, label: 'Fair', color: 'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]' };
    if (strength === 4) return { strength: 3, label: 'Good', color: 'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]' };
    return { strength: 4, label: 'Strong', color: 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]' };
  };

  const passwordStrength = getPasswordStrength(password);
  const tier = STRENGTH_TIERS[Math.max(0, passwordStrength.strength - 1)];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Registration successful, redirecting to game...');
        router.push('/game');
      } else {
        // Extract message from error object (API returns {code, message, timestamp, stack})
        const errorMessage = typeof data.error === 'object' && data.error?.message
          ? data.error.message
          : (typeof data.error === 'string' ? data.error : 'Registration failed');
        setError(errorMessage);
      }
    } catch (err) {
      console.error('❌ Registration error:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10" style={{ background: 'var(--nn-void)' }}>
      <div className="w-full max-w-md">
        {/* Header — section instrument (parity with login §9.5) */}
        <div className="mb-8 text-center">
          <h1 className="nn-sec__title" style={{ fontSize: 26, letterSpacing: '0.3em' }}>
            DARK<span style={{ color: 'var(--nn-violet)' }}>FRAME</span>
          </h1>
          <p className="nn-lab" style={{ marginTop: 8, fontSize: 11 }}>
            Create Your Commander Account
          </p>
        </div>

        {/* Registration Form — HUD panel with scanline header */}
        <div
          className="nn-panel nn-panel--x-pad"
          style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}
        >
          <div className="nn-panel__header nn-panel__header--bleed">
            <span className="nn-panel__icon"><ShieldCheck /></span>
            <h2 className="nn-panel__title">Enlistment</h2>
            <span className="nn-panel__meta">New Commander ▸ Encrypted</span>
          </div>

          <form onSubmit={handleSubmit} style={{ paddingTop: 18 }}>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="username" className="nn-lab" style={{ display: 'block', marginBottom: 6 }}>
                Username
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--nn-text-tertiary)' }}
                />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="username"
                  className="nn-input w-full"
                  style={{ paddingLeft: '2.25rem', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
                  placeholder="commander_name"
                  disabled={isLoading}
                />
              </div>
              <p className="nn-lab" style={{ marginTop: 4, fontSize: 10 }}>
                3-20 characters · letters, numbers, hyphens, underscores
              </p>
            </div>

            {/* Email */}
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

            {/* Password */}
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
                  autoComplete="new-password"
                  className="nn-input w-full"
                  style={{ paddingLeft: '2.25rem', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>

              {/* Strength — HUD meter (semantic signal, glow on strong only) */}
              {password && (
                <div style={{ marginTop: 8 }}>
                  <div className="nn-meter" style={{ height: 6 }}>
                    <div
                      style={{
                        width: `${(passwordStrength.strength / 4) * 100}%`,
                        height: '100%',
                        background: tier.color,
                        boxShadow: tier.glow ? '0 0 8px color-mix(in oklab, var(--nn-green) 60%, transparent)' : 'none',
                        transition: 'width var(--nn-time-fast, 120ms) linear',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                    <span className="nn-lab" style={{ color: tier.color }}>{passwordStrength.label}</span>
                    <span className="nn-lab" style={{ fontSize: 10 }}>Min 8 · Aa · 0-9</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="confirmPassword" className="nn-lab" style={{ display: 'block', marginBottom: 6 }}>
                Confirm Password
              </label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--nn-text-tertiary)' }}
                />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="nn-input w-full"
                  style={{ paddingLeft: '2.25rem', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
              {/* Match indicator — semantic green/magenta */}
              {confirmPassword && (
                <p
                  className="nn-lab"
                  style={{
                    marginTop: 4,
                    color: password === confirmPassword ? 'var(--nn-green)' : 'var(--nn-magenta)',
                  }}
                >
                  {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            {/* Error — semantic advisory strip */}
            {error && (
              <div className="nn-note" style={{ marginBottom: 16 }} role="alert">
                {error}
              </div>
            )}

            {/* Submit — outline instrument per sample §02 */}
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
                  Enlisting…
                </>
              ) : (
                'CREATE ACCOUNT'
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="nn-row" style={{ justifyContent: 'center', paddingTop: 12 }}>
            <span className="nn-row__label">
              Already have an account?{' '}
              <Link href="/login" className="nn-link" style={{ marginLeft: 4 }}>
                Login here
              </Link>
            </span>
          </div>
        </div>

        {/* Game Info — brief block (emoji slab removed) */}
        <div className="nn-brief" style={{ marginTop: 20 }}>
          <div className="nn-brief__head">
            <strong>What is DarkFrame?</strong>
          </div>
          <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
            <li className="nn-lab" style={{ marginBottom: 3 }}>▸ Navigate a persistent 150×150 tile world</li>
            <li className="nn-lab" style={{ marginBottom: 3 }}>▸ Gather Metal and Energy resources</li>
            <li className="nn-lab" style={{ marginBottom: 3 }}>▸ Explore caves for rare items and diggers</li>
            <li className="nn-lab">▸ Build factories and automate production</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <p className="nn-lab">Secure registration with encrypted credentials</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// END OF FILE
// ============================================================
