#!/bin/sh
# Development stack for an app: runs beside production with live reload,
# simulated hardware, no login and its own data.
set -eu
repo=$(cd "$(dirname "$0")/.." && pwd)
app="${1:?usage: dev.sh <app> [up|logs|down]}"
dir="$repo/apps/$app"
[ -f "$dir/compose.dev.yaml" ] || { echo "No dev stack for '$app'." >&2; exit 1; }
[ -f "$dir/.env" ] || cp "$dir/.env.example" "$dir/.env"
compose() { (cd "$dir" && docker compose -f compose.dev.yaml "$@"); }

case "${2:-up}" in
    up)
        compose up -d --build
        host=$(hostname)
        echo "Control panel: http://$host:3100   Display: http://$host:5175   API docs: http://$host:3100/api/docs" ;;
    logs) compose logs -f ;;
    down) compose down ;;
    *) echo "Unknown command '$2' (use up, logs or down)." >&2; exit 1 ;;
esac
