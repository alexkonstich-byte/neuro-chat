#!/usr/bin/env bash
# One-shot installer for Ubuntu 22.04 desktop/server.
# Idempotent — re-running the script is safe.
#
# Usage (run from inside the cloned repo):
#   bash deploy/bootstrap.sh                    # default APP_DIR=/opt/neuro
#   APP_DIR=/srv/neuro bash deploy/bootstrap.sh
#
# Code is COPIED from the folder where this script lives into APP_DIR.

set -eo pipefail

# ----------------- Defaults (override via env) -----------------
DOMAIN="${DOMAIN:-neurochat.space}"
EMAIL="${EMAIL:-alexkonstich@gmail.com}"
APP_DIR="${APP_DIR:-/opt/neuro}"

APP_USER="${APP_USER:-${SUDO_USER:-$USER}}"
APP_HOME="$(getent passwd "$APP_USER" 2>/dev/null | cut -d: -f6)"
[ -z "$APP_HOME" ] && APP_HOME="/home/$APP_USER"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SRC_DIR="$( cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd )"

if [ ! -d "$SRC_DIR/server" ] || [ ! -d "$SRC_DIR/web" ]; then
  echo "ERROR: this script must live inside the Neuro repo (deploy/bootstrap.sh)."
  exit 1
fi

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
note() { printf '\033[2m%s\033[0m\n' "$*"; }

bold "==> Neuro bootstrap"
bold "    OS:     $(lsb_release -ds 2>/dev/null || uname -srm)"
bold "    Domain: $DOMAIN"
bold "    User:   $APP_USER  ($APP_HOME)"
bold "    Source: $SRC_DIR"
bold "    Target: $APP_DIR"
echo

# ---------- 1. system packages ----------
bold "==> [1/8] apt: base packages"
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates git ufw nginx build-essential rsync

node_major="$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1 || true)"
if [ -z "$node_major" ] || [ "$node_major" -lt 22 ]; then
  bold "==> Installing Node.js 22 from NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  note "    Node $(node -v) already installed"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  bold "==> Installing PM2"
  sudo npm i -g pm2
fi

if ! command -v certbot >/dev/null 2>&1; then
  bold "==> Installing certbot"
  sudo apt-get install -y certbot python3-certbot-nginx
fi

# ---------- 2. firewall ----------
bold "==> [2/8] firewall (ufw)"
sudo ufw allow OpenSSH       >/dev/null 2>&1 || true
sudo ufw allow 'Nginx Full'  >/dev/null 2>&1 || true
sudo ufw --force enable      >/dev/null 2>&1 || true

# ---------- 3. copy code ----------
bold "==> [3/8] copy code into $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'server/data/' \
  --exclude 'web/dist/' \
  --exclude '.env' \
  "$SRC_DIR"/ "$APP_DIR"/
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---------- 4. .env ----------
bold "==> [4/8] .env"
if [ ! -f "$APP_DIR/server/.env" ]; then
  if [ -f "$SRC_DIR/server/.env" ]; then
    sudo cp "$SRC_DIR/server/.env" "$APP_DIR/server/.env"
  else
    sudo cp "$APP_DIR/server/.env.example" "$APP_DIR/server/.env"
  fi
  sudo sed -i "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=https://$DOMAIN|" "$APP_DIR/server/.env"
  sudo chown "$APP_USER:$APP_USER" "$APP_DIR/server/.env"
fi
sudo mkdir -p "$APP_DIR/server/data"
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR/server/data"

# ---------- 5. install + build ----------
bold "==> [5/8] install + build (as $APP_USER)"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/server' && npm install --omit=dev"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/web'    && npm install && npm run build"

# ---------- 6. nginx (HTTP only) + ACME webroot ----------
bold "==> [6/8] nginx (HTTP) + ACME webroot"
sudo mkdir -p /var/www/letsencrypt
sudo rm -f /etc/nginx/sites-enabled/default

deploy_nginx() {
  local SRC="$1"
  sudo cp "$APP_DIR/deploy/$SRC" /etc/nginx/sites-available/neuro
  sudo sed -i "s|neurochat.space|$DOMAIN|g" /etc/nginx/sites-available/neuro
  sudo sed -i "s|/opt/neuro|$APP_DIR|g" /etc/nginx/sites-available/neuro
  sudo ln -sf /etc/nginx/sites-available/neuro /etc/nginx/sites-enabled/neuro
  if ! sudo nginx -t; then
    bold "(!) nginx -t failed"
    return 1
  fi
  sudo systemctl reload nginx
}

# Always start with HTTP-only so nginx can boot even without a cert.
deploy_nginx nginx-http.conf

# ---------- 7. certbot ----------
bold "==> [7/8] Let's Encrypt"
if sudo test -d "/etc/letsencrypt/live/$DOMAIN"; then
  note "    certificate for $DOMAIN already exists"
else
  if sudo certbot certonly --webroot -w /var/www/letsencrypt \
       --non-interactive --agree-tos --email "$EMAIL" \
       -d "$DOMAIN" -d "www.$DOMAIN"; then
    note "    certificate issued"
  else
    bold "(!) certbot failed."
    note "    Check that $DOMAIN points to this server (A record) and that"
    note "    ports 80/443 are open / forwarded from your router."
    note "    The site will continue to run on plain HTTP for now."
    note "    Re-run later:  bash $APP_DIR/deploy/bootstrap.sh"
    note "    or just:        sudo certbot certonly --webroot -w /var/www/letsencrypt -d $DOMAIN -d www.$DOMAIN"
  fi
fi

# If we have a cert now, switch to the HTTPS config.
if sudo test -d "/etc/letsencrypt/live/$DOMAIN"; then
  bold "==> Switching nginx to HTTPS"
  deploy_nginx nginx.conf
fi

# ---------- 8. PM2 ----------
bold "==> [8/8] PM2"
# Delete any stale registration (with the old paths) before starting fresh.
sudo -u "$APP_USER" bash -lc "pm2 delete neuro-server >/dev/null 2>&1 || true"
sudo -u "$APP_USER" bash -lc "pm2 start '$APP_DIR/deploy/ecosystem.config.cjs'"
sudo -u "$APP_USER" bash -lc "pm2 save"
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" || true

echo
if sudo test -d "/etc/letsencrypt/live/$DOMAIN"; then
  bold "==> Done. Open https://$DOMAIN"
else
  bold "==> Done. Open http://$DOMAIN  (https not ready — see certbot warnings above)"
fi
bold "    First user to register with username 'alexserguntsov' becomes admin automatically."
bold "    Logs:    pm2 logs neuro-server"
bold "    Status:  pm2 status"
bold "    Update:  bash $APP_DIR/deploy/update.sh"
