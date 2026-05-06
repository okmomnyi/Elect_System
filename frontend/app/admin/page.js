'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAdmin } from '@/hooks/useAuth';
import { admin } from '@/lib/api';

const STATUS_STYLE = {
  active: 'bg-emerald-100 text-emerald-700',
  draft:  'bg-amber-100  text-amber-700',
  closed: 'bg-slate-200  text-slate-600',
};

function StatusBadge({ status }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function TurnoutBar({ value = 0, max = 100 }) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
        <div className="h-full bg-secondary rounded-full progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-on-surface-variant w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useRequireAdmin();
  const [elections, setElections]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  useEffect(() => {
    if (!user) return;
    admin.elections.list()
      .then(d => setElections(d.elections || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  const stats = {
    active:     elections.filter(e => e.status === 'active').length,
    draft:      elections.filter(e => e.status === 'draft').length,
    closed:     elections.filter(e => e.status === 'closed').length,
    totalVotes: elections.reduce((s, e) => s + parseInt(e.vote_count || 0, 10), 0),
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Top Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16">
          <div className="flex items-center gap-8">
            <span className="font-headline font-extrabold text-xl text-primary tracking-tight">Academic Vote</span>
            <nav className="hidden md:flex gap-6">
              {[
                { href: '/admin',         label: 'Elections'  },
                { href: '/admin/audit',   label: 'Audit Logs' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors border-b-2 border-transparent hover:border-secondary pb-0.5">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-xs font-bold text-on-primary-container">
              {user?.fullName?.charAt(0) || 'A'}
            </div>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto space-y-10">

        {/* ── Header section ─────────────────────────────── */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <h1 className="font-headline font-extrabold text-5xl text-primary tracking-tighter mb-3">
              Election Management
            </h1>
            <p className="text-on-surface-variant text-lg leading-relaxed max-w-2xl">
              Orchestrate the democratic process of the university. Define voting windows, validate candidates, and ensure transparent participation across all faculties.
            </p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm flex flex-col gap-2 min-w-[220px] border border-outline-variant/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Active Sessions</span>
              <span className="material-symbols-outlined text-secondary text-xl">online_prediction</span>
            </div>
            <p className="font-headline font-bold text-4xl text-primary">{String(stats.active).padStart(2, '0')}</p>
            <p className="text-xs text-on-surface-variant">Across all departments</p>
          </div>
        </div>

        {/* ── Action buttons ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link href="/admin/elections/new" className="flex flex-col items-start p-7 bg-secondary-container hover:shadow-xl transition-all duration-300 rounded-2xl group">
            <div className="mb-4 bg-white/30 p-2.5 rounded-xl">
              <span className="material-symbols-outlined text-on-secondary-container text-3xl">add_circle</span>
            </div>
            <span className="font-headline font-bold text-on-secondary-container text-xl">Create New Election</span>
            <p className="text-on-secondary-container/75 text-sm mt-1">Initialize a new ballot, define rules and eligibility.</p>
          </Link>

          <Link
            href={elections.find(e => e.status === 'draft')
              ? `/admin/elections/${elections.find(e => e.status === 'draft').id}`
              : '/admin/elections/new'}
            className="flex flex-col items-start p-7 bg-surface-container-lowest hover:shadow-lg transition-all border border-outline-variant/20 rounded-2xl"
          >
            <div className="mb-4 bg-primary-container p-2.5 rounded-xl">
              <span className="material-symbols-outlined text-on-primary text-3xl">how_to_vote</span>
            </div>
            <span className="font-headline font-bold text-primary text-xl">Start an Election</span>
            <p className="text-on-surface-variant text-sm mt-1">
              {elections.find(e => e.status === 'draft')
                ? 'Open your draft election to start accepting votes.'
                : 'Create a new election, then open it for voting.'}
            </p>
          </Link>

          <Link href="/admin/audit" className="flex flex-col items-start p-7 bg-surface-container-lowest hover:shadow-lg transition-all border border-outline-variant/20 rounded-2xl">
            <div className="mb-4 bg-tertiary-container p-2.5 rounded-xl">
              <span className="material-symbols-outlined text-on-tertiary-container text-3xl">query_stats</span>
            </div>
            <span className="font-headline font-bold text-primary text-xl">Audit &amp; Logs</span>
            <p className="text-on-surface-variant text-sm mt-1">View full audit trail of all system actions.</p>
          </Link>
        </div>

        {/* ── Stats row ──────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active',      value: stats.active,     icon: 'how_to_vote', color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Draft',       value: stats.draft,      icon: 'edit',        color: 'text-amber-600 bg-amber-50'     },
            { label: 'Closed',      value: stats.closed,     icon: 'lock',        color: 'text-slate-600 bg-slate-100'    },
            { label: 'Total Votes', value: stats.totalVotes, icon: 'ballot',      color: 'text-primary bg-primary/5'      },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
              </div>
              <p className="font-headline font-extrabold text-2xl text-primary">{value.toLocaleString()}</p>
              <p className="text-xs text-on-surface-variant mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Election Registry ───────────────────────────── */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
          <div className="px-8 py-5 flex items-center justify-between border-b border-surface-container">
            <h3 className="font-headline font-bold text-xl text-primary">Election Registry</h3>
            <div className="flex gap-2">
              {['All Status', 'Archived'].map((t, i) => (
                <button key={t} className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${i === 0 ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          ) : error ? (
            <p className="p-8 text-sm text-error">{error}</p>
          ) : elections.length === 0 ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant block mb-4">ballot</span>
              <p className="font-headline font-bold text-lg text-primary mb-2">No elections yet</p>
              <p className="text-sm text-on-surface-variant mb-6">Create your first election to get started.</p>
              <Link href="/admin/elections/new" className="px-6 py-3 btn-gradient text-on-primary rounded-xl text-sm font-bold inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-base">add_circle</span>
                Create Election
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    {['Election Title', 'Timeline', 'Votes', 'Status', ''].map(h => (
                      <th key={h} className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {elections.map(e => (
                    <tr key={e.id} className="registry-row border-t border-surface-container-low transition-colors">
                      <td className="px-8 py-5">
                        <p className="font-headline font-bold text-primary">{e.title}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{e.candidate_count || 0} candidates</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm text-on-surface flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-xs text-outline">calendar_month</span>
                          {e.start_time ? new Date(e.start_time).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }) : '—'}
                          {e.end_time && ` – ${new Date(e.end_time).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}`}
                        </p>
                      </td>
                      <td className="px-8 py-5 w-48">
                        <TurnoutBar value={parseInt(e.vote_count || 0, 10)} max={100} />
                      </td>
                      <td className="px-8 py-5">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/elections/${e.id}`}
                            className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors"
                            title="Manage"
                          >
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </Link>
                          <Link
                            href={`/admin/elections/${e.id}`}
                            className="px-4 py-2 text-xs font-bold btn-gradient text-on-primary rounded-xl hover:opacity-90 transition-opacity"
                          >
                            Manage
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
