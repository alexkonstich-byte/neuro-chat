import { db } from './db.js';
import { now } from './util.js';

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no_token' });

  const sess = db.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > ?'
  ).get(token, now());
  if (!sess) return res.status(401).json({ error: 'bad_token' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sess.user_id);
  if (!user) return res.status(401).json({ error: 'no_user' });
  if (user.is_banned) return res.status(403).json({ error: 'banned' });

  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token = ?').run(now(), token);
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), user.id);

  req.user = user;
  req.session = sess;
  next();
}

export function adminOnly(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'admin_only' });
  next();
}

export function notBanned(req, res, next) {
  if (req.user?.is_banned) return res.status(403).json({ error: 'banned' });
  next();
}
