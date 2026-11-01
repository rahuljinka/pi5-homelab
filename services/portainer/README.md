# Portainer

A web UI for looking at and managing Docker containers, at
`https://<pi>:9443` (self-signed certificate, so the browser warns the first
time).

Portainer has full control of Docker through the Docker socket, so it is
served over HTTPS only, and the firewall keeps it reachable only at home
and over Tailscale. Its unused edge-agent port (8000) and plain-HTTP port
(9000) are not published.

**First run:** `cp .env.example .env`, set `PORTAINER_DATA`,
`../../scripts/deploy.sh portainer`, then create the admin user within a
few minutes (Portainer locks first-time setup after a timeout).
