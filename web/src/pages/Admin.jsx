import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { BackButton, Button, Card, Tag, Field, Input, Section, PageHeader } from '../components/ui.jsx';

export default function Admin() {
  const [tab, setTab] = useState('users');
  const tabs = [
    { id: 'users', label: 'Пользователи', icon: '👥' },
    { id: 'settings', label: 'Настройки', icon: '⚙' },
    { id: 'words', label: 'Банвордс', icon: '🚫' },
    { id: 'exclusive', label: 'Эксклюзив', icon: '✦' },
  ];
  return (
    <div className="min-h-full bg-ink-950">
      <PageHeader left={<BackButton to="/" />} title="⚙ Админ-панель" />
      <div className="px-3 py-3 grid grid-cols-4 gap-1.5 sticky top-[60px] z-10 bg-ink-950/95 backdrop-blur-sm">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`press py-2.5 rounded-2xl text-xs font-semibold flex flex-col items-center gap-0.5 ${tab === t.id ? 'bg-hero-gradient shadow-glow-brand' : 'bg-ink-700'}`}>
            <span className="text-base">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="px-3 pb-10">
        {tab === 'users' && <UsersTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'words' && <WordsTab />}
        {tab === 'exclusive' && <ExclusiveTab />}
      </div>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const load = () => api.adminUsers(q).then((r) => setUsers(r.users));
  useEffect(() => { load(); }, []);
  const action = async (fn, ...args) => { await fn(...args); load(); };
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" />
        <Button onClick={load}>Найти</Button>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-display font-bold">{u.display_name}</span>
                  <span className="text-white/55 font-mono text-xs">@{u.username}</span>
                  {u.is_admin ? <Tag tone="bad">админ</Tag> : null}
                  {u.is_banned ? <Tag tone="bad">бан</Tag> : null}
                  {u.shadow_banned ? <Tag tone="warn">shadow</Tag> : null}
                  {u.premium_until > Date.now() ? <Tag tone="premium">premium</Tag> : null}
                </div>
                <div className="text-xs text-white/55 font-mono mt-1">XP {u.xp} · 🧠 {u.neurons} · {u.phone || '—'}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              <Btn onClick={() => promptDelta((d, n) => action(api.adminGiveXp, u.id, d, n))}>± XP</Btn>
              <Btn onClick={() => promptDelta((d, n) => action(api.adminGiveNeurons, u.id, d, n))}>± 🧠</Btn>
              <Btn onClick={() => { const d = Number(prompt('Premium дней:', '30')); if (d > 0) action(api.adminGivePremium, u.id, d); }}>+Premium</Btn>
              <Btn tone={u.is_banned ? 'good' : 'bad'} onClick={() => action(api.adminBan, u.id, !u.is_banned)}>
                {u.is_banned ? 'Разбан' : 'Бан'}
              </Btn>
              <Btn tone="warn" onClick={() => action(api.adminShadow, u.id, !u.shadow_banned)}>
                {u.shadow_banned ? '×Shadow' : 'Shadow'}
              </Btn>
              <Btn onClick={() => { const code = prompt('Код предмета:'); if (code) action(api.adminGrantItem, u.id, code); }}>Выдать</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const [list, setList] = useState([]);
  const load = () => api.adminSettings().then((r) => setList(r.settings));
  useEffect(() => { load(); }, []);
  const save = async (k, v) => { await api.adminSetSetting(k, v); load(); };
  return (
    <div className="space-y-2">
      {list.map((s) => (
        <Card key={s.key} className="!p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-xs text-white/55">{s.key}</div>
          </div>
          <input defaultValue={s.value} onBlur={(e) => save(s.key, e.target.value)}
            className="bg-ink-800 rounded-lg px-2.5 py-1.5 w-28 text-right font-mono text-sm border border-white/[0.06] focus:border-brand-indigo/60 outline-none" />
        </Card>
      ))}
      <p className="text-xs text-white/55 px-1">
        Ключи: <code className="font-mono text-white/70">xp_per_message</code>, <code className="font-mono text-white/70">antispam_*</code>, <code className="font-mono text-white/70">casino_min_bet</code>, <code className="font-mono text-white/70">casino_max_bet</code>.
      </p>
    </div>
  );
}

