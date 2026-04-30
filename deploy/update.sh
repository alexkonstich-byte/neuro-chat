#!/usr/bin/env bash
# Self-contained updater for Neuro.
#
# Run it from ANYWHERE — the script figures out the source code, the install
# directory, the user PM2 should run as, then syncs, builds, restarts PM2
# (with proper delete+start so config changes are picked up), refreshes the
# nginx config, and does a health-check on port 3001.
#
# Usage:
#   bash deploy/update.sh                 # smart auto-detect
#   GIT=1  bash deploy/update.sh          # force fetch from GitHub (clone)
#   APP_DIR=/srv/neuro bash update.sh     # custom install location
#   BRANCH=redesign-bootstrap-voice-fixes GIT=1 bash deploy/update.sh
#   DOMAIN=mychat.example bash update.sh  # also rewrite nginx for this domain
#
# Env vars (all optional):
#   APP_DIR     where Neuro lives on disk      (default: /opt/neuro)
#   APP_USER    OS user PM2 runs as            (default: owner of APP_DIR)
#   REPO_URL    git remote                     (default: GitHub canonical)
#   BRANCH      git branch                     (default: main)
#   DOMAIN      public domain                  (default: keep what's in nginx)
#   GIT=1       always clone fresh from GitHub
#   SKIP_NGINX=1   skip the nginx step
#   SKIP_BUILD=1   skip the web build step (server-only update)

set -eo pipefail

# ─────────────── helpers ───────────────
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
bad()  { printf '\033[31m%s\033[0m\n' "$*"; }
note() { printf '\033[2m%s\033[0m\n' "$*"; }

need_sudo() {
  if [ "$(id -u)" -ne 0 ] && ! command -v sudo >/dev/null 2>&1; then
    bad "ERROR: this script needs root privileges (sudo) to write into $APP_DIR and reload nginx."
    exit 1
  fi
}

# ─────────────── 0. defaults ───────────────
APP_DIR="${APP_DIR:-/opt/neuro}"
REPO_URL="${REPO_URL:-https://github.com/alexkonstich-byte/neuro-chat.git}"
BRANCH="${BRANCH:-main}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SRC_DIR="$( cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd )"

# Auto-detect APP_USER from the install dir owner if not given.
if [ -z "${APP_USER:-}" ]; then
  if [ -d "$APP_DIR" ]; then
    APP_USER="$(stat -c '%U' "$APP_DIR" 2>/dev/null)" || true
  fi
  [ -z "$APP_USER" ] && APP_USER="${SUDO_USER:-$USER}"
fi
APP_HOME="$(getent passwd "$APP_USER" 2>/dev/null | cut -d: -f6)"
[ -z "$APP_HOME" ] && APP_HOME="/home/$APP_USER"

bold "==> Update Neuro"
bold "    APP_DIR : $APP_DIR"
bold "    APP_USER: $APP_USER  ($APP_HOME)"
bold "    BRANCH  : $BRANCH"
[ -n "${DOMAIN:-}" ] && bold "    DOMAIN  : $DOMAIN"

need_sudo

# ─────────────── 1. fetch / sync source ───────────────
TMP=""
if [ "${GIT:-0}" = "1" ]; then
  bold "==> [1/7] git clone (forced) $REPO_URL ($BRANCH)"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$TMP/repo"
  SRC_DIR="$TMP/repo"
elif [ ! -d "$SRC_DIR/server" ] || [ ! -d "$SRC_DIR/web" ]; then
  bold "==> [1/7] no local checkout near update.sh — cloning $REPO_URL ($BRANCH)"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$TMP/repo"
  SRC_DIR="$TMP/repo"
elif [ "$SRC_DIR" = "$APP_DIR" ] && [ -d "$APP_DIR/.git" ]; then
  bold "==> [1/7] git pull (in-place)"
  ( cd "$APP_DIR" \
      && sudo -u "$APP_USER" git fetch --all --quiet \
      && sudo -u "$APP_USER" git checkout "$BRANCH" --quiet \
      && sudo -u "$APP_USER" git reset --hard "origin/$BRANCH" --quiet )
  # Already in place — no rsync below.
  SKIP_RSYNC=1
else
  bold "==> [1/7] using local checkout: $SRC_DIR"
fi

if [ "${SKIP_RSYNC:-0}" != "1" ]; then
  bold "==> [2/7] rsync $SRC_DIR → $APP_DIR (preserving server/data and .env)"
  sudo mkdir -p "$APP_DIR"
  sudo rsync -a --delete \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'server/data/' \
    --exclude 'web/dist/' \
    --exclude '.env' \
    "$SRC_DIR"/ "$APP_DIR"/
  sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"
else
  bold "==> [2/7] skipping rsync (in-place git pull)"
fi

# Make sure data/ + .env exist
sudo mkdir -p "$APP_DIR/server/data"
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR/server/data"
if [ ! -f "$APP_DIR/server/.env" ] && [ -f "$APP_DIR/server/.env.example" ]; then
  sudo cp "$APP_DIR/server/.env.example" "$APP_DIR/server/.env"
  sudo chown "$APP_USER:$APP_USER" "$APP_DIR/server/.env"
  warn "    .env created from .env.example — review it!"
