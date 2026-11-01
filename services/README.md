# services/

Third-party self-hosted apps. Each folder has a pinned `compose.yaml`, a
`.env.example` to copy to `.env`, and a README with first-run steps. No data
lives here: everything they store is on the data drive, at paths set in
each `.env`.

| Service | Port | Purpose |
|---|---|---|
| [immich](immich/) | 2283 | Photo backup |
| [jellyfin](jellyfin/) | 8096 | Movies and shows |
| [pihole](pihole/) | 53, 8081 | DNS ad blocking |
| [portainer](portainer/) | 9443 | Docker management |

Deploy one with `./scripts/deploy.sh <name>` from the repo root.
