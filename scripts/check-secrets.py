#!/usr/bin/env python3
"""
Refuses to let private information into the repo.

Runs automatically before every commit (.githooks/pre-commit) and on every
push (GitHub Actions). It checks the files that would be committed for:

  * secret-looking strings: private keys, tokens, hard-coded passwords
  * every value in the repo's local .env files (passwords, paths, location)
  * personal patterns listed in private/secret-patterns.txt (one per line;
    that file is git-ignored, so the list itself is never published)
  * files that must never be committed: .env, keys, saved app data, archives
  * photos, GIFs and video outside docs/images
  * files larger than 1 MB

Usage:
  scripts/check-secrets.py --staged   files staged for commit (the hook)
  scripts/check-secrets.py --all      every file git would publish
"""

import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_BYTES = 1024 * 1024

FORBIDDEN_NAMES = re.compile(
    r"(^|/)(\.env|auth\.json|state\.json|id_rsa|id_ed25519|hosts\.yml)$"
    r"|\.(pem|key|p12|bundle|tgz|tar\.gz|sqlite|db)$"
)
MEDIA = re.compile(r"\.(gif|jpe?g|png|heic|heif|webp|mp4|mov)$", re.I)
MEDIA_ALLOWED = re.compile(r"(^|/)docs/images/")

GENERIC_PATTERNS = [
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("GitHub token", re.compile(r"\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}")),
    ("AWS key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("Tailscale key", re.compile(r"\btskey-[A-Za-z0-9-]{10,}")),
    # A password/secret/token given a quoted literal value (code or config).
    ("hard-coded password", re.compile(
        r"(?i)(password|passwd|secret|api[_-]?key|token)[\w-]*\s*[:=]\s*['\"](?!\$\{|replace-with|change-me)[^'\"\s]{8,}['\"]")),
    ("Gmail address", re.compile(r"[A-Za-z0-9._%+-]+@gmail\.com", re.I)),
]

# In config files (not code), also catch unquoted values like PASSWORD=abc123...
CONFIG_FILE = re.compile(r"\.(ya?ml|env\.example|conf|ini|toml|txt|md|service|nft)$|(^|/)\.env\.example$")
UNQUOTED_SECRET = re.compile(
    r"(?i)^\s*-?\s*[\w-]*(password|passwd|secret|api[_-]?key|token)[\w-]*\s*[:=]\s*(?!\$\{|replace-with|change-me|['\"])[^\s#]{8,}\s*$")

# .env keys whose values are ordinary words, not private.
ENV_KEYS_NOT_PRIVATE = {
    "DB_USERNAME", "DB_DATABASE_NAME", "WEATHER_UNITS", "IMMICH_VERSION",
    "SCREEN_SCHEDULE", "PANEL_PORT", "APP_ENV",
}


def git(*args):
    return subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, check=True).stdout


def files_to_check(mode):
    if mode == "--staged":
        out = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
    else:
        out = git("ls-files", "-z", "--cached", "--others", "--exclude-standard")
    return [f for f in out.split("\0") if f]


def private_values():
    """Values from local .env files plus private/secret-patterns.txt."""
    values = set()
    for root, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "data", "data-dev", "media")]
        for name in files:
            if name != ".env":
                continue
            for line in open(os.path.join(root, name), errors="ignore"):
                key, sep, value = line.strip().partition("=")
                value = value.strip().strip("'\"")
                if sep and not key.startswith("#") and key.strip() not in ENV_KEYS_NOT_PRIVATE and len(value) >= 6:
                    values.add(value)
    patterns_file = os.path.join(REPO, "private", "secret-patterns.txt")
    if os.path.exists(patterns_file):
        for line in open(patterns_file):
            line = line.strip()
            if line and not line.startswith("#"):
                values.add(line)
    return values


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--staged"
    files = files_to_check(mode)
    secrets = private_values()
    problems = []

    for path in files:
        full = os.path.join(REPO, path)
        if not os.path.isfile(full):
            continue
        if FORBIDDEN_NAMES.search(path) and not path.endswith(".example"):
            problems.append(f"{path}: this kind of file is never committed")
            continue
        if MEDIA.search(path) and not MEDIA_ALLOWED.search(path):
            problems.append(f"{path}: images/video only belong in docs/images")
            continue
        if os.path.getsize(full) > MAX_BYTES:
            problems.append(f"{path}: larger than 1 MB")
            continue
        if MEDIA.search(path):
            continue  # an allowed screenshot; don't scan image bytes as text
        try:
            text = open(full, encoding="utf-8").read()
        except UnicodeDecodeError:
            problems.append(f"{path}: binary file")
            continue
        for number, line in enumerate(text.splitlines(), 1):
            for label, pattern in GENERIC_PATTERNS:
                if pattern.search(line):
                    problems.append(f"{path}:{number}: looks like a {label}")
            if CONFIG_FILE.search(path) and UNQUOTED_SECRET.search(line):
                problems.append(f"{path}:{number}: looks like a hard-coded password")
            lowered = line.lower()
            for value in secrets:
                if value.lower() in lowered:
                    problems.append(f"{path}:{number}: contains a private value (from .env or private/secret-patterns.txt)")
                    break

    if problems:
        print("Private information check FAILED. Nothing was committed.\n")
        for p in problems:
            print("  " + p)
        print("\nMove the value into a .env file or private/, or replace it with a placeholder.")
        return 1
    print(f"Private information check passed ({len(files)} files).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
