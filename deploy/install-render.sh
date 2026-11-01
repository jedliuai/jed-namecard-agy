#!/usr/bin/env bash
# Builds the export worker image and runs it as namecard-render.service (run with sudo, from a
# directory holding the repo's render/ and cards/). Safe to re-run: rebuilds and restarts.
set -euo pipefail
SRC=${1:-$(pwd)}
SECRETS=/opt/namecard/secrets
SVC=namecard-render

docker build -q -f "$SRC/render/Dockerfile" -t namecard-render:latest "$SRC"

# One token, known to PocketBase and the worker only.
if [ ! -s $SECRETS/render-worker.env ]; then
  tok=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 48)
  printf 'RENDER_WORKER_TOKEN=%s\n' "$tok" > $SECRETS/render-worker.env
  printf 'RENDER_WORKER_TOKEN=%s\nAPI_URL=https://api.1name.cards\n' "$tok" > $SECRETS/render.env
  chmod 600 $SECRETS/render-worker.env $SECRETS/render.env
fi
pb=/etc/systemd/system/namecard-pb.service
grep -q render-worker.env $pb || sed -i "s|^ExecStart=|EnvironmentFile=-$SECRETS/render-worker.env\nExecStart=|" $pb

# No access to the host's network services: default bridge, all capabilities dropped, capped CPU and
# memory, frames in a RAM disk that is thrown away with the container.
cat > /etc/systemd/system/$SVC.service <<EOF
[Unit]
Description=Super Namecard export worker (Docker)
After=docker.service network-online.target
Requires=docker.service

[Service]
ExecStartPre=-/usr/bin/docker rm -f $SVC
ExecStart=/usr/bin/docker run --rm --name $SVC --env-file $SECRETS/render.env \\
  --cpus 1.8 --memory 3g --pids-limit 512 --shm-size 512m \\
  --cap-drop ALL --security-opt no-new-privileges \\
  --read-only --tmpfs /tmp:rw,size=1200m --tmpfs /home/pwuser:rw,size=64m \\
  -e WORK_DIR=/tmp/exports namecard-render:latest
ExecStop=/usr/bin/docker stop -t 20 $SVC
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl restart namecard-pb
systemctl enable $SVC >/dev/null 2>&1
systemctl restart $SVC
sleep 5
systemctl is-active namecard-pb $SVC
