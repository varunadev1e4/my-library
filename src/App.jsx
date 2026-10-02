import { useEffect, useMemo, useRef, useState } from 'react';
import { api, getPin, setPin, searchOpenLibrary } from './api.js';
import { today, addDays, currentLoan, overdueDays, remindLink, toCSV, download } from './util.js';
import Stats from './Stats.jsx';

const TABS = [['all', 'All'], ['read', 'Read'], ['reading', 'Reading'], ['to_read', 'To read'], ['lent', 'Lent out']];
const GENRES = ['Fiction', 'Nonfiction', 'Sci-Fi', 'Mystery & Thriller', 'Fantasy', 'Romance', 'Biography', 'Self-help', 'Telugu', 'Other'];

const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const look = (b) => {
  const h = hash(b.title + b.author);
  return { w: 24 + (h % 24), h: 200 + ((h >> 3) % 50), hue: h % 360, sat: 28 + ((h >> 5) % 25), lum: 24 + ((h >> 7) % 16), lean: -((h >> 9) % 4) };
};
const SORTS = {
  title: (a, b) => a.title.localeCompare(b.title),
  author: (a, b) => (a.author || '~').localeCompare(b.author || '~'),
  recent: (a, b) => b.created_at.localeCompare(a.created_at),
  rating: (a, b) => b.rating - a.rating,
  finished: (a, b) => (b.finished_on || '').localeCompare(a.finished_on || ''),
  due: (a, b) => (currentLoan(a)?.due || '9').localeCompare(currentLoan(b)?.due || '9'),
};
const SORT_LABELS = [['title', 'Title'], ['author', 'Author'], ['recent', 'Recently added'], ['rating', 'Rating'], ['finished', 'Date finished'], ['due', 'Due date']];

/* ---------- PIN gate ---------- */
function PinGate({ onOk }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function change(e) {
    const n = e.target.value.replace(/\D/g, '').slice(0, 6);
    setV(n); setErr('');
    if (n.length === 6) {
      setBusy(true); setPin(n);
      try { onOk(await api.list()); }
      catch (x) { setPin(''); setV(''); setErr(x.message === '401' ? 'Wrong PIN. Try again.' : x.message); }
      setBusy(false);
    }
  }
  return (
    <main className="gate">
      <p className="label">A personal archive</p>
      <h1 className="display">My library</h1>
      <label className="pin" aria-label="6-digit PIN">
        <input autoFocus type="password" inputMode="numeric" autoComplete="current-password" value={v} onChange={change} disabled={busy} />
        <span className="dots">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className={i < v.length ? 'on' : ''} />)}</span>
      </label>
      <p className="err" role="alert">{busy ? 'Checking…' : err || 'Enter your 6-digit PIN'}</p>
    </main>
  );
}

