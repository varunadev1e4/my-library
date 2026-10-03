export const getPin = () => localStorage.getItem('lib-pin') || '';
export const setPin = (p) => {
  if (p) return localStorage.setItem('lib-pin', p);
  ['lib-pin', 'lib-cache', 'lib-spines'].forEach((k) => localStorage.removeItem(k)); // locking also wipes the saved copy of your books
};

async function call(method, qs = '', body) {
  const r = await fetch('/api/books' + qs, {
    method,
    headers: { 'content-type': 'application/json', 'x-pin': getPin() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) throw new Error('401');
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}

export const api = {
  list: () => call('GET'),
  add: (book) => call('POST', '', book),
  addMany: (rows) => call('POST', '', { rows }),
  update: (id, fields) => call('PATCH', `?id=${id}`, fields),
  remove: (id) => call('DELETE', `?id=${id}`),
};

export async function searchOpenLibrary(q) {
  const url = 'https://openlibrary.org/search.json?limit=8&fields=title,author_name,first_publish_year,cover_i,publisher&q=' + encodeURIComponent(q);
  const j = await (await fetch(url)).json();
  return (j.docs || []).map((d) => ({
    title: d.title,
    author: (d.author_name || [])[0] || '',
    year: d.first_publish_year || null,
    publisher: (d.publisher || [])[0] || '',
    cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : '',
  }));
}

async function sCall(method, body) {
  const r = await fetch('/api/settings', { method, headers: { 'content-type': 'application/json', 'x-pin': getPin() }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) throw new Error('401');
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
export const settings = { get: () => sCall('GET'), set: (key, value) => sCall('PUT', { key, value }) };

async function jCall(method, qs = '', body) {
  const r = await fetch('/api/journal' + qs, { method, headers: { 'content-type': 'application/json', 'x-pin': getPin() }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) throw new Error('401');
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
export const journal = {
  list: () => jCall('GET'),
  add: (e) => jCall('POST', '', e),
  update: (id, f) => jCall('PATCH', `?id=${id}`, f),
  remove: (id) => jCall('DELETE', `?id=${id}`),
};

// Open Library covers go through /api/cover so they are cached at the edge. Other URLs are used as they are.
export function coverSrc(url, size = 'M') {
  if (!url) return '';
  try { if (new URL(url).hostname === 'covers.openlibrary.org') return '/api/cover?u=' + encodeURIComponent(url.replace(/-[SML]\.jpg/, `-${size}.jpg`)); } catch {}
  return url;
}
