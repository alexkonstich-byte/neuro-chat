import { create } from 'zustand';
import { api, auth } from './api.js';

export const useAuth = create((set) => ({
  user: null,
  loading: true,
  async load() {
    if (!auth.get()) { set({ user: null, loading: false }); return; }
    try { const r = await api.me(); set({ user: r.user, loading: false }); }
    catch { auth.clear(); set({ user: null, loading: false }); }
  },
  setUser: (user) => set({ user }),
  logout: async () => { try { await api.logout(); } catch {} auth.clear(); set({ user: null }); location.href = '/'; },
}));

export const useChats = create((set, get) => ({
  list: [],
  byId: {},
  online: {}, // userId -> bool
  typing: {}, // chatId -> { userId: ts }
  async load() {
    const r = await api.chats();
    const byId = {};
    for (const c of r.chats) byId[c.id] = c;
    set({ list: r.chats, byId });
  },
  setPresence(userId, online) {
    set((s) => ({ online: { ...s.online, [userId]: online } }));
  },
  setTyping(chatId, userId, on) {
    set((s) => {
      const cur = { ...(s.typing[chatId] || {}) };
      if (on) cur[userId] = Date.now();
      else delete cur[userId];
      return { typing: { ...s.typing, [chatId]: cur } };
    });
  },
  bumpChatLast(chatId, message) {
    set((s) => {
      const list = s.list.slice();
      const idx = list.findIndex((c) => c.id === chatId);
      if (idx >= 0) {
        const c = { ...list[idx], lastMessage: message, lastMessageAt: message.createdAt };
        list.splice(idx, 1);
        list.unshift(c);
      }
      const byId = { ...s.byId };
      if (byId[chatId]) byId[chatId] = { ...byId[chatId], lastMessage: message, lastMessageAt: message.createdAt };
      return { list, byId };
    });
  },
}));

export const useMessages = create((set, get) => ({
  byChat: {}, // chatId -> Message[]
  setHistory(chatId, msgs) {
    set((s) => ({ byChat: { ...s.byChat, [chatId]: msgs } }));
  },
  prepend(chatId, msgs) {
    set((s) => ({ byChat: { ...s.byChat, [chatId]: [...msgs, ...(s.byChat[chatId] || [])] } }));
  },
  add(chatId, msg) {
    set((s) => ({ byChat: { ...s.byChat, [chatId]: [...(s.byChat[chatId] || []), msg] } }));
  },
  edit(chatId, id, patch) {
    set((s) => ({
      byChat: {
        ...s.byChat,
        [chatId]: (s.byChat[chatId] || []).map((m) => m.id === id ? { ...m, ...patch } : m),
      },
    }));
  },
  remove(chatId, id) {
    set((s) => ({
      byChat: {
        ...s.byChat,
        [chatId]: (s.byChat[chatId] || []).map((m) => m.id === id ? { ...m, deletedAt: Date.now(), text: null } : m),
      },
    }));
  },
}));
