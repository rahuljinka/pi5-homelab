import React from "react";
import { StatusBadge } from "./ui";

// SMART health per drive, from GET /api/drives/health. The readings are
// saved every 30 minutes by a job on the Pi (host/drive-health/).

const STATUS = {
    good: { badge: "healthy", label: "Healthy" },
    warning: { badge: "warning", label: "Warning" },
    failing: { badge: "error", label: "Failing" },
};

function formatCapacity(bytes) {
    if (!bytes) return null;
    return bytes >= 1e12 ? `${(bytes / 1e12).toFixed(1)} TB` : `${Math.round(bytes / 1e9)} GB`;
}

function formatHours(hours) {
    if (hours == null) return "—";
    const days = Math.round(hours / 24);
    return `${hours.toLocaleString()} h (${days.toLocaleString()} days)`;
}

export function timeAgo(iso) {
    if (!iso) return "never";
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

// One line for the collapsed header, e.g. "All healthy · checked 12 min ago".
export function driveHealthSummary(health) {
    if (!health) return null;
    if (!health.available) return "Not set up";
    const counts = { good: 0, warning: 0, failing: 0 };
    health.drives.forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });
    let text = counts.failing ? `${counts.failing} failing`
        : counts.warning ? `${counts.warning} warning`
        : "All healthy";
    if (health.stale) text += " · out of date";
    return `${text} · checked ${timeAgo(health.checked_at)}`;
}

function Row({ label, value }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--spacing-sm)", fontSize: "13px" }}>
            <span style={{ color: "var(--color-textSecondary)" }}>{label}</span>
            <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
        </div>
    );
}

export default function DriveHealth({ health }) {
    if (!health) {
        return <p style={{ margin: 0, color: "var(--color-textSecondary)" }}>Loading drive health…</p>;
    }
    if (!health.available) {
        return (
            <p style={{ margin: 0, color: "var(--color-textSecondary)", fontSize: "14px" }}>
                No readings yet. Install the drive health job on the Pi:{" "}
                <code>sudo host/drive-health/install.sh</code>
            </p>
        );
    }

    return (
        <div style={{ display: "grid", gap: "var(--spacing-md)" }}>
            {health.stale && (
                <p style={{ margin: 0, color: "var(--color-warning)", fontSize: "13px" }}>
                    These readings are from {timeAgo(health.checked_at)}. The drive health job on the Pi may have stopped
                    (<code>systemctl status display-manager-drive-health.timer</code>).
                </p>
            )}
            {health.drives.map((d) => {
                const status = STATUS[d.status] || STATUS.warning;
                const isNvme = d.type === "nvme";
                const test = d.last_self_test;
                return (
                    <div key={d.device} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "var(--spacing-sm) var(--spacing-md)", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--spacing-sm)", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                <span style={{ fontWeight: 600 }}>{d.model}</span>
                                <span style={{ fontSize: "12px", color: "var(--color-textSecondary)" }}>
                                    {[isNvme ? "NVMe SSD" : d.type === "hdd" ? "Hard drive" : "SSD", formatCapacity(d.capacity_bytes), d.asleep ? "asleep, last reading shown" : null].filter(Boolean).join(" · ")}
                                </span>
                            </div>
                            <StatusBadge status={status.badge}>{status.label}</StatusBadge>
                        </div>
                        {d.reasons && d.reasons.length > 0 && (
                            <p style={{ margin: 0, fontSize: "13px", color: d.status === "failing" ? "var(--color-error)" : "var(--color-warning)" }}>
                                {d.reasons.join(" · ")}
                            </p>
                        )}
                        <Row label="Temperature" value={d.temperature_c != null ? `${d.temperature_c} °C` : "—"} />
                        <Row label="Powered on" value={formatHours(d.power_on_hours)} />
                        {isNvme ? (
                            <Row label="Wear" value={d.wear_percent != null ? `${d.wear_percent}% used · ${d.available_spare_percent ?? "—"}% spare left` : "—"} />
                        ) : (
                            <Row label="Bad / pending sectors" value={`${d.reallocated_sectors ?? "—"} / ${d.pending_sectors ?? "—"}`} />
                        )}
                        <Row label="Last self-test" value={test ? `${test.result || "done"}` : "none yet"} />
                    </div>
                );
            })}
        </div>
    );
}
