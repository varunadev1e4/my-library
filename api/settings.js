import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const KEYS = ['goal'];

function pinOk(pin) {
  const a = Buffer.from(String(pin || ''));
  const b = Buffer.from(String(process.env.LIBRARY_PIN || ''));
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (!pinOk(req.headers['x-pin'])) {
    await new Promise((r) => setTimeout(r, 1000));
    return res.status(401).json({ error: 'Wrong PIN' });
  }
  try {
    if (req.method === 'GET') {
      const { data, error } = await sb.from('settings').select('*');
      if (error) throw error;
      return res.status(200).json(Object.fromEntries(data.map((r) => [r.key, r.value])));
    }
    if (req.method === 'PUT') {
      const { key, value } = req.body || {};
      if (!KEYS.includes(key)) return res.status(400).json({ error: 'Unknown setting' });
      const { error } = await sb.from('settings').upsert({ key, value });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
