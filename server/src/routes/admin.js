import { Router } from 'express';
import { db } from '../db.js';
import { now } from '../util.js';
import { setSetting, addXp, grantPremium } from '../xp.js';

const r = Router();

r.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  res.json({ settings: rows });
});

r.post('/settings', (req, res) => {
  const key = String(req.body?.key || '');
  const value = String(req.body?.value ?? '');
  if (!key) return res.status(400).json({ error: 'no_key' });
  setSetting(key, value);
  res.json({ ok: true });
});

r.get('/users', (req, res) => {
  const q = `%${String(req.query?.q || '').toLowerCase()}%`;
  const rows = db.prepare(
    `SELECT id, phone, username, display_name, xp, neurons, premium_until,
            is_admin, is_vip, is_banned, shadow_banned, created_at, last_seen_at
     FROM users
     WHERE LOWER(username) LIKE ? OR LOWER(display_name) LIKE ? OR phone LIKE ?
     ORDER BY id DESC LIMIT 100`
  ).all(q, q, q);
  res.json({ users: rows });
});

r.post('/users/:id/xp', (req, res) => {
  const userId = Number(req.params.id);
  const delta = Math.floor(Number(req.body?.delta || 0));
  const note = String(req.body?.note || '').slice(0, 200);
  if (!delta) return res.status(400).json({ error: 'no_delta' });
  if (delta > 0) addXp(userId, delta, 'xp_award', note || 'Админская выдача');
  else {
    db.prepare('UPDATE users SET xp = MAX(0, xp + ?) WHERE id = ?').run(delta, userId);
    db.prepare(`INSERT INTO transactions(user_id, kind, amount_xp, note, created_at, refundable_until)
                VALUES(?, 'xp_revoke', ?, ?, ?, 0)`).run(userId, delta, note || 'Админское списание', now());
  }
  res.json({ ok: true });
});

r.post('/users/:id/neurons', (req, res) => {
  const userId = Number(req.params.id);
  const delta = Math.floor(Number(req.body?.delta || 0));
  const note = String(req.body?.note || '').slice(0, 200);
  db.prepare('UPDATE users SET neurons = MAX(0, neurons + ?) WHERE id = ?').run(delta, userId);
  db.prepare(`INSERT INTO transactions(user_id, kind, amount_neurons, note, created_at, refundable_until)
              VALUES(?, 'neurons_change', ?, ?, ?, 0)`).run(userId, delta, note || 'Админ', now());
  res.json({ ok: true });
});

r.post('/users/:id/premium', (req, res) => {
  const userId = Number(req.params.id);
  const days = Math.floor(Number(req.body?.days || 0));
  if (days <= 0) return res.status(400).json({ error: 'bad_days' });
  grantPremium(userId, days * 24 * 3600 * 1000, 'premium_grant', `Премиум +${days}д от админа`);
  res.json({ ok: true });
});

r.post('/users/:id/ban', (req, res) => {
  const userId = Number(req.params.id);
  const banned = req.body?.banned ? 1 : 0;
  db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(banned, userId);
  if (banned) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  res.json({ ok: true });
});

r.post('/users/:id/shadow', (req, res) => {
  const userId = Number(req.params.id);
  const sb = req.body?.shadow ? 1 : 0;
  db.prepare('UPDATE users SET shadow_banned = ? WHERE id = ?').run(sb, userId);
  res.json({ ok: true });
});

// Banned words
r.get('/banned-words', (req, res) => {
  const rows = db.prepare(
    `SELECT bw.*, u.username FROM banned_words bw LEFT JOIN users u ON u.id = bw.target_user_id
     ORDER BY bw.id DESC`
  ).all();
  res.json({ words: rows });
});

