const TOKEN_KEY = 'neuro_token';

export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const t = auth.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, { ...opts, headers });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw Object.assign(new Error(data?.error || 'http_error'), { status: res.status, data });
  return data;
}

export const api = {
  // auth
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  loginByCode: (username, code) => request('/api/auth/login-by-code', { method: 'POST', body: JSON.stringify({ username, code }) }),
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  issueLoginCode: () => request('/api/auth/issue-code', { method: 'POST' }),
  changePassword: (oldPassword, newPassword) => request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),
  me: () => request('/api/auth/me'),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  sessions: () => request('/api/auth/sessions'),
  killSession: (token) => request(`/api/auth/sessions/${token}`, { method: 'DELETE' }),

  // profile
  patchMe: (body) => request('/api/profile/me', { method: 'PATCH', body: JSON.stringify(body) }),
  userByUsername: (u) => request(`/api/profile/by-username/${encodeURIComponent(u)}`),
  userById: (id) => request(`/api/profile/by-id/${id}`),
  searchUsers: (q) => request(`/api/profile/search?q=${encodeURIComponent(q)}`),

  // chats
  chats: () => request('/api/chats'),
  openDM: (userId) => request('/api/chats/dm', { method: 'POST', body: JSON.stringify({ userId }) }),
  createGroup: (title, memberIds) => request('/api/chats/group', { method: 'POST', body: JSON.stringify({ title, memberIds }) }),
  addMembers: (chatId, userIds) => request(`/api/chats/${chatId}/members`, { method: 'POST', body: JSON.stringify({ userIds }) }),
  removeMember: (chatId, userId) => request(`/api/chats/${chatId}/members/${userId}`, { method: 'DELETE' }),
  chat: (id) => request(`/api/chats/${id}`),
  history: (id, before) => request(`/api/chats/${id}/messages${before ? `?before=${before}` : ''}`),
  read: (id) => request(`/api/chats/${id}/read`, { method: 'POST' }),

  // shop
  shopItems: () => request('/api/shop/items'),
  inventory: () => request('/api/shop/inventory'),
  buy: (code) => request('/api/shop/buy', { method: 'POST', body: JSON.stringify({ code }) }),
  refund: (txId) => request(`/api/shop/refund/${txId}`, { method: 'POST' }),
  equip: (code, slot) => request('/api/shop/equip', { method: 'POST', body: JSON.stringify({ code, slot }) }),
  transactions: () => request('/api/shop/transactions'),

  // casino
  spin: (bet) => request('/api/casino/spin', { method: 'POST', body: JSON.stringify({ bet }) }),
  leaderboard: (period = 'week') => request(`/api/casino/leaderboard?period=${period}`),
  recentSpins: () => request('/api/casino/recent'),

  // admin
  adminSettings: () => request('/api/admin/settings'),
  adminSetSetting: (key, value) => request('/api/admin/settings', { method: 'POST', body: JSON.stringify({ key, value }) }),
  adminUsers: (q = '') => request(`/api/admin/users?q=${encodeURIComponent(q)}`),
  adminGiveXp: (id, delta, note) => request(`/api/admin/users/${id}/xp`, { method: 'POST', body: JSON.stringify({ delta, note }) }),
  adminGiveNeurons: (id, delta, note) => request(`/api/admin/users/${id}/neurons`, { method: 'POST', body: JSON.stringify({ delta, note }) }),
  adminGivePremium: (id, days) => request(`/api/admin/users/${id}/premium`, { method: 'POST', body: JSON.stringify({ days }) }),
  adminBan: (id, banned) => request(`/api/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ banned }) }),
  adminShadow: (id, shadow) => request(`/api/admin/users/${id}/shadow`, { method: 'POST', body: JSON.stringify({ shadow }) }),
  adminBannedWords: () => request('/api/admin/banned-words'),
  adminAddBannedWord: (word, scope, targetUserId) => request('/api/admin/banned-words', { method: 'POST', body: JSON.stringify({ word, scope, targetUserId }) }),
  adminDelBannedWord: (id) => request(`/api/admin/banned-words/${id}`, { method: 'DELETE' }),
  adminExclusiveItems: () => request('/api/admin/exclusive-items'),
  adminAddExclusive: (body) => request('/api/admin/exclusive-items', { method: 'POST', body: JSON.stringify(body) }),
  adminGrantItem: (userId, code) => request('/api/admin/grant-item', { method: 'POST', body: JSON.stringify({ userId, code }) }),

  // uploads
  uploadFile: (file, kind = 'file') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    return fetch('/api/uploads/file', {
      method: 'POST', body: fd,
      headers: { Authorization: `Bearer ${auth.get()}` },
    }).then(r => r.json());
  },
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return fetch('/api/uploads/avatar', {
      method: 'POST', body: fd,
      headers: { Authorization: `Bearer ${auth.get()}` },
    }).then(r => r.json());
  },
};
