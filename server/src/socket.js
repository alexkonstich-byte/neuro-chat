import { Server } from 'socket.io';
import { db } from './db.js';
import { now } from './util.js';
import { awardXpForMessage, hasBannedWord, bumpFriendshipStreak } from './xp.js';
import { annotateMessage } from './routes/chats.js';
import { publicUser } from './routes/auth.js';

let ioRef = null;
export function getIO() { return ioRef; }

export function createSocketServer(httpServer, opts) {
  const io = new Server(httpServer, {
    cors: { origin: opts.origin, credentials: true },
    maxHttpBufferSize: 50 * 1024 * 1024,
  });
  ioRef = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('no_token'));
    const sess = db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, now());
    if (!sess) return next(new Error('bad_token'));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sess.user_id);
    if (!user || user.is_banned) return next(new Error('forbidden'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), user.id);

    // Pre-join all chats this user is part of
    const chats = db.prepare('SELECT chat_id FROM chat_members WHERE user_id = ?').all(user.id);
    for (const c of chats) socket.join(`chat:${c.chat_id}`);

    socket.broadcast.emit('presence', { userId: user.id, online: true });

    socket.on('disconnect', () => {
      db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), user.id);
      socket.broadcast.emit('presence', { userId: user.id, online: false });
    });

    // ---- Messaging ----
    socket.on('message:send', (payload, ack) => {
      try {
        const chatId = Number(payload?.chatId);
        const text = String(payload?.text || '').slice(0, 8000);
        const replyTo = payload?.replyTo ? Number(payload.replyTo) : null;
        const kind = String(payload?.kind || 'text');
        const attachmentIds = Array.isArray(payload?.attachmentIds) ? payload.attachmentIds.map(Number) : [];
        const mediaMeta = payload?.mediaMeta || null;

        const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, user.id);
        if (!member) return ack?.({ error: 'not_member' });
        if (kind === 'text' && !text && attachmentIds.length === 0) return ack?.({ error: 'empty' });

        const cInfo = db.prepare('SELECT type FROM chats WHERE id = ?').get(chatId);
        if (cInfo?.type === 'service') return ack?.({ error: 'service_readonly' });

        if (text && hasBannedWord(user.id, text)) return ack?.({ error: 'banned_word' });

        const t = now();
        const r1 = db.prepare(
          `INSERT INTO messages(chat_id, sender_id, reply_to, kind, text, media_meta, created_at)
           VALUES(?, ?, ?, ?, ?, ?, ?)`
        ).run(chatId, user.id, replyTo, kind, text || null, mediaMeta ? JSON.stringify(mediaMeta) : null, t);
        const messageId = Number(r1.lastInsertRowid);
        db.prepare('UPDATE chats SET last_message_at = ? WHERE id = ?').run(t, chatId);
        for (const aid of attachmentIds) {
          db.prepare('UPDATE attachments SET message_id = ? WHERE id = ? AND message_id IS NULL').run(messageId, aid);
        }

        // XP award (text only, anti-flood inside) — not for self-chat / service
        let xpGained = 0;
        const c = db.prepare('SELECT type FROM chats WHERE id = ?').get(chatId);
        if (kind === 'text' && text && !user.shadow_banned && c?.type !== 'self' && c?.type !== 'service') {
          xpGained = awardXpForMessage(user.id, text);
        }

        // Friendship streak in DMs only
        if (c?.type === 'dm') {
          const other = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ? AND user_id != ?').get(chatId, user.id);
          if (other) bumpFriendshipStreak(user.id, other.user_id);
        }

        const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
        const msg = annotateMessage(m);

        // If shadow-banned: only sender sees the message — others get nothing.
        if (user.shadow_banned) {
          socket.emit('message:new', { message: msg });
        } else {
          io.to(`chat:${chatId}`).emit('message:new', { message: msg });
        }

        ack?.({ ok: true, message: msg, xpGained });
      } catch (e) {
        console.error('[socket message:send]', e);
        ack?.({ error: 'server' });
      }
    });

    socket.on('message:edit', (payload, ack) => {
      const id = Number(payload?.id);
      const text = String(payload?.text || '').slice(0, 8000);
      const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
      if (!m || m.sender_id !== user.id) return ack?.({ error: 'not_owner' });
      if (hasBannedWord(user.id, text)) return ack?.({ error: 'banned_word' });
      db.prepare('UPDATE messages SET text = ?, edited_at = ? WHERE id = ?').run(text, now(), id);
      io.to(`chat:${m.chat_id}`).emit('message:edited', { id, text, editedAt: now() });
      ack?.({ ok: true });
    });

    socket.on('message:delete', (payload, ack) => {
      const id = Number(payload?.id);
      const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
      if (!m) return ack?.({ error: 'no_msg' });
      if (m.sender_id !== user.id && !user.is_admin) return ack?.({ error: 'not_owner' });
      db.prepare('UPDATE messages SET deleted_at = ?, text = NULL WHERE id = ?').run(now(), id);
      io.to(`chat:${m.chat_id}`).emit('message:deleted', { id });
      ack?.({ ok: true });
    });

    socket.on('message:react', (payload, ack) => {
      const id = Number(payload?.id);
      const emoji = String(payload?.emoji || '').slice(0, 8);
      const m = db.prepare('SELECT chat_id FROM messages WHERE id = ?').get(id);
      if (!m) return ack?.({ error: 'no_msg' });
      const exists = db.prepare('SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').get(id, user.id, emoji);
      if (exists) {
        db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(id, user.id, emoji);
      } else {
        db.prepare('INSERT INTO message_reactions(message_id, user_id, emoji, created_at) VALUES(?, ?, ?, ?)').run(id, user.id, emoji, now());
      }
      const all = db.prepare('SELECT emoji, user_id FROM message_reactions WHERE message_id = ?').all(id);
      const grouped = {};
      for (const r of all) (grouped[r.emoji] ||= []).push(r.user_id);
      io.to(`chat:${m.chat_id}`).emit('message:reactions', { id, reactions: grouped });
      ack?.({ ok: true });
    });

    socket.on('typing', ({ chatId, typing }) => {
      const m = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(Number(chatId), user.id);
      if (!m) return;
      socket.to(`chat:${chatId}`).emit('typing', { chatId: Number(chatId), userId: user.id, typing: !!typing });
    });

    socket.on('chat:join', ({ chatId }) => {
      const m = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(Number(chatId), user.id);
      if (m) socket.join(`chat:${Number(chatId)}`);
    });

    // ---- WebRTC signaling for voice/video calls ----
    socket.on('call:invite', ({ chatId, kind, sdp }) => {
      socket.to(`chat:${Number(chatId)}`).emit('call:incoming', {
        chatId: Number(chatId), fromUserId: user.id, fromUser: publicUser(user), kind, sdp,
      });
    });
    socket.on('call:accept', ({ toUserId, sdp }) => {
      io.to(`user:${Number(toUserId)}`).emit('call:accepted', { fromUserId: user.id, sdp });
    });
    socket.on('call:reject', ({ toUserId }) => {
      io.to(`user:${Number(toUserId)}`).emit('call:rejected', { fromUserId: user.id });
    });
    socket.on('call:ice', ({ toUserId, candidate }) => {
      io.to(`user:${Number(toUserId)}`).emit('call:ice', { fromUserId: user.id, candidate });
    });
    socket.on('call:hangup', ({ toUserId }) => {
      io.to(`user:${Number(toUserId)}`).emit('call:hangup', { fromUserId: user.id });
    });

    // ---- Group call signalling ----
    // Anyone in a group can start/join a call; we broadcast presence in chat:<id>:call room.
    socket.on('group-call:join', ({ chatId, kind }) => {
      const cid = Number(chatId);
      const m = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(cid, user.id);
      if (!m) return;
      socket.join(`callroom:${cid}`);
      // Tell existing members "I joined" — they will create offers to me.
      socket.to(`callroom:${cid}`).emit('group-call:peer-joined', {
        chatId: cid, peerUserId: user.id, peer: publicUser(user), kind,
      });
      // Also notify the chat that a call exists (so others see the "Join call" banner).
      socket.to(`chat:${cid}`).emit('group-call:active', { chatId: cid, kind, byUser: publicUser(user) });
    });

    socket.on('group-call:offer', ({ toUserId, sdp, chatId }) => {
      io.to(`user:${Number(toUserId)}`).emit('group-call:offer', { fromUserId: user.id, sdp, chatId: Number(chatId) });
    });
    socket.on('group-call:answer', ({ toUserId, sdp, chatId }) => {
      io.to(`user:${Number(toUserId)}`).emit('group-call:answer', { fromUserId: user.id, sdp, chatId: Number(chatId) });
    });
    socket.on('group-call:ice', ({ toUserId, candidate, chatId }) => {
      io.to(`user:${Number(toUserId)}`).emit('group-call:ice', { fromUserId: user.id, candidate, chatId: Number(chatId) });
    });
    socket.on('group-call:leave', ({ chatId }) => {
      const cid = Number(chatId);
      socket.leave(`callroom:${cid}`);
      socket.to(`callroom:${cid}`).emit('group-call:peer-left', { chatId: cid, peerUserId: user.id });
    });
  });

  return io;
}
