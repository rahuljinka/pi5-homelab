import React from "react";
import { StatusBadge } from "./ui";
import { isRunning } from "./DockerStats";

// Every web page the Pi serves, with a link to each.
// Links use the address this panel was opened with (home network name/IP or
// Tailscale), so they work from anywhere the panel does. Ports match the
// compose files in services/ and apps/.
// `container` ties a page to the container that serves it, for its status.
const PAGES = [
    { name: "Control panel", note: "This page", path: "/", here: true, container: "display-manager-panel" },
    { name: "API docs", note: "Display manager API reference", path: "/api/docs", here: true, container: "display-manager-backend" },
    { name: "Kiosk display", note: "Only on the Pi itself", local: "http://127.0.0.1:5174", container: "display-manager-display" },
    { name: "Immich", note: "Photos", scheme: "http", port: 2283, container: "immich_server" },
    { name: "Jellyfin", note: "Media server", scheme: "http", port: 8096, container: "jellyfin" },
    { name: "Pi-hole", note: "Ad blocking DNS", scheme: "http", port: 8081, path: "/admin", container: "pihole" },
    { name: "Portainer", note: "Docker management (home network only)", scheme: "https", port: 9443, container: "portainer" },
    { name: "OpenMediaVault", note: "Drives and shares (runs on the Pi, not in Docker)", scheme: "https", port: 443 },
];

function pageUrl(page) {
    if (page.local) return null;
    if (page.here) return new URL(page.path, window.location.origin).href;
    const port = (page.scheme === "https" && page.port === 443) || (page.scheme === "http" && page.port === 80) ? "" : `:${page.port}`;
    return `${page.scheme}://${window.location.hostname}${port}${page.path || "/"}`;
}

function pageStatus(page, containers) {
    if (!page.container) return { status: "info", text: "Host" };
    const container = containers?.find((c) => c.name === page.container);
    if (!containers) return { status: "info", text: "…" };
    if (!container) return { status: "warning", text: "Not found" };
    return isRunning(container) ? { status: "healthy", text: "Running" } : { status: "error", text: container.status };
}

export function webPagesSummary(containers) {
    if (!containers) return `${PAGES.length} pages`;
    const down = PAGES.filter((p) => p.container && pageStatus(p, containers).status !== "healthy").length;
    return `${PAGES.length} pages${down ? ` · ${down} down` : ""}`;
}

export default function WebPages({ containers }) {
    return (
        <div>
            {PAGES.map((page, idx) => {
                const url = pageUrl(page);
                const { status, text } = pageStatus(page, containers);
                return (
                    <div
                        key={page.name}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "var(--spacing-sm)",
                            padding: "var(--spacing-sm) 0",
                            borderBottom: idx === PAGES.length - 1 ? "none" : "1px solid var(--color-border)",
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            {url ? (
                                <a
                                    href={url}
                                    target={page.here ? undefined : "_blank"}
                                    rel="noopener noreferrer"
                                    style={{ fontWeight: "600", color: "var(--color-primary)", textDecoration: "none" }}
                                >
                                    {page.name} ↗
                                </a>
                            ) : (
                                <span style={{ fontWeight: "600" }}>{page.name}</span>
                            )}
                            <span style={{ fontSize: "12px", color: "var(--color-textSecondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {url || page.local} · {page.note}
                            </span>
                        </div>
                        <StatusBadge status={status}>{text}</StatusBadge>
                    </div>
                );
            })}
        </div>
    );
}
