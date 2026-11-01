import React, { useEffect, useRef } from "react";

// Animated full-screen sky that reflects the current conditions,
// in the spirit of Apple's Weather app backgrounds.
//
// kind:  clear | partlyCloudy | cloudy | fog | drizzle | rain | showers | snow | thunderstorm
// night: true after sunset

// Slow scenes (stars, drifting clouds) need far fewer frames than falling rain/snow.
const SLOW_FPS = 15;
const FAST_FPS = 24;

// Sky gradients [top, bottom] for day and night.
const SKIES = {
    clear:        { day: ["#1d64c4", "#62a9ec"], night: ["#060a1c", "#1a2550"] },
    partlyCloudy: { day: ["#3274c2", "#80b2e2"], night: ["#0c1128", "#27324f"] },
    cloudy:       { day: ["#56636f", "#8995a1"], night: ["#16191f", "#323942"] },
    fog:          { day: ["#7a838c", "#a8afb6"], night: ["#1f2328", "#3a3f46"] },
    drizzle:      { day: ["#45525f", "#6e7b88"], night: ["#12171e", "#2a323d"] },
    rain:         { day: ["#36424f", "#5b6875"], night: ["#0e1218", "#252c36"] },
    showers:      { day: ["#40556d", "#7189a3"], night: ["#10151d", "#28313d"] },
    snow:         { day: ["#6c7d90", "#a7b5c3"], night: ["#1b212c", "#39434f"] },
    thunderstorm: { day: ["#252a36", "#454c5c"], night: ["#0b0d13", "#232733"] },
};

// What to draw for each condition.
const SCENES = {
    clear:        { stars: 1.0, sun: true, clouds: 0 },
    partlyCloudy: { stars: 0.6, sun: true, clouds: 4 },
    cloudy:       { stars: 0, clouds: 9, cloudAlpha: 0.55 },
    fog:          { stars: 0, clouds: 4, cloudAlpha: 0.35, fog: true },
    drizzle:      { stars: 0, clouds: 6, cloudAlpha: 0.5, rain: 50, rainSpeed: 0.7, rainLength: 10 },
    rain:         { stars: 0, clouds: 6, cloudAlpha: 0.55, rain: 110, rainSpeed: 1, rainLength: 22 },
    showers:      { stars: 0, sun: true, clouds: 5, cloudAlpha: 0.5, rain: 80, rainSpeed: 1, rainLength: 18 },
    snow:         { stars: 0, clouds: 5, cloudAlpha: 0.5, snow: 80 },
    thunderstorm: { stars: 0, clouds: 7, cloudAlpha: 0.6, rain: 140, rainSpeed: 1.2, rainLength: 26, lightning: true },
};

const rand = (min, max) => min + Math.random() * (max - min);

