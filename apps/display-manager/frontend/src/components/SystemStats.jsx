import React, { useEffect, useState } from "react";
import { Card, ProgressBar, SectionHeader, Collapsible } from "./ui";
import DockerStats, { isRunning } from "./DockerStats";
import DriveHealth, { driveHealthSummary } from "./DriveHealth";

import { API as API_URL, apiFetch } from "../api";

function formatBytes(bytes) {
    const tb = bytes / 1e12;
    if (tb >= 1) return `${tb.toFixed(2)} TB`;
    return `${Math.round(bytes / 1e9)} GB`;
}

// Amber when a drive is getting full, red when it's nearly out of space.
function driveColor(percent) {
    if (percent >= 95) return "var(--color-error)";
    if (percent >= 85) return "var(--color-warning)";
    return "var(--color-info)";
}

export default function SystemStats() {
    const [stats, setStats] = useState(null);
    const [containers, setContainers] = useState(null);
    const [health, setHealth] = useState(null);

    async function loadHealth() {
        try {
            const response = await apiFetch(`${API_URL}/drives/health`);
            setHealth(await response.json());
        } catch (error) {
            console.error("Drive health failed:", error);
        }
    }

    async function loadContainers() {
        try {
            const response = await apiFetch(`${API_URL}/containers`);
            setContainers(await response.json());
        } catch (error) {
            console.error("Docker stats failed:", error);
        }
    }

    async function loadStats() {
        try {
            const response = await apiFetch(`${API_URL}/stats`);
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error("Stats failed:", error);
        }
    }

    useEffect(() => {
        loadStats();
        loadContainers();
        loadHealth();
        const interval = setInterval(loadStats, 5000);
        const containerInterval = setInterval(loadContainers, 10000);
        const healthInterval = setInterval(loadHealth, 60000);
        return () => {
            clearInterval(interval);
            clearInterval(containerInterval);
            clearInterval(healthInterval);
        };
    }, []);

    if (!stats) {
        return (
            <div>
                <SectionHeader title="System Information" />
                <Card><p style={{ color: "var(--color-textSecondary)", margin: 0 }}>Loading stats...</p></Card>
            </div>
        );
    }

    let containerSummary = null;
    if (containers) {
        const running = containers.filter(isRunning).length;
        const stopped = containers.length - running;
        containerSummary = `${running} running${stopped ? ` · ${stopped} stopped` : ""}`;
    }

    return (
        <div>
            <SectionHeader title="System Information" />
            <Card>
                <div style={{ display: "grid", gap: "var(--spacing-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--color-textSecondary)" }}>Hostname</span>
                        <span style={{ fontWeight: "600" }}>{stats.hostname}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--color-textSecondary)" }}>IP Address</span>
                        <span style={{ fontWeight: "600" }}>{stats.ip}</span>
                    </div>
                    
                    <hr style={{ border: "0", borderTop: "1px solid var(--color-border)", margin: "var(--spacing-xs) 0" }} />
                    
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ color: "var(--color-textSecondary)" }}>CPU Usage</span>
                            <span style={{ fontWeight: "600" }}>{stats.cpu}%</span>
                        </div>
                        <ProgressBar value={stats.cpu} />
                    </div>

                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                            <span style={{ color: "var(--color-textSecondary)" }}>RAM Usage</span>
                            <span style={{ fontWeight: "600" }}>{stats.ram_percent}%</span>
                        </div>
                        <ProgressBar value={stats.ram_percent} color="var(--color-secondary)" />
                    </div>

                    {(stats.drives || []).map((drive) => (
                        <div key={drive.name}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--spacing-sm)", marginBottom: "4px" }}>
                                <span style={{ color: "var(--color-textSecondary)" }}>{drive.name}</span>
                                {drive.available ? (
                                    <span style={{ fontWeight: "600", textAlign: "right" }}>
                                        <span style={{ fontWeight: "400", fontSize: "13px", color: "var(--color-textSecondary)", marginRight: "var(--spacing-sm)" }}>
                                            {formatBytes(drive.used)} of {formatBytes(drive.total)}
                                        </span>
                                        {drive.percent}%
                                    </span>
                                ) : (
                                    <span style={{ fontWeight: "600", color: "var(--color-error)" }}>Not mounted</span>
                                )}
                            </div>
                            <ProgressBar value={drive.available ? drive.percent : 0} color={driveColor(drive.percent)} />
                        </div>
                    ))}

                    <hr style={{ border: "0", borderTop: "1px solid var(--color-border)", margin: "var(--spacing-xs) 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--color-textSecondary)" }}>Temperature</span>
                        <span style={{ fontWeight: "600", color: stats.temperature > 60 ? "var(--color-error)" : "var(--color-success)" }}>
                            {stats.temperature}°C
                        </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--color-textSecondary)" }}>Uptime</span>
                        <span style={{ fontWeight: "600" }}>{stats.uptime}</span>
                    </div>

                    <hr style={{ border: "0", borderTop: "1px solid var(--color-border)", margin: "var(--spacing-xs) 0" }} />

                    <Collapsible title="Drive Health" summary={driveHealthSummary(health)}>
                        <DriveHealth health={health} />
                    </Collapsible>

                    <Collapsible title="Docker Containers" summary={containerSummary}>
                        <DockerStats containers={containers} />
                    </Collapsible>
                </div>
            </Card>
        </div>
    );
}
