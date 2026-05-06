'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAdmin } from '@/hooks/useAuth';
import { admin } from '@/lib/api';

const STATUS_STYLE = {
  active: 'bg-emerald-100 text-emerald-700',
  draft:  'bg-amber-100  text-amber-700',
  closed: 'bg-slate-200  text-slate-600',
};

function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/20 w-full max-w-md p-8 animate-slide-up">
        <h2 className="font-headline font-bold text-xl text-primary mb-2">{title}</h2>
        <p className="text-sm text-on-surface-variant mb-8">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 border-2 border-outline-variant text-on-surface-variant rounded-xl font-bold text-sm hover:border-primary hover:text-primary transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminElectionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAdmin();

  const [election, setElection]     = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [results, setResults]       = useState([]);
  const [voteCount, setVoteCount]   = useState(0);
  const [loading, setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError]           = useState('');
  const [modal, setModal]           = useState(null); // 'open' | 'close' | 'delete'

  useEffect(() => {
    if (!user || !id) return;
    fetchElection();
  }, [user, id]);

  async function fetchElection() {
    setLoading(true);
    try {
      const data = await admin.elections.get(id);
      setElection(data.election);
      setCandidates(data.candidates || []);
      setVoteCount(data.voteCount || 0);
      if (data.election?.status === 'closed' || data.election?.status === 'active') {
        try {
          const r = await admin.elections.results(id);
          setResults(r.results || []);
        } catch (_) {}
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action) {
    setModal(null);
    setActionLoading(action);
    try {
      if (action === 'open')   await admin.elections.open(id);
      if (action === 'close')  await admin.elections.close(id);
      if (action === 'delete') { await admin.elections.delete(id); router.push('/admin'); return; }
      await fetchElection();
    } catch (err) {
      setError(err.message || `Failed to ${action} election.`);
    } finally {
      setActionLoading(null);
    }
  }

  const totalVotes = results.reduce((s, r) => s + parseInt(r.vote_count || 0, 10), 0);
  const maxVotes   = Math.max(...results.map(r => parseInt(r.vote_count || 0, 10)), 1);

  if (authLoading || loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  if (error && !election) return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <span className="material-symbols-outlined text-5xl text-outline-variant mb-4 block">error</span>
        <p className="text-on-surface-variant text-sm mb-6">{error}</p>
        <Link href="/admin" className="px-6 py-3 btn-gradient text-on-primary rounded-xl text-sm font-bold inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Modals */}
      {modal === 'open' && (
        <ConfirmModal
          title="Open Election"
          message="This will allow eligible students to cast their votes. Notifications will be sent to all registered students."
          confirmLabel="Open for Voting"
          confirmClass="btn-gradient text-on-primary"
          onConfirm={() => handleAction('open')}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'close' && (
        <ConfirmModal
          title="Close Election"
          message="This will immediately end voting and publish the final results. This action cannot be undone."
          confirmLabel="Close & Publish Results"
          confirmClass="bg-error text-on-primary"
          onConfirm={() => handleAction('close')}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'delete' && (
        <ConfirmModal
          title="Delete Election"
          message="This will permanently delete the election and all associated data. This action is irreversible."
          confirmLabel="Delete Permanently"
          confirmClass="bg-error text-on-primary"
          onConfirm={() => handleAction('delete')}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
              <span className="text-sm font-medium">Elections</span>
            </Link>
            <div className="h-4 w-px bg-outline-variant" />
            <span className="font-headline font-bold text-primary truncate max-w-xs">{election?.title}</span>
          </div>
          <div className="flex items-center gap-3">
            {election?.status === 'draft' && (
              <>
                <button
                  onClick={() => setModal('open')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 btn-gradient text-on-primary rounded-xl text-sm font-bold shadow hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {actionLoading === 'open' ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <span className="material-symbols-outlined text-base">how_to_vote</span>
                  )}
                  Open Election
                </button>
                <button
                  onClick={() => setModal('delete')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-xl text-sm font-bold hover:bg-error/20 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  Delete
                </button>
              </>
            )}
            {election?.status === 'active' && (
              <button
                onClick={() => setModal('close')}
                disabled={!!actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-error text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {actionLoading === 'close' ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <span className="material-symbols-outlined text-base">lock</span>
                )}
                Close Election
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-12 space-y-10">

        {error && (
          <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        {/* Hero */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-8">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${STATUS_STYLE[election?.status] || 'bg-slate-100 text-slate-500'}`}>
                {election?.status}
              </span>
            </div>
            <h1 className="font-headline font-extrabold text-4xl text-primary tracking-tighter mb-3">{election?.title}</h1>
            {election?.description && (
              <p className="text-on-surface-variant text-lg leading-relaxed">{election.description}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-on-surface-variant">
              {election?.start_time && (
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">play_circle</span>
                  {new Date(election.start_time).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              )}
              {election?.end_time && (
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">stop_circle</span>
                  {new Date(election.end_time).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">calendar_month</span>
                Created {new Date(election?.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
              </span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="md:col-span-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Candidates', value: candidates.length, icon: 'groups', color: 'text-primary bg-primary/5' },
              { label: 'Total Votes', value: voteCount, icon: 'ballot', color: 'text-secondary bg-secondary/10' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${color}`}>
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                </div>
                <p className="font-headline font-extrabold text-2xl text-primary">{value}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Candidates + Results */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Candidates */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-container flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">groups</span>
              <h2 className="font-headline font-bold text-lg text-primary">Candidates</h2>
              <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full ml-auto">{candidates.length}</span>
            </div>
            <div className="p-4 space-y-3">
              {candidates.map((c, i) => (
                <div key={c.id} className="flex items-start gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/10">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm shrink-0">
                    {c.photo_url ? (
                      <img src={c.photo_url} alt={c.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      c.name?.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline font-bold text-primary text-sm">{c.name}</p>
                    {c.position && <p className="text-xs text-secondary font-medium">{c.position}</p>}
                    {c.bio && <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{c.bio}</p>}
                  </div>
                  <span className="text-xs text-on-surface-variant font-bold shrink-0">#{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Results / tally */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-container flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">bar_chart</span>
              <h2 className="font-headline font-bold text-lg text-primary">
                {election?.status === 'closed' ? 'Final Results' : 'Live Tally'}
              </h2>
              {election?.status === 'active' && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {results.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-outline-variant block mb-3">bar_chart</span>
                  <p className="text-sm text-on-surface-variant">
                    {election?.status === 'draft' ? 'Results will appear once the election opens.' : 'No votes cast yet.'}
                  </p>
                </div>
              ) : (
                results
                  .sort((a, b) => parseInt(b.vote_count || 0) - parseInt(a.vote_count || 0))
                  .map((r, i) => {
                    const votes = parseInt(r.vote_count || 0, 10);
                    const pct   = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                    const isLeader = i === 0 && votes > 0;
                    return (
                      <div key={r.id} className={`p-4 rounded-xl border ${isLeader ? 'border-secondary/40 bg-secondary/5' : 'border-outline-variant/10 bg-surface-container-low'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isLeader && <span className="material-symbols-outlined text-base text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>}
                            <span className="font-headline font-bold text-primary text-sm">{r.name}</span>
                          </div>
                          <span className="text-xs font-bold text-on-surface-variant">{votes.toLocaleString()} · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${isLeader ? 'bg-secondary' : 'bg-primary/30'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
