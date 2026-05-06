'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import { OTP_LENGTH, OTP_EXPIRY_SECONDS, OTP_RESEND_COOLDOWN } from '@/lib/constants';

export default function OtpForm({ email }) {
  const router   = useRouter();
  const [digits, setDigits]     = useState(Array(OTP_LENGTH).fill(''));
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeLeft, setTimeLeft] = useState(OTP_EXPIRY_SECONDS);
  const [isNewUser, setIsNewUser] = useState(false);
  const refs = useRef([]);

  // Countdown timer
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function handleChange(i, val) {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    setError('');
    if (v && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill('');
    text.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    refs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) { setError('Please enter all 6 digits.'); return; }
    setLoading(true);
    setError('');
    try {
      await auth.verifyOtp({
        email,
        otp,
        ...(fullName && { fullName }),
        ...(studentId && { studentId }),
      });
      router.push('/dashboard');
    } catch (err) {
      if (err.message?.includes('User not found') || err.message?.includes('new user')) {
        setIsNewUser(true);
        setError('Please provide your name to complete registration.');
      } else {
        setError(err.message || 'Invalid code. Please try again.');
      }
      setDigits(Array(OTP_LENGTH).fill(''));
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    try {
      await auth.requestOtp(email);
      setTimeLeft(OTP_EXPIRY_SECONDS);
      setResendCooldown(OTP_RESEND_COOLDOWN);
      setDigits(Array(OTP_LENGTH).fill(''));
      setError('');
      refs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    }
  }

  const otp = digits.join('');
  const progress = (timeLeft / OTP_EXPIRY_SECONDS) * 100;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Expiry bar */}
      <div>
        <div className="flex justify-between text-xs text-on-surface-variant mb-2">
          <span>Code expires in</span>
          <span className={`font-bold font-mono ${timeLeft < 60 ? 'text-error' : 'text-primary'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
        <div className="h-1 bg-surface-container rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timeLeft < 60 ? 'bg-error' : 'bg-primary'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* OTP digits */}
      <div className="flex justify-center gap-3" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            autoFocus={i === 0}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`otp-input ${d ? 'filled' : ''}`}
          />
        ))}
      </div>

      {/* Extra fields for new users */}
      {isNewUser && (
        <div className="space-y-3 p-4 bg-surface-container-low rounded-xl border border-outline-variant animate-fade-in">
          <p className="text-sm font-medium text-on-surface">Complete your profile</p>
          <input
            type="text"
            placeholder="Full name *"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <input
            type="text"
            placeholder="Student ID (optional)"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-error flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || otp.length < OTP_LENGTH || timeLeft === 0}
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
            <span className="material-symbols-outlined text-xl">verified</span>
            Verify &amp; Sign In
          </>
        )}
      </button>

      <div className="text-center">
        <p className="text-xs text-on-surface-variant">
          Didn't receive it?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="font-bold text-primary hover:underline disabled:text-outline disabled:no-underline disabled:cursor-default transition-colors"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </p>
      </div>
    </form>
  );
}
