import React from 'react';
import { Link } from 'react-router-dom';
import { NeuroMark, GradientHalo, Button, Tag, Card } from '../components/ui.jsx';

const FEATURES = [
  { icon: '💬', title: 'Мгновенные сообщения', desc: 'Real-time, печатает, реакции, ответы, редактирование, удаление.' },
  { icon: '📞', title: 'Аудио и видеозвонки', desc: 'P2P через WebRTC прямо в браузере.' },
  { icon: '🎙', title: 'Голосовые и кружки', desc: 'Запись с микрофона и фронт-камеры.' },
  { icon: '🛒', title: 'Кастомизация за XP', desc: '10 анимированных фонов, обводки, префиксы, множители, нейроны.' },
  { icon: '🎰', title: 'Казино', desc: 'Слоты с настоящим лидербордом. Джекпот 7-7-7 = Premium 3 мес.' },
  { icon: '🔥', title: 'Огоньки дружбы', desc: 'Общайся каждый день — счётчик растёт, прервёшь — сгорит.' },
  { icon: '✦', title: 'Neuro Premium', desc: 'Цвет ника, цвет префикса, кастомный эмодзи после имени.' },
  { icon: '🛡', title: 'Антиспам и админка', desc: 'Глобальные/персональные банвордс, shadow-баны.' },
  { icon: '📲', title: 'PWA', desc: 'Устанавливается как приложение. Native — скоро.' },
];

const STACK = [
  ['Backend',  'Node 22 · Express · Socket.io · node:sqlite'],
  ['Frontend', 'React 18 · Vite · TailwindCSS · Zustand'],
  ['Realtime', 'WebSocket · WebRTC P2P'],
  ['Deploy',   'Ubuntu · PM2 · Nginx · Let’s Encrypt'],
];

export default function Info() {
  return (
    <div className="min-h-full bg-ink-950 text-white">
      {/* Top nav */}
      <div className="relative z-10 px-6 py-5 flex items-center justify-between">
        <Link to="/info" className="flex items-center gap-2.5">
          <NeuroMark size={28} />
          <span className="font-display text-xl">Neuro</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Войти</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/register">Создать</Link>
          </Button>
        </div>
      </div>

      {/* HERO */}
      <section className="relative px-6 pt-10 pb-24 overflow-hidden">
        <GradientHalo />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <Tag tone="brand">
              <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse-soft" />
              <span>open beta · web</span>
            </Tag>
          </div>
          <h1 className="font-display font-extrabold text-balance text-7xl sm:text-8xl leading-[0.92] tracking-[-0.04em] text-hero">
            Мессенджер<br/>с экономикой XP.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/65 max-w-xl mx-auto text-pretty">
            Привычная скорость Телеграма, плюс магазин кастомизации, казино со слотами
            и кастомный Neuro Premium — за свои собственные баллы.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" asChild>
              <Link to="/register">Начать →</Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <a href="https://github.com/alexkonstich-byte/neuro-chat" target="_blank" rel="noreferrer">⭐ Open Source</a>
            </Button>
          </div>
          <div className="mt-3 text-xs text-white/45">Native iOS / Android — скоро. Уведомление придёт в чат Neuro.</div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-tight">Возможности</h2>
            <div className="text-xs text-white/45 font-mono uppercase tracking-widest hidden sm:block">v0.2 · 2026</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <Card key={f.title} className="group hover:!border-brand-indigo/40 transition" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="text-4xl mb-3">{f.icon}</div>
                <div className="font-display font-semibold text-lg">{f.title}</div>
                <div className="text-sm text-white/60 mt-1.5">{f.desc}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* STACK */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto relative rounded-5xl overflow-hidden">
          <div className="absolute inset-0 bg-hero-soft" />
          <div className="absolute inset-0 bg-mesh-1 opacity-60" />
          <div className="relative px-8 py-12 border border-white/10 rounded-5xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55 mb-2">stack</div>
            <h3 className="font-display font-bold text-3xl sm:text-4xl text-balance mb-2">Минимум зависимостей. Максимум скорости.</h3>
            <p className="text-white/60 text-sm max-w-xl mb-8">Никаких ORM, Docker и платных провайдеров. node:sqlite, PM2 и Nginx — всё, что нужно для домашнего сервера.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STACK.map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-black/30 p-4 border border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-white/45 font-mono">{k}</div>
                  <div className="mt-1.5 text-sm leading-snug">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AUTHOR */}
      <section className="px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <Card className="!p-8 flex items-center gap-6 flex-col sm:flex-row text-center sm:text-left">
            <div className="relative w-24 h-24 shrink-0">
              <div className="absolute inset-0 rounded-full bg-hero-gradient blur-xl opacity-60" />
              <div className="relative w-24 h-24 rounded-full bg-hero-gradient grid place-items-center text-3xl font-display font-black ring-4 ring-ink-700">AS</div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45">создатель</div>
              <div className="font-display font-bold text-3xl mt-1">Alex Serguntsov</div>
              <p className="mt-2 text-white/65">
                Делаю Neuro как личный мессенджер: open-source, свой сервер, свои правила.
                Если нашёл баг — пиши в чат «Neuro» внутри приложения.
              </p>
              <div className="mt-4 flex items-center justify-center sm:justify-start gap-2">
                <Button asChild size="sm"><Link to="/login">Войти</Link></Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://github.com/alexkonstich-byte/neuro-chat" target="_blank" rel="noreferrer">GitHub</a>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <footer className="px-6 py-10 text-center text-xs text-white/40 border-t border-white/5">
        <div className="font-mono">© {new Date().getFullYear()} Neuro · neurochat.space</div>
        <div className="mt-1">Made with ❤️ on a home Ubuntu server.</div>
      </footer>
    </div>
  );
}