r.post('/banned-words', (req, res) => {
  const word = String(req.body?.word || '').trim();
  const scope = String(req.body?.scope || 'global');
  const target = req.body?.targetUserId ? Number(req.body.targetUserId) : null;
  if (!word) return res.status(400).json({ error: 'no_word' });
  if (scope !== 'global' && scope !== 'user') return res.status(400).json({ error: 'bad_scope' });
  if (scope === 'user' && !target) return res.status(400).json({ error: 'no_target' });
  db.prepare(`INSERT INTO banned_words(word, scope, target_user_id, created_at) VALUES(?, ?, ?, ?)`)
    .run(word, scope, target, now());
  res.json({ ok: true });
});

r.delete('/banned-words/:id', (req, res) => {
  db.prepare('DELETE FROM banned_words WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Exclusive items management (admin-only inventory grants)
r.get('/exclusive-items', (req, res) => {
  const rows = db.prepare(`SELECT * FROM shop_items WHERE is_exclusive = 1 ORDER BY sort_order, id`).all();
  res.json({ items: rows.map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null })) });
});

r.post('/exclusive-items', (req, res) => {
  const { code, kind, name, description, payload, price_xp } = req.body || {};
  if (!code || !kind || !name) return res.status(400).json({ error: 'missing_fields' });
  db.prepare(`INSERT INTO shop_items(code, kind, name, description, price_xp, price_neurons, payload, is_exclusive, premium_only, sort_order, active)
              VALUES(?, ?, ?, ?, ?, 0, ?, 1, 0, 999, 1)`)
    .run(code, kind, name, description || '', Number(price_xp) || 0, JSON.stringify(payload || {}));
  res.json({ ok: true });
});

r.patch('/exclusive-items/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, description, price_xp, payload } = req.body || {};
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND is_exclusive = 1').get(id);
  if (!item) return res.status(404).json({ error: 'not_found' });
  db.prepare(`UPDATE shop_items SET name = ?, description = ?, price_xp = ?, payload = ? WHERE id = ?`)
    .run(name ?? item.name, description ?? item.description, Number(price_xp) ?? item.price_xp, payload !== undefined ? JSON.stringify(payload) : item.payload, id);
  res.json({ ok: true });
});

r.post('/grant-item', (req, res) => {
  const userId = Number(req.body?.userId);
  const code = String(req.body?.code || '');
  const item = db.prepare('SELECT * FROM shop_items WHERE code = ?').get(code);
  if (!item) return res.status(404).json({ error: 'no_item' });
  const t = now();
  db.prepare(`INSERT OR IGNORE INTO inventory(user_id, item_code, source, acquired_at, expires_at)
              VALUES(?, ?, 'admin', ?, 0)`).run(userId, code, t);
  res.json({ ok: true });
});

// ---- Feedback inbox ----
r.get('/feedback', (req, res) => {
  const status = String(req.query?.status || '');
  const where = status ? 'WHERE f.status = ?' : '';
  const args  = status ? [status] : [];
  const rows = db.prepare(
    `SELECT f.*, u.username, u.display_name FROM feedback f
     JOIN users u ON u.id = f.user_id
     ${where}
     ORDER BY f.id DESC LIMIT 200`
  ).all(...args);
  res.json({ feedback: rows });
});

r.patch('/feedback/:id', (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  const note = req.body?.adminNote != null ? String(req.body.adminNote).slice(0, 1000) : null;
  if (!['open','in_progress','done','rejected'].includes(status)) return res.status(400).json({ error: 'bad_status' });
  const t = now();
  if (note !== null) {
    db.prepare(`UPDATE feedback SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?`).run(status, note, t, id);
  } else {
    db.prepare(`UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?`).run(status, t, id);
  }
  res.json({ ok: true });
});

// ---- VIP toggle ----
r.post('/users/:id/vip', (req, res) => {
  const userId = Number(req.params.id);
  const v = req.body?.vip ? 1 : 0;
  db.prepare('UPDATE users SET is_vip = ? WHERE id = ?').run(v, userId);
  res.json({ ok: true });
});

r.get('/transactions', (req, res) => {
  const userId = req.query?.userId ? Number(req.query.userId) : null;
  const rows = userId
    ? db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 200').all(userId)
    : db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT 200').all();
  res.json({ transactions: rows });
});

export default r;
