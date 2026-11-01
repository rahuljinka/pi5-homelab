#!/bin/sh
# Installs the power helper for the display manager's Reboot/Shutdown buttons.
# Run from the repo root:  sudo host/display-manager-power/install.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
request_dir="$repo/apps/display-manager/data/host-requests"

mkdir -p "$request_dir"
install -m 0755 "$here/display-manager-power" /usr/local/sbin/display-manager-power
for unit in display-manager-power.path display-manager-power.service; do
    sed "s|@REQUEST_DIR@|$request_dir|" "$here/$unit" > "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now display-manager-power.path
echo "Power helper installed; watching $request_dir"
