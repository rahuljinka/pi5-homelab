import React from "react";
import { createRoot } from "react-dom/client";

import QuickControls from "./components/QuickControls";
import SystemStats from "./components/SystemStats";
import HardwareControls from "./components/HardwareControls";
import MediaManager from "./components/MediaManager";
import ClockPhotos from "./components/ClockPhotos";
import AuthGate, { logout } from "./components/AuthGate";
import { ThemeProvider, useTheme, SYSTEM_THEME } from "./theme/ThemeContext";
import { GlobalStyles } from "./theme/GlobalStyles";
import { Button } from "./components/ui";

const THEME_OPTIONS = [
    { id: SYSTEM_THEME, label: "Auto", title: "Match this device's light/dark setting" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "amoled", label: "AMOLED" },
];

// Compact segmented control for the page theme.
function ThemePicker() {
    const { themeName, setTheme } = useTheme();

    return (
        <div
            role="radiogroup"
            aria-label="Theme"
            style={{
                display: "inline-flex",
                padding: "3px",
                gap: "2px",
                borderRadius: "var(--radius-md)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
            }}
        >
            {THEME_OPTIONS.map((option) => {
                const active = themeName === option.id;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={option.title || `${option.label} theme`}
                        onClick={() => setTheme(option.id)}
                        style={{
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            minHeight: "32px",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                            background: active ? "var(--color-primary)" : "transparent",
                            color: active ? "#ffffff" : "var(--color-textSecondary)",
                        }}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

function App() {
    return (
        <ThemeProvider>
            <GlobalStyles />
            <AuthGate>
            <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "var(--spacing-lg)" }}>
                <header style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "var(--spacing-md)",
                }}>
                    <h1 style={{ margin: 0, fontSize: "26px" }}>Pi Display Manager</h1>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", flexWrap: "wrap" }}>
                        <ThemePicker />
                        <Button variant="ghost" size="sm" onClick={logout}>Log out</Button>
                    </div>
                </header>

                <QuickControls />

                <SystemStats />

                <div style={{ marginTop: "var(--spacing-lg)" }}>
                    <HardwareControls />
                </div>

                <MediaManager />

                <ClockPhotos />
            </div>
            </AuthGate>
        </ThemeProvider>
    );
}

createRoot(document.getElementById("root")).render(<App />);