/* ---------- Shelf ---------- */
function Shelf({ books, onOpen }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const wheel = (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollLeft += e.deltaY; } };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  return (
    <div className="shelf" ref={ref}>
      <div className="row">
        {books.map((b) => {
          const s = look(b); const lent = currentLoan(b);
          return (
            <button key={b.id} className="spine-hit" style={{ width: s.w, height: s.h }} onClick={() => onOpen(b.id)} aria-label={`${b.title} by ${b.author}`}>
              <span className="spine" style={{ background: `linear-gradient(90deg, hsl(${s.hue} ${s.sat}% ${s.lum + 6}%), hsl(${s.hue} ${s.sat}% ${s.lum}%) 40%, hsl(${s.hue} ${s.sat}% ${s.lum - 5}%))`, transform: `rotate(${s.lean}deg)` }}>
                <b>{b.title}</b>
                {s.w > 34 && <em>{b.author}</em>}
                {lent && <u className={overdueDays(b) ? 'late' : ''} title={`With ${lent.to}`} />}
                {b.status === 'to_read' && <s title="To read" />}
              </span>
              <span className="tip"><strong>{b.title}</strong>{b.author}{lent ? ` · with ${lent.to}${overdueDays(b) ? ' (overdue)' : ''}` : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="ground" />
    </div>
  );
}

/* ---------- Grid ---------- */
function Grid({ books, onOpen }) {
  return (
    <div className="grid">
      {books.map((b) => {
        const s = look(b); const lent = currentLoan(b); const late = overdueDays(b);
        return (
          <button key={b.id} className="card" onClick={() => onOpen(b.id)}>
            {b.cover ? <img loading="lazy" src={b.cover.replace('-L', '-M')} alt="" /> : <div className="nocover sm" style={{ background: `hsl(${s.hue} ${s.sat}% ${s.lum}%)` }}><b>{b.title}</b></div>}
            <strong>{b.title}</strong><span>{b.author}</span>
            {lent && <em className={late ? 'late' : ''}>{late ? `${late}d overdue · ` : 'With '}{lent.to}</em>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Editable field ---------- */
function F({ book, k, label, type = 'text', list, onPatch }) {
  return (
    <label className="ef"><span>{label}</span>
      <input key={book.id + String(book[k])} type={type} list={list} defaultValue={book[k] ?? ''} onBlur={(e) => {
        let v = e.target.value.trim();
        if (k === 'title' && !v) return;
        if (type === 'number') v = v === '' ? null : +v;
        if (type === 'date') v = v || null;
        if (v !== (book[k] ?? '') && !(v === null && book[k] == null)) onPatch(book.id, { [k]: v });
      }} />
    </label>
  );
}

/* ---------- Detail ---------- */
function Detail({ book, people, onClose, onPatch, onDelete, onPrev, onNext }) {
  const [who, setWho] = useState('');
  const [phone, setPhone] = useState('');
  const [days, setDays] = useState('14');
  const [notes, setNotes] = useState(book.notes);
  useEffect(() => setNotes(book.notes), [book.id]);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { if (e.key === 'ArrowLeft') onPrev(); if (e.key === 'ArrowRight') onNext(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  const loan = currentLoan(book);
  const lend = () => { if (!who.trim()) return; onPatch(book.id, { loans: [...(book.loans || []), { to: who.trim(), phone: phone.trim(), on: today(), due: days ? addDays(today(), +days) : null, returned: null }] }); setWho(''); setPhone(''); };
  const late = overdueDays(book);
  const extend = () => { const l = [...book.loans]; const last = l.at(-1); l[l.length - 1] = { ...last, due: addDays(last.due && last.due > today() ? last.due : today(), 7) }; onPatch(book.id, { loans: l }); };
  const giveBack = () => { const l = [...book.loans]; l[l.length - 1] = { ...l[l.length - 1], returned: today() }; onPatch(book.id, { loans: l }); };
  const s = look(book);

  return (
    <div className="modal" onClick={onClose}>
      <article className="detail" onClick={(e) => e.stopPropagation()}>
        <div className="cover">
          {book.cover ? <img src={book.cover} alt={`Cover of ${book.title}`} /> : <div className="nocover" style={{ background: `hsl(${s.hue} ${s.sat}% ${s.lum}%)` }}><b>{book.title}</b><em>{book.author}</em></div>}
        </div>
        <div className="info">
          <button className="x" onClick={onClose} aria-label="Close">×</button>
          <p className="label">{book.genre}{book.year ? ` · ${book.year}` : ''}{book.publisher ? ` · ${book.publisher}` : ''}</p>
          <h2 className="display">{book.title}</h2>
          <p className="author">{book.author}</p>

          <div className="field">
            <select value={book.status} onChange={(e) => onPatch(book.id, { status: e.target.value, ...(e.target.value === 'read' && !book.finished_on ? { finished_on: today() } : {}) })} aria-label="Reading status">
              <option value="read">Read</option><option value="reading">Reading now</option><option value="to_read">On my read list</option>
            </select>
            <select value={book.genre} onChange={(e) => onPatch(book.id, { genre: e.target.value })} aria-label="Genre">
              {[...new Set([book.genre, ...GENRES])].map((g) => <option key={g}>{g}</option>)}
            </select>
            <span className="stars" role="group" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} className={n <= book.rating ? 'on' : ''} onClick={() => onPatch(book.id, { rating: book.rating === n ? 0 : n })} aria-label={`${n} star`}>★</button>)}
            </span>
          </div>

          <section className="lend">
            <p className="label">Lending</p>
            {loan ? (
              <>
                <p>With <strong>{loan.to}</strong> since {loan.on}.{loan.due && <> Due {loan.due}.</>}{late > 0 && <b className="late"> {late} days overdue</b>}</p>
                <div className="nav">
                  <button className="btn" onClick={giveBack}>Mark returned</button>
                  <button className="btn" onClick={extend}>Extend 7 days</button>
                  <a className="btn" href={remindLink(book, loan)} target="_blank" rel="noreferrer">Remind on WhatsApp</a>
                </div>
              </>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); lend(); }}>
                <input value={who} list="people" onChange={(e) => { setWho(e.target.value); if (people[e.target.value] && !phone) setPhone(people[e.target.value]); }} placeholder="Lend to (name)" />
                <datalist id="people">{Object.keys(people).map((n) => <option key={n} value={n} />)}</datalist>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp number (optional)" inputMode="tel" />
                <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Return in">
                  <option value="7">Due in 1 week</option><option value="14">Due in 2 weeks</option><option value="30">Due in 1 month</option><option value="60">Due in 2 months</option><option value="">No due date</option>
                </select>
                <button className="btn primary" type="submit">Lend</button>
              </form>
            )}
            {(book.loans || []).filter((l) => l.returned).length > 0 && (
              <ul className="hist">{book.loans.filter((l) => l.returned).reverse().map((l, i) => <li key={i}>{l.to}: {l.on} to {l.returned}</li>)}</ul>
            )}
          </section>

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== book.notes && onPatch(book.id, { notes })} placeholder="Notes, thoughts, quotes…" rows={4} />
          <details className="edit">
            <summary>Edit details</summary>
            <div className="efs">
              <F book={book} k="title" label="Title" onPatch={onPatch} />
              <F book={book} k="author" label="Author" onPatch={onPatch} />
              <F book={book} k="language" label="Language" list="langs" onPatch={onPatch} />
              <datalist id="langs"><option>English</option><option>Telugu</option><option>Hindi</option><option>Tamil</option><option>Urdu</option></datalist>
              <F book={book} k="pages" label="Pages" type="number" onPatch={onPatch} />
              <F book={book} k="year" label="Year" type="number" onPatch={onPatch} />
              <F book={book} k="finished_on" label="Finished on" type="date" onPatch={onPatch} />
              <F book={book} k="publisher" label="Publisher" onPatch={onPatch} />
              <F book={book} k="cover" label="Cover image URL" onPatch={onPatch} />
            </div>
          </details>
          <div className="nav">
            <button className="btn" onClick={onPrev}>Previous</button>
            <button className="btn" onClick={onNext}>Next</button>
            <button className="btn danger" onClick={() => confirm(`Delete "${book.title}"?`) && onDelete(book.id)}>Delete</button>
          </div>
        </div>
      </article>
    </div>
  );
}

/* ---------- Add ---------- */
function AddDialog({ books, genres, onClose, onAdded }) {
  const has = (t) => books.some((b) => b.title.trim().toLowerCase() === String(t).trim().toLowerCase());
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [status, setStatus] = useState('read');
  const [genre, setGenre] = useState('Fiction');
  const [mode, setMode] = useState('one');
  const [bulk, setBulk] = useState('');
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');
  const t = useRef();

  useEffect(() => {
    clearTimeout(t.current);
    if (mode !== 'one' || q.trim().length < 2) { setRes([]); return; }
    t.current = setTimeout(() => searchOpenLibrary(q).then(setRes).catch(() => setRes([])), 300);
  }, [q, mode]);

  async function add(item) {
    try { const [row] = await api.add({ ...item, status, genre }); onAdded([row]); onClose(); } catch (e) { setErr(e.message); }
  }
  async function importBulk() {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      setProgress(`Looking up ${i + 1} of ${lines.length}…`);
      const [title, author = ''] = lines[i].split(/\s+[-–|]\s+/);
      let hit = null;
      try { hit = (await searchOpenLibrary(`${title} ${author}`.trim()))[0]; } catch {}
      rows.push({ title: hit?.title || title, author: hit?.author || author, cover: hit?.cover || '', year: hit?.year || null, publisher: hit?.publisher || '', status, genre });
    }
    const seen = new Set(); const fresh = rows.filter((r) => { const k = r.title.toLowerCase(); if (has(r.title) || seen.has(k)) return false; seen.add(k); return true; });
    const skipped = rows.length - fresh.length;
    if (!fresh.length) { setErr('All of these are already in your library.'); setProgress(''); return; }
    setProgress('Saving…');
    try {
      const saved = [];
      for (let i = 0; i < fresh.length; i += 50) saved.push(...(await api.addMany(fresh.slice(i, i + 50))));
      onAdded(saved, skipped); onClose();
    } catch (e) { setErr(e.message); setProgress(''); }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <h2 className="display">Add books</h2>
        <div className="tabs">
          <button className={mode === 'one' ? 'on' : ''} onClick={() => setMode('one')}>Search one</button>
          <button className={mode === 'bulk' ? 'on' : ''} onClick={() => setMode('bulk')}>Paste a list</button>
        </div>
        <div className="field">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="read">Already read</option><option value="reading">Reading now</option><option value="to_read">Read list</option>
          </select>
          <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">{[...new Set([...GENRES, ...genres])].map((g) => <option key={g}>{g}</option>)}</select>
        </div>
        {mode === 'one' ? (
          <>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or author…" />
            <ul className="results">
              {res.map((r, i) => (
                <li key={i}><button onClick={() => add(r)}>
                  {r.cover ? <img src={r.cover.replace('-L', '-S')} alt="" /> : <span className="thumb" />}
                  <span><strong>{r.title}</strong><br />{r.author}{r.year ? ` · ${r.year}` : ''}{has(r.title) && <em className="dup"> · already in your library</em>}</span>
                </button></li>
              ))}
              {q.trim().length >= 2 && <li><button onClick={() => add({ title: q.trim(), author: '' })}><span className="thumb" /><span><strong>Add "{q.trim()}" without a cover</strong><br />Not listed? Save it as typed.</span></button></li>}
            </ul>
          </>
        ) : (
          <>
            <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={9} placeholder={'One book per line. Author is optional:\nSapiens - Yuval Noah Harari\nThe Alchemist\nWings of Fire - A. P. J. Abdul Kalam'} />
            <button className="btn primary" disabled={!bulk.trim() || !!progress} onClick={importBulk}>{progress || `Add ${bulk.split('\n').filter((l) => l.trim()).length} books`}</button>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </div>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [books, setBooks] = useState(null);
  const [tab, setTab] = useState('all');
  const [genre, setGenre] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');
  const [sort, setSort] = useState('title');
  const [view, setView] = useState('shelf');
  const [stats, setStats] = useState(false);

  useEffect(() => { if (getPin()) api.list().then(setBooks).catch(() => setPin('')); }, []);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const genres = useMemo(() => [...new Set((books || []).map((b) => b.genre))].sort(), [books]);
  const shown = useMemo(() => (books || []).filter((b) => {
    if (tab === 'lent' ? !currentLoan(b) : tab !== 'all' && b.status !== tab) return false;
    if (genre && b.genre !== genre) return false;
    const n = q.trim().toLowerCase();
    return !n || [b.title, b.author, b.genre, b.notes, currentLoan(b)?.to].join(' ').toLowerCase().includes(n);
  }).sort(SORTS[tab === 'lent' && sort === 'title' ? 'due' : sort]), [books, tab, genre, q, sort]);

  if (!books) return <PinGate onOk={setBooks} />;

  const open = books.find((b) => b.id === openId);
  const step = (d) => { const i = shown.findIndex((b) => b.id === openId); if (i >= 0 && shown.length) setOpenId(shown[(i + d + shown.length) % shown.length].id); };
  const patch = async (id, f) => {
    const prev = books; setBooks((bs) => bs.map((b) => (b.id === id ? { ...b, ...f } : b)));
    try { await api.update(id, f); } catch (e) { setBooks(prev); flash('Could not save: ' + e.message); }
  };
  const del = async (id) => { try { await api.remove(id); setBooks((bs) => bs.filter((b) => b.id !== id)); setOpenId(null); } catch (e) { flash(e.message); } };
  const lentCount = books.filter(currentLoan).length;
  const lateCount = books.filter(overdueDays).length;
  const people = {}; books.forEach((b) => (b.loans || []).forEach((l) => { if (l.to && (l.phone || !(l.to in people))) people[l.to] = l.phone || people[l.to] || ''; }));
  const pick = () => { const pool = books.filter((b) => b.status === 'to_read'); if (!pool.length) return flash('Your read list is empty. Add books with "Read list" status.'); setOpenId(pool[Math.floor(Math.random() * pool.length)].id); };

  return (
    <div className="app">
      <header>
        <p className="label">A personal archive</p>
        <h1 className="display">My library</h1>
        <p className="label">{books.length} volumes{lentCount ? ` · ${lentCount} lent out` : ''}{lateCount ? ` · ${lateCount} overdue` : ''}</p>
        <div className="bar">
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author, notes, borrower…" aria-label="Search" />
          <button className="btn primary" onClick={() => setAdding(true)}>Add books</button>
          <button className="btn" onClick={() => { setPin(''); setBooks(null); }}>Lock</button>
        </div>
        <div className="tools">
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">{SORT_LABELS.map(([k, l]) => <option key={k} value={k}>Sort: {l}</option>)}</select>
          <button className="btn" onClick={() => setView(view === 'shelf' ? 'grid' : 'shelf')}>{view === 'shelf' ? 'Grid view' : 'Shelf view'}</button>
          <button className="btn" onClick={pick}>Pick my next read</button>
          <button className="btn" onClick={() => setStats(true)}>Stats</button>
          <button className="btn" onClick={() => download(`library-${today()}.csv`, toCSV(books), 'text/csv')}>Export CSV</button>
          <button className="btn" onClick={() => download(`library-backup-${today()}.json`, JSON.stringify(books, null, 2), 'application/json')}>Backup JSON</button>
        </div>
        <nav className="tabs" aria-label="Shelves">
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
        <nav className="pills no-scroll" aria-label="Genres">
          <button className={!genre ? 'on' : ''} onClick={() => setGenre('')}>All genres</button>
          {genres.map((g) => <button key={g} className={genre === g ? 'on' : ''} onClick={() => setGenre(genre === g ? '' : g)}>{g}</button>)}
        </nav>
      </header>

      {shown.length ? (view === 'shelf' ? <Shelf books={shown} onOpen={setOpenId} /> : <Grid books={shown} onOpen={setOpenId} />) : (
        <p className="empty">{books.length ? 'No books match. Clear a filter or search.' : 'Your shelf is empty. Use Add books to paste your list or search one by one.'}</p>
      )}

      {open && <Detail book={open} people={people} onClose={() => setOpenId(null)} onPatch={patch} onDelete={del} onPrev={() => step(-1)} onNext={() => step(1)} />}
      {adding && <AddDialog books={books} genres={genres} onClose={() => setAdding(false)} onAdded={(rows, skipped = 0) => { setBooks((bs) => [...rows, ...bs]); flash(`Added ${rows.length} book${rows.length > 1 ? 's' : ''}${skipped ? `, skipped ${skipped} duplicate${skipped > 1 ? 's' : ''}` : ''}`); }} />}
      {stats && <Stats books={books} onClose={() => setStats(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