fi

# ─────────────── 3. install + build ───────────────
bold "==> [3/7] npm install (server)"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/server' && (npm ci --omit=dev || npm install --omit=dev)"

if [ "${SKIP_BUILD:-0}" = "1" ]; then
  bold "==> [4/7] skipping web build (SKIP_BUILD=1)"
else
  bold "==> [4/7] npm install + build (web)"
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/web' && (npm ci || npm install) && npm run build"
fi

# ─────────────── 5. nginx ───────────────
if [ "${SKIP_NGINX:-0}" = "1" ]; then
  bold "==> [5/7] skipping nginx step"
else
  bold "==> [5/7] nginx config refresh"
  if command -v nginx >/dev/null 2>&1 && [ -d /etc/nginx/sites-available ]; then
    PICK_CONF="nginx-http.conf"
    NGINX_DOMAIN="${DOMAIN:-}"
    # Try to detect existing domain from current symlink, if user didn't override.
    if [ -z "$NGINX_DOMAIN" ] && [ -f /etc/nginx/sites-available/neuro ]; then
      NGINX_DOMAIN="$(grep -m1 -E 'server_name\s+' /etc/nginx/sites-available/neuro \
        | awk '{print $2}' | tr -d ';' || true)"
    fi
    [ -z "$NGINX_DOMAIN" ] && NGINX_DOMAIN="neurochat.space"

    # Prefer HTTPS conf if a Let's Encrypt cert exists.
    if sudo test -d "/etc/letsencrypt/live/$NGINX_DOMAIN"; then
      PICK_CONF="nginx.conf"
    fi

    note "    using $PICK_CONF for $NGINX_DOMAIN"
    sudo cp "$APP_DIR/deploy/$PICK_CONF" /etc/nginx/sites-available/neuro
    sudo sed -i "s|neurochat.space|$NGINX_DOMAIN|g" /etc/nginx/sites-available/neuro
    sudo sed -i "s|/opt/neuro|$APP_DIR|g"           /etc/nginx/sites-available/neuro
    sudo ln -sf /etc/nginx/sites-available/neuro /etc/nginx/sites-enabled/neuro
    sudo rm -f /etc/nginx/sites-enabled/default

    if sudo nginx -t; then
      sudo systemctl reload nginx
      ok "    nginx reloaded"
    else
      bad "    nginx -t failed — leaving previous config; investigate /etc/nginx/sites-available/neuro"
    fi
  else
    warn "    nginx not installed — skipping"
  fi
fi

# ─────────────── 6. PM2 ───────────────
bold "==> [6/7] PM2 (delete + start so config changes take effect)"
if ! command -v pm2 >/dev/null 2>&1; then
  bad "    pm2 not installed. Install: sudo npm i -g pm2"
  exit 1
fi

# Make sure the app user actually has a writable PM2 home, otherwise pm2 save bombs out.
sudo -u "$APP_USER" bash -lc "mkdir -p '$APP_HOME/.pm2'"

# Delete any stale registration first (pm2 reload won't re-read ecosystem.config.cjs).
sudo -u "$APP_USER" bash -lc "pm2 delete neuro-server >/dev/null 2>&1 || true"
sudo -u "$APP_USER" bash -lc "pm2 start '$APP_DIR/deploy/ecosystem.config.cjs'"
sudo -u "$APP_USER" bash -lc "pm2 save"

# Make sure systemd boots PM2 after reboot. Idempotent — running it twice is fine.
if [ ! -f "/etc/systemd/system/pm2-$APP_USER.service" ]; then
  bold "==> registering PM2 systemd unit (so it starts on reboot)"
  sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" \
    >/tmp/pm2-startup.log 2>&1 || warn "    pm2 startup returned non-zero — check /tmp/pm2-startup.log"
fi

# ─────────────── 7. health check ───────────────
bold "==> [7/7] health-check on 127.0.0.1:3001"
HEALTHY=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3001/api/auth/me 2>/dev/null || echo '000')"
  if [ "$CODE" = "401" ] || [ "$CODE" = "200" ]; then
    HEALTHY=1
    break
  fi
  sleep 1
done

echo
if [ "$HEALTHY" = "1" ]; then
  ok   "==> Done. Node is up on :3001 (HTTP $CODE on /api/auth/me)."
  note "    Open https://${DOMAIN:-${NGINX_DOMAIN:-neurochat.space}} to verify."
else
  bad  "==> Node did NOT come up on :3001 (last HTTP code: $CODE)."
  warn "    Last 40 lines of pm2 logs:"
  echo
  sudo -u "$APP_USER" bash -lc "pm2 logs neuro-server --lines 40 --nostream" || true
  echo
  warn "    Common fixes:"
  warn "      • node --experimental-sqlite '$APP_DIR/server/src/index.js'   # run manually to see the real error"
  warn "      • cd '$APP_DIR/server' && npm install                          # if a dep is missing"
  warn "      • check '$APP_DIR/server/.env'                                 # PORT, PUBLIC_ORIGIN must be set"
  exit 2
fi
