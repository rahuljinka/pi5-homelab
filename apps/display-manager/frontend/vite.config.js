// Dev server only (production is built and served by nginx, see the Dockerfile).
// Forwards /api to the dev backend, the same path nginx uses in production.
// Host names it answers to (besides localhost) come from DEV_HOSTS in .env,
// e.g. "mypi,mypi.example.ts.net", so they stay out of the repo.
import { defineConfig } from "vite";

const allowedHosts = (process.env.DEV_HOSTS || "").split(",").map((h) => h.trim()).filter(Boolean);

export default defineConfig({
    server: {
        host: true,
        allowedHosts,
        proxy: { "/api": process.env.API_TARGET || "http://backend:8000" },
    },
});
