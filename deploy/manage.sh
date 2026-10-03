#!/usr/bin/env bash
set -Eeuo pipefail
if [[ $EUID != 0 ]]; then exec sudo -- "$0" "$@"; fi
app_root=/srv/fairshare
healthy() {
  for attempt in {1..30}; do
    if curl -fsS --max-time 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  journalctl -u fairshare -n 40 --no-pager
  return 1
}
activate() {
  local target=$1
  ln -sfn "$target" "$app_root/.current-next"
  mv -Tf "$app_root/.current-next" "$app_root/current"
  systemctl reset-failed fairshare
  systemctl restart fairshare
  healthy
}
case "${1:-help}" in
  status)
    systemctl status fairshare nginx postgresql --no-pager || true
    grep '^APP_ORIGIN=' /etc/fairshare/app.env
    systemctl list-timers fairshare-backup.timer certbot.timer --no-pager
    ;;
  logs) journalctl -u fairshare -n 100 -f ;;
  restart) systemctl restart fairshare; healthy ;;
  health) curl -fsS http://127.0.0.1:3000/api/health; echo ;;
  backup) /usr/local/sbin/fairshare-backup ;;
  backups) ls -lh /var/backups/fairshare ;;
  deploy)
    archive=${2:?Usage: fairshare deploy /absolute/path/to/source.tar.gz}
    [[ -f "$archive" ]] || { echo 'Source archive not found.'; exit 1; }
    exec 8>/run/lock/fairshare-deploy.lock
    flock -n 8 || { echo 'Another deployment is running.'; exit 1; }
    release="$app_root/releases/$(date -u +%Y%m%dT%H%M%S)-$$"
    install -d -o ubuntu -g ubuntu -m 755 "$release"
    tar -xzf "$archive" --no-same-owner -C "$release"
    chown -R ubuntu:ubuntu "$release"
    # Test before activation. Tests always use an isolated in-memory database.
    runuser -u ubuntu -- bash -c 'set -e; cd "$1"; npm ci --no-audit --no-fund; npm run build; npm test' -- "$release"
    chown -R root:root "$release"
    chmod -R a+rX,go-w "$release"
    previous=""
    if [[ -L "$app_root/current" && -d "$app_root/current" ]]; then
      previous=$(readlink -f "$app_root/current")
    fi
    if [[ -n "$previous" && -d "$previous" ]]; then /usr/local/sbin/fairshare-backup; fi
    if activate "$release"; then
      if [[ -n "$previous" && -d "$previous" ]]; then ln -sfn "$previous" "$app_root/previous"; fi
      echo "Active release: $release"
    else
      if [[ -n "$previous" && -d "$previous" ]]; then activate "$previous"; else systemctl stop fairshare; fi
      echo 'Deployment failed; previous release restored when available.' >&2
      exit 1
    fi
    ;;
  rollback)
    exec 8>/run/lock/fairshare-deploy.lock
    flock -n 8 || { echo 'Another deployment is running.'; exit 1; }
    previous=$(readlink -f "$app_root/previous" || true)
    [[ -n "$previous" && -d "$previous" ]] || { echo 'No previous release exists.'; exit 1; }
    current=$(readlink -f "$app_root/current")
    /usr/local/sbin/fairshare-backup
    if activate "$previous"; then ln -sfn "$current" "$app_root/previous"; else activate "$current"; exit 1; fi
    echo "Active release: $previous (database unchanged)"
    ;;
  *) echo 'Usage: fairshare {status|logs|restart|health|backup|backups|deploy ARCHIVE|rollback}' ;;
esac
