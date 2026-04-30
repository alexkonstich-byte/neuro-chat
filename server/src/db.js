import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

mkdirSync(config.dataDir, { recursive: true });
mkdirSync(config.uploadDir, { recursive: true });
mkdirSync(path.join(config.uploadDir, 'avatars'), { recursive: true });
mkdirSync(path.join(config.uploadDir, 'media'), { recursive: true });

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  phone           TEXT,
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT,
  password_salt   TEXT,
  display_name    TEXT NOT NULL DEFAULT '',
  bio             TEXT NOT NULL DEFAULT '',
  avatar_path     TEXT,
  is_admin        INTEGER NOT NULL DEFAULT 0,
  is_banned       INTEGER NOT NULL DEFAULT 0,
  shadow_banned   INTEGER NOT NULL DEFAULT 0,
  xp              INTEGER NOT NULL DEFAULT 0,
  neurons         INTEGER NOT NULL DEFAULT 0,
  premium_until   INTEGER NOT NULL DEFAULT 0,
  xp_visible      INTEGER NOT NULL DEFAULT 1,
  prefix_text     TEXT NOT NULL DEFAULT '',
  prefix_color    TEXT,
  nick_color      TEXT,
  custom_emoji    TEXT,
  active_bg       TEXT,
  active_border   TEXT,
  last_seen_at    INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip            TEXT,
  user_agent    TEXT,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone       TEXT NOT NULL,
  code        TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (phone, code)
);

CREATE TABLE IF NOT EXISTS chats (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK(type IN ('dm','group','channel','self','service')),
  title         TEXT,
  avatar_path   TEXT,
  created_by    INTEGER REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id              INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                 TEXT NOT NULL DEFAULT 'member',
  joined_at            INTEGER NOT NULL,
  last_read_message_id INTEGER NOT NULL DEFAULT 0,
  muted_until          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON chat_members(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id      INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id    INTEGER REFERENCES users(id),
  reply_to     INTEGER REFERENCES messages(id),
  kind         TEXT NOT NULL DEFAULT 'text',
  text         TEXT,
  media_path   TEXT,
  media_meta   TEXT,
  edited_at    INTEGER,
  deleted_at   INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, id);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS friendship_streaks (
  user_a       INTEGER NOT NULL,
  user_b       INTEGER NOT NULL,
  days         INTEGER NOT NULL DEFAULT 0,
  last_day_iso TEXT NOT NULL,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS shop_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT UNIQUE NOT NULL,
  kind         TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  price_xp     INTEGER NOT NULL DEFAULT 0,
  price_neurons INTEGER NOT NULL DEFAULT 0,
  payload      TEXT,
  is_exclusive INTEGER NOT NULL DEFAULT 0,
  premium_only INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS inventory (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_code   TEXT NOT NULL,
  source      TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, item_code)
);

CREATE TABLE IF NOT EXISTS transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  amount_xp       INTEGER NOT NULL DEFAULT 0,
  amount_neurons  INTEGER NOT NULL DEFAULT 0,
  ref_item_code   TEXT,
  ref_id          INTEGER,
  note            TEXT,
  refundable_until INTEGER NOT NULL DEFAULT 0,
  refunded        INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, id);

