'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';

export default function RegisterForm() {
  const router = useRouter();
  const [form, setForm]     = useState({ email: '', fullName: '', studentId: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await auth.register({
        email: form.email,
        fullName: form.fullName,
        password: form.password,
        ...(form.studentId && { studentId: form.studentId }),
      });
      router.push(`/verify?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full py-3.5 bg-surface-container-low border border-outline-variant rounded-xl text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">University email *</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">mail</span>
          <input
            type="email" required autoComplete="email"
            value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="you@university.edu"
            className={`${inputCls} pl-12 pr-4`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Full name *</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">person</span>
          <input
            type="text" required autoComplete="name"
            value={form.fullName} onChange={e => set('fullName', e.target.value)}
            placeholder="Jane Doe"
            className={`${inputCls} pl-12 pr-4`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Student ID <span className="text-outline">(optional)</span></label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">badge</span>
          <input
            type="text" autoComplete="off"
            value={form.studentId} onChange={e => set('studentId', e.target.value)}
            placeholder="e.g. CS/001/2024"
            className={`${inputCls} pl-12 pr-4`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Password *</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">lock</span>
          <input
            type={showPw ? 'text' : 'password'} required autoComplete="new-password"
            value={form.password} onChange={e => set('password', e.target.value)}
            placeholder="At least 8 characters"
            className={`${inputCls} pl-12 pr-12`}
          />
          <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-xl">{showPw ? 'visibility_off' : 'visibility'}</span>
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-on-surface-variant mb-2">Confirm password *</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">lock_reset</span>
          <input
            type={showPw ? 'text' : 'password'} required autoComplete="new-password"
            value={form.confirm} onChange={e => set('confirm', e.target.value)}
            placeholder="Repeat your password"
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
        disabled={loading || !form.email || !form.fullName || !form.password || !form.confirm}
        className="w-full py-3.5 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Creating account…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-xl">how_to_reg</span>
            Register &amp; send verification code
          </>
        )}
      </button>

      <p className="text-center text-xs text-on-surface-variant">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-primary hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
