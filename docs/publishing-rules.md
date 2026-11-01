# Publishing rules

This repo is public. These rules decide what goes in it.

## Published
- Source code, Dockerfiles, compose files (using `${VARIABLES}`)
- `.env.example` files with fake values
- Docs, READMEs, diagrams, and screenshots made with **sample data**
- Pi setup files with personal details replaced by placeholders
- Hardware specs, which services run and on which ports

## Never published
- Passwords, keys, tokens, `.env` files
- My location (town or coordinates), addresses on my network, hostname,
  usernames, email address
- Drive IDs and mount paths, folder names on my drives
- Photos, GIFs, media, and any app data (`data/`, `media/`)
- OMV's `config.xml`, config dumps, backups
- How I run and develop the system day to day (my dev/prod guide and runbook),
  which I keep in a separate private repo

## How it's enforced
1. **`.gitignore`** keeps private paths and all images (except
   `docs/images/`) out by default.
2. **Pre-commit hook** ([`.githooks/pre-commit`](../.githooks/pre-commit))
   runs [`scripts/check-secrets.py`](../scripts/check-secrets.py) on every
   commit. It blocks secret-looking strings, every value from the local
   `.env` files, a private list of personal patterns (kept outside git),
   forbidden file types, images outside `docs/images/`, and files over 1 MB.
3. **GitHub check** ([`.github/workflows/checks.yml`](../.github/workflows/checks.yml))
   runs gitleaks over the whole history plus the same check on every push.

When something new could be personal, it's private until I decide otherwise.
