# Развёртывание Neuro

Полные инструкции по запуску у себя на Ubuntu 22.04 desktop / server.

> TL;DR — на чистой машине: `git clone … ~/neuro && cd ~/neuro && bash deploy/bootstrap.sh`. Всё.

---

## 📋 Что нужно перед запуском

1. **Ubuntu 22.04** desktop или server (ARM/x86_64).
2. **Доменное имя** (например `neurochat.space`), у которого A-запись смотрит на твой публичный IP.
3. **Открытые порты** на роутере: `80/tcp` (для certbot и редиректа) и `443/tcp` (HTTPS).
   Если работаешь через домашний роутер — пробрось **80→80** и **443→443** на локальный IP машины.
4. **1 ГБ RAM минимум** (комфортно — 2 ГБ), 5 ГБ диска.

Проверка, что домен указывает на твой сервер:
```bash
dig +short neurochat.space      # должен вернуть твой публичный IP
curl -I http://neurochat.space  # после установки nginx
```

---

## 🚀 Установка с нуля (одна команда)

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/alexkonstich-byte/neuro-chat.git ~/neuro
cd ~/neuro
bash deploy/bootstrap.sh
```

`bootstrap.sh` делает всё:

| Шаг | Что |
|-----|-----|
| 1 | apt: Node 22 (NodeSource), PM2, Nginx, certbot, build-essential, rsync, ufw |
| 2 | ufw: открыть `22 / 80 / 443` |
| 3 | rsync твоего клона в `/opt/neuro` (исключает `node_modules`, `data/`, `dist/`, `.env`) |
| 4 | Скопировать `.env.example` → `.env`, подставить `PUBLIC_ORIGIN=https://$DOMAIN` |
| 5 | `npm install --omit=dev` (server) + `npm install && npm run build` (web) |
| 6 | Положить `nginx-http.conf` (без SSL), сделать `nginx -t` + reload |
| 7 | `certbot certonly --webroot -w /var/www/letsencrypt -d $DOMAIN -d www.$DOMAIN` → выпустить сертификат |
| 7.5 | Если сертификат есть — подменить `nginx.conf` (с HTTPS) и reload |
| 8 | `pm2 delete neuro-server` (на всякий) → `pm2 start /opt/neuro/deploy/ecosystem.config.cjs` → `pm2 save` → `pm2 startup` |

Переопределить дефолты:

```bash
DOMAIN=mychat.example  EMAIL=me@example.com  APP_DIR=/srv/neuro \
  bash deploy/bootstrap.sh
```

После завершения — открой `https://your-domain` и регистрируйся.

> **Первый пользователь с username `alexserguntsov` автоматически становится админом.**
> Если хочешь другой username — поменяй `ADMIN_USERNAME` в `server/src/service.js` перед первым запуском.

---

## 🔄 Обновления

**Один скрипт делает всё:**

```bash
# Из локального чекаута (синкает /opt/neuro и пересобирает фронт):
bash /opt/neuro/deploy/update.sh

# Подтянуть ПОСЛЕДНИЕ изменения с GitHub и обновить /opt/neuro:
GIT=1 bash /opt/neuro/deploy/update.sh
```

Под капотом: `rsync` или `git pull` → `npm ci` → `npm run build` → `pm2 delete && pm2 start` → `nginx -s reload`.

`pm2 delete` важен: `pm2 reload` не перечитывает изменения путей в `ecosystem.config.cjs`, а `delete` + `start` — перечитывает.

Можно повесить cron / GitHub-webhook — обновления станут автоматическими.

---

## 🏗 Что и где после установки

```
/opt/neuro/                                ← основная установка
├── server/
│   ├── src/                               ← код бэкенда
│   ├── node_modules/                      ← зависимости
│   ├── .env                               ← PUBLIC_ORIGIN, PORT, …
│   └── data/                              ← ⚠️ БЭКАПЬ ЭТО
│       ├── neuro.db                       ← вся база (SQLite)
│       ├── uploads/                       ← аватары, фото, видео, голосовые, кружки
│       └── pm2-*.log                      ← логи сервера
├── web/
│   ├── src/                               ← код фронтенда
│   └── dist/                              ← собранный фронт (его раздаёт nginx)
└── deploy/
    ├── ecosystem.config.cjs               ← PM2
    ├── nginx.conf · nginx-http.conf       ← конфиги nginx (копируются в /etc/nginx/sites-available/neuro)
    ├── bootstrap.sh · update.sh
    └── ...
```

Ещё:

| Что | Где |
|-----|-----|
| nginx symlink | `/etc/nginx/sites-enabled/neuro → /etc/nginx/sites-available/neuro` |
| SSL-сертификат | `/etc/letsencrypt/live/your-domain/` (root-only) |
| PM2 dump (что запускать при загрузке) | `~/.pm2/dump.pm2` |
| systemd-юнит автозапуска PM2 | `/etc/systemd/system/pm2-USER.service` |

