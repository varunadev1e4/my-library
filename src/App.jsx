import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { api, settings, getPin, setPin, searchOpenLibrary, coverSrc } from './api.js';
import { today, addDays, currentLoan, overdueDays, remindLink, toCSV, download, priorityRank } from './util.js';
import Goal from './Goal.jsx';
import Logo from './Logo.jsx';
import Icon from './Icon.jsx';

// Loaded only when opened, so the first screen loads faster
const Stats = lazy(() => import('./Stats.jsx'));
const Borrowers = lazy(() => import('./Borrowers.jsx'));
const Journal = lazy(() => import('./Journal.jsx'));
const GoodreadsImport = lazy(() => import('./GoodreadsImport.jsx'));
const YearInBooks = lazy(() => import('./YearInBooks.jsx'));

const IDLE_MINUTES = 15; // auto-lock after this many idle minutes; set to 0 to turn off

const TABS = [['all', 'All'], ['reading', 'Reading'], ['to_read', 'Read list'], ['read', 'Read'], ['lent', 'Lent out']];
const GENRES = [
  'Fiction', 'Literary Fiction', 'Classics', 'Historical Fiction', 'Sci-Fi', 'Fantasy', 'Mystery & Thriller', 'Crime', 'Horror', 'Romance', 'Humor',
  'Short Stories', 'Poetry', 'Plays & Drama', 'Graphic Novels & Comics', 'Young Adult', "Children's", 'Mythology & Folklore',
  'Nonfiction', 'Biography & Memoir', 'Autobiography', 'History', 'Politics & Society', 'Economics', 'Business', 'Finance & Investing', 'Leadership & Management',
  'Self-help', 'Psychology', 'Philosophy', 'Spirituality & Religion', 'Science', 'Technology & Computing', 'Mathematics', 'Nature & Environment',
  'Health & Fitness', 'Food & Cooking', 'Travel', 'Art & Design', 'Music & Film', 'Education', 'Law', 'Essays', 'Sports', 'Parenting & Family', 'Reference',
  'Indian Literature', 'Telugu', 'Hindi', 'Other',
];
const pickGenre = (v) => (v === '__new' ? (window.prompt('Name of the new genre?') || '').trim() : v);

const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const look = (b) => {
  const h = hash(b.title + b.author);
  const o = { w: 24 + (h % 24), h: 200 + ((h >> 3) % 50), hue: h % 360, sat: 28 + ((h >> 5) % 25), lum: 24 + ((h >> 7) % 16), lean: -((h >> 9) % 4) };
  return o;
};
const SORTS = {
  title: (a, b) => a.title.localeCompare(b.title),
  author: (a, b) => (a.author || '~').localeCompare(b.author || '~'),
  recent: (a, b) => b.created_at.localeCompare(a.created_at),
  rating: (a, b) => b.rating - a.rating,
  finished: (a, b) => (b.finished_on || '').localeCompare(a.finished_on || ''),
  priority: (a, b) => priorityRank(a) - priorityRank(b),
  due: (a, b) => (currentLoan(a)?.due || '9').localeCompare(currentLoan(b)?.due || '9'),
};
const SORT_LABELS = [['title', 'Title'], ['author', 'Author'], ['recent', 'Recently added'], ['rating', 'Rating'], ['finished', 'Date finished'], ['due', 'Due date'], ['priority', 'Priority (read list)']];

/* ---------- small helpers ---------- */
function useDismiss(open, onClose) {
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', away); document.addEventListener('touchstart', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('touchstart', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return ref;
}
const MenuItem = ({ icon, label, onClick }) => <button role="menuitem" className="item" onClick={onClick}><Icon name={icon} />{label}</button>;

/* ---------- PIN gate ---------- */
function PinGate({ onOk, theme, cycleTheme }) {
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
      <button className="btn theme" onClick={cycleTheme}>Theme: {theme}</button>
      <Logo size={72} />
      <p className="label">A personal archive</p>
      <h1 className="display">Varun's library</h1>
      <label className="pin" aria-label="6-digit PIN">
        <input autoFocus type="tel" name="library-code" inputMode="numeric" autoComplete="off" autoCorrect="off" spellCheck={false} data-lpignore="true" data-1p-ignore="true" value={v} onChange={change} disabled={busy} />
        <span className="dots">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className={i < v.length ? 'on' : ''} />)}</span>
      </label>
      <p className="err" role="alert">{busy ? 'Checking…' : err || 'Enter your 6-digit PIN'}</p>
    </main>
  );
}

