import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { now, randomHex, hashPassword, verifyPassword, shortCode } from '../util.js';
import { ensureSavedChat, ensureNeuroChat, notifyLogin, notifyCodeIssued, ADMIN_USERNAME } from '../service.js';

const r = Router();

function makeSession(userId, req) {
  const token = randomHex(32);
  const ttl = config.sessionTtlDays * 24 * 60 * 60 * 1000;
  db.prepare(
    `INSERT INTO sessions(token, user_id, ip, user_agent, created_at, last_seen_at, expires_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)`
  ).run(token, userId, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 200), now(), now(), now() + ttl);
  return { token, expiresAt: now() + ttl };
}

function normUsername(v) {
  return String(v || '').toLowerCase().trim().replace(/[^a-z0-9_]/g, '').slice(0, 32);
}

// ---- REGISTER ----
r.post('/register', (req, res) => {
  const username = normUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || '').trim().slice(0, 64) || username;

  if (username.length < 3) return res.status(400).json({ error: 'username_short' });
  if (password.length < 6) return res.status(400).json({ error: 'password_short' });

  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    return res.status(400).json({ error: 'username_taken' });
  }

  const { salt, hash } = hashPassword(password);
  const isAdmin = username === ADMIN_USERNAME ? 1 : 0;
  const t = now();

  const ins = db.prepare(
    `INSERT INTO users(username, password_hash, password_salt, display_name, is_admin, created_at, last_seen_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)`
  ).run(username, hash, salt, displayName, isAdmin, t, t);
  const userId = Number(ins.lastInsertRowid);

  ensureSavedChat(userId);
  ensureNeuroChat(userId);
  notifyLogin(userId, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 200));

  const { token } = makeSession(userId, req);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.json({ ok: true, token, user: publicUser(u, true) });
});

// ---- LOGIN with password ----
r.post('/login', (req, res) => {
  const username = normUsername(req.body?.username);
  const password = String(req.body?.password || '');
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !u.password_hash) return res.status(400).json({ error: 'bad_credentials' });
  if (!verifyPassword(password, u.password_salt, u.password_hash)) {
    return res.status(400).json({ error: 'bad_credentials' });
  }
  if (u.is_banned) return res.status(403).json({ error: 'banned' });

  ensureSavedChat(u.id);
  ensureNeuroChat(u.id);

  const { token } = makeSession(u.id, req);
  notifyLogin(u.id, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 200));
  res.json({ ok: true, token, user: publicUser(u, true) });
});

// ---- LOGIN by code (new device, code from another active session) ----
r.post('/login-by-code', (req, res) => {
  const username = normUsername(req.body?.username);
  const code = String(req.body?.code || '').trim();
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u) return res.status(400).json({ error: 'bad_credentials' });
  if (u.is_banned) return res.status(403).json({ error: 'banned' });

  const row = db.prepare(
    `SELECT * FROM login_codes WHERE code = ? AND user_id = ? AND used = 0 AND expires_at > ?`
  ).get(code, u.id, now());
  if (!row) return res.status(400).json({ error: 'bad_code' });
  db.prepare('UPDATE login_codes SET used = 1 WHERE code = ?').run(code);

  ensureSavedChat(u.id);
  ensureNeuroChat(u.id);

  const { token } = makeSession(u.id, req);
  notifyLogin(u.id, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 200), code);
  res.json({ ok: true, token, user: publicUser(u, true) });
});

// ---- ISSUE login code from current session (for use on another device) ----
r.post('/issue-code', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no_token' });
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, now());
  if (!sess) return res.status(401).json({ error: 'bad_token' });

  const code = shortCode(8);
  const ttl = 5 * 60 * 1000;
  db.prepare(`INSERT INTO login_codes(code, user_id, issued_by, ip, user_agent, used, created_at, expires_at)
              VALUES(?, ?, ?, ?, ?, 0, ?, ?)`)
    .run(code, sess.user_id, sess.user_id, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 200), now(), now() + ttl);
  notifyCodeIssued(sess.user_id, code, now() + ttl);
  res.json({ ok: true, code, expiresAt: now() + ttl });
});

// ---- ME / LOGOUT / SESSIONS ----
r.get('/me', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no_token' });
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, now());
  if (!sess) return res.status(401).json({ error: 'bad_token' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sess.user_id);
  if (!user) return res.status(401).json({ error: 'no_user' });
  res.json({ user: publicUser(user, true) });
});

r.post('/logout', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

r.get('/sessions', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no_token' });
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!sess) return res.status(401).json({ error: 'bad_token' });
  const all = db.prepare(
    'SELECT token, ip, user_agent, created_at, last_seen_at, expires_at FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC'
  ).all(sess.user_id);
  res.json({ sessions: all, current: token });
});

r.delete('/sessions/:token', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no_token' });
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!sess) return res.status(401).json({ error: 'bad_token' });
  db.prepare('DELETE FROM sessions WHERE token = ? AND user_id = ?').run(req.params.token, sess.user_id);
  res.json({ ok: true });
});

// ---- Change password ----
r.post('/change-password', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no_token' });
  const sess = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, now());
  if (!sess) return res.status(401).json({ error: 'bad_token' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(sess.user_id);
  const oldPw = String(req.body?.oldPassword || '');
  const newPw = String(req.body?.newPassword || '');
  if (newPw.length < 6) return res.status(400).json({ error: 'password_short' });
  if (!verifyPassword(oldPw, u.password_salt, u.password_hash)) return res.status(400).json({ error: 'bad_credentials' });
  const { salt, hash } = hashPassword(newPw);
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, u.id);
  res.json({ ok: true });
});

export function publicUser(u, full = false) {
  if (!u) return null;
  const base = {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    bio: u.bio,
    avatar: u.avatar_path,
    isAdmin: !!u.is_admin,
    isBot: u.username === 'neuro',
    premiumUntil: u.premium_until,
    isPremium: u.premium_until > Date.now(),
    activeBg: u.active_bg,
    activeBorder: u.active_border,
    prefixText: u.prefix_text,
    prefixColor: u.prefix_color,
    nickColor: u.nick_color,
    customEmoji: u.custom_emoji,
    xp: u.xp_visible ? u.xp : null,
    lastSeenAt: u.last_seen_at,
  };
  if (full) {
    base.xp = u.xp;
    base.neurons = u.neurons;
    base.xpVisible = !!u.xp_visible;
  }
  return base;
}

export default r;
