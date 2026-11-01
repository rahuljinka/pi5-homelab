# Rebuilding from scratch

The steps to go from a blank Pi to the full system. Each step links to the
file that does the work. Values in `<angle brackets>` are mine to fill in;
my real values are in my private runbook, not in this repo.

**Time:** about 2 hours, most of it waiting on installs.

## 0. Before starting

- Back up anything on the data drive that isn't already backed up.
- Have my private backups at hand: the `.env` files for each app and
  service, and OMV's `config.xml`.
- Hardware assembled: NVMe on the NVMe Base, fan on GPIO 18 (pin 12),
  LED data on GPIO 10 (pin 19), display on HDMI 0, data drive on USB 3.

## 1. Operating system

1. Flash **Raspberry Pi OS Lite (64-bit)** to the NVMe with Raspberry Pi
   Imager. In its settings: hostname, my user, SSH with **public key**
   only (paste my Mac's `~/.ssh/id_ed25519.pub`), Wi-Fi off (wired), time zone.
2. Boot from NVMe, then update:

   ```sh
   sudo apt update && sudo apt full-upgrade -y
   sudo apt install -y git smartmontools \
       xserver-xorg xinit openbox chromium unclutter fonts-noto-color-emoji
   # Docker Engine + Compose from Docker's own repository
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker "$USER"     # log out and in again afterwards
   ```

3. Turn on automatic security updates:

   ```sh
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -f noninteractive unattended-upgrades
   ```

## 2. This repo

```sh
git clone https://github.com/rahuljinka/pi5-homelab.git ~/pi5-homelab
cd ~/pi5-homelab
git config core.hooksPath .githooks       # turn on the private-info check
```

## 3. Boot settings (fan and LED)

Append [`host/boot/config.txt`](../host/boot/config.txt) to
`/boot/firmware/config.txt`, then reboot. Check:

```sh
ls /sys/class/pwm/pwmchip0 /dev/spidev0.0
```

## 4. OpenMediaVault and the data drive

Follow [`host/omv/README.md`](../host/omv/README.md): install OMV, then
either restore my saved `config.xml` or set up by hand: mount the data
drive, the shared folder and Samba share, SSH (keys only, no root), HTTPS,
SMART monitoring and the weekly self-test.

Note where OMV mounted the drive (`/srv/dev-disk-by-uuid-<id>`); every
`.env` below uses it.

## 5. Tailscale

```sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

## 6. Firewall

Only after SSH works with a key and Tailscale is up:

```sh
sudo host/firewall/install.sh <lan-subnet> <lan-interface>    # e.g. 192.168.0.0/24 eth0
```

From another device on the network, check the control panel and SSH still
connect. To undo: `sudo systemctl disable --now homelab-firewall`.

## 7. Services

For each of `services/immich`, `services/jellyfin`, `services/pihole`,
`services/portainer`:

```sh
cd services/<name>
cp .env.example .env && nano .env      # or restore my saved .env
chmod 600 .env
cd ../..
./scripts/deploy.sh <name>
```

Each folder's README covers its first-run setup.

## 8. Pi Display Manager

```sh
cd apps/display-manager
cp .env.example .env && nano .env      # DISPLAY_KEY: openssl rand -hex 24
chmod 600 .env
cd ../..
./scripts/deploy.sh display-manager
sudo host/display-manager-power/install.sh     # Reboot/Shutdown buttons
sudo host/drive-health/install.sh              # Drive Health section
```

Then open `http://<pi>:3000`. The first visit asks for a one-time setup
code to create the control panel password:

```sh
docker logs display-manager-backend | grep "setup code"
```

## 9. Kiosk screen

```sh
host/kiosk/install.sh
sudo reboot
```

After the reboot the screen comes up by itself.

## 10. Check everything

```sh
systemctl is-system-running        # "running"
docker ps                          # every container Up / healthy
sudo nft list table inet homelab_fw
```

- `https://<pi>`: OMV
- `http://<pi>:3000`: control panel (Drive Health shows both drives)
- `http://<pi>:2283`, `:8096`, `:8081/admin`, `https://<pi>:9443`: services
