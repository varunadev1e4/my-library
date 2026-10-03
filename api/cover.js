// Fetches Open Library covers through Vercel so they are cached at the edge (much faster than hitting Open Library each time).
// Only covers.openlibrary.org is allowed. Covers are public images, so no PIN is needed.
export default async function handler(req, res) {
  let url;
  try { url = new URL(String(req.query.u || '')); } catch { return res.status(400).end('Bad URL'); }
  if (url.protocol !== 'https:' || url.hostname !== 'covers.openlibrary.org') return res.status(400).end('Only Open Library covers are allowed');
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) return res.status(404).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 500) return res.status(404).end(); // Open Library sends a tiny placeholder when it has no cover
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=31536000, stale-while-revalidate=86400');
    return res.status(200).send(buf);
  } catch { return res.status(502).end(); }
}
