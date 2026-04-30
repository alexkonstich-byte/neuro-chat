import { Router } from 'express';
import { db } from '../db.js';
import { now } from '../util.js';

const r = Router();

r.post('/', (req, res) => {
  const kind = String(req.body?.kind || '').trim();
  const text = String(req.body?.text || '').trim().slice(0, 4000);
  if (!['bug', 'feature', 'message'].includes(kind)) return res.status(400).json({ error: 'bad_kind' });
  if (text.length < 3) return res.status(400).json({ error: 'too_short' });

  const t = now();
  const ins = db.prepare(`INSERT INTO feedback(user_id, kind, text, status, created_at, updated_at)
                          VALUES(?, ?, ?, 'open', ?, ?)`).run(req.user.id, kind, text, t, t);
  res.json({ ok: true, id: Number(ins.lastInsertRowid) });
});

r.get('/mine', (req, res) => {
  const list = db.prepare(
    `SELECT id, kind, text, status, admin_note, created_at, updated_at
     FROM feedback WHERE user_id = ? ORDER BY id DESC LIMIT 50`
  ).all(req.user.id);
  res.json({ feedback: list });
});

export default r;
