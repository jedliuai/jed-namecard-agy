#!/usr/bin/env bash
# Copies deploy/pb_hooks and deploy/pb_migrations to the VPS and restarts PocketBase.
# Run locally: bash deploy/sync-backend.sh path/to/vps.sh   (vps.sh = ssh wrapper that runs its args remotely)
set -euo pipefail
VPS=${1:?usage: sync-backend.sh path/to/vps.sh}
cd "$(dirname "$0")"
tar -czf - pb_hooks pb_migrations | bash "$VPS" 'set -e
  t=$(mktemp -d); trap "rm -rf $t" EXIT
  tar -xzf - -C $t
  for d in pb_hooks pb_migrations; do
    sudo -n install -d -m 750 -o root -g namecard-pb /opt/namecard/pocketbase/$d
    sudo -n install -m 640 -o root -g namecard-pb $t/$d/* /opt/namecard/pocketbase/$d/
  done
  sudo -n systemctl restart namecard-pb
  sleep 3
  systemctl is-active namecard-pb
  sudo -n journalctl -u namecard-pb --since "-15s" --no-pager -o cat | grep -iE "error|fail|panic" || true
  curl -fsS http://127.0.0.1:18790/api/health'
