<div align="center">

# Neuro

**Open-source мессенджер с собственной экономикой XP.**
Скорость Телеграма + магазин кастомизации, казино со слотами и кастомный Premium —
всё за свои собственные баллы, без покупок реальных денег.

🌐 **Живая версия:** [neurochat.space](https://neurochat.space) · [neurochat.space/info](https://neurochat.space/info)

</div>

---

## ✨ Что внутри

- 💬 **Real-time чаты** — реакции, ответы, редактирование, удаление, печатает, presence, прочитано.
- 📞 **Аудио и видеозвонки** — P2P через WebRTC. Личные и групповые (mesh-режим).
- 🎙 **Голос и кружки** — push-to-hold (жми и держи). Кружки — закруглённые квадраты с превью себя.
- 🔖 **Избранное и Neuro-бот** — автоматически создаются для каждого. В чат Neuro идут коды входа и заявки в поддержку.
- 🛒 **Магазин за XP** — 10+ анимированных фонов, обводки (включая радужную, пульсирующую, ауроровую), множители опыта, нейроны, префиксы.
- 🎰 **Казино** — слоты с лидербордом. Джекпот 7-7-7 = Premium на 3 месяца.
- 🔥 **Огоньки дружбы** — общайся каждый день, и счётчик в чате растёт. Прервёшь — обнулится.
- ✦ **Neuro Premium** — цвет ника, цвет префикса, кастомный эмодзи, эксклюзивные косметики.
- 👑 **VIP** — анимированные косметики бесплатно, видео-аватарка, особый значок.
- 🛡 **Антиспам и админка** — глобальные/персональные банвордс, shadow-баны, инбокс заявок (баги и идеи).
- 📲 **PWA** — устанавливается «как приложение» на телефон или ПК.
- 🌌 **Дизайн** — Bricolage Grotesque + Plus Jakarta Sans, indigo→fuchsia→sky градиенты, halo-меши, spring-анимации.

## 🧱 Стек

| Слой | Технология |
|------|------------|
| **Backend** | Node.js ≥22 (ESM) · Express · Socket.io · `node:sqlite` (без ORM, без сторонних драйверов) |
| **Frontend** | React 18 · Vite · TailwindCSS · Zustand · `vite-plugin-pwa` |
| **Realtime** | WebSocket · WebRTC P2P (STUN; coturn опционально) |
| **Deploy** | Ubuntu 22.04 · PM2 · Nginx · Let's Encrypt (certbot) |

Никаких Docker-контейнеров, ORM, сторонних SQLite-драйверов и платных сервисов.
Один SQLite-файл — вся база. Один bash-скрипт — установка с нуля. Бэкап = `cp neuro.db neuro.db.bak`.

## 🚀 Запуск у себя

Полная инструкция: **[DEPLOY.md](./DEPLOY.md)**.

TL;DR на чистом Ubuntu 22.04:

```bash
git clone https://github.com/alexkonstich-byte/neuro-chat.git ~/neuro
cd ~/neuro
bash deploy/bootstrap.sh
```

Это поставит Node 22, PM2, Nginx, certbot, скопирует код в `/opt/neuro`, выпустит Let's Encrypt SSL и запустит сервер. После — открой `https://your-domain` и регистрируйся.

> Первый пользователь с username `alexserguntsov` автоматически становится админом.

## 📡 Архитектура

```
Browser
  │
  └─► Nginx :443 ─┬─► /              → SPA из /opt/neuro/web/dist
                  ├─► /api/          → 127.0.0.1:3001 (Node)
                  ├─► /socket.io/    → 127.0.0.1:3001 (WebSocket)
                  └─► /uploads/      → /opt/neuro/server/data/uploads (отдаёт сам nginx)
```

Внутрь интернета смотрят только 80 (редирект) и 443 (HTTPS). Node слушает 3001 локально.

## 🗺 Структура

```
.
├── server/           # Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── routes/   # auth · profile · chats · shop · casino · admin · feedback · uploads
│   │   ├── db.js     # вся схема SQLite + миграции
│   │   ├── socket.js # сокет-сервер: чат, реакции, типинг, presence, WebRTC сигналинг
│   │   ├── xp.js     # XP, антифлуд, множители, премиум, огоньки дружбы
│   │   └── service.js# системный бот Neuro, Saved chat, login alerts
│   └── data/         # SQLite + uploads (бэкапь это)
├── web/              # React 18 + Vite frontend
│   └── src/
│       ├── pages/    # Login · Register · Info · Chats · Chat · Profile · Shop · Casino · Admin · Settings
│       ├── components/  # ui, ContextMenu, GroupCall, UserChip
│       └── utils/    # image resizer, etc.
├── deploy/
│   ├── bootstrap.sh  # одна команда — ставит всё с нуля
│   ├── update.sh     # одна команда — обновляет всё
│   ├── nginx.conf    # HTTPS
│   ├── nginx-http.conf  # HTTP-only для фазы certbot
│   └── ecosystem.config.cjs # PM2
└── DEPLOY.md         # полные инструкции
```

## 🤝 Как помочь

- **Нашёл баг или хочешь фичу?** Зайди в чат **Neuro** внутри приложения — там кнопки «Баг», «Идея», «Сообщение админу». Заявки попадают в админ-инбокс автора.
- **Хочешь PR?** Форкай, создавай ветку, открывай pull request на `main`.

## 📜 Лицензия

MIT. Полный текст — в [LICENSE](./LICENSE) (если файла нет, считай что это MIT).

## 👤 Автор

**Alex Serguntsov** — делает Neuro как личный домашний мессенджер.

---

<div align="center">

Made with ❤️ on a home Ubuntu server.

</div>
