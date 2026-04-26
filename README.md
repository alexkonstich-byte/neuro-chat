# Neuro

Telegram-функциональный мессенджер. Кастомный «Neuro Premium» вместо телеграм-премиума, XP-экономика, магазин кастомизации, казино с джекпотом, огоньки дружбы, админка.

Боевой адрес: **https://neurochat.space**
Лендинг: **https://neurochat.space/info**

---

## Стек

- **Backend:** Node.js ≥22.5 (ES modules), Express, Socket.io, встроенный `node:sqlite`. Никаких сторонних SQLite-драйверов и ORM.
- **Frontend:** React 18, Vite, TailwindCSS, Zustand. PWA через `vite-plugin-pwa`.
- **Process:** PM2.
- **Reverse proxy:** Nginx + Let's Encrypt (certbot).
- **OS:** Ubuntu 22.04.

---

## 🚀 Быстрая установка на твой Ubuntu 22.04 (один скрипт)

> У тебя домашний сервер с белым IP, домен **neurochat.space** уже указывает на него.
> Ниже — путь «всё одной командой».

### A. Что нужно проверить ДО запуска

1. **Домен указывает на сервер.** Проверь `dig +short neurochat.space` — должен вернуть твой публичный IP. И для `www.neurochat.space` тоже желательно (но необязательно).
2. **Порты пробросены/открыты на роутере и в Ubuntu**:
   - **80/tcp** (HTTP, нужен certbot для выдачи сертификата)
   - **443/tcp** (HTTPS, основной)
   - **22/tcp** (SSH — если заходишь по сети; на самом сервере не обязателен)

   Если сидишь за домашним роутером — пробрось в его настройках **80→80** и **443→443** на локальный IP компьютера-сервера.
   Скрипт `bootstrap.sh` сам откроет 22/80/443 в `ufw`.

3. **Системные требования:** 1 ГБ RAM минимум (комфортно — 2 ГБ), 5 ГБ свободного места.

### B. Запуск

```bash
# 1) Скачай репу куда хочешь (скрипт сам перенесёт в /opt/neuro)
git clone https://github.com/alexkonstich-byte/neuro-chat.git ~/neuro
cd ~/neuro

# 2) Поставь всё одной командой:
bash deploy/bootstrap.sh
```

Скрипт сам:
- поставит Node 22, PM2, Nginx, certbot;
- откроет порты 22/80/443 в ufw;
- скопирует код в `/opt/neuro` (если он не там);
- сделает `npm install` и `npm run build`;
- положит nginx-конфиг с правильным доменом, перезапустит nginx;
- запросит Let's Encrypt сертификат для `neurochat.space` и `www.neurochat.space`;
- запустит сервер через PM2 и пропишет автозапуск при загрузке.

После успешного завершения открой **https://neurochat.space** — увидишь экран логина.
Зарегистрируйся под `alexserguntsov` — этот пользователь автоматически становится админом, у тебя появится кнопка `/admin`.

> **Если certbot ругается** — значит домен ещё не указывает на сервер с интернета,
> или 80-й порт не проброшен. Проверь и перезапусти `sudo certbot --nginx -d neurochat.space -d www.neurochat.space`.

### C. Обновление кода

Просто запусти:

```bash
bash /opt/neuro/deploy/update.sh
```

Скрипт сделает `git reset --hard origin/main`, пересоберёт фронт, перезапустит PM2 и обновит nginx. Можно повесить на cron / GitHub-webhook.

---

## 🧰 Локальная разработка (на любой машине)

```bash
# терминал 1 — backend
cd server
cp .env.example .env
npm install
npm run dev      # node --watch --experimental-sqlite src/index.js (port 3001)

# терминал 2 — frontend
cd web
npm install
npm run dev      # vite на :5173, прокси на 3001
```

Открой http://localhost:5173.

---

## 🔐 Авторизация

- **Логин:** username + password.
- **Регистрация:** username + password + имя.
- **Войти на другом устройстве по коду:** уже залогиненный пользователь жмёт в Профиле «Войти на другом устройстве» → 8-значный код. На новом устройстве: «Войти по коду» → username + код. Код также падает в чат **Neuro**.

**Админ:** первый пользователь с username `alexserguntsov` автоматически получает `is_admin = 1`.

Все системные события (вход в аккаунт, выдача кода, джекпот в казино) приходят в служебный чат **Neuro**, который автоматически создаётся для каждого пользователя.

Каждому пользователю также сразу создаётся чат **Избранное** — закрепляется сверху, никто кроме тебя его не видит.

---

## 🌐 Архитектура и порты

