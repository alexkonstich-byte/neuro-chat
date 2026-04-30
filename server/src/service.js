import { db } from './db.js';
import { now } from './util.js';

export const ADMIN_USERNAME = 'alexserguntsov';

export function getNeuroBotId() {
  const r = db.prepare("SELECT id FROM users WHERE username = 'neuro'").get();
  return r?.id || null;
}

export function ensureSavedChat(userId) {
  let row = db.prepare(
    `SELECT c.id FROM chats c
     JOIN chat_members m ON m.chat_id = c.id AND m.user_id = ?
     WHERE c.type = 'self' LIMIT 1`
  ).get(userId);
  if (row) return row.id;
  const t = now();
  const r = db.prepare(`INSERT INTO chats(type, title, created_by, created_at, last_message_at)
                        VALUES('self', 'Избранное', ?, ?, ?)`).run(userId, t, t);
  const chatId = Number(r.lastInsertRowid);
  db.prepare(`INSERT INTO chat_members(chat_id, user_id, role, joined_at) VALUES(?, ?, 'owner', ?)`)
    .run(chatId, userId, t);
  return chatId;
}

export function ensureNeuroChat(userId) {
  const botId = getNeuroBotId();
  if (!botId || userId === botId) return null;
  const existing = db.prepare(
    `SELECT c.id FROM chats c
     JOIN chat_members ma ON ma.chat_id = c.id AND ma.user_id = ?
     JOIN chat_members mb ON mb.chat_id = c.id AND mb.user_id = ?
     WHERE c.type = 'service' LIMIT 1`
  ).get(userId, botId);
  if (existing) return existing.id;
  const t = now();
  const r = db.prepare(`INSERT INTO chats(type, title, created_by, created_at, last_message_at)
                        VALUES('service', 'Allsafe', ?, ?, ?)`).run(botId, t, t);
  const chatId = Number(r.lastInsertRowid);
  db.prepare(`INSERT INTO chat_members(chat_id, user_id, role, joined_at) VALUES(?, ?, 'member', ?)`).run(chatId, userId, t);
  db.prepare(`INSERT INTO chat_members(chat_id, user_id, role, joined_at) VALUES(?, ?, 'owner', ?)`).run(chatId, botId, t);
  return chatId;
}

export function postSystemMessage(chatId, text, kind = 'text') {
  const botId = getNeuroBotId();
  const t = now();
  const r = db.prepare(
    `INSERT INTO messages(chat_id, sender_id, kind, text, created_at) VALUES(?, ?, ?, ?, ?)`
  ).run(chatId, botId, kind, text, t);
  db.prepare('UPDATE chats SET last_message_at = ? WHERE id = ?').run(t, chatId);
  return Number(r.lastInsertRowid);
}

export function notifyLogin(userId, ip, ua, code) {
  const chatId = ensureNeuroChat(userId);
  if (!chatId) return;
  const lines = [];
  lines.push('🔐 Новый вход в аккаунт');
  if (ua) lines.push(`Устройство: ${ua}`);
  if (ip) lines.push(`IP: ${ip}`);
  lines.push(`Время: ${new Date().toLocaleString('ru-RU')}`);
  if (code) lines.push(`\nЭто были вы? Если нет — смените пароль.`);
  postSystemMessage(chatId, lines.join('\n'));
}

export function notifyCodeIssued(userId, code, expiresAt) {
  const chatId = ensureNeuroChat(userId);
  if (!chatId) return;
  const mins = Math.round((expiresAt - Date.now()) / 60000);
  postSystemMessage(
    chatId,
    `🔑 Код для входа на новом устройстве: ${code}\nДействует ${mins} мин. Никому не сообщайте этот код.`
  );
}
