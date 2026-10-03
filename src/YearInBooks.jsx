import { useEffect, useState } from 'react';
import { today } from './util.js';
import { coverSrc } from './api.js';

const count = (arr) => Object.entries(arr.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function YearInBooks({ books, goals, onOpen, onClose }) {
  const read = books.filter((b) => b.status === 'read');
  const years = [...new Set(read.filter((b) => b.finished_on).map((b) => b.finished_on.slice(0, 4)))].sort().reverse();
  const [year, setYear] = useState(years[0] || today().slice(0, 4));
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);

  const list = read.filter((b) => (b.finished_on || '').startsWith(year)).sort((a, b) => a.finished_on.localeCompare(b.finished_on));
  const undated = read.filter((b) => !b.finished_on).length;
  const withPages = list.filter((b) => b.pages);
  const rated = list.filter((b) => b.rating > 0);
  const pages = withPages.reduce((s, b) => s + b.pages, 0);
  const avg = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : '–';
  const longest = [...withPages].sort((a, b) => b.pages - a.pages)[0];
  const shortest = [...withPages].sort((a, b) => a.pages - b.pages)[0];
  const best = list.filter((b) => b.rating === 5);
  const months = Array(12).fill(0); list.forEach((b) => { months[+b.finished_on.slice(5, 7) - 1]++; });
  const maxM = Math.max(1, ...months);
  const topGenre = count(list.map((b) => b.genre))[0];
  const goal = goals[year];

  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog wide" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <h2 className="display">Year in books</h2>
        <div className="field">
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
            {[...new Set([...years, today().slice(0, 4)])].sort().reverse().map((y) => <option key={y}>{y}</option>)}
          </select>
          {goal ? <span className="label">Goal: {list.length} of {goal}</span> : null}
        </div>
        {list.length === 0 ? <p className="label">No books marked read with a finished date in {year}.</p> : (
          <>
            <div className="kpis">
              {[[list.length, 'books'], [pages ? pages.toLocaleString() : '–', 'pages'], [avg, 'avg rating'], [topGenre ? topGenre[0] : '–', 'top genre']].map(([v, l]) => <div key={l}><strong style={{ fontSize: String(v).length > 10 ? 18 : undefined }}>{v}</strong><span>{l}</span></div>)}
            </div>
            <div className="months" role="img" aria-label="Books finished per month">
              {months.map((m, i) => <div key={i}><b style={{ height: `${(m / maxM) * 100}%` }} /><span>{MONTHS[i]}</span><em>{m || ''}</em></div>)}
            </div>
            <div className="cols">
              {longest && <section><p className="label">Longest</p><p><button className="lnk" onClick={() => { onClose(); onOpen(longest.id); }}>{longest.title}</button> · {longest.pages} pages</p></section>}
              {shortest && shortest !== longest && <section><p className="label">Shortest</p><p><button className="lnk" onClick={() => { onClose(); onOpen(shortest.id); }}>{shortest.title}</button> · {shortest.pages} pages</p></section>}
              <section><p className="label">First and last finished</p><p>{list[0].title}<br />{list.at(-1).title}</p></section>
            </div>
            {best.length > 0 && <section><p className="label">Five-star books</p><p>{best.map((b) => b.title).join(', ')}</p></section>}
            <p className="label">Every book finished in {year}</p>
            <div className="mini">
              {list.map((b) => (
                <button key={b.id} onClick={() => { onClose(); onOpen(b.id); }} title={b.title}>
                  {b.cover ? <img loading="lazy" src={coverSrc(b.cover, 'S')} alt={b.title} /> : <span>{b.title}</span>}
                </button>
              ))}
            </div>
          </>
        )}
        {undated > 0 && <p className="label">{undated} books marked read have no finished date, so they don't appear in any year. Add the date under Edit details.</p>}
      </div>
    </div>
  );
}
