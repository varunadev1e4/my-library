export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
export const currentLoan = (b) => { const l = (b.loans || []).at(-1); return l && !l.returned ? l : null; };
export const overdueDays = (b) => { const l = currentLoan(b); return l && l.due && l.due < today() ? daysBetween(l.due, today()) : 0; };

export function remindLink(book, loan) {
  const msg = `Hi ${loan.to}, a gentle reminder about my book "${book.title}"${loan.due ? ` (it was due ${loan.due})` : ''}. Could you return it when you can? Thanks!`;
  const phone = (loan.phone || '').replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function toCSV(books) {
  const head = ['Title', 'Author', 'Genre', 'Language', 'Status', 'Rating', 'Year', 'Pages', 'Publisher', 'Finished', 'Notes', 'Location', 'Priority', 'Recommended by', 'Lent to', 'Due', 'Times lent'];
  const rows = books.map((b) => { const l = currentLoan(b); return [b.title, b.author, b.genre, b.language, b.status, b.rating, b.year, b.pages, b.publisher, b.finished_on, b.notes, b.location, b.priority, b.recommended_by, l?.to, l?.due, (b.loans || []).length].map(q).join(','); });
  return [head.map(q).join(','), ...rows].join('\n');
}
export function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export function remindAllLink(name, phone, titles) {
  const list = titles.map((t) => `"${t}"`).join(', ');
  const msg = `Hi ${name}, a gentle reminder about my ${titles.length > 1 ? 'books' : 'book'}: ${list}. Could you return ${titles.length > 1 ? 'them' : 'it'} when you can? Thanks!`;
  return `https://wa.me/${(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}
export const priorityRank = (b) => (b.priority === 'up_next' ? 0 : b.priority === 'someday' ? 2 : 1);
