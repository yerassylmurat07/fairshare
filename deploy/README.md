# FairShare on a VPS

These scripts describe the self-managed systemd setup used for the first deployment on October 3, 2026.
Since October 23, 2026 the live instance runs as a Docker container built from the repository
`Dockerfile` by Coolify, behind the same Nginx HTTPS proxy and host PostgreSQL. The scripts remain
as a documented manual alternative.

Replace `YOUR_SERVER` with your SSH host and `YOUR_DOMAIN` with the application's domain.
Server-specific addresses and accounts are intentionally not recorded here.

## Management

From your computer:

```bash
ssh YOUR_SERVER
```

On the VPS:

```bash
fairshare status       # Application, PostgreSQL, Nginx, and backup schedule
fairshare health       # Check the application and database connection
fairshare logs         # Recent and live logs; press Ctrl+C to exit
fairshare restart      # Restart and verify application health
fairshare backup       # Create a backup now
fairshare backups      # List backups
fairshare rollback     # Restore the previous application release
htop                   # View server resource usage
tmux new -As work      # Keep a terminal session across SSH disconnects
```

In tmux, press `Ctrl+B`, then `D` to detach. Run the same command again to reconnect.

## Deploying updates from your computer

From the FairShare source directory:

```bash
bash deploy/push.sh YOUR_SERVER
```

The script uploads source files, excluding the local database, `.env`, and `node_modules`.
On the server, it creates a separate release, installs dependencies, builds the application,
and runs all 10 tests. A backup is created before switching releases. If the `/api/health`
check fails, the previous release is restored.

Current source: `/srv/fairshare/current`.
Previous release: `/srv/fairshare/previous`. All releases: `/srv/fairshare/releases`.
Releases are not deleted automatically. Remove old ones manually while preserving the current
and previous releases. `rollback` changes application code only; check database compatibility
separately when schema changes are involved.

## Database and backups

PostgreSQL database and role: `fairshare`. The application connects through a local Unix socket
using peer authentication. No database password is required, and the role has no superuser rights.
The firewall blocks external PostgreSQL access. The application listens only on `127.0.0.1:3000`.

Backups are stored in `/var/backups/fairshare`, run daily between **03:15 and 03:25 Asia/Seoul**,
and are retained for approximately 14 days. Each backup contains `database.dump`, source files
without dependencies, configuration, and checksums. Only root can access the directory.
Daily copies remain on the VPS; download them to your computer to protect against server loss.

Download a selected backup:

```bash
ssh YOUR_SERVER 'sudo tar -czf - -C /var/backups/fairshare BACKUP_DIRECTORY' > fairshare-backup.tar.gz
```

Verify checksums on the VPS:

```bash
sudo bash -c 'cd /var/backups/fairshare/BACKUP_DIRECTORY && sha256sum -c SHA256SUMS'
```

Restore a backup (this replaces the current database; create a fresh backup first):

```bash
fairshare backup
sudo install -d -o postgres -g postgres -m 700 /var/lib/postgresql/fairshare-restore
sudo install -o postgres -g postgres -m 600 /var/backups/fairshare/BACKUP_DIRECTORY/database.dump /var/lib/postgresql/fairshare-restore/database.dump
sudo systemctl stop fairshare
sudo -u postgres dropdb fairshare
sudo -u postgres createdb -O fairshare fairshare
sudo -u postgres pg_restore --exit-on-error --no-owner --role=fairshare -d fairshare /var/lib/postgresql/fairshare-restore/database.dump
fairshare restart
sudo rm /var/lib/postgresql/fairshare-restore/database.dump
```

Always test restoration into a separate database first.

## Configuration

- `/etc/fairshare/app.env`: production environment, including the exact `APP_ORIGIN`.
- `/etc/nginx/sites-available/fairshare`: HTTPS proxy.
- `/etc/systemd/system/fairshare.service`: startup, restart after failure, and process restrictions.
- `/etc/systemd/system/fairshare-backup.timer`: backup schedule.
- `sudo journalctl -u fairshare-backup.service`: backup logs.
- `sudo certbot certificates`: certificate details; `certbot.timer` renews it automatically.

SSH accepts keys only; root login is disabled. The deployment account is ubuntu.
Incoming TCP ports 22, 80, and 443 are open. Fail2ban protects SSH against repeated login attempts.
Automatic security updates run without automatic reboots. The server has 1 GB of swap
and limits on system log storage.

To connect a custom domain, point its A record to the server's IP address, update Nginx's `server_name`
and the environment's `APP_ORIGIN`, obtain a certificate with
`sudo certbot --nginx -d DOMAIN`, then validate Nginx and restart FairShare.

## Initial installation on a clean server

First install Node.js 22.12+, npm, nginx, certbot, python3-certbot-nginx,
postgresql, rsync, fail2ban, ufw, and unattended-upgrades. The deployment account is ubuntu.
From the extracted source, run:

```bash
sudo bash deploy/install.sh YOUR_DOMAIN
fairshare deploy /home/ubuntu/fairshare-upload.tar.gz
sudo certbot --nginx -d YOUR_DOMAIN --redirect --agree-tos --register-unsafely-without-email --non-interactive
```

`harden.sh` is designed for this VPS. Run it only after verifying a fresh ubuntu login
using an SSH key and confirming that no other services require additional incoming ports.

## Verified deployment

On October 3, 2026, verification covered:

- Production build and all 10 server/domain tests.
- All three desktop, team collaboration, and mobile browser scenarios.
- Live HTTPS registration, Secure/HttpOnly/SameSite sessions, and origin protection.
- Task, account, and session persistence across restarts and two release rollbacks.
- Backup checksums and full restoration into an isolated PostgreSQL database.
- A successful Certbot renewal dry run, key-based SSH login, enabled services, and firewall rules.
