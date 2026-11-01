import React, { useEffect, useRef, useState } from "react";
import "@fontsource-variable/antonio";

// Same-origin: the display's web server forwards /api to the backend.
const API = "/api";

// How long each photo stays up before cross-fading to the next one.
const PHOTO_INTERVAL_MS = 10 * 60 * 1000;
// How often to re-check the folder for added/removed photos.
const PHOTO_LIST_REFRESH_MS = 5 * 60 * 1000;
const FADE_MS = 1500;

// For testing layouts: ?time=12:58 freezes the clock at that time.
const PREVIEW_TIME = new URLSearchParams(window.location.search).get("time");

function previewDate() {
    const [h, m] = PREVIEW_TIME.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

// "Sat Oct 31" (iPhone lock screen style, no comma).
function formatDate(date) {
    const parts = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" })
        .formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get("weekday")} ${get("month")} ${get("day")}`;
}

// Shown when the photo folder is empty: a sky gradient for the time of day.
function fallbackColors(hour) {
    if (hour < 5 || hour >= 21) return ["#070b1d", "#1b2752"];
    if (hour < 8) return ["#4a5fa8", "#f2a27a"];
    if (hour < 17) return ["#2f7fd6", "#a4d0f4"];
    return ["#3d3a87", "#ee8a5e"];
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// ---- Legible digit colors -------------------------------------------------
// The digits take a light or dark tint of the photo's own color, whichever
// contrasts more with the part of the photo behind them.

// Areas behind the date + hours row and behind the minutes row, as fractions
// of the screen. Each row gets its own color so a bright sky over a dark
// foreground still leaves both rows readable.
const DIGIT_REGIONS = {
    top: { x0: 0.18, x1: 0.82, y0: 0.03, y1: 0.52 },
    bottom: { x0: 0.18, x1: 0.82, y0: 0.52, y1: 0.95 },
};

const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
}

// Average color of each digit area, as the photo appears on screen
// (object-fit: cover on a 480x800 portrait screen).
function sampleDigitAreas(img) {
    try {
        const W = 48;
        const H = 80;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

        const average = (region) => {
            const x0 = Math.floor(W * region.x0);
            const y0 = Math.floor(H * region.y0);
            const w = Math.ceil(W * (region.x1 - region.x0));
            const h = Math.ceil(H * (region.y1 - region.y0));
            const data = ctx.getImageData(x0, y0, w, h).data;
            let r = 0, g = 0, b = 0;
            const n = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
                r += data[i]; g += data[i + 1]; b += data[i + 2];
            }
            return [r / n, g / n, b / n];
        };
        return { top: average(DIGIT_REGIONS.top), bottom: average(DIGIT_REGIONS.bottom) };
    } catch {
        return null; // e.g. image couldn't be read; fall back to defaults
    }
}

// A soft, blurred copy of the photo exactly as it's laid out on screen.
// The digits are filled with it so they look like frosted glass over the photo.
function blurredBackdrop(img) {
    try {
        const W = 120;
        const H = 200;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.filter = "blur(5px) saturate(1.4) brightness(1.08)";
        // Draw a little oversized so the blur doesn't fade out at the edges.
        const pad = 12;
        ctx.drawImage(img, (W - dw) / 2 - pad, (H - dh) / 2 - pad, dw + pad * 2, dh + pad * 2);
        return canvas.toDataURL("image/jpeg", 0.85);
    } catch {
        return null;
    }
}

function rowPalettes(samples) {
    return samples
        ? { top: paletteFor(samples.top), bottom: paletteFor(samples.bottom) }
        : { top: LIGHT_DEFAULT, bottom: LIGHT_DEFAULT };
}

function paletteFor(rgb) {
    if (!rgb) return LIGHT_DEFAULT;
    const y = luminance(rgb);
    // WCAG-style contrast against near-white vs near-black digits.
    const contrastLight = 1.0 / (y + 0.05);
    const contrastDark = (y + 0.05) / 0.065;
    const [h, s] = rgbToHsl(rgb);
    const tint = Math.min(s, 0.5);

    if (contrastLight >= contrastDark) {
        return {
            // Frosted glass: blurred photo seen through a light, slightly tinted pane
            // that is brighter at the top, like light catching the glass.
            glassTint: `linear-gradient(180deg, hsla(${h}, ${tint * 60}%, 97%, 0.55) 0%, hsla(${h}, ${tint * 60}%, 92%, 0.30) 100%)`,
            stroke: "rgba(255, 255, 255, 0.90)",
            glow: "drop-shadow(0 3px 14px rgba(0, 0, 0, 0.28)) drop-shadow(0 1px 1px rgba(0, 0, 0, 0.18))",
            date: "rgba(255, 255, 255, 0.94)",
            dateShadow: "0 1px 6px rgba(0, 0, 0, 0.35)",
            shade: "linear-gradient(180deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0) 70%)",
        };
    }
    return {
        // Smoked glass for bright photos: same blurred photo through a dark pane.
        glassTint: `linear-gradient(180deg, hsla(${h}, ${tint * 100}%, 12%, 0.72) 0%, hsla(${h}, ${tint * 100}%, 14%, 0.58) 100%)`,
        stroke: `hsla(${h}, ${tint * 100}%, 6%, 0.55)`,
        glow: "drop-shadow(0 3px 14px rgba(255, 255, 255, 0.35)) drop-shadow(0 1px 1px rgba(255, 255, 255, 0.25))",
        date: `hsla(${h}, ${tint * 100}%, 12%, 0.92)`,
        dateShadow: "0 1px 6px rgba(255, 255, 255, 0.4)",
        shade: "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 45%, rgba(255,255,255,0) 70%)",
    };
}

const LIGHT_DEFAULT = paletteFor([20, 25, 45]);

function fallbackPalettes(hour) {
    const [top, bottom] = fallbackColors(hour).map(hexToRgb);
    const mix = (t) => top.map((c, i) => c + (bottom[i] - c) * t);
    return { top: paletteFor(mix(0.25)), bottom: paletteFor(mix(0.75)) };
}

function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

const photoUrl = (name) => `${API}/clock/photos/${encodeURIComponent(name)}`;

function reportShowing(file) {
    fetch(`${API}/clock/showing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file }),
    }).catch(() => {});
}

