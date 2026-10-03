#!/usr/bin/env bash
set -Eeuo pipefail
ssh_target=${1:-vps}
project_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
source_archive=$(mktemp /tmp/fairshare-source.XXXXXX)
trap 'rm -f -- "$source_archive"' EXIT
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$source_archive" --exclude=node_modules --exclude=dist --exclude=.data --exclude=.env --exclude=.git --exclude=test-results -C "$project_dir" .
remote_archive=$(ssh "$ssh_target" 'mktemp /home/ubuntu/fairshare-source.XXXXXX')
[[ "$remote_archive" =~ ^/home/ubuntu/fairshare-source\.[a-zA-Z0-9]+$ ]] || { echo 'Unexpected upload path.'; exit 1; }
scp "$source_archive" "$ssh_target:$remote_archive"
ssh "$ssh_target" "fairshare deploy '$remote_archive'; result=\$?; rm -f -- '$remote_archive'; exit \$result"
