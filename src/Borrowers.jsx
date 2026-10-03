import { useEffect } from 'react';
import { askConfirm } from './dialogs.jsx';
import { currentLoan, overdueDays, remindAllLink, today } from './util.js';

export default function Borrowers({ books, people, onOpen, onPatch, onClose }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const now = {};
  books.forEach((b) => { const l = currentLoan(b); if (l) (now[l.to] = now[l.to] || []).push({ b, l }); });
  const past = {};
  books.forEach((b) => (b.loans || []).forEach((l) => { if (l.returned) past[l.to] = (past[l.to] || 0) + 1; }));
  const worst = (n) => Math.max(...now[n].map((x) => overdueDays(x.b)));
  const names = Object.keys(now).sort((a, c) => worst(c) - worst(a) || a.localeCompare(c));
  const gone = Object.keys(past).filter((n) => !now[n]).sort();
  const returnAll = (n) => now[n].forEach(({ b }) => { const l = [...b.loans]; l[l.length - 1] = { ...l.at(-1), returned: today() }; onPatch(b.id, { loans: l }); });

  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog wide" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <h2 className="display">Borrowers</h2>
        {names.length === 0 && <p className="label">Nobody has your books right now.</p>}
        {names.map((n) => (
          <section key={n} className="person">
            <div className="ph">
              <strong>{n}</strong>
              <span className="label">{now[n].length} {now[n].length > 1 ? 'books' : 'book'}{worst(n) > 0 ? ` · ` : ''}{worst(n) > 0 && <b className="late">{worst(n)}d overdue</b>}{past[n] ? ` · ${past[n]} returned before` : ''}</span>
            </div>
            <ul>
              {now[n].map(({ b, l }) => (
                <li key={b.id}><button onClick={() => { onClose(); onOpen(b.id); }}>{b.title}</button><span className={overdueDays(b) ? 'late' : 'label'}>{l.due ? `due ${l.due}` : 'no due date'}</span></li>
              ))}
            </ul>
            <div className="nav">
              <a className="btn" href={remindAllLink(n, people[n], now[n].map((x) => x.b.title))} target="_blank" rel="noreferrer">Remind about {now[n].length > 1 ? 'all' : 'it'} on WhatsApp</a>
              <button className="btn" onClick={async () => (await askConfirm({ title: `Mark ${n}'s books as returned?`, message: now[n].map((x) => x.b.title).join(', '), confirmLabel: 'Mark returned' })) && returnAll(n)}>Mark {now[n].length > 1 ? 'all ' : ''}returned</button>
            </div>
          </section>
        ))}
        {gone.length > 0 && (
          <section>
            <p className="label">Borrowed before, nothing out now</p>
            <p>{gone.map((n) => `${n} (${past[n]})`).join(', ')}</p>
          </section>
        )}
      </div>
    </div>
  );
}
