#!/bin/sh
# Production deploy: build (if needed) and restart one app or service.
#
#   ./scripts/deploy.sh display-manager   # apps/display-manager (built from source)
#   ./scripts/deploy.sh immich            # services/immich (pinned image)
#   ./scripts/deploy.sh all               # every app and service
#
# Production runs whatever is checked out, so deploy from an up-to-date main:
#   git switch main && git pull
set -eu
repo=$(cd "$(dirname "$0")/.." && pwd)

deploy() {
    if [ -f "$repo/apps/$1/compose.yaml" ]; then dir="$repo/apps/$1"
    elif [ -f "$repo/services/$1/compose.yaml" ]; then dir="$repo/services/$1"
    else echo "No app or service named '$1'." >&2; exit 1; fi

    [ -f "$dir/.env" ] || { echo "$1: missing $dir/.env (copy .env.example and fill it in)." >&2; exit 1; }
    echo "== Deploying $1"
    (cd "$dir" && docker compose up -d --build --remove-orphans)
}

branch=$(git -C "$repo" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
[ "$branch" = "main" ] || echo "Note: deploying from branch '$branch', not main."

target="${1:?usage: deploy.sh <app|service|all>}"
if [ "$target" = all ]; then
    for d in "$repo"/services/*/ "$repo"/apps/*/; do deploy "$(basename "$d")"; done
else
    deploy "$target"
fi
docker image prune -f >/dev/null   # drop images replaced by this deploy
