import { useEffect } from 'react';

const count = (arr) => Object.entries(arr.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="bars">
      {rows.map(([k, v]) => <li key={k}><span>{k}</span><i style={{ width: `${(v / max) * 100}%` }} /><b>{v}</b></li>)}
    </ul>
  );
}

export default function Stats({ books, onClose }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const read = books.filter((b) => b.status === 'read');
  const rated = books.filter((b) => b.rating > 0);
  const avg = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : '–';
  const pages = read.reduce((s, b) => s + (b.pages || 0), 0);
  const perYear = count(read.filter((b) => b.finished_on).map((b) => b.finished_on.slice(0, 4))).sort((a, b) => b[0] - a[0]);
  const loans = books.flatMap((b) => (b.loans || []).map((l) => ({ ...l, title: b.title })));
  const borrowers = count(loans.map((l) => l.to)).slice(0, 5);
  const mostLent = books.filter((b) => (b.loans || []).length).sort((a, b) => b.loans.length - a.loans.length).slice(0, 5).map((b) => [b.title, b.loans.length]);
  const fav = rated.filter((b) => b.rating === 5).length;

  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog wide" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <h2 className="display">Your library in numbers</h2>
        <div className="kpis">
          {[[books.length, 'books'], [read.length, 'read'], [books.filter((b) => b.status === 'to_read').length, 'on read list'], [avg, 'avg rating'], [fav, '5-star books'], [pages ? pages.toLocaleString() : '–', 'pages read']].map(([n, l]) => <div key={l}><strong>{n}</strong><span>{l}</span></div>)}
        </div>
        <div className="cols">
          <section><p className="label">By genre</p><Bars rows={count(books.map((b) => b.genre)).slice(0, 8)} /></section>
          <section><p className="label">By language</p><Bars rows={count(books.map((b) => b.language || 'English'))} /></section>
          {perYear.length > 0 && <section><p className="label">Finished per year</p><Bars rows={perYear} /></section>}
          {borrowers.length > 0 && <section><p className="label">Top borrowers</p><Bars rows={borrowers} /></section>}
          {mostLent.length > 0 && <section><p className="label">Most lent books</p><Bars rows={mostLent} /></section>}
        </div>
        {perYear.length === 0 && <p className="label">Set a finished date on books to see reading per year.</p>}
      </div>
    </div>
  );
}
