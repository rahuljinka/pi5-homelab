// Dev server only (production is built and served by nginx, see the Dockerfile).
// Forwards /api to the dev backend, the same path nginx uses in production.
import { defineConfig } from "vite";

export default defineConfig({
    server: {
        host: true,
        proxy: { "/api": process.env.API_TARGET || "http://backend:8000" },
    },
});
