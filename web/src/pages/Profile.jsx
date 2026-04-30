import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, toast } from '../store.js';
import { Avatar, NameLine, ProfileBackground } from '../components/UserChip.jsx';
import { BackButton, IconButton, Button, Card, Tag, Field, Input, Section, PageHeader } from '../components/ui.jsx';
import { resizeImageFile } from '../utils/image.js';

export default function Profile() {
  const { username } = useParams();
  const me = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const [user, setLocal] = useState(username ? null : me);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const fileRef = useRef(null);
  const videoFileRef = useRef(null);
  const nav = useNavigate();
  const isMe = !username || username === me?.username;
  const myCanVideo = isMe && (me?.isPremium || me?.isVip);

  useEffect(() => {
    if (!username) { setLocal(me); return; }
    api.userByUsername(username).then((r) => setLocal(r.user)).catch(() => setLocal(null));
  }, [username, me]);

  if (!user) return <div className="p-6 text-white/55">Загрузка…</div>;

  const startEdit = () => {
    setForm({
      displayName: user.displayName || '', bio: user.bio || '', username: user.username || '',
      xpVisible: user.xpVisible ?? true, prefixText: user.prefixText || '',
      prefixColor: user.prefixColor || '', nickColor: user.nickColor || '', customEmoji: user.customEmoji || '',
      statusEmoji: user.statusEmoji || '', statusText: user.statusText || '',
      birthday: user.birthday || '', phone: user.phone || '',
    });
    setEditing(true);
  };

  const save = async () => {
    try {
      const r = await api.patchMe(form);
      setUser(r.user); setLocal(r.user); setEditing(false);
    } catch (e) {
      alert('Ошибка: ' + (e?.data?.error || e.message));
    }
  };

  const upAvatar = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      let payload;
      if (f.type.startsWith('image/gif') || f.type.startsWith('image/webp')) {
        // Animated images go up untouched (resize would kill the animation).
        payload = f;
      } else {
        payload = await resizeImageFile(f, { maxSide: 512, minSide: 64, quality: 0.9, type: 'image/jpeg' });
      }
      await api.uploadAvatar(payload);
      const fresh = (await api.me()).user;
      setUser(fresh); setLocal(fresh);
      toast.ok('Аватар обновлён');
    } catch (err) {
      toast.bad('Не удалось загрузить аватар', err.message);
    }
  };

  const upVideoAvatar = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!(me?.isPremium || me?.isVip)) {
      toast.bad('Видео-аватар доступен только Premium / VIP');
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.bad('Видео слишком большое', 'Максимум 8 МБ');
      return;
    }
    // Quick duration check via a hidden video element.
    const dur = await new Promise((res) => {
      const v = document.createElement('video');
      v.preload = 'metadata'; v.src = URL.createObjectURL(f);
      v.onloadedmetadata = () => { res(v.duration || 0); URL.revokeObjectURL(v.src); };
      v.onerror = () => res(0);
    });
    if (dur > 5.5) {
      toast.bad('Слишком длинное видео', 'Максимум 5 секунд');
      return;
    }
    try {
      await api.uploadAvatar(f, 'avatar-video');
      const fresh = (await api.me()).user;
      setUser(fresh); setLocal(fresh);
      toast.brand('Видео-аватар обновлён', 'Пол секунды любви для всех чатов');
    } catch (err) {
      toast.bad('Не удалось загрузить видео', err?.data?.error || err.message);
    }
  };

  const dropVideoAvatar = async () => {
    try {
      await api.dropVideoAvatar();
      const fresh = (await api.me()).user;
      setUser(fresh); setLocal(fresh);
      toast.ok('Видео-аватар снят');
    } catch (e) { toast.bad('Не удалось'); }
  };

  const startDm = async () => {
    const r = await api.openDM(user.id);
    nav(`/chat/${r.chatId}`);
  };

  return (
    <div className="min-h-full bg-ink-950">
      {/* Hero header */}
      <ProfileBackground code={user.activeBg} className="pt-12 pb-12 safe-top">
        <div className="absolute inset-0 bg-ink-950/40" />

        {/* Top bar */}
        <div className="relative px-2 flex items-center justify-between">
          <BackButton onClick={() => nav(-1)} />
          {isMe && (
            <button onClick={logout} className="press text-xs px-3 py-1.5 rounded-full bg-white/10 border border-white/15">Выйти</button>
          )}
        </div>

        <div className="relative flex flex-col items-center text-center text-white px-6 mt-2">
          <button onClick={() => isMe ? fileRef.current.click() : null} className="press relative">
            <Avatar user={user} size={108} />
            {isMe && (
              <span className="absolute -bottom-1 right-1 w-7 h-7 rounded-full bg-ink-950/85 grid place-items-center text-xs ring-2 ring-white/10">📷</span>
            )}
          </button>
          <input ref={fileRef} type="file" hidden accept="image/*" onChange={upAvatar} />
          <input ref={videoFileRef} type="file" hidden accept="video/mp4,video/webm" onChange={upVideoAvatar} />
          {myCanVideo && (
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <button onClick={() => videoFileRef.current.click()}
                className="press px-2.5 py-1 rounded-full bg-premium-amber/15 text-premium-amber border border-premium-amber/40">
                {user.videoAvatar ? '🎬 Заменить видео-аватар' : '🎬 Загрузить видео-аватар'}
              </button>
              {user.videoAvatar && (
                <button onClick={dropVideoAvatar} className="press px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15">снять</button>
              )}
            </div>
          )}
          {isMe && !myCanVideo && (
            <div className="mt-2 text-[11px] text-white/55">Видео-аватар — для Premium / VIP</div>
          )}
          <div className="mt-4 font-display text-3xl"><NameLine user={user} /></div>
          {user.username && <div className="text-sm text-white/75 font-mono mt-0.5">@{user.username}</div>}
          {user.bio && <div className="mt-3 text-sm max-w-sm text-white/85">{user.bio}</div>}
          {(user.birthday || user.phone) && (
            <div className="mt-2 text-xs text-white/60 font-mono flex gap-3 flex-wrap justify-center">
              {user.birthday && <span>🎂 {formatBday(user.birthday)}</span>}
              {user.phone && isMe && <span>📞 {user.phone}</span>}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
            {user.isPremium && <Tag tone="premium">✦ Allsafe Premium</Tag>}
            {user.isAdmin && <Tag tone="brand">админ</Tag>}
            {user.xp != null && <Tag>XP · {user.xp.toLocaleString()}</Tag>}
            {isMe && me.neurons > 0 && <Tag tone="brand">🧠 {me.neurons}</Tag>}
          </div>
        </div>
      </ProfileBackground>

      <div className="px-4 -mt-6 relative z-10">
        {!isMe && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Button onClick={startDm} className="h-12">💬 Написать</Button>
            <Button variant="ghost" onClick={() => location.assign('/')} className="h-12">К чатам</Button>
          </div>
        )}
        {(user.statusText || user.statusEmoji) && (
          <Card className="!p-3 mb-3 flex items-center gap-2.5">
            {user.statusEmoji && <div className="text-xl">{user.statusEmoji}</div>}
            <div className="text-sm text-white/80">{user.statusText}</div>
          </Card>
        )}
      </div>

      {isMe && (
        <div className="px-4 pb-10 space-y-3">
          {/* XP visibility toggle */}
          <Card className="!p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">Опыт виден другим</div>
              <div className="text-xs text-white/55">Если выключено — XP виден только тебе.</div>
            </div>
            <Toggle checked={!!me.xpVisible} onChange={async (v) => {
              const r = await api.patchMe({ xpVisible: v });
              setUser(r.user); setLocal(r.user);
            }} />
          </Card>

          {!editing ? (
            <Button variant="ghost" onClick={startEdit} className="w-full">Редактировать профиль</Button>
          ) : (
            <Card className="space-y-3">
              <Field label="Имя"><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
              <Field label="Username"><Input className="font-mono" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
              <Field label="О себе">
                <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={2} className="w-full bg-ink-800 rounded-xl border border-white/[0.06] px-3 py-2 outline-none focus:border-brand-indigo/60" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Дата рождения">
                  <Input type="date" value={form.birthday || ''} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
                </Field>
                <Field label="Телефон">
                  <Input type="tel" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7..." />
                </Field>
              </div>
              <Field label="Статус (эмодзи + текст)" hint="Появится у твоего ника и в шапке профиля.">
                <div className="flex gap-2">
                  <Input value={form.statusEmoji || ''} onChange={(e) => setForm({ ...form, statusEmoji: e.target.value.slice(0, 4) })}
                    maxLength={4} className="w-16 text-center text-xl" placeholder="🎵" />
                  <Input value={form.statusText || ''} onChange={(e) => setForm({ ...form, statusText: e.target.value.slice(0, 80) })}
                    maxLength={80} className="flex-1" placeholder="Слушаю музыку" />
                </div>
              </Field>
              <Field label="Префикс перед ником" hint="Нужен слот префикса из магазина.">
                <Input value={form.prefixText} onChange={(e) => setForm({ ...form, prefixText: e.target.value })} maxLength={12} />
              </Field>

              <Section>Premium-only</Section>
              <div className="grid grid-cols-3 gap-2">
                <ColorField label="Ник" value={form.nickColor} onChange={(v) => setForm({ ...form, nickColor: v })} disabled={!me.isPremium} />
                <ColorField label="Префикс" value={form.prefixColor} onChange={(v) => setForm({ ...form, prefixColor: v })} disabled={!me.isPremium} />
                <Field label="Эмодзи">
                  <Input disabled={!me.isPremium} value={form.customEmoji} maxLength={4}
                    onChange={(e) => setForm({ ...form, customEmoji: e.target.value })} placeholder="🐉"
                    className="text-center text-xl" />
                </Field>
              </div>

              <div className="flex gap-2">
                <Button onClick={save} className="flex-1">Сохранить</Button>
                <Button variant="ghost" onClick={() => setEditing(false)} className="flex-1">Отмена</Button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Link to="/shop" className="press surface rounded-2xl py-3.5 text-center font-semibold">🛒 Магазин</Link>
            <Link to="/casino" className="press relative rounded-2xl py-3.5 text-center font-semibold overflow-hidden">
              <div className="absolute inset-0 bg-casino-gradient gradient-bg" />
              <span className="relative">🎰 Казино</span>
            </Link>
          </div>

          <IssueCodePanel />
          <ChangePasswordPanel />
          <SessionsPanel />
        </div>
      )}
    </div>
  );
}

function formatBday(iso) {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
    return `${d} ${months[m - 1]} ${y}`;
  } catch { return iso; }
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`press relative w-12 h-7 rounded-full transition ${checked ? 'bg-hero-gradient' : 'bg-ink-700'}`}>
      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function ColorField({ label, value, onChange, disabled }) {
  return (
    <Field label={`${label}${disabled ? ' (Premium)' : ''}`}>
      <div className={`h-12 rounded-xl bg-ink-800 border border-white/[0.06] flex items-center px-2 gap-2 ${disabled ? 'opacity-50' : ''}`}>
        <input type="color" disabled={disabled} value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer" />
        <code className="text-xs font-mono text-white/70">{value || 'auto'}</code>
        {value && <button onClick={() => onChange('')} className="ml-auto text-xs text-white/55 hover:text-white">×</button>}
      </div>
    </Field>
  );
}

function IssueCodePanel() {
  const [code, setCode] = useState(null);
  const [exp, setExp] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const issue = async () => { const r = await api.issueLoginCode(); setCode(r.code); setExp(r.expiresAt); };
  const remaining = Math.max(0, exp - now);
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="text-2xl">🔐</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">Войти на другом устройстве</div>
          <div className="text-xs text-white/55 mt-0.5">Одноразовый код, действует 5 минут. Также придёт в чат Allsafe.</div>
        </div>
      </div>
      {code && remaining > 0 ? (
        <div className="mt-3 text-center bg-ink-800 rounded-xl py-4 border border-brand-indigo/30">
          <div className="text-3xl font-mono tracking-[0.4em] text-brand bg-clip-text text-transparent bg-hero-gradient">{code}</div>
          <div className="text-xs text-white/55 mt-1">истекает через {Math.ceil(remaining / 1000)} с</div>
        </div>
      ) : (
        <Button variant="ghost" onClick={issue} className="w-full mt-3">Сгенерировать код</Button>
      )}
    </Card>
  );
}

