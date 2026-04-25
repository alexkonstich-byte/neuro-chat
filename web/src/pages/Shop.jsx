import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { ProfileBackground } from '../components/UserChip.jsx';
import { BackButton, Button, Card, Tag, Section, EmptyState, PageHeader } from '../components/ui.jsx';

export default function Shop() {
  const me = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [tab, setTab] = useState('items');
  const [items, setItems] = useState([]);
  const [inv, setInv] = useState([]);
  const [tx, setTx] = useState([]);
  const [now, setNow] = useState(Date.now());

  const reload = async () => {
    const [a, b, c, fresh] = await Promise.all([api.shopItems(), api.inventory(), api.transactions(), api.me()]);
    setItems(a.items); setInv(b.inventory); setTx(c.transactions); setUser(fresh.user);
  };
  useEffect(() => { reload(); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const buy = async (code) => {
    try { await api.buy(code); reload(); }
    catch (e) {
      const m = { not_enough_xp: 'Недостаточно XP', already_owned: 'Уже куплено', premium_required: 'Нужен Premium', exclusive_only: 'Только админский предмет' };
      alert(m[e?.data?.error] || e?.data?.error || e.message);
    }
  };
  const equip = async (code, slot) => { await api.equip(code, slot); reload(); };
  const refund = async (id) => { await api.refund(id); reload(); };
  const owned = (code) => inv.some((i) => i.item_code === code);
  const grouped = items.reduce((acc, it) => { (acc[it.kind] ||= []).push(it); return acc; }, {});

  return (
    <div className="min-h-full bg-ink-950">
      <PageHeader
        left={<BackButton to="/" />}
        title="Магазин"
        subtitle={`${me?.xp ?? 0} XP · 🧠 ${me?.neurons ?? 0}`}
      />

      <div className="px-3 py-3 flex gap-1.5 sticky top-[60px] z-10 bg-ink-950/95 backdrop-blur-sm">
        {['items', 'inventory', 'transactions'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`press flex-1 py-2 text-xs font-semibold uppercase tracking-wider rounded-full ${tab === t ? 'bg-hero-gradient shadow-glow-brand' : 'bg-ink-700'}`}>
            {t === 'items' ? 'Товары' : t === 'inventory' ? 'Инвентарь' : 'История'}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="px-3 pb-10 space-y-7">
          {grouped.background && (
            <div>
              <Section>Анимированные фоны</Section>
              <div className="grid grid-cols-2 gap-3">
                {grouped.background.map((it) => (
                  <Card key={it.code} className="!p-0 overflow-hidden !shadow-none">
                    <ProfileBackground code={it.code} className="aspect-[4/3] grid place-items-center">
                      <div className="absolute inset-0 bg-black/25" />
                      <div className="relative font-display text-xl font-bold text-white drop-shadow-lg">{it.name}</div>
                    </ProfileBackground>
                    <div className="p-3 flex items-center justify-between">
                      <div className="text-sm font-semibold">{it.price_xp} <span className="opacity-55 text-xs">XP</span></div>
                      {owned(it.code) ? (
                        <Button size="sm" variant={me.activeBg === it.code ? 'primary' : 'ghost'}
                                onClick={() => equip(it.code, 'background')}>
                          {me.activeBg === it.code ? 'Активно ✓' : 'Применить'}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => buy(it.code)}>Купить</Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {grouped.border && (
            <div>
              <Section>Обводки аватара</Section>
              <div className="grid grid-cols-3 gap-3">
                {grouped.border.map((it) => (
                  <Card key={it.code} className="text-center !p-3">
                    <div className="mx-auto mb-2 w-16 h-16 rounded-full" style={borderPreviewStyle(it)}>
                      <div className="w-full h-full rounded-full grid place-items-center text-xs bg-ink-700 m-[3px]" style={{ width: 58, height: 58 }}>A</div>
                    </div>
                    <div className="text-sm font-semibold">{it.name}</div>
                    <div className="text-xs text-white/55 mb-1.5">{it.price_xp} XP</div>
                    {owned(it.code) ? (
                      <Button size="sm" variant={me.activeBorder === it.code ? 'primary' : 'ghost'}
                              onClick={() => equip(it.code, 'border')} className="w-full">
                        {me.activeBorder === it.code ? '✓' : 'Применить'}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => buy(it.code)} className="w-full">Купить</Button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {grouped.multiplier && (
            <div>
              <Section>Множители XP</Section>
              <div className="grid grid-cols-2 gap-2">
                {grouped.multiplier.map((it) => (
                  <Card key={it.code} className="!p-3">
                    <div className="font-display font-bold text-lg">{it.name}</div>
                    <div className="text-xs text-white/55 mb-2">{it.description}</div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{it.price_xp} XP</div>
                      <Button size="sm" onClick={() => buy(it.code)}>Купить</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {grouped.neurons_pack && (
            <div>
              <Section>Нейроны</Section>
              {grouped.neurons_pack.map((it) => (
                <Card key={it.code} className="!p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{it.name}</div>
                    <div className="text-xs text-white/55">{it.description}</div>
                  </div>
                  <Button onClick={() => buy(it.code)}>{it.price_xp} XP</Button>
                </Card>
              ))}
            </div>
          )}

          {grouped.prefix && (
            <div>
              <Section>Префиксы</Section>
              {grouped.prefix.map((it) => (
                <Card key={it.code} className="!p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{it.name}</div>
                    <div className="text-xs text-white/55">{it.description}</div>
                  </div>
                  {owned(it.code)
                    ? <Tag tone="ok">Куплено</Tag>
                    : <Button onClick={() => buy(it.code)}>{it.price_xp} XP</Button>}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'inventory' && (
        <div className="px-3 pb-10 space-y-2">
          {inv.length === 0 && <EmptyState icon="🎁" title="Инвентарь пуст" hint="Купи что-нибудь во вкладке «Товары»." />}
          {inv.map((i) => (
            <Card key={i.id} className="!p-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{i.name || i.item_code}</div>
                <div className="text-xs text-white/55 font-mono">{new Date(i.acquired_at).toLocaleString()} · {i.source}</div>
              </div>
              {(i.kind === 'background' || i.kind === 'border') && (
                <Button size="sm" onClick={() => equip(i.item_code, i.kind)}>Применить</Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="px-3 pb-10 space-y-1.5">
          {tx.length === 0 && <EmptyState icon="📜" title="Пусто" hint="Здесь будут все начисления и списания." />}
          {tx.map((t) => {
            const remaining = Math.max(0, t.refundable_until - now);
            return (
              <Card key={t.id} className="!p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{labelKind(t.kind)}</div>
                    {t.note && <div className="text-xs text-white/55 truncate">{t.note}</div>}
                  </div>
                  <div className={`text-sm font-bold font-mono ${t.amount_xp >= 0 ? 'text-ok' : 'text-bad'}`}>
                    {t.amount_xp >= 0 ? '+' : ''}{t.amount_xp} XP
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-white/45 font-mono mt-1">
                  <div>{new Date(t.created_at).toLocaleString()}</div>
                  {t.kind === 'shop_buy' && remaining > 0 && !t.refunded && (
                    <button onClick={() => refund(t.id)} className="text-warn font-semibold hover:underline">
                      ↺ Вернуть · {Math.ceil(remaining / 1000)}с
                    </button>
                  )}
                  {t.refunded ? <Tag tone="ok">возвращено</Tag> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function labelKind(k) {
  return ({
    shop_buy: 'Покупка', shop_refund: 'Возврат', casino_bet: 'Ставка', casino_win: 'Выигрыш',
    xp_award: 'Начисление', xp_revoke: 'Списание', multiplier_grant: 'Множитель',
    premium_grant: 'Premium', neurons_change: 'Нейроны',
  })[k] || k;
}

function borderPreviewStyle(it) {
  const p = it.payload || {};
  if (p.color === 'rainbow') {
    return { background: 'conic-gradient(from 0deg, #ff5b6c,#ffaa3a,#fff36b,#5ce28a,#5cc8ff,#b388ff,#ff5b6c)', padding: 3 };
  }
  return { boxShadow: `0 0 0 3px ${p.color || '#fff'} inset`, padding: 3 };
}
