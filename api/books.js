import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const FIELDS = ['title', 'author', 'cover', 'year', 'publisher', 'blurb', 'genre', 'rating', 'status', 'notes', 'loans', 'pages', 'language', 'finished_on', 'location', 'started_on', 'current_page', 'priority', 'recommended_by', 'quotes'];
const pickFields = (o) => Object.fromEntries(FIELDS.filter((k) => k in o).map((k) => [k, o[k]]));

function pinOk(pin) {
  const a = Buffer.from(String(pin || ''));
  const b = Buffer.from(String(process.env.LIBRARY_PIN || ''));
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!pinOk(req.headers['x-pin'])) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    return res.status(401).json({ error: 'Wrong PIN' });
  }
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (req.method === 'GET') {
      const { data, error } = await sb.from('books').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const rows = Array.isArray(body.rows) ? body.rows.map(pickFields) : [pickFields(body)];
      const { data, error } = await sb.from('books').insert(rows).select();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'PATCH') {
      const { data, error } = await sb.from('books').update(pickFields(body)).eq('id', req.query.id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const { error } = await sb.from('books').delete().eq('id', req.query.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
