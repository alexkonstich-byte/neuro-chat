import { Router } from 'express';
import { db } from '../db.js';
import { now } from '../util.js';
import { publicUser } from './auth.js';
import { getFriendshipStreak } from '../xp.js';
import { ensureSavedChat } from '../service.js';
import { getIO } from '../socket.js';

const r = Router();

r.get('/', (req, res) => {
  const rows = db.prepare(
    `SELECT c.*, cm.last_read_message_id, cm.muted_until, cm.nickname
     FROM chats c
     JOIN chat_members cm ON cm.chat_id = c.id
     WHERE cm.user_id = ?
     ORDER BY c.last_message_at DESC, c.id DESC`
  ).all(req.user.id);

  const result = rows.map(c => {
    const last = db.prepare(
      'SELECT id, sender_id, kind, text, created_at FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT 1'
    ).get(c.id);
    const unread = db.prepare(
      'SELECT COUNT(*) AS c FROM messages WHERE chat_id = ? AND id > ? AND sender_id != ?'
    ).get(c.id, c.last_read_message_id, req.user.id).c;

    let title = c.title;
    let avatar = c.avatar_path;
    let peer = null;
    let streak = null;
    const myNickname = c.nickname || null;
    const mutedUntil = c.muted_until || 0;
    if (c.type === 'dm' || c.type === 'service') {
      const other = db.prepare(
        `SELECT u.* FROM chat_members cm JOIN users u ON u.id = cm.user_id
         WHERE cm.chat_id = ? AND cm.user_id != ?`
      ).get(c.id, req.user.id);
      if (other) {
        title = myNickname || other.display_name || other.username;
        avatar = other.avatar_path;
        peer = publicUser(other);
        if (c.type === 'dm') streak = getFriendshipStreak(req.user.id, other.id);
      }
    } else if (c.type === 'self') {
      title = 'Избранное';
    } else if (c.type === 'group' && myNickname) {
      title = myNickname;
    }
    return {
      id: c.id, type: c.type, title, avatar,
      lastMessage: last, unread, peer, streak,
      lastMessageAt: c.last_message_at,
      mutedUntil, myNickname,
    };
  });
  res.json({ chats: result });
});

// Open or create a DM with another user
r.post('/dm', (req, res) => {
  const otherId = Number(req.body?.userId);
  if (!otherId) return res.status(400).json({ error: 'bad_user' });
  if (otherId === req.user.id) {
    const id = ensureSavedChat(req.user.id);
    return res.json({ chatId: id });
  }
  const other = db.prepare('SELECT id, username FROM users WHERE id = ?').get(otherId);
  if (!other) return res.status(404).json({ error: 'no_user' });
  if (other.username === 'neuro') {
    // Always reuse the system-bot service chat
    const existing = db.prepare(
      `SELECT c.id FROM chats c
       JOIN chat_members ma ON ma.chat_id = c.id AND ma.user_id = ?
       JOIN chat_members mb ON mb.chat_id = c.id AND mb.user_id = ?
       WHERE c.type = 'service' LIMIT 1`
    ).get(req.user.id, otherId);
    if (existing) return res.json({ chatId: existing.id });
  }

  // Find existing DM between the two
  const existing = db.prepare(
    `SELECT c.id FROM chats c
     JOIN chat_members ma ON ma.chat_id = c.id AND ma.user_id = ?
     JOIN chat_members mb ON mb.chat_id = c.id AND mb.user_id = ?
     WHERE c.type = 'dm' LIMIT 1`
  ).get(req.user.id, otherId);
  if (existing) return res.json({ chatId: existing.id });

  const t = now();
  const r1 = db.prepare(`INSERT INTO chats(type, created_by, created_at, last_message_at) VALUES('dm', ?, ?, ?)`).run(req.user.id, t, t);
  const chatId = Number(r1.lastInsertRowid);
  db.prepare(`INSERT INTO chat_members(chat_id, user_id, role, joined_at) VALUES(?, ?, 'member', ?)`).run(chatId, req.user.id, t);
  db.prepare(`INSERT INTO chat_members(chat_id, user_id, role, joined_at) VALUES(?, ?, 'member', ?)`).run(chatId, otherId, t);
  res.json({ chatId });
});

