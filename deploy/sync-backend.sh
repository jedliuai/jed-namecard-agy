#!/usr/bin/env bash
# Copies deploy/pb_hooks, deploy/pb_migrations and the card site (cards/, served as pb_public/cards for
# the public card pages) to the VPS and restarts PocketBase.
# Run locally: bash deploy/sync-backend.sh path/to/vps.sh   (vps.sh = ssh wrapper that runs its args remotely)
set -euo pipefail
VPS=${1:?usage: sync-backend.sh path/to/vps.sh}
cd "$(dirname "$0")"
tar -czf - pb_hooks pb_migrations -C .. cards | bash "$VPS" 'set -e
  t=$(mktemp -d); trap "rm -rf $t" EXIT
  tar -xzf - -C $t
  pb=/opt/namecard/pocketbase
  for d in pb_hooks pb_migrations; do
    sudo -n install -d -m 750 -o root -g namecard-pb $pb/$d
    sudo -n install -m 640 -o root -g namecard-pb $t/$d/* $pb/$d/
  done
  # The site is swapped in whole, so a page never mixes old and new files.
  sudo -n rm -rf $pb/pb_public.new && sudo -n install -d -m 750 -o root -g namecard-pb $pb/pb_public.new
  sudo -n cp -r $t/cards $pb/pb_public.new/cards
  sudo -n chown -R root:namecard-pb $pb/pb_public.new
  sudo -n find $pb/pb_public.new -type d -exec chmod 750 {} + -o -type f -exec chmod 640 {} +
  sudo -n rm -rf $pb/pb_public.old; [ -d $pb/pb_public ] && sudo -n mv $pb/pb_public $pb/pb_public.old
  sudo -n mv $pb/pb_public.new $pb/pb_public && sudo -n rm -rf $pb/pb_public.old
  sudo -n systemctl restart namecard-pb
  sleep 3
  systemctl is-active namecard-pb
  sudo -n journalctl -u namecard-pb --since "-15s" --no-pager -o cat | grep -iE "error|fail|panic" || true
  curl -fsS http://127.0.0.1:18790/api/health'
