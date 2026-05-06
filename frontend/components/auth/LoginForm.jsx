'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.login(email, password);
      router.push(`/verify?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full py-3.5 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-on-surface-variant mb-2">
          University email address
        </label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">
            mail
          </span>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            placeholder="you@university.edu"
            className={`${inputCls} pl-12 pr-4`}
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-on-surface-variant mb-2">
          Password
        </label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">
            lock
          </span>
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="Your password"
            className={`${inputCls} pl-12 pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
            tabIndex={-1}
          >
            <span className="material-symbols-outlined text-xl">
              {showPw ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-error flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full py-3.5 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Verifying…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-xl">shield</span>
            Continue — Send verification code
          </>
        )}
      </button>

      <p className="text-center text-xs text-on-surface-variant leading-relaxed">
        After your password is verified, a 6-digit code will be sent to your university inbox.
      </p>

      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-outline-variant/40" />
        <span className="text-xs text-on-surface-variant">or</span>
        <div className="flex-1 h-px bg-outline-variant/40" />
      </div>

      <Link
        href="/register"
        className="w-full py-3 border-2 border-outline-variant text-on-surface-variant rounded-xl font-bold text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-base">person_add</span>
        Create new account
      </Link>
    </form>
  );
}