// Two stacked layers so the next photo can fade in over the current one.
// Photos rotate every PHOTO_INTERVAL_MS; picking one in the control panel
// ("Show now") switches immediately and restarts that countdown.
function usePhotoRotation() {
    const [photos, setPhotos] = useState([]);
    const [layers, setLayers] = useState({ front: null, back: null, showFront: true });
    const [palettes, setPalettes] = useState({});
    const queue = useRef([]);
    const photosRef = useRef([]);
    const layersRef = useRef(layers);
    layersRef.current = layers;
    const pending = useRef(null);
    const lastChange = useRef(Date.now());
    const lastRequestId = useRef(null);
    const startedFrom = useRef(undefined); // photo showing before a page reload
    // "slideshow" rotates; "single" stays on the chosen file (set in the control panel).
    const mode = useRef({ mode: "slideshow", file: null });

    // The chosen single photo, if single mode is on and that photo still exists.
    const singlePhoto = () => {
        const { mode: m, file } = mode.current;
        return m === "single" && file && photosRef.current.includes(file) ? file : null;
    };

    const visible = layers.showFront ? layers.front : layers.back;

    async function loadList() {
        try {
            const response = await fetch(`${API}/clock/photos`);
            const data = await response.json();
            photosRef.current = data.photos || [];
            setPhotos(photosRef.current);
        } catch (error) {
            console.error("Clock photos error:", error);
        }
    }

    function nextPhoto(current) {
        const available = photosRef.current;
        if (available.length === 0) return null;
        // Play through a shuffled order, then reshuffle (avoiding an immediate repeat).
        queue.current = queue.current.filter((name) => available.includes(name));
        if (queue.current.length === 0) {
            queue.current = shuffle(available);
            if (queue.current.length > 1 && queue.current[0] === current) {
                queue.current.push(queue.current.shift());
            }
        }
        return queue.current.shift();
    }

    function showPhoto(name) {
        const prev = layersRef.current;
        const current = prev.showFront ? prev.front : prev.back;
        if (!name || name === current) return;

        // Load the image fully before fading so there's no blank flash.
        pending.current = name;
        const img = new Image();
        img.crossOrigin = "anonymous"; // lets us read its pixels for the digit color
        img.onload = () => {
            if (pending.current !== name) return; // a newer pick superseded this one
            const palette = { ...rowPalettes(sampleDigitAreas(img)), glass: blurredBackdrop(img) };
            setPalettes((latest) => ({ ...latest, [name]: palette }));
            setLayers((latest) => latest.showFront
                ? { ...latest, back: name, showFront: false }
                : { ...latest, front: name, showFront: true });
        };
        img.onerror = () => {
            if (pending.current === name) pending.current = null; // allow a retry
        };
        img.src = photoUrl(name);
    }

    function advance() {
        const prev = layersRef.current;
        showPhoto(nextPhoto(prev.showFront ? prev.front : prev.back));
    }

    // "Show now" requests from the control panel.
    async function checkRequest() {
        try {
            const response = await fetch(`${API}/clock/current`);
            const data = await response.json();
            if (startedFrom.current === undefined) startedFrom.current = data.showing || null;
            mode.current = { mode: data.mode_mode || "slideshow", file: data.mode_file || null };

            // The backend forgets what's on screen when it restarts; remind it.
            const shown = layersRef.current.showFront ? layersRef.current.front : layersRef.current.back;
            if (shown && data.showing !== shown) reportShowing(shown);

            // Single-photo mode: make sure the chosen photo is the one up.
            const single = singlePhoto();
            if (single) {
                const l = layersRef.current;
                const current = l.showFront ? l.front : l.back;
                if (single !== current && pending.current !== single) showPhoto(single);
            }

            if (lastRequestId.current === null) {
                // First check after loading: remember the id, don't replay old picks.
                lastRequestId.current = data.request_id;
                return;
            }
            if (data.request_id !== lastRequestId.current) {
                lastRequestId.current = data.request_id;
                if (data.request_file) showPhoto(data.request_file);
            }
        } catch {
            // Backend briefly unavailable; try again next time.
        }
    }

    useEffect(() => {
        // Learn which photo was up before a reload first, then load the list.
        checkRequest().finally(loadList);
        const listTimer = setInterval(loadList, PHOTO_LIST_REFRESH_MS);
        const requestTimer = setInterval(checkRequest, 3000);
        // Checked often so the countdown restarts cleanly after a manual pick.
        const rotationTimer = setInterval(() => {
            if (singlePhoto()) return; // single-photo mode: no rotation
            if (Date.now() - lastChange.current >= PHOTO_INTERVAL_MS) {
                lastChange.current = Date.now();
                advance();
            }
        }, 15000);
        return () => {
            clearInterval(listTimer);
            clearInterval(requestTimer);
            clearInterval(rotationTimer);
        };
    }, []);

    // Show the first photo as soon as the list arrives (continuing with the one
    // that was up before a reload, if it's still there), and replace the
    // current one if it was removed from the folder.
    useEffect(() => {
        const single = singlePhoto();
        if (single) {
            if (single !== visible) showPhoto(single);
            return;
        }
        if (photos.length === 0 || (visible && photos.includes(visible))) return;
        const resume = startedFrom.current;
        if (!visible && resume && photos.includes(resume)) showPhoto(resume);
        else advance();
    }, [photos]);

    // Whenever the photo changes, restart the countdown and tell the backend,
    // so the control panel can show which photo is on screen.
    useEffect(() => {
        if (!visible) return;
        lastChange.current = Date.now();
        reportShowing(visible);
    }, [visible]);

    return { layers, hasPhotos: photos.length > 0, palette: visible ? palettes[visible] : null };
}

