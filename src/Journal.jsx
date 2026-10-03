import { useEffect, useState } from 'react';
import { journal } from './api.js';
import { askConfirm } from './dialogs.jsx';
import { today, addDays, streak } from './util.js';

const byDay = (a, b) => b.day.localeCompare(a.day) || (b.created_at || '').localeCompare(a.created_at || '');
const nice = (d) => {
  if (d === today()) return 'Today';
  if (d === addDays(today(), -1)) return 'Yesterday';
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Journal({ books, onPatch, onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState(today());
  const [bookId, setBookId] = useState('');
  const [pages, setPages] = useState('');
  const [pageNow, setPageNow] = useState('');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [etext, setEtext] = useState('');

  useEffect(() => { journal.list().then(setRows).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);

  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const reading = books.filter((b) => b.status === 'reading').sort(byTitle);
  const others = books.filter((b) => b.status !== 'reading').sort(byTitle);
  const book = books.find((b) => b.id === bookId);

  async function save(e) {
    e.preventDefault(); setErr('');
    if (day > today()) return setErr('That date is in the future.');
    if (!text.trim() && !bookId) return setErr('Pick a book or write a note.');
    setBusy(true);
    try {
      const row = await journal.add({ day, book_id: bookId || null, book_title: book?.title || '', pages: pages === '' ? null : Math.max(0, +pages), page_now: pageNow === '' ? null : Math.max(0, +pageNow), text: text.trim() });
      setRows((r) => [row, ...r].sort(byDay));
      // Progress only follows today's entries, so back-dating an old day never rewinds your current page.
      if (book && pageNow !== '' && day === today()) {
        const p = book.pages ? Math.min(Math.max(0, +pageNow), book.pages) : Math.max(0, +pageNow);
        const patch = { current_page: p };
        if (book.status === 'to_read') { patch.status = 'reading'; if (!book.started_on) patch.started_on = day; }
        onPatch(book.id, patch);
        if (book.pages && p >= book.pages && book.status !== 'read' && (await askConfirm({ title: 'Finished the book?', message: `You're on the last page of "${book.title}". Mark it as read?`, confirmLabel: 'Mark as read' }))) onPatch(book.id, { status: 'read', finished_on: day });
      }
      setPages(''); setPageNow(''); setText('');
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  async function saveEdit(id) {
    try { const row = await journal.update(id, { text: etext.trim() }); setRows((r) => r.map((x) => (x.id === id ? row : x))); setEditing(null); } catch (x) { setErr(x.message); }
  }
  async function del(id) {
    if (!(await askConfirm({ title: 'Delete this entry?', confirmLabel: 'Delete', danger: true }))) return;
    try { await journal.remove(id); setRows((r) => r.filter((x) => x.id !== id)); } catch (x) { setErr(x.message); }
  }

  const days = new Set((rows || []).map((r) => r.day));
  const week = (rows || []).filter((r) => r.day > addDays(today(), -7)).reduce((s, r) => s + (r.pages || 0), 0);
  const month = (rows || []).filter((r) => r.day.startsWith(today().slice(0, 7))).length;
  const groups = []; (rows || []).forEach((r) => { const g = groups.at(-1); g && g.day === r.day ? g.items.push(r) : groups.push({ day: r.day, items: [r] }); });

  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog wide" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <h2 className="display">Reading journal</h2>
        <div className="kpis">
          <div><strong>{rows ? streak(days) : '–'}</strong><span>day streak</span></div>
          <div><strong>{rows ? month : '–'}</strong><span>entries this month</span></div>
          <div><strong>{rows ? week : '–'}</strong><span>pages in 7 days</span></div>
        </div>

        <form className="jf" onSubmit={save}>
          <div className="field">
            <input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} aria-label="Date" />
            <select value={bookId} onChange={(e) => setBookId(e.target.value)} aria-label="Book">
              <option value="">No specific book</option>
              {reading.length > 0 && <optgroup label="Reading now">{reading.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</optgroup>}
              <optgroup label="All other books">{others.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</optgroup>
            </select>
          </div>
          <div className="field">
            <input type="number" inputMode="numeric" min="0" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="Pages read" aria-label="Pages read" />
            <input type="number" inputMode="numeric" min="0" value={pageNow} onChange={(e) => setPageNow(e.target.value)} placeholder={book?.pages ? `Now on page (of ${book.pages})` : 'Now on page'} aria-label="Now on page" />
          </div>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you read today? Thoughts, favourite parts, what you'll read next…" />
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add entry'}</button>
          {day === today() && book && <p className="label">"Now on page" also updates this book's progress.</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </form>

        {rows === null && !err && <p className="label">Loading…</p>}
        {rows && rows.length === 0 && <p className="label">No entries yet. Your first one is a minute away.</p>}
        {groups.map((g) => (
          <section key={g.day} className="jday">
            <p className="label">{nice(g.day)}</p>
            {g.items.map((r) => {
              const b = books.find((x) => x.id === r.book_id);
              return (
                <article key={r.id} className="entry">
                  <div className="eh">
                    <strong>{b?.title || r.book_title || 'General note'}</strong>
                    <span className="label">{[r.pages ? `${r.pages} pages` : '', r.page_now ? `reached p. ${r.page_now}` : ''].filter(Boolean).join(' · ')}</span>
                  </div>
                  {editing === r.id ? (
                    <>
                      <textarea rows={3} value={etext} onChange={(e) => setEtext(e.target.value)} />
                      <div className="nav"><button className="btn primary" onClick={() => saveEdit(r.id)}>Save</button><button className="btn" onClick={() => setEditing(null)}>Cancel</button></div>
                    </>
                  ) : (
                    <>
                      {r.text && <p>{r.text}</p>}
                      <div className="ea"><button onClick={() => { setEditing(r.id); setEtext(r.text); }}>Edit</button><button onClick={() => del(r.id)}>Delete</button></div>
                    </>
                  )}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
