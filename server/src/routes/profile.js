import { Router } from 'express';
import { db } from '../db.js';
import { now } from '../util.js';
import { publicUser } from './auth.js';

const r = Router();

r.patch('/me', (req, res) => {
  const u = req.user;
  const isPremium = u.premium_until > now();

  const fields = [];
  const args = [];

  if (typeof req.body?.displayName === 'string') {
    fields.push('display_name = ?'); args.push(String(req.body.displayName).slice(0, 64));
  }
  if (typeof req.body?.bio === 'string') {
    fields.push('bio = ?'); args.push(String(req.body.bio).slice(0, 200));
  }
  if (typeof req.body?.username === 'string') {
    const uname = String(req.body.username).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
    if (uname.length >= 3) {
      const taken = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(uname, u.id);
      if (taken) return res.status(400).json({ error: 'username_taken' });
      fields.push('username = ?'); args.push(uname);
    }
  }
  if (typeof req.body?.xpVisible === 'boolean') {
    fields.push('xp_visible = ?'); args.push(req.body.xpVisible ? 1 : 0);
  }
  if (typeof req.body?.prefixText === 'string') {
    // Owning the "prefix_slot" item is required to set non-empty prefix
    const text = String(req.body.prefixText).slice(0, 12);
    if (text) {
      const has = db.prepare('SELECT 1 FROM inventory WHERE user_id = ? AND item_code = ?').get(u.id, 'prefix_slot');
      if (!has) return res.status(403).json({ error: 'prefix_slot_required' });
    }
    fields.push('prefix_text = ?'); args.push(text);
  }
  if (typeof req.body?.prefixColor === 'string') {
    if (!isPremium && req.body.prefixColor) return res.status(403).json({ error: 'premium_required' });
    fields.push('prefix_color = ?'); args.push(req.body.prefixColor.slice(0, 16) || null);
  }
  if (typeof req.body?.nickColor === 'string') {
    if (!isPremium && req.body.nickColor) return res.status(403).json({ error: 'premium_required' });
    fields.push('nick_color = ?'); args.push(req.body.nickColor.slice(0, 16) || null);
  }
  if (typeof req.body?.customEmoji === 'string') {
    if (!isPremium && req.body.customEmoji) return res.status(403).json({ error: 'premium_required' });
    fields.push('custom_emoji = ?'); args.push(req.body.customEmoji.slice(0, 8) || null);
  }
  if (typeof req.body?.statusEmoji === 'string') {
    fields.push('status_emoji = ?'); args.push(req.body.statusEmoji.slice(0, 8) || null);
  }
  if (typeof req.body?.statusText === 'string') {
    fields.push('status_text = ?'); args.push(req.body.statusText.slice(0, 80) || null);
  }
  if (typeof req.body?.birthday === 'string') {
    const v = req.body.birthday.match(/^\d{4}-\d{2}-\d{2}$/) ? req.body.birthday : null;
    fields.push('birthday = ?'); args.push(v);
  }
  if (typeof req.body?.theme === 'string') {
    fields.push('theme = ?'); args.push(req.body.theme.slice(0, 24) || 'midnight');
  }
  if (typeof req.body?.phone === 'string') {
    fields.push('phone = ?'); args.push(req.body.phone.slice(0, 32) || null);
  }
  if (typeof req.body?.tutorialDone === 'boolean') {
    fields.push('tutorial_done = ?'); args.push(req.body.tutorialDone ? 1 : 0);
  }

  if (fields.length === 0) return res.json({ user: publicUser(u, true) });
  args.push(u.id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  res.json({ user: publicUser(fresh, true) });
});

r.get('/by-username/:uname', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(req.params.uname).toLowerCase());
  if (!u || u.shadow_banned && u.id !== req.user.id) return res.status(404).json({ error: 'no_user' });
  res.json({ user: publicUser(u) });
});

r.get('/by-id/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'no_user' });
  res.json({ user: publicUser(u) });
});

r.get('/search', (req, res) => {
  const q = `%${String(req.query?.q || '').toLowerCase()}%`;
  const rows = db.prepare(
    `SELECT * FROM users
     WHERE (LOWER(username) LIKE ? OR LOWER(display_name) LIKE ?)
       AND id != ? AND shadow_banned = 0
     LIMIT 20`
  ).all(q, q, req.user.id);
  res.json({ users: rows.map(u => publicUser(u)) });
});

export default r;
