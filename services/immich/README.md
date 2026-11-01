# Immich

Self-hosted photo and video backup for my phones, plus my existing photo
folder indexed as an external library. Web and phone apps at `http://<pi>:2283`.

- `compose.yaml` is Immich's official file for the pinned release, with my
  photo folder mounted at `/photos`.
- Version: `IMMICH_VERSION` in `.env` (an exact release, e.g. `v3.0.3`).
- Uploads and the database live on the data drive (`UPLOAD_LOCATION`,
  `DB_DATA_LOCATION`). The machine-learning model cache is a Docker volume.

**First run:** `cp .env.example .env`, fill it in (`DB_PASSWORD`: letters
and numbers only), `../../scripts/deploy.sh immich`, then create the admin
account in the web app and add `/photos` as an external library
(Administration → External Libraries).

**Upgrading:** read the release notes (Immich has breaking changes between
majors), back up the database, change `IMMICH_VERSION`, compare
`compose.yaml` with the new release's file, then deploy.

```sh
docker exec -t immich_postgres pg_dumpall --clean --if-exists -U postgres \
  | gzip > ~/backups/immich-db-$(date +%F).sql.gz
```
