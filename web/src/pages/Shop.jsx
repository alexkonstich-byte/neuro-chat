import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, toast } from '../store.js';
import { Avatar, NameLine, ProfileBackground } from '../components/UserChip.jsx';
import { BackButton, Button, Card, Tag, Section, EmptyState, PageHeader, Sheet, Field, Input } from '../components/ui.jsx';

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

  const [preview, setPreview] = useState(null);
  const buy = async (code) => {
    try {
      const r = await api.buy(code);
      const it = items.find((x) => x.code === code);
      toast.brand('Покупка успешна', it?.name);
      if (r?.balance?.xp != null) toast.xp(-(it?.price_xp || 0), `Списано за ${it?.name || code}`);
      setPreview(null);
      reload();
    } catch (e) {
      const m = { not_enough_xp: 'Недостаточно XP', already_owned: 'Уже куплено', premium_required: 'Нужен Premium', exclusive_only: 'Только админский предмет' };
      toast.bad(m[e?.data?.error] || e?.data?.error || e.message);
    }
  };
  const equip = async (code, slot) => {
    await api.equip(code, slot);
    toast.ok('Применено');
    reload();
  };
  const refund = async (id) => {
    await api.refund(id);
    toast.ok('Возврат оформлен', '+XP вернулись на счёт');
    reload();
  };
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped.background.map((it) => {
                  const gradPayload = it.payload?.gradient;
                  return (
                    <button key={it.code} onClick={() => setPreview({ item: it })}
                      className="press text-left rounded-3xl overflow-hidden border border-white/10 bg-ink-800 hover:border-brand-indigo/40 transition relative">
                      {owned(it.code) && <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-ok flex items-center justify-center text-xs font-bold text-ink-950">✓</div>}
                      <ProfileBackground code={it.code} payloadGradient={gradPayload} className="aspect-square grid place-items-center">
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="relative grid place-items-center">
                          <Avatar user={me} size={64} />
                          <div className="mt-2 font-display font-semibold text-white drop-shadow">{me?.displayName || me?.username}</div>
                        </div>
                      </ProfileBackground>
                      <div className="p-3 flex items-center justify-between">
                        <div className="text-sm font-semibold">{it.name}</div>
                        <div className={`text-xs font-mono ${owned(it.code) ? 'text-ok' : 'text-white/55'}`}>{owned(it.code) ? 'Куплено' : `${it.price_xp} XP`}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {grouped.border && (
            <div>
              <Section>Обводки аватара</Section>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {grouped.border.map((it) => (
                  <button key={it.code} onClick={() => setPreview({ item: it })}
                    className="press text-center bg-ink-800 rounded-3xl p-4 border border-white/10 hover:border-brand-indigo/40 transition relative">
                    {owned(it.code) && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-ok flex items-center justify-center text-xs font-bold text-ink-950">✓</div>}
                    <div className="mx-auto mb-3 w-20 h-20 grid place-items-center">
                      <BorderPreview payload={it.payload} user={me} />
                    </div>
                    <div className="text-sm font-semibold">{it.name}</div>
                    <div className={`text-xs font-mono ${owned(it.code) ? 'text-ok' : 'text-white/55'}`}>{owned(it.code) ? 'Куплено' : `${it.price_xp} XP`}</div>
                  </button>
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

      <PreviewSheet
        open={!!preview} onClose={() => setPreview(null)}
        item={preview?.item} me={me} owned={preview?.item ? owned(preview.item.code) : false}
        active={preview?.item && (
          (preview.item.kind === 'background' && me?.activeBg === preview.item.code) ||
          (preview.item.kind === 'border'     && me?.activeBorder === preview.item.code)
        )}
        onBuy={() => buy(preview.item.code)}
        onEquip={(slot) => equip(preview.item.code, slot)}
      />

      {tab === 'inventory' && (
        <div className="px-3 pb-10 space-y-2">
          {inv.length === 0 && <EmptyState icon="🎁" title="Инвентарь пуст" hint="Купи что-нибудь во вкладке «Товары»." />}
          {inv.map((i) => (
            <button key={i.id}
              onClick={() => setPreview({ item: { code: i.item_code, name: i.name || i.item_code, kind: i.kind, payload: i.payload, price_xp: 0 } })}
              className="press w-full text-left">
              <Card className="!p-3 flex items-center justify-between hover:border-brand-indigo/40 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <InventoryThumb item={i} me={me} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{i.name || i.item_code}</div>
                    <div className="text-xs text-white/55 font-mono truncate">{new Date(i.acquired_at).toLocaleString()} · {i.source}</div>
                  </div>
                </div>
                <div className="text-xs text-white/55">›</div>
              </Card>
            </button>
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

/* ---- Border preview (live, animated) ---- */
function BorderPreview({ payload, user, size = 80 }) {
  const p = payload || {};
  const ringStyles = borderRingStyle(p);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <div className={`absolute inset-0 rounded-full ${ringStyles.className}`} style={ringStyles.inline} />
      <div className="absolute inset-[3px] rounded-full overflow-hidden bg-ink-700 grid place-items-center text-sm font-bold">
        {user?.avatar
          ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          : <span>{(user?.displayName || user?.username || 'A').slice(0, 1).toUpperCase()}</span>}
      </div>
    </div>
  );
}
function borderRingStyle(p) {
  if (p.animated === 'pulse') {
    return { className: 'animate-pulse-soft', inline: { boxShadow: `0 0 0 3px ${p.color || '#ff5ba3'} inset, 0 0 24px 4px ${p.color || '#ff5ba3'}66` } };
  }
  if (p.animated === 'aurora') {
    return { className: 'gradient-bg',
      inline: { background: 'linear-gradient(135deg,#5B72FF,#C56BFF,#65DEFF,#FFB13B)', backgroundSize: '300% 300%', padding: 0 } };
  }
  if (p.animated === 'ember') {
    return { className: 'animate-pulse-soft',
      inline: { boxShadow: `0 0 0 3px ${p.color || '#ff8a2b'} inset, 0 0 18px 0 ${p.color || '#ff8a2b'}cc` } };
  }
  if (p.color === 'rainbow') {
    return { className: 'ring-rainbow',
      inline: { background: 'conic-gradient(from 0deg, #ff5b6c,#ffaa3a,#fff36b,#5ce28a,#5cc8ff,#b388ff,#ff5b6c)' } };
  }
  return { className: '', inline: { boxShadow: `0 0 0 3px ${p.color || '#fff'} inset` } };
}

function InventoryThumb({ item, me }) {
  if (item.kind === 'background') {
    return (
      <div className="w-12 h-12 rounded-xl overflow-hidden">
        <ProfileBackground code={item.item_code} payloadGradient={item.payload?.gradient} className="w-full h-full">
          <div className="absolute inset-0 bg-black/20" />
        </ProfileBackground>
      </div>
    );
  }
  if (item.kind === 'border') {
    return <BorderPreview payload={item.payload} user={me} size={48} />;
  }
  return <div className="w-12 h-12 rounded-xl bg-ink-800 grid place-items-center text-2xl">📦</div>;
}

/* ---- Preview Sheet: shop item or inventory item ---- */
function PreviewSheet({ open, onClose, item, me, owned, active, onBuy, onEquip }) {
  const [prefixDraft, setPrefixDraft] = useState('');
  if (!item) return null;
  const isBg     = item.kind === 'background';
  const isBorder = item.kind === 'border';
  const isPrefix = item.kind === 'prefix';
  const isMult   = item.kind === 'multiplier';
  const isPack   = item.kind === 'neurons_pack';

  return (
    <Sheet open={open} onClose={onClose} title={item.name}>
      <div className="p-3 space-y-4">
        {/* Big preview */}
        {isBg && (
          <ProfileBackground code={item.code} payloadGradient={item.payload?.gradient} className="rounded-3xl aspect-[16/10] overflow-hidden grid place-items-center">
            <div className="absolute inset-0 bg-black/35" />
            <div className="relative grid place-items-center">
              <Avatar user={me} size={88} />
              <div className="mt-2 font-display text-2xl text-white drop-shadow"><NameLine user={me} /></div>
              {me?.statusText && <div className="text-xs text-white/85 mt-0.5">{me.statusText}</div>}
            </div>
          </ProfileBackground>
        )}
        {isBorder && (
          <div className="rounded-3xl bg-ink-800 p-8 grid place-items-center">
            <BorderPreview payload={item.payload} user={me} size={140} />
            <div className="mt-3 font-display text-xl"><NameLine user={me} /></div>
          </div>
        )}
        {isPrefix && (
          <div className="rounded-3xl bg-ink-800 p-6">
            <Field label="Префикс перед ником">
              <Input value={prefixDraft} onChange={(e) => setPrefixDraft(e.target.value.slice(0, 12))} placeholder="ALPHA" maxLength={12} />
            </Field>
            <div className="mt-3 text-sm text-white/70">
              Превью: <span className="text-white opacity-90 mr-1">{prefixDraft || 'ALPHA'}</span>
              <NameLine user={me} />
            </div>
          </div>
        )}
        {isMult && (
          <div className="rounded-3xl p-6 text-center bg-hero-soft border border-white/10">
            <div className="font-display text-3xl">x{item.payload?.factor || '?'}</div>
            <div className="text-sm text-white/70 mt-1">{item.description}</div>
          </div>
        )}
        {isPack && (
          <div className="rounded-3xl p-6 text-center bg-ink-800 border border-white/10">
            <div className="text-5xl">🧠</div>
            <div className="font-display text-2xl mt-2">+{item.payload?.amount || 0} нейронов</div>
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center gap-2">
          <div className="flex-1 text-sm text-white/70">{item.description}</div>
          {item.price_xp > 0 && (
            <Tag tone="brand">{item.price_xp} XP</Tag>
          )}
        </div>
        <div className="flex gap-2">
          {owned ? (
            <>
              {(isBg || isBorder) && (
                <Button onClick={() => onEquip(isBg ? 'background' : 'border')} className="flex-1">
                  {active ? '✓ Применено' : 'Применить'}
                </Button>
              )}
              {isPrefix && (
                <Button onClick={async () => {
                  if (!prefixDraft.trim()) return toast.bad('Введи текст префикса');
                  try {
                    await api.patchMe({ prefixText: prefixDraft.trim() });
                    toast.ok('Префикс применён');
                    onClose();
                  } catch (e) { toast.bad('Ошибка', e?.data?.error); }
                }} className="flex-1">Применить префикс</Button>
              )}
              {!isBg && !isBorder && !isPrefix && <Tag tone="ok" className="ml-auto">в инвентаре</Tag>}
            </>
          ) : (
            <Button onClick={onBuy} className="flex-1">Купить за {item.price_xp} XP</Button>
          )}
          <Button variant="ghost" onClick={onClose}>Закрыть</Button>
        </div>
      </div>
    </Sheet>
  );
}
