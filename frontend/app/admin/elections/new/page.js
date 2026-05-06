'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAdmin } from '@/hooks/useAuth';
import { admin } from '@/lib/api';

function FieldGroup({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-on-surface mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}

export default function NewElectionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAdmin();

  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '' });
  const [candidates, setCandidates] = useState([
    { name: '', position: '', bio: '', photoUrl: '' },
    { name: '', position: '', bio: '', photoUrl: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setCandidate(i, k, v) {
    setCandidates(cs => cs.map((c, idx) => idx === i ? { ...c, [k]: v } : c));
  }
  function addCandidate() { setCandidates(cs => [...cs, { name: '', position: '', bio: '', photoUrl: '' }]); }
  function removeCandidate(i) {
    if (candidates.length <= 2) return;
    setCandidates(cs => cs.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const validCandidates = candidates.filter(c => c.name.trim());
    if (validCandidates.length < 2) { setError('At least 2 candidates with names are required.'); return; }
    if (form.startTime && form.endTime && new Date(form.endTime) <= new Date(form.startTime)) {
      setError('End time must be after start time.'); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        candidates: validCandidates.map((c, i) => ({
          name: c.name.trim(),
          position: c.position.trim() || undefined,
          bio: c.bio.trim() || undefined,
          photoUrl: c.photoUrl.trim() || undefined,
          displayOrder: i,
        })),
      };
      const result = await admin.elections.create(payload);
      router.push(`/admin/elections/${result.election.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create election.');
    } finally {
      setSubmitting(false);
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

  const inputCls = 'w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';

  return (
    <div className="min-h-screen bg-surface">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center justify-between px-8 h-16">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
              <span className="text-sm font-medium">Back</span>
            </Link>
            <div className="h-4 w-px bg-outline-variant" />
            <span className="font-headline font-bold text-primary">New Election</span>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-8 py-12 space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-headline font-extrabold text-4xl text-primary tracking-tight mb-2">Create New Election</h1>
          <p className="text-on-surface-variant">Set up a new ballot, define candidates, and configure the voting window.</p>
        </div>

        {error && (
          <div className="p-4 bg-error-container text-on-error-container rounded-xl text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Election details */}
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-5">
            <h2 className="font-headline font-bold text-lg text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">info</span>
              Election Details
            </h2>
            <FieldGroup label="Election title *">
              <input required value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Student Union President 2026" className={inputCls} />
            </FieldGroup>
            <FieldGroup label="Description" hint="Optional — shown to voters on the elections page.">
              <textarea value={form.description} onChange={e => setField('description', e.target.value)} rows={3} placeholder="Describe the election…" className={inputCls + ' resize-none'} />
            </FieldGroup>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup label="Start time" hint="Leave blank to open manually.">
                <input type="datetime-local" value={form.startTime} onChange={e => setField('startTime', e.target.value)} className={inputCls} />
              </FieldGroup>
              <FieldGroup label="End time" hint="Leave blank to close manually.">
                <input type="datetime-local" value={form.endTime} onChange={e => setField('endTime', e.target.value)} className={inputCls} />
              </FieldGroup>
            </div>
          </div>

          {/* Candidates */}
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/10 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-headline font-bold text-lg text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">groups</span>
                Candidates
                <span className="text-xs font-normal text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">min. 2</span>
              </h2>
              <button type="button" onClick={addCandidate} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors">
                <span className="material-symbols-outlined text-base">add</span>
                Add Candidate
              </button>
            </div>

            <div className="space-y-4">
              {candidates.map((c, i) => (
                <div key={i} className="p-5 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Candidate {i + 1}</span>
                    {candidates.length > 2 && (
                      <button type="button" onClick={() => removeCandidate(i)} className="p-1 text-outline hover:text-error rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    )}
                  </div>
                  <input required value={c.name} onChange={e => setCandidate(i, 'name', e.target.value)} placeholder="Full name *" className={inputCls} />
                  <input value={c.position} onChange={e => setCandidate(i, 'position', e.target.value)} placeholder="Position / Faculty (optional)" className={inputCls} />
                  <input value={c.photoUrl} onChange={e => setCandidate(i, 'photoUrl', e.target.value)} placeholder="Photo URL — https://... (optional)" className={inputCls} />
                  {c.photoUrl && (
                    <div className="flex items-center gap-3">
                      <img src={c.photoUrl} alt="preview" className="w-12 h-12 rounded-xl object-cover border border-outline-variant" onError={e => { e.target.style.display = 'none'; }} />
                      <span className="text-xs text-on-surface-variant">Photo preview</span>
                    </div>
                  )}
                  <textarea value={c.bio} onChange={e => setCandidate(i, 'bio', e.target.value)} rows={2} placeholder="Short bio (optional)" className={inputCls + ' resize-none'} />
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/admin" className="flex-1 py-3.5 border-2 border-outline-variant text-on-surface-variant rounded-xl font-bold text-sm hover:border-primary hover:text-primary transition-colors text-center">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !form.title.trim()}
              className="flex-1 py-3.5 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Creating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">add_circle</span>
                  Create Election
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
