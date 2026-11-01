#!/bin/sh
# Makes the kiosk display start automatically at boot.
# Run as your normal user from the repo root:  host/kiosk/install.sh
# (it uses sudo for the one system setting).
#
#  1. Installs the kiosk session as ~/.xinitrc
#  2. Adds the autostart snippet to ~/.profile (once)
#  3. Turns on automatic console login (raspi-config "B2"); this applies to
#     the Pi's own screen only, not to SSH
# Undo: sudo raspi-config nonint do_boot_behaviour B1, and remove the snippet.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
install -m 0755 "$here/xinitrc" "$HOME/.xinitrc"
if ! grep -q 'kiosk autostart (pi5-homelab' "$HOME/.profile" 2>/dev/null; then
    printf '\n' >> "$HOME/.profile"
    cat "$here/profile-snippet" >> "$HOME/.profile"
fi
sudo raspi-config nonint do_boot_behaviour B2
echo "Kiosk autostart installed. It takes effect at the next boot."
