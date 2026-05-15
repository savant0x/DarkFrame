'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return { strength: 0, label: '', color: '' };
    if (pwd.length < 8) return { strength: 1, label: 'Weak', color: 'bg-[--neon-red]' };
    let strength = 1;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    if (strength <= 2) return { strength: 1, label: 'Weak', color: 'bg-[--neon-red]' };
    if (strength === 3) return { strength: 2, label: 'Fair', color: 'bg-[--neon-yellow]' };
    if (strength === 4) return { strength: 3, label: 'Good', color: 'bg-[--electric]' };
    return { strength: 4, label: 'Strong', color: 'bg-[--synth]' };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(password)) { setError('Password must contain at least one uppercase letter'); return; }
    if (!/[a-z]/.test(password)) { setError('Password must contain at least one lowercase letter'); return; }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least one number'); return; }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await response.json();
      if (data.success) {
        router.push('/game');
      } else {
        const errorMessage = typeof data.error === 'object' && data.error?.message ? data.error.message : (typeof data.error === 'string' ? data.error : 'Registration failed');
        setError(errorMessage);
      }
    } catch (err) {
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
          <p className="text-white/50 text-lg">Create Your Commander Account</p>
        </div>

        <div className="bg-[--card] border border-[--border] rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-white/60 mb-2">Username</label>
              <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20}
                className="w-full px-4 py-3 bg-[--void] border border-[--border] rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[--electric] focus:border-transparent transition-all"
                placeholder="commander_name" disabled={isLoading} />
              <p className="text-xs text-white/30 mt-1">3-20 characters, letters, numbers, hyphens, underscores</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/60 mb-2">Email Address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 bg-[--void] border border-[--border] rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[--electric] focus:border-transparent transition-all"
                placeholder="your.email@example.com" disabled={isLoading} />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/60 mb-2">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-3 bg-[--void] border border-[--border] rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[--electric] focus:border-transparent transition-all"
                placeholder="••••••••" disabled={isLoading} />
              {password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                      <div className={`h-full ${passwordStrength.color} transition-all`} style={{ width: `${(passwordStrength.strength / 4) * 100}%` }} />
                    </div>
                    <span className="text-xs text-white/40">{passwordStrength.label}</span>
                  </div>
                  <p className="text-xs text-white/30">Min 8 chars, 1 uppercase, 1 lowercase, 1 number</p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/60 mb-2">Confirm Password</label>
              <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
                className="w-full px-4 py-3 bg-[--void] border border-[--border] rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[--electric] focus:border-transparent transition-all"
                placeholder="••••••••" disabled={isLoading} />
              {confirmPassword && (
                <p className={`text-xs mt-1 ${password === confirmPassword ? 'text-[--synth]' : 'text-[--neon-red]'}`}>
                  {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-[--neon-red]/10 border border-[--neon-red]/20 rounded-lg p-3 text-[--neon-red] text-sm">{error}</div>
            )}

            <button type="submit" disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${isLoading ? 'bg-white/10 cursor-not-allowed' : 'bg-[--electric]/15 border border-[--electric]/25 text-[--electric] hover:bg-[--electric]/25'}`}>
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Account...
                </span>
              ) : 'CREATE ACCOUNT'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/50 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-[--electric] hover:text-white font-semibold transition-colors">Login here</Link>
            </p>
          </div>
        </div>

        <div className="mt-6 bg-[--card] border border-[--border] rounded-lg p-4">
          <h3 className="font-bold text-white mb-2 text-sm">🎮 What is DarkFrame?</h3>
          <ul className="space-y-1 text-xs text-white/40">
            <li>• Navigate a persistent 150×150 tile world</li>
            <li>• Gather Metal ⚙️ and Energy ⚡ resources</li>
            <li>• Explore caves for rare items and diggers</li>
            <li>• Build factories and automate production</li>
          </ul>
        </div>

        <div className="mt-4 text-center">
          <p className="text-white/30 text-xs">Secure registration with encrypted credentials</p>
        </div>
      </div>
    </div>
  );
}
