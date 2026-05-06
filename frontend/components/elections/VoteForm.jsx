'use client';

import { useState } from 'react';
import CandidateCard from './CandidateCard';

export default function VoteForm({ candidates, onSubmit, disabled }) {
  const [selected, setSelected]   = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit(selected.id);
    } catch (err) {
      setError(err.message || 'Failed to submit vote. Please try again.');
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming && selected) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Confirmation card */}
        <div className="p-8 bg-surface-container-lowest rounded-2xl border-2 border-primary/20 text-center">
          <div className="w-16 h-16 bg-secondary-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-on-secondary-container text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>how_to_vote</span>
          </div>
          <h3 className="font-headline font-bold text-xl text-primary mb-2">Confirm your vote</h3>
          <p className="text-sm text-on-surface-variant mb-6">
            You are about to cast your vote for:
          </p>

          <div className="p-4 bg-surface-container rounded-xl mb-6">
            <p className="font-headline font-extrabold text-2xl text-primary">{selected.name}</p>
            {selected.position && (
              <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">{selected.position}</p>
            )}
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-left mb-6">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">warning</span>
              This action cannot be undone
            </p>
            <p className="text-xs text-amber-600">
              Your vote is permanent and anonymous. Once submitted it cannot be changed or retracted.
            </p>
          </div>

          {error && (
            <p className="text-sm text-error flex items-center justify-center gap-1.5 mb-4">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setConfirming(false); setError(''); }}
              disabled={loading}
              className="flex-1 py-3 border-2 border-outline-variant text-on-surface-variant rounded-xl font-bold text-sm hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            >
              Go Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-3 btn-gradient text-on-primary rounded-xl font-headline font-bold text-sm shadow-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">verified</span>
                  Confirm Vote
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">Select a candidate to cast your vote.</p>

      <div className="grid grid-cols-1 gap-4">
        {candidates.map(c => (
          <CandidateCard
            key={c.id}
            candidate={c}
            selected={selected?.id === c.id}
            disabled={disabled}
            onSelect={setSelected}
          />
        ))}
      </div>

      <button
        onClick={() => setConfirming(true)}
        disabled={!selected || disabled}
        className="w-full py-4 btn-gradient text-on-primary rounded-xl font-headline font-bold shadow-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 mt-6"
      >
        <span className="material-symbols-outlined text-xl">how_to_vote</span>
        {selected ? `Vote for ${selected.name}` : 'Select a Candidate'}
      </button>
    </div>
  );
}
