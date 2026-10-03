export default function Goal({ books, target, year, carried, onSet }) {
  // Counts books marked Read with a finished date in this calendar year, so it starts again at 0 on 1 January.
  const done = books.filter((b) => b.status === 'read' && (b.finished_on || '').startsWith(year)).length;
  const pct = target ? Math.min(1, done / target) : 0;
  const R = 16, C = 2 * Math.PI * R;
  return (
    <button className="goal" onClick={onSet} aria-label={target ? `Reading goal: ${done} of ${target} books in ${year}. Change goal` : 'Set a yearly reading goal'}>
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={R} className="g-bg" />
        <circle cx="20" cy="20" r={R} className="g-fg" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 20 20)" />
      </svg>
      <span>
        <strong>{done}{target ? ` of ${target}` : ''}</strong>
        <small>{target ? `books finished in ${year}${carried ? ' · goal carried over, tap to change' : ''}` : `finished in ${year}. Set a goal`}</small>
      </span>
    </button>
  );
}
