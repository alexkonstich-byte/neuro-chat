#!/usr/bin/env bash
# Single-command updater for Neuro.
#
# Three modes (auto-detected):
#   1. SOURCE  = the folder this script lives in (rsync mode).
#   2. SOURCE  = APP_DIR and it's a git checkout (git pull mode).
#   3. Force git mode by passing GIT=1 — clones the repo from $REPO_URL and
#      syncs it into APP_DIR. Useful on the server when the install lives in
#      /opt/neuro without a .git directory.
#
# Usage:
#   bash deploy/update.sh                           # smart mode
#   GIT=1 bash deploy/update.sh                     # force "pull from GitHub"
#   APP_DIR=/srv/neuro REPO_URL=… bash update.sh
set -eo pipefail

APP_DIR="${APP_DIR:-/opt/neuro}"
APP_USER="${APP_USER:-${SUDO_USER:-$USER}}"
REPO_URL="${REPO_URL:-https://github.com/alexkonstich-byte/neuro-chat.git}"
BRANCH="${BRANCH:-main}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SRC_DIR="$( cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd )"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
note() { printf '\033[2m%s\033[0m\n' "$*"; }

bold "==> Update Neuro"
bold "    Target:  $APP_DIR"
bold "    User:    $APP_USER"

# ---------- 1. fetch fresh code ----------
if [ "${GIT:-0}" = "1" ] || ! [ -d "$SRC_DIR/server" ]; then
  bold "==> git mode: cloning $REPO_URL ($BRANCH)"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$TMP/repo"
  SRC_DIR="$TMP/repo"
fi

if [ "$SRC_DIR" = "$APP_DIR" ] && [ -d "$APP_DIR/.git" ]; then
  bold "==> git pull"
  ( cd "$APP_DIR" && sudo -u "$APP_USER" git fetch --all && sudo -u "$APP_USER" git reset --hard "origin/$BRANCH" )
else
  bold "==> rsync $SRC_DIR → $APP_DIR (preserving server/data and .env)"
  sudo mkdir -p "$APP_DIR"
  sudo rsync -a --delete \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'server/data/' \
    --exclude 'web/dist/' \
    --exclude '.env' \
    "$SRC_DIR"/ "$APP_DIR"/
  sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

# ---------- 2. install + build ----------
bold "==> install + build"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/server' && (npm ci --omit=dev || npm install --omit=dev)"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/web'    && (npm ci || npm install) && npm run build"

# ---------- 3. PM2 ----------
# We `delete` first so PM2 picks up any path/script changes from the
# updated ecosystem.config.cjs. `reload` keeps the old in-memory config.
bold "==> PM2 restart (re-reading config)"
sudo -u "$APP_USER" bash -lc "
  pm2 delete neuro-server >/dev/null 2>&1 || true
  pm2 start  '$APP_DIR/deploy/ecosystem.config.cjs'
  pm2 save
"

# ---------- 4. nginx ----------
bold "==> nginx reload"
sudo nginx -t && sudo systemctl reload nginx || note "    nginx reload skipped"

bold "==> Done"
