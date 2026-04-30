import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, toast } from '../store.js';
import { Avatar, ProfileBackground } from '../components/UserChip.jsx';
import { BackButton, Button, Card, Tag, PageHeader } from '../components/ui.jsx';

export default function ShopItem() {
  const { code } = useParams();
  const me = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const nav = useNavigate();
  const [item, setItem] = useState(null);
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.shopItems(), api.inventory(), api.me()]).then(([a, b, fresh]) => {
      const it = a.items.find((x) => x.code === code);
      setItem(it || null);
      setOwned(!!b.inventory.find((i) => i.item_code === code));
      setUser(fresh.user);
    });
  }, [code]);

  if (!item) {
    return (
      <div className="min-h-full bg-ink-950">
        <PageHeader left={<BackButton onClick={() => nav(-1)} />} title="Предмет" />
        <div className="p-6 text-white/55 text-center">Не найдено или скрыто.</div>
      </div>
    );
  }

  const buy = async () => {
    if (busy || owned) return;
    setBusy(true);
    try {
      await api.buy(code);
      toast.brand('Покупка успешна', item.name);
      const fresh = (await api.me()).user; setUser(fresh);
      setOwned(true);
    } catch (e) {
      const m = { not_enough_xp: 'Недостаточно XP', already_owned: 'Уже куплено', premium_required: 'Нужен Premium', exclusive_only: 'Только админский предмет' };
      toast.bad(m[e?.data?.error] || e?.data?.error || e.message);
    } finally { setBusy(false); }
  };

  const equip = async (slot) => {
    try { await api.equip(code, slot); toast.ok('Применено'); const fresh = (await api.me()).user; setUser(fresh); }
    catch (e) { toast.bad(e?.data?.error || e.message); }
  };

  const grad = item.payload?.gradient;

  return (
    <div className="min-h-full bg-ink-950">
      <PageHeader left={<BackButton onClick={() => nav(-1)} />} title={item.name} subtitle={`${item.price_xp} XP`} />
      <div className="max-w-xl mx-auto px-4 pb-10">
        {item.kind === 'background' && (
          <ProfileBackground code={item.code} payloadGradient={grad} className="rounded-3xl aspect-[5/4] grid place-items-center overflow-hidden">
            <div className="absolute inset-0 bg-black/35" />
            <div className="relative text-center">
              <Avatar user={me} size={92} />
              <div className="mt-3 font-display text-2xl text-white drop-shadow"><b>{me?.displayName || me?.username}</b></div>
            </div>
          </ProfileBackground>
        )}
        {item.kind === 'border' && (
          <div className="rounded-3xl bg-ink-800 grid place-items-center aspect-[5/4]">
            <div className="text-center">
              <div className="mx-auto mb-3"><Avatar user={{ ...me, activeBorder: item.code }} size={120} /></div>
              <div className="text-white/85 font-display">{me?.displayName}</div>
            </div>
          </div>
        )}
        {item.kind === 'prefix' && (
          <div className="rounded-3xl bg-ink-800 p-10 text-center">
            <div className="font-display text-3xl">
              <span className="opacity-90 mr-2">{item.payload?.text || '★'}</span>
              <span>{me?.displayName || me?.username}</span>
            </div>
          </div>
        )}

        <Card className="mt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-display font-bold text-2xl">{item.name}</div>
              <div className="text-sm text-white/60">{item.description}</div>
            </div>
            <Tag tone="brand">{item.kind}</Tag>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {item.is_exclusive ? <Tag tone="premium">эксклюзив</Tag> : null}
            {item.premium_only ? <Tag tone="premium">Premium</Tag> : null}
            {owned ? <Tag tone="ok">в инвентаре</Tag> : null}
          </div>
        </Card>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {!owned ? (
            <Button onClick={buy} disabled={busy} className="col-span-2">
              {busy ? 'Покупаем…' : `Купить за ${item.price_xp} XP`}
            </Button>
          ) : item.kind === 'background' ? (
            <Button onClick={() => equip('bg')} className="col-span-2">Применить как фон</Button>
          ) : item.kind === 'border' ? (
            <Button onClick={() => equip('border')} className="col-span-2">Применить как обводку</Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
