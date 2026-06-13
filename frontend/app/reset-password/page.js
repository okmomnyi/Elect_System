'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';

function ResetPasswordInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') || '';

  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]                   = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await auth.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full py-3.5 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  if (!token) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 bg-error/10 text-error rounded-2xl border border-error/30">
          <span className="material-symbols-outlined text-base mt-0.5">error</span>
          <p className="text-sm font-bold">This reset link is missing a token. Please request a new one.</p>
        </div>
        <Link
          href="/forgot-password"
          className="block text-center w-full py-3 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-lg hover:opacity-90 transition-opacity"
        >
          Request new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200">
          <span className="material-symbols-outlined text-base mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <div className="text-sm">
            <p className="font-bold mb-1">Password updated.</p>
            <p className="text-emerald-700/90">Redirecting you to sign in…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-on-surface-variant mb-2">
          New password
        </label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">
            lock
          </span>
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="At least 8 characters"
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

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-on-surface-variant mb-2">
          Confirm new password
        </label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">
            lock
          </span>
          <input
            id="confirmPassword"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
            placeholder="Re-enter new password"
            className={`${inputCls} pl-12 pr-4`}
          />
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
        disabled={loading || !password || !confirmPassword}
        className="w-full py-3.5 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Updating…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-xl">key</span>
            Update password
          </>
        )}
      </button>

      <Link href="/login" className="block text-center text-sm font-bold text-primary hover:underline">
        ← Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary-container text-lg">account_balance</span>
          </div>
          <span className="font-headline font-extrabold text-primary text-lg">Academic Vote</span>
        </div>

        <div className="mb-8">
          <h2 className="font-headline font-extrabold text-3xl text-primary mb-2">Choose a new password</h2>
          <p className="text-on-surface-variant">Pick a password you don’t use anywhere else.</p>
        </div>

        <Suspense fallback={<div className="text-on-surface-variant">Loading…</div>}>
          <ResetPasswordInner />
        </Suspense>
      </div>
    </div>
  );
}
