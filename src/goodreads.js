// Parses a Goodreads "Export Library" CSV and maps each row to a library book.
export function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows;
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const isbn = (v) => (v || '').replace(/[^0-9Xx]/g, ''); // Goodreads writes ISBNs like ="0141439513"
const dateOf = (v) => { const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(v || ''); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null; };
const SHELF = { read: 'read', 'currently-reading': 'reading', 'to-read': 'to_read' };
const clean = (s) => (s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

export function isGoodreadsCSV(rows) { return rows.length > 0 && 'Title' in rows[0] && ('Exclusive Shelf' in rows[0] || 'Bookshelves' in rows[0]); }

export function mapGoodreads(r) {
  let title = r['Title'] || '', series = '';
  const m = /^(.*?)\s*\(([^()]+?),?\s*#([^()\s]+)\)\s*$/.exec(title); // "Dune (Dune Chronicles, #1)"
  if (m) { title = m[1]; series = `${m[2]} #${m[3]}`; }
  const finished = dateOf(r['Date Read']);
  const status = SHELF[r['Exclusive Shelf']] || (finished ? 'read' : 'to_read');
  const added = dateOf(r['Date Added']);
  const notes = [clean(r['Private Notes']), clean(r['My Review']) ? 'Review: ' + clean(r['My Review']) : ''].filter(Boolean).join('\n\n');
  const row = {
    title: title.trim(),
    author: r['Author'] || '',
    publisher: r['Publisher'] || '',
    year: parseInt(r['Original Publication Year'] || r['Year Published'], 10) || null,
    pages: parseInt(r['Number of Pages'], 10) || null,
    rating: Math.min(5, Math.max(0, parseInt(r['My Rating'], 10) || 0)),
    status, notes, series,
    isbn: isbn(r['ISBN13']) || isbn(r['ISBN']),
    binding: r['Binding'] || '',
    read_count: parseInt(r['Read Count'], 10) || (status === 'read' ? 1 : 0),
    goodreads_id: r['Book Id'] || '',
    shelves: (r['Bookshelves'] || '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => s && !(s in SHELF)),
  };
  if (status === 'read' && finished) row.finished_on = finished;
  if (added) row.created_at = `${added}T12:00:00Z`;
  return row;
}
