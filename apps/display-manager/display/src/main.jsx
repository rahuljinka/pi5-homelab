import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";

import ClockScreen from "./screens/ClockScreen";
import WeatherScreen from "./screens/WeatherScreen";
import MediaScreen from "./screens/MediaScreen";
import { ThemeProvider } from "./theme/ThemeContext";
import { GlobalStyles } from "./theme/GlobalStyles";

// Same-origin: the display's web server forwards /api to the backend.
const API = "/api";

function App() {
    const [screen, setScreen] = useState("loading");
    const refreshId = useRef(null);

    async function loadScreen() {
        try {
            const response = await fetch(`${API}/screen`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setScreen(data.screen);

            // "Refresh Display" in the control panel bumps this id.
            if (data.refresh !== undefined) {
                if (refreshId.current !== null && refreshId.current !== data.refresh) {
                    window.location.reload();
                }
                refreshId.current = data.refresh;
            }
        }
        catch (error) {
            console.error("Screen error:", error);
            setScreen("error");
        }
    }

    useEffect(() => {
        loadScreen();
        const timer = setInterval(loadScreen, 3000);
        return () => clearInterval(timer);
    }, []);

    // The kiosk never reloads on its own, so check once a minute whether a
    // new build has been deployed (the bundle filename hash changes) and
    // reload to pick it up.
    useEffect(() => {
        const currentBundle = document.querySelector('script[type="module"][src]')?.getAttribute("src");
        if (!currentBundle) return;

        const timer = setInterval(async () => {
            try {
                const html = await (await fetch("/", { cache: "no-store" })).text();
                if (!html.includes(currentBundle)) window.location.reload();
            } catch {
                // Server briefly down during a redeploy; try again next time.
            }
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    function renderScreen() {
        switch (screen) {
            case "clock":
            case "dashboard": // old name for the clock screen
                return <ClockScreen />;
            case "weather":
                return <WeatherScreen />;
            case "media":
                return <MediaScreen />;
            case "loading":
                return (
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        fontSize: "24px",
                        color: "var(--color-textSecondary)"
                    }}>
                        Loading...
                    </div>
                );
            case "error":
                return (
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        fontSize: "24px",
                        color: "var(--color-error)"
                    }}>
                        Backend Connection Error
                    </div>
                );
            default:
                return (
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        fontSize: "24px"
                    }}>
                        Unknown Screen: {screen}
                    </div>
                );
        }
    }

    return (
        <ThemeProvider>
            <GlobalStyles />
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    background: "var(--color-background)",
                    color: "var(--color-text)"
                }}
            >
                {renderScreen()}
            </div>
        </ThemeProvider>
    );
}

createRoot(
    document.getElementById("root")
).render(<App />);