function ChangePasswordPanel() {
  const [open, setOpen] = useState(false);
  const [oldP, setOld] = useState('');
  const [newP, setNew] = useState('');
  const submit = async () => {
    try {
      await api.changePassword(oldP, newP);
      setOpen(false); setOld(''); setNew('');
      alert('Пароль обновлён');
    } catch (e) { alert(e?.data?.error || 'Ошибка'); }
  };
  return (
    <Card>
      <button onClick={() => setOpen(!open)} className="w-full text-left flex items-center gap-3">
        <div className="text-2xl">🔑</div>
        <div className="flex-1">
          <div className="font-semibold">Смена пароля</div>
          <div className="text-xs text-white/55">Безопасность аккаунта</div>
        </div>
        <div className={`text-white/55 transition ${open ? 'rotate-90' : ''}`}>›</div>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <Input type="password" placeholder="Текущий пароль" value={oldP} onChange={(e) => setOld(e.target.value)} />
          <Input type="password" placeholder="Новый пароль (мин. 6)" value={newP} onChange={(e) => setNew(e.target.value)} />
          <Button onClick={submit} className="w-full">Сохранить</Button>
        </div>
      )}
    </Card>
  );
}

function SessionsPanel() {
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(null);
  const load = () => api.sessions().then((r) => { setSessions(r.sessions); setCurrent(r.current); });
  useEffect(() => { load(); }, []);
  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-2xl">📱</div>
        <div className="flex-1">
          <div className="font-semibold">Активные сессии</div>
          <div className="text-xs text-white/55">{sessions.length} устройств</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {sessions.map((s) => (
          <div key={s.token} className="flex items-center justify-between gap-2 bg-ink-800 rounded-xl px-3 py-2 text-sm border border-white/[0.04]">
            <div className="min-w-0">
              <div className="truncate">{s.user_agent?.slice(0, 40) || 'неизвестно'}</div>
              <div className="text-white/45 text-xs font-mono">{s.ip || '—'} · {new Date(s.last_seen_at).toLocaleString()}</div>
            </div>
            {s.token === current ? (
              <Tag tone="ok">текущая</Tag>
            ) : (
              <button onClick={async () => { await api.killSession(s.token); load(); }} className="text-xs text-bad hover:underline">Завершить</button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
