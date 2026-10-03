#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo.'; exit 1; }
app_domain=${1:?Usage: sudo bash deploy/install.sh DOMAIN}
[[ "$app_domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || { echo 'Invalid domain.'; exit 1; }
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
id fairshare >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/fairshare --shell /usr/sbin/nologin fairshare
install -d -o root -g root -m 755 /srv/fairshare /srv/fairshare/releases
install -d -o fairshare -g fairshare -m 750 /var/lib/fairshare
install -d -o root -g root -m 700 /etc/fairshare /var/backups/fairshare
systemctl enable --now postgresql
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='fairshare'" | grep -q 1; then
  runuser -u postgres -- createuser fairshare
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='fairshare'" | grep -q 1; then
  runuser -u postgres -- createdb -O fairshare fairshare
fi
if [[ ! -f /etc/fairshare/app.env ]]; then
  cat > /etc/fairshare/app.env <<EOF
NODE_ENV=production
ENABLE_DEMO=false
HOST=127.0.0.1
PORT=3000
APP_ORIGIN=https://$app_domain
DATABASE_URL=postgresql://fairshare@localhost/fairshare?host=/var/run/postgresql
DATA_DIR=/var/lib/fairshare/postgres
EOF
  chmod 600 /etc/fairshare/app.env
fi
install -m 644 "$script_dir/fairshare.service" /etc/systemd/system/fairshare.service
install -m 644 "$script_dir/fairshare-backup.service" /etc/systemd/system/fairshare-backup.service
install -m 644 "$script_dir/fairshare-backup.timer" /etc/systemd/system/fairshare-backup.timer
install -m 755 "$script_dir/manage.sh" /usr/local/bin/fairshare
install -m 750 "$script_dir/backup.sh" /usr/local/sbin/fairshare-backup
if [[ ! -f /etc/nginx/sites-available/fairshare ]]; then
  cat > /etc/nginx/sites-available/fairshare <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $app_domain;
    client_max_body_size 100k;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
fi
ln -sfn /etc/nginx/sites-available/fairshare /etc/nginx/sites-enabled/fairshare
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable fairshare fairshare-backup.timer
systemctl enable --now nginx fairshare-backup.timer
systemctl reload nginx
echo "Configured FairShare for https://$app_domain. Deploy source, then obtain TLS certificate."
