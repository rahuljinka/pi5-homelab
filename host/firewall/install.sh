#!/bin/sh
# Installs the host firewall and starts it at boot.
# Usage (from the repo root):  sudo host/firewall/install.sh <lan-subnet> <lan-interface>
#   e.g.                       sudo host/firewall/install.sh 192.168.0.0/24 eth0
# Undo:  sudo systemctl disable --now homelab-firewall
set -eu
subnet="${1:?LAN subnet, e.g. 192.168.0.0/24}"
iface="${2:?LAN interface, e.g. eth0 (see: ip -br link)}"
here=$(cd "$(dirname "$0")" && pwd)
sed -e "s|@LAN_SUBNET@|$subnet|g" -e "s|@LAN_IF@|$iface|g" "$here/homelab-firewall.nft" > /etc/homelab-firewall.nft
nft -c -f /etc/homelab-firewall.nft   # syntax check before loading
install -m 0644 "$here/homelab-firewall.service" /etc/systemd/system/homelab-firewall.service
systemctl daemon-reload
systemctl enable --now homelab-firewall.service
systemctl restart homelab-firewall.service
nft list table inet homelab_fw
