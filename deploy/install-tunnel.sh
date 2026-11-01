#!/usr/bin/env bash
# Exposes the Super Namecard PocketBase through its own Cloudflare Tunnel (run with sudo).
# Needs a one-off `tunnel login` cert in $CF_HOME; deletes it at the end so the server keeps
# only this tunnel's credentials. Leaves every other tunnel and service alone. Safe to re-run.
set -euo pipefail
NAME=namecard
HOST=api.999368.xyz
ORIGIN=http://127.0.0.1:18790
METRICS=127.0.0.1:18791
SVC=namecard-tunnel
BIN=/usr/local/bin/namecard-cloudflared
CF_HOME=/root/namecard-cf
ETC=/etc/$SVC
cf() { HOME=$CF_HOME $BIN --no-autoupdate "$@"; }

tunnel_id() { cf tunnel list --name $NAME --output json 2>/dev/null | sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' | head -1; }
id=$(tunnel_id)
if [ -z "$id" ]; then
  cf tunnel create $NAME >/dev/null 2>&1
  id=$(tunnel_id)
fi
echo "tunnel $NAME = $id"

install -d -m 755 $ETC
if [ ! -s $ETC/credentials.json ]; then
  install -m 600 -o root -g root $CF_HOME/.cloudflared/$id.json $ETC/credentials.json
fi
cf tunnel route dns $id $HOST

# Admin UI and superuser login never leave the server; reach them over an SSH tunnel instead.
cat > $ETC/config.yml <<EOF
tunnel: $id
credentials-file: /run/credentials/$SVC.service/tunnel.json
metrics: $METRICS
protocol: http2
ingress:
  - hostname: $HOST
    path: ^/_/
    service: http_status:404
  - hostname: $HOST
    path: ^/api/collections/_superusers/
    service: http_status:404
  - hostname: $HOST
    service: $ORIGIN
  - service: http_status:404
EOF
chmod 644 $ETC/config.yml

id -u $SVC >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin $SVC
cat > /etc/systemd/system/$SVC.service <<EOF
[Unit]
Description=Super Namecard Cloudflare Tunnel ($HOST)
After=network-online.target namecard-pb.service
Wants=network-online.target

[Service]
Type=simple
User=$SVC
Group=$SVC
LoadCredential=tunnel.json:$ETC/credentials.json
ExecStart=$BIN --no-autoupdate --config $ETC/config.yml tunnel run
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=
UMask=0077
MemoryMax=256M

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable $SVC >/dev/null 2>&1
systemctl restart $SVC
sleep 4
systemctl is-active $SVC

# The login cert can create tunnels and DNS records for the whole zone; it is no longer needed.
rm -f $CF_HOME/.cloudflared/cert.pem $CF_HOME/.cloudflared/$id.json
