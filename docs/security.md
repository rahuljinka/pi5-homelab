# Security

How the Pi is locked down, in general terms (addresses are placeholders).

## Network
- **No port forwarding** from the internet. Remote access is Tailscale only.
- **Host firewall** ([`host/firewall/`](../host/firewall/)): only the home
  network and Tailscale may connect, over IPv4 and IPv6, including Docker's
  published ports. The Pi has a public IPv6 address, so this doesn't rely on
  the router alone.
- Admin pages that control the system use **HTTPS**: OpenMediaVault and
  Portainer (self-signed certificates).

## Logins
- **SSH:** public key only, no root login, no X11 forwarding (set in OMV so
  it survives OMV regenerating the config).
- **sudo** requires my password.
- Each web app has its own login. The display manager's control panel
  stores only a scrypt hash of its password and hashed session tokens.

## Containers
- No privileged containers. Each gets only the devices or folders it needs.
- Only Portainer and the display manager's read-only proxy touch the Docker
  socket. Portainer is HTTPS-only and reachable only at home.
- Every image is pinned to an exact version.

## Secrets
- Passwords, keys and personal settings live in `.env` files readable only
  by my user, never in compose files or git.
- A pre-commit hook and a GitHub check
  ([`scripts/check-secrets.py`](../scripts/check-secrets.py) and gitleaks)
  block private information from being committed.

## Updates
- Unattended security updates for the OS.
- Container images are upgraded deliberately: read the release notes,
  change the pinned version, deploy. Immich gets a database backup first.

## Physical access
The Pi logs in automatically on its own screen to run the kiosk. Anyone at
the Pi's keyboard gets that session, but not root: `sudo` asks for my
password.
