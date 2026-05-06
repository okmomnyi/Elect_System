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

function StatusBadge({ status }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    draft:  'bg-amber-100 text-amber-700',
    closed: 'bg-slate-200 text-slate-600',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function DeleteModal({ candidate, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-primary/20 backdrop-blur-md" onClick={onCancel} />
      <div className="glass-panel relative max-w-md w-full p-10 rounded-2xl shadow-2xl border border-white/50 text-center">
        <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-on-error-container text-2xl">person_remove</span>
        </div>
        <h3 className="font-headline font-extrabold text-xl text-primary mb-2">Remove Candidate?</h3>
        <p className="text-sm text-on-surface-variant mb-8">
          This will permanently remove <strong>{candidate.name}</strong> from the election registry.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 border border-outline-variant/30 text-on-surface-variant rounded-xl font-bold text-sm hover:bg-surface-container transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-error text-on-error rounded-xl font-headline font-bold text-sm hover:opacity-90 transition-opacity">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCandidatesPage() {
  const { user, loading: authLoading } = useRequireAdmin();
  const [elections, setElections]      = useState([]);
  const [details, setDetails]          = useState({});
  const [loading, setLoading]          = useState(true);
  const [error, setError]              = useState('');
  const [search, setSearch]            = useState('');
  const [electionFilter, setElectionFilter] = useState('all');
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [deleting, setDeleting]             = useState(false);

  async function loadData() {
    try {
      const d = await admin.elections.list();
      const list = d.elections || [];
      setElections(list);
      const det = {};
      await Promise.allSettled(
        list.filter(e => e.status !== 'draft').map(async e => {
          try {
            const data = await admin.elections.get(e.id);
            det[e.id] = data.election || data;
          } catch {
            det[e.id] = null;
          }
        })
      );
      setDetails(det);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function handleDelete(candidate) {
    setDeleting(true);
    try {
      await admin.candidates.delete(candidate.id);
      setDeleteTarget(null);
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );

  const allCandidates = elections.flatMap(e => {
    const det = details[e.id];
    return (det?.candidates || []).map(c => ({
      ...c,
      electionId:     e.id,
      electionTitle:  e.title,
      electionStatus: e.status,
    }));
  });

  const filtered = allCandidates.filter(c => {
    const matchSearch   = !search || c.name?.toLowerCase().includes(search.toLowerCase());
    const matchElection = electionFilter === 'all' || String(c.electionId) === electionFilter;
    return matchSearch && matchElection;
  });

  const totalCandidates = allCandidates.length;
  const activeElections = elections.filter(e => e.status === 'active');

  return (
    <div className="min-h-screen bg-surface">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16">
          <div className="flex items-center gap-8">
            <span className="font-headline font-extrabold text-xl text-primary tracking-tight">Academic Vote</span>
            <nav className="hidden md:flex gap-6">
              {[
                { href: '/admin',             label: 'Elections'   },
                { href: '/admin/candidates',  label: 'Candidates'  },
                { href: '/admin/results',     label: 'Results'     },
                { href: '/admin/audit',       label: 'Audit Logs'  },
                { href: '/admin/config',      label: 'Config'      },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium transition-colors border-b-2 pb-0.5 ${
                    href === '/admin/candidates'
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

        {/* Page header */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <h1 className="font-headline font-extrabold text-5xl text-primary tracking-tighter mb-3">
              Candidate Registry
            </h1>
            <p className="text-on-surface-variant text-lg leading-relaxed max-w-2xl">
              Manage all candidates across elections. Review applications, update bios, and verify eligibility.
            </p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm flex flex-col gap-2 min-w-[200px] border border-outline-variant/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Total Candidates</span>
              <span className="material-symbols-outlined text-secondary text-xl">groups</span>
            </div>
            <p className="font-headline font-bold text-4xl text-primary">{String(totalCandidates).padStart(2, '0')}</p>
            <p className="text-xs text-on-surface-variant">Across {elections.length} elections</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Elections',  value: activeElections.length, icon: 'how_to_vote', color: 'text-emerald-600 bg-emerald-50' },
            { label: 'All Candidates',    value: totalCandidates,         icon: 'groups',       color: 'text-primary bg-primary/5'      },
            { label: 'In Open Elections', value: allCandidates.filter(c => c.electionStatus === 'active').length, icon: 'person', color: 'text-amber-600 bg-amber-50' },
            { label: 'Past Candidates',   value: allCandidates.filter(c => c.electionStatus === 'closed').length, icon: 'history', color: 'text-slate-600 bg-slate-100' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
              </div>
              <p className="font-headline font-extrabold text-2xl text-primary">{value}</p>
              <p className="text-xs text-on-surface-variant mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters & search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/20 px-4 py-2.5 rounded-xl flex-1">
            <span className="material-symbols-outlined text-outline text-sm">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search candidates…"
              className="bg-transparent border-none outline-none text-sm flex-1 text-on-surface placeholder:text-outline"
            />
          </div>
          <select
            value={electionFilter}
            onChange={e => setElectionFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-xl text-sm text-on-surface font-medium outline-none focus:border-secondary"
          >
            <option value="all">All Elections</option>
            {elections.map(e => (
              <option key={e.id} value={String(e.id)}>{e.title}</option>
            ))}
          </select>
        </div>

        {/* Candidate table */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
          <div className="px-8 py-5 flex items-center justify-between border-b border-surface-container">
            <h3 className="font-headline font-bold text-xl text-primary">
              {filtered.length} Candidate{filtered.length !== 1 ? 's' : ''}
            </h3>
          </div>

          {loading ? (
            <Spinner />
          ) : error ? (
            <p className="p-8 text-sm text-error">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-5xl text-outline-variant block mb-4">person_off</span>
              <p className="font-headline font-bold text-lg text-primary mb-2">No candidates found</p>
              <p className="text-sm text-on-surface-variant mb-6">
                {search ? 'Try a different search.' : 'Add candidates via the election editor.'}
              </p>
              <Link
                href="/admin/elections/new"
                className="px-6 py-3 btn-gradient text-on-primary rounded-xl text-sm font-bold inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                Create Election
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    {['Candidate', 'Position', 'Election', 'Status', ''].map(h => (
                      <th key={h} className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={`${c.electionId}-${c.id}`} className="registry-row border-t border-surface-container-low transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center flex-shrink-0 text-sm font-extrabold text-on-primary-container overflow-hidden">
                            {c.photo_url ? (
                              <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                              c.name?.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-headline font-bold text-primary">{c.name}</p>
                            {c.bio && <p className="text-xs text-on-surface-variant line-clamp-1 max-w-[200px] mt-0.5">{c.bio}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm text-on-surface">{c.position || '—'}</p>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-medium text-on-surface">{c.electionTitle}</p>
                      </td>
                      <td className="px-8 py-5">
                        <StatusBadge status={c.electionStatus} />
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/elections/${c.electionId}`}
                            className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors"
                            title="Edit election"
                          >
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-lg transition-colors"
                            title="Remove candidate"
                          >
                            <span className="material-symbols-outlined text-xl">person_remove</span>
                          </button>
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

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          candidate={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