```
Browser ──► Nginx :443 ─┬─► /                 → /opt/neuro/web/dist (статика SPA)
                        ├─► /api/             → 127.0.0.1:3001 (Node)
                        ├─► /socket.io/       → 127.0.0.1:3001 (WebSocket)
                        └─► /uploads/         → /opt/neuro/server/data/uploads (статика)
```

- **Внешние порты:** 80 (редирект на 443) и 443 (HTTPS). Всё.
- **Внутренний порт Node-сервера:** 3001 (наружу не торчит).

---

## 📁 Что и где лежит на сервере

После `bootstrap.sh`:

```
/opt/neuro/
├── server/
│   ├── .env                # настройки (PORT, PUBLIC_ORIGIN, DATA_DIR…)
│   ├── data/
│   │   ├── neuro.db        # SQLite — это вся база. Бэкапь её копированием.
│   │   ├── uploads/        # фото, видео, голосовые, аватары
│   │   └── pm2-*.log       # логи
│   └── src/...
├── web/
│   └── dist/               # собранный фронт, который раздаёт nginx
└── deploy/
    ├── ecosystem.config.cjs  # PM2 конфиг
    ├── nginx.conf            # копия в /etc/nginx/sites-available/neuro
    ├── bootstrap.sh
    └── update.sh
```

---

## 🛠 Управление сервером

```bash
pm2 status                 # состояние процесса
pm2 logs neuro-server      # хвост логов
pm2 restart neuro-server   # перезапустить
pm2 stop neuro-server      # остановить

sudo systemctl reload nginx
sudo certbot renew         # обновление сертификата (cron уже есть от пакета certbot)
```

**Бэкап базы:**

```bash
cp /opt/neuro/server/data/neuro.db /opt/neuro/server/data/neuro.db.bak.$(date +%F)
```

---

## ✨ Что работает в v0.2

- 🔐 Авторизация username/password + код-вход с другого устройства.
- 💬 Чаты 1-на-1, реакции, ответы, редактирование/удаление, печатает, presence.
- 🔖 «Избранное» (self-чат) автоматически у каждого, закреплено сверху.
- 🤖 Системный бот **Neuro** шлёт логи входов и коды в личный чат пользователя.
- 📎 Фото / видео / файлы / голосовые / видеокружки.
- 📞 Аудио и видеозвонки P2P (WebRTC + STUN). Без TURN за NAT может не пройти — отдельный шаг.
- 💰 XP за сообщение (настройка `xp_per_message` в админке), антифлуд (повторы и burst-окно).
- 🛒 Магазин: 10 анимированных фонов, 4 обводки, множители x2/x5/x10, нейроны, слот префикса. **Возврат — 5 минут.**
- 🎰 Казино: слоты, бан-блок, лидерборд день/неделя/месяц, **джекпот 7-7-7 = +Neuro Premium 3 мес.**
- 🔥 Огоньки дружбы в DM (3+ дня подряд).
- ✦ Premium: цвет ника, цвет/эмодзи в префиксе, кастомный эмодзи после ника.
- ⚙ Админка: ±XP, ±нейроны, премиум, бан, shadow-ban, банвордс (global/per-user), настройки, эксклюзивные предметы и их выдача.
- 📲 PWA — устанавливается «как приложение» на Android/iOS/Desktop.
- 🌍 Публичный лендинг **/info**.

## 📌 Что осталось

- TURN-сервер (coturn) для звонков за NAT.
- Группы и каналы (таблицы готовы, UI и ручек нет).
- Native iOS/Android.
- Превью ссылок, упоминания, синк прочитано в реальном времени.

---

## 🆘 FAQ / частые проблемы

**Q. Открыл `https://neurochat.space` — `502 Bad Gateway`.**
A. Не запущен Node. `pm2 status` → `pm2 restart neuro-server`. Посмотри `pm2 logs neuro-server`.

**Q. Открыл `http://neurochat.space` — белый экран / 404.**
A. Не собран фронт. `bash /opt/neuro/deploy/update.sh` или вручную `cd /opt/neuro/web && npm run build`.

**Q. `node:sqlite is experimental`.**
A. Это норма на Node 22. PM2 уже запускает с `--experimental-sqlite`.

**Q. WebSocket не коннектится через Nginx.**
A. В `nginx.conf` для `/socket.io/` обязательны `Upgrade`/`Connection: upgrade` — они уже есть. Если используешь свой кастомный конфиг — скопируй блок из `deploy/nginx.conf`.

**Q. Звонки не идут между разными сетями.**
A. Поставь TURN-сервер (coturn) — отдельный шаг. STUN-only хватает только если у обоих участников открыт NAT.
