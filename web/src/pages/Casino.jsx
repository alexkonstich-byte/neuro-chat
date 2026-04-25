import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { BackButton, Button, Card, Tag, Section, PageHeader, GradientHalo } from '../components/ui.jsx';

export default function Casino() {
  const me = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [bet, setBet] = useState(10);
  const [reels, setReels] = useState(['❔', '❔', '❔']);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState(null);
  const [board, setBoard] = useState([]);
  const [period, setPeriod] = useState('week');
  const [recent, setRecent] = useState([]);

  useEffect(() => { api.leaderboard(period).then((r) => setBoard(r.leaderboard)); }, [period]);
  useEffect(() => { api.recentSpins().then((r) => setRecent(r.spins)); }, [last]);

  const spin = async () => {
    if (spinning) return;
    setSpinning(true); setLast(null);
    const ticker = ['🍒','🍋','🍇','⭐','🔔','💎','7️⃣'];
    const tickerId = setInterval(() => {
      setReels([rand(ticker), rand(ticker), rand(ticker)]);
    }, 70);
    try {
      const r = await api.spin(bet);
      setTimeout(async () => {
        clearInterval(tickerId);
        setReels(r.reels);
        setLast(r);
        setSpinning(false);
        const fresh = await api.me();
        setUser(fresh.user);
      }, 1100);
    } catch (e) {
      clearInterval(tickerId);
      setSpinning(false);
      alert(translate(e?.data?.error) || e.message);
    }
  };

  return (
    <div className="min-h-full bg-ink-950 relative">
      <PageHeader
        left={<BackButton to="/" />}
        title="🎰 Казино"
        subtitle={`${me?.xp ?? 0} XP в кошельке`}
      />

      <GradientHalo />

      {me?.is_banned && (
        <div className="m-3 p-3 bg-bad/15 border border-bad/30 rounded-2xl text-sm">
          Доступ к казино закрыт: ваш аккаунт заблокирован.
        </div>
      )}

      <div className="relative px-4 pt-4 pb-10 space-y-4">
        {/* Slot machine */}
        <div className="relative rounded-4xl overflow-hidden">
          <div className="absolute inset-0 bg-casino-gradient gradient-bg opacity-30" />
          <div className="relative surface-strong rounded-4xl p-5 border-white/10">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {reels.map((s, i) => (
                <div key={i} className={`relative aspect-square rounded-3xl bg-ink-900 border border-white/10 grid place-items-center ${spinning ? 'animate-pulse-soft' : ''}`}>
                  <div className="text-6xl select-none">{s}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-widest text-white/55 font-mono">Ставка</span>
              <input type="number" min={5} value={bet} onChange={(e) => setBet(Number(e.target.value || 0))}
                className="w-24 bg-ink-800 rounded-xl px-3 py-2 text-center font-mono border border-white/[0.06]" />
              <div className="flex gap-1 ml-auto">
                {[10, 50, 100, 500].map((v) => (
                  <button key={v} onClick={() => setBet(v)}
                    className={`press text-xs rounded-full px-2.5 py-1.5 font-semibold ${bet === v ? 'bg-hero-gradient' : 'bg-ink-800'}`}>{v}</button>
                ))}
              </div>
            </div>
            <button onClick={spin} disabled={spinning}
              className="press w-full py-4 rounded-2xl bg-casino-gradient gradient-bg font-display font-black text-xl tracking-widest disabled:opacity-50 shadow-glow-premium">
              {spinning ? 'КРУТИМ…' : 'SPIN'}
            </button>

            {last && (
              <div className="mt-3 rounded-2xl p-3 text-center bg-ink-900 border border-white/10 animate-pop">
                {last.jackpot ? (
                  <div className="font-display text-2xl font-bold text-premium-amber">🎉 ДЖЕКПОТ! +Neuro Premium 3 мес.</div>
                ) : last.winXp > 0 ? (
                  <div className="text-ok font-display text-lg">+{last.winXp} XP {last.winNeurons ? `(+${last.winNeurons} 🧠)` : ''}</div>
                ) : (
                  <div className="text-white/55">Не повезло. Ещё разок?</div>
                )}
                {last.bonus?.type === 'multiplier' && (
                  <div className="text-xs mt-1 text-brand-sky">Бонус: x{last.bonus.factor} на {Math.round(last.bonus.durationSec/60)} мин</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <Card>
          <div className="flex items-center mb-3">
            <div className="font-display font-bold text-lg">🏆 Лидерборд</div>
            <div className="ml-auto flex gap-1 text-xs">
              {['day','week','month'].map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`press px-2.5 py-1 rounded-full font-semibold ${period === p ? 'bg-hero-gradient' : 'bg-ink-700'}`}>
                  {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
          </div>
          {board.length === 0 ? (
            <div className="text-xs text-white/55 text-center py-4">Никто ещё не выиграл за этот период.</div>
          ) : (
            <div className="space-y-1.5">
              {board.map((r, i) => (
                <div key={r.user_id} className="flex items-center gap-3 text-sm">
                  <div className={`w-6 text-center font-display font-bold ${i === 0 ? 'text-premium-amber' : i === 1 ? 'text-white/85' : i === 2 ? 'text-amber-700' : 'text-white/55'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 truncate">{r.display_name || r.username}</div>
                  <div className="text-premium-amber font-mono font-bold">+{r.top_win}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* My recent */}
        <Card>
          <div className="font-display font-bold text-lg mb-2">Мои последние</div>
          {recent.length === 0 ? (
            <div className="text-xs text-white/55 text-center py-4">Пока пусто.</div>
          ) : (
            <div className="space-y-1.5 text-sm">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="text-2xl">{s.reels.join(' ')}</div>
                  <div className="ml-auto font-mono">
                    {s.win_xp > 0
                      ? <span className="text-ok font-bold">+{s.win_xp}</span>
                      : <span className="text-white/45">−{s.bet_xp}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function translate(err) {
  return ({
    not_enough_xp: 'Недостаточно XP',
    min_bet: 'Слишком маленькая ставка',
    max_bet: 'Слишком большая ставка',
    banned_from_casino: 'Вы заблокированы в казино',
  })[err];
}
