#!/usr/bin/env bash
# Installs PocketBase for Super Namecard on the OCI ARM64 VPS (run with sudo).
# Own system user, own directory, loopback only; leaves every other service alone. Safe to re-run.
set -euo pipefail
PB_VERSION=0.40.6
BASE=/opt/namecard
PB_DIR=$BASE/pocketbase
PORT=18790
SVC=namecard-pb

id -u $SVC >/dev/null 2>&1 || useradd --system --home-dir $PB_DIR --shell /usr/sbin/nologin $SVC
install -d -m 755 $BASE
install -d -m 750 -o root -g $SVC $PB_DIR
install -d -m 700 -o $SVC -g $SVC $PB_DIR/pb_data
install -d -m 700 -o root -g root $BASE/secrets

# Download and verify against the release's own checksums.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
zip=pocketbase_${PB_VERSION}_linux_arm64.zip
url=https://github.com/pocketbase/pocketbase/releases/download/v$PB_VERSION
curl -fsSL -o "$tmp/$zip" "$url/$zip"
curl -fsSL -o "$tmp/checksums.txt" "$url/checksums.txt"
(cd "$tmp" && grep " $zip\$" checksums.txt | sha256sum -c -)
unzip -q -o "$tmp/$zip" pocketbase -d "$tmp"
install -m 755 -o root -g root "$tmp/pocketbase" $PB_DIR/pocketbase
echo "$PB_VERSION" > $PB_DIR/VERSION

cat > /etc/systemd/system/$SVC.service <<EOF
[Unit]
Description=Super Namecard backend (PocketBase $PB_VERSION)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SVC
Group=$SVC
WorkingDirectory=$PB_DIR
# Paddle webhook secret and the like; root-only file, read by systemd before dropping privileges.
EnvironmentFile=-$BASE/secrets/paddle.env
EnvironmentFile=-$BASE/secrets/render-worker.env
ExecStart=$PB_DIR/pocketbase serve --http=127.0.0.1:$PORT --dir=$PB_DIR/pb_data --hooksDir=$PB_DIR/pb_hooks --migrationsDir=$PB_DIR/pb_migrations --automigrate=false
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$PB_DIR/pb_data
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=
LockPersonality=true
UMask=0077
MemoryMax=512M
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
EOF
install -d -m 750 -o root -g $SVC $PB_DIR/pb_hooks $PB_DIR/pb_migrations

systemctl daemon-reload
systemctl enable --now $SVC
sleep 2
systemctl is-active $SVC

# First superuser: a random password kept in a root-only file (never printed).
if [ ! -s $BASE/secrets/pb-superuser.txt ]; then
  pass=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 28)
  email=admin@999368.xyz
  sudo -u $SVC $PB_DIR/pocketbase superuser upsert "$email" "$pass" --dir=$PB_DIR/pb_data >/dev/null
  printf 'PB_SUPERUSER_EMAIL=%s\nPB_SUPERUSER_PASSWORD=%s\n' "$email" "$pass" > $BASE/secrets/pb-superuser.txt
  chmod 600 $BASE/secrets/pb-superuser.txt
  echo "superuser created"
fi
curl -fsS http://127.0.0.1:$PORT/api/health
