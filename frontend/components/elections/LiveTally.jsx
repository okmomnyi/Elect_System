'use client';

import { useEffect, useState } from 'react';
import { useElectionSocket } from '@/hooks/useSocket';
import CandidateCard from './CandidateCard';

export default function LiveTally({ electionId, initialResults = [] }) {
  const [results, setResults] = useState(initialResults);
  const { connected } = useElectionSocket(electionId, {
    // current_tally carries authoritative counts but no names — merge by id,
    // keeping candidate names/positions from the initial REST payload.
    onTally: (rows) => {
      const byId = Object.fromEntries(rows.map(r => [r.candidateId, r.votes]));
      setResults(prev =>
        [...prev]
          .map(c => (byId[c.id] != null ? { ...c, voteCount: byId[c.id] } : c))
          .sort((a, b) => b.voteCount - a.voteCount)
      );
    },
    onVote: ({ candidateId, votes }) => {
      setResults(prev =>
        [...prev]
          .map(c => (c.id === candidateId ? { ...c, voteCount: votes } : c))
          .sort((a, b) => b.voteCount - a.voteCount)
      );
    },
  });

  const total = results.reduce((s, c) => s + (c.voteCount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-headline font-bold text-xl text-primary">Live Results</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">{total.toLocaleString()} total votes</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${connected ? 'bg-emerald-100 text-emerald-700' : 'bg-outline-variant/30 text-on-surface-variant'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-on-surface-variant'}`} />
          {connected ? 'Live' : 'Connecting…'}
        </div>
      </div>

      {/* Candidates */}
      <div className="space-y-3">
        {results.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-8 text-center">No votes recorded yet.</p>
        ) : (
          results.map(c => (
            <CandidateCard
              key={c.id}
              candidate={c}
              showVotes
              totalVotes={total}
              disabled
            />
          ))
        )}
      </div>
    </div>
  );
}