// Create group chat
r.post('/group', (req, res) => {
  const title = String(req.body?.title || '').trim().slice(0, 80);
  const memberIds = Array.from(new Set((req.body?.memberIds || []).map(Number).filter(Boolean)));
  if (!title) return res.status(400).json({ error: 'no_title' });

  const t = now();
  const ins = db.prepare(`INSERT INTO chats(type, title, created_by, created_at, last_message_at)
                          VALUES('group', ?, ?, ?, ?)`).run(title, req.user.id, t, t);
  const chatId = Number(ins.lastInsertRowid);
  db.prepare(`INSERT INTO chat_members(chat_id, user_id, role, joined_at) VALUES(?, ?, 'owner', ?)`).run(chatId, req.user.id, t);
  for (const uid of memberIds) {
    if (uid === req.user.id) continue;
    if (db.prepare('SELECT 1 FROM users WHERE id = ?').get(uid)) {
      db.prepare(`INSERT OR IGNORE INTO chat_members(chat_id, user_id, role, joined_at) VALUES(?, ?, 'member', ?)`).run(chatId, uid, t);
    }
  }
  // System message
  db.prepare(`INSERT INTO messages(chat_id, sender_id, kind, text, created_at) VALUES(?, ?, 'system', ?, ?)`)
    .run(chatId, null, `Группа создана: ${title}`, t);

  // Join all member sockets into the chat room and notify them.
  const io = getIO();
  if (io) {
    const memberRows = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId);
    for (const m of memberRows) {
      io.in(`user:${m.user_id}`).socketsJoin(`chat:${chatId}`);
      io.to(`user:${m.user_id}`).emit('chat:added', { chatId });
    }
  }
  res.json({ ok: true, chatId });
});

// Add members to a group
r.post('/:id/members', (req, res) => {
  const chatId = Number(req.params.id);
  const c = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  if (!c || c.type !== 'group') return res.status(400).json({ error: 'not_group' });
  const me = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
  if (!me) return res.status(403).json({ error: 'not_member' });
  const ids = Array.from(new Set((req.body?.userIds || []).map(Number).filter(Boolean)));
  const t = now();
  let added = 0;
  for (const uid of ids) {
    if (db.prepare('SELECT 1 FROM users WHERE id = ?').get(uid)) {
      const r1 = db.prepare(`INSERT OR IGNORE INTO chat_members(chat_id, user_id, role, joined_at) VALUES(?, ?, 'member', ?)`).run(chatId, uid, t);
      if (r1.changes) added += 1;
    }
  }
  if (added) {
    db.prepare(`INSERT INTO messages(chat_id, sender_id, kind, text, created_at) VALUES(?, ?, 'system', ?, ?)`)
      .run(chatId, req.user.id, `Добавлен${added > 1 ? 'ы' : ''} ${added} участник${added > 1 ? 'а' : ''}`, t);
    const io = getIO();
    if (io) {
      for (const uid of ids) {
        io.in(`user:${uid}`).socketsJoin(`chat:${chatId}`);
        io.to(`user:${uid}`).emit('chat:added', { chatId });
      }
    }
  }
  res.json({ ok: true, added });
});

