import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { BackButton, Button, Card, Tag, Field, Input, Section, PageHeader } from '../components/ui.jsx';
import { toast } from '../store.js';

export default function Admin() {
  const [tab, setTab] = useState('users');
  const tabs = [
    { id: 'users',     label: 'Люди',         icon: '👥' },
    { id: 'feedback',  label: 'Заявки',       icon: '✉️' },
    { id: 'settings',  label: 'Параметры',    icon: '⚙' },
    { id: 'words',     label: 'Запрет.слова', icon: '🚫' },
    { id: 'exclusive', label: 'Эксклюзив',    icon: '✦' },
  ];
  return (
    <div className="min-h-full bg-ink-950">
      <PageHeader left={<BackButton to="/" />} title="⚙ Админ-панель" />
      <div className="px-3 py-3 grid grid-cols-5 gap-1.5 sticky top-[60px] z-10 bg-ink-950/95 backdrop-blur-sm">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`press py-2.5 rounded-2xl text-[11px] font-semibold flex flex-col items-center gap-0.5 ${tab === t.id ? 'bg-hero-gradient shadow-glow-brand' : 'bg-ink-700'}`}>
            <span className="text-base">{t.icon}</span>
            <span className="leading-tight">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="px-3 pb-10 max-w-3xl mx-auto">
        {tab === 'users'     && <UsersTab />}
        {tab === 'feedback'  && <FeedbackTab />}
        {tab === 'settings'  && <SettingsTab />}
        {tab === 'words'     && <WordsTab />}
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
  const action = async (fn, ...args) => { await fn(...args); toast.ok('Готово'); load(); };
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по нику или телефону" />
        <Button onClick={load}>Найти</Button>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-display font-bold truncate">{u.display_name}</span>
                  <span className="text-white/55 font-mono text-xs truncate">@{u.username}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {u.is_admin       ? <Tag tone="bad">админ</Tag> : null}
                  {u.is_vip         ? <Tag tone="premium">VIP</Tag> : null}
                  {u.premium_until > Date.now() ? <Tag tone="premium">premium</Tag> : null}
                  {u.is_banned      ? <Tag tone="bad">бан</Tag> : null}
                  {u.shadow_banned  ? <Tag tone="warn">shadow</Tag> : null}
                </div>
                <div className="text-xs text-white/55 font-mono mt-1.5">XP {u.xp} · 🧠 {u.neurons} · {u.phone || '—'}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <AdminAction label="Дать / списать XP"      onClick={() => promptDelta((d, n) => action(api.adminGiveXp, u.id, d, n))} />
              <AdminAction label="Дать / списать 🧠"      onClick={() => promptDelta((d, n) => action(api.adminGiveNeurons, u.id, d, n))} />
              <AdminAction label="Premium на N дней"      onClick={() => { const d = Number(prompt('Сколько дней Premium?', '30')); if (d > 0) action(api.adminGivePremium, u.id, d); }} />
              <AdminAction label={u.is_vip ? 'Снять VIP' : 'Дать VIP'}        tone={u.is_vip ? 'warn' : 'good'} onClick={() => action(api.adminVip, u.id, !u.is_vip)} />
              <AdminAction label={u.is_banned ? 'Разбанить' : 'Забанить'}     tone={u.is_banned ? 'good' : 'bad'} onClick={() => action(api.adminBan, u.id, !u.is_banned)} />
              <AdminAction label={u.shadow_banned ? 'Снять shadow-ban' : 'Shadow-ban'} tone="warn" onClick={() => action(api.adminShadow, u.id, !u.shadow_banned)} />
              <AdminAction label="Выдать предмет (код)"   onClick={() => { const code = prompt('Код предмета (например border_gold):'); if (code) action(api.adminGrantItem, u.id, code); }} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdminAction({ label, onClick, tone }) {
  const t = tone === 'bad' ? 'bg-bad text-white' : tone === 'good' ? 'bg-ok text-ink-950' : tone === 'warn' ? 'bg-warn text-ink-950' : 'bg-ink-700 text-white';
  return (
    <button onClick={onClick}
      className={`press w-full px-2.5 py-2 rounded-xl text-xs font-semibold leading-tight ${t}`}>
      {label}
    </button>
  );
}

const SETTING_LABELS = {
  xp_per_message:           { label: 'XP за сообщение',                hint: 'Базовое начисление; множитель применяется поверх.' },
  xp_min_chars:             { label: 'Мин. длина сообщения для XP',    hint: 'Сообщения короче не дают XP.' },
  antispam_repeat_threshold:{ label: 'Антиспам: повторы подряд',        hint: 'После N одинаковых сообщений XP не идёт.' },
  antispam_window_seconds:  { label: 'Антиспам: окно (сек)',            hint: 'Длина окна для подсчёта burst.' },
  antispam_window_max_msgs: { label: 'Антиспам: max сообщений в окне',  hint: 'Сверх — XP не идёт.' },
  casino_min_bet:           { label: 'Казино: минимальная ставка',     hint: 'XP.' },
  casino_max_bet:           { label: 'Казино: максимальная ставка',    hint: 'XP.' },
};

function SettingsTab() {
  const [list, setList] = useState([]);
  const load = () => api.adminSettings().then((r) => setList(r.settings));
  useEffect(() => { load(); }, []);
  const save = async (k, v) => { await api.adminSetSetting(k, v); toast.ok('Сохранено'); load(); };
  return (
    <div className="space-y-2">
      {list.map((s) => {
        const meta = SETTING_LABELS[s.key] || { label: s.key, hint: '' };
        return (
          <Card key={s.key} className="!p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{meta.label}</div>
              {meta.hint && <div className="text-xs text-white/55">{meta.hint}</div>}
              <div className="text-[10px] text-white/35 font-mono mt-0.5">{s.key}</div>
            </div>
            <input defaultValue={s.value} onBlur={(e) => save(s.key, e.target.value)}
              className="bg-ink-800 rounded-lg px-2.5 py-1.5 w-24 text-right font-mono text-sm border border-white/[0.06] focus:border-brand-indigo/60 outline-none" />
          </Card>
        );
      })}
    </div>
  );
}

function FeedbackTab() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('open');
  const load = () => api.adminFeedback(filter).then((r) => setList(r.feedback));
  useEffect(() => { load(); }, [filter]);
  const update = async (id, body) => { await api.adminPatchFeedback(id, body); toast.ok('Обновлено'); load(); };
  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        {[['', 'Все'], ['open', 'Новые'], ['in_progress', 'В работе'], ['done', 'Сделано'], ['rejected', 'Отказ']].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`press flex-1 py-2 rounded-full text-xs font-semibold ${filter === k ? 'bg-hero-gradient' : 'bg-ink-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="text-sm text-white/55 text-center py-8">Тут пока пусто.</div>
      ) : (
        <div className="space-y-2">
          {list.map((f) => (
            <Card key={f.id}>
              <div className="flex items-start gap-2">
                <Tag tone={f.kind === 'bug' ? 'bad' : f.kind === 'feature' ? 'brand' : 'default'}>
                  {f.kind === 'bug' ? '🐞 Баг' : f.kind === 'feature' ? '💡 Идея' : '✉️ Сообщение'}
                </Tag>
                <Tag tone={f.status === 'open' ? 'warn' : f.status === 'in_progress' ? 'brand' : f.status === 'done' ? 'ok' : 'default'}>{f.status}</Tag>
                <div className="ml-auto text-[11px] text-white/45 font-mono">{new Date(f.created_at).toLocaleString()}</div>
              </div>
              <div className="text-xs text-white/55 mt-2">от <b className="text-white/85">{f.display_name}</b> @{f.username}</div>
              <div className="mt-1.5 text-sm whitespace-pre-wrap break-words">{f.text}</div>
              {f.admin_note && <div className="mt-2 p-2 rounded-xl bg-ink-800 text-xs text-white/75"><b>Заметка:</b> {f.admin_note}</div>}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <AdminAction label="В работу"    onClick={() => update(f.id, { status: 'in_progress' })} tone="warn" />
                <AdminAction label="Сделано"     onClick={() => update(f.id, { status: 'done' })} tone="good" />
                <AdminAction label="Отказ"       onClick={() => update(f.id, { status: 'rejected' })} tone="bad" />
                <AdminAction label="Заметка"     onClick={() => { const note = prompt('Заметка:', f.admin_note || ''); if (note != null) update(f.id, { status: f.status, adminNote: note }); }} />
              </div>
            </Card>
          ))}
        </div>
      )}
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
  const [form, setForm] = useState({ code: '', kind: 'background', name: '', description: '', price_xp: 0, gradient: '', color: '' });
  const [editing, setEditing] = useState(null); // item id being edited
  const [editForm, setEditForm] = useState({});
  const load = () => api.adminExclusiveItems().then((r) => setList(r.items));
  useEffect(() => { load(); }, []);

  const buildPayload = (kind, { gradient, color }) => {
    if (kind === 'background') return gradient ? { gradient } : {};
    if (kind === 'border') return color ? { color } : {};
    return {};
  };

  const create = async () => {
    if (!form.code || !form.name) return toast.bad('Заполни код и название');
    const payload = buildPayload(form.kind, form);
    await api.adminAddExclusive({ code: form.code, kind: form.kind, name: form.name, description: form.description, price_xp: Number(form.price_xp) || 0, payload });
    setForm({ code: '', kind: 'background', name: '', description: '', price_xp: 0, gradient: '', color: '' });
    toast.ok('Создано');
    load();
  };

  const saveEdit = async (item) => {
    const payload = buildPayload(item.kind, editForm);
    await api.adminPatchExclusive(item.id, { name: editForm.name, description: editForm.description, price_xp: Number(editForm.price_xp) || 0, payload });
    setEditing(null);
    toast.ok('Сохранено');
    load();
  };

  return (
    <div>
      <Card className="mb-4 space-y-2.5">
        <div className="text-sm font-semibold mb-1">Новый эксклюзивный предмет</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Код">
            <Input className="font-mono" placeholder="bg_alex_only" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Тип">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="w-full h-12 bg-ink-800 rounded-xl border border-white/[0.06] px-3 text-sm">
              <option value="background">Фон</option>
              <option value="border">Обводка</option>
              <option value="prefix">Префикс</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Название"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Цена (XP)"><Input type="number" value={form.price_xp} onChange={(e) => setForm({ ...form, price_xp: e.target.value })} /></Field>
        </div>
        <Field label="Описание"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        {form.kind === 'background' && (
          <Field label="Gradient (Tailwind)" hint='Например: from-pink-300 via-fuchsia-500 to-cyan-400'>
            <Input className="font-mono text-xs" placeholder="from-pink-300 via-fuchsia-500 to-cyan-400" value={form.gradient} onChange={(e) => setForm({ ...form, gradient: e.target.value })} />
          </Field>
        )}
        {form.kind === 'border' && (
          <Field label="Цвет обводки">
            <div className="flex items-center gap-2 bg-ink-800 rounded-xl px-3 h-12 border border-white/[0.06]">
              <input type="color" value={form.color || '#ffffff'} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer" />
              <Input className="flex-1 !h-8 !bg-transparent !border-0 font-mono text-xs !px-1" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#ff5ba3" />
            </div>
          </Field>
        )}
        <Button onClick={create} variant="premium" className="w-full">Создать эксклюзив</Button>
      </Card>

      <div className="space-y-2">
        {list.map((item) => (
          <Card key={item.id} className="!p-3">
            {editing === item.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Название"><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
                  <Field label="Цена (XP)"><Input type="number" value={editForm.price_xp} onChange={(e) => setEditForm({ ...editForm, price_xp: e.target.value })} /></Field>
                </div>
                <Field label="Описание"><Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></Field>
                {item.kind === 'background' && (
                  <Field label="Gradient"><Input className="font-mono text-xs" value={editForm.gradient || ''} onChange={(e) => setEditForm({ ...editForm, gradient: e.target.value })} /></Field>
                )}
                {item.kind === 'border' && (
                  <Field label="Цвет">
                    <div className="flex items-center gap-2 bg-ink-800 rounded-xl px-3 h-12 border border-white/[0.06]">
                      <input type="color" value={editForm.color || '#ffffff'} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="w-7 h-7 bg-transparent border-0 rounded cursor-pointer" />
                      <Input className="flex-1 !h-8 !bg-transparent !border-0 font-mono text-xs !px-1" value={editForm.color || ''} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} />
                    </div>
                  </Field>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(item)}>Сохранить</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Отмена</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b>{item.name}</b>
                    <code className="text-xs font-mono text-white/55">{item.code}</code>
                    <Tag>{item.kind}</Tag>
                    {item.price_xp > 0 && <Tag tone="brand">{item.price_xp} XP</Tag>}
                  </div>
                  {item.description && <div className="text-xs text-white/55 mt-0.5">{item.description}</div>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => {
                  setEditing(item.id);
                  setEditForm({ name: item.name, description: item.description, price_xp: item.price_xp, gradient: item.payload?.gradient || '', color: item.payload?.color || '' });
                }}>Изменить</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function promptDelta(cb) {
  const d = Number(prompt('Дельта (+ или -):', '50')); if (!d) return;
  const n = prompt('Заметка (опционально):') || '';
  cb(d, n);
}
