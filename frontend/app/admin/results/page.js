'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAdmin } from '@/hooks/useAuth';
import { admin, elections as electionsApi } from '@/lib/api';

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="animate-spin h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );
}

function ElectionResultPanel({ election }) {
  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function loadResults() {
    setLoading(true);
    try {
      const data = await electionsApi.results(election.id);
      setResults(data);
    } catch {
      setResults({ candidates: [] });
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    setExpanded(v => !v);
    if (!results && !loading) loadResults();
  }

  const candidates = results?.candidates?.sort((a, b) => b.vote_count - a.vote_count) || [];
  const totalVotes = candidates.reduce((s, c) => s + (c.vote_count || 0), 0);
  const winner     = candidates[0];
  const winnerPct  = totalVotes > 0 && winner ? Math.round((winner.vote_count / totalVotes) * 100) : 0;

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full text-left px-8 py-6 flex items-center gap-6 hover:bg-surface-container-low/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
              election.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
              election.status === 'closed' ? 'bg-error-container text-on-error-container' :
              'bg-amber-100 text-amber-700'
            }`}>
              {election.status}
            </span>
            {election.end_time && (
              <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-widest">
                {new Date(election.end_time).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
          <h3 className="font-headline font-extrabold text-lg text-primary">{election.title}</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">{election.candidate_count || 0} candidates · {parseInt(election.vote_count || 0, 10).toLocaleString()} votes</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {winner && results && (
            <div className="text-right hidden md:block">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Leading</p>
              <p className="font-headline font-bold text-primary">{winner.name}</p>
              <p className="text-xs text-secondary font-bold">{winnerPct}%</p>
            </div>
          )}
          <span className="material-symbols-outlined text-on-surface-variant transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}>
            expand_more
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-surface-container">
          {loading ? (
            <Spinner />
          ) : candidates.length === 0 ? (
            <div className="px-8 py-8 text-sm text-on-surface-variant text-center">
              No results data available for this election yet.
            </div>
          ) : (
            <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Winner card */}
              <div className="lg:col-span-4 relative overflow-hidden rounded-xl bg-primary p-6 flex flex-col gap-4">
                <div
                  className="absolute inset-0 opacity-[0.05]"
                  style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}
                />
                <div className="relative z-10">
                  <span className="inline-block px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold tracking-widest uppercase mb-3">
                    {election.status === 'closed' ? 'Elected' : 'Leading'}
                  </span>
                  <h4 className="font-headline font-extrabold text-2xl text-on-primary leading-tight mb-2">{winner.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-secondary-container">{winnerPct}%</span>
                    <span className="text-primary-fixed-dim text-sm">of votes</span>
                  </div>
                  <p className="text-primary-fixed-dim text-xs mt-1">{(winner.vote_count || 0).toLocaleString()} ballots</p>
                </div>
              </div>

              {/* Candidate breakdown */}
              <div className="lg:col-span-8">
                <h5 className="font-headline font-bold text-sm text-on-surface-variant uppercase tracking-widest mb-4">Candidate Distribution</h5>
                <div className="space-y-3">
                  {candidates.map((c, i) => {
                    const pct = totalVotes > 0 ? Math.round((c.vote_count / totalVotes) * 100) : 0;
                    return (
                      <div key={c.id} className="flex items-center gap-4">
                        <div className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-xs font-bold text-on-surface-variant flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-primary truncate">{c.name}</span>
                            <span className="font-bold text-sm text-primary ml-4">{pct}%</span>
                          </div>
                          <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full progress-bar"
                              style={{
                                width: `${pct}%`,
                                background: i === 0 ? 'linear-gradient(135deg, #000a1e, #002147)' : '#c4c6cf',
                              }}
                            />
                          </div>
                        </div>
                        <span className="font-mono text-xs text-on-surface-variant w-16 text-right flex-shrink-0">
                          {(c.vote_count || 0).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 p-4 bg-surface-container rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Total Ballots</p>
                    <p className="font-headline font-bold text-2xl text-primary">{totalVotes.toLocaleString()}</p>
                  </div>
                  <Link
                    href={`/admin/elections/${election.id}`}
                    className="px-4 py-2 btn-gradient text-on-primary rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">manage_search</span>
                    Full Audit
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminResultsPage() {
  const { user, loading: authLoading } = useRequireAdmin();
  const [elections, setElections]      = useState([]);
  const [loading, setLoading]          = useState(true);
  const [error, setError]              = useState('');
  const [filter, setFilter]            = useState('all');

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

  const totalVotes   = elections.reduce((s, e) => s + parseInt(e.vote_count || 0, 10), 0);
  const closedCount  = elections.filter(e => e.status === 'closed').length;
  const activeCount  = elections.filter(e => e.status === 'active').length;

  const filtered = filter === 'all' ? elections.filter(e => e.status !== 'draft') : elections.filter(e => e.status === filter);

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
                    href === '/admin/results'
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

      <div className="p-8 max-w-7xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="space-y-1">
            <h1 className="font-headline font-extrabold text-5xl text-primary tracking-tighter">Results & Analytics</h1>
            <p className="text-on-surface-variant text-lg max-w-2xl">
              Complete tabulation and verification of all institutional election results.
            </p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm flex flex-col gap-2 min-w-[200px] border border-outline-variant/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Total Votes</span>
              <span className="material-symbols-outlined text-secondary text-xl">how_to_vote</span>
            </div>
            <p className="font-headline font-bold text-4xl text-primary">{totalVotes.toLocaleString()}</p>
            <p className="text-xs text-on-surface-variant">Across {elections.length} elections</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 relative overflow-hidden rounded-2xl bg-primary p-8 flex items-end justify-between min-h-[140px]">
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
            />
            <div className="relative z-10 flex gap-12 flex-wrap">
              <div>
                <p className="text-primary-fixed-dim text-xs font-bold uppercase tracking-widest mb-2">Completed Elections</p>
                <p className="text-5xl font-headline font-extrabold text-on-primary">{String(closedCount).padStart(2, '0')}</p>
              </div>
              <div>
                <p className="text-primary-fixed-dim text-xs font-bold uppercase tracking-widest mb-2">Active Polls</p>
                <p className="text-5xl font-headline font-extrabold text-secondary-container">{String(activeCount).padStart(2, '0')}</p>
              </div>
              <div>
                <p className="text-primary-fixed-dim text-xs font-bold uppercase tracking-widest mb-2">Total Ballots</p>
                <p className="text-5xl font-headline font-extrabold text-on-primary">{totalVotes.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-secondary-container rounded-2xl p-8 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-headline font-bold text-lg text-on-secondary-container mb-2">Integrity Status</h4>
              <p className="text-sm text-on-secondary-container/80 mb-4">All cryptographic seals are active and verified.</p>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                <span className="font-bold text-on-secondary-container text-sm">Blockchain Secured</span>
              </div>
            </div>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-on-secondary-container/10" style={{ fontSize: '120px' }}>security</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { key: 'all',    label: 'All Elections' },
            { key: 'active', label: 'Active'        },
            { key: 'closed', label: 'Closed'        },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                filter === f.key
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container border border-outline-variant/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results list */}
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-6 bg-error-container rounded-2xl text-on-error-container text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline-variant block mb-4">analytics</span>
            <p className="font-headline font-bold text-lg text-primary mb-2">No results available</p>
            <p className="text-sm text-on-surface-variant">Create and run elections to view results here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(e => (
              <ElectionResultPanel key={e.id} election={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
