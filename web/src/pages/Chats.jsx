import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useChats } from '../store.js';
import { Avatar, NameLine } from '../components/UserChip.jsx';
import { IconButton, Tag, EmptyState, Sheet, Button, Input, Card, Field, PullToRefresh } from '../components/ui.jsx';

function formatTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
}
function sortChats(list) {
  const rank = (c) => c.type === 'self' ? 0 : c.type === 'service' ? 1 : 2;
  return [...list].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (b.lastMessageAt || 0) - (a.lastMessageAt || 0);
  });
}

export default function Chats() {
  const user = useAuth((s) => s.user);
  const list = useChats((s) => s.list);
  const load = useChats((s) => s.load);
  const online = useChats((s) => s.online);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [newOpen, setNewOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const activeChatId = (() => {
    const m = loc.pathname.match(/^\/chat\/(\d+)/);
    return m ? Number(m[1]) : null;
  })();

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    let cancel = false;
    api.searchUsers(q).then((r) => { if (!cancel) setResults(r.users); });
    return () => { cancel = true; };
  }, [q]);

  const startDm = async (u) => {
    const r = await api.openDM(u.id);
    nav(`/chat/${r.chatId}`);
  };

  return (
    <div className="h-full flex flex-col bg-ink-950">
      {/* HEADER */}
      <div className="safe-top sticky top-0 z-20 surface-strong border-b border-white/5 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Link to="/profile" className="press shrink-0" title="Профиль">
            <Avatar user={user} size={38} />
          </Link>
          <Link to="/settings" className="press shrink-0 w-10 h-10 grid place-items-center rounded-full hover:bg-white/10" title="Настройки">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10 1.5 V4 M10 16 V18.5 M1.5 10 H4 M16 10 H18.5 M3.7 3.7 L5.4 5.4 M14.6 14.6 L16.3 16.3 M3.7 16.3 L5.4 14.6 M14.6 5.4 L16.3 3.7"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </Link>
          <div className="flex-1 relative">
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск пользователей и чатов"
              className="w-full h-10 bg-ink-700/70 rounded-full pl-10 pr-3 text-sm outline-none border border-white/[0.06] focus:border-brand-indigo/60 focus:ring-2 focus:ring-brand-indigo/30 placeholder:text-white/40"
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M14 14 L11 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <IconButton onClick={() => setNewOpen(true)} title="Новый чат">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 3 V19 M3 11 H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </IconButton>
        </div>

        {/* Quick rail */}
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
          <Link to="/shop" className="press surface rounded-2xl py-2.5 text-center font-semibold">🛒 Магазин</Link>
          <Link to="/casino" className="press relative rounded-2xl py-2.5 text-center font-semibold text-white overflow-hidden">
            <div className="absolute inset-0 bg-casino-gradient gradient-bg" />
            <span className="relative">🎰 Казино</span>
          </Link>
          {user?.isAdmin
            ? <Link to="/admin" className="press relative rounded-2xl py-2.5 text-center font-semibold text-white overflow-hidden">
                <div className="absolute inset-0 bg-bad/70" />
                <span className="relative">⚙ Админ</span>
              </Link>
            : <Link to="/profile" className="press surface rounded-2xl py-2.5 text-center font-semibold">👤 Профиль</Link>}
        </div>
      </div>

      {/* SEARCH RESULTS */}
      {q.length >= 2 && (
        <div className="border-b border-white/5">
          {results.map((u) => (
            <button key={u.id} onClick={() => startDm(u)}
              className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] active:bg-white/[0.08] text-left">
              <Avatar user={u} size={42} />
              <div>
                <div className="font-semibold"><NameLine user={u} /></div>
                <div className="text-xs text-white/55 font-mono">@{u.username}</div>
              </div>
            </button>
          ))}
          {results.length === 0 && <div className="px-3 py-4 text-sm text-white/55">Ничего не найдено</div>}
        </div>
      )}

      {/* CHAT LIST */}
      <div className="flex-1 min-h-0">
       <PullToRefresh onRefresh={load}>
        {list.length === 0 ? (
          <EmptyState
            icon="💬"
            title="Пока тихо"
            hint="Найди друга через поиск или создай группу. Чат «Избранное» уже здесь — это твоё личное пространство."
            action={<Button onClick={() => setNewOpen(true)}>Новый чат</Button>}
          />
        ) : sortChats(list).map((c) => {
          const isSelf = c.type === 'self';
          const isService = c.type === 'service';
          const isGroup = c.type === 'group';
          const peerObj = c.peer || (isSelf ? { displayName: 'Избранное' } : { displayName: c.title });

          return (
            <Link key={c.id} to={`/chat/${c.id}`}
              className={`group press relative px-3 py-2.5 flex items-center gap-3 border-b border-white/[0.04] active:bg-white/[0.06] transition-colors ${activeChatId === c.id ? 'lg:bg-white/[0.06]' : 'lg:hover:bg-white/[0.03]'}`}>
              {/* active strip on left */}
              {activeChatId === c.id && (
                <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-[3px] bg-hero-gradient" />
              )}
              {/* unread dot strip */}
              {c.unread > 0 && activeChatId !== c.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-hero-gradient" />
              )}
              <div className="relative">
                {isSelf ? (
                  <div className="w-12 h-12 rounded-full bg-hero-gradient grid place-items-center text-2xl shadow-glow-brand">🔖</div>
                ) : isService ? (
                  <div className="w-12 h-12 rounded-full bg-premium-gradient grid place-items-center font-display text-xl font-black shadow-glow-premium">N</div>
                ) : isGroup ? (
                  <div className="w-12 h-12 rounded-full bg-ink-700 grid place-items-center text-xl">👥</div>
                ) : (
                  <Avatar user={peerObj} size={48} />
                )}
                {c.peer && online[c.peer.id] && !isService && !isSelf && (
                  <span className="online-dot absolute right-0 bottom-0 w-3 h-3 rounded-full bg-ok ring-2 ring-ink-950" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate flex items-center gap-1.5 min-w-0">
                    {isSelf
                      ? <span className="font-display font-semibold">Избранное</span>
                      : isService
                        ? <span className="font-display font-semibold">Allsafe</span>
                        : c.peer
                          ? <span className="truncate"><NameLine user={c.peer} /></span>
                          : <span className="font-display font-semibold truncate">{c.title}</span>}
                    {isService && <Tag tone="premium">бот</Tag>}
                    {c.streak?.fire && <span className="text-xs text-premium-amber font-semibold">🔥{c.streak.days}</span>}
                  </div>
                  <div className="text-[11px] text-white/45 shrink-0 font-mono">{formatTs(c.lastMessageAt)}</div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="text-sm text-white/55 truncate">
                    {c.lastMessage?.text || (c.lastMessage ? `[${c.lastMessage.kind}]` : 'Откройте чат')}
                  </div>
                  {c.unread > 0 && (
                    <span className="text-[11px] font-bold bg-hero-gradient text-white rounded-full px-2 py-0.5 shrink-0 shadow-glow-brand">{c.unread}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
       </PullToRefresh>
      </div>

      {/* New chat sheet */}
      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="Новый чат">
        <div className="p-2 space-y-1.5">
          <button onClick={() => { setNewOpen(false); document.querySelector('input[placeholder^="Поиск"]')?.focus(); }}
            className="w-full press surface rounded-2xl px-4 py-3 flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-full bg-brand-indigo/20 grid place-items-center text-xl">💬</div>
            <div>
              <div className="font-semibold">Личный чат</div>
              <div className="text-xs text-white/55">Найти пользователя по имени или @username</div>
            </div>
          </button>
          <button onClick={() => { setNewOpen(false); setGroupOpen(true); }}
            className="w-full press surface rounded-2xl px-4 py-3 flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-full bg-brand-fuchsia/20 grid place-items-center text-xl">👥</div>
            <div>
              <div className="font-semibold">Группа</div>
              <div className="text-xs text-white/55">До 200 участников. Голосовые комнаты.</div>
            </div>
          </button>
        </div>
      </Sheet>

      <CreateGroupSheet open={groupOpen} onClose={() => setGroupOpen(false)} onCreated={(id) => { setGroupOpen(false); nav(`/chat/${id}`); }} />
    </div>
  );
}

function CreateGroupSheet({ open, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setTitle(''); setQ(''); setResults([]); setPicked([]); } }, [open]);
  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    let cancel = false;
    api.searchUsers(q).then((r) => { if (!cancel) setResults(r.users); });
    return () => { cancel = true; };
  }, [q]);

  const toggle = (u) => setPicked((p) => p.find((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await api.createGroup(title.trim(), picked.map((p) => p.id));
      onCreated?.(r.chatId);
    } catch (e) {
      alert('Ошибка: ' + (e?.data?.error || e.message));
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Новая группа">
      <div className="p-3 space-y-3">
        <Field label="Название группы">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Друзья" />
        </Field>
        <Field label="Добавить участников">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="поиск по @username" />
        </Field>
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((u) => (
              <button key={u.id} onClick={() => toggle(u)}
                className="press inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-brand-indigo/20 border border-brand-indigo/40 text-sm">
                <Avatar user={u} size={20} ring={false} />
                {u.displayName}
                <span className="opacity-60 ml-1">×</span>
              </button>
            ))}
          </div>
        )}
        {results.length > 0 && (
          <Card className="!p-1.5 max-h-60 overflow-y-auto">
            {results.map((u) => {
              const inGroup = picked.find((p) => p.id === u.id);
              return (
                <button key={u.id} onClick={() => toggle(u)}
                  className={`w-full press rounded-xl px-2.5 py-2 flex items-center gap-3 ${inGroup ? 'bg-brand-indigo/15' : 'hover:bg-white/5'}`}>
                  <Avatar user={u} size={32} />
                  <div className="text-left">
                    <div className="text-sm font-semibold"><NameLine user={u} /></div>
                    <div className="text-xs text-white/55 font-mono">@{u.username}</div>
                  </div>
                  <div className="ml-auto">{inGroup ? '✓' : '＋'}</div>
                </button>
              );
            })}
          </Card>
        )}
        <Button disabled={busy || !title.trim()} onClick={create} className="w-full h-12">
          {busy ? 'Создаём…' : `Создать${picked.length ? ` (+${picked.length})` : ''}`}
        </Button>
      </div>
    </Sheet>
  );
}