const DIGITS = {
    fontFamily: '"Antonio Variable", "Inter Variable", sans-serif',
    fontWeight: 400,
    // Each row fills its share of the height, but never gets wider than the screen.
    fontSize: "min(42vh, 115vw)",
    lineHeight: 0.98,
    letterSpacing: "-0.01em",
    fontVariantNumeric: "tabular-nums",
    // Fill/rim/shadow come from the palette for the current photo (see paletteFor).
    color: "transparent",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    // The fill image is laid out against the whole screen, so each digit shows
    // the blurred part of the photo that's actually behind it.
    backgroundAttachment: "fixed",
    backgroundSize: "100vw 100vh, 100vw 100vh",
    backgroundRepeat: "no-repeat",
    // Glyphs reach slightly outside the tight line box; pad the box so the
    // glass fill covers them fully, and cancel the padding with margins so
    // the layout doesn't move.
    padding: "0.07em 0",
    margin: "-0.07em 0",
    textAlign: "center",
    whiteSpace: "nowrap",
};

export default function ClockScreen() {
    const [now, setNow] = useState(() => (PREVIEW_TIME ? previewDate() : new Date()));
    const { layers, hasPhotos, palette: photoPalette } = usePhotoRotation();

    useEffect(() => {
        if (PREVIEW_TIME) return undefined;
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeParts = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).formatToParts(now);
    const hours = timeParts.find((p) => p.type === "hour")?.value;
    const minutes = timeParts.find((p) => p.type === "minute")?.value;

    const rows = (hasPhotos && photoPalette) || fallbackPalettes(now.getHours());
    const palette = rows.top; // date, shade and hours row
    const [skyTop, skyBottom] = fallbackColors(now.getHours());
    const glassSource = (hasPhotos && photoPalette && photoPalette.glass)
        ? `url(${photoPalette.glass})`
        : `linear-gradient(180deg, ${skyTop} 0%, ${skyBottom} 100%)`;
    const digitStyle = (p) => ({
        ...DIGITS,
        backgroundImage: `${p.glassTint}, ${glassSource}`,
        WebkitTextStroke: `1.5px ${p.stroke}`,
        filter: p.glow,
    });

    const layerStyle = (visible) => ({
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
    });

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            overflow: "hidden",
            background: `linear-gradient(180deg, ${skyTop} 0%, ${skyBottom} 100%)`,
            userSelect: "none",
        }}>
            {/* Wallpaper */}
            {hasPhotos && layers.front && (
                <img src={photoUrl(layers.front)} alt="" style={layerStyle(layers.showFront)} />
            )}
            {hasPhotos && layers.back && (
                <img src={photoUrl(layers.back)} alt="" style={layerStyle(!layers.showFront)} />
            )}

            {/* Soft shade behind the date/digits: darkens for light digits, brightens for dark ones */}
            <div style={{
                position: "absolute",
                inset: 0,
                background: palette.shade,
            }} />

            {/* Date + stacked time */}
            <div style={{
                position: "relative",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: "3vh",
            }}>
                <div style={{
                    fontFamily: '"Inter Variable", sans-serif',
                    fontSize: "min(4.4vh, 7.4vw)",
                    fontWeight: 600,
                    color: palette.date,
                    textShadow: palette.dateShadow,
                    transition: `color ${FADE_MS}ms ease`,
                    marginBottom: "1.5vh",
                }}>
                    {formatDate(now)}
                </div>
                <div style={digitStyle(rows.top)}>{hours}</div>
                <div style={digitStyle(rows.bottom)}>{minutes}</div>
            </div>
        </div>
    );
}
