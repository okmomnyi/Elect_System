'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useAuth';
import { elections as electionsApi } from '@/lib/api';
import VoteForm from '@/components/elections/VoteForm';
import LiveTally from '@/components/elections/LiveTally';
import CandidateCard from '@/components/elections/CandidateCard';

export default function ElectionPage() {
  const { id }              = useParams();
  const { user, loading: authLoading } = useRequireAuth();
  const [election, setElection]   = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [hasVoted, setHasVoted]   = useState(false);
  const [receiptToken, setReceiptToken] = useState('');
  const [results, setResults]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (!user || !id) return;
    electionsApi.get(id)
      .then(data => {
        setElection(data.election);
        setCandidates(data.candidates || []);
        setHasVoted(data.userStatus?.hasVoted || false);
        setReceiptToken(data.userStatus?.receiptToken || '');
        if (data.election?.status === 'closed' || data.userStatus?.hasVoted) {
          return electionsApi.results(id).then(r => setResults(r.results || []));
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, id]);

  async function handleVote(candidateId) {
    // Optimistically lock voting to prevent double submissions
    setHasVoted(true);
    try {
      const res = await electionsApi.vote(id, candidateId);
      setReceiptToken(res.receiptToken || '');
      const r = await electionsApi.results(id).catch(() => ({ results: [] }));
      setResults(r.results || []);
    } catch (err) {
      // Keep the vote locked only when the server confirms the ballot already
      // exists (duplicate). For any other failure (network, rate-limit, 5xx),
      // revert so the user can retry. Key off the error code, not message text.
      const alreadyVoted =
        err.code === 'ALREADY_VOTED' ||
        err.code === 'DUPLICATE_VOTE' ||
        err.status === 409;
      if (!alreadyVoted) {
        setHasVoted(false);
      }
      throw err;
    }
  }

  const canVote = election?.status === 'active' && !hasVoted;

  if (authLoading || loading) return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <span className="material-symbols-outlined text-5xl text-outline-variant mb-4 block">error</span>
        <h2 className="font-headline font-bold text-xl text-primary mb-3">Something went wrong</h2>
        <p className="text-on-surface-variant text-sm mb-6">{error}</p>
        <Link href="/dashboard" className="px-6 py-3 btn-gradient text-on-primary rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface font-body">

      {/* ── Top Nav ──────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-outline-variant/30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
              <span className="text-sm font-medium hidden md:block">Elections</span>
            </Link>
            <div className="hidden md:flex gap-6">
              {['Elections', 'Results', 'Candidates'].map((t, i) => (
                <button key={t} className={`text-sm font-medium pb-0.5 ${i === 0 ? 'text-primary border-b-2 border-secondary' : 'text-on-surface-variant hover:text-primary transition-colors'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-xs font-bold text-on-primary-container">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* ── Left sidebar ──────────────────────────────── */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24 flex flex-col gap-4">
              <Link href="/dashboard" className="w-12 h-12 flex items-center justify-center rounded-xl bg-surface-container-lowest shadow-sm text-primary hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined">arrow_back</span>
              </Link>
              <div className="h-px bg-outline-variant/30" />
              <button className="w-12 h-12 flex items-center justify-center rounded-xl bg-surface-container-lowest text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">share</span>
              </button>
            </div>
          </aside>

          {/* ── Main content ──────────────────────────────── */}
          <div className="lg:col-span-11 space-y-12">

            {/* Candidate profile / hero */}
            {election && (
              <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
                <div className="md:col-span-7">
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${election.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {election.status}
                    </span>
                    {hasVoted && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        You Voted
                      </span>
                    )}
                  </div>
                  <h1 className="font-headline font-extrabold text-4xl md:text-5xl text-primary tracking-tighter leading-none mb-4">
                    {election.title}
                  </h1>
                  {election.description && (
                    <p className="text-on-surface-variant text-lg leading-relaxed max-w-xl mb-6">{election.description}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-on-surface-variant">
                    {election.startTime && (
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base">calendar_month</span>
                        {new Date(election.startTime).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base">groups</span>
                      {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base">how_to_vote</span>
                      {election.totalVotes?.toLocaleString() || 0} votes cast
                    </span>
                  </div>
                </div>

                {/* Receipt snippet if voted */}
                {hasVoted && receiptToken && (
                  <div className="md:col-span-5 p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Your Receipt Token</p>
                    <p className="font-mono text-sm text-on-surface break-all leading-relaxed mb-4">{receiptToken}</p>
                    <Link
                      href={`/elections/${id}/receipt`}
                      className="flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                    >
                      <span className="material-symbols-outlined text-base">receipt_long</span>
                      View full receipt
                    </Link>
                  </div>
                )}
              </section>
            )}

            {/* Already-voted banner */}
            {hasVoted && (
              <div className="flex items-center gap-3 px-6 py-4 bg-secondary-container/30 border border-secondary/20 rounded-2xl">
                <span className="material-symbols-outlined text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                <div>
                  <p className="font-headline font-bold text-secondary text-sm">Your vote has been recorded</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Each voter can only vote once per election. Your ballot is anonymous and cannot be changed.</p>
                </div>
              </div>
            )}

            {/* Vote form / tally / closed state */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                {canVote ? (
                  <>
                    <h2 className="font-headline font-bold text-2xl text-primary mb-5">Cast Your Vote</h2>
                    <VoteForm candidates={candidates} onSubmit={handleVote} />
                  </>
                ) : (
                  <>
                    <h2 className="font-headline font-bold text-2xl text-primary mb-5">Candidates</h2>
                    <div className="space-y-4">
                      {candidates.map(c => (
                        <CandidateCard key={c.id} candidate={c} disabled />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Results / tally */}
              {(hasVoted || election?.status === 'closed') && results.length > 0 && (
                <div className="p-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm">
                  <LiveTally
                    electionId={id}
                    initialResults={results.map(r => ({
                      id: r.candidateId,
                      name: r.candidateName,
                      position: r.position,
                      voteCount: parseInt(r.votes || 0, 10),
                    }))}
                  />
                </div>
              )}

              {/* Not voted + active */}
              {!hasVoted && election?.status === 'active' && (
                <div className="p-8 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                  <span className="material-symbols-outlined text-4xl text-outline-variant block mb-4">bar_chart</span>
                  <h3 className="font-headline font-bold text-lg text-primary mb-2">Results Hidden</h3>
                  <p className="text-sm text-on-surface-variant">
                    Results are revealed after you cast your vote. This prevents your choice being influenced by current standings.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
