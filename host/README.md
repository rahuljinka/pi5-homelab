# host/

Setup that lives on the Pi itself rather than in a container. Personal
details (addresses, disk IDs, folder names) are placeholders here; the real
values are filled in when installing.

| Folder | What it sets up | Install (from the repo root) |
|---|---|---|
| [`boot/`](boot/config.txt) | Fan PWM and LED SPI in `/boot/firmware/config.txt` | append the lines, reboot |
| [`omv/`](omv/README.md) | OpenMediaVault: the data drive, the network share, SSH, HTTPS, drive health checks | follow the README |
| [`firewall/`](firewall/) | Only my home network and Tailscale may connect (IPv4 and IPv6, including Docker ports) | `sudo host/firewall/install.sh <lan-subnet> <lan-interface>` |
| [`kiosk/`](kiosk/) | The display starts by itself at boot: console autologin, X, Chromium full screen | `host/kiosk/install.sh` |
| [`display-manager-power/`](display-manager-power/) | Lets the control panel's Reboot/Shutdown buttons work without giving the app host access | `sudo host/display-manager-power/install.sh` |
| [`drive-health/`](drive-health/) | Saves SMART drive health every 30 minutes for the control panel | `sudo host/drive-health/install.sh` |

The full order of steps for a new Pi is in [`docs/rebuild.md`](../docs/rebuild.md).
