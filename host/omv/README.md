# OpenMediaVault

OpenMediaVault (OMV) manages the data drive: it mounts it, shares it on the
network over Samba, and owns the SSH settings. OMV keeps all of this in
`/etc/openmediavault/config.xml` and regenerates the system files from it,
so **change these settings in OMV, not in the files it generates**
(`/etc/fstab`, `/etc/samba/smb.conf`, `/etc/ssh/sshd_config`).

`config.xml` is never committed: it holds user accounts and password hashes.
I keep a copy in my private backups.

## Install

```sh
# OMV itself (adds its own package source first; see the OMV docs for the current command)
wget -O - https://github.com/OpenMediaVault-Plugin-Developers/installScript/raw/master/install | sudo bash
```

The install script also adds **OMV-Extras**, which provides the
**write cache** plugin (`openmediavault-writecache`). I use it to keep logs and
package caches in RAM (zram) and write them to the SSD at shutdown, which
saves wear.

If OMV is ever removed but `/etc/openmediavault/config.xml` survives,
reinstalling OMV picks the old settings back up:

```sh
sudo apt install openmediavault
sudo omv-rpc -u admin Config applyChanges '{"modules": [], "force": false}'
```

## Settings

All set in OMV's web page (`https://<pi>`).

**Storage**
- The data drive is formatted ext4 and mounted by OMV under `/srv/dev-disk-by-uuid-<id>`
  (that path goes in the apps' `.env` files as `DATA_DISK`).
- One shared folder on it, shared over Samba (SMB).

**Samba share**
- Guests off; only my user (and its group) can read and write.
- Minimum protocol SMB2; NetBIOS off.
- New files `0664`, new folders `0775`.
- macOS compatibility options off.

**SSH** (Services → SSH)
- Public key login only (password login off), root login off, TCP forwarding off.
- X11 forwarding is a system-wide OMV setting rather than a page option:

  ```sh
  echo 'OMV_SSHD_X11FORWARDING="no"' | sudo tee -a /etc/default/openmediavault
  sudo omv-salt stage run prepare && sudo omv-salt deploy run ssh
  ```

**Web page**
- HTTPS only, with a self-signed certificate (System → Certificates → SSL);
  plain HTTP redirects to HTTPS.

**Drive health** (Storage → S.M.A.R.T.)
- Monitoring on for both drives, checked every 30 minutes, skipped while a
  drive is asleep so checks never spin up the hard drive.
- Weekly short self-test of the hard drive, Sundays at 3 AM.
- The same readings show in the display manager's control panel
  (see [`../drive-health/`](../drive-health/)).

**Quotas**
OMV mounts the drive with user/group quotas. On ext4 drives with the
built-in quota feature, the extra `quotaon`/`quotacheck` services OMV
triggers fail harmlessly and mark the system "degraded"; I mask them:

```sh
U=$(systemd-escape -p /srv/dev-disk-by-uuid-<id>)
sudo systemctl mask "quotaon@$U.service" "systemd-quotacheck@$U.service"
```
