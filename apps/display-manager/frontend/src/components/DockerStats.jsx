import React from "react";
import { StatusBadge } from "./ui";

export const isRunning = (container) => {
    const status = container.status.toLowerCase();
    return status === "running" || status.includes("up");
};

// List of container names, images and statuses.
export default function DockerStats({ containers }) {
    if (!containers) {
        return <p style={{ color: "var(--color-textSecondary)", margin: 0 }}>Loading containers…</p>;
    }
    if (containers.length === 0) {
        return <p style={{ color: "var(--color-textSecondary)", margin: 0 }}>No containers found</p>;
    }

    const sorted = [...containers].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div>
            {sorted.map((container, idx) => (
                <div
                    key={container.name}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "var(--spacing-sm)",
                        padding: "var(--spacing-sm) 0",
                        borderBottom: idx === sorted.length - 1 ? "none" : "1px solid var(--color-border)",
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontWeight: "600" }}>{container.name}</span>
                        <span style={{ fontSize: "12px", color: "var(--color-textSecondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {container.image || "Unknown Image"}
                        </span>
                    </div>
                    <StatusBadge status={isRunning(container) ? "healthy" : "error"}>
                        {container.status}
                    </StatusBadge>
                </div>
            ))}
        </div>
    );
}
