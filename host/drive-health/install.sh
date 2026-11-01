#!/bin/sh
# Installs the drive health job for the control panel's Drive Health section.
# Run from the repo root:  sudo host/drive-health/install.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
out="$repo/apps/display-manager/data/drive-health.json"
install -m 0755 "$here/drive-health" /usr/local/sbin/display-manager-drive-health
sed "s|@OUT@|$out|" "$here/drive-health.service" > /etc/systemd/system/display-manager-drive-health.service
install -m 0644 "$here/drive-health.timer" /etc/systemd/system/display-manager-drive-health.timer
systemctl daemon-reload
systemctl enable --now display-manager-drive-health.timer
systemctl start display-manager-drive-health.service
echo "Drive health job installed; writing $out every 30 minutes"
