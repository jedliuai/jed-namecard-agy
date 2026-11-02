#!/usr/bin/env bash
# Switches the site between the Paddle sandbox and live accounts. Each account's settings sit on the
# server in /opt/namecard/secrets/paddle-sandbox.env and paddle-live.env (format: paddle.env.example);
# the chosen one is copied to paddle.env and PocketBase restarts. No code change, no redeploy.
# Only switch to live once Paddle has verified the account and approved the domain.
# Run locally: bash deploy/paddle-switch.sh path/to/vps.sh live|sandbox
set -euo pipefail
VPS=${1:?usage: paddle-switch.sh path/to/vps.sh live|sandbox}
TO=${2:?usage: paddle-switch.sh path/to/vps.sh live|sandbox}
[[ $TO == live || $TO == sandbox ]] || { echo "live or sandbox"; exit 1; }
bash "$VPS" "set -e
  d=/opt/namecard/secrets
  sudo -n test -s \$d/paddle-$TO.env
  sudo -n cp -p \$d/paddle.env \$d/paddle.env.bak-\$(date +%Y%m%d%H%M%S)
  sudo -n cp -p \$d/paddle-$TO.env \$d/paddle.env
  sudo -n systemctl restart namecard-pb
  sleep 3
  systemctl is-active namecard-pb
  curl -fsS http://127.0.0.1:18790/api/paddle/config; echo"
