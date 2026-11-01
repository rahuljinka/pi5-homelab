# Jellyfin

Media server for my movies and shows, at `http://<pi>:8096`. Uses the
LinuxServer.io image, pinned to an exact build.

- Settings and metadata: `JELLYFIN_CONFIG` on the data drive.
- Libraries: `JELLYFIN_MOVIES` → `/data/movies`, `JELLYFIN_SHOWS` → `/data/shows`.
- Runs as my user (`PUID`/`PGID` 1000) so it can read files I add over the share.

**First run:** `cp .env.example .env`, fill in the paths,
`../../scripts/deploy.sh jellyfin`, then follow the setup wizard and add the
two libraries.
