# Pi-hole

Network-wide ad and tracker blocking. Devices use the Pi as their DNS
server; Pi-hole answers from its blocklists and forwards the rest to
Cloudflare (1.1.1.1) and Google (8.8.8.8). Admin page: `http://<pi>:8081/admin`.

- The admin password comes from `PIHOLE_PASSWORD` in `.env`.
- Settings and lists persist in `PIHOLE_DATA` on the data drive.
- To use it for the whole house, set the router's DNS server to the Pi.

**First run:** `cp .env.example .env`, set the password and path,
`../../scripts/deploy.sh pihole`.

Restarting Pi-hole interrupts DNS for the house for a few seconds.