// Remove a member (owner/admin only, or self-leave)
r.delete('/:id/members/:userId', (req, res) => {
  const chatId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const c = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  if (!c || c.type !== 'group') return res.status(400).json({ error: 'not_group' });
  const me = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
  if (!me) return res.status(403).json({ error: 'not_member' });
  if (userId !== req.user.id && me.role !== 'owner' && me.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?').run(chatId, userId);
  const u = db.prepare('SELECT username, display_name FROM users WHERE id = ?').get(userId);
  db.prepare(`INSERT INTO messages(chat_id, sender_id, kind, text, created_at) VALUES(?, ?, 'system', ?, ?)`)
    .run(chatId, req.user.id, `${u?.display_name || u?.username || 'Участник'} ${userId === req.user.id ? 'покинул(а) группу' : 'удалён(а) из группы'}`, now());
  res.json({ ok: true });
});

r.get('/:id', (req, res) => {
  const chatId = Number(req.params.id);
  const member = db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
  if (!member) return res.status(403).json({ error: 'not_member' });
  const c = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  if (!c) return res.status(404).json({ error: 'no_chat' });
  const members = db.prepare(
    `SELECT u.*, cm.role FROM chat_members cm JOIN users u ON u.id = cm.user_id WHERE cm.chat_id = ?`
  ).all(chatId);
  let peer = null;
  let streak = null;
  if (c.type === 'dm') {
    const other = members.find(m => m.id !== req.user.id);
    if (other) { peer = publicUser(other); streak = getFriendshipStreak(req.user.id, other.id); }
  }
  res.json({
    chat: { id: c.id, type: c.type, title: c.title, avatar: c.avatar_path },
    members: members.map(publicUser),
    peer,
    streak,
    mutedUntil: member.muted_until || 0,
    myNickname: member.nickname || null,
  });
});

r.get('/:id/messages', (req, res) => {
  const chatId = Number(req.params.id);
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
  if (!member) return res.status(403).json({ error: 'not_member' });

  const before = Number(req.query?.before || 0);
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 50)));
  const rows = before > 0
    ? db.prepare(`SELECT * FROM messages WHERE chat_id = ? AND id < ? ORDER BY id DESC LIMIT ?`).all(chatId, before, limit)
    : db.prepare(`SELECT * FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?`).all(chatId, limit);

  const list = rows.reverse().map(m => annotateMessage(m));
  res.json({ messages: list });
});

r.post('/:id/read', (req, res) => {
  const chatId = Number(req.params.id);
  const last = db.prepare('SELECT MAX(id) AS m FROM messages WHERE chat_id = ?').get(chatId).m || 0;
  db.prepare('UPDATE chat_members SET last_read_message_id = ? WHERE chat_id = ? AND user_id = ?')
    .run(last, chatId, req.user.id);
  res.json({ ok: true, lastReadId: last });
});

r.post('/:id/mute', (req, res) => {
  const chatId = Number(req.params.id);
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
  if (!member) return res.status(403).json({ error: 'not_member' });
  const minutes = Number(req.body?.minutes ?? 0);
  const muteUntil = minutes > 0 ? Date.now() + minutes * 60 * 1000 : 0;
  db.prepare('UPDATE chat_members SET muted_until = ? WHERE chat_id = ? AND user_id = ?')
    .run(muteUntil, chatId, req.user.id);
  res.json({ ok: true, mutedUntil: muteUntil });
});

r.patch('/:id/nickname', (req, res) => {
  const chatId = Number(req.params.id);
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
  if (!member) return res.status(403).json({ error: 'not_member' });
  const nickname = String(req.body?.nickname ?? '').slice(0, 60) || null;
  db.prepare('UPDATE chat_members SET nickname = ? WHERE chat_id = ? AND user_id = ?')
    .run(nickname, chatId, req.user.id);
  res.json({ ok: true, nickname });
});

export function annotateMessage(m) {
  const reactions = db.prepare(
    `SELECT emoji, user_id FROM message_reactions WHERE message_id = ?`
  ).all(m.id);
  const grouped = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = [];
    grouped[r.emoji].push(r.user_id);
  }
  const attachments = db.prepare('SELECT * FROM attachments WHERE message_id = ?').all(m.id);
  return {
    id: m.id, chatId: m.chat_id, senderId: m.sender_id, replyTo: m.reply_to,
    kind: m.kind, text: m.text, mediaPath: m.media_path,
    mediaMeta: m.media_meta ? JSON.parse(m.media_meta) : null,
    editedAt: m.edited_at, deletedAt: m.deleted_at, createdAt: m.created_at,
    reactions: grouped, attachments,
  };
}

export default r;
