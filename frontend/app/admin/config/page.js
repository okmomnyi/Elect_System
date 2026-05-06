'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRequireAdmin } from '@/hooks/useAuth';

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

function ConfigRow({ label, description, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex-1">
        <p className="font-bold text-sm text-on-surface">{label}</p>
        {description && <p className="text-xs text-on-surface-variant mt-0.5 max-w-md">{description}</p>}
      </div>
      <div className="sm:flex-shrink-0">{children}</div>
    </div>
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

function Input({ value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="px-4 py-2.5 bg-surface-container-highest/40 border border-outline-variant/20 rounded-xl text-sm text-on-surface font-medium outline-none focus:border-secondary focus:bg-surface-container-lowest transition-all min-w-[220px] disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

export default function AdminConfigPage() {
  const { user, loading: authLoading } = useRequireAdmin();
  const isSuperAdmin = user?.role === 'super_admin';
  const [saved, setSaved] = useState(false);

  const [email, setEmail] = useState({
    senderName:    'University Voting System',
    senderEmail:   'no-reply@university.edu',
    allowedDomain: '@university.edu',
  });

  const [voting, setVoting] = useState({
    allowMultipleDevices: false,
    requireEmailVerify:   true,
    showLiveTally:        false,
    auditLogRetention:    '90',
    maxCandidatesPerElection: '20',
  });

  const [security, setSecurity] = useState({
    otpExpiryMinutes:   '10',
    sessionExpiryHours: '24',
    maxLoginAttempts:   '5',
    enableRateLimit:    true,
  });

  const [maintenance, setMaintenance] = useState({
    maintenanceMode: false,
    debugMode:       false,
  });

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
          <div className="flex items-center gap-8">
            <span className="font-headline font-extrabold text-xl text-primary tracking-tight">Academic Vote</span>
            <nav className="hidden md:flex gap-6">
              {[
                { href: '/admin',            label: 'Elections'  },
                { href: '/admin/candidates', label: 'Candidates' },
                { href: '/admin/results',    label: 'Results'    },
                { href: '/admin/audit',      label: 'Audit Logs' },
                { href: '/admin/config',     label: 'Config'     },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors border-b-2 pb-0.5 ${
                    href === '/admin/config'
                      ? 'text-primary border-secondary'
                      : 'text-on-surface-variant border-transparent hover:text-primary hover:border-secondary'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-on-surface-variant hover:text-primary">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-xs font-bold text-on-primary-container">
              {user?.fullName?.charAt(0) || 'A'}
            </div>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <h1 className="font-headline font-extrabold text-5xl text-primary tracking-tighter mb-3">
              System Configuration
            </h1>
            <p className="text-on-surface-variant text-lg max-w-xl">
              Configure platform-wide settings, email, security, and voting rules.
            </p>
          </div>
          {!isSuperAdmin && (
            <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm">
              <span className="material-symbols-outlined text-amber-600 text-base">lock</span>
              <span className="text-amber-700 font-medium">Some settings require Super Admin access.</span>
            </div>
          )}
        </div>

        {/* Saved toast */}
        {saved && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200 text-sm font-bold">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Configuration saved successfully.
          </div>
        )}

        {/* Email Settings */}
        <Section title="Email & Notifications" description="Configure the sender identity used for OTP and vote receipt emails.">
          <ConfigRow label="Sender Name" description="Displayed as the 'From' name in all system emails">
            <Input
              value={email.senderName}
              onChange={v => setEmail(e => ({ ...e, senderName: v }))}
              placeholder="University Voting System"
              disabled={!isSuperAdmin}
            />
          </ConfigRow>
          <ConfigRow label="Sender Email" description="The reply-to address for outbound emails">
            <Input
              value={email.senderEmail}
              onChange={v => setEmail(e => ({ ...e, senderEmail: v }))}
              placeholder="no-reply@university.edu"
              type="email"
              disabled={!isSuperAdmin}
            />
          </ConfigRow>
          <ConfigRow label="Allowed Email Domain" description="Only users with this domain can register and vote">
            <Input
              value={email.allowedDomain}
              onChange={v => setEmail(e => ({ ...e, allowedDomain: v }))}
              placeholder="@university.edu"
              disabled={!isSuperAdmin}
            />
          </ConfigRow>
        </Section>

        {/* Voting Rules */}
        <Section title="Voting Rules" description="Configure global voting behaviour and constraints.">
          <ConfigRow label="Allow Multiple Devices" description="Permit voters to access the portal from multiple devices simultaneously">
            <Toggle
              checked={voting.allowMultipleDevices}
              onChange={v => setVoting(s => ({ ...s, allowMultipleDevices: v }))}
            />
          </ConfigRow>
          <ConfigRow label="Require Email Verification" description="Mandate OTP verification before allowing votes">
            <Toggle
              checked={voting.requireEmailVerify}
              onChange={v => setVoting(s => ({ ...s, requireEmailVerify: v }))}
            />
          </ConfigRow>
          <ConfigRow label="Show Live Tally" description="Display real-time vote counts to voters during an active election">
            <Toggle
              checked={voting.showLiveTally}
              onChange={v => setVoting(s => ({ ...s, showLiveTally: v }))}
            />
          </ConfigRow>
          <ConfigRow label="Audit Log Retention (days)" description="How long audit log entries are retained before cleanup">
            <Input
              value={voting.auditLogRetention}
              onChange={v => setVoting(s => ({ ...s, auditLogRetention: v }))}
              placeholder="90"
              type="number"
              disabled={!isSuperAdmin}
            />
          </ConfigRow>
          <ConfigRow label="Max Candidates per Election" description="Upper limit on candidates that can be added to a single election">
            <Input
              value={voting.maxCandidatesPerElection}
              onChange={v => setVoting(s => ({ ...s, maxCandidatesPerElection: v }))}
              placeholder="20"
              type="number"
            />
          </ConfigRow>
        </Section>

        {/* Security */}
        <Section title="Security" description="Authentication and rate limiting configuration.">
          <ConfigRow label="OTP Expiry (minutes)" description="How long a one-time password remains valid after generation">
            <Input
              value={security.otpExpiryMinutes}
              onChange={v => setSecurity(s => ({ ...s, otpExpiryMinutes: v }))}
              placeholder="10"
              type="number"
              disabled={!isSuperAdmin}
            />
          </ConfigRow>
          <ConfigRow label="Session Expiry (hours)" description="JWT token lifetime before users must re-authenticate">
            <Input
              value={security.sessionExpiryHours}
              onChange={v => setSecurity(s => ({ ...s, sessionExpiryHours: v }))}
              placeholder="24"
              type="number"
              disabled={!isSuperAdmin}
            />
          </ConfigRow>
          <ConfigRow label="Max Login Attempts" description="Failed OTP attempts before temporary lockout">
            <Input
              value={security.maxLoginAttempts}
              onChange={v => setSecurity(s => ({ ...s, maxLoginAttempts: v }))}
              placeholder="5"
              type="number"
              disabled={!isSuperAdmin}
            />
          </ConfigRow>
          <ConfigRow label="Enable Rate Limiting" description="Protect endpoints from abuse with automatic rate limits">
            <Toggle
              checked={security.enableRateLimit}
              onChange={v => setSecurity(s => ({ ...s, enableRateLimit: v }))}
            />
          </ConfigRow>
        </Section>

        {/* Maintenance */}
        {isSuperAdmin && (
          <Section title="Maintenance" description="System-level toggles for maintenance and debugging.">
            <ConfigRow label="Maintenance Mode" description="Put the portal into maintenance mode — users will see a service page">
              <Toggle
                checked={maintenance.maintenanceMode}
                onChange={v => setMaintenance(s => ({ ...s, maintenanceMode: v }))}
              />
            </ConfigRow>
            <ConfigRow label="Debug Mode" description="Enable verbose server-side logging (do not use in production)">
              <Toggle
                checked={maintenance.debugMode}
                onChange={v => setMaintenance(s => ({ ...s, debugMode: v }))}
              />
            </ConfigRow>
          </Section>
        )}

        {/* System info */}
        <div className="bg-primary rounded-2xl p-8 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
          />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h4 className="font-headline font-bold text-xl text-on-primary mb-1">Integrity Report</h4>
              <p className="text-primary-fixed-dim text-sm max-w-md">
                All cryptographic seals active. Audit trail verified. Platform operating normally.
              </p>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-3xl font-headline font-bold text-on-primary">99.9%</p>
                <p className="text-[10px] text-primary-fixed-dim uppercase font-bold tracking-wider">Uptime</p>
              </div>
              <div className="w-px h-10 bg-primary-container" />
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                <div>
                  <p className="font-bold text-on-primary text-sm">Secured</p>
                  <p className="text-[10px] text-primary-fixed-dim uppercase font-bold tracking-wider">Blockchain</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <Link href="/admin" className="text-primary font-bold text-sm flex items-center gap-2 group">
            <span className="material-symbols-outlined text-base group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Dashboard
          </Link>
          <button
            onClick={handleSave}
            className="px-8 py-3 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-md hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">save</span>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
