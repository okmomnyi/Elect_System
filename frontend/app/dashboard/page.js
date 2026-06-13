'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useAuth';
import { elections as electionsApi } from '@/lib/api';

function StatusPill({ status }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-slate-200 text-slate-600',
    draft:  'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function CountdownBadge({ endTime }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    function calc() {
      if (!endTime) { setLabel(''); return; }
      const diff = new Date(endTime) - Date.now();
      if (diff <= 0) { setLabel('Closed'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 0 ? `${h}h : ${m.toString().padStart(2,'0')}m` : `${m}m : ${s.toString().padStart(2,'0')}s`);
    }
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return label ? (
    <div className="flex items-center gap-1.5 text-sm font-bold text-primary font-mono">
      <span className="material-symbols-outlined text-base text-secondary">schedule</span>
      {label}
    </div>
  ) : null;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [elections, setElections] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!user) return;
    electionsApi.list()
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

  const active   = elections.filter(e => e.status === 'active');
  const closed   = elections.filter(e => e.status === 'closed');
  const featured = active[0] || closed[0];

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16">
          <h1 className="font-headline font-bold text-xl text-primary tracking-tight">Academic Vote</h1>
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-4 py-2 rounded-full">
              <span className="material-symbols-outlined text-outline text-sm">search</span>
              <input
                placeholder="Search elections…"
                className="bg-transparent border-none outline-none text-sm w-44 text-on-surface placeholder:text-outline"
              />
            </div>
            <button className="relative p-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-xs font-bold text-on-primary-container">
              {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto space-y-10">

        {/* ── Hero Bento ──────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Featured election card */}
          <div className="lg:col-span-8 relative overflow-hidden rounded-2xl bg-primary text-on-primary p-10 flex flex-col justify-end min-h-[320px]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-tertiary-container opacity-90" />
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
            />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-on-secondary-container" />
                {active.length > 0 ? 'Voting Is Open' : 'Official Announcement'}
              </span>
              {featured ? (
                <>
                  <h2 className="font-headline text-3xl md:text-4xl font-extrabold mb-4 leading-tight">{featured.title}</h2>
                  <p className="text-on-primary/75 max-w-xl mb-6 text-sm leading-relaxed">{featured.description || 'Exercise your right to shape the future of your campus.'}</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    {featured.status === 'active' && (
                      <Link
                        href={`/elections/${featured.id}`}
                        className="px-6 py-3 bg-secondary-container text-on-secondary-container font-headline font-bold rounded-xl shadow-md hover:scale-[1.02] transition-transform text-sm"
                      >
                        Get Started
                      </Link>
                    )}
                    <CountdownBadge endTime={featured.endTime} />
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-headline text-3xl font-extrabold mb-4">No Active Elections</h2>
                  <p className="text-on-primary/75 max-w-xl mb-6 text-sm">Check back soon. Upcoming elections will appear here.</p>
                </>
              )}
            </div>
          </div>

          {/* Voting history card */}
          <div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl p-8 flex flex-col shadow-sm border border-outline-variant/10">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-secondary">history</span>
              <h3 className="font-headline font-bold text-lg text-primary">Your Voting History</h3>
            </div>
            {closed.filter(e => e.hasVoted).length > 0 ? (
              <div className="space-y-4 flex-1">
                {closed.filter(e => e.hasVoted).slice(0, 4).map(e => (
                  <div key={e.id} className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-on-surface truncate">{e.title}</p>
                      <p className="text-xs text-on-surface-variant">{new Date(e.endTime).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant flex-1">You haven't voted in any elections yet.</p>
            )}
            <button className="mt-6 text-primary font-bold text-sm flex items-center gap-1.5 group">
              View full participation record
              <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">arrow_forward</span>
            </button>
          </div>
        </section>

        {/* ── Active Elections ──────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        ) : error ? (
          <div className="p-6 bg-error-container rounded-2xl text-on-error-container text-sm">{error}</div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-headline font-extrabold text-3xl text-primary mb-1">Active Elections</h2>
                <p className="text-on-surface-variant text-sm">
                  {active.length > 0
                    ? `You are eligible to vote in ${active.length} active poll${active.length > 1 ? 's' : ''} today.`
                    : 'No active elections at this time.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg bg-surface-container-lowest shadow-sm border border-outline-variant/20 text-on-surface-variant">
                  <span className="material-symbols-outlined text-xl">filter_list</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {active.map((e, i) => (
                <div
                  key={e.id}
                  className={`bg-surface-container-lowest p-8 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center gap-8 border-l-4 ${i === 0 ? 'border-secondary' : 'border-outline-variant/40'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-tertiary-container text-on-tertiary-container uppercase tracking-widest">Mandatory</span>
                      <span className="text-xs font-label text-on-surface-variant tracking-wider">Student Election</span>
                    </div>
                    <h3 className="font-headline font-extrabold text-xl text-primary mb-2">{e.title}</h3>
                    {e.description && <p className="text-sm text-on-surface-variant mb-3 line-clamp-1">{e.description}</p>}
                    <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-base">groups</span>
                      {e.candidateCount || 0} candidate{e.candidateCount !== 1 ? 's' : ''} running
                    </div>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto flex-shrink-0">
                    <div className="md:text-right">
                      <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-1">Poll Closes In</p>
                      <CountdownBadge endTime={e.endTime} />
                    </div>
                    {e.hasVoted ? (
                      <Link
                        href={`/elections/${e.id}`}
                        className="px-6 py-3 bg-surface-container text-on-surface-variant rounded-xl text-sm font-bold flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        Voted
                      </Link>
                    ) : (
                      <Link
                        href={`/elections/${e.id}`}
                        className="px-6 py-3 btn-gradient text-on-primary rounded-xl text-sm font-headline font-bold shadow-md hover:opacity-90 transition-opacity flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base">how_to_vote</span>
                        Vote Now
                      </Link>
                    )}
                  </div>
                </div>
              ))}

              {active.length === 0 && (
                <div className="py-16 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
                  <span className="material-symbols-outlined text-5xl text-outline-variant mb-4 block">ballot</span>
                  <p className="font-headline font-bold text-lg text-primary mb-2">No active elections</p>
                  <p className="text-sm text-on-surface-variant">Upcoming elections will appear here when voting opens.</p>
                </div>
              )}
            </div>

            {/* ── Closed / Upcoming ────────────────────────── */}
            {closed.length > 0 && (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <h2 className="font-headline font-bold text-2xl text-primary mb-5">Past Elections</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {closed.slice(0, 4).map(e => (
                      <Link
                        key={e.id}
                        href={`/elections/${e.id}`}
                        className="p-6 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 hover:shadow-md transition-all"
                      >
                        <p className="text-xs font-bold text-secondary mb-2 tracking-widest uppercase">Closed</p>
                        <h4 className="font-headline font-bold text-base text-primary mb-2 line-clamp-2">{e.title}</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-on-surface-variant">{e.candidateCount || 0} candidates</span>
                          {e.hasVoted && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
                              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                              Voted
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-container rounded-2xl p-8">
                  <h3 className="font-headline font-bold text-xl text-primary mb-5">Completed Votes</h3>
                  <div className="space-y-3">
                    {closed.filter(e => e.hasVoted).slice(0, 4).map(e => (
                      <div key={e.id} className="p-4 bg-white/60 rounded-xl flex justify-between items-center">
                        <div className="min-w-0 mr-3">
                          <p className="font-bold text-sm text-on-surface truncate">{e.title}</p>
                          <p className="text-[10px] text-on-surface-variant">Ended {new Date(e.endTime).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <span className="flex-shrink-0 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold">VOTED</span>
                      </div>
                    ))}
                    {closed.filter(e => e.hasVoted).length === 0 && (
                      <p className="text-sm text-on-surface-variant">No completed votes yet.</p>
                    )}
                  </div>
                  <button className="mt-5 w-full py-3 border border-primary/20 text-primary font-bold text-sm rounded-xl hover:bg-white transition-colors">
                    Archive &amp; Results
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* ── Mobile bottom nav ────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-outline-variant/30 z-50 flex justify-around items-center">
        {[
          { href: '/dashboard',  icon: 'ballot',    label: 'Elections',  active: true  },
          { href: '/results',    icon: 'analytics', label: 'Results',    active: false },
          { href: '/candidates', icon: 'groups',    label: 'Candidates', active: false },
          { href: '/settings',   icon: 'person',    label: 'Profile',    active: false },
        ].map(({ href, icon, label, active }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${active ? 'text-primary' : 'text-slate-400'}`}
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
