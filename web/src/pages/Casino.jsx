import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { BackButton, Card, PageHeader } from '../components/ui.jsx';

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
        if (r.jackpot) burstConfetti();
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
    <div className="min-h-full bg-ink-950 relative overflow-hidden">
      <PageHeader
        left={<BackButton to="/" />}
        title="🎰 Казино"
        subtitle={`${me?.xp ?? 0} XP в кошельке`}
      />

      {/* Ambient background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-casino-gradient opacity-20 blur-[80px] animate-mesh-drift" />
      </div>

      {me?.is_banned && (
        <div className="m-3 p-3 bg-bad/15 border border-bad/30 rounded-2xl text-sm">
          Доступ к казино закрыт: ваш аккаунт заблокирован.
        </div>
      )}

      <div className="relative px-4 pt-4 pb-10 space-y-4 max-w-lg mx-auto">
        {/* Slot machine */}
        <div className="relative rounded-4xl overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-casino-gradient gradient-bg opacity-40" />
          <div className="relative p-5 rounded-4xl border border-premium-amber/20 backdrop-blur-sm">
            {/* Reel display */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {reels.map((s, i) => (
                <div key={i}
                  className={`aspect-square rounded-3xl bg-black/40 border-2 border-white/10 grid place-items-center
                    ${spinning ? 'animate-pulse-soft border-premium-amber/30' : ''}`}>
                  <div className={`text-6xl select-none transition-all ${spinning ? 'blur-sm scale-110' : 'blur-0 scale-100'}`}>{s}</div>
                </div>
              ))}
            </div>

            {/* Bet controls */}
            <div className="flex items-center gap-2 mb-4 bg-black/30 rounded-2xl px-3 py-2.5">
              <span className="text-xs uppercase tracking-widest text-white/50 font-mono shrink-0">Ставка</span>
              <input type="number" min={5} value={bet} onChange={(e) => setBet(Number(e.target.value || 0))}
                className="w-20 bg-transparent text-center font-mono text-lg border-0 outline-none text-white" />
              <div className="flex gap-1 ml-auto">
                {[10, 50, 100, 500].map((v) => (
                  <button key={v} onClick={() => setBet(v)}
                    className={`press text-xs rounded-full px-2.5 py-1.5 font-bold transition ${bet === v ? 'bg-premium-amber text-ink-950' : 'bg-white/10 hover:bg-white/20'}`}>{v}</button>
                ))}
              </div>
            </div>

            <button onClick={spin} disabled={spinning}
              className="press w-full py-4 rounded-3xl bg-casino-gradient gradient-bg font-display font-black text-xl tracking-widest disabled:opacity-50 shadow-glow-premium border border-white/10 transition hover:brightness-110">
              {spinning ? '⟳ КРУТИМ…' : '🎰 SPIN'}
            </button>

            {last && (
              <div className="mt-3 rounded-2xl p-4 text-center bg-black/40 border border-white/10 animate-pop">
                {last.jackpot ? (
                  <div className="font-display text-2xl font-bold text-premium-amber">🎉 ДЖЕКПОТ! +Allsafe Premium 3 мес.</div>
                ) : last.winXp > 0 ? (
                  <div className="font-display text-xl text-ok font-bold">+{last.winXp} XP{last.winNeurons ? ` · +${last.winNeurons} 🧠` : ''}</div>
                ) : (
                  <div className="text-white/55 text-sm">Не повезло — ещё разок?</div>
                )}
                {last.bonus?.type === 'multiplier' && (
                  <div className="text-xs mt-1.5 text-brand-sky bg-brand-sky/10 rounded-full px-3 py-1 inline-block">
                    Бонус: x{last.bonus.factor} на {Math.round(last.bonus.durationSec/60)} мин
                  </div>
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
                  className={`press px-2.5 py-1 rounded-full font-semibold transition ${period === p ? 'bg-hero-gradient' : 'bg-ink-700 hover:bg-ink-600'}`}>
                  {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
          </div>
          {board.length === 0 ? (
            <div className="text-xs text-white/55 text-center py-4">Никто ещё не выиграл за этот период.</div>
          ) : (
            <div className="space-y-2">
              {board.map((r, i) => (
                <div key={r.user_id} className={`flex items-center gap-3 px-3 py-2 rounded-2xl ${i < 3 ? 'bg-white/[0.04]' : ''}`}>
                  <div className={`w-7 h-7 rounded-full grid place-items-center text-sm font-display font-black
                    ${i === 0 ? 'bg-premium-amber text-ink-950' : i === 1 ? 'bg-white/20' : i === 2 ? 'bg-amber-700/60' : 'text-white/30'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 truncate font-semibold">{r.display_name || r.username}</div>
                  <div className="text-premium-amber font-mono font-bold text-sm">+{r.top_win} XP</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* My recent */}
        <Card>
          <div className="font-display font-bold text-lg mb-3">Последние спины</div>
          {recent.length === 0 ? (
            <div className="text-xs text-white/55 text-center py-4">Пока пусто.</div>
          ) : (
            <div className="space-y-1.5 text-sm">
              {recent.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-white/[0.03]">
                  <div className="text-xl tracking-wide">{s.reels.join(' ')}</div>
                  <div className="ml-auto font-mono text-sm">
                    {s.win_xp > 0
                      ? <span className="text-ok font-bold">+{s.win_xp}</span>
                      : <span className="text-white/40">−{s.bet_xp}</span>}
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

function burstConfetti() {
  const colors = ['#5B72FF','#C56BFF','#65DEFF','#FFB13B','#FF5BA3','#34D399'];
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden';
  document.body.appendChild(root);
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + '%';
    el.style.background = colors[i % colors.length];
    el.style.setProperty('--cx', (Math.random() * 200 - 100) + 'px');
    el.style.setProperty('--cr', (Math.random() * 720 - 360) + 'deg');
    el.style.animationDelay = (Math.random() * 200) + 'ms';
    root.appendChild(el);
  }
  setTimeout(() => root.remove(), 2400);
}
function translate(err) {
  return ({
    not_enough_xp: 'Недостаточно XP',
    min_bet: 'Слишком маленькая ставка',
    max_bet: 'Слишком большая ставка',
    banned_from_casino: 'Вы заблокированы в казино',
  })[err];
}
