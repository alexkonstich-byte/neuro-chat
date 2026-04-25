import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useChats, useMessages } from './store.js';
import { getSocket, destroySocket } from './socket.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Info from './pages/Info.jsx';
import Chat from './pages/Chat.jsx';
import Profile from './pages/Profile.jsx';
import Shop from './pages/Shop.jsx';
import Casino from './pages/Casino.jsx';
import Admin from './pages/Admin.jsx';
import AppShell, { DesktopEmpty } from './AppShell.jsx';

function Guarded({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="h-full flex items-center justify-center">Загрузка…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

function SocketBridge() {
  const setPresence = useChats((s) => s.setPresence);
  const setTyping = useChats((s) => s.setTyping);
  const bumpChat = useChats((s) => s.bumpChatLast);
  const addMsg = useMessages((s) => s.add);
  const editMsg = useMessages((s) => s.edit);
  const removeMsg = useMessages((s) => s.remove);
  const setUser = useAuth((s) => s.setUser);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { destroySocket(); return; }
    const s = getSocket();
    s.on('presence', ({ userId, online }) => setPresence(userId, online));
    s.on('typing', ({ chatId, userId, typing }) => setTyping(chatId, userId, typing));
    s.on('message:new', ({ message }) => {
      addMsg(message.chatId, message);
      bumpChat(message.chatId, message);
    });
    s.on('message:edited', ({ id, text, editedAt }) => {
      // we don't know chatId here without lookup, but our store will iterate per-chat outside
      const ms = useMessages.getState().byChat;
      for (const cid of Object.keys(ms)) {
        if (ms[cid].some(m => m.id === id)) editMsg(Number(cid), id, { text, editedAt });
      }
    });
    s.on('message:deleted', ({ id }) => {
      const ms = useMessages.getState().byChat;
      for (const cid of Object.keys(ms)) {
        if (ms[cid].some(m => m.id === id)) removeMsg(Number(cid), id);
      }
    });
    s.on('message:reactions', ({ id, reactions }) => {
      const ms = useMessages.getState().byChat;
      for (const cid of Object.keys(ms)) {
        if (ms[cid].some(m => m.id === id)) editMsg(Number(cid), id, { reactions });
      }
    });
    s.on('call:incoming', (payload) => {
      window.dispatchEvent(new CustomEvent('neuro-call:incoming', { detail: payload }));
    });
    s.on('chat:added', () => {
      // A new chat (group, etc.) appeared — refresh the chat list.
      import('./store.js').then(({ useChats }) => useChats.getState().load());
    });
    return () => {
      s.removeAllListeners('presence');
      s.removeAllListeners('typing');
      s.removeAllListeners('message:new');
      s.removeAllListeners('message:edited');
      s.removeAllListeners('message:deleted');
      s.removeAllListeners('message:reactions');
      s.removeAllListeners('call:incoming');
      s.removeAllListeners('chat:added');
    };
  }, [user?.id]);

  return null;
}

export default function App() {
  const load = useAuth((s) => s.load);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      <SocketBridge />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/info" element={<Info />} />
        <Route element={<Guarded><AppShell /></Guarded>}>
          <Route path="/" element={<DesktopEmpty />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/casino" element={<Casino />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
