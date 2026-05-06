'use client';

export default function CandidateCard({
  candidate,
  selected = false,
  disabled = false,
  showVotes = false,
  totalVotes = 0,
  onSelect,
}) {
  const pct = totalVotes > 0 ? Math.round((candidate.voteCount / totalVotes) * 100) : 0;
  const isLeader = showVotes && candidate.voteCount > 0;

  function handleClick() {
    if (!disabled && onSelect) onSelect(candidate);
  }

  return (
    <div
      onClick={handleClick}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect && !disabled ? 0 : undefined}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      className={[
        'relative p-6 rounded-2xl border-2 transition-all duration-200 text-left w-full',
        disabled   ? 'cursor-default opacity-80'                                 : onSelect ? 'cursor-pointer' : '',
        selected   ? 'border-primary bg-primary/5 shadow-md'                    : 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/40 hover:shadow-sm',
        !disabled && !selected && onSelect ? 'hover:bg-surface-container-low'   : '',
      ].join(' ')}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-4 right-4 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
        </div>
      )}

      {/* Leader crown */}
      {isLeader && !selected && (
        <div className="absolute top-4 right-4 text-secondary text-xl">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center flex-shrink-0 overflow-hidden">
          {candidate.photoUrl ? (
            <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-headline font-extrabold text-2xl text-primary">
              {candidate.name?.charAt(0) || '?'}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-headline font-bold text-lg text-primary leading-tight">{candidate.name}</h3>
          {candidate.position && (
            <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-0.5">{candidate.position}</p>
          )}
          {candidate.bio && (
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed line-clamp-2">{candidate.bio}</p>
          )}
        </div>
      </div>

      {/* Vote bar */}
      {showVotes && (
        <div className="mt-5">
          <div className="flex justify-between text-xs font-medium text-on-surface-variant mb-1.5">
            <span>{candidate.voteCount?.toLocaleString() || 0} votes</span>
            <span className="font-bold text-primary">{pct}%</span>
          </div>
          <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full rounded-full progress-bar bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
