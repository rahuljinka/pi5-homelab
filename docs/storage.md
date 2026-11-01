# Storage

| Drive | What's on it |
|---|---|
| **NVMe SSD** (500 GB) | The OS, Docker, this repo, the display manager's media and saved settings |
| **USB hard drive** (500 GB) | Photos (Immich uploads and my photo library), movies and shows, each service's data (`appdata/`), the network share |

OpenMediaVault mounts the hard drive at `/srv/dev-disk-by-uuid-<id>`. Every
compose file refers to it through a `.env` value, never the real path.

## What lives where

| Data | Location | In git? |
|---|---|---|
| Code, compose files, docs | `~/pi5-homelab` | yes |
| Settings and passwords | `.env` next to each compose file | no |
| Display manager: GIFs and clock photos | `apps/display-manager/media/` | no |
| Display manager: saved settings, login, photo cache | `apps/display-manager/data/` | no |
| Immich uploads, database | data drive (`UPLOAD_LOCATION`, `DB_DATA_LOCATION`) | no |
| Jellyfin, Pi-hole, Portainer settings | data drive, `appdata/<service>` | no |
| OMV settings | `/etc/openmediavault/config.xml` | no |

## Keeping the drives healthy

- SMART monitoring on both drives (OMV), with a weekly short self-test of
  the hard drive; the readings also show in the control panel.
- OMV's write cache keeps logs and package caches in RAM and writes them
  out at shutdown, which saves SSD wear.

## Backups

Not set up yet. Everything on the hard drive exists only there, so a
backup copy of the photos (at least) is the next storage task.
