import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AllsafeMark, GradientHalo, Button, Tag, Card } from '../components/ui.jsx';

const FEATURES = [
  { icon: '💬', title: 'Real-time чаты',         desc: 'Реакции, ответы, редактирование, удаление, печатает, presence, прочитано.' },
  { icon: '📞', title: 'Аудио и видеозвонки',    desc: 'P2P через WebRTC. Личные и групповые (mesh) — прямо из браузера.' },
  { icon: '🎙', title: 'Голос и кружки',         desc: 'Push-to-hold: жми и держи. Кружки — закруглённые квадраты с превью себя.' },
  { icon: '🛒', title: 'Магазин за XP',          desc: 'Анимированные фоны, обводки, префиксы, множители опыта, нейроны.' },
  { icon: '🎰', title: 'Казино со слотами',      desc: 'Лидерборд, джекпот 7-7-7 = Allsafe Premium на 3 месяца.' },
  { icon: '🔥', title: 'Огоньки дружбы',         desc: 'Общайся каждый день — счётчик растёт, прервёшь — обнулится.' },
  { icon: '✦', title: 'Allsafe Premium',        desc: 'Цвет ника, цвет префикса, кастомный эмодзи, эксклюзивные косметики.' },
  { icon: '👑', title: 'VIP',                    desc: 'Анимированные фоны и обводки бесплатно, видео-аватарка, значок 👑.' },
  { icon: '🛡', title: 'Антиспам и админка',     desc: 'Глобальные/персональные банвордс, shadow-баны, инбокс заявок.' },
  { icon: '📲', title: 'PWA',                    desc: 'Устанавливается как приложение на телефон или ПК. Native — скоро.' },
];

const STACK = [
  ['Backend',  'Node 22 · Express · Socket.io · node:sqlite'],
  ['Frontend', 'React 18 · Vite · TailwindCSS · Zustand'],
  ['Realtime', 'WebSocket · WebRTC P2P'],
  ['Deploy',   'Ubuntu · PM2 · Nginx · Let’s Encrypt'],
];

const CHANGELOG = [
  {
    version: 'v0.6',
    date: '2026-05-01',
    title: 'Ребрендинг: Neuro → Allsafe',
    items: [
      'Новое имя — Allsafe. Подчёркивает приватность и безопасность переписки',
      'Новый логотип-щит с галочкой и орбитальной искрой',
      'Бренд везде обновлён: вход, регистрация, /info, чат-бот, профиль, magnet, PWA-иконки',
      'Чат «Neuro» автоматически переименован в «Allsafe» (миграция при старте сервера)',
      'Premium теперь называется «Allsafe Premium»',
      'Манифест PWA, тайтл вкладки и favicon обновлены',
      'Внутренние идентификаторы (DB-username бота, токен localStorage, имя PM2-процесса) сохранены — никого не разлогинит',
    ],
  },
  {
    version: 'v0.5',
    date: '2026-05-01',
    title: 'Темы, медиаплеер, VIP, видео-аватары',
    items: [
      '6 тем оформления (Midnight / Aurora / Sunset / Ocean / Mono / Daylight) — переключаются мгновенно',
      'Кастомный медиаплеер во весь экран: фото, видео, кружки, голосовые, файлы',
      'Кружки и видео — со своим play-overlay и предпросмотром',
      'Голосовые — собственный плеер с волной, сменой скорости 1× / 1.5× / 2×',
      'Свайп-вправо по сообщению на телефоне = быстрый ответ',
      'VIP визуал: золотая корона 👑 на аватаре, светящееся кольцо',
      'VIP получает все косметические предметы из магазина бесплатно',
      'Видео-аватарка до 5 сек (mp4 / webm) — для Premium и VIP',
      'Анимированные GIF / WebP в аватаре теперь сохраняются как есть',
      'Новые анимированные обводки: Пульс, Аврора, Угольки',
      'Онбординг для новичков: 4-шаговый туториал при первом входе',
      'Эксклюзив-конструктор: live-превью предмета на твоём аватаре до создания',
      '/shop/item/:code — отдельная страница каждого предмета с большим превью',
      'CSS-переменные для палитры — теперь весь UI зависит от выбранной темы',
    ],
  },
  {
    version: 'v0.4',
    date: '2026-04-26',
    title: 'Большой UX-ремонт',
    items: [
      'Push-to-hold голосовые и кружки — жми и держи, отпустишь = отправлено',
      'Кружок теперь закруглённый квадрат, с превью камеры во время записи',
      'Кастомное контекстное меню по сообщениям и пользователям (правая кнопка / долгое нажатие)',
      'Toast-уведомления о покупках, начислениях, премиуме',
      'Магазин: рич-превью предметов с твоим аватаром и ником, тап → сравнение',
      'Префикс из инвентаря — применяется сразу, без открытия профиля',
      'Поля в профиле: дата рождения, телефон, статус (эмодзи + текст)',
      'Кнопка показать пароль · код-вход выровнен слева',
      'Раздел «Настройки» отделён от профиля — темы, сессии, безопасность',
      'Сообщения в чате Allsafe теперь нормальные, плюс кнопки «Баг» / «Идея» / «Админу»',
      'VIP-флаг в админке + новые анимированные обводки в магазине',
      'Десктоп: список чатов больше не скроллится при работе с магазином',
    ],
  },
  {
    version: 'v0.3',
    date: '2026-04-25',
    title: 'Десктоп-режим и фикс деплоя',
    items: [
      '2-колоночный лейаут на ≥1024px (как Telegram Desktop)',
      'bootstrap.sh: HTTP-only nginx → certbot → HTTPS — починка SSL chicken-and-egg',
      'update.sh с режимом GIT=1 — одной командой обновляется с GitHub',
      'PM2 теперь корректно перечитывает конфиг при reload',
    ],
  },
  {
    version: 'v0.2',
    date: '2026-04-24',
    title: 'Группы и групповые звонки',
    items: [
      'Создание групп, добавление/удаление участников',
      'Групповые звонки в формате mesh-WebRTC (до ~6 человек без TURN)',
      'Свайп-back на телефонах и pull-to-refresh для списка чатов',
      'Дизайн-система: Bricolage Grotesque + Plus Jakarta Sans + indigo→fuchsia→sky',
    ],
  },
  {
    version: 'v0.1',
    date: '2026-04-23',
    title: 'Первый запуск',
    items: [
      'Username/password + код-вход с другого устройства',
      'Чаты «Избранное» и «Allsafe» создаются автоматически',
      'XP за сообщение, антифлуд, множители',
      'Магазин, инвентарь, возврат за 5 минут',
      'Казино со слотами и лидербордом',
      'Огоньки дружбы 🔥 в личных чатах',
    ],
  },
];

