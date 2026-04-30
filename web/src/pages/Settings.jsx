import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, toast } from '../store.js';
import { BackButton, Button, Card, Tag, Field, Input, PasswordInput, Section, PageHeader } from '../components/ui.jsx';

const THEMES = [
  { key: 'midnight',  name: 'Midnight', desc: 'Глубокая полночь · текущая',     swatch: 'from-[#0B0D14] via-[#1B1E2B] to-[#3A3F55]' },
  { key: 'aurora',    name: 'Aurora',   desc: 'Фиолетовое сияние',              swatch: 'from-[#1a0b2e] via-[#5b2880] to-[#c56bff]' },
  { key: 'sunset',    name: 'Sunset',   desc: 'Тёплый закат',                   swatch: 'from-[#241016] via-[#a13654] to-[#ffb13b]' },
  { key: 'ocean',     name: 'Ocean',    desc: 'Океанский градиент',             swatch: 'from-[#08151f] via-[#0e6e99] to-[#65deff]' },
  { key: 'mono',      name: 'Mono',    desc: 'Графит без цвета',                swatch: 'from-[#0a0a0a] via-[#1a1a1a] to-[#3a3a3a]' },
  { key: 'daylight',  name: 'Daylight', desc: 'Светлая (бета)',                 swatch: 'from-[#f5f6fa] via-[#dfe3ee] to-[#a3aec5]', light: true },
];

export default function Settings() {
  const me = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();
  const [adminSettings, setAdminSettings] = useState([]);

  useEffect(() => {
    // best-effort fetch of XP rate (admin endpoint, but we want the value if available)
    api.adminSettings?.().then((r) => setAdminSettings(r.settings)).catch(() => {});
  }, []);

  const xpPerMessage = adminSettings.find((s) => s.key === 'xp_per_message')?.value;

  const setTheme = async (theme) => {
    // Optimistic: apply right away so the user sees it instantly.
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('neuro_theme', theme);
    try {
      const r = await api.patchMe({ theme });
      setUser(r.user);
      toast.ok('Тема обновлена');
    } catch (e) { toast.bad('Не удалось сохранить — но тема применена'); }
  };

  return (
    <div className="min-h-full bg-ink-950">
      <PageHeader left={<BackButton onClick={() => nav(-1)} />} title="Настройки" subtitle="Темы, безопасность, сессии" />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <Section>Внешний вид</Section>
        <Card>
          <div className="text-sm font-semibold mb-2">Тема оформления</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEMES.map((t) => {
              const active = (me?.theme || 'midnight') === t.key;
              return (
                <button key={t.key} onClick={() => setTheme(t.key)}
                  className={`press text-left rounded-2xl p-2.5 border transition ${active ? 'border-brand-indigo/60' : 'border-white/10 hover:border-white/30'}`}>
                  <div className={`h-16 rounded-xl bg-gradient-to-br ${t.swatch} mb-2 ${active ? 'shadow-glow-brand' : ''}`} />
                  <div className="font-display text-sm flex items-center gap-1.5">{t.name} {active && <span className="text-xs text-brand-sky">✓</span>}</div>
                  <div className="text-[11px] text-white/55">{t.desc}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[11px] text-white/45">Палитра меняется мгновенно. Ноды используют CSS-переменные из <span className="font-mono">--brand-*</span> и <span className="font-mono">--bg-*</span>.</div>
        </Card>

        <Section>Опыт</Section>
        <Card className="!p-4 flex items-center justify-between">
          <div>
            <div className="font-semibold">XP за сообщение</div>
            <div className="text-xs text-white/55">Сейчас за каждое сообщение начисляется ниже.</div>
          </div>
          <Tag tone="brand">{xpPerMessage || '—'} XP</Tag>
        </Card>
        <Card className="!p-4 flex items-center justify-between">
          <div>
            <div className="font-semibold">Видимость XP</div>
            <div className="text-xs text-white/55">Показывать твой опыт другим в профиле.</div>
          </div>
          <ToggleSwitch checked={!!me?.xpVisible} onChange={async (v) => {
            const r = await api.patchMe({ xpVisible: v });
            setUser(r.user);
            toast.ok(v ? 'Виден всем' : 'Скрыт');
          }} />
        </Card>

        <Section>Безопасность</Section>
        <IssueCodePanel />
        <ChangePasswordPanel />
        <SessionsPanel />

        <Button variant="danger" onClick={logout} className="w-full">Выйти из аккаунта</Button>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`press relative w-12 h-7 rounded-full transition ${checked ? 'bg-hero-gradient' : 'bg-ink-700'}`}>
      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
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
      toast.ok('Пароль обновлён');
    } catch (e) { toast.bad(e?.data?.error || 'Ошибка'); }
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
          <PasswordInput placeholder="Текущий пароль" value={oldP} onChange={(e) => setOld(e.target.value)} />
          <PasswordInput placeholder="Новый пароль (мин. 6)" value={newP} onChange={(e) => setNew(e.target.value)} />
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
