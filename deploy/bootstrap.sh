#!/usr/bin/env bash
# One-shot installer for Ubuntu 22.04 desktop/server.
#
# Usage (run from inside a cloned/copied repo):
#   bash deploy/bootstrap.sh                    # default APP_DIR=/opt/neuro
#   APP_DIR=/srv/neuro bash deploy/bootstrap.sh # custom destination
#
# Re-running the script is safe — it skips already-installed pieces.
# Code is COPIED from the folder where this script lives into APP_DIR.

set -eo pipefail

# ----------------- Defaults (override via env) -----------------
DOMAIN="${DOMAIN:-neurochat.space}"
EMAIL="${EMAIL:-alexkonstich@gmail.com}"
APP_DIR="${APP_DIR:-/opt/neuro}"

# Run-as user. SUDO_USER is set when invoked via sudo, otherwise fall back to current user.
APP_USER="${APP_USER:-${SUDO_USER:-$USER}}"
APP_HOME="$(getent passwd "$APP_USER" 2>/dev/null | cut -d: -f6)"
[ -z "$APP_HOME" ] && APP_HOME="/home/$APP_USER"

# Source = repo root that contains this script.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
SRC_DIR="$( cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd )"

if [ ! -d "$SRC_DIR/server" ] || [ ! -d "$SRC_DIR/web" ]; then
  echo "ERROR: this script must live inside the Neuro repo (deploy/bootstrap.sh)."
  echo "       Couldn't find server/ or web/ next to deploy/."
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
bold "==> [1/7] apt: base packages"
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates git ufw nginx build-essential rsync

# Node 22
node_major="$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1 || true)"
if [ -z "$node_major" ] || [ "$node_major" -lt 22 ]; then
  bold "==> Installing Node.js 22 from NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  note "    Node $(node -v) already installed"
fi

# PM2
if ! command -v pm2 >/dev/null 2>&1; then
  bold "==> Installing PM2"
  sudo npm i -g pm2
else
  note "    PM2 $(pm2 -v) already installed"
fi

# certbot
if ! command -v certbot >/dev/null 2>&1; then
  bold "==> Installing certbot"
  sudo apt-get install -y certbot python3-certbot-nginx
else
  note "    certbot already installed"
fi

# ---------- 2. firewall ----------
bold "==> [2/7] firewall (ufw): allow 22 / 80 / 443"
sudo ufw allow OpenSSH       >/dev/null 2>&1 || true
sudo ufw allow 'Nginx Full'  >/dev/null 2>&1 || true
sudo ufw --force enable      >/dev/null 2>&1 || true

# ---------- 3. copy code ----------
bold "==> [3/7] copy code into $APP_DIR"
sudo mkdir -p "$APP_DIR"

# Copy everything from SRC_DIR to APP_DIR, but DON'T blow away runtime data.
# We exclude node_modules and built artefacts so the next step rebuilds cleanly,
# and exclude server/data so the SQLite DB / uploads survive re-runs.
sudo rsync -a --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'server/data/' \
  --exclude 'web/dist/' \
  --exclude '.env' \
  "$SRC_DIR"/ "$APP_DIR"/

sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---------- 4. .env ----------
bold "==> [4/7] .env"
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
bold "==> [5/7] install + build (as $APP_USER)"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/server' && npm install --omit=dev"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/web'    && npm install && npm run build"

# ---------- 6. nginx ----------
bold "==> [6/7] nginx"
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/neuro
sudo sed -i "s|neurochat.space|$DOMAIN|g" /etc/nginx/sites-available/neuro
# Make sure static / uploads paths point at the chosen $APP_DIR
sudo sed -i "s|/opt/neuro|$APP_DIR|g" /etc/nginx/sites-available/neuro
sudo ln -sf /etc/nginx/sites-available/neuro /etc/nginx/sites-enabled/neuro
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/letsencrypt
if ! sudo nginx -t; then
  bold "(!) nginx -t failed — fix the config above and re-run."
  exit 1
fi
sudo systemctl reload nginx

if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  bold "==> Requesting Let's Encrypt certificate"
  if ! sudo certbot --nginx --non-interactive --agree-tos --email "$EMAIL" -d "$DOMAIN" -d "www.$DOMAIN"; then
    bold "(!) certbot failed."
    note "    Check that $DOMAIN points to this server (A record)"
    note "    and ports 80/443 are reachable from the internet."
    note "    You can re-run later with:"
    note "      sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  fi
else
  note "    certificate for $DOMAIN already exists"
fi

# ---------- 7. PM2 ----------
bold "==> [7/7] PM2"
sudo -u "$APP_USER" bash -lc "pm2 start '$APP_DIR/deploy/ecosystem.config.cjs' || pm2 reload '$APP_DIR/deploy/ecosystem.config.cjs' --update-env"
sudo -u "$APP_USER" bash -lc "pm2 save"
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" || true

echo
bold "==> Done. Open https://$DOMAIN"
bold "    First user to register with username 'alexserguntsov' becomes admin automatically."
bold "    Logs:    pm2 logs neuro-server"
bold "    Status:  pm2 status"
bold "    Update:  bash $APP_DIR/deploy/update.sh"
