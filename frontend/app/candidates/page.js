'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useAuth';
import { elections as electionsApi } from '@/lib/api';

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );
}

function CandidateCard({ candidate, electionId, electionTitle, status }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant/10 hover:shadow-md transition-all group flex flex-col">
      {/* Photo area */}
      <div className="relative bg-primary-container h-40 flex items-center justify-center overflow-hidden">
        {candidate.photo_url ? (
          <img
            src={candidate.photo_url}
            alt={candidate.name}
            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center">
            <span className="font-headline font-extrabold text-3xl text-on-primary">
              {candidate.name?.charAt(0) || '?'}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
        {status === 'active' && (
          <span className="absolute top-4 left-4 px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-widest">
            Running
          </span>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="mb-1">
          <p className="text-[10px] uppercase font-bold text-secondary tracking-widest mb-1">{electionTitle}</p>
          <h3 className="font-headline font-extrabold text-lg text-primary leading-tight">{candidate.name}</h3>
          {candidate.position && (
            <p className="text-xs text-on-surface-variant mt-0.5">{candidate.position}</p>
          )}
        </div>

        {candidate.bio && (
          <p className="text-sm text-on-surface-variant leading-relaxed mt-3 flex-1 line-clamp-3">
            {candidate.bio}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-surface-container flex items-center justify-between">
          <Link
            href={`/elections/${electionId}`}
            className="text-primary font-bold text-xs flex items-center gap-1 group/link"
          >
            View Election
            <span className="material-symbols-outlined text-xs transition-transform group-hover/link:translate-x-1">arrow_forward</span>
          </Link>
          {status === 'active' && (
            <Link
              href={`/elections/${electionId}`}
              className="px-3 py-1.5 btn-gradient text-on-primary rounded-lg text-xs font-headline font-bold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">how_to_vote</span>
              Vote
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CandidatesPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [elections, setElections]      = useState([]);
  const [electionDetails, setDetails]  = useState({});
  const [loading, setLoading]          = useState(true);
  const [error, setError]              = useState('');
  const [search, setSearch]            = useState('');
  const [filter, setFilter]            = useState('all');

  useEffect(() => {
    if (!user) return;
    electionsApi.list()
      .then(async d => {
        const list = d.elections || [];
        setElections(list);
        const relevant = list.filter(e => e.status !== 'draft');
        const details = {};
        await Promise.allSettled(
          relevant.map(async e => {
            try {
              const data = await electionsApi.get(e.id);
              details[e.id] = data.election || data;
            } catch {
              details[e.id] = null;
            }
          })
        );
        setDetails(details);
      })
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

  const allCandidates = elections.flatMap(e => {
    const detail = electionDetails[e.id];
    const candidates = detail?.candidates || [];
    return candidates.map(c => ({ ...c, electionId: e.id, electionTitle: e.title, electionStatus: e.status }));
  });

  const filtered = allCandidates.filter(c => {
    const matchesSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.position?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || c.electionStatus === filter;
    return matchesSearch && matchesFilter;
  });

  const totalCandidates = allCandidates.length;
  const activeElectionsCount = elections.filter(e => e.status === 'active').length;

  return (
    <div className="min-h-screen bg-surface">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16">
          <div className="flex items-center gap-4">
            <h1 className="font-headline font-bold text-xl text-primary tracking-tight">Academic Vote</h1>
            <span className="h-4 w-px bg-outline-variant/40" />
            <span className="text-sm font-bold text-primary border-b-2 border-secondary pb-0.5">Candidates</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-surface-container px-4 py-2 rounded-full">
              <span className="material-symbols-outlined text-outline text-sm">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search candidates…"
                className="bg-transparent border-none outline-none text-sm w-44 text-on-surface placeholder:text-outline"
              />
            </div>
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

        {/* Editorial header */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 relative overflow-hidden rounded-2xl bg-primary text-on-primary p-10 flex flex-col justify-end min-h-[220px]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-tertiary-container opacity-90" />
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
            />
            <div className="relative z-10">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-widest mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-on-secondary-container" />
                Candidate Directory
              </span>
              <h2 className="font-headline text-3xl md:text-4xl font-extrabold mb-2 leading-tight">
                Meet the Candidates
              </h2>
              <p className="text-on-primary/75 text-sm max-w-lg">
                Review all candidates standing for election. Learn about their platforms and cast your vote in open elections.
              </p>
            </div>
          </div>

          <div className="lg:col-span-4 grid grid-rows-2 gap-4">
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <span className="material-symbols-outlined text-secondary text-2xl">groups</span>
              <div>
                <p className="font-headline font-extrabold text-3xl text-primary">{totalCandidates}</p>
                <p className="text-xs text-on-surface-variant mt-1">Total Candidates</p>
              </div>
            </div>
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">how_to_vote</span>
              <div>
                <p className="font-headline font-extrabold text-3xl text-primary">{activeElectionsCount}</p>
                <p className="text-xs text-on-surface-variant mt-1">Active Elections</p>
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2">
            {[
              { key: 'all',    label: 'All Candidates' },
              { key: 'active', label: 'Open Elections'  },
              { key: 'closed', label: 'Past Elections'  },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 text-xs font-bold rounded-xl capitalize transition-colors ${
                  filter === f.key
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container border border-outline-variant/20'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-on-surface-variant">
            {filtered.length} candidate{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-6 bg-error-container rounded-2xl text-on-error-container text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline-variant block mb-4">person_off</span>
            <p className="font-headline font-bold text-lg text-primary mb-2">No candidates found</p>
            <p className="text-sm text-on-surface-variant">
              {search ? 'Try a different search term.' : 'Candidates will appear here when elections are published.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(c => (
              <CandidateCard
                key={`${c.electionId}-${c.id}`}
                candidate={c}
                electionId={c.electionId}
                electionTitle={c.electionTitle}
                status={c.electionStatus}
              />
            ))}
          </div>
        )}

        {/* Elections without loaded candidates */}
        {!loading && !error && elections.filter(e => e.status !== 'draft' && !electionDetails[e.id]?.candidates?.length).length > 0 && allCandidates.length === 0 && (
          <div className="space-y-4">
            <h3 className="font-headline font-bold text-xl text-primary">Elections</h3>
            {elections.filter(e => e.status !== 'draft').map(e => (
              <Link
                key={e.id}
                href={`/elections/${e.id}`}
                className="flex items-center justify-between p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 hover:shadow-md transition-all"
              >
                <div>
                  <p className="font-headline font-bold text-primary">{e.title}</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {e.candidateCount || e.candidate_count || 0} candidates
                  </p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-outline-variant/30 z-50 flex justify-around items-center">
        {[
          { href: '/dashboard',  icon: 'ballot',    label: 'Elections',  active: false },
          { href: '/results',    icon: 'analytics', label: 'Results',    active: false },
          { href: '/candidates', icon: 'groups',    label: 'Candidates', active: true  },
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
