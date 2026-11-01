import React, { useEffect, useState } from "react";
import DisplayLayout from "../components/DisplayLayout";
import { Card } from "../components/ui";
import WeatherBackground from "../components/WeatherBackground";

// Same-origin: the display's web server forwards /api to the backend.
const API = "/api";

// WMO weather interpretation codes, as returned by Open-Meteo.
// https://open-meteo.com/en/docs#weathervariables
function describeWeather(code, isDay = true) {
    if (code === 0) return { kind: "clear", icon: isDay ? "☀️" : "🌙", label: "Clear" };
    if (code === 1) return { kind: "partlyCloudy", icon: isDay ? "🌤️" : "🌙", label: "Mostly Clear" };
    if (code === 2) return { kind: "partlyCloudy", icon: isDay ? "⛅" : "☁️", label: "Partly Cloudy" };
    if (code === 3) return { kind: "cloudy", icon: "☁️", label: "Overcast" };
    if (code === 45 || code === 48) return { kind: "fog", icon: "🌫️", label: "Fog" };
    if (code >= 51 && code <= 57) return { kind: "drizzle", icon: "🌦️", label: "Drizzle" };
    if (code >= 61 && code <= 67) return { kind: "rain", icon: "🌧️", label: "Rain" };
    if (code >= 71 && code <= 77) return { kind: "snow", icon: "❄️", label: "Snow" };
    if (code >= 80 && code <= 82) return { kind: "showers", icon: "🌦️", label: "Showers" };
    if (code === 85 || code === 86) return { kind: "snow", icon: "🌨️", label: "Snow Showers" };
    if (code >= 95) return { kind: "thunderstorm", icon: "⛈️", label: "Thunderstorm" };
    return { kind: "cloudy", icon: "🌡️", label: "Unknown" };
}

const formatDay = (dateStr) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });

const formatPercent = (value) => (value == null ? "–" : `${value}%`);

// Translucent panels so the animated sky shows through. (A backdrop blur
// looked nicer but re-blurred the canvas every frame, which was costly.)
const GLASS = {
    background: "rgba(16, 20, 30, 0.34)",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    boxShadow: "none",
};
const SECONDARY = "rgba(255, 255, 255, 0.72)";
const DIVIDER = "1px solid rgba(255, 255, 255, 0.16)";
const RAIN = "#8FD8FF";

// For testing the backgrounds: ?sky=rain&night=1 overrides the current conditions.
const PREVIEW = new URLSearchParams(window.location.search);

// Weather page (backend screen id: "weather").
export default function WeatherScreen() {
    const [weather, setWeather] = useState(null);

    async function loadWeather() {
        try {
            const response = await fetch(`${API}/weather`);
            setWeather(await response.json());
        } catch (error) {
            console.log("Weather error:", error);
            setWeather({ error: String(error) });
        }
    }

    useEffect(() => {
        loadWeather();
        const weatherTimer = setInterval(loadWeather, 600000);
        return () => clearInterval(weatherTimer);
    }, []);

    const hasWeather = weather && weather.current && !weather.error;
    const current = hasWeather
        ? describeWeather(weather.current.weathercode, weather.current.is_day !== 0)
        : null;
    const forecast = (weather && weather.forecast) || [];

    let skyKind = current ? current.kind : "cloudy";
    let night = hasWeather ? weather.current.is_day === 0 : false;
    if (PREVIEW.get("sky")) skyKind = PREVIEW.get("sky");
    if (PREVIEW.get("night")) night = PREVIEW.get("night") === "1";

    return (
        <DisplayLayout padding="sm">
            <WeatherBackground kind={skyKind} night={night} />
            <div style={{
                position: "relative",
                zIndex: 1,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "1.2vh",
                color: "#ffffff",
                textShadow: "0 1px 3px rgba(0, 0, 0, 0.25)",
            }}>

                {/* Location */}
                <div style={{
                    flex: "none",
                    textAlign: "center",
                    fontSize: "min(5vh, 8.4vw)",
                    fontWeight: 700,
                    lineHeight: 1.1,
                    padding: "1vh 8px 0.4vh",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}>
                    📍 {(weather && weather.location) || "—"}
                </div>

                {/* Current conditions */}
                <Card style={{
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-evenly",
                    padding: "2vh 8px",
                    minHeight: "24vh",
                    ...GLASS,
                }}>
                    {hasWeather ? (
                        <>
                            <div style={{ fontSize: "min(13vh, 21vw)", lineHeight: 1 }}>{current.icon}</div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "min(13vh, 21vw)", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em" }}>
                                    {Math.round(weather.current.temperature)}°F
                                </div>
                                <div style={{ color: SECONDARY, fontSize: "min(3.2vh, 5.4vw)", marginTop: "1vh" }}>
                                    Current Temp · {current.label}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ color: SECONDARY, fontSize: "min(3vh, 5vw)" }}>
                            {weather ? "Weather unavailable" : "Loading weather…"}
                        </div>
                    )}
                </Card>

                {/* 7-day forecast: rows share whatever height is left */}
                <Card padding="sm" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 12px", ...GLASS }}>
                    {forecast.map((day, idx) => {
                        const dayWeather = describeWeather(day.code);
                        return (
                            <div
                                key={day.date}
                                style={{
                                    flex: 1,
                                    minHeight: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    borderBottom: idx === forecast.length - 1 ? "none" : DIVIDER,
                                }}
                            >
                                <span style={{ flex: "0 0 22%", fontWeight: 600, fontSize: "min(4vh, 6.6vw)" }}>
                                    {formatDay(day.date)}
                                </span>
                                <span style={{ flex: "0 0 18%", textAlign: "center", fontSize: "min(5.4vh, 9vw)", lineHeight: 1 }}>
                                    {dayWeather.icon}
                                </span>
                                <span style={{ flex: "0 0 24%", textAlign: "center", lineHeight: 1.1 }}>
                                    <span style={{ display: "block", fontSize: "min(3.4vh, 5.6vw)", fontWeight: 600, color: RAIN }}>
                                        {formatPercent(day.rain_chance)}
                                    </span>
                                    <span style={{ fontSize: "min(1.7vh, 2.9vw)", color: SECONDARY, letterSpacing: "0.08em" }}>
                                        RAIN
                                    </span>
                                </span>
                                <span style={{ flex: 1, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                    <span style={{ fontWeight: 700, fontSize: "min(4.4vh, 7.3vw)" }}>{Math.round(day.high)}°</span>
                                    <span style={{ color: SECONDARY, marginLeft: "1.5vw", fontSize: "min(3.5vh, 5.8vw)" }}>
                                        {Math.round(day.low)}°
                                    </span>
                                </span>
                            </div>
                        );
                    })}
                </Card>

            </div>
        </DisplayLayout>
    );
}
