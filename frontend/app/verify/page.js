'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OtpForm from '@/components/auth/OtpForm';

function VerifyInner() {
  const params = useSearchParams();
  const email  = params.get('email') || '';

  return (
    <div className="min-h-screen bg-surface flex flex-col md:flex-row">

      {/* ── Left brand panel ─────────────────────────────── */}
      <div className="hidden md:flex flex-col justify-between bg-primary text-on-primary w-[44%] p-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary-container rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-on-secondary-container text-xl">account_balance</span>
          </div>
          <span className="font-headline font-extrabold text-xl tracking-tight">Academic Vote</span>
        </div>
        <div className="relative z-10 space-y-6">
          <div className="w-16 h-16 bg-secondary-container/20 border border-secondary-container/30 rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary-container text-3xl">mark_email_read</span>
          </div>
          <h1 className="font-headline font-extrabold text-4xl leading-tight tracking-tight">Check your inbox.</h1>
          <p className="text-on-primary/65 text-base leading-relaxed max-w-xs">
            We sent a 6-digit verification code to your university email. It expires in 10 minutes.
          </p>
          <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-xs text-on-primary/50 mb-1 uppercase tracking-widest">Sent to</p>
            <p className="text-on-primary font-mono font-bold text-sm break-all">{email}</p>
          </div>
        </div>
        <p className="relative z-10 text-xs text-on-primary/40">© {new Date().getFullYear()} University Electoral Commission</p>
      </div>

      {/* ── Right form panel ─────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-14">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="flex items-center gap-3 mb-10 md:hidden">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary-container text-lg">account_balance</span>
            </div>
            <span className="font-headline font-extrabold text-primary text-lg">Academic Vote</span>
          </div>

          <div className="mb-8">
            <h2 className="font-headline font-extrabold text-3xl text-primary mb-2">Enter your code</h2>
            <p className="text-on-surface-variant text-sm">
              We sent a 6-digit code to{' '}
              <span className="font-bold text-on-surface">{email}</span>
            </p>
          </div>

          <OtpForm email={email} />

          <p className="mt-8 text-center text-xs text-on-surface-variant">
            Wrong email?{' '}
            <Link href="/login" className="font-bold text-primary hover:underline">Go back</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    }>
      <VerifyInner />
    </Suspense>
  );
}