// A soft, blurred cloud puff rendered once and reused every frame.
function makeCloudSprite(color) {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 160;
    const g = c.getContext("2d");
    const puffs = [[90, 100, 60], [160, 80, 75], [235, 100, 58], [150, 115, 70]];
    for (const [x, y, r] of puffs) {
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(${color},0.9)`);
        grad.addColorStop(0.6, `rgba(${color},0.55)`);
        grad.addColorStop(1, `rgba(${color},0)`);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
    }
    return c;
}

export default function WeatherBackground({ kind = "clear", night = false }) {
    const canvasRef = useRef(null);
    const sky = (SKIES[kind] || SKIES.cloudy)[night ? "night" : "day"];
    const scene = SCENES[kind] || SCENES.cloudy;

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        let width = 0;
        let height = 0;
        let frame;
        let last = 0;

        const cloudSprite = makeCloudSprite(night ? "120,130,150" : "255,255,255");
        let stars = [];
        let clouds = [];
        let drops = [];
        let flakes = [];
        let fogBands = [];
        let flash = 0;
        const frameMs = 1000 / (scene.rain || scene.snow ? FAST_FPS : SLOW_FPS);

        function setup() {
            const dpr = window.devicePixelRatio || 1;
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const starCount = night ? Math.round(140 * (scene.stars || 0)) : 0;
            stars = Array.from({ length: starCount }, () => ({
                x: rand(0, width),
                y: rand(0, height * 0.75),
                r: rand(0.4, 1.5),
                phase: rand(0, Math.PI * 2),
                speed: rand(0.6, 2),
            }));
            clouds = Array.from({ length: scene.clouds || 0 }, (_, i) => ({
                x: rand(-200, width),
                y: rand(-40, height * (scene.rain || scene.snow ? 0.35 : 0.55)) + (i % 3) * 10,
                scale: rand(0.8, 1.8),
                speed: rand(4, 12),
            }));
            drops = Array.from({ length: scene.rain || 0 }, () => ({
                x: rand(0, width),
                y: rand(-height, height),
                speed: rand(500, 800) * (scene.rainSpeed || 1),
                length: rand(0.6, 1.2) * (scene.rainLength || 18),
                alpha: rand(0.25, 0.55),
            }));
            flakes = Array.from({ length: scene.snow || 0 }, () => ({
                x: rand(0, width),
                y: rand(-height, height),
                r: rand(1.2, 3.4),
                speed: rand(30, 80),
                drift: rand(0.5, 1.5),
                phase: rand(0, Math.PI * 2),
            }));
            fogBands = scene.fog
                ? Array.from({ length: 6 }, (_, i) => ({
                    y: height * (0.3 + i * 0.12),
                    x: rand(-width, 0),
                    speed: rand(6, 14) * (i % 2 ? 1 : -1),
                    h: rand(60, 120),
                }))
                : [];
        }

        function draw(t) {
            frame = requestAnimationFrame(draw);
            if (t - last < frameMs) return;
            const dt = Math.min((t - last) / 1000, 0.1);
            last = t;
            const time = t / 1000;

            ctx.clearRect(0, 0, width, height);

            // Stars
            for (const s of stars) {
                const a = 0.45 + 0.55 * Math.sin(time * s.speed + s.phase) ** 2;
                ctx.fillStyle = `rgba(255,255,255,${a})`;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Sun glow or moon glow in the upper right
            if (scene.sun && !scene.rain) {
                const pulse = 1 + 0.04 * Math.sin(time * 0.8);
                const cx = width * 0.82;
                const cy = height * 0.08;
                const r = width * 0.75 * pulse;
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                if (night) {
                    grad.addColorStop(0, "rgba(220,230,255,0.18)");
                    grad.addColorStop(1, "rgba(220,230,255,0)");
                } else {
                    grad.addColorStop(0, "rgba(255,244,200,0.55)");
                    grad.addColorStop(0.25, "rgba(255,225,140,0.22)");
                    grad.addColorStop(1, "rgba(255,225,140,0)");
                }
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width, height);
            }

            // Clouds drifting to the right
            ctx.globalAlpha = scene.cloudAlpha ?? 0.45;
            for (const c of clouds) {
                c.x += c.speed * dt;
                const w = cloudSprite.width * c.scale;
                if (c.x > width + 20) c.x = -w;
                ctx.drawImage(cloudSprite, c.x, c.y, w, cloudSprite.height * c.scale);
            }
            ctx.globalAlpha = 1;

            // Fog bands
            for (const b of fogBands) {
                b.x += b.speed * dt;
                if (b.x > 0) b.x -= width;
                if (b.x < -width) b.x += width;
                const grad = ctx.createLinearGradient(0, b.y - b.h / 2, 0, b.y + b.h / 2);
                grad.addColorStop(0, "rgba(220,225,230,0)");
                grad.addColorStop(0.5, "rgba(220,225,230,0.18)");
                grad.addColorStop(1, "rgba(220,225,230,0)");
                ctx.fillStyle = grad;
                ctx.fillRect(b.x, b.y - b.h / 2, width * 2, b.h);
            }

            // Rain streaks, slightly slanted
            if (drops.length) {
                ctx.lineCap = "round";
                ctx.lineWidth = 1.4;
                for (const d of drops) {
                    d.y += d.speed * dt;
                    d.x += d.speed * 0.08 * dt;
                    if (d.y > height) {
                        d.y = rand(-60, -10);
                        d.x = rand(-20, width);
                    }
                    ctx.strokeStyle = `rgba(200,225,255,${d.alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(d.x - d.length * 0.08, d.y - d.length);
                    ctx.stroke();
                }
            }

            // Snow
            for (const f of flakes) {
                f.y += f.speed * dt;
                f.x += Math.sin(time * f.drift + f.phase) * 0.4;
                if (f.y > height) {
                    f.y = rand(-30, -5);
                    f.x = rand(0, width);
                }
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Lightning: occasional quick double flash
            if (scene.lightning) {
                if (flash <= 0 && Math.random() < dt / 7) flash = 1;
                if (flash > 0) {
                    const a = flash > 0.6 ? 0.35 : flash > 0.4 ? 0 : flash * 0.5;
                    ctx.fillStyle = `rgba(230,235,255,${a})`;
                    ctx.fillRect(0, 0, width, height);
                    flash -= dt * 2.5;
                }
            }
        }

        setup();
        frame = requestAnimationFrame(draw);
        window.addEventListener("resize", setup);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", setup);
        };
    }, [kind, night]);

    return (
        <div
            aria-hidden="true"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[1]} 100%)`,
                transition: "background 2s ease",
            }}
        >
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
    );
}
