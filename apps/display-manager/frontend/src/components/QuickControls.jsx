import React, { useEffect, useRef, useState } from "react";
import { Card, Button, SectionHeader } from "./ui";

import { API as API_URL, apiFetch } from "../api";

const SCREENS = [
    { id: "clock", label: "Clock" },
    { id: "weather", label: "Weather" },
    { id: "media", label: "Media" },
];

// Actions that need a second tap to confirm are marked `confirm`.
const ACTIONS = [
    {
        id: "refresh",
        label: "Refresh Display",
        endpoint: "/display/refresh",
        done: "Display will reload within a few seconds.",
    },
    {
        id: "restart",
        label: "Restart Backend",
        endpoint: "/system/restart-backend",
        done: "Backend is restarting. It should be back in about 10 seconds.",
    },
    {
        id: "reboot",
        label: "Reboot Pi",
        endpoint: "/system/reboot",
        confirm: "Tap again to reboot",
        done: "The Pi is rebooting. This page will reconnect when it's back (about a minute).",
    },
    {
        id: "shutdown",
        label: "Shutdown",
        endpoint: "/system/shutdown",
        confirm: "Tap again to shut down",
        done: "The Pi is shutting down. It will need to be powered back on by hand.",
    },
];

const screenLabel = (id) => SCREENS.find((s) => s.id === id)?.label || id;

function formatTime(hour, minute) {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function QuickControls() {
    const [screen, setScreen] = useState(null);
    const [pendingConfirm, setPendingConfirm] = useState(null);
    const [message, setMessage] = useState(null);
    const [schedule, setSchedule] = useState(null);
    const confirmTimer = useRef(null);

    async function loadScreen() {
        try {
            const response = await apiFetch(`${API_URL}/screen`);
            const data = await response.json();
            setScreen(data.screen);
        } catch {
            // Backend unreachable (e.g. restarting); keep the last known value.
        }
    }

    useEffect(() => {
        apiFetch(`${API_URL}/schedule`)
            .then((response) => response.json())
            .then((data) => setSchedule(data.entries || []))
            .catch(() => setSchedule(null));
    }, []);

    useEffect(() => {
        loadScreen();
        const interval = setInterval(loadScreen, 5000);
        return () => {
            clearInterval(interval);
            clearTimeout(confirmTimer.current);
        };
    }, []);

    async function changeScreen(newScreen) {
        setScreen(newScreen);
        try {
            await apiFetch(`${API_URL}/screen`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ screen: newScreen }),
            });
        } catch (error) {
            setMessage({ error: true, text: "Couldn't reach the backend to change the screen." });
        }
    }

    async function runAction(action) {
        if (action.confirm && pendingConfirm !== action.id) {
            setPendingConfirm(action.id);
            clearTimeout(confirmTimer.current);
            confirmTimer.current = setTimeout(() => setPendingConfirm(null), 4000);
            return;
        }

        setPendingConfirm(null);
        clearTimeout(confirmTimer.current);

        try {
            const response = await apiFetch(`${API_URL}${action.endpoint}`, { method: "POST" });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            setMessage({ error: false, text: action.done });
        } catch (error) {
            setMessage({ error: true, text: `${action.label} failed: ${error.message}` });
        }
    }

    return (
        <div>
            <SectionHeader title="Quick Controls" />
            <Card>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-textSecondary)", marginBottom: "var(--spacing-sm)" }}>
                    SHOWING ON DISPLAY
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--spacing-sm)", marginBottom: "var(--spacing-lg)" }}>
                    {SCREENS.map((s) => (
                        <Button
                            key={s.id}
                            variant={screen === s.id ? "primary" : "ghost"}
                            onClick={() => changeScreen(s.id)}
                        >
                            {s.label}
                        </Button>
                    ))}
                </div>

                {schedule && schedule.length > 0 && (
                    <p style={{ margin: "calc(-1 * var(--spacing-md)) 0 var(--spacing-lg)", fontSize: "13px", color: "var(--color-textSecondary)" }}>
                        🕒 Automatic:{" "}
                        {[...schedule]
                            .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute))
                            .map((entry) => `${screenLabel(entry.screen)} at ${formatTime(entry.hour, entry.minute)}${entry.screen === "clock" ? " (on your chosen photo)" : ""}`)
                            .join(" · ")}
                        . You can still switch screens any time.
                    </p>
                )}

                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--color-textSecondary)", marginBottom: "var(--spacing-sm)" }}>
                    ACTIONS
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--spacing-sm)" }}>
                    {ACTIONS.map((action) => {
                        const confirming = pendingConfirm === action.id;
                        return (
                            <Button
                                key={action.id}
                                variant={confirming ? "danger" : "ghost"}
                                onClick={() => runAction(action)}
                                style={action.confirm && !confirming ? { color: "var(--color-error)" } : undefined}
                            >
                                {confirming ? action.confirm : action.label}
                            </Button>
                        );
                    })}
                </div>

                {message && (
                    <p style={{
                        margin: "var(--spacing-md) 0 0",
                        fontSize: "14px",
                        color: message.error ? "var(--color-error)" : "var(--color-success)",
                    }}>
                        {message.text}
                    </p>
                )}
            </Card>
        </div>
    );
}
