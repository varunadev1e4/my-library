export const getPin = () => localStorage.getItem('lib-pin') || '';
export const setPin = (p) => (p ? localStorage.setItem('lib-pin', p) : localStorage.removeItem('lib-pin'));

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