function WordsTab() {
  const [list, setList] = useState([]);
  const [word, setWord] = useState('');
  const [scope, setScope] = useState('global');
  const [target, setTarget] = useState('');
  const load = () => api.adminBannedWords().then((r) => setList(r.words));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <Card className="mb-3 space-y-2">
        <Field label="Слово / фрагмент">
          <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="bad_word" />
        </Field>
        <div className="flex gap-2">
          <select value={scope} onChange={(e) => setScope(e.target.value)}
            className="bg-ink-800 rounded-xl px-3 h-12 border border-white/[0.06] text-sm">
            <option value="global">Глобально</option>
            <option value="user">Для пользователя</option>
          </select>
          {scope === 'user' && (
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="user_id"
              className="bg-ink-800 rounded-xl px-3 h-12 w-24 border border-white/[0.06] font-mono outline-none" />
          )}
          <Button onClick={async () => {
            await api.adminAddBannedWord(word, scope, scope === 'user' ? Number(target) : null);
            setWord(''); setTarget(''); load();
          }} className="ml-auto">Добавить</Button>
        </div>
      </Card>
      <div className="space-y-1.5">
        {list.map((w) => (
          <Card key={w.id} className="!p-2.5 flex items-center">
            <div className="flex-1 min-w-0">
              <span className="font-bold">{w.word}</span>{' '}
              <span className="text-white/55 text-xs">[{w.scope}{w.username ? ` → @${w.username}` : ''}]</span>
            </div>
            <button onClick={async () => { await api.adminDelBannedWord(w.id); load(); }} className="text-xs text-bad hover:underline">Удалить</button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ExclusiveTab() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ code: '', kind: 'background', name: '', description: '', payload: '{}' });
  const load = () => api.adminExclusiveItems().then((r) => setList(r.items));
  useEffect(() => { load(); }, []);
  const create = async () => {
    let payload = {};
    try { payload = JSON.parse(form.payload || '{}'); } catch { return alert('payload должен быть JSON'); }
    await api.adminAddExclusive({ ...form, payload });
    setForm({ code: '', kind: 'background', name: '', description: '', payload: '{}' });
    load();
  };
  return (
    <div>
      <Card className="mb-3 space-y-2.5">
        <Field label="Код">
          <Input className="font-mono" placeholder="bg_alex_only" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </Field>
        <Field label="Тип">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="w-full h-12 bg-ink-800 rounded-xl border border-white/[0.06] px-3">
            <option value="background">Фон</option>
            <option value="border">Обводка</option>
            <option value="prefix">Префикс</option>
          </select>
        </Field>
        <Field label="Название"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Описание"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Payload (JSON)" hint='Например: {"gradient":"from-pink-300 via-fuchsia-500 to-cyan-400"}'>
          <textarea rows={2} value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })}
            className="w-full bg-ink-800 rounded-xl px-3 py-2 outline-none border border-white/[0.06] font-mono text-xs" />
        </Field>
        <Button onClick={create} variant="premium" className="w-full">Создать эксклюзив</Button>
      </Card>
      <div className="space-y-1.5">
        {list.map((i) => (
          <Card key={i.id} className="!p-3">
            <div><b>{i.name}</b> <code className="text-xs font-mono text-white/55">{i.code}</code> <Tag>{i.kind}</Tag></div>
            {i.description && <div className="text-xs text-white/55 mt-0.5">{i.description}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Btn({ onClick, children, tone }) {
  const t = tone === 'bad' ? 'bg-bad text-white' : tone === 'good' ? 'bg-ok text-ink-950' : tone === 'warn' ? 'bg-warn text-ink-950' : 'bg-ink-700 text-white';
  return <button onClick={onClick} className={`press px-2.5 py-1.5 rounded-full font-semibold ${t}`}>{children}</button>;
}

function promptDelta(cb) {
  const d = Number(prompt('Дельта (+ или -):', '50')); if (!d) return;
  const n = prompt('Заметка (опционально):') || '';
  cb(d, n);
}
