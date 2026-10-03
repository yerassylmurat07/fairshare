#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
exec 9>/run/lock/fairshare-backup.lock
flock -n 9 || { echo 'A backup is already running.'; exit 1; }
backup_root=/var/backups/fairshare
backup_id=$(date -u +%Y%m%dT%H%M%S)-$$
backup_tmp="$backup_root/.partial-$backup_id"
backup_dir="$backup_root/$backup_id"
mkdir -p "$backup_tmp"
trap 'rm -rf -- "$backup_tmp"' EXIT
runuser -u fairshare -- pg_dump -h /var/run/postgresql -Fc fairshare > "$backup_tmp/database.dump"
pg_restore --list "$backup_tmp/database.dump" > "$backup_tmp/database.list"
tar -czf "$backup_tmp/source.tar.gz" --exclude=node_modules --exclude=dist --exclude=.data --exclude=.env --exclude=test-results -C /srv/fairshare/current .
tar -czf "$backup_tmp/config.tar.gz" -C / etc/fairshare etc/nginx/sites-available/fairshare etc/systemd/system/fairshare.service
(cd "$backup_tmp" && sha256sum database.dump source.tar.gz config.tar.gz > SHA256SUMS)
mv "$backup_tmp" "$backup_dir"
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +14 -exec rm -rf -- {} +
echo "Backup: $backup_dir"