CREATE TABLE IF NOT EXISTS active_multipliers (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  factor     INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS casino_spins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bet_xp     INTEGER NOT NULL,
  reels      TEXT NOT NULL,
  win_xp     INTEGER NOT NULL DEFAULT 0,
  win_neurons INTEGER NOT NULL DEFAULT 0,
  jackpot    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_spins_created ON casino_spins(created_at);
CREATE INDEX IF NOT EXISTS idx_spins_user ON casino_spins(user_id);

CREATE TABLE IF NOT EXISTS banned_words (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  word          TEXT NOT NULL,
  scope         TEXT NOT NULL,
  target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_banned_scope ON banned_words(scope, target_user_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS antispam_state (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_text_hash TEXT,
  repeat_count   INTEGER NOT NULL DEFAULT 0,
  last_msg_at    INTEGER NOT NULL DEFAULT 0,
  msgs_in_window INTEGER NOT NULL DEFAULT 0,
  window_start   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attachments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  path       TEXT NOT NULL,
  mime       TEXT,
  size       INTEGER NOT NULL DEFAULT 0,
  width      INTEGER,
  height     INTEGER,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachments_msg ON attachments(message_id);
`;

db.exec(SCHEMA);

// Lightweight column-add migrations for existing DBs
function ensureColumn(table, col, type) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  }
}
ensureColumn('users', 'password_hash', 'TEXT');
ensureColumn('users', 'password_salt', 'TEXT');
ensureColumn('users', 'birthday',     'TEXT');     // ISO yyyy-mm-dd
ensureColumn('users', 'status_emoji', 'TEXT');     // TG-style emoji after nick (free)
ensureColumn('users', 'status_text',  'TEXT');     // short status line on profile
ensureColumn('users', 'theme',        'TEXT');     // settings: chosen theme key
ensureColumn('users', 'is_vip',       'INTEGER DEFAULT 0');
ensureColumn('users', 'video_avatar_path', 'TEXT');     // Premium/VIP — looping mp4/webm
ensureColumn('users', 'tutorial_done', 'INTEGER DEFAULT 0');
ensureColumn('chat_members', 'nickname', 'TEXT');

// One-shot rebuild of `users` if it still has the legacy `phone NOT NULL` constraint
// or `username` is nullable. (No third-party migration tool — SQLite doesn't support
// ALTER COLUMN, so we recreate the table.)
{
  const cols = db.prepare(`PRAGMA table_info(users)`).all();
  const phone = cols.find((c) => c.name === 'phone');
  const uname = cols.find((c) => c.name === 'username');
  const phoneIsNotNull = phone && phone.notnull === 1;
  const unameIsNullable = uname && uname.notnull === 0;
  if (phoneIsNotNull || unameIsNullable) {
    console.log('[db] migrating users table to new schema (phone nullable, username NOT NULL)');
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN');
    try {
      db.exec(`ALTER TABLE users RENAME TO users__old`);
      db.exec(`
        CREATE TABLE users (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          phone           TEXT,
          username        TEXT UNIQUE NOT NULL,
          password_hash   TEXT,
          password_salt   TEXT,
          display_name    TEXT NOT NULL DEFAULT '',
          bio             TEXT NOT NULL DEFAULT '',
          avatar_path     TEXT,
          is_admin        INTEGER NOT NULL DEFAULT 0,
          is_banned       INTEGER NOT NULL DEFAULT 0,
          shadow_banned   INTEGER NOT NULL DEFAULT 0,
          xp              INTEGER NOT NULL DEFAULT 0,
          neurons         INTEGER NOT NULL DEFAULT 0,
          premium_until   INTEGER NOT NULL DEFAULT 0,
          xp_visible      INTEGER NOT NULL DEFAULT 1,
          prefix_text     TEXT NOT NULL DEFAULT '',
          prefix_color    TEXT,
          nick_color      TEXT,
          custom_emoji    TEXT,
          active_bg       TEXT,
          active_border   TEXT,
          last_seen_at    INTEGER NOT NULL DEFAULT 0,
          created_at      INTEGER NOT NULL
        );
      `);
      // Carry over rows. Old DBs may not have password_hash/salt — leave NULL.
      const oldCols = db.prepare(`PRAGMA table_info(users__old)`).all().map((c) => c.name);
      const want = ['id','phone','username','password_hash','password_salt','display_name','bio','avatar_path',
        'is_admin','is_banned','shadow_banned','xp','neurons','premium_until','xp_visible',
        'prefix_text','prefix_color','nick_color','custom_emoji','active_bg','active_border',
        'last_seen_at','created_at'];
      const selectCols = want.map((c) => oldCols.includes(c) ? c : `NULL AS ${c}`).join(', ');
      // Make sure every row has a username (legacy DBs allowed NULL)
      db.exec(`
        INSERT INTO users (${want.join(', ')})
        SELECT ${selectCols} FROM users__old
        WHERE username IS NOT NULL AND username != ''
      `);
      db.exec('DROP TABLE users__old');
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }
  }
}

// Login-by-code: a logged-in session can issue a short-lived code for another device.
db.exec(`
CREATE TABLE IF NOT EXISTS login_codes (
  code        TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_by   INTEGER REFERENCES users(id),
  ip          TEXT,
  user_agent  TEXT,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_codes_user ON login_codes(user_id);

CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,        -- 'bug' | 'feature' | 'message'
  text        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open', -- open | in_progress | done | rejected
  admin_note  TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user   ON feedback(user_id, created_at DESC);
`);

// Seed system "Allsafe" bot user (kept on username='neuro' for back-compat with
// existing installs and chat lookups; only the displayed name is rebranded).
const allsafeBotExists = db.prepare("SELECT id, display_name FROM users WHERE username = 'neuro'").get();
if (!allsafeBotExists) {
  db.prepare(
    `INSERT INTO users(username, display_name, bio, is_admin, created_at, last_seen_at)
     VALUES('neuro', 'Allsafe', 'Системные уведомления и коды входа', 0, ?, ?)`
  ).run(Date.now(), Date.now());
} else if (allsafeBotExists.display_name === 'Neuro') {
  // Migration: rename the bot's display_name on existing installs.
  db.prepare("UPDATE users SET display_name = 'Allsafe', bio = 'Системные уведомления и коды входа' WHERE username = 'neuro'").run();
  // Also rename existing service-chat titles that still say 'Neuro'.
  db.prepare("UPDATE chats SET title = 'Allsafe' WHERE type = 'service' AND title = 'Neuro'").run();
}

// Default settings — admin can change via panel.
function setIfMissing(key, value) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) db.prepare('INSERT INTO settings(key, value) VALUES(?, ?)').run(key, String(value));
}
setIfMissing('xp_per_message', 2);
setIfMissing('xp_min_chars', 2);
setIfMissing('antispam_repeat_threshold', 3);     // 3 same-text in a row → no XP
setIfMissing('antispam_window_seconds', 10);
setIfMissing('antispam_window_max_msgs', 7);      // > this in a window → no XP
setIfMissing('casino_min_bet', 5);
setIfMissing('casino_max_bet', 5000);

// Seed default shop items if empty
const itemCount = db.prepare('SELECT COUNT(*) AS c FROM shop_items').get().c;
if (itemCount === 0) {
  const ins = db.prepare(`INSERT INTO shop_items
    (code, kind, name, description, price_xp, price_neurons, payload, is_exclusive, premium_only, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`);
  // 10 animated backgrounds
  const bgs = [
    ['bg_aurora',     'Aurora',       'from-fuchsia-500 via-purple-600 to-indigo-700',  500],
    ['bg_sunset',     'Закат',        'from-amber-400 via-rose-500 to-fuchsia-700',     500],
    ['bg_ocean',      'Океан',        'from-cyan-400 via-sky-600 to-indigo-900',        700],
    ['bg_emerald',    'Изумруд',      'from-emerald-300 via-teal-600 to-emerald-900',   700],
    ['bg_lava',       'Лава',         'from-yellow-400 via-red-600 to-rose-900',        900],
    ['bg_neon',       'Неон',         'from-pink-400 via-fuchsia-500 to-cyan-400',      900],
    ['bg_galaxy',     'Галактика',    'from-indigo-900 via-purple-800 to-black',       1200],
    ['bg_mint',       'Мята',         'from-lime-300 via-emerald-400 to-cyan-500',     1200],
    ['bg_blood',      'Багровый',     'from-rose-700 via-red-900 to-black',            1500],
    ['bg_white_gold', 'Бел.Золото',   'from-yellow-100 via-amber-300 to-orange-500',   1800],
  ];
  for (let i = 0; i < bgs.length; i++) {
    const [code, name, gradient, price] = bgs[i];
    ins.run(code, 'background', name, 'Анимированный градиентный фон профиля', price, 0,
      JSON.stringify({ gradient }), 0, 0, 10 + i);
  }
  // Avatar borders
  const borders = [
    { code: 'border_silver',  name: 'Серебро',  payload: { color: '#c0c0c0' },                           price: 300  },
    { code: 'border_gold',    name: 'Золото',   payload: { color: '#fbbf24' },                           price: 800  },
    { code: 'border_neon',    name: 'Неон',     payload: { color: '#22d3ee' },                           price: 1200 },
    { code: 'border_rainbow', name: 'Радуга',   payload: { color: 'rainbow' },                           price: 2000 },
    { code: 'border_pulse',   name: 'Пульс',    payload: { animated: 'pulse',   color: '#ff5ba3' },      price: 1500 },
    { code: 'border_aurora',  name: 'Аврора',   payload: { animated: 'aurora' },                          price: 1800 },
    { code: 'border_ember',   name: 'Угольки',  payload: { animated: 'ember',   color: '#ff8a2b' },      price: 2200 },
  ];
  for (let i = 0; i < borders.length; i++) {
    const b = borders[i];
    ins.run(b.code, 'border', b.name, 'Обводка для аватара', b.price, 0,
      JSON.stringify(b.payload), 0, 0, 100 + i);
  }
  // Multipliers (consumables → granted via inventory with expires_at)
  const mults = [
    ['mult_x2_1h',   'x2 на 1 час',  2,  60*60,        300],
    ['mult_x2_24h',  'x2 на 24 ч',   2,  24*60*60,    1500],
    ['mult_x5_1h',   'x5 на 1 час',  5,  60*60,       1200],
    ['mult_x10_1h',  'x10 на 1 час', 10, 60*60,       3000],
  ];
  for (let i = 0; i < mults.length; i++) {
    const [code, name, factor, durSec, price] = mults[i];
    ins.run(code, 'multiplier', name, 'Временный множитель XP за сообщение', price, 0,
      JSON.stringify({ factor, durationSec: durSec }), 0, 0, 200 + i);
  }
  // Neuron pack (buy with XP)
  ins.run('neurons_pack_10', 'neurons_pack', '10 Нейронов', 'Внутренняя валюта',
    1000, 0, JSON.stringify({ amount: 10 }), 0, 0, 300);
  // Custom prefix slot (text only); recolor/emoji is premium-only
  ins.run('prefix_slot', 'prefix', 'Кастомный префикс', 'Текстовый префикс перед ником',
    400, 0, JSON.stringify({}), 0, 0, 400);
}
