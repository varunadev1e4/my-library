import { useEffect, useState } from 'react';
import { api, searchOpenLibrary } from './api.js';
import { parseCSV, mapGoodreads, isGoodreadsCSV } from './goodreads.js';

export default function GoodreadsImport({ books, genres, onClose, onAdded }) {
  const [rows, setRows] = useState(null);
  const [genre, setGenre] = useState('Other');
  const [covers, setCovers] = useState(true);
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { const k = (e) => e.key === 'Escape' && !progress && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [progress]);

  function onFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setErr(''); setRows(null);
    f.text().then((t) => {
      const parsed = parseCSV(t);
      if (!isGoodreadsCSV(parsed)) return setErr('That does not look like a Goodreads export. On Goodreads, open My Books, then Import and export, then Export Library.');
      setRows(parsed.map(mapGoodreads).filter((b) => b.title));
    }).catch(() => setErr('Could not read that file.'));
  }

  const have = new Set(books.map((b) => b.title.trim().toLowerCase()));
  const seen = new Set();
  const fresh = (rows || []).filter((b) => { const k = b.title.toLowerCase(); if (have.has(k) || seen.has(k)) return false; seen.add(k); return true; });
  const skipped = (rows || []).length - fresh.length;
  const n = (s) => fresh.filter((b) => b.status === s).length;

  async function run() {
    setErr('');
    const out = fresh.map((b) => ({ ...b, genre, cover: '' }));
    try {
      if (covers) {
        for (let i = 0; i < out.length; i += 4) {
          setProgress(`Finding covers… ${Math.min(i + 4, out.length)} of ${out.length}`);
          await Promise.all(out.slice(i, i + 4).map(async (b) => {
            try { const hit = (await searchOpenLibrary(`${b.title} ${b.author}`.trim()))[0]; if (hit) { b.cover = hit.cover || ''; if (!b.publisher) b.publisher = hit.publisher || ''; if (!b.year) b.year = hit.year || null; } } catch {}
          }));
        }
      }
      const saved = [];
      for (let i = 0; i < out.length; i += 50) { setProgress(`Saving… ${Math.min(i + 50, out.length)} of ${out.length}`); saved.push(...(await api.addMany(out.slice(i, i + 50)))); }
      onAdded(saved, skipped); onClose();
    } catch (x) { setErr(x.message); setProgress(''); }
  }

  return (
    <div className="modal" onClick={() => !progress && onClose()}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close" disabled={!!progress}>×</button>
        <h2 className="display">Import from Goodreads</h2>
        <ol className="how">
          <li>On Goodreads, open <b>My Books</b>, then <b>Import and export</b>.</li>
          <li>Click <b>Export Library</b>, wait for the file, and download the CSV.</li>
          <li>Choose that file below. Nothing is imported until you confirm.</li>
        </ol>
        <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={!!progress} />
        {rows && (
          <>
            <div className="kpis">
              <div><strong>{fresh.length}</strong><span>new books</span></div>
              <div><strong>{n('read')}</strong><span>read</span></div>
              <div><strong>{n('reading')}</strong><span>reading</span></div>
              <div><strong>{n('to_read')}</strong><span>to read</span></div>
            </div>
            {skipped > 0 && <p className="label">{skipped} already in your library or repeated in the file. These will be skipped.</p>}
            <div className="field">
              <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre for imported books">{genres.map((g) => <option key={g}>{g}</option>)}</select>
              <label className="chk"><input type="checkbox" checked={covers} onChange={(e) => setCovers(e.target.checked)} /> Find covers (about a minute)</label>
            </div>
            <p className="label">Goodreads has no genres, so every imported book gets the genre above. Your Goodreads shelves become shelves here, and ratings, dates read, page counts, series and notes come along.</p>
            <button className="btn primary" disabled={!fresh.length || !!progress} onClick={run}>{progress || `Import ${fresh.length} books`}</button>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </div>
  );
}
