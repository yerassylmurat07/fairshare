#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo.'; exit 1; }
# Only apply on this VPS after verifying a fresh key-based ubuntu SSH login.
[[ -s /home/ubuntu/.ssh/authorized_keys ]] || { echo 'SSH key missing.'; exit 1; }
install -d -m 755 /etc/ssh/sshd_config.d /etc/fail2ban/jail.d /etc/systemd/journald.conf.d
cat > /etc/ssh/sshd_config.d/00-fairshare.conf <<'EOF'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sshd -t
systemctl reload ssh
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
cat > /etc/fail2ban/jail.d/fairshare.local <<'EOF'
[sshd]
enabled = true
backend = systemd
port = 22
maxretry = 6
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban
cat > /etc/systemd/journald.conf.d/fairshare.conf <<'EOF'
[Journal]
SystemMaxUse=200M
RuntimeMaxUse=50M
MaxRetentionSec=14day
EOF
systemctl restart systemd-journald
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat > /etc/apt/apt.conf.d/52fairshare-unattended-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "false";
EOF
if [[ ! -f /swapfile && $(swapon --show --noheadings | wc -l) -eq 0 ]]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
systemctl enable --now certbot.timer
ufw status verbose
echo 'SSH keys only; firewall, fail2ban, log limits, security updates and swap configured.'
