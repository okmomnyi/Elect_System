'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/useAuth';
import { elections as electionsApi } from '@/lib/api';

export default function ReceiptPage() {
  const { id }    = useParams();
  const { user, loading: authLoading } = useRequireAuth();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!user || !id) return;
    electionsApi.get(id)
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, id]);

  if (authLoading || loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  const receiptToken = data?.userStatus?.receiptToken;
  const election     = data?.election;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-outline-variant/30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            <span className="text-sm font-medium">Back to Dashboard</span>
          </Link>
          <span className="font-headline font-extrabold text-primary text-xl tracking-tight">Academic Vote</span>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {error ? (
            <div className="text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant mb-4 block">error</span>
              <p className="text-on-surface-variant text-sm">{error}</p>
            </div>
          ) : !receiptToken ? (
            <div className="text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant mb-4 block">ballot</span>
              <h2 className="font-headline font-bold text-xl text-primary mb-2">No vote recorded</h2>
              <p className="text-on-surface-variant text-sm mb-6">You haven't voted in this election yet.</p>
              <Link href={`/elections/${id}`} className="px-6 py-3 btn-gradient text-on-primary rounded-xl text-sm font-bold inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-base">how_to_vote</span>
                Vote Now
              </Link>
            </div>
          ) : (
            /* Receipt card */
            <div className="bg-surface-container-lowest rounded-3xl shadow-xl border border-outline-variant/10 overflow-hidden animate-slide-up">

              {/* Header */}
              <div className="bg-primary px-8 py-10 text-on-primary text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                <div className="relative z-10">
                  <div className="w-20 h-20 bg-secondary-container rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="material-symbols-outlined text-on-secondary-container text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                  <h1 className="font-headline font-extrabold text-2xl mb-2">Vote Recorded</h1>
                  <p className="text-on-primary/70 text-sm">
                    The digital seal has been applied to your ballot
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="p-8 space-y-6">
                {election && (
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Election</p>
                    <p className="font-headline font-bold text-lg text-primary">{election.title}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Receipt Token</p>
                  <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/20">
                    <p className="font-mono text-sm text-on-surface break-all leading-relaxed">{receiptToken}</p>
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    Keep this token. You can use it to verify your vote was counted — without revealing your choice.
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-600 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Ballot secrecy guaranteed</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Your identity and your vote choice are stored separately with no link between them.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="px-8 pb-8 flex flex-col gap-3">
                <button
                  onClick={() => navigator.clipboard?.writeText(receiptToken)}
                  className="w-full py-3.5 border-2 border-outline-variant text-on-surface rounded-xl font-bold text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  Copy Receipt Token
                </button>
                <Link
                  href="/dashboard"
                  className="w-full py-3.5 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  Return to Portal
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-outline border-t border-outline-variant/20">
        <p className="font-label uppercase tracking-widest">Official Voter Information System</p>
        <p className="mt-1">© {new Date().getFullYear()} University Electoral Commission. All rights reserved.</p>
      </footer>
    </div>
  );
}