export default function Info() {
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-full bg-ink-950 text-white">
      {/* Sticky nav with logo that drifts left of "Allsafe" */}
      <div className={`sticky top-0 z-30 transition-all ${scrolled ? 'surface-strong border-b border-white/5' : ''}`}>
        <div className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
          <Link to="/info" className="flex items-center group" aria-label="Allsafe home">
            <span className={`transition-transform duration-500 ease-out ${scrolled ? '-translate-x-1' : 'translate-x-0'}`}>
              <AllsafeMark size={30} />
            </span>
            <span className={`ml-2 font-display font-bold text-xl tracking-tight transition-all duration-500
              ${scrolled ? 'opacity-100 translate-x-0' : 'opacity-100 translate-x-0'}`}>
              Allsafe
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/login">Войти</Link></Button>
            <Button size="sm" asChild><Link to="/register">Создать</Link></Button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <section ref={heroRef} className="relative px-6 pt-12 pb-28 overflow-hidden">
        <GradientHalo />
        <div className="relative max-w-3xl mx-auto text-center">
          <Tag tone="brand" className="mb-6 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse-soft" />
            open beta · web
          </Tag>

          {/* Big logo to the LEFT of "Allsafe" — sits inline on desktop */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="hidden sm:block animate-pop sparkle">
              <AllsafeMark size={88} glow />
            </div>
            <h1 className="font-display font-extrabold text-balance text-7xl sm:text-8xl leading-[0.92] tracking-[-0.04em] text-hero">
              Allsafe
            </h1>
          </div>
          <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-hero leading-tight mb-5">
            Безопасный мессенджер<br/>с экономикой XP
          </h2>
          <p className="text-lg sm:text-xl text-white/65 max-w-xl mx-auto text-pretty">
            Скорость Телеграма, плюс магазин кастомизации, казино со слотами
            и кастомный Allsafe Premium — за свои собственные баллы.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" asChild><Link to="/register">Начать →</Link></Button>
            <Button variant="ghost" size="lg" asChild>
              <a href="https://github.com/alexkonstich-byte/neuro-chat" target="_blank" rel="noreferrer">⭐ Open Source</a>
            </Button>
          </div>
          <div className="mt-3 text-xs text-white/45">Native iOS / Android — скоро. Уведомление придёт в чат Allsafe.</div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-tight">Возможности</h2>
            <div className="text-xs text-white/45 font-mono uppercase tracking-widest hidden sm:block">v0.4 · 2026</div>
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

      {/* CHANGELOG */}
      <section className="px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-tight">Что нового</h2>
            <Tag>changelog</Tag>
          </div>
          <div className="relative pl-4">
            {/* timeline rail */}
            <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-brand-indigo/60 via-brand-fuchsia/40 to-transparent" />
            <div className="space-y-6">
              {CHANGELOG.map((rel, i) => (
                <div key={rel.version} className="relative">
                  <div className={`absolute -left-[7px] top-2.5 w-3 h-3 rounded-full ${i === 0 ? 'bg-hero-gradient shadow-glow-brand' : 'bg-white/30'}`} />
                  <Card className="ml-4">
                    <div className="flex items-baseline gap-2 flex-wrap mb-1">
                      <span className="font-display font-bold text-2xl">{rel.version}</span>
                      <Tag tone={i === 0 ? 'brand' : 'default'}>{rel.date}</Tag>
                      <span className="font-display text-lg text-white/85">— {rel.title}</span>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm text-white/75 list-none">
                      {rel.items.map((it, k) => (
                        <li key={k} className="flex gap-2">
                          <span className="text-brand-sky shrink-0">›</span>
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 text-center text-xs text-white/45">
            Полная история коммитов — на <a className="hover:text-white underline" href="https://github.com/alexkonstich-byte/neuro-chat" target="_blank" rel="noreferrer">GitHub</a>.
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
                Делаю Allsafe как личный мессенджер: open-source, свой сервер, свои правила.
                Если нашёл баг или хочешь предложить фичу — пиши прямо в чат «Allsafe» внутри приложения.
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
        <div className="font-mono">© {new Date().getFullYear()} Allsafe · neurochat.space</div>
        <div className="mt-1">Made with ❤️ on a home Ubuntu server.</div>
      </footer>
    </div>
  );
}