---

## 🔒 SSL

`bootstrap.sh` сам делает всё:
1. Сначала ставит **HTTP-only** конфиг nginx (он умеет только редиректить и слушать ACME-challenge).
2. Запускает `certbot certonly --webroot` — он кладёт challenge в `/var/www/letsencrypt`, валидирует, выписывает сертификат.
3. Затем меняет nginx-конфиг на полноценный HTTPS-вариант и делает reload.

Автопродление работает через `systemd timer certbot.timer` (ставится пакетом certbot). Проверить:

```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

Если `certbot` упал на установке (домен не указывает на сервер / порты закрыты) — запусти ещё раз вручную:

```bash
sudo certbot certonly --webroot -w /var/www/letsencrypt -d your-domain -d www.your-domain
sudo cp /opt/neuro/deploy/nginx.conf /etc/nginx/sites-available/neuro
sudo sed -i "s|neurochat.space|your-domain|g" /etc/nginx/sites-available/neuro
sudo nginx -t && sudo systemctl reload nginx
```

---

## 🛠 Управление

```bash
# Состояние и логи
pm2 status
pm2 logs neuro-server --lines 50
pm2 restart neuro-server
pm2 stop neuro-server

# Nginx
sudo nginx -t                       # проверить конфиг
sudo systemctl reload nginx

# Certbot
sudo certbot renew                  # обновить сертификат вручную
```

**Бэкап базы:**

```bash
cp /opt/neuro/server/data/neuro.db /opt/neuro/server/data/neuro.db.bak.$(date +%F)
```

**Восстановить базу:**

```bash
pm2 stop neuro-server
cp /path/to/backup.db /opt/neuro/server/data/neuro.db
pm2 start neuro-server
```

---

## 🧰 Локальная разработка (Windows / macOS / Linux)

```bash
# терминал 1 — backend
cd server
cp .env.example .env
npm install
npm run dev      # node --watch --experimental-sqlite src/index.js (port 3001)

# терминал 2 — frontend
cd web
npm install
npm run dev      # Vite на 5173 с прокси на 3001
```

Открой http://localhost:5173. Vite проксирует `/api`, `/socket.io`, `/uploads` на 3001.

---

## 🆘 FAQ / частые проблемы

**Q. Открыл `https://...` — `502 Bad Gateway`.**
A. Не запущен Node. `pm2 status` → `pm2 restart neuro-server`. Посмотри `pm2 logs neuro-server --lines 50`.

**Q. Открыл сайт — белый экран / 404.**
A. Не собран фронт. `bash /opt/neuro/deploy/update.sh` или вручную `cd /opt/neuro/web && npm run build`.

**Q. `node:sqlite is experimental`.**
A. Это норма на Node 22. PM2 уже запускает с `--experimental-sqlite`.

**Q. WebSocket не коннектится через Nginx.**
A. В `nginx.conf` блок `/socket.io/` обязательно должен иметь `Upgrade`/`Connection: upgrade` (они есть в шаблоне).

**Q. Звонки не идут между разными сетями.**
A. STUN-only (Google STUN) хватает только если у обоих участников открыт NAT. Поставь TURN-сервер (coturn) — отдельная задача.

**Q. PM2 запускается, но `Cannot find package 'express'`.**
A. PM2 закешировал старые пути. `pm2 delete neuro-server && pm2 start /opt/neuro/deploy/ecosystem.config.cjs`.

**Q. `certbot` ругается, что директорию не видит.**
A. У `bootstrap.sh` уже есть `sudo test -d` для проверки. Если запускаешь вручную — помни, что `/etc/letsencrypt/live` доступна только root.

**Q. Хочу свести node_modules / dist для пересобора.**
A. `rm -rf /opt/neuro/web/node_modules /opt/neuro/web/dist && bash /opt/neuro/deploy/update.sh`.

---

## 🌍 Опционально: TURN-сервер для звонков из любой сети

Без TURN P2P-звонки не пройдут через симметричные NAT (мобильный интернет, корпоративные сети). Базовый coturn:

```bash
sudo apt install -y coturn
# /etc/turnserver.conf:
# listening-port=3478
# realm=neurochat.space
# fingerprint
# lt-cred-mech
# user=neuro:STRONG_PASSWORD
# external-ip=YOUR.PUBLIC.IP
sudo systemctl enable --now coturn
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:65535/udp
```

В клиенте (`web/src/components/GroupCall.jsx` и `web/src/pages/Chat.jsx`) добавь TURN в `iceServers`:

```js
[
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:neurochat.space:3478', username: 'neuro', credential: 'STRONG_PASSWORD' },
]
```

После — пересобери фронт: `bash /opt/neuro/deploy/update.sh`.

---

Готово. Если что-то отвалилось — открой issue в репозитории или напиши прямо в чат **Neuro** внутри приложения (кнопка «🐞 Баг»).
