'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useAuth';
import { elections as electionsApi } from '@/lib/api';

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
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

function StatusBadge({ status }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-error-container text-on-error-container',
    draft:  'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function ElectionResultCard({ election }) {
  const [results, setResults]   = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState(false);

  async function loadResults() {
    if (results || election.status === 'draft') return;
    setLoading(true);
    try {
      const data = await electionsApi.results(election.id);
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function handleExpand() {
    setExpanded(v => !v);
    if (!results) loadResults();
  }

  const winner = results?.results ? [...results.results].sort((a, b) => b.votes - a.votes)[0] : null;
  const totalVotes = results?.results?.reduce((s, c) => s + (c.votes || 0), 0) || 0;

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden transition-all">
      <div className="p-8 flex flex-col md:flex-row gap-6 items-start md:items-center">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <StatusBadge status={election.status} />
            {election.endTime && (
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                {new Date(election.endTime).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          <h3 className="font-headline font-extrabold text-xl text-primary mb-2">{election.title}</h3>
          {election.description && (
            <p className="text-sm text-on-surface-variant line-clamp-1">{election.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right hidden md:block">
            <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-1">Candidates</p>
            <p className="font-headline font-bold text-2xl text-primary">{election.candidateCount || election.candidate_count || 0}</p>
          </div>
          {election.status !== 'draft' && (
            <button
              onClick={handleExpand}
              className="px-5 py-2.5 bg-surface-container text-primary rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary hover:text-on-primary transition-all"
            >
              <span className="material-symbols-outlined text-base">
                {expanded ? 'expand_less' : 'analytics'}
              </span>
              {expanded ? 'Collapse' : 'View Results'}
            </button>
          )}
          {election.status === 'active' && (
            <Link
              href={`/elections/${election.id}`}
              className="px-5 py-2.5 btn-gradient text-on-primary rounded-xl text-sm font-headline font-bold flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">how_to_vote</span>
              Vote
            </Link>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-surface-container px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          ) : !results?.results?.length ? (
            <p className="text-sm text-on-surface-variant text-center py-4">No results available yet.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Winner spotlight */}
              {winner && election.status === 'closed' && (
                <div className="lg:col-span-1 relative overflow-hidden rounded-xl bg-primary p-6 flex flex-col gap-3">
                  <span className="inline-block px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold tracking-widest uppercase">
                    Leading / Winner
                  </span>
                  <h4 className="font-headline font-extrabold text-2xl text-on-primary leading-tight">{winner.candidateName}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-secondary-container">
                      {totalVotes > 0 ? Math.round((winner.votes / totalVotes) * 100) : 0}%
                    </span>
                    <span className="text-primary-fixed-dim text-sm">of votes</span>
                  </div>
                  <p className="text-primary-fixed-dim text-xs">{winner.votes?.toLocaleString()} ballots</p>
                </div>
              )}

              {/* Candidate breakdown */}
              <div className={`${winner && election.status === 'closed' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                      <th className="pb-3">Candidate</th>
                      <th className="pb-3 text-right">Votes</th>
                      <th className="pb-3 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low">
                    {[...results.results]
                      .sort((a, b) => b.votes - a.votes)
                      .map((c, i) => {
                        const share = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;
                        return (
                          <tr key={c.candidateId} className="hover:bg-surface-container-low transition-colors">
                            <td className="py-3 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-xs font-bold text-on-surface-variant flex-shrink-0">
                                {i + 1}
                              </div>
                              <div>
                                <p className="font-bold text-primary">{c.candidateName}</p>
                                {c.position && <p className="text-[10px] text-on-surface-variant">{c.position}</p>}
                              </div>
                            </td>
                            <td className="py-3 text-right font-mono font-medium text-on-surface">
                              {(c.votes || 0).toLocaleString()}
                            </td>
                            <td className="py-3 text-right font-bold text-primary">
                              {share}%
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [elections, setElections]      = useState([]);
  const [loading, setLoading]          = useState(true);
  const [error, setError]              = useState('');
  const [filter, setFilter]            = useState('all');

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

  const filtered = filter === 'all' ? elections : elections.filter(e => e.status === filter);
  const totalVotes = elections.reduce((s, e) => s + parseInt(e.vote_count || e.voteCount || 0, 10), 0);
  const closedCount = elections.filter(e => e.status === 'closed').length;
  const activeCount = elections.filter(e => e.status === 'active').length;

  return (
    <div className="min-h-screen bg-surface">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16">
          <div className="flex items-center gap-4">
            <h1 className="font-headline font-bold text-xl text-primary tracking-tight">Academic Vote</h1>
            <span className="h-4 w-px bg-outline-variant/40" />
            <span className="text-sm font-bold text-primary border-b-2 border-secondary pb-0.5">Results Dashboard</span>
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

      <div className="p-8 max-w-7xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="space-y-1">
            <h2 className="font-headline text-4xl font-extrabold tracking-tight text-primary">
              Election Results
            </h2>
            <p className="font-label text-on-surface-variant tracking-wider text-sm uppercase">
              Academic Year · All Campaigns
            </p>
          </div>
          <div className="flex gap-3 self-start">
            {['all', 'active', 'closed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-xs font-bold rounded-xl capitalize transition-colors ${
                  filter === f
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container border border-outline-variant/20'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bento */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 relative overflow-hidden rounded-2xl bg-primary p-8 flex items-end justify-between min-h-[160px]">
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
            />
            <div className="relative z-10">
              <p className="text-primary-fixed-dim text-xs font-bold uppercase tracking-widest mb-3">Institutional Overview</p>
              <div className="flex items-end gap-10 flex-wrap">
                <div>
                  <p className="text-5xl font-headline font-extrabold text-on-primary leading-none">{totalVotes.toLocaleString()}</p>
                  <p className="text-primary-fixed-dim text-sm mt-1">Total Ballots Cast</p>
                </div>
                <div>
                  <p className="text-5xl font-headline font-extrabold text-secondary-container leading-none">{elections.length}</p>
                  <p className="text-primary-fixed-dim text-sm mt-1">Total Elections</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-6">
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-primary text-2xl p-2 bg-primary-fixed rounded-lg">how_to_reg</span>
                <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-md">Live</span>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-primary font-headline">{String(activeCount).padStart(2, '0')}</p>
                <p className="text-on-surface-variant text-xs font-medium mt-1">Active Elections</p>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="material-symbols-outlined text-secondary text-2xl p-2 bg-secondary-fixed rounded-lg">analytics</span>
                <span className="text-on-surface-variant text-xs font-bold">{closedCount} closed</span>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-primary font-headline">{String(closedCount).padStart(2, '0')}</p>
                <p className="text-on-surface-variant text-xs font-medium mt-1">Completed Elections</p>
              </div>
            </div>
          </div>
        </div>

        {/* Elections list */}
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-6 bg-error-container rounded-2xl text-on-error-container text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline-variant block mb-4">analytics</span>
            <p className="font-headline font-bold text-lg text-primary mb-2">No results available</p>
            <p className="text-sm text-on-surface-variant">Results will appear here once elections are complete.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(e => (
              <ElectionResultCard key={e.id} election={e} />
            ))}
          </div>
        )}

        {/* Verification footer */}
        <div className="bg-surface-dim/30 rounded-2xl p-6 border border-surface-container-high flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-surface-container-lowest rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-secondary">security</span>
            </div>
            <div>
              <h5 className="font-bold text-primary text-sm">Audit Trail Active</h5>
              <p className="text-xs text-on-surface-variant">Every ballot is cryptographically verified and stored securely.</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-primary font-bold text-sm flex items-center gap-2 group"
          >
            <span className="material-symbols-outlined text-base group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Elections
          </Link>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-outline-variant/30 z-50 flex justify-around items-center">
        {[
          { href: '/dashboard',  icon: 'ballot',    label: 'Elections',  active: false },
          { href: '/results',    icon: 'analytics', label: 'Results',    active: true  },
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
