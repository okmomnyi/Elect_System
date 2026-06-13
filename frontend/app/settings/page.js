'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth, useAuth } from '@/hooks/useAuth';
import { auth as authApi } from '@/lib/api';

function Section({ title, description, children }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
      <div className="px-8 py-6 border-b border-surface-container">
        <h3 className="font-headline font-bold text-lg text-primary">{title}</h3>
        {description && <p className="text-sm text-on-surface-variant mt-1">{description}</p>}
      </div>
      <div className="px-8 py-6 space-y-6">{children}</div>
    </div>
  );
}

function SettingsRow({ label, description, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex-1">
        <p className="font-bold text-sm text-on-surface">{label}</p>
        {description && <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>}
      </div>
      <div className="sm:flex-shrink-0">{children}</div>
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]                   = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.message || 'Could not update password.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <div>
        <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Current password</label>
        <input
          type={showPw ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={e => { setCurrentPassword(e.target.value); setError(''); }}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-on-surface-variant mb-1.5">New password</label>
        <input
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={e => { setNewPassword(e.target.value); setError(''); }}
          className={inputCls}
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-on-surface-variant mb-1.5">Confirm new password</label>
        <input
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
          className={inputCls}
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
        <input type="checkbox" checked={showPw} onChange={() => setShowPw(v => !v)} className="rounded" />
        Show passwords
      </label>

      {error && (
        <p className="text-sm text-error flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-emerald-700 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          Password updated successfully.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
        className="px-5 py-2.5 btn-gradient text-on-primary rounded-xl font-bold text-sm shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-base">key</span>
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-outline-variant'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { logout } = useAuth();
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({
    newElection:   true,
    electionClose: true,
    voteConfirm:   true,
    results:       true,
    digest:        false,
  });
  const [privacy, setPrivacy] = useState({
    showVoteHistory: true,
    analyticsOptIn:  true,
  });

  // Load saved preferences for this device on mount.
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('voting:prefs') || '{}');
      if (stored.notifications) setNotifications(n => ({ ...n, ...stored.notifications }));
      if (stored.privacy) setPrivacy(p => ({ ...p, ...stored.privacy }));
    } catch { /* ignore malformed/unavailable storage */ }
  }, []);

  // Persist preferences so "Saved" reflects real, durable state (there is no
  // server-side preferences store yet — these are kept per-device).
  function handleSave() {
    try {
      localStorage.setItem('voting:prefs', JSON.stringify({ notifications, privacy }));
    } catch { /* storage unavailable (private mode) — fall through to toast */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleLogout() {
    await logout();
    window.location.href = '/login';
  }

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16">
          <div className="flex items-center gap-4">
            <h1 className="font-headline font-bold text-xl text-primary tracking-tight">Academic Vote</h1>
            <span className="h-4 w-px bg-outline-variant/40" />
            <span className="text-sm font-bold text-primary border-b-2 border-secondary pb-0.5">Settings</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-xs font-bold text-on-primary-container">
              {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h2 className="font-headline font-extrabold text-4xl text-primary tracking-tighter mb-2">Settings</h2>
          <p className="text-on-surface-variant">Manage your account preferences and notification settings.</p>
        </div>

        {/* Saved toast */}
        {saved && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200 text-sm font-bold">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Preferences saved successfully.
          </div>
        )}

        {/* Account Section */}
        <Section title="Account" description="Your identity within the Digital Dean portal.">
          <SettingsRow label="Full Name" description="Displayed on your voter profile">
            <div className="px-4 py-2.5 bg-surface-container rounded-xl text-sm text-on-surface font-medium min-w-[220px]">
              {user?.fullName || user?.full_name || '—'}
            </div>
          </SettingsRow>
          <SettingsRow label="Email Address" description="Your institutional email (used for OTP login)">
            <div className="px-4 py-2.5 bg-surface-container rounded-xl text-sm text-on-surface font-medium min-w-[220px]">
              {user?.email || '—'}
            </div>
          </SettingsRow>
          <SettingsRow label="Role" description="Your access level in the system">
            <span className="px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-xs font-bold uppercase tracking-widest">
              {user?.role || 'student'}
            </span>
          </SettingsRow>
          <SettingsRow label="Student ID" description="Your registered student identifier">
            <div className="px-4 py-2.5 bg-surface-container rounded-xl text-sm text-on-surface font-medium min-w-[220px] font-mono">
              {user?.studentId || user?.student_id || '—'}
            </div>
          </SettingsRow>
        </Section>

        {/* Notifications Section */}
        <Section title="Notifications" description="Control which email alerts you receive.">
          {[
            { key: 'newElection',   label: 'New Election Opened',       desc: 'When a new election becomes available for voting'   },
            { key: 'electionClose', label: 'Election Closing Soon',      desc: 'Reminder 24 hours before an election closes'       },
            { key: 'voteConfirm',   label: 'Vote Confirmation',          desc: 'Receipt email after casting your ballot'           },
            { key: 'results',       label: 'Results Published',          desc: 'When official results are certified and released'  },
            { key: 'digest',        label: 'Weekly Digest',              desc: 'Summary of all election activity each week'        },
          ].map(({ key, label, desc }) => (
            <SettingsRow key={key} label={label} description={desc}>
              <Toggle
                checked={notifications[key]}
                onChange={v => setNotifications(n => ({ ...n, [key]: v }))}
              />
            </SettingsRow>
          ))}
        </Section>

        {/* Privacy Section */}
        <Section title="Privacy" description="Control how your participation data is used.">
          {[
            { key: 'showVoteHistory', label: 'Show Voting History',      desc: 'Display past participation on your profile'              },
            { key: 'analyticsOptIn',  label: 'Participation Analytics',  desc: 'Contribute anonymised data to turnout reports'           },
          ].map(({ key, label, desc }) => (
            <SettingsRow key={key} label={label} description={desc}>
              <Toggle
                checked={privacy[key]}
                onChange={v => setPrivacy(p => ({ ...p, [key]: v }))}
              />
            </SettingsRow>
          ))}
        </Section>

        {/* Security Section */}
        <Section title="Security" description="Authentication and session management.">
          <SettingsRow label="Authentication Method" description="Password + 6-digit OTP sent to your email on every sign-in">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <span className="text-sm font-bold">Password + OTP</span>
            </div>
          </SettingsRow>
          <div className="pt-4 border-t border-surface-container">
            <p className="font-bold text-sm text-on-surface mb-1">Change Password</p>
            <p className="text-xs text-on-surface-variant mb-4">Use a strong password you don&apos;t use on other sites.</p>
            <ChangePasswordForm />
          </div>
          <SettingsRow label="Current Session" description="Sign out from this device">
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-error/30 text-error rounded-xl text-sm font-bold hover:bg-error hover:text-on-error transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              Sign Out
            </button>
          </SettingsRow>
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <Link href="/dashboard" className="text-primary font-bold text-sm flex items-center gap-2 group">
            <span className="material-symbols-outlined text-base group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Dashboard
          </Link>
          <button
            onClick={handleSave}
            className="px-8 py-3 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-md hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">save</span>
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
