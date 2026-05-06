'use client';

const STATUS_STYLE = {
  active: 'bg-emerald-100 text-emerald-700',
  draft:  'bg-amber-100  text-amber-700',
  closed: 'bg-slate-100  text-slate-600',
};

export default function ElectionCard({ election, onClick, href }) {
  const Tag    = href ? 'a' : onClick ? 'button' : 'div';
  const tagProps = href ? { href } : onClick ? { onClick, type: 'button' } : {};

  return (
    <Tag
      {...tagProps}
      className="w-full text-left group p-6 bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 block"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="font-headline font-bold text-primary text-base leading-snug group-hover:text-primary/90 transition-colors line-clamp-2">
          {election.title}
        </h3>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLE[election.status] || 'bg-slate-100 text-slate-500'}`}>
          {election.status}
        </span>
      </div>

      {election.description && (
        <p className="text-on-surface-variant text-sm leading-relaxed line-clamp-2 mb-4">{election.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>groups</span>
          {election.candidateCount ?? election.candidate_count ?? 0} candidates
        </span>
        {(election.vote_count > 0 || election.totalVotes > 0) && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>ballot</span>
            {(election.vote_count ?? election.totalVotes ?? 0).toLocaleString()} votes
          </span>
        )}
        {election.start_time && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>calendar_month</span>
            {new Date(election.start_time).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </Tag>
  );
}
