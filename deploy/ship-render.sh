#!/usr/bin/env bash
# Sends render/ and cards/ to the VPS and (re)builds the export worker there.
# Run locally: bash deploy/ship-render.sh path/to/vps.sh   (vps.sh = ssh wrapper that runs its args remotely)
set -euo pipefail
VPS=${1:?usage: ship-render.sh path/to/vps.sh}
cd "$(dirname "$0")/.."
tar -czf - --exclude=render/node_modules --exclude=render/out render cards deploy/install-render.sh | bash "$VPS" 'set -e
  d=/opt/namecard/render-src
  sudo -n rm -rf $d.new && sudo -n install -d -m 750 $d.new
  sudo -n tar -xzf - -C $d.new
  sudo -n rm -rf $d && sudo -n mv $d.new $d
  sudo -n bash $d/deploy/install-render.sh $d'
