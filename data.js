// api/data.js — Vercel Serverless Function
// Stores photos + teams in Vercel KV (Edge Config fallback to in-process cache for dev)
// GET  /api/data          → returns { photos: [], teams: [] }
// POST /api/data          → body: { type: 'photo'|'team', payload: {...} }
// DELETE /api/data?type=all  → clears all (admin reset)

const PHOTOS_KEY = 'unf_photos';
const TEAMS_KEY  = 'unf_teams';

// Try Vercel KV — gracefully falls back to module-level cache if KV not configured
let _cache = { photos: [], teams: [] };

async function kvGet(key) {
  if (typeof process.env.KV_REST_API_URL === 'undefined') return null;
  try {
    const { kv } = await import('@vercel/kv');
    return await kv.get(key);
  } catch { return null; }
}

async function kvSet(key, value) {
  if (typeof process.env.KV_REST_API_URL === 'undefined') return false;
  try {
    const { kv } = await import('@vercel/kv');
    await kv.set(key, value);
    return true;
  } catch { return false; }
}

async function getState() {
  const photos = await kvGet(PHOTOS_KEY) ?? _cache.photos;
  const teams  = await kvGet(TEAMS_KEY)  ?? _cache.teams;
  return { photos: photos || [], teams: teams || [] };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const state = await getState();
    return res.status(200).json(state);
  }

  // ── POST ─────────────────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: 'Invalid JSON' }); }

    const state = await getState();

    if (body.type === 'photo') {
      const photo = {
        id: Date.now() + Math.random(),
        src: body.src,           // base64 data URL
        by: (body.by || 'Osprey').slice(0, 60),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        ts: Date.now()
      };
      state.photos = [...state.photos.slice(-49), photo]; // keep last 50
      const saved = await kvSet(PHOTOS_KEY, state.photos);
      if (!saved) _cache.photos = state.photos;
      return res.status(200).json({ ok: true, photo });
    }

    if (body.type === 'team') {
      const { name, members, pitch } = body;
      if (!name || !members || !pitch)
        return res.status(400).json({ error: 'name, members, and pitch are required' });

      const dupe = state.teams.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (dupe) return res.status(409).json({ error: 'Team name already registered' });

      const team = {
        id: Date.now(),
        name: name.slice(0, 80),
        members: members.slice(0, 200),
        pitch: pitch.slice(0, 500),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        ts: Date.now()
      };
      state.teams = [...state.teams, team];
      const saved = await kvSet(TEAMS_KEY, state.teams);
      if (!saved) _cache.teams = state.teams;
      return res.status(200).json({ ok: true, team });
    }

    return res.status(400).json({ error: 'Unknown type' });
  }

  // ── DELETE (admin reset) ──────────────────────────────
  if (req.method === 'DELETE') {
    const secret = req.headers['x-admin-secret'];
    if (secret !== process.env.ADMIN_SECRET && process.env.ADMIN_SECRET)
      return res.status(401).json({ error: 'Unauthorized' });

    await kvSet(PHOTOS_KEY, []);
    await kvSet(TEAMS_KEY, []);
    _cache = { photos: [], teams: [] };
    return res.status(200).json({ ok: true, message: 'State cleared' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
