import { db } from './db.js';
import { now, sha256, todayIso, isoDiffDays, pairKey } from './util.js';

function getSetting(key, def) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!r) return def;
  const n = Number(r.value);
  return Number.isFinite(n) ? n : r.value;
}

export function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));
}

export function getActiveMultiplier(userId) {
  const t = now();
  const row = db.prepare('SELECT * FROM active_multipliers WHERE user_id = ?').get(userId);
  if (!row) return 1;
  if (row.expires_at <= t) {
    db.prepare('DELETE FROM active_multipliers WHERE user_id = ?').run(userId);
    return 1;
  }
  return row.factor;
}

export function activateMultiplier(userId, factor, durationSec) {
  const t = now();
  const expires = t + durationSec * 1000;
  db.prepare(
    `INSERT INTO active_multipliers(user_id, factor, expires_at) VALUES(?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET factor = excluded.factor, expires_at = excluded.expires_at`
  ).run(userId, factor, expires);
}

/**
 * Returns awarded XP (0 if anti-cheat blocked).
 * Updates antispam state and user's xp.
 */
export function awardXpForMessage(userId, text) {
  const trimmed = (text || '').trim();
  const minChars = Number(getSetting('xp_min_chars', 2));
  if (trimmed.length < minChars) return 0;

  const base = Number(getSetting('xp_per_message', 2));
  const repeatThreshold = Number(getSetting('antispam_repeat_threshold', 3));
  const windowSec = Number(getSetting('antispam_window_seconds', 10));
  const windowMax = Number(getSetting('antispam_window_max_msgs', 7));

  const t = now();
  const hash = sha256(trimmed.toLowerCase());

  let st = db.prepare('SELECT * FROM antispam_state WHERE user_id = ?').get(userId);
  if (!st) {
    db.prepare(`INSERT INTO antispam_state(user_id, last_text_hash, repeat_count, last_msg_at, msgs_in_window, window_start)
                VALUES(?, ?, 0, 0, 0, 0)`).run(userId, '');
    st = db.prepare('SELECT * FROM antispam_state WHERE user_id = ?').get(userId);
  }

  // Window logic
  let windowStart = st.window_start;
  let inWindow = st.msgs_in_window;
  if (t - windowStart > windowSec * 1000) {
    windowStart = t;
    inWindow = 0;
  }
  inWindow += 1;

  // Repeat logic
  let repeats = st.last_text_hash === hash ? st.repeat_count + 1 : 1;

  db.prepare(`UPDATE antispam_state SET last_text_hash = ?, repeat_count = ?, last_msg_at = ?,
              msgs_in_window = ?, window_start = ? WHERE user_id = ?`)
    .run(hash, repeats, t, inWindow, windowStart, userId);

  if (repeats >= repeatThreshold) return 0;
  if (inWindow > windowMax) return 0;

  const factor = getActiveMultiplier(userId);
  const award = base * factor;
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(award, userId);
  db.prepare(`INSERT INTO transactions(user_id, kind, amount_xp, note, created_at, refundable_until)
              VALUES(?, 'xp_award', ?, 'message', ?, 0)`).run(userId, award, t);
  return award;
}

export function spendXp(userId, amount, kind, note, refundableMs = 0, refItemCode = null, refId = null) {
  if (amount <= 0) return false;
  const u = db.prepare('SELECT xp FROM users WHERE id = ?').get(userId);
  if (!u || u.xp < amount) return false;
  const t = now();
  db.prepare('UPDATE users SET xp = xp - ? WHERE id = ?').run(amount, userId);
  const r = db.prepare(`INSERT INTO transactions
    (user_id, kind, amount_xp, ref_item_code, ref_id, note, created_at, refundable_until, refunded)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .run(userId, kind, -amount, refItemCode, refId, note, t, refundableMs > 0 ? t + refundableMs : 0);
  return r.lastInsertRowid;
}

export function addXp(userId, amount, kind = 'xp_award', note = '') {
  if (amount <= 0) return;
  const t = now();
  db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(amount, userId);
  db.prepare(`INSERT INTO transactions(user_id, kind, amount_xp, note, created_at, refundable_until)
              VALUES(?, ?, ?, ?, ?, 0)`).run(userId, kind, amount, note, t);
}

export function addNeurons(userId, amount, kind = 'neurons_change', note = '') {
  const t = now();
  db.prepare('UPDATE users SET neurons = neurons + ? WHERE id = ?').run(amount, userId);
  db.prepare(`INSERT INTO transactions(user_id, kind, amount_neurons, note, created_at, refundable_until)
              VALUES(?, ?, ?, ?, ?, 0)`).run(userId, kind, amount, note, t);
}

export function grantPremium(userId, ms, kind = 'premium_grant', note = '') {
  const t = now();
  const u = db.prepare('SELECT premium_until FROM users WHERE id = ?').get(userId);
  const base = Math.max(t, u?.premium_until || 0);
  const until = base + ms;
  db.prepare('UPDATE users SET premium_until = ? WHERE id = ?').run(until, userId);
  db.prepare(`INSERT INTO transactions(user_id, kind, amount_xp, note, created_at, refundable_until)
              VALUES(?, ?, 0, ?, ?, 0)`).run(userId, kind, note, t);
  return until;
}

/** Update friendship streak between two users when they exchange messages.
 * Returns the current streak day count after update.
 */
export function bumpFriendshipStreak(uA, uB) {
  if (uA === uB) return 0;
  const [a, b] = pairKey(uA, uB);
  const today = todayIso();
  const row = db.prepare('SELECT * FROM friendship_streaks WHERE user_a = ? AND user_b = ?').get(a, b);
  if (!row) {
    db.prepare(`INSERT INTO friendship_streaks(user_a, user_b, days, last_day_iso) VALUES(?, ?, 1, ?)`).run(a, b, today);
    return 1;
  }
  if (row.last_day_iso === today) return row.days;
  const diff = isoDiffDays(row.last_day_iso, today);
  let days = row.days;
  if (diff === 1) days += 1;
  else if (diff > 1) days = 1; // streak broken
  db.prepare('UPDATE friendship_streaks SET days = ?, last_day_iso = ? WHERE user_a = ? AND user_b = ?')
    .run(days, today, a, b);
  return days;
}

export function getFriendshipStreak(uA, uB) {
  if (uA === uB) return { days: 0, fire: false };
  const [a, b] = pairKey(uA, uB);
  const row = db.prepare('SELECT * FROM friendship_streaks WHERE user_a = ? AND user_b = ?').get(a, b);
  if (!row) return { days: 0, fire: false };
  // If last activity older than today, the streak is "still alive" only until end-of-day Y
  const diff = isoDiffDays(row.last_day_iso, todayIso());
  if (diff > 1) return { days: 0, fire: false };
  return { days: row.days, fire: row.days >= 3 };
}

/** Returns true if the message text contains any banned word for this user (global + user-specific). */
export function hasBannedWord(userId, text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const rows = db.prepare(
    `SELECT word FROM banned_words WHERE scope = 'global' OR (scope = 'user' AND target_user_id = ?)`
  ).all(userId);
  for (const r of rows) {
    if (lower.includes(r.word.toLowerCase())) return true;
  }
  return false;
}