/* ---------- Shelf ---------- */
function Cover({ url, size = 'M', fb, ...rest }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [url]);
  if (!url || bad) return fb;
  return <img src={coverSrc(url, size)} loading="lazy" decoding="async" onError={() => setBad(true)} {...rest} />;
}

function ReadingNow({ books, onOpen }) {
  const list = books.filter((b) => b.status === 'reading');
  if (!list.length) return null;
  return (
    <section className="nowreading" aria-label="Reading now">
      <p className="label">Reading now</p>
      <div className="nr-row no-scroll">
        {list.map((b) => {
          const pct = b.pages ? Math.min(100, Math.round(((b.current_page || 0) / b.pages) * 100)) : null;
          return (
            <button key={b.id} onClick={() => onOpen(b.id)}>
              <Cover url={b.cover} size="S" alt="" fb={<span className="thumb" />} />
              <span><strong>{b.title}</strong><small>{b.author}</small>{pct !== null && <><i className="prog"><b style={{ width: `${pct}%` }} /></i><small>{pct}% read</small></>}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Shelf({ books, sel, onOpen }) {
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
            <button key={b.id} className={`spine-hit${sel?.has(b.id) ? ' sel' : ''}`} style={{ width: s.w, height: s.h }} onClick={() => onOpen(b.id)} aria-label={`${b.title} by ${b.author}`}>
              <span className="spine" style={{ background: `linear-gradient(90deg, hsl(${s.hue} ${s.sat}% ${s.lum + 6}%), hsl(${s.hue} ${s.sat}% ${s.lum}%) 40%, hsl(${s.hue} ${s.sat}% ${s.lum - 5}%))`, transform: `rotate(${s.lean}deg)` }}>
                <b>{b.title}</b>
                {s.w > 34 && <em>{b.author}</em>}
                {lent && <u className={overdueDays(b) ? 'late' : ''} title={`With ${lent.to}`} />}
                {b.status === 'to_read' && <s className={b.priority === 'up_next' ? 'next' : ''} title={b.priority === 'up_next' ? 'Up next' : 'To read'} />}
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
function Grid({ books, sel, onOpen }) {
  return (
    <div className="grid">
      {books.map((b) => {
        const s = look(b); const lent = currentLoan(b); const late = overdueDays(b);
        return (
          <button key={b.id} className={`card${sel?.has(b.id) ? ' sel' : ''}`} onClick={() => onOpen(b.id)}>
            <Cover url={b.cover} size="M" alt="" fb={<div className="nocover sm" style={{ background: `hsl(${s.hue} ${s.sat}% ${s.lum}%)` }}><b>{b.title}</b></div>} />
            <strong>{b.title}</strong><span>{b.author}</span>
            {lent && <em className={late ? 'late' : ''}>{late ? `${late}d overdue · ` : 'With '}{lent.to}</em>}
            {b.status === 'reading' && b.pages ? <i className="prog"><b style={{ width: `${Math.min(100, ((b.current_page || 0) / b.pages) * 100)}%` }} /></i> : null}
            {b.priority === 'up_next' && b.status === 'to_read' && <em className="next">Up next</em>}
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
function Detail({ book, people, locations, allShelves, onClose, onPatch, onDelete, onPrev, onNext }) {
  const [who, setWho] = useState('');
  const [phone, setPhone] = useState('');
  const [days, setDays] = useState('14');
  const [dtab, setDtab] = useState('overview');
  const [sh, setSh] = useState('');
  const [covers, setCovers] = useState(null);
  useEffect(() => setCovers(null), [book.id]);
  const findCovers = async () => { setCovers([]); try { setCovers((await searchOpenLibrary(`${book.title} ${book.author}`.trim())).filter((x) => x.cover)); } catch { setCovers([]); } };
  const [qt, setQt] = useState('');
  const [qp, setQp] = useState('');
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
  const setStatus = (v) => onPatch(book.id, { status: v, ...(v === 'read' && !book.finished_on ? { finished_on: today() } : {}), ...(v === 'reading' && !book.started_on ? { started_on: today() } : {}) });
  const addQuote = () => { if (!qt.trim()) return; onPatch(book.id, { quotes: [...(book.quotes || []), { t: qt.trim(), p: qp.trim(), on: today() }] }); setQt(''); setQp(''); };

  const pct = book.pages ? Math.min(100, Math.round(((book.current_page || 0) / book.pages) * 100)) : 0;
  return (
    <div className="modal" onClick={onClose}>
      <article className="detail" role="dialog" aria-label={book.title} onClick={(e) => e.stopPropagation()}>
        <div className="cover">
          <Cover url={book.cover} size="L" alt={`Cover of ${book.title}`} fb={<div className="nocover" style={{ background: `hsl(${s.hue} ${s.sat}% ${s.lum}%)` }}><b>{book.title}</b><em>{book.author}</em></div>} />
          <div className="cover-actions"><button className="link" onClick={findCovers}>Change cover</button>{book.cover && <button className="link" onClick={() => onPatch(book.id, { cover: '' })}>Remove</button>}</div>
          {covers && (
            <div className="coverpick">
              {covers.length ? covers.map((c, i) => <button key={i} onClick={() => { onPatch(book.id, { cover: c.cover }); setCovers(null); }}><img src={coverSrc(c.cover, 'S')} alt={`Cover option ${i + 1}`} /></button>) : <p className="label">Searching, or no other covers found.</p>}
            </div>
          )}
        </div>

        <div className="info">
          <div className="dtop">
            <div className="dnav">
              <button className="btn iconbtn" onClick={onPrev} aria-label="Previous book"><Icon name="left" /></button>
              <button className="btn iconbtn" onClick={onNext} aria-label="Next book"><Icon name="right" /></button>
            </div>
            <button className="btn iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </div>
          <div className="dhead">
            <p className="label">{[book.genre, book.year, book.publisher].filter(Boolean).join(' · ')}</p>
            <h2 className="display">{book.title}</h2>
            <p className="author">{book.author}{book.series ? ` · ${book.series}` : ''}</p>
            {book.location && <p className="label">Shelf: {book.location}</p>}
          </div>

          <div className="seg status" role="group" aria-label="Reading status">
            {[['to_read', 'Read list'], ['reading', 'Reading'], ['read', 'Read']].map(([v, l]) => <button key={v} className={book.status === v ? 'on' : ''} onClick={() => book.status !== v && setStatus(v)}>{l}</button>)}
          </div>
          <div className="rate">
            <span className="stars" role="group" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} className={n <= book.rating ? 'on' : ''} onClick={() => onPatch(book.id, { rating: book.rating === n ? 0 : n })} aria-label={`${n} star`}>★</button>)}
            </span>
            {book.finished_on && book.status === 'read' && <span className="label">Finished {book.finished_on}</span>}
          </div>

          <div className="dtabs" role="tablist">
            {[['overview', 'Overview'], ['notes', `Notes${(book.quotes || []).length ? ` · ${book.quotes.length}` : ''}`], ['more', 'Details']].map(([k, l]) => <button key={k} role="tab" aria-selected={dtab === k} className={dtab === k ? 'on' : ''} onClick={() => setDtab(k)}>{l}</button>)}
          </div>

          {dtab === 'overview' && (
            <div className="panel">
              {book.status === 'reading' && (
                <section className="lend">
                  <p className="label">Reading progress{book.started_on ? ` · started ${book.started_on}` : ''}</p>
                  {book.pages ? (
                    <>
                      <div className="progress"><b style={{ width: `${pct}%` }} /></div>
                      <label className="pg">Page <input key={book.current_page} type="number" inputMode="numeric" min="0" max={book.pages} defaultValue={book.current_page ?? 0} onBlur={(e) => { const v = Math.max(0, Math.min(book.pages, +e.target.value || 0)); if (v !== (book.current_page || 0)) onPatch(book.id, { current_page: v }); }} /> of {book.pages} ({pct}%)</label>
                    </>
                  ) : <p>Add the page count under Details to track progress.</p>}
                </section>
              )}
              {book.status === 'to_read' && (
                <div className="row">
                  <select value={book.priority || ''} onChange={(e) => onPatch(book.id, { priority: e.target.value })} aria-label="Priority">
                    <option value="">Priority: none</option><option value="up_next">Up next</option><option value="someday">Someday</option>
                  </select>
                </div>
              )}
              <div className="row"><F book={book} k="recommended_by" label="Recommended by" onPatch={onPatch} /></div>

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
            </div>
          )}

          {dtab === 'notes' && (
            <div className="panel">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== book.notes && onPatch(book.id, { notes })} placeholder="Notes and thoughts about this book…" rows={5} />
              <section className="quotes">
                <p className="label">Quotes</p>
                {(book.quotes || []).map((x, i) => (
                  <blockquote key={i}>“{x.t}”<footer>{x.p ? `p. ${x.p}` : ''}<button onClick={() => onPatch(book.id, { quotes: book.quotes.filter((_, j) => j !== i) })}>Delete</button></footer></blockquote>
                ))}
                <form onSubmit={(e) => { e.preventDefault(); addQuote(); }}>
                  <textarea value={qt} onChange={(e) => setQt(e.target.value)} rows={2} placeholder="A line worth keeping…" />
                  <input value={qp} onChange={(e) => setQp(e.target.value)} placeholder="Page" inputMode="numeric" aria-label="Page number" />
                  <button className="btn" type="submit">Save quote</button>
                </form>
              </section>
            </div>
          )}

          {dtab === 'more' && (
            <div className="panel">
              <div className="row">
                <label className="ef"><span>Genre</span>
                  <select value={book.genre} onChange={(e) => { const g = pickGenre(e.target.value); if (g) onPatch(book.id, { genre: g }); }} aria-label="Genre">
                    {[...new Set([book.genre, ...GENRES])].map((g) => <option key={g}>{g}</option>)}
                    <option value="__new">+ Add new genre…</option>
                  </select>
                </label>
              </div>
              <section className="shelves">
                <p className="label">Shelves</p>
                <div className="chips">
                  {(book.shelves || []).map((s2) => <span key={s2} className="chip">{s2}<button onClick={() => onPatch(book.id, { shelves: book.shelves.filter((x) => x !== s2) })} aria-label={`Remove from ${s2}`}>×</button></span>)}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); const v = sh.trim().toLowerCase(); if (v && !(book.shelves || []).includes(v)) onPatch(book.id, { shelves: [...(book.shelves || []), v] }); setSh(''); }}>
                  <input value={sh} list="shelf-list" onChange={(e) => setSh(e.target.value)} placeholder="Add to a shelf, e.g. favourites" />
                  <datalist id="shelf-list">{allShelves.map((x) => <option key={x} value={x} />)}</datalist>
                  <button className="btn" type="submit">Add</button>
                </form>
              </section>
              <div className="efs">
                <F book={book} k="title" label="Title" onPatch={onPatch} />
                <F book={book} k="author" label="Author" onPatch={onPatch} />
                <F book={book} k="language" label="Language" list="langs" onPatch={onPatch} />
                <datalist id="langs"><option>English</option><option>Telugu</option><option>Hindi</option><option>Tamil</option><option>Urdu</option></datalist>
                <F book={book} k="pages" label="Pages" type="number" onPatch={onPatch} />
                <F book={book} k="year" label="Year" type="number" onPatch={onPatch} />
                <F book={book} k="started_on" label="Started on" type="date" onPatch={onPatch} />
                <F book={book} k="finished_on" label="Finished on" type="date" onPatch={onPatch} />
                <F book={book} k="location" label="Location (e.g. Bedroom shelf 2)" list="locs" onPatch={onPatch} />
                <datalist id="locs">{locations.map((l) => <option key={l} value={l} />)}</datalist>
                <F book={book} k="publisher" label="Publisher" onPatch={onPatch} />
                <F book={book} k="series" label="Series (e.g. Dune #1)" onPatch={onPatch} />
                <F book={book} k="binding" label="Binding (Paperback…)" onPatch={onPatch} />
                <F book={book} k="isbn" label="ISBN" onPatch={onPatch} />
                <F book={book} k="read_count" label="Times read" type="number" onPatch={onPatch} />
                <F book={book} k="cover" label="Cover image URL" onPatch={onPatch} />
              </div>
              <button className="btn danger delete" onClick={() => confirm(`Delete "${book.title}"?`) && onDelete(book.id)}><Icon name="trash" /> Delete this book</button>
            </div>
          )}
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
  const [recBy, setRecBy] = useState('');
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
    try { const [row] = await api.add({ ...item, status, genre, recommended_by: recBy.trim() }); onAdded([row]); onClose(); } catch (e) { setErr(e.message); }
  }
  async function importBulk() {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      setProgress(`Looking up ${i + 1} of ${lines.length}…`);
      const [title, author = ''] = lines[i].split(/\s+[-–|]\s+/);
      let hit = null;
      try { hit = (await searchOpenLibrary(`${title} ${author}`.trim()))[0]; } catch {}
      rows.push({ title: hit?.title || title, author: hit?.author || author, cover: hit?.cover || '', year: hit?.year || null, publisher: hit?.publisher || '', status, genre, recommended_by: recBy.trim() });
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
          <select value={genre} onChange={(e) => { const g = pickGenre(e.target.value); if (g) setGenre(g); }} aria-label="Genre">{[...new Set([genre, ...GENRES, ...genres])].map((g) => <option key={g}>{g}</option>)}<option value="__new">+ Add new genre…</option></select>
          <input className="rec" value={recBy} onChange={(e) => setRecBy(e.target.value)} placeholder="Recommended by (optional)" aria-label="Recommended by" />
        </div>
        {mode === 'one' ? (
          <>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or author…" />
            <ul className="results">
              {res.map((r, i) => (
                <li key={i}><button onClick={() => add(r)}>
                  <Cover url={r.cover} size="S" alt="" fb={<span className="thumb" />} />
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
  const [books, setBooks] = useState(() => { if (!getPin()) return null; try { return JSON.parse(localStorage.getItem('lib-cache') || 'null'); } catch { return null; } });
  const [tab, setTab] = useState('all');
  const [genre, setGenre] = useState('');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState(null);
  const flashT = useRef();
  const [checking, setChecking] = useState(() => !!getPin());
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [sort, setSort] = useState(() => localStorage.getItem('lib-sort') || 'title');
  const [view, setView] = useState(() => localStorage.getItem('lib-view') || 'shelf');
  const [stats, setStats] = useState(false);
  const [borrowers, setBorrowers] = useState(false);
  const [goalData, setGoalData] = useState({ target: 0, byYear: {} });
  const [journalOpen, setJournalOpen] = useState(false);
  const [shelf, setShelf] = useState('');
  const [importing, setImporting] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const menuRef = useDismiss(menuOpen, () => setMenuOpen(false));
  const filterRef = useDismiss(filterOpen, () => setFilterOpen(false));
  const [theme, setTheme] = useState(() => localStorage.getItem('lib-theme') || 'auto');
  useEffect(() => {
    const el = document.documentElement;
    theme === 'auto' ? el.removeAttribute('data-theme') : el.setAttribute('data-theme', theme);
    theme === 'auto' ? localStorage.removeItem('lib-theme') : localStorage.setItem('lib-theme', theme);
  }, [theme]);
  const cycleTheme = () => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'));

  useEffect(() => {
    if (!getPin()) return;
    api.list().then(setBooks).catch((e) => { if (e.message === '401') { setPin(''); setBooks(null); } else flash('Offline. Showing your last saved copy.'); }).finally(() => setChecking(false));
  }, []);
  useEffect(() => { if (books) try { localStorage.setItem('lib-cache', JSON.stringify(books)); } catch {} }, [books]);
  useEffect(() => { localStorage.setItem('lib-sort', sort); localStorage.setItem('lib-view', view); }, [sort, view]);
  useEffect(() => {
    const k = (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) { e.preventDefault(); document.querySelector('.search')?.focus(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => { if (books) settings.get().then((s) => setGoalData({ target: s.goal?.target || 0, byYear: s.goal?.byYear || {} })).catch(() => {}); }, [!!books]);
  useEffect(() => {
    if (!books || !IDLE_MINUTES) return;
    const limit = IDLE_MINUTES * 60000; let t; let last = Date.now();
    const lock = () => { setPin(''); window.location.reload(); };
    const reset = () => { last = Date.now(); clearTimeout(t); t = setTimeout(lock, limit); };
    const vis = () => { if (document.visibilityState === 'visible' && Date.now() - last > limit) lock(); };
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    document.addEventListener('visibilitychange', vis); reset();
    return () => { clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, reset)); document.removeEventListener('visibilitychange', vis); };
  }, [!!books]);
  const flash = (msg, undo) => { setToast({ msg, undo }); clearTimeout(flashT.current); flashT.current = setTimeout(() => setToast(null), undo ? 8000 : 2500); };

  const genres = useMemo(() => [...new Set((books || []).map((b) => b.genre))].sort(), [books]);
  const shown = useMemo(() => (books || []).filter((b) => {
    if (tab === 'lent' ? !currentLoan(b) : tab !== 'all' && b.status !== tab) return false;
    if (genre && b.genre !== genre) return false;
    if (shelf && !(b.shelves || []).includes(shelf)) return false;
    const n = dq.trim().toLowerCase();
    return !n || [b.title, b.author, b.genre, b.notes, b.location, b.recommended_by, b.series, b.isbn, (b.shelves || []).join(' '), (b.quotes || []).map((x) => x.t).join(' '), currentLoan(b)?.to].join(' ').toLowerCase().includes(n);
  }).sort(SORTS[tab === 'lent' && sort === 'title' ? 'due' : sort]), [books, tab, genre, shelf, dq, sort]);

  if (!books) return checking ? <main className="gate"><Logo size={72} /><p className="label">Opening your library…</p></main> : <PinGate onOk={setBooks} theme={theme} cycleTheme={cycleTheme} />;

  const open = books.find((b) => b.id === openId);
  const step = (d) => { const i = shown.findIndex((b) => b.id === openId); if (i >= 0 && shown.length) setOpenId(shown[(i + d + shown.length) % shown.length].id); };
  const patch = async (id, f) => {
    const prev = books; setBooks((bs) => bs.map((b) => (b.id === id ? { ...b, ...f } : b)));
    try { await api.update(id, f); } catch (e) { setBooks(prev); flash('Could not save: ' + e.message); }
  };
  const del = async (id) => {
    const gone = books.find((b) => b.id === id);
    try {
      await api.remove(id); setBooks((bs) => bs.filter((b) => b.id !== id)); setOpenId(null);
      flash(`Deleted "${gone.title}"`, async () => {
        try { const { id: _drop, ...rest } = gone; const [row] = await api.add(rest); setBooks((bs) => [row, ...bs]); flash('Restored'); } catch (e) { flash('Could not restore: ' + e.message); }
      });
    } catch (e) { flash(e.message); }
  };
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitSelect = () => { setSelecting(false); setSel(new Set()); };
  const bulk = async (fn) => {
    if (!sel.size) return flash('Select some books first.');
    const prev = books;
    const patches = new Map(prev.filter((b) => sel.has(b.id)).map((b) => [b.id, fn(b)]));
    setBooks((bs) => bs.map((b) => (patches.has(b.id) ? { ...b, ...patches.get(b.id) } : b)));
    try {
      const entries = [...patches];
      for (let i = 0; i < entries.length; i += 6) await Promise.all(entries.slice(i, i + 6).map(([id, f]) => api.update(id, f)));
      flash(`Updated ${entries.length} book${entries.length > 1 ? 's' : ''}`);
    } catch (e) { setBooks(prev); flash('Could not save: ' + e.message); }
  };
  const bulkDelete = async () => {
    const ids = [...sel]; if (!ids.length || !confirm(`Delete ${ids.length} book${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    try { for (let i = 0; i < ids.length; i += 6) await Promise.all(ids.slice(i, i + 6).map((id) => api.remove(id))); setBooks((bs) => bs.filter((b) => !sel.has(b.id))); flash(`Deleted ${ids.length}`); exitSelect(); } catch (e) { flash(e.message); }
  };
  const lentCount = books.filter(currentLoan).length;
  const lateCount = books.filter(overdueDays).length;
  const counts = { all: books.length, read: books.filter((b) => b.status === 'read').length, reading: books.filter((b) => b.status === 'reading').length, to_read: books.filter((b) => b.status === 'to_read').length, lent: lentCount };
  const genreCounts = {}; books.forEach((b) => { genreCounts[b.genre] = (genreCounts[b.genre] || 0) + 1; });
  const nFilters = (genre ? 1 : 0) + (shelf ? 1 : 0);
  const go = (fn) => () => { setMenuOpen(false); fn(); };
  const locations = [...new Set(books.map((b) => b.location).filter(Boolean))].sort();
  const allShelves = [...new Set(books.flatMap((b) => b.shelves || []))].sort();
  const goalYear = today().slice(0, 4);
  const goalTarget = goalData.byYear[goalYear] ?? goalData.target ?? 0; // new year: last goal carries over until you change it
  const goalCarried = goalData.byYear[goalYear] == null && goalTarget > 0;
  const setGoalPrompt = () => {
    const t = window.prompt(`How many books do you want to finish in ${goalYear}?`, goalTarget || 24);
    if (t === null) return;
    const n = Math.max(0, parseInt(t, 10) || 0);
    const next = { target: n, byYear: { ...goalData.byYear, [goalYear]: n } };
    setGoalData(next);
    settings.set('goal', next).catch((e) => flash('Could not save goal: ' + e.message));
  };
  const people = {}; books.forEach((b) => (b.loans || []).forEach((l) => { if (l.to && (l.phone || !(l.to in people))) people[l.to] = l.phone || people[l.to] || ''; }));
  const pick = () => { const all = books.filter((b) => b.status === 'to_read'); const next = all.filter((b) => b.priority === 'up_next'); const pool = next.length ? next : all; if (!pool.length) return flash('Your read list is empty. Add books with "Read list" status.'); setOpenId(pool[Math.floor(Math.random() * pool.length)].id); };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-mini"><Logo size={36} /><span>Varun's library</span></div>
        <div className="searchbox">
          <Icon name="search" size={17} />
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search books, authors, notes…" aria-label="Search" />
          {q && <button className="clear" onClick={() => setQ('')} aria-label="Clear search"><Icon name="x" size={15} /></button>}
        </div>
        <button className="btn primary addbtn" onClick={() => setAdding(true)}><Icon name="plus" /><span className="lbl">Add books</span></button>
        <div className="pop" ref={menuRef}>
          <button className="btn iconbtn" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Menu"><Icon name="more" /></button>
          {menuOpen && (
            <div className="menu" role="menu">
              <p className="mh">Explore</p>
              <MenuItem icon="journal" label="Reading journal" onClick={go(() => setJournalOpen(true))} />
              <MenuItem icon="year" label="Year in books" onClick={go(() => setYearOpen(true))} />
              <MenuItem icon="users" label="Borrowers" onClick={go(() => setBorrowers(true))} />
              <MenuItem icon="chart" label="Stats" onClick={go(() => setStats(true))} />
              <p className="mh">Tools</p>
              <MenuItem icon="shuffle" label="Pick my next read" onClick={go(pick)} />
              <MenuItem icon="select" label="Select several books" onClick={go(() => setSelecting(true))} />
              <MenuItem icon="upload" label="Import from Goodreads" onClick={go(() => setImporting(true))} />
              <MenuItem icon="download" label="Export as CSV" onClick={go(() => download(`library-${today()}.csv`, toCSV(books), 'text/csv'))} />
              <MenuItem icon="download" label="Full backup (JSON)" onClick={go(() => download(`library-backup-${today()}.json`, JSON.stringify(books, null, 2), 'application/json'))} />
              <p className="mh">Settings</p>
              <MenuItem icon="target" label={`Reading goal for ${goalYear}`} onClick={go(setGoalPrompt)} />
              <div className="mrow"><span><Icon name="sun" /> Theme</span>
                <div className="seg sm">{[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => <button key={v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)}>{l}</button>)}</div>
              </div>
              <MenuItem icon="lock" label="Lock now" onClick={() => { setPin(''); window.location.reload(); }} />
            </div>
          )}
        </div>
      </header>

      <div className="summary">
        <p className="stats-line">
          <strong>{books.length}</strong> {books.length === 1 ? 'book' : 'books'}
          {lentCount > 0 && <> · <button className="chiplink" onClick={() => setTab('lent')}>{lentCount} lent out</button></>}
          {lateCount > 0 && <> · <button className="chiplink late" onClick={() => setTab('lent')}>{lateCount} overdue</button></>}
        </p>
        <Goal books={books} target={goalTarget} year={goalYear} carried={goalCarried} onSet={setGoalPrompt} />
      </div>

      <div className="controls">
        <nav className="tabs" aria-label="Shelves">
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<span className="n">{counts[k]}</span></button>)}
        </nav>
        <div className="ctrl-right">
          <div className="pop" ref={filterRef}>
            <button className={`btn${nFilters ? ' active' : ''}`} onClick={() => setFilterOpen((o) => !o)} aria-expanded={filterOpen}><Icon name="filter" /><span className="lbl">Filter</span>{nFilters > 0 && <span className="badge">{nFilters}</span>}</button>
            {filterOpen && (
              <div className="menu filterpanel">
                <label>Genre
                  <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                    <option value="">All genres</option>{genres.map((g) => <option key={g} value={g}>{g} ({genreCounts[g]})</option>)}
                  </select>
                </label>
                {allShelves.length > 0 && (
                  <label>Shelf
                    <select value={shelf} onChange={(e) => setShelf(e.target.value)}>
                      <option value="">All shelves</option>{allShelves.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                )}
                {nFilters > 0 && <button className="link" onClick={() => { setGenre(''); setShelf(''); }}>Clear filters</button>}
              </div>
            )}
          </div>
          <select className="sortsel" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">{SORT_LABELS.map(([k, l]) => <option key={k} value={k}>Sort: {l}</option>)}</select>
          <div className="seg icons" role="group" aria-label="View">
            <button className={view === 'shelf' ? 'on' : ''} onClick={() => setView('shelf')} aria-label="Shelf view" title="Shelf view"><Icon name="shelf" /></button>
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view" title="Grid view"><Icon name="grid" /></button>
          </div>
        </div>
      </div>
      {nFilters > 0 && (
        <div className="activefilters">
          {genre && <button className="fchip" onClick={() => setGenre('')}>{genre} <Icon name="x" size={13} /></button>}
          {shelf && <button className="fchip" onClick={() => setShelf('')}>Shelf: {shelf} <Icon name="x" size={13} /></button>}
          <button className="link" onClick={() => { setGenre(''); setShelf(''); }}>Clear all</button>
        </div>
      )}

      {tab === 'all' && !genre && !shelf && !dq.trim() && !selecting && <ReadingNow books={books} onOpen={setOpenId} />}
      {shown.length ? (view === 'shelf' ? <Shelf books={shown} sel={selecting ? sel : null} onOpen={selecting ? toggleSel : setOpenId} /> : <Grid books={shown} sel={selecting ? sel : null} onOpen={selecting ? toggleSel : setOpenId} />) : (
        <div className="empty-box">
          <Logo size={56} />
          {books.length ? (
            <>
              <h2 className="display">Nothing matches</h2>
              <p>Try a different search, or clear your filters.</p>
              <button className="btn" onClick={() => { setQ(''); setGenre(''); setShelf(''); setTab('all'); }}>Show everything</button>
            </>
          ) : (
            <>
              <h2 className="display">Your shelf is empty</h2>
              <p>Add your first book, or bring in your whole Goodreads library at once.</p>
              <div className="nav"><button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" /> Add books</button><button className="btn" onClick={() => setImporting(true)}><Icon name="upload" /> Import from Goodreads</button></div>
            </>
          )}
        </div>
      )}

      {open && <Detail book={open} people={people} locations={locations} allShelves={allShelves} onClose={() => setOpenId(null)} onPatch={patch} onDelete={del} onPrev={() => step(-1)} onNext={() => step(1)} />}
      {adding && <AddDialog books={books} genres={genres} onClose={() => setAdding(false)} onAdded={(rows, skipped = 0) => { setBooks((bs) => [...rows, ...bs]); flash(`Added ${rows.length} book${rows.length > 1 ? 's' : ''}${skipped ? `, skipped ${skipped} duplicate${skipped > 1 ? 's' : ''}` : ''}`); }} />}
      <Suspense fallback={null}>
      {stats && <Stats books={books} onClose={() => setStats(false)} />}
      {yearOpen && <YearInBooks books={books} goals={goalData.byYear} onOpen={setOpenId} onClose={() => setYearOpen(false)} />}
      {importing && <GoodreadsImport books={books} genres={GENRES} onClose={() => setImporting(false)} onAdded={(rows, skipped = 0) => { setBooks((bs) => [...rows, ...bs]); flash(`Imported ${rows.length} book${rows.length === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped > 1 ? 's' : ''}` : ''}`); }} />}
      {journalOpen && <Journal books={books} onPatch={patch} onClose={() => setJournalOpen(false)} />}
      {borrowers && <Borrowers books={books} people={people} onOpen={setOpenId} onPatch={patch} onClose={() => setBorrowers(false)} />}
      </Suspense>
      {selecting && (
        <div className="bulkbar" role="region" aria-label="Edit several books">
          <strong>{sel.size} selected</strong>
          <button className="btn" onClick={() => setSel(new Set(shown.map((b) => b.id)))}>Select all {shown.length}</button>
          <select value="" aria-label="Set genre" onChange={(e) => { const g = pickGenre(e.target.value); if (g) bulk(() => ({ genre: g })); }}>
            <option value="">Set genre…</option>{[...new Set([...GENRES, ...genres])].map((g) => <option key={g}>{g}</option>)}<option value="__new">+ New genre…</option>
          </select>
          <select value="" aria-label="Set status" onChange={(e) => { const v = e.target.value; if (v) bulk(() => ({ status: v })); }}>
            <option value="">Set status…</option><option value="read">Read</option><option value="reading">Reading now</option><option value="to_read">Read list</option>
          </select>
          <button className="btn" onClick={() => { const s = (window.prompt('Add the selected books to which shelf?') || '').trim().toLowerCase(); if (s) bulk((b) => ({ shelves: [...new Set([...(b.shelves || []), s])] })); }}>Add to shelf…</button>
          <button className="btn danger" onClick={bulkDelete}>Delete</button>
          <button className="btn" onClick={exitSelect}>Done</button>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast.msg}{toast.undo && <button onClick={() => { const u = toast.undo; setToast(null); u(); }}>Undo</button>}</div>}
    </div>
  );
}
