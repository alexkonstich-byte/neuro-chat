#!/usr/bin/env bash
# Update script: re-install deps, rebuild web, reload PM2 + nginx.
#
# Two modes:
#   1. Source = the folder this script is in. Useful when you sync code via
#      scp/rsync and just want to "redeploy".
#   2. Source = APP_DIR itself (a git checkout). Then we git-pull first.
#
# Usage:
#   bash deploy/update.sh                # APP_DIR=/opt/neuro by default
#   APP_DIR=/srv/neuro bash deploy/update.sh
#
set -eo pipefail

APP_DIR="${APP_DIR:-/opt/neuro}"
APP_USER="${APP_USER:-${SUDO_USER:-$USER}}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SRC_DIR="$( cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd )"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }

bold "==> Update Neuro"
bold "    Source: $SRC_DIR"
bold "    Target: $APP_DIR"

if [ "$SRC_DIR" = "$APP_DIR" ] && [ -d "$APP_DIR/.git" ]; then
  bold "==> git pull"
  ( cd "$APP_DIR" && sudo -u "$APP_USER" git fetch --all && sudo -u "$APP_USER" git reset --hard '@{u}' )
elif [ "$SRC_DIR" != "$APP_DIR" ]; then
  bold "==> rsync code → $APP_DIR (preserving server/data and .env)"
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

bold "==> install deps + build"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/server' && (npm ci --omit=dev || npm install --omit=dev)"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/web'    && (npm ci || npm install) && npm run build"

bold "==> PM2 reload"
sudo -u "$APP_USER" bash -lc "
  if pm2 list | grep -q neuro-server; then
    pm2 reload '$APP_DIR/deploy/ecosystem.config.cjs' --update-env
  else
    pm2 start  '$APP_DIR/deploy/ecosystem.config.cjs'
  fi
  pm2 save
"

bold "==> nginx reload"
sudo nginx -t && sudo systemctl reload nginx

bold "==> Done"
